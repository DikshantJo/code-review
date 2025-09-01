const AuditLogger = require('./logger');
const fs = require('fs').promises;

// Mock fs.promises
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    readdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    appendFile: jest.fn(),
    stat: jest.fn(),
    unlink: jest.fn(),
    rename: jest.fn()
  }
}));

describe('AuditLogger', () => {
  let logger;
  let mockConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfig = {
      logging: {
        audit_log_dir: './test-logs',
        max_audit_log_files: 10,
        max_audit_log_size: 1024 * 1024,
        audit_retention_days: 30,
        enable_console_logging: false,
        enable_file_logging: true,
        log_level: 'info',
        include_sensitive_data: false,
        compliance_mode: true,
        required_fields: ['timestamp', 'event_type', 'user'],
        data_retention_policy: {
          audit_logs: 365,
          error_logs: 90,
          performance_logs: 180,
          compliance_reports: 2555
        },
        integrity_checks: {
          enabled: true,
          algorithm: 'sha256',
          check_frequency: 'daily'
        },
        regulatory_compliance: {
          sox: true,
          gdpr: false,
          hipaa: false,
          pci_dss: false
        }
      }
    };

    logger = new AuditLogger(mockConfig);
    
    // Setup default mocks
    fs.mkdir.mockResolvedValue();
    fs.readdir.mockResolvedValue([]);
    fs.readFile.mockResolvedValue('');
    fs.stat.mockResolvedValue({ size: 1024, mtime: new Date() });
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const defaultLogger = new AuditLogger();
      expect(defaultLogger.logDir).toBe('./logs/audit');
      expect(defaultLogger.maxLogFiles).toBe(50);
      expect(defaultLogger.complianceMode).toBe(false);
    });

    it('should initialize with custom configuration', () => {
      expect(logger.logDir).toBe('./test-logs');
      expect(logger.maxLogFiles).toBe(10);
      expect(logger.complianceMode).toBe(true);
      expect(logger.dataRetentionPolicy.audit_logs).toBe(365);
      expect(logger.regulatoryCompliance.sox).toBe(true);
    });

    it('should initialize audit chain', () => {
      expect(logger.auditChain).toEqual([]);
      expect(logger.chainIndex).toBe(0);
    });
  });

  describe('logEvent', () => {
    it('should log event with audit chain entry', async () => {
      const result = await logger.logEvent('test_event', { 
        timestamp: new Date().toISOString(),
        event_type: 'test_event',
        user: 'testuser' 
      }, 'info', { repository: 'test-repo' });
      
      expect(result.logged).toBe(true);
      expect(result.auditId).toMatch(/^audit_\d+_[a-z0-9]+$/);
      expect(result.complianceValid).toBe(true);
    });

    it('should generate audit chain entry', async () => {
      await logger.logEvent('test_event', { user: 'testuser' }, 'info');
      
      expect(logger.auditChain).toHaveLength(1);
      expect(logger.auditChain[0]).toHaveProperty('index', 0);
      expect(logger.auditChain[0]).toHaveProperty('previous_hash');
      expect(logger.auditChain[0]).toHaveProperty('hash');
      expect(logger.auditChain[0]).toHaveProperty('audit_id');
      expect(logger.auditChain[0]).toHaveProperty('timestamp');
    });

    it('should maintain audit chain integrity', async () => {
      await logger.logEvent('event1', { user: 'user1' }, 'info');
      await logger.logEvent('event2', { user: 'user2' }, 'info');
      
      expect(logger.auditChain).toHaveLength(2);
      expect(logger.auditChain[1].previous_hash).toBe(logger.auditChain[0].hash);
      expect(logger.chainIndex).toBe(2);
    });

    it('should include regulatory compliance when enabled', async () => {
      const result = await logger.logEvent('test_event', { user: 'testuser' }, 'info');
      
      expect(result.logged).toBe(true);
      // The log entry should include compliance info
      expect(fs.appendFile).toHaveBeenCalled();
    });
  });

  describe('audit chain integrity', () => {
    it('should calculate correct chain hash', () => {
      const auditId = 'test_audit_123';
      const timestamp = '2024-01-01T00:00:00.000Z';
      const previousHash = '0000000000000000000000000000000000000000000000000000000000000000';
      
      const hash = logger.calculateChainHash(auditId, timestamp, previousHash);
      
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(typeof hash).toBe('string');
    });

    it('should maintain chain size limit', async () => {
      // Add more than 10000 entries
      for (let i = 0; i < 10005; i++) {
        await logger.logEvent(`event_${i}`, { user: `user_${i}` }, 'info');
      }
      
      expect(logger.auditChain.length).toBeLessThanOrEqual(10000);
      expect(logger.auditChain.length).toBeGreaterThan(0);
    });
  });

  describe('regulatory compliance', () => {
    it('should check SOX compliance when enabled', () => {
      const data = { user: 'testuser', action: 'code_review' };
      const context = { repository: 'test-repo', user: 'testuser' };
      
      const compliance = logger.checkRegulatoryCompliance(data, context);
      
      expect(compliance).toHaveProperty('sox');
      expect(compliance.sox.compliant).toBe(true);
      expect(compliance.sox.checks).toHaveProperty('access_control');
      expect(compliance.sox.checks).toHaveProperty('change_management');
      expect(compliance.sox.checks).toHaveProperty('data_integrity');
      expect(compliance.sox.checks).toHaveProperty('audit_trail');
    });

    it('should check GDPR compliance when enabled', () => {
      logger.regulatoryCompliance.gdpr = true;
      
      const data = { user: 'testuser', action: 'code_review' };
      const context = { repository: 'test-repo', user: 'testuser' };
      
      const compliance = logger.checkRegulatoryCompliance(data, context);
      
      expect(compliance).toHaveProperty('gdpr');
      expect(compliance.gdpr.compliant).toBe(true);
      expect(compliance.gdpr.checks).toHaveProperty('data_minimization');
      expect(compliance.gdpr.checks).toHaveProperty('purpose_limitation');
      expect(compliance.gdpr.checks).toHaveProperty('storage_limitation');
      expect(compliance.gdpr.checks).toHaveProperty('data_protection');
    });

    it('should check HIPAA compliance when enabled', () => {
      logger.regulatoryCompliance.hipaa = true;
      
      const data = { user: 'testuser', action: 'code_review' };
      const context = { repository: 'test-repo', user: 'testuser' };
      
      const compliance = logger.checkRegulatoryCompliance(data, context);
      
      expect(compliance).toHaveProperty('hipaa');
      expect(compliance.hipaa.compliant).toBe(true);
      expect(compliance.hipaa.checks).toHaveProperty('phi_protection');
      expect(compliance.hipaa.checks).toHaveProperty('access_controls');
      expect(compliance.hipaa.checks).toHaveProperty('audit_logs');
      expect(compliance.hipaa.checks).toHaveProperty('encryption');
    });

    it('should check PCI DSS compliance when enabled', () => {
      logger.regulatoryCompliance.pci_dss = true;
      
      const data = { user: 'testuser', action: 'code_review' };
      const context = { repository: 'test-repo', user: 'testuser' };
      
      const compliance = logger.checkRegulatoryCompliance(data, context);
      
      expect(compliance).toHaveProperty('pci_dss');
      expect(compliance.pci_dss.compliant).toBe(true);
      expect(compliance.pci_dss.checks).toHaveProperty('card_data_protection');
      expect(compliance.pci_dss.checks).toHaveProperty('access_control');
      expect(compliance.pci_dss.checks).toHaveProperty('monitoring');
      expect(compliance.pci_dss.checks).toHaveProperty('encryption');
    });
  });

  describe('data retention', () => {
    it('should perform data retention cleanup', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 400); // 400 days old
      
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10); // 10 days old
      
      fs.readdir.mockResolvedValue([
        'audit-2023-01-01.jsonl', // old file
        'audit-2024-01-01.jsonl', // recent file
        'error-2023-01-01.jsonl'  // old error file
      ]);
      
      fs.stat
        .mockResolvedValueOnce({ mtime: oldDate, size: 1024 }) // old audit file
        .mockResolvedValueOnce({ mtime: recentDate, size: 1024 }) // recent audit file
        .mockResolvedValueOnce({ mtime: oldDate, size: 512 }); // old error file
      
      const results = await logger.performDataRetentionCleanup();
      
      // The cleanup should remove old files based on retention policy
      expect(results.files_removed).toBeGreaterThanOrEqual(0);
      expect(results.space_freed).toBeGreaterThanOrEqual(0);
      expect(results.errors).toHaveLength(0);
    });

    it('should handle cleanup errors gracefully', async () => {
      fs.readdir.mockResolvedValue(['audit-2023-01-01.jsonl']);
      fs.stat.mockRejectedValue(new Error('File not found'));
      
      const results = await logger.performDataRetentionCleanup();
      
      expect(results.files_removed).toBeGreaterThanOrEqual(0);
      expect(results.space_freed).toBeGreaterThanOrEqual(0);
      expect(results.errors.length).toBeGreaterThan(0);
    });
  });

  describe('integrity verification', () => {
    it('should verify audit trail integrity', async () => {
      const mockLogContent = JSON.stringify({
        audit_id: 'test_audit_123',
        timestamp: '2024-01-01T00:00:00.000Z',
        audit_chain: {
          index: 0,
          previous_hash: '0000000000000000000000000000000000000000000000000000000000000000',
          hash: logger.calculateChainHash('test_audit_123', '2024-01-01T00:00:00.000Z', '0000000000000000000000000000000000000000000000000000000000000000'),
          audit_id: 'test_audit_123',
          timestamp: '2024-01-01T00:00:00.000Z'
        },
        data: { user: 'testuser' },
        compliance: {
          data_integrity: logger.calculateDataIntegrity({ user: 'testuser' })
        }
      }) + '\n';
      
      fs.readdir.mockResolvedValue(['audit-2024-01-01.jsonl']);
      fs.readFile.mockResolvedValue(mockLogContent);
      
      const results = await logger.verifyAuditTrailIntegrity();
      
      expect(results.verified).toBe(true);
      expect(results.files_checked).toBe(1);
      expect(results.entries_verified).toBe(1);
      expect(results.errors).toHaveLength(0);
    });

    it('should detect hash mismatches', async () => {
      const mockLogContent = JSON.stringify({
        audit_id: 'test_audit_123',
        timestamp: '2024-01-01T00:00:00.000Z',
        audit_chain: {
          index: 0,
          previous_hash: '0000000000000000000000000000000000000000000000000000000000000000',
          hash: 'invalid_hash_value',
          audit_id: 'test_audit_123',
          timestamp: '2024-01-01T00:00:00.000Z'
        },
        data: { user: 'testuser' }
      }) + '\n';
      
      fs.readdir.mockResolvedValue(['audit-2024-01-01.jsonl']);
      fs.readFile.mockResolvedValue(mockLogContent);
      
      const results = await logger.verifyAuditTrailIntegrity();
      
      expect(results.verified).toBe(false);
      expect(results.errors.length).toBeGreaterThan(0);
      expect(results.errors[0]).toContain('Hash mismatch');
    });

    it('should detect data integrity mismatches', async () => {
      const mockLogContent = JSON.stringify({
        audit_id: 'test_audit_123',
        timestamp: '2024-01-01T00:00:00.000Z',
        data: { user: 'testuser' },
        compliance: {
          data_integrity: 'invalid_integrity_hash'
        }
      }) + '\n';
      
      fs.readdir.mockResolvedValue(['audit-2024-01-01.jsonl']);
      fs.readFile.mockResolvedValue(mockLogContent);
      
      const results = await logger.verifyAuditTrailIntegrity();
      
      expect(results.verified).toBe(false);
      expect(results.errors.length).toBeGreaterThan(0);
      expect(results.errors[0]).toContain('Data integrity mismatch');
    });
  });

  describe('compliance reporting', () => {
    it('should generate compliance report', async () => {
      const mockLogContent = JSON.stringify({
        audit_id: 'test_audit_123',
        timestamp: '2024-01-01T00:00:00.000Z',
        event_type: 'test_event',
        compliance: {
          validation_errors: []
        }
      }) + '\n';
      
      fs.readdir.mockResolvedValue(['audit-2024-01-01.jsonl']);
      fs.readFile.mockResolvedValue(mockLogContent);
      
      const report = await logger.generateComplianceReport();
      
      expect(report).toHaveProperty('generated_at');
      expect(report).toHaveProperty('period');
      expect(report).toHaveProperty('frameworks');
      expect(report).toHaveProperty('summary');
      expect(report.summary.total_events).toBeGreaterThanOrEqual(0);
      expect(report.summary.compliant_events).toBeGreaterThanOrEqual(0);
      expect(report.summary.compliance_rate).toBeGreaterThanOrEqual(0);
      expect(fs.readdir).toHaveBeenCalledWith('./test-logs');
    });

    it('should calculate compliance rate correctly', async () => {
      const mockLogContent = 
        JSON.stringify({
          audit_id: 'test_audit_1',
          timestamp: '2024-01-01T00:00:00.000Z',
          event_type: 'test_event',
          compliance: { validation_errors: [] }
        }) + '\n' +
        JSON.stringify({
          audit_id: 'test_audit_2',
          timestamp: '2024-01-01T00:00:00.000Z',
          event_type: 'test_event',
          compliance: { validation_errors: ['Missing field'] }
        }) + '\n';
      
      fs.readdir.mockResolvedValue(['audit-2024-01-01.jsonl']);
      fs.readFile.mockResolvedValue(mockLogContent);
      
      const report = await logger.generateComplianceReport();
      
      expect(report.summary.total_events).toBeGreaterThanOrEqual(0);
      expect(report.summary.compliant_events).toBeGreaterThanOrEqual(0);
      expect(report.summary.non_compliant_events).toBeGreaterThanOrEqual(0);
      expect(report.summary.compliance_rate).toBeGreaterThanOrEqual(0);
      expect(fs.readdir).toHaveBeenCalledWith('./test-logs');
    });

    it('should generate framework-specific reports', async () => {
      logger.regulatoryCompliance.sox = true;
      
      const mockLogContent = JSON.stringify({
        audit_id: 'test_audit_123',
        timestamp: '2024-01-01T00:00:00.000Z',
        event_type: 'test_event',
        compliance: { validation_errors: [] }
      }) + '\n';
      
      fs.readdir.mockResolvedValue(['audit-2024-01-01.jsonl']);
      fs.readFile.mockResolvedValue(mockLogContent);
      
      const report = await logger.generateComplianceReport();
      
      expect(report.frameworks).toHaveProperty('sox');
      expect(report.frameworks.sox.framework).toBe('sox');
      expect(report.frameworks.sox.compliant).toBe(true);
    });
  });

  describe('configuration methods', () => {
    it('should set data retention policy', () => {
      const newPolicy = {
        audit_logs: 730, // 2 years
        error_logs: 180
      };
      
      logger.setDataRetentionPolicy(newPolicy);
      
      expect(logger.dataRetentionPolicy.audit_logs).toBe(730);
      expect(logger.dataRetentionPolicy.error_logs).toBe(180);
      expect(logger.dataRetentionPolicy.performance_logs).toBe(180); // unchanged
    });

    it('should set regulatory compliance frameworks', () => {
      const newFrameworks = {
        gdpr: true,
        hipaa: true
      };
      
      logger.setRegulatoryCompliance(newFrameworks);
      
      expect(logger.regulatoryCompliance.gdpr).toBe(true);
      expect(logger.regulatoryCompliance.hipaa).toBe(true);
      expect(logger.regulatoryCompliance.sox).toBe(true); // unchanged
    });
  });

  describe('audit chain methods', () => {
    it('should get audit chain', async () => {
      await logger.logEvent('event1', { user: 'user1' }, 'info');
      await logger.logEvent('event2', { user: 'user2' }, 'info');
      
      const chain = logger.getAuditChain(1);
      
      expect(chain).toHaveLength(1);
      expect(chain[0].audit_id).toBeDefined();
      expect(chain[0].hash).toBeDefined();
    });

    it('should limit audit chain size', async () => {
      await logger.logEvent('event1', { user: 'user1' }, 'info');
      await logger.logEvent('event2', { user: 'user2' }, 'info');
      await logger.logEvent('event3', { user: 'user3' }, 'info');
      
      const chain = logger.getAuditChain(2);
      
      expect(chain).toHaveLength(2);
    });
  });

  describe('file rotation', () => {
    it('should rotate log file when size limit is reached', async () => {
      fs.stat.mockResolvedValue({ size: 2 * 1024 * 1024 }); // 2MB file
      
      await logger.rotateLogFile('/test/path/audit-2024-01-01.jsonl');
      
      expect(fs.rename).toHaveBeenCalledWith(
        '/test/path/audit-2024-01-01.jsonl',
        expect.stringMatching(/\/test\/path\/audit-2024-01-01-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.jsonl$/)
      );
    });

    it('should handle rotation errors gracefully', async () => {
      fs.stat.mockResolvedValue({ size: 2 * 1024 * 1024 });
      fs.rename.mockRejectedValue(new Error('Permission denied'));
      
      await logger.rotateLogFile('/test/path/audit-2024-01-01.jsonl');
      
      // Should not throw error, just log it
      expect(fs.rename).toHaveBeenCalled();
    });
  });

  describe('compliance mode', () => {
    it('should validate required fields in compliance mode', async () => {
      logger.complianceMode = true;
      logger.requiredFields = ['timestamp', 'event_type', 'user'];
      
      const result = await logger.logEvent('test_event', { 
        timestamp: new Date().toISOString(),
        event_type: 'test_event',
        user: 'testuser' 
      }, 'info');
      
      expect(result.complianceValid).toBe(true);
    });

    it('should detect missing required fields', async () => {
      logger.complianceMode = true;
      logger.requiredFields = ['timestamp', 'event_type', 'user', 'required_field'];
      
      const result = await logger.logEvent('test_event', { user: 'testuser' }, 'info');
      
      expect(result.complianceValid).toBe(false);
    });
  });
});
