/**
 * OpenAI Client Utility
 * Handles GPT-4 API integration for AI code review
 */

const core = require('@actions/core');
const https = require('https');
const { URL } = require('url');

class OpenAIClient {
  constructor(config = {}) {
    this.config = {
      // API Configuration
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      model: config.model || 'gpt-4',
      baseURL: config.baseURL || 'https://api.openai.com',
      timeout: config.timeout || 300000, // 5 minutes default
      
      // Request Configuration
      maxTokens: config.maxTokens || 8000,
      temperature: config.temperature || 0.1, // Low temperature for consistent results
      topP: config.topP || 1.0,
      frequencyPenalty: config.frequencyPenalty || 0.0,
      presencePenalty: config.presencePenalty || 0.0,
      
      // Retry Configuration
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000, // 1 second
      retryBackoffMultiplier: config.retryBackoffMultiplier || 2,
      
      // Rate Limiting
      requestsPerMinute: config.requestsPerMinute || 60,
      tokensPerMinute: config.tokensPerMinute || 150000,
      
      // Logging
      enableLogging: config.enableLogging !== false,
      logLevel: config.logLevel || 'INFO'
    };

    // Rate limiting state
    this.requestCount = 0;
    this.tokenCount = 0;
    this.lastResetTime = Date.now();

    // Validate configuration
    this.validateConfig();
  }

  /**
   * Validate client configuration
   * @throws {Error} If configuration is invalid
   */
  validateConfig() {
    if (!this.config.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    if (!this.config.apiKey.startsWith('sk-')) {
      throw new Error('Invalid OpenAI API key format');
    }

    if (this.config.timeout < 1000) {
      throw new Error('Timeout must be at least 1000ms');
    }

    if (this.config.maxRetries < 0) {
      throw new Error('Max retries must be non-negative');
    }

    if (this.config.temperature < 0 || this.config.temperature > 2) {
      throw new Error('Temperature must be between 0 and 2');
    }
  }

  /**
   * Make a request to OpenAI API
   * @param {Object} options - Request options
   * @returns {Promise<Object>} API response
   */
  async makeRequest(options) {
    const startTime = Date.now();
    
    try {
      // Check rate limits
      this.checkRateLimits();

      // Prepare request
      const requestOptions = this.prepareRequest(options);
      
      // Make request with retry logic
      const response = await this.makeRequestWithRetry(requestOptions);
      
      // Update rate limiting state
      this.updateRateLimits(response);
      
      // Log request
      this.logRequest(options, response, Date.now() - startTime);
      
      return response;
    } catch (error) {
      this.logError('OpenAI API request failed', error);
      throw error;
    }
  }

  /**
   * Prepare request options for OpenAI API
   * @param {Object} options - Request options
   * @returns {Object} Prepared request options
   */
  prepareRequest(options) {
    const url = new URL('/v1/chat/completions', this.config.baseURL);
    
    const requestBody = {
      model: this.config.model,
      messages: options.messages || [],
      max_tokens: options.maxTokens || this.config.maxTokens,
      temperature: options.temperature || this.config.temperature,
      top_p: options.topP || this.config.topP,
      frequency_penalty: options.frequencyPenalty || this.config.frequencyPenalty,
      presence_penalty: options.presencePenalty || this.config.presencePenalty,
      stream: false
    };

    // Add optional parameters if provided
    if (options.systemPrompt) {
      requestBody.messages.unshift({
        role: 'system',
        content: options.systemPrompt
      });
    }

    const requestOptions = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        'User-Agent': 'AI-Code-Review-GitHub-Action/1.0.0'
      },
      timeout: this.config.timeout
    };

    return {
      requestOptions,
      requestBody
    };
  }

  /**
   * Make request with retry logic
   * @param {Object} preparedRequest - Prepared request options
   * @returns {Promise<Object>} API response
   */
  async makeRequestWithRetry(preparedRequest) {
    let lastError;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = this.config.retryDelay * Math.pow(this.config.retryBackoffMultiplier, attempt - 1);
          await this.sleep(delay);
          this.logInfo(`Retry attempt ${attempt}/${this.config.maxRetries}`);
        }

        return await this.makeSingleRequest(preparedRequest);
      } catch (error) {
        lastError = error;
        
        // Don't retry on certain errors
        if (this.shouldNotRetry(error)) {
          throw error;
        }
        
        this.logWarning(`Request failed (attempt ${attempt + 1}): ${error.message}`);
      }
    }
    
    throw new Error(`Request failed after ${this.config.maxRetries + 1} attempts: ${lastError.message}`);
  }

  /**
   * Make a single request to OpenAI API
   * @param {Object} preparedRequest - Prepared request options
   * @returns {Promise<Object>} API response
   */
  makeSingleRequest(preparedRequest) {
    return new Promise((resolve, reject) => {
      const { requestOptions, requestBody } = preparedRequest;
      
      const req = https.request(requestOptions, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(response);
            } else {
              const error = new Error(`OpenAI API error: ${response.error?.message || 'Unknown error'}`);
              error.statusCode = res.statusCode;
              error.response = response;
              reject(error);
            }
          } catch (parseError) {
            reject(new Error(`Failed to parse response: ${parseError.message}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      req.write(JSON.stringify(requestBody));
      req.end();
    });
  }

  /**
   * Check if request should not be retried
   * @param {Error} error - Error object
   * @returns {boolean} Whether to skip retry
   */
  shouldNotRetry(error) {
    // Don't retry on authentication errors
    if (error.statusCode === 401) {
      return true;
    }
    
    // Don't retry on permission errors
    if (error.statusCode === 403) {
      return true;
    }
    
    // Don't retry on invalid request errors
    if (error.statusCode === 400) {
      return true;
    }
    
    // Don't retry on rate limit errors (will be handled by rate limiting)
    if (error.statusCode === 429) {
      return true;
    }
    
    return false;
  }

  /**
   * Check rate limits before making request
   * @throws {Error} If rate limit exceeded
   */
  checkRateLimits() {
    const now = Date.now();
    const timeWindow = 60000; // 1 minute
    
    // Reset counters if time window has passed
    if (now - this.lastResetTime > timeWindow) {
      this.requestCount = 0;
      this.tokenCount = 0;
      this.lastResetTime = now;
    }
    
    // Check request rate limit
    if (this.requestCount >= this.config.requestsPerMinute) {
      const waitTime = timeWindow - (now - this.lastResetTime);
      throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
    }
    
    // Check token rate limit (approximate)
    if (this.tokenCount >= this.config.tokensPerMinute) {
      const waitTime = timeWindow - (now - this.lastResetTime);
      throw new Error(`Token rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
    }
  }

  /**
   * Update rate limiting state after successful request
   * @param {Object} response - API response
   */
  updateRateLimits(response) {
    this.requestCount++;
    
    // Update token count based on response
    if (response.usage) {
      this.tokenCount += response.usage.total_tokens || 0;
    }
  }

  /**
   * Perform code review using GPT-4
   * @param {Object} reviewData - Code review data
   * @returns {Promise<Object>} Review results
   */
  async performCodeReview(reviewData) {
    const {
      files,
      targetBranch,
      severityThreshold,
      reviewCriteria,
      context
    } = reviewData;

    try {
      // Prepare messages for the AI
      const messages = this.prepareReviewMessages(reviewData);
      
      // Make API request
      const response = await this.makeRequest({
        messages,
        systemPrompt: this.generateSystemPrompt(reviewData),
        maxTokens: this.calculateMaxTokens(files),
        temperature: 0.1 // Very low temperature for consistent results
      });

      // Parse and validate response
      const reviewResults = this.parseReviewResponse(response, reviewData);
      
      return {
        success: true,
        results: reviewResults,
        usage: response.usage,
        model: response.model,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Prepare messages for code review
   * @param {Object} reviewData - Review data
   * @returns {Array} Messages array
   */
  prepareReviewMessages(reviewData) {
    const messages = [];
    
    // Add context information
    messages.push({
      role: 'user',
      content: `Please review the following code changes for branch: ${reviewData.targetBranch}\n\n` +
               `Severity Threshold: ${reviewData.severityThreshold}\n` +
               `Review Criteria: ${JSON.stringify(reviewData.reviewCriteria, null, 2)}\n\n` +
               `Files to review:\n${reviewData.files.map(f => `- ${f.path}`).join('\n')}`
    });

    // Add file contents
    for (const file of reviewData.files) {
      messages.push({
        role: 'user',
        content: `File: ${file.path}\n\n${file.content}`
      });
    }

    return messages;
  }

  /**
   * Generate system prompt for code review
   * @param {Object} reviewData - Review data
   * @returns {string} System prompt
   */
  generateSystemPrompt(reviewData) {
    return `You are an expert code reviewer performing automated code review for a GitHub repository.

REVIEW OBJECTIVES:
- Identify security vulnerabilities and potential exploits
- Detect logical flaws and edge cases
- Check for coding standards violations
- Assess performance implications
- Review maintainability and readability

SEVERITY LEVELS:
- HIGH: Critical security issues, major logic flaws, severe performance problems
- MEDIUM: Moderate security concerns, coding standards violations, performance optimizations
- LOW: Minor issues, style inconsistencies, documentation improvements

RESPONSE FORMAT:
You must respond with a valid JSON object in the following structure:
{
  "summary": {
    "overall_status": "PASS|FAIL|WARNING",
    "total_issues": number,
    "high_severity": number,
    "medium_severity": number,
    "low_severity": number
  },
  "issues": [
    {
      "file": "file_path",
      "line": number,
      "severity": "HIGH|MEDIUM|LOW",
      "category": "SECURITY|LOGIC|PERFORMANCE|STANDARDS|MAINTAINABILITY",
      "title": "Brief issue title",
      "description": "Detailed description of the issue",
      "recommendation": "Specific fix recommendation",
      "code_snippet": "Relevant code snippet (if applicable)"
    }
  ],
  "recommendations": {
    "immediate_actions": ["List of immediate actions to take"],
    "long_term_improvements": ["List of long-term improvements"]
  }
}

IMPORTANT:
- Only report issues that meet or exceed the severity threshold: ${reviewData.severityThreshold}
- Be specific and actionable in your recommendations
- Focus on real issues, not style preferences unless they affect maintainability
- Consider the target environment: ${reviewData.targetBranch}
- Provide clear, implementable solutions`;
  }

  /**
   * Calculate appropriate max tokens based on file content
   * @param {Array} files - Files to review
   * @returns {number} Max tokens
   */
  calculateMaxTokens(files) {
    const totalContentLength = files.reduce((sum, file) => sum + (file.content?.length || 0), 0);
    
    // Estimate tokens (roughly 4 characters per token)
    const estimatedInputTokens = Math.ceil(totalContentLength / 4);
    
    // Reserve tokens for response (aim for detailed analysis)
    const responseTokens = Math.max(2000, estimatedInputTokens * 0.5);
    
    // Ensure we don't exceed model limits
    return Math.min(responseTokens, this.config.maxTokens);
  }

  /**
   * Parse and validate review response
   * @param {Object} response - OpenAI API response
   * @param {Object} reviewData - Original review data
   * @returns {Object} Parsed review results
   */
  parseReviewResponse(response, reviewData) {
    try {
      const content = response.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content in response');
      }

      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsedResponse = JSON.parse(jsonMatch[0]);
      
      // Validate response structure
      this.validateReviewResponse(parsedResponse);
      
      return parsedResponse;
    } catch (error) {
      this.logError('Failed to parse review response', error);
      
      // Return fallback response
      return {
        summary: {
          overall_status: 'ERROR',
          total_issues: 0,
          high_severity: 0,
          medium_severity: 0,
          low_severity: 0
        },
        issues: [],
        recommendations: {
          immediate_actions: ['Review response parsing failed'],
          long_term_improvements: ['Check AI response format']
        },
        parse_error: error.message
      };
    }
  }

  /**
   * Validate review response structure
   * @param {Object} response - Parsed response
   * @throws {Error} If response is invalid
   */
  validateReviewResponse(response) {
    if (!response.summary || !response.issues || !response.recommendations) {
      throw new Error('Invalid response structure: missing required fields');
    }

    if (!['PASS', 'FAIL', 'WARNING', 'ERROR'].includes(response.summary.overall_status)) {
      throw new Error('Invalid overall_status in response');
    }

    if (!Array.isArray(response.issues)) {
      throw new Error('Issues must be an array');
    }

    // Validate each issue
    for (const issue of response.issues) {
      if (!issue.severity || !['HIGH', 'MEDIUM', 'LOW'].includes(issue.severity)) {
        throw new Error('Invalid severity in issue');
      }
      
      if (!issue.category || !['SECURITY', 'LOGIC', 'PERFORMANCE', 'STANDARDS', 'MAINTAINABILITY'].includes(issue.category)) {
        throw new Error('Invalid category in issue');
      }
    }
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} Promise that resolves after sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log information message
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   */
  logInfo(message, ...args) {
    if (this.config.enableLogging && this.config.logLevel === 'INFO') {
      core.info(`[OpenAI Client] ${message}`, ...args);
    }
  }

  /**
   * Log warning message
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   */
  logWarning(message, ...args) {
    if (this.config.enableLogging) {
      core.warning(`[OpenAI Client] ${message}`, ...args);
    }
  }

  /**
   * Log error message
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   */
  logError(message, ...args) {
    if (this.config.enableLogging) {
      core.error(`[OpenAI Client] ${message}`, ...args);
    }
  }

  /**
   * Log request details
   * @param {Object} options - Request options
   * @param {Object} response - API response
   * @param {number} duration - Request duration in ms
   */
  logRequest(options, response, duration) {
    if (this.config.enableLogging) {
      const usage = response.usage || {};
      this.logInfo(`Request completed in ${duration}ms - Tokens: ${usage.total_tokens || 'unknown'}`);
    }
  }

  /**
   * Get client configuration summary
   * @returns {Object} Configuration summary
   */
  getConfigSummary() {
    return {
      model: this.config.model,
      timeout: this.config.timeout,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
      maxRetries: this.config.maxRetries,
      requestsPerMinute: this.config.requestsPerMinute,
      tokensPerMinute: this.config.tokensPerMinute
    };
  }

  /**
   * Get current rate limiting state
   * @returns {Object} Rate limiting state
   */
  getRateLimitState() {
    return {
      requestCount: this.requestCount,
      tokenCount: this.tokenCount,
      lastResetTime: this.lastResetTime,
      requestsPerMinute: this.config.requestsPerMinute,
      tokensPerMinute: this.config.tokensPerMinute
    };
  }
}

module.exports = OpenAIClient;



