const FallbackHandler = require('./fallback-handler');

describe('FallbackHandler', () => {
  let handler;
  let config;

  beforeEach(() => {
    config = {
      fallbacks: {
        enabled: true,
        max_attempts: 3,
        strategies: ['retry', 'simplified', 'manual']
      }
    };
    handler = new FallbackHandler(config);
  });

  describe('constructor', () => {
    test('should initialize with provided config', () => {
      expect(handler.enableFallbacks).toBe(true);
      expect(handler.maxFallbackAttempts).toBe(3);
      expect(handler.fallbackStrategies).toEqual(['retry', 'simplified', 'manual']);
    });

    test('should use default values when config is not provided', () => {
      const defaultHandler = new FallbackHandler();
      
      expect(defaultHandler.enableFallbacks).toBe(true);
      expect(defaultHandler.maxFallbackAttempts).toBe(3);
      expect(defaultHandler.fallbackStrategies).toEqual(['retry', 'simplified', 'manual']);
    });

    test('should disable fallbacks when explicitly set to false', () => {
      const disabledConfig = { fallbacks: { enabled: false } };
      const disabledHandler = new FallbackHandler(disabledConfig);
      
      expect(disabledHandler.enableFallbacks).toBe(false);
    });
  });

  describe('classifyError', () => {
    test('should classify timeout errors', () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      
      expect(handler.classifyError(timeoutError)).toBe('timeout');
      
      const timeoutMessageError = new Error('Operation timeout');
      expect(handler.classifyError(timeoutMessageError)).toBe('timeout');
    });

    test('should classify rate limit errors', () => {
      const rateLimitError = new Error('rate limit exceeded');
      expect(handler.classifyError(rateLimitError)).toBe('rate_limit');
    });

    test('should classify authentication errors', () => {
      const authError = new Error('authentication failed');
      expect(handler.classifyError(authError)).toBe('authentication');
      
      const unauthorizedError = new Error('unauthorized access');
      expect(handler.classifyError(unauthorizedError)).toBe('authentication');
    });

    test('should classify malformed response errors', () => {
      const parseError = new Error('Parse failed');
      parseError.name = 'ParseError';
      expect(handler.classifyError(parseError)).toBe('malformed_response');
      
      const malformedError = new Error('malformed response');
      expect(handler.classifyError(malformedError)).toBe('malformed_response');
    });

    test('should classify network errors', () => {
      const networkError = new Error('network connection failed');
      expect(handler.classifyError(networkError)).toBe('network');
      
      const connectionError = new Error('connection lost');
      expect(handler.classifyError(connectionError)).toBe('network');
    });

    test('should classify token limit errors', () => {
      const tokenError = new Error('token limit exceeded');
      expect(handler.classifyError(tokenError)).toBe('token_limit');
      
      const contextError = new Error('context length exceeded');
      expect(handler.classifyError(contextError)).toBe('token_limit');
    });

    test('should classify unknown errors', () => {
      const unknownError = new Error('unknown error');
      expect(handler.classifyError(unknownError)).toBe('unknown');
    });
  });

  describe('determineFallbackStrategy', () => {
    test('should return none when fallbacks are disabled', () => {
      const disabledHandler = new FallbackHandler({ fallbacks: { enabled: false } });
      const error = new Error('test error');
      
      const strategy = disabledHandler.determineFallbackStrategy(error, {}, 1);
      expect(strategy).toBe('none');
    });

    test('should return manual when max attempts exceeded', () => {
      const error = new Error('test error');
      
      const strategy = handler.determineFallbackStrategy(error, {}, 3);
      expect(strategy).toBe('manual');
    });

    test('should return retry for timeout on first attempt', () => {
      const error = new Error('timeout');
      error.name = 'TimeoutError';
      
      const strategy = handler.determineFallbackStrategy(error, {}, 1);
      expect(strategy).toBe('retry');
    });

    test('should return simplified for timeout on second attempt', () => {
      const error = new Error('timeout');
      error.name = 'TimeoutError';
      
      const strategy = handler.determineFallbackStrategy(error, {}, 2);
      expect(strategy).toBe('simplified');
    });

    test('should return retry for rate limit errors', () => {
      const error = new Error('rate limit exceeded');
      
      const strategy = handler.determineFallbackStrategy(error, {}, 1);
      expect(strategy).toBe('retry');
    });

    test('should return manual for authentication errors', () => {
      const error = new Error('authentication failed');
      
      const strategy = handler.determineFallbackStrategy(error, {}, 1);
      expect(strategy).toBe('manual');
    });

    test('should return simplified for malformed response errors', () => {
      const error = new Error('malformed response');
      
      const strategy = handler.determineFallbackStrategy(error, {}, 1);
      expect(strategy).toBe('simplified');
    });

    test('should return retry for network errors on first attempt', () => {
      const error = new Error('network error');
      
      const strategy = handler.determineFallbackStrategy(error, {}, 1);
      expect(strategy).toBe('retry');
    });

    test('should return manual for network errors on second attempt', () => {
      const error = new Error('network error');
      
      const strategy = handler.determineFallbackStrategy(error, {}, 2);
      expect(strategy).toBe('manual');
    });

    test('should return simplified for token limit errors', () => {
      const error = new Error('token limit exceeded');
      
      const strategy = handler.determineFallbackStrategy(error, {}, 1);
      expect(strategy).toBe('simplified');
    });
  });

  describe('createSimplifiedPrompt', () => {
    test('should create simplified prompt', () => {
      const originalPrompt = {
        system: 'Complex system prompt',
        user: 'Review this complex code'
      };
      const context = { repository: 'test-repo' };
      
      const simplified = handler.createSimplifiedPrompt(originalPrompt, context);
      
      expect(simplified.system).toContain('simple JSON format');
      expect(simplified.user).toContain('critical issues only');
      expect(simplified.user).toContain('Review this complex code');
    });

    test('should handle missing original prompt', () => {
      const simplified = handler.createSimplifiedPrompt({}, {});
      
      expect(simplified.system).toContain('simple JSON format');
      expect(simplified.user).toContain('Code to review:');
    });
  });

  describe('createManualReviewFallback', () => {
    test('should create manual review fallback', () => {
      const error = new Error('AI service unavailable');
      const context = {
        repository: 'test-repo',
        targetBranch: 'main',
        commitSha: 'abc123',
        author: 'test@example.com'
      };
      
      const fallback = handler.createManualReviewFallback(error, context);
      
      expect(fallback.issues).toHaveLength(1);
      expect(fallback.issues[0].severity).toBe('MEDIUM');
      expect(fallback.issues[0].category).toBe('Standards');
      expect(fallback.issues[0].description).toContain('Manual review required');
      expect(fallback.summary.fallbackUsed).toBe(true);
      expect(fallback.summary.fallbackType).toBe('manual_review');
      expect(fallback.metadata.context.repository).toBe('test-repo');
      expect(fallback.metadata.instructions).toBeDefined();
    });
  });

  describe('getManualReviewInstructions', () => {
    test('should return basic instructions', () => {
      const instructions = handler.getManualReviewInstructions({});
      
      expect(instructions).toContain('Review code for security vulnerabilities');
      expect(instructions).toContain('Check for performance issues');
      expect(instructions).toContain('Verify coding standards compliance');
    });

    test('should add production-specific instructions for main branch', () => {
      const instructions = handler.getManualReviewInstructions({ targetBranch: 'main' });
      
      expect(instructions).toContain('Pay special attention to production readiness');
      expect(instructions).toContain('Verify all security measures are in place');
    });

    test('should add development-specific instructions for dev branch', () => {
      const instructions = handler.getManualReviewInstructions({ targetBranch: 'develop' });
      
      expect(instructions).toContain('Focus on code quality and maintainability');
    });
  });

  describe('createDegradedReviewFallback', () => {
    test('should create degraded review fallback', () => {
      const context = {
        repository: 'test-repo',
        targetBranch: 'main',
        commitSha: 'abc123'
      };
      const files = [
        {
          path: 'src/test.js',
          content: 'console.log("test"); eval("dangerous");'
        }
      ];
      
      const fallback = handler.createDegradedReviewFallback(context, files);
      
      expect(fallback.issues.length).toBeGreaterThan(0);
      expect(fallback.summary.fallbackUsed).toBe(true);
      expect(fallback.summary.fallbackType).toBe('degraded_review');
      expect(fallback.metadata.fallbackReason).toBe('ai_service_unavailable');
      expect(fallback.metadata.note).toContain('basic static analysis');
    });

    test('should handle empty files array', () => {
      const fallback = handler.createDegradedReviewFallback({}, []);
      
      expect(fallback.issues).toHaveLength(0);
      expect(fallback.summary.totalIssues).toBe(0);
    });
  });

  describe('performBasicAnalysis', () => {
    test('should detect security vulnerabilities', () => {
      const file = {
        path: 'src/dangerous.js',
        content: 'eval("user input"); document.body.innerHTML = userData;'
      };
      
      const issues = handler.performBasicAnalysis(file);
      
      expect(issues.length).toBeGreaterThan(0);
      expect(issues.some(i => i.severity === 'HIGH' && i.category === 'Security')).toBe(true);
    });

    test('should detect hardcoded credentials', () => {
      const file = {
        path: 'src/config.js',
        content: 'const password = "secret123";'
      };
      
      const issues = handler.performBasicAnalysis(file);
      
      expect(issues.some(i => i.description.includes('hardcoded credentials'))).toBe(true);
    });

    test('should detect console.log in production code', () => {
      const file = {
        path: 'src/app.js',
        content: 'console.log("debug info");'
      };
      
      const issues = handler.performBasicAnalysis(file);
      
      expect(issues.some(i => i.description.includes('Console.log statement'))).toBe(true);
    });

    test('should not flag console.log in test files', () => {
      const file = {
        path: 'src/app.test.js',
        content: 'console.log("test debug");'
      };
      
      const issues = handler.performBasicAnalysis(file);
      
      expect(issues.some(i => i.description.includes('Console.log statement'))).toBe(false);
    });

    test('should detect large files', () => {
      const largeContent = 'line\n'.repeat(60);
      const file = {
        path: 'src/large.js',
        content: largeContent
      };
      
      const issues = handler.performBasicAnalysis(file);
      
      expect(issues.some(i => i.description.includes('Large function or file'))).toBe(true);
    });

    test('should handle missing file properties', () => {
      const file = {};
      
      const issues = handler.performBasicAnalysis(file);
      
      expect(Array.isArray(issues)).toBe(true);
    });
  });

  describe('createEmergencyBypassFallback', () => {
    test('should create emergency bypass fallback', () => {
      const context = {
        repository: 'test-repo',
        targetBranch: 'main',
        commitSha: 'abc123',
        author: 'test@example.com'
      };
      const reason = 'critical_bug_fix';
      
      const fallback = handler.createEmergencyBypassFallback(context, reason);
      
      expect(fallback.issues).toHaveLength(0);
      expect(fallback.summary.fallbackUsed).toBe(true);
      expect(fallback.summary.fallbackType).toBe('emergency_bypass');
      expect(fallback.summary.bypassReason).toBe(reason);
      expect(fallback.metadata.warning).toContain('Manual review is strongly recommended');
    });

    test('should use default reason when not provided', () => {
      const fallback = handler.createEmergencyBypassFallback({});
      
      expect(fallback.summary.bypassReason).toBe('emergency');
    });
  });

  describe('executeFallbackStrategy', () => {
    test('should execute retry strategy', async () => {
      const result = await handler.executeFallbackStrategy('retry', { attempt: 1 });
      
      expect(result.type).toBe('retry');
      expect(result.shouldRetry).toBe(true);
      expect(result.delay).toBeDefined();
    });

    test('should execute simplified strategy', async () => {
      const originalPrompt = { user: 'test' };
      const result = await handler.executeFallbackStrategy('simplified', { 
        originalPrompt, 
        context: {} 
      });
      
      expect(result.type).toBe('simplified');
      expect(result.shouldRetry).toBe(true);
      expect(result.prompt).toBeDefined();
    });

    test('should execute degraded strategy', async () => {
      const files = [{ path: 'test.js', content: 'test' }];
      const result = await handler.executeFallbackStrategy('degraded', { 
        context: {}, 
        files 
      });
      
      expect(result.type).toBe('degraded');
      expect(result.shouldRetry).toBe(false);
      expect(result.response).toBeDefined();
    });

    test('should execute manual strategy', async () => {
      const error = new Error('test error');
      const result = await handler.executeFallbackStrategy('manual', { 
        error, 
        context: {} 
      });
      
      expect(result.type).toBe('manual');
      expect(result.shouldRetry).toBe(false);
      expect(result.response).toBeDefined();
    });

    test('should execute emergency strategy', async () => {
      const result = await handler.executeFallbackStrategy('emergency', { 
        context: {}, 
        reason: 'test' 
      });
      
      expect(result.type).toBe('emergency');
      expect(result.shouldRetry).toBe(false);
      expect(result.response).toBeDefined();
    });

    test('should handle unknown strategy', async () => {
      const result = await handler.executeFallbackStrategy('unknown', {});
      
      expect(result.type).toBe('none');
      expect(result.shouldRetry).toBe(false);
    });
  });

  describe('calculateRetryDelay', () => {
    test('should calculate exponential backoff', () => {
      const delay1 = handler.calculateRetryDelay(1);
      const delay2 = handler.calculateRetryDelay(2);
      const delay3 = handler.calculateRetryDelay(3);
      
      expect(delay1).toBeGreaterThanOrEqual(1000);
      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
    });

    test('should respect maximum delay', () => {
      const delay = handler.calculateRetryDelay(10);
      expect(delay).toBeLessThanOrEqual(10000);
    });
  });

  describe('getConfiguration', () => {
    test('should return configuration', () => {
      const config = handler.getConfiguration();
      
      expect(config.enabled).toBe(true);
      expect(config.maxAttempts).toBe(3);
      expect(config.strategies).toEqual(['retry', 'simplified', 'manual']);
    });
  });

  describe('isEnabled', () => {
    test('should return true when fallbacks are enabled', () => {
      expect(handler.isEnabled()).toBe(true);
    });

    test('should return false when fallbacks are disabled', () => {
      const disabledHandler = new FallbackHandler({ fallbacks: { enabled: false } });
      expect(disabledHandler.isEnabled()).toBe(false);
    });
  });
});
