/**
 * AI Response Handler utility for AI Code Review system
 * Handles malformed responses, retry logic, and fallback mechanisms
 */
class ResponseHandler {
  constructor(config) {
    this.config = config;
    this.maxRetries = config?.ai?.max_retries || 3;
    this.retryDelayMs = config?.ai?.retry_delay_ms || 1000;
    this.maxRetryDelayMs = config?.ai?.max_retry_delay_ms || 10000;
    this.timeoutMs = config?.ai?.timeout_seconds * 1000 || 30000;
  }

  /**
   * Validate AI response structure and content
   * @param {Object} response - AI response object
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  validateResponse(response, options = {}) {
    const validation = {
      isValid: false,
      errors: [],
      warnings: [],
      retryable: false,
      fallbackNeeded: false
    };

    // Check if response exists
    if (!response) {
      validation.errors.push('Response is null or undefined');
      validation.retryable = true;
      return validation;
    }

    // Check if response is an object
    if (typeof response !== 'object' || Array.isArray(response)) {
      validation.errors.push('Response must be an object');
      validation.retryable = true;
      return validation;
    }

    // Check required fields
    const requiredFields = options.requiredFields || ['issues', 'summary'];
    for (const field of requiredFields) {
      if (!(field in response)) {
        validation.errors.push(`Missing required field: ${field}`);
        validation.retryable = true;
      }
    }

    // Validate issues array
    if (response.issues) {
      if (!Array.isArray(response.issues)) {
        validation.errors.push('Issues field must be an array');
        validation.retryable = true;
      } else {
        // Validate each issue
        for (let i = 0; i < response.issues.length; i++) {
          const issue = response.issues[i];
          const issueValidation = this.validateIssue(issue, i);
          validation.errors.push(...issueValidation.errors);
          validation.warnings.push(...issueValidation.warnings);
        }
      }
    }

    // Validate summary
    if (response.summary && typeof response.summary !== 'object') {
      validation.errors.push('Summary field must be an object');
      validation.retryable = true;
    }

    // Check for malformed but potentially usable content
    if (validation.errors.length === 0 && validation.warnings.length > 0) {
      validation.isValid = true;
      validation.fallbackNeeded = true;
    } else if (validation.errors.length === 0) {
      validation.isValid = true;
    }

    return validation;
  }

  /**
   * Parse and validate AI response
   * @param {Object} aiResponse - Raw AI response from OpenAI
   * @returns {Object} Parsed and validated response
   */
  async parseResponse(aiResponse) {
    try {
      // Extract the content from OpenAI response
      const content = aiResponse.choices?.[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content found in AI response');
      }
      
      // Create a comprehensive parsed response structure
      const parsedResponse = {
        passed: true, // Default to passed unless issues found
        issues: [],
        severityBreakdown: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0
        },
        summary: {
          overallStatus: 'PASS',
          totalIssues: 0,
          qualityScore: 100
        }
      };
      
      // Enhanced AI response parsing with detailed descriptions
      // Look for various types of issues and provide rich descriptions
      
      // Security Issues Detection
      if (content.toLowerCase().includes('security') || content.toLowerCase().includes('vulnerability') || 
          content.toLowerCase().includes('injection') || content.toLowerCase().includes('xss') ||
          content.toLowerCase().includes('csrf') || content.toLowerCase().includes('authentication')) {
        parsedResponse.passed = false;
        parsedResponse.issues.push({
          severity: 'HIGH',
          title: 'Security Vulnerability Detected',
          description: `The AI has identified a potential security concern in your code. This type of vulnerability could potentially allow attackers to compromise your application's security. The AI detected specific security-related patterns that require immediate attention and thorough review.`,
          file: 'unknown',
          line: 'unknown',
          category: 'security',
          recommendation: 'Conduct a comprehensive security review of the identified code sections. Consider implementing input validation, output encoding, and proper authentication mechanisms. Consult security best practices and consider using security scanning tools.'
        });
        parsedResponse.severityBreakdown.high = 1;
        parsedResponse.summary.totalIssues = 1;
        parsedResponse.summary.qualityScore = 70;
        parsedResponse.summary.overallStatus = 'FAIL';
      }
      
      // Performance Issues Detection
      if (content.toLowerCase().includes('performance') || content.toLowerCase().includes('slow') ||
          content.toLowerCase().includes('efficiency') || content.toLowerCase().includes('optimization')) {
        parsedResponse.passed = false;
        parsedResponse.issues.push({
          severity: 'MEDIUM',
          title: 'Performance Optimization Opportunity',
          description: `The AI has identified potential performance improvements in your code. While the code may function correctly, there are opportunities to enhance efficiency and reduce resource consumption. These optimizations could improve user experience and reduce operational costs.`,
          file: 'unknown',
          line: 'unknown',
          category: 'performance',
          recommendation: 'Review the identified code sections for potential performance bottlenecks. Consider implementing caching strategies, optimizing database queries, and reducing unnecessary computations. Profile the code to identify specific performance hotspots.'
        });
        parsedResponse.severityBreakdown.medium = 1;
        parsedResponse.summary.totalIssues = parsedResponse.summary.totalIssues + 1;
        parsedResponse.summary.qualityScore = Math.max(60, parsedResponse.summary.qualityScore - 10);
        parsedResponse.summary.overallStatus = parsedResponse.summary.overallStatus === 'PASS' ? 'WARN' : 'FAIL';
      }
      
      // Code Quality Issues Detection
      if (content.toLowerCase().includes('quality') || content.toLowerCase().includes('maintainability') ||
          content.toLowerCase().includes('readability') || content.toLowerCase().includes('standards')) {
        parsedResponse.issues.push({
          severity: 'LOW',
          title: 'Code Quality Improvement Suggested',
          description: `The AI has identified areas where code quality could be enhanced. These suggestions focus on improving code readability, maintainability, and adherence to coding standards. While not critical, addressing these issues will make your codebase more professional and easier to maintain.`,
          file: 'unknown',
          line: 'unknown',
          category: 'standards',
          recommendation: 'Review the suggested improvements and implement them where appropriate. Consider using automated code formatting tools, adding comprehensive documentation, and following established coding conventions for your programming language.'
        });
        parsedResponse.severityBreakdown.low = 1;
        parsedResponse.summary.totalIssues = parsedResponse.summary.totalIssues + 1;
        parsedResponse.summary.qualityScore = Math.max(50, parsedResponse.summary.qualityScore - 5);
        // Set passed to false for LOW issues so GitHub issues are created
        parsedResponse.passed = false;
      }
      
             // If no specific issues found, mark as passed with no issues
       if (parsedResponse.issues.length === 0) {
         parsedResponse.passed = true;
         parsedResponse.summary.overallStatus = 'PASS';
         parsedResponse.summary.qualityScore = 95;
         // No issues array - this will prevent GitHub issue creation
       }
      
      return parsedResponse;
      
    } catch (error) {
      // Return a detailed fallback response if parsing fails
      return {
        passed: false,
        issues: [{
          severity: 'MEDIUM',
          title: 'AI Response Parsing Failed',
          description: `The system encountered an error while processing the AI's response. This could be due to unexpected response format, network issues, or system configuration problems. The error details have been captured for debugging purposes.`,
          file: 'system',
          line: 'unknown',
          category: 'system',
          recommendation: 'Check the AI service configuration and response format. Verify that all required environment variables are properly set. If the issue persists, review the system logs for additional error details and consider implementing more robust error handling.'
        }],
        severityBreakdown: {
          critical: 0,
          high: 0,
          medium: 1,
          low: 0
        },
        summary: {
          overallStatus: 'ERROR',
          totalIssues: 1,
          qualityScore: 40
        }
      };
    }
  }

  /**
   * Validate individual issue structure
   * @param {Object} issue - Issue object
   * @param {number} index - Issue index
   * @returns {Object} Validation result
   */
  validateIssue(issue, index) {
    const validation = {
      errors: [],
      warnings: []
    };

    if (!issue || typeof issue !== 'object') {
      validation.errors.push(`Issue ${index}: Must be an object`);
      return validation;
    }

    // Check required issue fields
    const requiredIssueFields = ['severity', 'category', 'description'];
    for (const field of requiredIssueFields) {
      if (!(field in issue)) {
        validation.errors.push(`Issue ${index}: Missing required field: ${field}`);
      }
    }

    // Validate severity
    if (issue.severity) {
      const validSeverities = ['HIGH', 'MEDIUM', 'LOW'];
      if (!validSeverities.includes(issue.severity)) {
        validation.errors.push(`Issue ${index}: Invalid severity: ${issue.severity}`);
      }
    }

    // Validate category
    if (issue.category) {
      const validCategories = ['Security', 'Performance', 'Standards', 'Formatting', 'Logic'];
      if (!validCategories.includes(issue.category)) {
        validation.warnings.push(`Issue ${index}: Unknown category: ${issue.category}`);
      }
    }

    // Validate description
    if (issue.description && typeof issue.description !== 'string') {
      validation.errors.push(`Issue ${index}: Description must be a string`);
    }

    // Validate optional fields
    if (issue.file && typeof issue.file !== 'string') {
      validation.warnings.push(`Issue ${index}: File path should be a string`);
    }

    if (issue.line && (typeof issue.line !== 'number' || issue.line < 1)) {
      validation.warnings.push(`Issue ${index}: Line number should be a positive integer`);
    }

    if (issue.recommendation && typeof issue.recommendation !== 'string') {
      validation.warnings.push(`Issue ${index}: Recommendation should be a string`);
    }

    return validation;
  }

  /**
   * Attempt to fix malformed response
   * @param {Object} response - Malformed response
   * @param {Object} validation - Validation result
   * @returns {Object} Fixed response or null if unfixable
   */
  fixResponse(response, validation) {
    if (!response || typeof response !== 'object') {
      return null;
    }

    const fixed = { ...response };

    // Fix missing required fields
    if (!fixed.issues) {
      fixed.issues = [];
    }

    if (!fixed.summary) {
      fixed.summary = {
        totalIssues: 0,
        highSeverityCount: 0,
        mediumSeverityCount: 0,
        lowSeverityCount: 0
      };
    }

    // Fix issues array if it's not an array
    if (!Array.isArray(fixed.issues)) {
      fixed.issues = [];
    }

    // Fix individual issues
    fixed.issues = fixed.issues.map((issue, index) => {
      if (!issue || typeof issue !== 'object') {
        return null;
      }

      const fixedIssue = { ...issue };

      // Fix severity
      if (!fixedIssue.severity || !['HIGH', 'MEDIUM', 'LOW'].includes(fixedIssue.severity)) {
        fixedIssue.severity = 'MEDIUM';
      }

      // Fix category
      if (!fixedIssue.category || !['Security', 'Performance', 'Standards', 'Formatting', 'Logic'].includes(fixedIssue.category)) {
        fixedIssue.category = 'Standards';
      }

      // Fix description
      if (!fixedIssue.description || typeof fixedIssue.description !== 'string') {
        fixedIssue.description = 'Issue detected but description unavailable';
      }

      // Fix file path
      if (fixedIssue.file && typeof fixedIssue.file !== 'string') {
        fixedIssue.file = 'unknown';
      }

      // Fix line number
      if (fixedIssue.line && (typeof fixedIssue.line !== 'number' || fixedIssue.line < 1)) {
        delete fixedIssue.line;
      }

      // Fix recommendation
      if (fixedIssue.recommendation && typeof fixedIssue.recommendation !== 'string') {
        delete fixedIssue.recommendation;
      }

      return fixedIssue;
    }).filter(Boolean); // Remove null issues

    // Update summary
    if (fixed.summary && typeof fixed.summary === 'object') {
      fixed.summary.totalIssues = fixed.issues.length;
      fixed.summary.highSeverityCount = fixed.issues.filter(i => i.severity === 'HIGH').length;
      fixed.summary.mediumSeverityCount = fixed.issues.filter(i => i.severity === 'MEDIUM').length;
      fixed.summary.lowSeverityCount = fixed.issues.filter(i => i.severity === 'LOW').length;
    }

    return fixed;
  }

  /**
   * Create fallback response when AI fails
   * @param {Error} error - The error that occurred
   * @param {Object} context - Review context
   * @returns {Object} Fallback response
   */
  createFallbackResponse(error, context = {}) {
    const fallback = {
      issues: [],
      summary: {
        totalIssues: 0,
        highSeverityCount: 0,
        mediumSeverityCount: 0,
        lowSeverityCount: 0,
        fallbackUsed: true,
        error: error.message
      },
      metadata: {
        fallbackReason: this.getFallbackReason(error),
        timestamp: new Date().toISOString(),
        context: {
          repository: context.repository,
          branch: context.targetBranch,
          commit: context.commitSha
        }
      }
    };

    // Add a generic issue if it's a parsing error
    if (error.name === 'ParseError' || error.message.includes('parse')) {
      fallback.issues.push({
        severity: 'MEDIUM',
        category: 'Standards',
        description: 'AI response parsing failed. Manual review recommended.',
        file: 'unknown',
        recommendation: 'Review the code changes manually to ensure quality standards are met.'
      });
      fallback.summary.totalIssues = 1;
      fallback.summary.mediumSeverityCount = 1;
    }

    return fallback;
  }

  /**
   * Determine fallback reason from error
   * @param {Error} error - The error
   * @returns {string} Fallback reason
   */
  getFallbackReason(error) {
    if (error.name === 'TimeoutError') {
      return 'ai_timeout';
    } else if (error.name === 'ParseError') {
      return 'malformed_response';
    } else if (error.message.includes('rate limit')) {
      return 'rate_limit_exceeded';
    } else if (error.message.includes('authentication')) {
      return 'authentication_failed';
    } else if (error.message.includes('network')) {
      return 'network_error';
    } else {
      return 'unknown_error';
    }
  }

  /**
   * Determine if error is retryable
   * @param {Error} error - The error
   * @returns {boolean} Whether the error is retryable
   */
  isRetryableError(error) {
    const retryableErrors = [
      'TimeoutError',
      'NetworkError',
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND'
    ];

    const retryableMessages = [
      'rate limit',
      'timeout',
      'network',
      'connection',
      'temporary',
      'service unavailable'
    ];

    // Check error name
    if (retryableErrors.includes(error.name)) {
      return true;
    }

    // Check error message
    const message = error.message.toLowerCase();
    return retryableMessages.some(keyword => message.includes(keyword));
  }

  /**
   * Calculate retry delay with exponential backoff
   * @param {number} attempt - Current attempt number (1-based)
   * @returns {number} Delay in milliseconds
   */
  calculateRetryDelay(attempt) {
    const baseDelay = this.retryDelayMs;
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
    const delay = exponentialDelay + jitter;
    
    return Math.min(delay, this.maxRetryDelayMs);
  }

  /**
   * Process AI response with validation and fallback
   * @param {Object} response - AI response
   * @param {Error} error - Error if response failed
   * @param {Object} context - Review context
   * @param {Object} options - Processing options
   * @returns {Object} Processed response
   */
  processResponse(response, error = null, context = {}, options = {}) {
    const result = {
      success: false,
      response: null,
      validation: null,
      fallbackUsed: false,
      retryable: false,
      error: null
    };

    // If there's an error, check if it's retryable
    if (error) {
      result.error = error;
      result.retryable = this.isRetryableError(error);
      
      if (!result.retryable) {
        // Create fallback response for non-retryable errors
        result.response = this.createFallbackResponse(error, context);
        result.fallbackUsed = true;
        result.success = true;
        return result;
      }
      
      return result;
    }

    // Validate the response
    const validation = this.validateResponse(response, options);
    result.validation = validation;

    if (validation.isValid) {
      result.response = response;
      result.success = true;
      
      if (validation.fallbackNeeded) {
        // Try to fix the response
        const fixed = this.fixResponse(response, validation);
        if (fixed) {
          result.response = fixed;
          result.fallbackUsed = true;
        }
      }
    } else if (validation.retryable) {
      result.retryable = true;
      result.error = new Error(`Validation failed: ${validation.errors.join(', ')}`);
    } else {
      // Non-retryable validation error, create fallback
      const fallbackError = new Error(`Response validation failed: ${validation.errors.join(', ')}`);
      result.response = this.createFallbackResponse(fallbackError, context);
      result.fallbackUsed = true;
      result.success = true;
    }

    return result;
  }

  /**
   * Get processing statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    return {
      maxRetries: this.maxRetries,
      retryDelayMs: this.retryDelayMs,
      maxRetryDelayMs: this.maxRetryDelayMs,
      timeoutMs: this.timeoutMs
    };
  }
}

module.exports = ResponseHandler;



