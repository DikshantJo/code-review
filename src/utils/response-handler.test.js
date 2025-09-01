const ResponseHandler = require('./response-handler');

describe('ResponseHandler', () => {
  let handler;
  let config;

  beforeEach(() => {
    config = {
      ai: {
        max_retries: 3,
        retry_delay_ms: 1000,
        max_retry_delay_ms: 10000,
        timeout_seconds: 30
      }
    };
    handler = new ResponseHandler(config);
  });

  describe('constructor', () => {
    test('should initialize with provided config', () => {
      expect(handler.maxRetries).toBe(3);
      expect(handler.retryDelayMs).toBe(1000);
      expect(handler.maxRetryDelayMs).toBe(10000);
      expect(handler.timeoutMs).toBe(30000);
    });

    test('should use default values when config is not provided', () => {
      const defaultHandler = new ResponseHandler();
      
      expect(defaultHandler.maxRetries).toBe(3);
      expect(defaultHandler.retryDelayMs).toBe(1000);
      expect(defaultHandler.maxRetryDelayMs).toBe(10000);
      expect(defaultHandler.timeoutMs).toBe(30000);
    });
  });

  describe('validateResponse', () => {
    test('should validate correct response', () => {
      const response = {
        issues: [
          {
            severity: 'HIGH',
            category: 'Security',
            description: 'Potential SQL injection',
            file: 'src/auth.js',
            line: 15,
            recommendation: 'Use parameterized queries'
          }
        ],
        summary: {
          totalIssues: 1,
          highSeverityCount: 1
        }
      };

      const validation = handler.validateResponse(response);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.warnings).toHaveLength(0);
      expect(validation.retryable).toBe(false);
      expect(validation.fallbackNeeded).toBe(false);
    });

    test('should detect null response', () => {
      const validation = handler.validateResponse(null);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Response is null or undefined');
      expect(validation.retryable).toBe(true);
    });

    test('should detect non-object response', () => {
      const validation = handler.validateResponse('string response');

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Response must be an object');
      expect(validation.retryable).toBe(true);
    });

    test('should detect missing required fields', () => {
      const response = {
        issues: []
      };

      const validation = handler.validateResponse(response);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Missing required field: summary');
      expect(validation.retryable).toBe(true);
    });

    test('should detect invalid issues field', () => {
      const response = {
        issues: 'not an array',
        summary: {}
      };

      const validation = handler.validateResponse(response);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Issues field must be an array');
      expect(validation.retryable).toBe(true);
    });

    test('should detect invalid summary field', () => {
      const response = {
        issues: [],
        summary: 'not an object'
      };

      const validation = handler.validateResponse(response);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Summary field must be an object');
      expect(validation.retryable).toBe(true);
    });

    test('should validate with custom required fields', () => {
      const response = {
        issues: [],
        summary: {},
        customField: 'value'
      };

      const validation = handler.validateResponse(response, {
        requiredFields: ['issues', 'summary', 'customField']
      });

      expect(validation.isValid).toBe(true);
    });
  });

  describe('validateIssue', () => {
    test('should validate correct issue', () => {
      const issue = {
        severity: 'HIGH',
        category: 'Security',
        description: 'Potential SQL injection',
        file: 'src/auth.js',
        line: 15,
        recommendation: 'Use parameterized queries'
      };

      const validation = handler.validateIssue(issue, 0);

      expect(validation.errors).toHaveLength(0);
      expect(validation.warnings).toHaveLength(0);
    });

    test('should detect non-object issue', () => {
      const validation = handler.validateIssue('not an object', 0);

      expect(validation.errors).toContain('Issue 0: Must be an object');
    });

    test('should detect missing required fields', () => {
      const issue = {
        severity: 'HIGH'
      };

      const validation = handler.validateIssue(issue, 0);

      expect(validation.errors).toContain('Issue 0: Missing required field: category');
      expect(validation.errors).toContain('Issue 0: Missing required field: description');
    });

    test('should detect invalid severity', () => {
      const issue = {
        severity: 'INVALID',
        category: 'Security',
        description: 'Test'
      };

      const validation = handler.validateIssue(issue, 0);

      expect(validation.errors).toContain('Issue 0: Invalid severity: INVALID');
    });

    test('should warn about unknown category', () => {
      const issue = {
        severity: 'HIGH',
        category: 'UnknownCategory',
        description: 'Test'
      };

      const validation = handler.validateIssue(issue, 0);

      expect(validation.warnings).toContain('Issue 0: Unknown category: UnknownCategory');
    });

    test('should detect invalid description type', () => {
      const issue = {
        severity: 'HIGH',
        category: 'Security',
        description: 123
      };

      const validation = handler.validateIssue(issue, 0);

      expect(validation.errors).toContain('Issue 0: Description must be a string');
    });

    test('should warn about invalid file path', () => {
      const issue = {
        severity: 'HIGH',
        category: 'Security',
        description: 'Test',
        file: 123
      };

      const validation = handler.validateIssue(issue, 0);

      expect(validation.warnings).toContain('Issue 0: File path should be a string');
    });

    test('should warn about invalid line number', () => {
      const issue = {
        severity: 'HIGH',
        category: 'Security',
        description: 'Test',
        line: -1
      };

      const validation = handler.validateIssue(issue, 0);

      expect(validation.warnings).toContain('Issue 0: Line number should be a positive integer');
    });
  });

  describe('fixResponse', () => {
    test('should fix missing required fields', () => {
      const response = {
        issues: []
      };

      const validation = handler.validateResponse(response);
      const fixed = handler.fixResponse(response, validation);

      expect(fixed.issues).toBeDefined();
      expect(fixed.summary).toBeDefined();
      expect(fixed.summary.totalIssues).toBe(0);
    });

    test('should fix invalid issues array', () => {
      const response = {
        issues: 'not an array',
        summary: {}
      };

      const validation = handler.validateResponse(response);
      const fixed = handler.fixResponse(response, validation);

      expect(Array.isArray(fixed.issues)).toBe(true);
    });

    test('should fix individual issues', () => {
      const response = {
        issues: [
          {
            severity: 'INVALID',
            category: 'UnknownCategory',
            description: 123,
            file: 456,
            line: -1
          }
        ],
        summary: {}
      };

      const validation = handler.validateResponse(response);
      const fixed = handler.fixResponse(response, validation);

      expect(fixed.issues[0].severity).toBe('MEDIUM');
      expect(fixed.issues[0].category).toBe('Standards');
      expect(fixed.issues[0].description).toBe('Issue detected but description unavailable');
      expect(fixed.issues[0].file).toBe('unknown');
      expect(fixed.issues[0].line).toBeUndefined();
    });

    test('should remove null issues', () => {
      const response = {
        issues: [
          null,
          { severity: 'HIGH', category: 'Security', description: 'Valid issue' },
          'not an object'
        ],
        summary: {}
      };

      const validation = handler.validateResponse(response);
      const fixed = handler.fixResponse(response, validation);

      expect(fixed.issues).toHaveLength(1);
      expect(fixed.issues[0].description).toBe('Valid issue');
    });

    test('should update summary counts', () => {
      const response = {
        issues: [
          { severity: 'HIGH', category: 'Security', description: 'High issue' },
          { severity: 'MEDIUM', category: 'Standards', description: 'Medium issue' },
          { severity: 'LOW', category: 'Formatting', description: 'Low issue' }
        ],
        summary: {}
      };

      const validation = handler.validateResponse(response);
      const fixed = handler.fixResponse(response, validation);

      expect(fixed.summary.totalIssues).toBe(3);
      expect(fixed.summary.highSeverityCount).toBe(1);
      expect(fixed.summary.mediumSeverityCount).toBe(1);
      expect(fixed.summary.lowSeverityCount).toBe(1);
    });

    test('should return null for unfixable response', () => {
      const fixed = handler.fixResponse(null, { errors: [] });
      expect(fixed).toBeNull();
    });
  });

  describe('createFallbackResponse', () => {
    test('should create fallback response for general error', () => {
      const error = new Error('General error');
      const context = {
        repository: 'test-repo',
        targetBranch: 'main',
        commitSha: 'abc123'
      };

      const fallback = handler.createFallbackResponse(error, context);

      expect(fallback.issues).toHaveLength(0);
      expect(fallback.summary.fallbackUsed).toBe(true);
      expect(fallback.summary.error).toBe('General error');
      expect(fallback.metadata.fallbackReason).toBe('unknown_error');
      expect(fallback.metadata.context.repository).toBe('test-repo');
    });

    test('should create fallback response for parse error', () => {
      const error = new Error('Parse error');
      error.name = 'ParseError';
      const context = { repository: 'test-repo' };

      const fallback = handler.createFallbackResponse(error, context);

      expect(fallback.issues).toHaveLength(1);
      expect(fallback.issues[0].severity).toBe('MEDIUM');
      expect(fallback.issues[0].category).toBe('Standards');
      expect(fallback.summary.totalIssues).toBe(1);
      expect(fallback.metadata.fallbackReason).toBe('malformed_response');
    });

    test('should create fallback response for timeout error', () => {
      const error = new Error('Request timeout');
      error.name = 'TimeoutError';
      const context = { repository: 'test-repo' };

      const fallback = handler.createFallbackResponse(error, context);

      expect(fallback.metadata.fallbackReason).toBe('ai_timeout');
    });
  });

  describe('getFallbackReason', () => {
    test('should identify timeout errors', () => {
      const error = new Error('Timeout');
      error.name = 'TimeoutError';

      const reason = handler.getFallbackReason(error);
      expect(reason).toBe('ai_timeout');
    });

    test('should identify parse errors', () => {
      const error = new Error('Parse failed');
      error.name = 'ParseError';

      const reason = handler.getFallbackReason(error);
      expect(reason).toBe('malformed_response');
    });

    test('should identify rate limit errors', () => {
      const error = new Error('rate limit exceeded');

      const reason = handler.getFallbackReason(error);
      expect(reason).toBe('rate_limit_exceeded');
    });

    test('should identify authentication errors', () => {
      const error = new Error('authentication failed');

      const reason = handler.getFallbackReason(error);
      expect(reason).toBe('authentication_failed');
    });

    test('should identify network errors', () => {
      const error = new Error('network error');

      const reason = handler.getFallbackReason(error);
      expect(reason).toBe('network_error');
    });

    test('should return unknown for unrecognized errors', () => {
      const error = new Error('Unknown error');

      const reason = handler.getFallbackReason(error);
      expect(reason).toBe('unknown_error');
    });
  });

  describe('isRetryableError', () => {
    test('should identify retryable error names', () => {
      const retryableErrors = [
        { name: 'TimeoutError', message: 'Timeout' },
        { name: 'NetworkError', message: 'Network error' },
        { name: 'ECONNRESET', message: 'Connection reset' },
        { name: 'ECONNREFUSED', message: 'Connection refused' },
        { name: 'ETIMEDOUT', message: 'Connection timeout' },
        { name: 'ENOTFOUND', message: 'Not found' }
      ];

      retryableErrors.forEach(error => {
        expect(handler.isRetryableError(error)).toBe(true);
      });
    });

    test('should identify retryable error messages', () => {
      const retryableMessages = [
        'rate limit exceeded',
        'request timeout',
        'network connection failed',
        'connection lost',
        'temporary service unavailable',
        'service unavailable'
      ];

      retryableMessages.forEach(message => {
        const error = new Error(message);
        expect(handler.isRetryableError(error)).toBe(true);
      });
    });

    test('should identify non-retryable errors', () => {
      const nonRetryableErrors = [
        { name: 'ValidationError', message: 'Invalid input' },
        { name: 'AuthenticationError', message: 'Invalid credentials' },
        { name: 'AuthorizationError', message: 'Access denied' }
      ];

      nonRetryableErrors.forEach(error => {
        expect(handler.isRetryableError(error)).toBe(false);
      });
    });
  });

  describe('calculateRetryDelay', () => {
    test('should calculate exponential backoff', () => {
      const delay1 = handler.calculateRetryDelay(1);
      const delay2 = handler.calculateRetryDelay(2);
      const delay3 = handler.calculateRetryDelay(3);

      expect(delay1).toBeGreaterThanOrEqual(1000);
      expect(delay1).toBeLessThanOrEqual(1100); // Base + 10% jitter
      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
    });

    test('should respect maximum delay', () => {
      const delay = handler.calculateRetryDelay(10); // Should exceed max
      expect(delay).toBeLessThanOrEqual(10000);
    });
  });

  describe('processResponse', () => {
    test('should process valid response successfully', () => {
      const response = {
        issues: [
          { severity: 'HIGH', category: 'Security', description: 'Test issue' }
        ],
        summary: { totalIssues: 1 }
      };

      const result = handler.processResponse(response, null, {});

      expect(result.success).toBe(true);
      expect(result.response).toBe(response);
      expect(result.fallbackUsed).toBe(false);
      expect(result.retryable).toBe(false);
    });

    test('should handle retryable errors', () => {
      const error = new Error('Network timeout');
      error.name = 'TimeoutError';

      const result = handler.processResponse(null, error, {});

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
      expect(result.error).toBe(error);
    });

    test('should create fallback for non-retryable errors', () => {
      const error = new Error('Authentication failed');

      const result = handler.processResponse(null, error, {});

      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(result.response.summary.fallbackUsed).toBe(true);
    });

    test('should fix malformed but usable response', () => {
      const response = {
        issues: [
          { severity: 'HIGH', category: 'UnknownCategory', description: 'Test' }
        ],
        summary: {}
      };

      const result = handler.processResponse(response, null, {});

      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(result.response.issues[0].severity).toBe('HIGH');
      expect(result.response.issues[0].category).toBe('Standards');
    });

    test('should handle validation errors', () => {
      const response = {
        issues: 'not an array',
        summary: {}
      };

      const result = handler.processResponse(response, null, {});

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
      expect(result.error.message).toContain('Issues field must be an array');
    });
  });

  describe('getStatistics', () => {
    test('should return configuration statistics', () => {
      const stats = handler.getStatistics();

      expect(stats.maxRetries).toBe(3);
      expect(stats.retryDelayMs).toBe(1000);
      expect(stats.maxRetryDelayMs).toBe(10000);
      expect(stats.timeoutMs).toBe(30000);
    });
  });
});
