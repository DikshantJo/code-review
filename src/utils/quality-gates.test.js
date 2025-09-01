const QualityGates = require('./quality-gates');

// Mock @actions/core
jest.mock('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn()
}));

describe('QualityGates', () => {
  let qualityGates;
  let mockAuditLogger;

  beforeEach(() => {
    mockAuditLogger = {
      logInfo: jest.fn().mockResolvedValue({ logged: true }),
      logQualityGateDecision: jest.fn().mockResolvedValue({ logged: true }),
      logOverrideAttempt: jest.fn().mockResolvedValue({ logged: true }),
      logError: jest.fn().mockResolvedValue({ logged: true }),
      logQualityGateStart: jest.fn().mockResolvedValue({ logged: true }),
      logQualityGateError: jest.fn().mockResolvedValue({ logged: true })
    };

    qualityGates = new QualityGates({
      enabled: true,
      severityThreshold: 'HIGH',
      blockProduction: true,
      allowUrgentOverride: true,
      urgentKeyword: 'URGENT',
      maxOverridesPerDay: 3
    });

    qualityGates.setAuditLogger(mockAuditLogger);
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const qg = new QualityGates();
      expect(qg.options.enabled).toBe(true);
      expect(qg.options.severityThreshold).toBe('HIGH');
      expect(qg.options.blockProduction).toBe(true);
      expect(qg.options.allowUrgentOverride).toBe(true);
      expect(qg.options.urgentKeyword).toBe('URGENT');
      expect(qg.options.maxOverridesPerDay).toBe(3);
    });

    it('should initialize with custom options', () => {
      const qg = new QualityGates({
        enabled: false,
        severityThreshold: 'MEDIUM',
        blockProduction: false,
        allowUrgentOverride: false,
        urgentKeyword: 'EMERGENCY',
        maxOverridesPerDay: 5
      });

      expect(qg.options.enabled).toBe(false);
      expect(qg.options.severityThreshold).toBe('MEDIUM');
      expect(qg.options.blockProduction).toBe(false);
      expect(qg.options.allowUrgentOverride).toBe(false);
      expect(qg.options.urgentKeyword).toBe('EMERGENCY');
      expect(qg.options.maxOverridesPerDay).toBe(5);
    });

    it('should validate configuration', () => {
      expect(() => new QualityGates({ severityThreshold: 'INVALID' })).toThrow('Invalid severity threshold');
      expect(() => new QualityGates({ maxOverridesPerDay: -1 })).toThrow('maxOverridesPerDay must be a non-negative number');
    });
  });

  describe('setAuditLogger', () => {
    it('should set audit logger reference', () => {
      const qg = new QualityGates();
      const mockLogger = { logInfo: jest.fn() };
      
      qg.setAuditLogger(mockLogger);
      expect(qg.auditLogger).toBe(mockLogger);
    });
  });

  describe('evaluateQualityGate', () => {
    const mockReviewData = {
      severity_breakdown: { high: 2, medium: 1, low: 0 },
      commit_message: 'Fix critical bug',
      commit_author: 'testuser',
      target_branch: 'main'
    };

    const mockConfig = {
      current_environment: 'production',
      quality_gates: {
        severity_threshold: 'HIGH',
        max_overrides_per_day: 3
      }
    };

    const mockContext = {
      sessionId: 'test-session-123',
      user: 'testuser',
      repository: 'test/repo',
      branch: 'main',
      commitSha: 'abc123'
    };

    it('should return passed when quality gates disabled', async () => {
      const qg = new QualityGates({ enabled: false });
      qg.setAuditLogger(mockAuditLogger);

      const result = await qg.evaluateQualityGate(mockReviewData, mockConfig, mockContext);

      expect(result.passed).toBe(true);
      expect(result.blocked).toBe(false);
      expect(result.reason).toBe('Quality gates disabled');
      expect(mockAuditLogger.logQualityGateStart).toHaveBeenCalled();
      expect(mockAuditLogger.logQualityGateDecision).toHaveBeenCalled();
    });

    it('should return passed when not production environment', async () => {
      const result = await qualityGates.evaluateQualityGate(
        { ...mockReviewData, target_branch: 'dev' },
        { ...mockConfig, current_environment: 'development' },
        mockContext
      );

      expect(result.passed).toBe(true);
      expect(result.blocked).toBe(false);
      expect(result.reason).toBe('Not a production environment or blocking disabled');
      expect(result.isProduction).toBe(false);
    });

    it('should return passed when blocking disabled', async () => {
      const qg = new QualityGates({ blockProduction: false });
      qg.setAuditLogger(mockAuditLogger);

      const result = await qg.evaluateQualityGate(mockReviewData, mockConfig, mockContext);

      expect(result.passed).toBe(true);
      expect(result.blocked).toBe(false);
      expect(result.reason).toBe('Not a production environment or blocking disabled');
    });

    it('should return passed with override when URGENT keyword found', async () => {
      const result = await qualityGates.evaluateQualityGate(
        { ...mockReviewData, commit_message: 'URGENT: Fix critical security issue' },
        mockConfig,
        mockContext
      );

      expect(result.passed).toBe(true);
      expect(result.overrideUsed).toBe(true);
      expect(result.reason).toBe('URGENT override applied');
      expect(mockAuditLogger.logOverrideAttempt).toHaveBeenCalled();
    });

    it('should return failed when high severity issues found', async () => {
      const result = await qualityGates.evaluateQualityGate(mockReviewData, mockConfig, mockContext);

      expect(result.passed).toBe(false);
      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('HIGH severity issues detected');
      expect(result.highestSeverity).toBe('HIGH');
      expect(result.issuesFound).toBe(2);
    });

    it('should return passed when issues below threshold', async () => {
      const result = await qualityGates.evaluateQualityGate(
        { ...mockReviewData, severity_breakdown: { high: 0, medium: 1, low: 2 } },
        mockConfig,
        mockContext
      );

      expect(result.passed).toBe(true);
      expect(result.blocked).toBe(false);
      expect(result.reason).toBe('Quality gate passed');
      expect(result.highestSeverity).toBe('MEDIUM');
    });

    it('should handle errors gracefully', async () => {
      // Mock the logQualityGateStart method to throw an error
      jest.spyOn(qualityGates, 'logQualityGateStart').mockRejectedValue(new Error('Logging failed'));

      const result = await qualityGates.evaluateQualityGate(mockReviewData, mockConfig, mockContext);

      expect(result.passed).toBe(false);
      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('Quality gate evaluation failed');
      expect(mockAuditLogger.logQualityGateError).toHaveBeenCalled();
    });
  });

  describe('checkUrgentOverride', () => {
    const mockConfig = {
      quality_gates: {
        max_overrides_per_day: 3
      }
    };

    const mockContext = {
      sessionId: 'test-session-123'
    };

    it('should return false when override disabled', async () => {
      const qg = new QualityGates({ allowUrgentOverride: false });
      qg.setAuditLogger(mockAuditLogger);

      const result = await qg.checkUrgentOverride('URGENT: Fix bug', 'testuser', mockConfig, mockContext);

      expect(result.overrideUsed).toBe(false);
      expect(result.reason).toBe('Override disabled');
    });

    it('should return false when no URGENT keyword', async () => {
      const result = await qualityGates.checkUrgentOverride('Fix bug', 'testuser', mockConfig, mockContext);

      expect(result.overrideUsed).toBe(false);
      expect(result.reason).toBe('No override keyword found');
    });

    it('should return true when URGENT keyword found and within limits', async () => {
      const result = await qualityGates.checkUrgentOverride('URGENT: Fix critical issue', 'testuser', mockConfig, mockContext);

      expect(result.overrideUsed).toBe(true);
      expect(result.authorized).toBe(true);
      expect(result.reason).toBe('URGENT override applied');
      expect(mockAuditLogger.logOverrideAttempt).toHaveBeenCalled();
    });

    it('should return false when daily limit exceeded', async () => {
      // Set up tracking to exceed limit
      const today = new Date().toDateString();
      qualityGates.options.overrideTracking.set(`testuser:${today}`, 3);

      const result = await qualityGates.checkUrgentOverride('URGENT: Fix critical issue', 'testuser', mockConfig, mockContext);

      expect(result.overrideUsed).toBe(false);
      expect(result.limitExceeded).toBe(true);
      expect(result.reason).toContain('Override limit exceeded');
    });
  });

  describe('hasUrgentKeyword', () => {
    it('should detect URGENT keyword', () => {
      expect(qualityGates.hasUrgentKeyword('URGENT: Fix bug')).toBe(true);
      expect(qualityGates.hasUrgentKeyword('urgent fix needed')).toBe(true);
      expect(qualityGates.hasUrgentKeyword('This is urgent')).toBe(true);
    });

    it('should not detect URGENT keyword in other words', () => {
      expect(qualityGates.hasUrgentKeyword('This is not urgent at all')).toBe(false);
      expect(qualityGates.hasUrgentKeyword('URGENTLY')).toBe(false);
      expect(qualityGates.hasUrgentKeyword('')).toBe(false);
      expect(qualityGates.hasUrgentKeyword(null)).toBe(false);
      expect(qualityGates.hasUrgentKeyword('This is not urgent at all')).toBe(false);
    });

    it('should work with custom keyword', () => {
      const qg = new QualityGates({ urgentKeyword: 'EMERGENCY' });
      expect(qg.hasUrgentKeyword('EMERGENCY: Fix bug')).toBe(true);
      expect(qg.hasUrgentKeyword('URGENT: Fix bug')).toBe(false);
    });
  });

  describe('evaluateSeverity', () => {
    const mockConfig = {
      quality_gates: {
        severity_threshold: 'HIGH'
      }
    };

    it('should block when high severity issues found', () => {
      const result = qualityGates.evaluateSeverity({ high: 2, medium: 1, low: 0 }, mockConfig);

      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('HIGH severity issues detected');
      expect(result.highestSeverity).toBe('HIGH');
      expect(result.issuesFound).toBe(2);
    });

    it('should not block when issues below threshold', () => {
      const result = qualityGates.evaluateSeverity({ high: 0, medium: 1, low: 2 }, mockConfig);

      expect(result.blocked).toBe(false);
      expect(result.reason).toBe('Issues below threshold (HIGH)');
      expect(result.highestSeverity).toBe('MEDIUM');
    });

    it('should handle empty severity breakdown', () => {
      const result = qualityGates.evaluateSeverity({}, mockConfig);

      expect(result.blocked).toBe(false);
      expect(result.highestSeverity).toBe('NONE');
    });
  });

  describe('getHighestSeverity', () => {
    it('should return highest severity level', () => {
      expect(qualityGates.getHighestSeverity({ high: 1, medium: 0, low: 0 })).toBe('HIGH');
      expect(qualityGates.getHighestSeverity({ high: 0, medium: 1, low: 0 })).toBe('MEDIUM');
      expect(qualityGates.getHighestSeverity({ high: 0, medium: 0, low: 1 })).toBe('LOW');
      expect(qualityGates.getHighestSeverity({ high: 0, medium: 0, low: 0 })).toBe('NONE');
    });
  });

  describe('countIssuesAtOrAboveSeverity', () => {
    it('should count issues at or above specified severity', () => {
      const breakdown = { high: 2, medium: 3, low: 1 };
      
      expect(qualityGates.countIssuesAtOrAboveSeverity(breakdown, 'HIGH')).toBe(2);
      expect(qualityGates.countIssuesAtOrAboveSeverity(breakdown, 'MEDIUM')).toBe(5);
      expect(qualityGates.countIssuesAtOrAboveSeverity(breakdown, 'LOW')).toBe(6);
    });
  });

  describe('isProductionEnvironment', () => {
    it('should identify production branches', () => {
      expect(qualityGates.isProductionEnvironment('main', 'production')).toBe(true);
      expect(qualityGates.isProductionEnvironment('master', 'prod')).toBe(true);
      expect(qualityGates.isProductionEnvironment('production', 'live')).toBe(true);
      expect(qualityGates.isProductionEnvironment('dev', 'development')).toBe(false);
      expect(qualityGates.isProductionEnvironment('feature/test', 'staging')).toBe(false);
    });
  });

  describe('generateStatusMessage', () => {
    it('should generate appropriate status messages', () => {
      expect(qualityGates.generateStatusMessage({ passed: true, overrideUsed: false }))
        .toBe('✅ Quality gate passed');
      
      expect(qualityGates.generateStatusMessage({ passed: true, overrideUsed: true }))
        .toBe('✅ Quality gate passed (URGENT override used)');
      
      expect(qualityGates.generateStatusMessage({ passed: false, reason: 'High severity issues' }))
        .toBe('❌ Quality gate failed: High severity issues');
    });
  });

  describe('getOverrideStats', () => {
    it('should return override statistics', () => {
      qualityGates.options.overrideTracking.set('user1:Mon Jan 01 2024', 2);
      qualityGates.options.overrideTracking.set('user2:Mon Jan 01 2024', 1);
      qualityGates.options.overrideTracking.set('user1:Tue Jan 02 2024', 1);

      const stats = qualityGates.getOverrideStats();

      expect(stats.totalOverrides).toBe(4);
      expect(stats.usersWithOverrides).toContain('user1');
      expect(stats.usersWithOverrides).toContain('user2');
      expect(stats.dailyBreakdown['Mon Jan 01 2024']).toBe(3);
      expect(stats.dailyBreakdown['Tue Jan 02 2024']).toBe(1);
    });
  });

  describe('clearOverrideTracking', () => {
    it('should clear all tracking data', () => {
      qualityGates.options.overrideTracking.set('user1:Mon Jan 01 2024', 2);
      qualityGates.options.overrideTracking.set('user2:Mon Jan 01 2024', 1);

      qualityGates.clearOverrideTracking();

      expect(qualityGates.options.overrideTracking.size).toBe(0);
    });

    it('should clear old tracking data', () => {
      qualityGates.options.overrideTracking.set('user1:Mon Jan 01 2024', 2);
      qualityGates.options.overrideTracking.set('user2:Tue Jan 02 2024', 1);

      qualityGates.clearOverrideTracking('Tue Jan 02 2024');

      expect(qualityGates.options.overrideTracking.size).toBe(1);
      expect(qualityGates.options.overrideTracking.has('user2:Tue Jan 02 2024')).toBe(true);
    });
  });

  describe('getConfigSummary', () => {
    it('should return configuration summary', () => {
      const summary = qualityGates.getConfigSummary();

      expect(summary.enabled).toBe(true);
      expect(summary.severityThreshold).toBe('HIGH');
      expect(summary.blockProduction).toBe(true);
      expect(summary.allowUrgentOverride).toBe(true);
      expect(summary.urgentKeyword).toBe('URGENT');
      expect(summary.maxOverridesPerDay).toBe(3);
      expect(summary.overrideTrackingSize).toBe(0);
    });
  });

  describe('logging methods', () => {
    it('should log info messages when enabled', () => {
      const qg = new QualityGates({ enableLogging: true, logLevel: 'INFO' });
      const core = require('@actions/core');

      qg.logInfo('Test message');

      expect(core.info).toHaveBeenCalledWith('[Quality Gates] Test message');
    });

    it('should log warning messages when enabled', () => {
      const qg = new QualityGates({ enableLogging: true });
      const core = require('@actions/core');

      qg.logWarning('Test warning');

      expect(core.warning).toHaveBeenCalledWith('[Quality Gates] Test warning');
    });

    it('should log error messages when enabled', () => {
      const qg = new QualityGates({ enableLogging: true });
      const core = require('@actions/core');

      qg.logError('Test error');

      expect(core.error).toHaveBeenCalledWith('[Quality Gates] Test error');
    });

    it('should not log when logging disabled', () => {
      const qg = new QualityGates({ enableLogging: false });
      const core = require('@actions/core');

      // Clear any previous calls
      jest.clearAllMocks();

      qg.logInfo('Test message');
      qg.logWarning('Test warning');
      qg.logError('Test error');

      expect(core.info).not.toHaveBeenCalled();
      expect(core.warning).not.toHaveBeenCalled();
      expect(core.error).not.toHaveBeenCalled();
    });
  });
});
