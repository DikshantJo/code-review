const EmailNotifier = require('./email-notifier');

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransporter: jest.fn()
}));

const nodemailer = require('nodemailer');

describe('EmailNotifier', () => {
  let mockTransporter;
  let emailNotifier;
  let config;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock transporter
    mockTransporter = {
      sendMail: jest.fn()
    };
    
    nodemailer.createTransporter.mockReturnValue(mockTransporter);
    
    // Default config
    config = {
      repository: 'test-repo',
      notifications: {
        email: {
          enabled: true,
          smtp_host: 'smtp.example.com',
          smtp_user: 'test@example.com',
          smtp_pass: 'password123',
          smtp_port: 587,
          smtp_secure: false,
          from_email: 'ai-review@github.com',
          to_emails: ['team@example.com', 'lead@example.com']
        }
      }
    };
  });

  describe('constructor', () => {
    test('should initialize with enabled email notifications', () => {
      emailNotifier = new EmailNotifier(config);
      
      expect(emailNotifier.isEnabled).toBe(true);
      expect(emailNotifier.transporter).toBe(mockTransporter);
      expect(nodemailer.createTransporter).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@example.com',
          pass: 'password123'
        }
      });
    });

    test('should not initialize transporter when email is disabled', () => {
      config.notifications.email.enabled = false;
      emailNotifier = new EmailNotifier(config);
      
      expect(emailNotifier.isEnabled).toBe(false);
      expect(emailNotifier.transporter).toBeNull();
      expect(nodemailer.createTransporter).not.toHaveBeenCalled();
    });

    test('should throw error when SMTP config is incomplete', () => {
      delete config.notifications.email.smtp_host;
      
      expect(() => new EmailNotifier(config)).toThrow(
        'SMTP configuration incomplete. Required: smtp_host, smtp_user, smtp_pass'
      );
    });

    test('should use default values for optional SMTP settings', () => {
      delete config.notifications.email.smtp_port;
      delete config.notifications.email.smtp_secure;
      
      emailNotifier = new EmailNotifier(config);
      
      expect(nodemailer.createTransporter).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@example.com',
          pass: 'password123'
        }
      });
    });
  });

  describe('sendServiceDowntimeNotification', () => {
    beforeEach(() => {
      emailNotifier = new EmailNotifier(config);
    });

    test('should send downtime notification successfully', async () => {
      const context = {
        repository: 'test-repo',
        sourceBranch: 'feature-branch',
        targetBranch: 'main',
        commitSha: 'abc123',
        author: 'test@example.com'
      };
      
      const error = new Error('API timeout');
      error.name = 'TimeoutError';
      
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-message-id'
      });

      const result = await emailNotifier.sendServiceDowntimeNotification(context, error);

      expect(result.sent).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(result.type).toBe('downtime');
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'ai-review@github.com',
        to: 'team@example.com, lead@example.com',
        subject: '[AI Code Review] Service Downtime Alert - test-repo',
        html: expect.stringContaining('🚨 AI Code Review Service Downtime Alert'),
        headers: {
          'X-Email-Type': 'downtime',
          'X-Repository': 'test-repo'
        }
      });
    });

    test('should skip notification when email is disabled', async () => {
      config.notifications.email.enabled = false;
      emailNotifier = new EmailNotifier(config);
      
      const context = { repository: 'test-repo' };
      const error = new Error('API timeout');
      
      const result = await emailNotifier.sendServiceDowntimeNotification(context, error);
      
      expect(result.sent).toBe(false);
      expect(result.reason).toBe('disabled');
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });

    test('should handle email send failure', async () => {
      const context = { repository: 'test-repo' };
      const error = new Error('API timeout');
      
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP error'));

      const result = await emailNotifier.sendServiceDowntimeNotification(context, error);

      expect(result.sent).toBe(false);
      expect(result.error).toBe('SMTP error');
      expect(result.type).toBe('downtime');
    });
  });

  describe('sendReviewFailureNotification', () => {
    beforeEach(() => {
      emailNotifier = new EmailNotifier(config);
    });

    test('should send review failure notification successfully', async () => {
      const context = {
        repository: 'test-repo',
        sourceBranch: 'feature-branch',
        targetBranch: 'main',
        commitSha: 'abc123',
        author: 'test@example.com'
      };
      
      const reviewResult = {
        issues: [
          {
            severity: 'HIGH',
            category: 'Security',
            file: 'src/auth.js',
            line: 15,
            description: 'Potential SQL injection',
            recommendation: 'Use parameterized queries'
          },
          {
            severity: 'MEDIUM',
            category: 'Standards',
            file: 'src/utils.js',
            line: 42,
            description: 'Missing JSDoc comment',
            recommendation: 'Add function documentation'
          }
        ]
      };
      
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-message-id'
      });

      const result = await emailNotifier.sendReviewFailureNotification(context, reviewResult);

      expect(result.sent).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(result.type).toBe('review_failure');
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'ai-review@github.com',
        to: 'team@example.com, lead@example.com',
        subject: '[AI Code Review] Review Failed - test-repo (main)',
        html: expect.stringContaining('⚠️ AI Code Review Failed'),
        headers: {
          'X-Email-Type': 'review_failure',
          'X-Repository': 'test-repo'
        }
      });
    });

    test('should handle review result without issues', async () => {
      const context = { repository: 'test-repo', targetBranch: 'main' };
      const reviewResult = { issues: [] };
      
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-message-id'
      });

      const result = await emailNotifier.sendReviewFailureNotification(context, reviewResult);

      expect(result.sent).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: '[AI Code Review] Review Failed - test-repo (main)',
          to: 'team@example.com, lead@example.com'
        })
      );
    });
  });

  describe('sendOverrideNotification', () => {
    beforeEach(() => {
      emailNotifier = new EmailNotifier(config);
    });

    test('should send override notification successfully', async () => {
      const context = {
        repository: 'test-repo',
        sourceBranch: 'feature-branch',
        targetBranch: 'main',
        commitSha: 'abc123',
        author: 'test@example.com'
      };
      
      const overrideInfo = {
        type: 'URGENT',
        count: 1,
        highSeverityCount: 2,
        mediumSeverityCount: 1,
        totalIssues: 3,
        commitMessage: 'URGENT: Fix critical production bug',
        keyword: 'URGENT',
        reason: 'Emergency production fix'
      };
      
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-message-id'
      });

      const result = await emailNotifier.sendOverrideNotification(context, overrideInfo);

      expect(result.sent).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(result.type).toBe('override');
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'ai-review@github.com',
        to: 'team@example.com, lead@example.com',
        subject: '[AI Code Review] Quality Gate Override - test-repo (main)',
        html: expect.stringContaining('🚨 Quality Gate Override Used'),
        headers: {
          'X-Email-Type': 'override',
          'X-Repository': 'test-repo'
        }
      });
    });
  });

  describe('sendEmail', () => {
    beforeEach(() => {
      emailNotifier = new EmailNotifier(config);
    });

    test('should send generic email successfully', async () => {
      const subject = 'Test Subject';
      const body = '<h1>Test Body</h1>';
      
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-message-id'
      });

      const result = await emailNotifier.sendEmail(subject, body, 'test');

      expect(result.sent).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(result.type).toBe('test');
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'ai-review@github.com',
        to: 'team@example.com, lead@example.com',
        subject: 'Test Subject',
        html: '<h1>Test Body</h1>',
        headers: {
          'X-Email-Type': 'test',
          'X-Repository': 'test-repo'
        }
      });
    });

    test('should throw error when transporter is not initialized', async () => {
      emailNotifier.transporter = null;
      
      const result = await emailNotifier.sendEmail('Test', 'Test', 'test');
      
      expect(result.sent).toBe(false);
      expect(result.error).toBe('Email transporter not initialized');
    });

    test('should handle transporter send failure', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('Network error'));

      const result = await emailNotifier.sendEmail('Test', 'Test', 'test');

      expect(result.sent).toBe(false);
      expect(result.error).toBe('Network error');
      expect(result.type).toBe('test');
    });
  });

  describe('testConfiguration', () => {
    beforeEach(() => {
      emailNotifier = new EmailNotifier(config);
    });

    test('should test email configuration successfully', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-message-id'
      });

      const result = await emailNotifier.testConfiguration();

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: '[AI Code Review] Configuration Test',
          html: expect.stringContaining('Email Configuration Test')
        })
      );
    });

    test('should return error when email is disabled', async () => {
      config.notifications.email.enabled = false;
      emailNotifier = new EmailNotifier(config);
      
      const result = await emailNotifier.testConfiguration();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Email notifications are disabled');
    });

    test('should handle test email failure', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP error'));

      const result = await emailNotifier.testConfiguration();

      expect(result.success).toBe(false);
      expect(result.error).toBe('SMTP error');
    });
  });

  describe('getStatus', () => {
    test('should return status when email is enabled', () => {
      emailNotifier = new EmailNotifier(config);
      
      const status = emailNotifier.getStatus();
      
      expect(status).toEqual({
        enabled: true,
        configured: true,
        smtpHost: 'smtp.example.com',
        recipientCount: 2
      });
    });

    test('should return status when email is disabled', () => {
      config.notifications.email.enabled = false;
      emailNotifier = new EmailNotifier(config);
      
      const status = emailNotifier.getStatus();
      
      expect(status).toEqual({
        enabled: false,
        configured: false,
        smtpHost: null,
        recipientCount: 0
      });
    });
  });

  describe('email formatting', () => {
    beforeEach(() => {
      emailNotifier = new EmailNotifier(config);
    });

    test('should format downtime email with error details', () => {
      const context = {
        repository: 'test-repo',
        sourceBranch: 'feature',
        targetBranch: 'main',
        commitSha: 'abc123',
        author: 'test@example.com'
      };
      
      const error = new Error('API timeout');
      error.name = 'TimeoutError';
      error.stack = 'Error: API timeout\n    at test.js:1:1';
      
      const body = emailNotifier.formatDowntimeEmail(context, error, { retryCount: 2, maxRetries: 3 });
      
      expect(body).toContain('🚨 AI Code Review Service Downtime Alert');
      expect(body).toContain('test-repo');
      expect(body).toContain('feature → main');
      expect(body).toContain('abc123');
      expect(body).toContain('test@example.com');
      expect(body).toContain('TimeoutError');
      expect(body).toContain('API timeout');
      expect(body).toContain('2/3');
      expect(body).toContain('Error: API timeout');
    });

    test('should format review failure email with issues', () => {
      const context = {
        repository: 'test-repo',
        sourceBranch: 'feature',
        targetBranch: 'main',
        commitSha: 'abc123',
        author: 'test@example.com'
      };
      
      const reviewResult = {
        issues: [
          {
            severity: 'HIGH',
            category: 'Security',
            file: 'src/auth.js',
            line: 15,
            description: 'SQL injection risk',
            recommendation: 'Use prepared statements'
          }
        ]
      };
      
      const body = emailNotifier.formatReviewFailureEmail(context, reviewResult);
      
      expect(body).toContain('⚠️ AI Code Review Failed');
      expect(body).toContain('test-repo');
      expect(body).toContain('feature → main');
      expect(body).toContain('⚠️ AI Code Review Failed');
      expect(body).toContain('test-repo');
      expect(body).toContain('feature → main');
      expect(body).toContain('abc123');
      expect(body).toContain('test@example.com');
    });

    test('should format override email with override details', () => {
      const context = {
        repository: 'test-repo',
        sourceBranch: 'feature',
        targetBranch: 'main',
        commitSha: 'abc123',
        author: 'test@example.com'
      };
      
      const overrideInfo = {
        type: 'URGENT',
        count: 1,
        highSeverityCount: 2,
        mediumSeverityCount: 1,
        totalIssues: 3,
        commitMessage: 'URGENT: Fix critical bug',
        keyword: 'URGENT',
        reason: 'Emergency fix'
      };
      
      const body = emailNotifier.formatOverrideEmail(context, overrideInfo);
      
      expect(body).toContain('🚨 Quality Gate Override Used');
      expect(body).toContain('test-repo');
      expect(body).toContain('feature → main');
      expect(body).toContain('URGENT');
      expect(body).toContain('1');
      expect(body).toContain('🚨 Quality Gate Override Used');
      expect(body).toContain('test-repo');
      expect(body).toContain('feature → main');
      expect(body).toContain('abc123');
      expect(body).toContain('test@example.com');
    });
  });
});
