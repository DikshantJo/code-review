const ErrorLogger = require('./error-logger');
const fs = require('fs').promises;
const path = require('path');

// Mock fs.promises
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    appendFile: jest.fn(),
    stat: jest.fn(),
    readdir: jest.fn(),
    readFile: jest.fn(),
    rename: jest.fn(),
    unlink: jest.fn()
  }
}));

describe('ErrorLogger', () => {
  let errorLogger;
  let mockConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig = {
      logging: {
        error_log_dir: './test-logs/errors',
        max_error_log_files: 5,
        max_error_log_size: 1024 * 1024, // 1MB
        error_retention_days: 7
      }
    };
    errorLogger = new ErrorLogger(mockConfig);
  });

  afterEach(async () => {
    // Clean up test files if they exist
    try {
      await fs.rmdir('./test-logs', { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const logger = new ErrorLogger();
      expect(logger.logDir).toBe('./logs/errors');
      expect(logger.maxLogFiles).toBe(10);
      expect(logger.maxLogSize).toBe(10 * 1024 * 1024);
      expect(logger.retentionDays).toBe(30);
    });

    it('should initialize with custom config', () => {
      expect(errorLogger.logDir).toBe('./test-logs/errors');
      expect(errorLogger.maxLogFiles).toBe(5);
      expect(errorLogger.maxLogSize).toBe(1024 * 1024);
      expect(errorLogger.retentionDays).toBe(7);
    });

    it('should initialize error counts and categories', () => {
      expect(errorLogger.errorCounts).toEqual({
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        unknown: 0
      });
      expect(errorLogger.errorCategories).toEqual({
        ai_service: 0,
        github_api: 0,
        configuration: 0,
        file_processing: 0,
        network: 0,
        validation: 0,
        other: 0
      });
    });

    it('should call initializeLogDirectory', () => {
      expect(fs.mkdir).toHaveBeenCalledWith('./test-logs/errors', { recursive: true });
    });
  });

  describe('logError', () => {
    it('should log error with string message', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = await errorLogger.logError('Test error message', {
        repository: 'test-repo',
        branch: 'main'
      }, 'high', 'ai_service');

      expect(result.logged).toBe(true);
      expect(result.severity).toBe('high');
      expect(result.category).toBe('ai_service');
      expect(result.errorId).toMatch(/^err_\d+_[a-z0-9]+$/);
      expect(fs.appendFile).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should log error with Error object', async () => {
      const error = new Error('Test error');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = await errorLogger.logError(error, {
        repository: 'test-repo'
      }, 'critical', 'github_api');

      expect(result.logged).toBe(true);
      expect(result.severity).toBe('critical');
      expect(result.category).toBe('github_api');
      expect(fs.appendFile).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should update error counts and categories', async () => {
      await errorLogger.logError('Test error', {}, 'high', 'ai_service');
      
      expect(errorLogger.errorCounts.high).toBe(1);
      expect(errorLogger.errorCategories.ai_service).toBe(1);
    });

    it('should use default severity and category', async () => {
      const result = await errorLogger.logError('Test error');
      
      expect(result.severity).toBe('medium');
      expect(result.category).toBe('other');
    });

    it('should include context in log entry', async () => {
      const context = {
        repository: 'test-repo',
        branch: 'feature-branch',
        commitSha: 'abc123',
        customField: 'customValue'
      };
      
      await errorLogger.logError('Test error', context);
      
      expect(fs.appendFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('test-repo')
      );
    });
  });

  describe('convenience methods', () => {
    it('should log critical error', async () => {
      const result = await errorLogger.logCriticalError('Critical error', {}, 'ai_service');
      expect(result.severity).toBe('critical');
      expect(result.category).toBe('ai_service');
    });

    it('should log high error', async () => {
      const result = await errorLogger.logHighError('High error', {}, 'github_api');
      expect(result.severity).toBe('high');
      expect(result.category).toBe('github_api');
    });

    it('should log medium error', async () => {
      const result = await errorLogger.logMediumError('Medium error', {}, 'configuration');
      expect(result.severity).toBe('medium');
      expect(result.category).toBe('configuration');
    });

    it('should log low error', async () => {
      const result = await errorLogger.logLowError('Low error', {}, 'validation');
      expect(result.severity).toBe('low');
      expect(result.category).toBe('validation');
    });
  });

  describe('generateErrorReport', () => {
    beforeEach(() => {
      // Mock log files
      fs.readdir.mockResolvedValue(['errors-2024-01-01.jsonl', 'errors-2024-01-02.jsonl']);
      fs.readFile.mockResolvedValue(
        JSON.stringify({
          id: 'err_123',
          timestamp: '2024-01-01T10:00:00.000Z',
          severity: 'high',
          category: 'ai_service',
          message: 'Test error',
          context: { repository: 'test-repo' }
        }) + '\n' +
        JSON.stringify({
          id: 'err_124',
          timestamp: '2024-01-01T11:00:00.000Z',
          severity: 'critical',
          category: 'github_api',
          message: 'Critical error',
          context: { repository: 'test-repo' }
        })
      );
      fs.stat.mockResolvedValue({ mtime: new Date() });
    });

    it('should generate error report', async () => {
      const report = await errorLogger.generateErrorReport();
      
      expect(report.generatedAt).toBeDefined();
      expect(report.period).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.errors).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2024-01-01T09:00:00.000Z');
      const endDate = new Date('2024-01-01T12:00:00.000Z');
      
      const report = await errorLogger.generateErrorReport({
        startDate,
        endDate
      });
      
      expect(report.period.start).toBe(startDate.toISOString());
      expect(report.period.end).toBe(endDate.toISOString());
    });

    it('should filter by severity', async () => {
      const report = await errorLogger.generateErrorReport({
        severity: 'high'
      });
      
      expect(report.errors.every(e => e.severity === 'high')).toBe(true);
    });

    it('should filter by category', async () => {
      const report = await errorLogger.generateErrorReport({
        category: 'ai_service'
      });
      
      expect(report.errors.every(e => e.category === 'ai_service')).toBe(true);
    });

    it('should handle empty log files', async () => {
      fs.readFile.mockResolvedValue('');
      
      const report = await errorLogger.generateErrorReport();
      
      expect(report.errors).toHaveLength(0);
      expect(report.summary.totalErrors).toBe(0);
    });

    it('should handle malformed log entries', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      fs.readFile.mockResolvedValue('invalid json\n');
      
      const report = await errorLogger.generateErrorReport();
      
      expect(report.errors).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to parse log entry:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('generateRecommendations', () => {
    it('should generate recommendations for critical errors', () => {
      const report = {
        summary: { totalErrors: 2 },
        errors: [
          { severity: 'critical', category: 'ai_service' },
          { severity: 'critical', category: 'github_api' }
        ]
      };
      
      const recommendations = errorLogger.generateRecommendations(report);
      
      expect(recommendations).toContainEqual(
        expect.objectContaining({
          priority: 'high',
          type: 'critical_errors',
          message: '2 critical errors detected. Immediate attention required.'
        })
      );
    });

    it('should generate recommendations for AI service issues', () => {
      const report = {
        summary: { totalErrors: 6 },
        errors: Array(6).fill({ severity: 'medium', category: 'ai_service' })
      };
      
      const recommendations = errorLogger.generateRecommendations(report);
      
      expect(recommendations).toContainEqual(
        expect.objectContaining({
          priority: 'medium',
          type: 'ai_service_issues',
          message: '6 AI service errors detected.'
        })
      );
    });

    it('should generate recommendations for GitHub API issues', () => {
      const report = {
        summary: { totalErrors: 4 },
        errors: Array(4).fill({ severity: 'medium', category: 'github_api' })
      };
      
      const recommendations = errorLogger.generateRecommendations(report);
      
      expect(recommendations).toContainEqual(
        expect.objectContaining({
          priority: 'medium',
          type: 'github_api_issues',
          message: '4 GitHub API errors detected.'
        })
      );
    });

    it('should generate recommendations for high error volume', () => {
      const report = {
        summary: { totalErrors: 25 },
        errors: Array(25).fill({ severity: 'low' })
      };
      
      const recommendations = errorLogger.generateRecommendations(report);
      
      expect(recommendations).toContainEqual(
        expect.objectContaining({
          priority: 'low',
          type: 'high_error_volume',
          message: 'High error volume (25 errors) detected.'
        })
      );
    });
  });

  describe('getErrorStats', () => {
    it('should return current error statistics', async () => {
      await errorLogger.logError('Error 1', {}, 'high', 'ai_service');
      await errorLogger.logError('Error 2', {}, 'critical', 'github_api');
      await errorLogger.logError('Error 3', {}, 'medium', 'configuration');
      
      const stats = errorLogger.getErrorStats();
      
      expect(stats.counts.high).toBe(1);
      expect(stats.counts.critical).toBe(1);
      expect(stats.counts.medium).toBe(1);
      expect(stats.categories.ai_service).toBe(1);
      expect(stats.categories.github_api).toBe(1);
      expect(stats.categories.configuration).toBe(1);
      expect(stats.totalErrors).toBe(3);
    });
  });

  describe('clearStats', () => {
    it('should clear error statistics', async () => {
      await errorLogger.logError('Error 1', {}, 'high', 'ai_service');
      await errorLogger.logError('Error 2', {}, 'critical', 'github_api');
      
      errorLogger.clearStats();
      
      const stats = errorLogger.getErrorStats();
      expect(stats.totalErrors).toBe(0);
      expect(stats.counts.high).toBe(0);
      expect(stats.counts.critical).toBe(0);
      expect(stats.categories.ai_service).toBe(0);
      expect(stats.categories.github_api).toBe(0);
    });
  });

  describe('file rotation and cleanup', () => {
    it('should rotate log file when size exceeds limit', async () => {
      fs.stat.mockResolvedValue({ size: 2 * 1024 * 1024 }); // 2MB
      
      await errorLogger.rotateLogFileIfNeeded('/test/path/errors-2024-01-01.jsonl');
      
      expect(fs.rename).toHaveBeenCalled();
      expect(fs.readdir).toHaveBeenCalled();
    });

    it('should not rotate log file when size is within limit', async () => {
      fs.stat.mockResolvedValue({ size: 512 * 1024 }); // 512KB
      
      await errorLogger.rotateLogFileIfNeeded('/test/path/errors-2024-01-01.jsonl');
      
      expect(fs.rename).not.toHaveBeenCalled();
    });

    it('should cleanup old log files', async () => {
      fs.readdir.mockResolvedValue([
        'errors-2024-01-01.jsonl',
        'errors-2024-01-02.jsonl',
        'errors-2024-01-03.jsonl',
        'errors-2024-01-04.jsonl',
        'errors-2024-01-05.jsonl',
        'errors-2024-01-06.jsonl'
      ]);
      fs.stat.mockResolvedValue({ mtime: new Date() });
      
      await errorLogger.cleanupOldLogFiles();
      
      expect(fs.unlink).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle fs.mkdir failure gracefully', () => {
      fs.mkdir.mockRejectedValue(new Error('Permission denied'));
      
      expect(() => new ErrorLogger(mockConfig)).not.toThrow();
    });

    it('should handle fs.appendFile failure gracefully', async () => {
      fs.appendFile.mockRejectedValue(new Error('Disk full'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = await errorLogger.logError('Test error');
      
      expect(result.logged).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to write error to log file:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('should handle fs.readdir failure in report generation', async () => {
      fs.readdir.mockRejectedValue(new Error('Directory not found'));
      
      await expect(errorLogger.generateErrorReport()).rejects.toThrow('Directory not found');
    });
  });
});
