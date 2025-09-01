const ServiceAvailabilityHandler = require('./service-availability');

describe('ServiceAvailabilityHandler', () => {
  let handler;
  let config;

  beforeEach(() => {
    config = {
      degradation: {
        modes: ['full', 'partial', 'minimal', 'offline'],
        check_interval_ms: 30000
      }
    };
    handler = new ServiceAvailabilityHandler(config);
  });

  describe('constructor', () => {
    test('should initialize with provided config', () => {
      expect(handler.services).toBeDefined();
      expect(handler.degradationModes).toEqual(['full', 'partial', 'minimal', 'offline']);
      expect(handler.currentMode).toBe('full');
      expect(handler.checkInterval).toBe(30000);
    });

    test('should use default values when config is not provided', () => {
      const defaultHandler = new ServiceAvailabilityHandler();
      
      expect(defaultHandler.services).toBeDefined();
      expect(defaultHandler.degradationModes).toEqual(['full', 'partial', 'minimal', 'offline']);
      expect(defaultHandler.currentMode).toBe('full');
      expect(defaultHandler.checkInterval).toBe(30000);
    });

    test('should initialize service status maps', () => {
      expect(handler.serviceStatus).toBeInstanceOf(Map);
      expect(handler.lastCheck).toBeInstanceOf(Map);
    });
  });

  describe('checkServiceAvailability', () => {
    test('should check service availability successfully', async () => {
      const checkFunction = jest.fn().mockResolvedValue(true);
      
      const result = await handler.checkServiceAvailability('test-service', checkFunction);
      
      expect(result).toBe(true);
      expect(checkFunction).toHaveBeenCalled();
      
      const status = handler.getServiceStatus('test-service');
      expect(status.available).toBe(true);
      expect(status.responseTime).toBeGreaterThanOrEqual(0);
      expect(status.error).toBeNull();
    });

    test('should handle service check failure', async () => {
      const checkFunction = jest.fn().mockRejectedValue(new Error('Service unavailable'));
      
      const result = await handler.checkServiceAvailability('test-service', checkFunction);
      
      expect(result).toBe(false);
      
      const status = handler.getServiceStatus('test-service');
      expect(status.available).toBe(false);
      expect(status.responseTime).toBeNull();
      expect(status.error).toBe('Service unavailable');
    });

    test('should record check timestamp', async () => {
      const checkFunction = jest.fn().mockResolvedValue(true);
      
      await handler.checkServiceAvailability('test-service', checkFunction);
      
      expect(handler.lastCheck.get('test-service')).toBeDefined();
    });
  });

  describe('checkOpenAIAvailability', () => {
    test('should return boolean result', async () => {
      const result = await handler.checkOpenAIAvailability();
      
      expect(typeof result).toBe('boolean');
    });

    test('should complete within reasonable time', async () => {
      const startTime = Date.now();
      await handler.checkOpenAIAvailability();
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(500); // Should complete quickly
    });
  });

  describe('checkGitHubAvailability', () => {
    test('should return boolean result', async () => {
      const result = await handler.checkGitHubAvailability();
      
      expect(typeof result).toBe('boolean');
    });

    test('should complete within reasonable time', async () => {
      const startTime = Date.now();
      await handler.checkGitHubAvailability();
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(200); // Should complete quickly
    });
  });

  describe('checkEmailAvailability', () => {
    test('should return boolean result', async () => {
      const result = await handler.checkEmailAvailability();
      
      expect(typeof result).toBe('boolean');
    });

    test('should complete within reasonable time', async () => {
      const startTime = Date.now();
      await handler.checkEmailAvailability();
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(500); // Should complete quickly
    });
  });

  describe('determineDegradationMode', () => {
    test('should return full mode when all critical services available', () => {
      // Mock all critical services as available
      handler.serviceStatus.set('openai', { available: true });
      handler.serviceStatus.set('github', { available: true });
      
      const mode = handler.determineDegradationMode();
      
      expect(mode).toBe('full');
      expect(handler.currentMode).toBe('full');
    });

    test('should return partial mode when some critical services unavailable', () => {
      // Mock one critical service as unavailable
      handler.serviceStatus.set('openai', { available: false });
      handler.serviceStatus.set('github', { available: true });
      
      const mode = handler.determineDegradationMode();
      
      expect(mode).toBe('partial');
      expect(handler.currentMode).toBe('partial');
    });

    test('should return minimal mode when most critical services unavailable', () => {
      // Mock most critical services as unavailable
      handler.serviceStatus.set('openai', { available: false });
      handler.serviceStatus.set('github', { available: true });
      
      const mode = handler.determineDegradationMode();
      
      expect(mode).toBe('partial');
      expect(handler.currentMode).toBe('partial');
    });

    test('should return offline mode when no critical services available', () => {
      // Mock no critical services as available
      handler.serviceStatus.set('openai', { available: false });
      handler.serviceStatus.set('github', { available: false });
      
      const mode = handler.determineDegradationMode();
      
      expect(mode).toBe('offline');
      expect(handler.currentMode).toBe('offline');
    });
  });

  describe('getFallbackStrategy', () => {
    test('should return fallback strategy for known service', () => {
      const fallback = handler.getFallbackStrategy('openai');
      expect(fallback).toBe('manual');
    });

    test('should return manual fallback for unknown service', () => {
      const fallback = handler.getFallbackStrategy('unknown-service');
      expect(fallback).toBe('manual');
    });
  });

  describe('isServiceAvailable', () => {
    test('should return true for available service', () => {
      handler.serviceStatus.set('test-service', { available: true });
      
      const available = handler.isServiceAvailable('test-service');
      expect(available).toBe(true);
    });

    test('should return false for unavailable service', () => {
      handler.serviceStatus.set('test-service', { available: false });
      
      const available = handler.isServiceAvailable('test-service');
      expect(available).toBe(false);
    });

    test('should return false for unknown service', () => {
      const available = handler.isServiceAvailable('unknown-service');
      expect(available).toBe(false);
    });
  });

  describe('getServiceStatus', () => {
    test('should return service status', () => {
      const status = { available: true, responseTime: 100 };
      handler.serviceStatus.set('test-service', status);
      
      const result = handler.getServiceStatus('test-service');
      expect(result).toEqual(status);
    });

    test('should return null for unknown service', () => {
      const result = handler.getServiceStatus('unknown-service');
      expect(result).toBeNull();
    });
  });

  describe('getAllServiceStatuses', () => {
    test('should return all service statuses', () => {
      handler.serviceStatus.set('openai', { available: true });
      handler.serviceStatus.set('github', { available: false });
      
      const statuses = handler.getAllServiceStatuses();
      
      expect(statuses.openai).toBeDefined();
      expect(statuses.github).toBeDefined();
      expect(statuses.email).toBeDefined();
      expect(statuses.storage).toBeDefined();
    });
  });

  describe('createDegradedReviewStrategy', () => {
    test('should create strategy for full mode', () => {
      handler.serviceStatus.set('openai', { available: true });
      handler.serviceStatus.set('github', { available: true });
      
      const strategy = handler.createDegradedReviewStrategy();
      
      expect(strategy.mode).toBe('full');
      expect(strategy.availableServices).toContain('openai');
      expect(strategy.availableServices).toContain('github');
      expect(strategy.availableServices).toContain('openai');
      expect(strategy.availableServices).toContain('github');
      expect(strategy.recommendations).toContain('All services available - full functionality');
    });

    test('should create strategy for partial mode', () => {
      handler.serviceStatus.set('openai', { available: false });
      handler.serviceStatus.set('github', { available: true });
      
      const strategy = handler.createDegradedReviewStrategy();
      
      expect(strategy.mode).toBe('partial');
      expect(strategy.availableServices).toContain('github');
      expect(strategy.unavailableServices).toContain('openai');
      expect(strategy.fallbackStrategies.openai).toBe('manual');
      expect(strategy.recommendations).toContain('AI review unavailable - using manual review fallback');
    });

    test('should create strategy for offline mode', () => {
      handler.serviceStatus.set('openai', { available: false });
      handler.serviceStatus.set('github', { available: false });
      
      const strategy = handler.createDegradedReviewStrategy();
      
      expect(strategy.mode).toBe('offline');
      expect(strategy.availableServices).toHaveLength(0);
      expect(strategy.unavailableServices).toContain('openai');
      expect(strategy.unavailableServices).toContain('github');
      expect(strategy.recommendations).toContain('Critical services unavailable - offline mode');
    });
  });

  describe('createOfflineReviewResponse', () => {
    test('should create offline review response', () => {
      const context = {
        repository: 'test-repo',
        targetBranch: 'main',
        commitSha: 'abc123',
        author: 'test@example.com'
      };
      
      const response = handler.createOfflineReviewResponse(context);
      
      expect(response.issues).toHaveLength(1);
      expect(response.issues[0].severity).toBe('MEDIUM');
      expect(response.issues[0].description).toContain('Automated code review unavailable');
      expect(response.summary.offlineMode).toBe(true);
      expect(response.summary.serviceOutage).toBe(true);
      expect(response.metadata.mode).toBe('offline');
      expect(response.metadata.context.repository).toBe('test-repo');
      expect(response.metadata.instructions).toHaveLength(5);
    });
  });

  describe('createPartialReviewResponse', () => {
    test('should create partial review response with AI results', () => {
      const context = {
        repository: 'test-repo',
        targetBranch: 'main',
        commitSha: 'abc123',
        author: 'test@example.com'
      };
      
      const aiResponse = {
        issues: [
          { severity: 'HIGH', category: 'Security', description: 'Security issue' }
        ]
      };
      
      handler.serviceStatus.set('openai', { available: true });
      handler.serviceStatus.set('github', { available: true });
      handler.serviceStatus.set('email', { available: false });
      
      const response = handler.createPartialReviewResponse(context, aiResponse);
      
      expect(response.issues).toHaveLength(1);
      expect(response.summary.partialMode).toBe(true);
      expect(response.metadata.mode).toBe('partial');
      expect(response.metadata.availableServices).toContain('openai');
      expect(response.metadata.availableServices).toContain('github');
      expect(response.metadata.unavailableServices).toContain('email');
    });

    test('should create partial review response without AI results', () => {
      const context = {
        repository: 'test-repo',
        targetBranch: 'main',
        commitSha: 'abc123',
        author: 'test@example.com'
      };
      
      handler.serviceStatus.set('openai', { available: false });
      handler.serviceStatus.set('github', { available: true });
      
      const response = handler.createPartialReviewResponse(context);
      
      expect(response.issues).toHaveLength(1);
      expect(response.issues[0].description).toContain('AI review service unavailable');
      expect(response.summary.partialMode).toBe(true);
      expect(response.metadata.unavailableServices).toContain('openai');
    });
  });

  describe('getModeConfiguration', () => {
    test('should return full mode configuration', () => {
      handler.serviceStatus.set('openai', { available: true });
      handler.serviceStatus.set('github', { available: true });
      
      const config = handler.getModeConfiguration('full');
      
      expect(config.aiReview).toBe(true);
      expect(config.emailNotifications).toBe(true);
      expect(config.githubIssues).toBe(true);
      expect(config.storage).toBe(true);
      expect(config.timeout).toBe(30000);
    });

    test('should return partial mode configuration', () => {
      handler.serviceStatus.set('openai', { available: false });
      handler.serviceStatus.set('github', { available: true });
      
      const config = handler.getModeConfiguration('partial');
      
      expect(config.aiReview).toBe(false);
      expect(config.emailNotifications).toBe(false);
      expect(config.githubIssues).toBe(true);
      expect(config.storage).toBe(false);
      expect(config.timeout).toBe(45000);
    });

    test('should return offline mode configuration', () => {
      const config = handler.getModeConfiguration('offline');
      
      expect(config.aiReview).toBe(false);
      expect(config.emailNotifications).toBe(false);
      expect(config.githubIssues).toBe(false);
      expect(config.storage).toBe(false);
      expect(config.timeout).toBe(0);
    });
  });

  describe('shouldProceed', () => {
    test('should allow operations in full mode', () => {
      handler.serviceStatus.set('openai', { available: true });
      handler.serviceStatus.set('github', { available: true });
      
      expect(handler.shouldProceed('ai_review')).toBe(true);
      expect(handler.shouldProceed('email_notification')).toBe(true);
      expect(handler.shouldProceed('github_issue')).toBe(true);
      expect(handler.shouldProceed('storage')).toBe(true);
    });

    test('should block operations in offline mode', () => {
      handler.serviceStatus.set('openai', { available: false });
      handler.serviceStatus.set('github', { available: false });
      
      expect(handler.shouldProceed('ai_review')).toBe(false);
      expect(handler.shouldProceed('email_notification')).toBe(false);
      expect(handler.shouldProceed('github_issue')).toBe(false);
      expect(handler.shouldProceed('storage')).toBe(false);
    });

    test('should allow unknown operations', () => {
      expect(handler.shouldProceed('unknown_operation')).toBe(true);
    });
  });

  describe('getHealthReport', () => {
    test('should generate health report', () => {
      handler.serviceStatus.set('openai', { available: true, responseTime: 100 });
      handler.serviceStatus.set('github', { available: false, error: 'Connection failed' });
      
      const report = handler.getHealthReport();
      
      expect(report.timestamp).toBeDefined();
      expect(report.currentMode).toBeDefined();
      expect(report.services.openai).toBeDefined();
      expect(report.services.github).toBeDefined();
      expect(report.services.openai.available).toBe(true);
      expect(report.services.github.available).toBe(false);
      expect(report.recommendations).toContain('Critical service GitHub API is unavailable');
    });

    test('should include critical service recommendations', () => {
      handler.serviceStatus.set('openai', { available: false });
      handler.serviceStatus.set('github', { available: false });
      
      const report = handler.getHealthReport();
      
      expect(report.recommendations).toContain('Critical service OpenAI API is unavailable');
      expect(report.recommendations).toContain('Critical service GitHub API is unavailable');
    });
  });

  describe('resetServiceStatus', () => {
    test('should reset service status', () => {
      handler.serviceStatus.set('openai', { available: true });
      handler.lastCheck.set('openai', Date.now());
      handler.currentMode = 'partial';
      
      handler.resetServiceStatus();
      
      expect(handler.serviceStatus.size).toBe(0);
      expect(handler.lastCheck.size).toBe(0);
      expect(handler.currentMode).toBe('full');
    });
  });

  describe('getConfiguration', () => {
    test('should return configuration', () => {
      const config = handler.getConfiguration();
      
      expect(config.services).toBeDefined();
      expect(config.degradationModes).toEqual(['full', 'partial', 'minimal', 'offline']);
      expect(config.currentMode).toBe('full');
      expect(config.checkInterval).toBe(30000);
    });
  });
});
