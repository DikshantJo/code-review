/**
 * Fallback Handler utility for AI Code Review system
 * Provides comprehensive fallback mechanisms for AI response failures
 */
class FallbackHandler {
  constructor(config) {
    this.config = config;
    this.enableFallbacks = config?.fallbacks?.enabled !== false;
    this.maxFallbackAttempts = config?.fallbacks?.max_attempts || 3;
    this.fallbackStrategies = config?.fallbacks?.strategies || ['retry', 'simplified', 'manual'];
  }

  /**
   * Determine appropriate fallback strategy based on error type
   * @param {Error} error - The error that occurred
   * @param {Object} context - Review context
   * @param {number} attempt - Current attempt number
   * @returns {string} Fallback strategy to use
   */
  determineFallbackStrategy(error, context = {}, attempt = 1) {
    if (!this.enableFallbacks) {
      return 'none';
    }

    // If we've exceeded max attempts, use manual fallback
    if (attempt >= this.maxFallbackAttempts) {
      return 'manual';
    }

    // Determine strategy based on error type
    const errorType = this.classifyError(error);
    
    switch (errorType) {
      case 'timeout':
        return attempt < 2 ? 'retry' : 'simplified';
      
      case 'rate_limit':
        return 'retry';
      
      case 'authentication':
        return 'manual';
      
      case 'malformed_response':
        return 'simplified';
      
      case 'network':
        return attempt < 2 ? 'retry' : 'manual';
      
      case 'token_limit':
        return 'simplified';
      
      default:
        return 'manual';
    }
  }

  /**
   * Alias method for determineFallbackStrategy (compatibility)
   * @param {Error} error - Error object
   * @param {Object} context - Error context
   * @param {number} attempt - Retry attempt number
   * @returns {string} Fallback strategy
   */
  determineStrategy(error, context = {}, attempt = 1) {
    return this.determineFallbackStrategy(error, context, attempt);
  }

  /**
   * Classify error type for fallback strategy selection
   * @param {Error} error - The error
   * @returns {string} Error type classification
   */
  classifyError(error) {
    if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
      return 'timeout';
    }
    
    if (error.message.includes('rate limit')) {
      return 'rate_limit';
    }
    
    if (error.message.includes('authentication') || error.message.includes('unauthorized')) {
      return 'authentication';
    }
    
    if (error.name === 'ParseError' || error.message.includes('parse') || error.message.includes('malformed')) {
      return 'malformed_response';
    }
    
    if (error.message.includes('network') || error.message.includes('connection')) {
      return 'network';
    }
    
    if (error.message.includes('token') || error.message.includes('context length')) {
      return 'token_limit';
    }
    
    return 'unknown';
  }

  /**
   * Create simplified prompt for retry attempts
   * @param {Object} originalPrompt - Original AI prompt
   * @param {Object} context - Review context
   * @returns {Object} Simplified prompt
   */
  createSimplifiedPrompt(originalPrompt, context = {}) {
    const simplified = {
      system: `You are a code reviewer. Review the provided code for issues and respond with a simple JSON format:
{
  "issues": [
    {
      "severity": "HIGH|MEDIUM|LOW",
      "category": "Security|Performance|Standards|Formatting|Logic",
      "description": "Brief description of the issue"
    }
  ],
  "summary": {
    "totalIssues": 0,
    "highSeverityCount": 0,
    "mediumSeverityCount": 0,
    "lowSeverityCount": 0
  }
}`,
      user: `Review this code for critical issues only. Focus on security and major problems. Keep response concise.

${originalPrompt.user || 'Code to review:'}`
    };

    return simplified;
  }

  /**
   * Create manual review fallback response
   * @param {Error} error - The error that occurred
   * @param {Object} context - Review context
   * @returns {Object} Manual review fallback
   */
  createManualReviewFallback(error, context = {}) {
    const fallback = {
      issues: [
        {
          severity: 'MEDIUM',
          category: 'Standards',
          description: 'AI code review service unavailable. Manual review required.',
          file: 'all',
          recommendation: 'Please have a team member review this code manually before merging.'
        }
      ],
      summary: {
        totalIssues: 1,
        highSeverityCount: 0,
        mediumSeverityCount: 1,
        lowSeverityCount: 0,
        fallbackUsed: true,
        fallbackType: 'manual_review',
        error: error.message
      },
      metadata: {
        fallbackReason: this.classifyError(error),
        timestamp: new Date().toISOString(),
        context: {
          repository: context.repository,
          branch: context.targetBranch,
          commit: context.commitSha,
          author: context.author
        },
        instructions: this.getManualReviewInstructions(context)
      }
    };

    return fallback;
  }

  /**
   * Get manual review instructions based on context
   * @param {Object} context - Review context
   * @returns {Array} Array of review instructions
   */
  getManualReviewInstructions(context = {}) {
    const instructions = [
      'Review code for security vulnerabilities',
      'Check for performance issues',
      'Verify coding standards compliance',
      'Ensure proper error handling',
      'Review for potential bugs or logic errors'
    ];

    // Add environment-specific instructions
    if (context.targetBranch === 'main' || context.targetBranch === 'master') {
      instructions.push('Pay special attention to production readiness');
      instructions.push('Verify all security measures are in place');
    }

    if (context.targetBranch === 'develop' || context.targetBranch === 'dev') {
      instructions.push('Focus on code quality and maintainability');
    }

    return instructions;
  }

  /**
   * Create degraded review fallback (simplified analysis)
   * @param {Object} context - Review context
   * @param {Array} files - Files to review
   * @returns {Object} Degraded review response
   */
  createDegradedReviewFallback(context = {}, files = []) {
    const issues = [];
    
    // Perform basic static analysis
    for (const file of files) {
      const fileIssues = this.performBasicAnalysis(file);
      issues.push(...fileIssues);
    }

    const fallback = {
      issues: issues,
      summary: {
        totalIssues: issues.length,
        highSeverityCount: issues.filter(i => i.severity === 'HIGH').length,
        mediumSeverityCount: issues.filter(i => i.severity === 'MEDIUM').length,
        lowSeverityCount: issues.filter(i => i.severity === 'LOW').length,
        fallbackUsed: true,
        fallbackType: 'degraded_review'
      },
      metadata: {
        fallbackReason: 'ai_service_unavailable',
        timestamp: new Date().toISOString(),
        context: {
          repository: context.repository,
          branch: context.targetBranch,
          commit: context.commitSha
        },
        note: 'This review was performed using basic static analysis due to AI service unavailability.'
      }
    };

    return fallback;
  }

  /**
   * Perform basic static analysis on a file
   * @param {Object} file - File object with path and content
   * @returns {Array} Array of basic issues found
   */
  performBasicAnalysis(file) {
    const issues = [];
    const content = file.content || '';
    const path = file.path || 'unknown';

    // Check for common security issues
    if (content.includes('eval(') || content.includes('innerHTML')) {
      issues.push({
        severity: 'HIGH',
        category: 'Security',
        description: 'Potential security vulnerability detected',
        file: path,
        recommendation: 'Avoid using eval() or innerHTML with user input'
      });
    }

    // Check for hardcoded credentials
    if (content.includes('password') && content.includes('=')) {
      issues.push({
        severity: 'HIGH',
        category: 'Security',
        description: 'Potential hardcoded credentials detected',
        file: path,
        recommendation: 'Use environment variables for sensitive data'
      });
    }

    // Check for console.log statements in production code
    if (content.includes('console.log(') && !path.includes('test')) {
      issues.push({
        severity: 'LOW',
        category: 'Standards',
        description: 'Console.log statement found in production code',
        file: path,
        recommendation: 'Remove or replace with proper logging'
      });
    }

    // Check for large functions (basic heuristic)
    const lines = content.split('\n');
    if (lines.length > 50) {
      issues.push({
        severity: 'MEDIUM',
        category: 'Standards',
        description: 'Large function or file detected',
        file: path,
        recommendation: 'Consider breaking down into smaller, more manageable functions'
      });
    }

    return issues;
  }

  /**
   * Create emergency bypass fallback
   * @param {Object} context - Review context
   * @param {string} reason - Reason for bypass
   * @returns {Object} Emergency bypass response
   */
  createEmergencyBypassFallback(context = {}, reason = 'emergency') {
    const fallback = {
      issues: [],
      summary: {
        totalIssues: 0,
        highSeverityCount: 0,
        mediumSeverityCount: 0,
        lowSeverityCount: 0,
        fallbackUsed: true,
        fallbackType: 'emergency_bypass',
        bypassReason: reason
      },
      metadata: {
        fallbackReason: 'emergency_bypass',
        timestamp: new Date().toISOString(),
        context: {
          repository: context.repository,
          branch: context.targetBranch,
          commit: context.commitSha,
          author: context.author
        },
        warning: 'Code review was bypassed due to emergency. Manual review is strongly recommended.'
      }
    };

    return fallback;
  }

  /**
   * Alias method for executeFallbackStrategy (compatibility)
   * @param {string} strategy - Fallback strategy to execute
   * @param {Object} params - Parameters for the strategy
   * @returns {Object} Fallback result
   */
  async executeStrategy(strategy, params = {}) {
    return await this.executeFallbackStrategy(strategy, params);
  }

  /**
   * Execute fallback strategy
   * @param {string} strategy - Fallback strategy to execute
   * @param {Object} params - Parameters for the strategy
   * @returns {Object} Fallback result
   */
  async executeFallbackStrategy(strategy, params = {}) {
    const { error, context, attempt, originalPrompt, files } = params;

    switch (strategy) {
      case 'retry':
        return {
          type: 'retry',
          shouldRetry: true,
          delay: this.calculateRetryDelay(attempt)
        };

      case 'simplified':
        return {
          type: 'simplified',
          prompt: this.createSimplifiedPrompt(originalPrompt, context),
          shouldRetry: true
        };

      case 'degraded':
        return {
          type: 'degraded',
          response: this.createDegradedReviewFallback(context, files),
          shouldRetry: false
        };

      case 'manual':
        return {
          type: 'manual',
          response: this.createManualReviewFallback(error, context),
          shouldRetry: false
        };

      case 'emergency':
        return {
          type: 'emergency',
          response: this.createEmergencyBypassFallback(context, params.reason),
          shouldRetry: false
        };

      default:
        return {
          type: 'none',
          shouldRetry: false
        };
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   * @param {number} attempt - Current attempt number
   * @returns {number} Delay in milliseconds
   */
  calculateRetryDelay(attempt) {
    const baseDelay = 1000;
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay;
    return Math.min(exponentialDelay + jitter, 10000);
  }

  /**
   * Get fallback configuration
   * @returns {Object} Fallback configuration
   */
  getConfiguration() {
    return {
      enabled: this.enableFallbacks,
      maxAttempts: this.maxFallbackAttempts,
      strategies: this.fallbackStrategies
    };
  }

  /**
   * Check if fallbacks are enabled
   * @returns {boolean} Whether fallbacks are enabled
   */
  isEnabled() {
    return this.enableFallbacks;
  }
}

module.exports = FallbackHandler;



