const AuditLogger = require('../../src/utils/logger');

describe('Verbose Logging for Development Environments', () => {
  let logger;
  let config;

  beforeEach(() => {
    // Default config with verbose logging enabled
    config = {
      logging: {
        log_level: 'trace',
        debug_mode: true,
        verbose_logging: true,
        enable_console_logging: true,
        enable_file_logging: false
      }
    };
    
    logger = new AuditLogger(config);
  });

  describe('Verbose Logging Configuration', () => {
    test('should initialize with verbose logging enabled', () => {
      expect(logger.verboseLogging).toBe(true);
      expect(logger.debugMode).toBe(true);
      expect(logger.logLevel).toBe('trace');
    });

    test('should enable verbose logging mode', () => {
      logger.verboseLogging = false;
      logger.debugMode = false;
      logger.logLevel = 'info';
      
      logger.enableVerboseLogging(true, { enhancedContext: true });
      
      expect(logger.verboseLogging).toBe(true);
      expect(logger.debugMode).toBe(true);
      expect(logger.logLevel).toBe('trace');
    });

    test('should disable verbose logging mode', () => {
      logger.enableVerboseLogging(false);
      
      expect(logger.verboseLogging).toBe(false);
    });
  });

  describe('Verbose Logging Methods', () => {
    test('should provide verbose debug logging', async () => {
      const result = await logger.verboseDebug('test_verbose_debug', { data: 'test' }, { category: 'test' });
      
      expect(result.logged).toBe(true);
      expect(result.level).toBe('debug');
      expect(result.eventType).toBe('test_verbose_debug');
    });

    test('should provide verbose trace logging', async () => {
      const result = await logger.verboseTrace('test_verbose_trace', { data: 'test' }, { category: 'test' });
      
      expect(result.logged).toBe(true);
      expect(result.level).toBe('trace');
      expect(result.eventType).toBe('test_verbose_trace');
    });

    test('should provide verbose info logging', async () => {
      const result = await logger.verboseInfo('test_verbose_info', { data: 'test' }, { category: 'test' });
      
      expect(result.logged).toBe(true);
      expect(result.level).toBe('info');
      expect(result.eventType).toBe('test_verbose_info');
    });

    test('should provide verbose warn logging', async () => {
      const result = await logger.verboseWarn('test_verbose_warn', { data: 'test' }, { category: 'test' });
      
      expect(result.logged).toBe(true);
      expect(result.level).toBe('warn');
      expect(result.eventType).toBe('test_verbose_warn');
    });

    test('should provide verbose error logging', async () => {
      const result = await logger.verboseError('test_verbose_error', { data: 'test' }, { category: 'test' });
      
      expect(result.logged).toBe(true);
      expect(result.level).toBe('error');
      expect(result.eventType).toBe('test_verbose_error');
    });
  });

  describe('Verbose Logging Context Enhancement', () => {
    test('should enhance context with verbose information', async () => {
      const result = await logger.verboseDebug('test_context_enhancement', { data: 'test' }, { category: 'test' });
      
      expect(result.logged).toBe(true);
      expect(result.context.verbose).toBe(true);
      expect(result.context.processId).toBeDefined();
      expect(result.context.memoryUsage).toBeDefined();
      expect(result.context.uptime).toBeDefined();
      expect(result.context.nodeVersion).toBeDefined();
      expect(result.context.platform).toBeDefined();
      expect(result.context.arch).toBeDefined();
    });

    test('should enhance data with verbose information', async () => {
      const result = await logger.verboseDebug('test_data_enhancement', { data: 'test' }, { category: 'test' });
      
      expect(result.logged).toBe(true);
      expect(result.data._verbose).toBeDefined();
      expect(result.data._verbose.callStack).toBeDefined();
      expect(result.data._verbose.functionName).toBeDefined();
      expect(result.data._verbose.lineNumber).toBeDefined();
      expect(result.data._verbose.fileName).toBeDefined();
      expect(result.data._verbose.executionTime).toBeDefined();
      expect(result.data._verbose.memorySnapshot).toBeDefined();
    });
  });

  describe('Utility Methods for Verbose Logging', () => {
    test('should get call stack information', () => {
      const callStack = logger.getCallStack();
      
      expect(Array.isArray(callStack)).toBe(true);
      expect(callStack.length).toBeGreaterThan(0);
      expect(callStack.every(frame => typeof frame === 'string')).toBe(true);
    });

    test('should get caller function name', () => {
      const functionName = logger.getCallerFunctionName();
      
      expect(typeof functionName).toBe('string');
      expect(functionName).not.toBe('unknown');
    });

    test('should get caller line number', () => {
      const lineNumber = logger.getCallerLineNumber();
      
      expect(typeof lineNumber).toBe('string');
      expect(lineNumber).not.toBe('unknown');
    });

    test('should get caller file name', () => {
      const fileName = logger.getCallerFileName();
      
      expect(typeof fileName).toBe('string');
      expect(fileName).not.toBe('unknown');
    });

    test('should get memory snapshot', () => {
      const memorySnapshot = logger.getMemorySnapshot();
      
      expect(typeof memorySnapshot).toBe('object');
      expect(memorySnapshot.rss).toBeDefined();
      expect(memorySnapshot.heapTotal).toBeDefined();
      expect(memorySnapshot.heapUsed).toBeDefined();
      expect(memorySnapshot.external).toBeDefined();
    });

    test('should format bytes correctly', () => {
      expect(logger.formatBytes(0)).toBe('0 Bytes');
      expect(logger.formatBytes(1024)).toBe('1 KB');
      expect(logger.formatBytes(1024 * 1024)).toBe('1 MB');
      expect(logger.formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });
  });

  describe('Verbose Logging Fallback', () => {
    test('should fall back to regular logging when verbose is disabled', async () => {
      logger.verboseLogging = false;
      
      const result = await logger.verboseDebug('test_fallback', { data: 'test' }, { category: 'test' });
      
      expect(result.logged).toBe(true);
      expect(result.level).toBe('debug');
      expect(result.eventType).toBe('test_fallback');
      // Should not have verbose enhancements
      expect(result.context.verbose).toBeUndefined();
      expect(result.data._verbose).toBeUndefined();
    });
  });

  describe('Verbose Logging Configuration', () => {
    test('should get verbose logging configuration', () => {
      const verboseConfig = logger.getVerboseConfig();
      
      expect(verboseConfig).toHaveProperty('verboseLogging');
      expect(verboseConfig).toHaveProperty('debugMode');
      expect(verboseConfig).toHaveProperty('logLevel');
      expect(verboseConfig).toHaveProperty('debugCategories');
      expect(verboseConfig).toHaveProperty('debugFilters');
      expect(verboseConfig).toHaveProperty('enableConsole');
      expect(verboseConfig).toHaveProperty('enableFileLogging');
    });

    test('should test verbose logging functionality', () => {
      const testResults = logger.testVerboseLogging();
      
      expect(testResults).toHaveProperty('verboseLogging');
      expect(testResults).toHaveProperty('debugMode');
      expect(testResults).toHaveProperty('logLevel');
      expect(testResults).toHaveProperty('tests');
      expect(testResults.tests).toHaveProperty('verboseMethods');
      expect(testResults.tests).toHaveProperty('utilityMethods');
    });
  });

  describe('Verbose Logging with Options', () => {
    test('should accept verbose options', async () => {
      const verboseOptions = {
        enhancedContext: true,
        includeMemory: true,
        includeStack: true,
        customField: 'custom_value'
      };
      
      const result = await logger.verboseDebug(
        'test_with_options', 
        { data: 'test' }, 
        { category: 'test' }, 
        verboseOptions
      );
      
      expect(result.logged).toBe(true);
      expect(result.context.enhancedContext).toBe(true);
      expect(result.context.includeMemory).toBe(true);
      expect(result.context.includeStack).toBe(true);
      expect(result.context.customField).toBe('custom_value');
    });
  });

  describe('Verbose Logging Performance', () => {
    test('should handle verbose logging without performance impact', async () => {
      const startTime = Date.now();
      
      const result = await logger.verboseDebug('test_performance', { data: 'test' }, { category: 'test' });
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      expect(result.logged).toBe(true);
      expect(executionTime).toBeLessThan(100); // Should complete within 100ms
    });
  });

  describe('Verbose Logging Error Handling', () => {
    test('should handle errors in utility methods gracefully', () => {
      // Mock process.memoryUsage to throw an error
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = () => { throw new Error('Memory error'); };
      
      const memorySnapshot = logger.getMemorySnapshot();
      
      expect(memorySnapshot.error).toBe('Unable to capture memory snapshot');
      
      // Restore original method
      process.memoryUsage = originalMemoryUsage;
    });

    test('should handle errors in call stack capture gracefully', () => {
      // Mock Error.stack to be undefined
      const originalError = global.Error;
      global.Error = class MockError {
        get stack() { return undefined; }
      };
      
      const callStack = logger.getCallStack();
      
      expect(callStack).toEqual(['Unable to capture call stack']);
      
      // Restore original Error
      global.Error = originalError;
    });
  });

  describe('Log Filtering and Search Capabilities', () => {
    test('should search logs by various criteria', async () => {
      // Mock file system for testing
      const mockFiles = ['audit-2024-01-01.jsonl', 'audit-2024-01-02.jsonl'];
      const mockContent = JSON.stringify({
        timestamp: '2024-01-01T10:00:00Z',
        event_type: 'test_event',
        level: 'info',
        context: {
          repository: 'test/repo',
          user: 'testuser',
          branch: 'main'
        }
      }) + '\n';
      
      // Mock fs.readdir and fs.readFile
      const originalReaddir = require('fs').promises.readdir;
      const originalReadFile = require('fs').promises.readFile;
      
      require('fs').promises.readdir = jest.fn().mockResolvedValue(mockFiles);
      require('fs').promises.readFile = jest.fn().mockResolvedValue(mockContent);
      
      const results = await logger.searchLogs({
        eventType: 'test_event',
        level: 'info',
        repository: 'test/repo'
      });
      
      expect(results).toHaveLength(2);
      expect(results[0].event_type).toBe('test_event');
      expect(results[0].level).toBe('info');
      
      // Restore original methods
      require('fs').promises.readdir = originalReaddir;
      require('fs').promises.readFile = originalReadFile;
    });

    test('should filter logs with include/exclude criteria', async () => {
      const mockFiles = ['audit-2024-01-01.jsonl'];
      const mockContent = JSON.stringify({
        timestamp: '2024-01-01T10:00:00Z',
        event_type: 'include_event',
        level: 'info',
        context: { category: 'test' }
      }) + '\n';
      
      const originalReaddir = require('fs').promises.readdir;
      const originalReadFile = require('fs').promises.readFile;
      
      require('fs').promises.readdir = jest.fn().mockResolvedValue(mockFiles);
      require('fs').promises.readFile = jest.fn().mockResolvedValue(mockContent);
      
      const results = await logger.filterLogs({
        include: { event_type: ['include_event'] },
        exclude: { level: ['error'] }
      });
      
      expect(results).toHaveLength(1);
      expect(results[0].event_type).toBe('include_event');
      
      require('fs').promises.readdir = originalReaddir;
      require('fs').promises.readFile = originalReadFile;
    });

    test('should create search index for faster searching', async () => {
      const mockFiles = ['audit-2024-01-01.jsonl'];
      const mockContent = JSON.stringify({
        timestamp: '2024-01-01T10:00:00Z',
        event_type: 'indexed_event',
        level: 'info',
        context: { repository: 'test/repo' }
      }) + '\n';
      
      const originalReaddir = require('fs').promises.readdir;
      const originalReadFile = require('fs').promises.readFile;
      const originalWriteFile = require('fs').promises.writeFile;
      const originalStat = require('fs').promises.stat;
      
      require('fs').promises.readdir = jest.fn().mockResolvedValue(mockFiles);
      require('fs').promises.readFile = jest.fn().mockResolvedValue(mockContent);
      require('fs').promises.writeFile = jest.fn().mockResolvedValue();
      require('fs').promises.stat = jest.fn().mockRejectedValue(new Error('File not found'));
      
      const index = await logger.createSearchIndex({ rebuild: true });
      
      expect(index).toBeDefined();
      expect(index.fields).toContain('event_type');
      expect(index.entries).toBeDefined();
      
      require('fs').promises.readdir = originalReaddir;
      require('fs').promises.readFile = originalReadFile;
      require('fs').promises.writeFile = originalWriteFile;
      require('fs').promises.stat = originalStat;
    });

    test('should search logs using index for better performance', async () => {
      const mockIndex = {
        fields: ['event_type', 'level'],
        entries: {
          'indexed_event': ['audit-2024-01-01.jsonl:0'],
          'info': ['audit-2024-01-01.jsonl:0']
        },
        fieldValues: {
          'event_type': ['indexed_event'],
          'level': ['info']
        }
      };
      
      const mockContent = JSON.stringify({
        timestamp: '2024-01-01T10:00:00Z',
        event_type: 'indexed_event',
        level: 'info'
      });
      
      const originalReadFile = require('fs').promises.readFile;
      require('fs').promises.readFile = jest.fn().mockResolvedValue(mockContent);
      
      const results = await logger.searchLogsWithIndex({
        eventType: 'indexed_event'
      }, mockIndex);
      
      expect(results).toHaveLength(1);
      expect(results[0].event_type).toBe('indexed_event');
      
      require('fs').promises.readFile = originalReadFile;
    });

    test('should generate log statistics and analytics', async () => {
      const mockFiles = ['audit-2024-01-01.jsonl'];
      const mockContent = JSON.stringify({
        timestamp: '2024-01-01T10:00:00Z',
        event_type: 'stats_event',
        level: 'info',
        context: { repository: 'test/repo', user: 'testuser' }
      }) + '\n';
      
      const originalReaddir = require('fs').promises.readdir;
      const originalReadFile = require('fs').promises.readFile;
      
      require('fs').promises.readdir = jest.fn().mockResolvedValue(mockFiles);
      require('fs').promises.readFile = jest.fn().mockResolvedValue(mockContent);
      
      const stats = await logger.getLogStatistics({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-02'),
        groupBy: 'day'
      });
      
      expect(stats).toBeDefined();
      expect(stats.totalEntries).toBe(1);
      expect(stats.byEventType['stats_event']).toBe(1);
      expect(stats.byLevel['info']).toBe(1);
      expect(stats.topEvents).toHaveLength(1);
      
      require('fs').promises.readdir = originalReaddir;
      require('fs').promises.readFile = originalReadFile;
    });

    test('should handle nested value extraction with dot notation', () => {
      const testObj = {
        level1: {
          level2: {
            level3: 'test_value'
          }
        }
      };
      
      const value = logger.getNestedValue(testObj, 'level1.level2.level3');
      expect(value).toBe('test_value');
      
      const undefinedValue = logger.getNestedValue(testObj, 'level1.nonexistent');
      expect(undefinedValue).toBeUndefined();
    });

    test('should generate time group keys for different grouping strategies', () => {
      const testDate = new Date('2024-01-15T14:30:00Z');
      
      const hourKey = logger.getTimeGroupKey(testDate, 'hour');
      expect(hourKey).toBe('2024-01-15T14');
      
      const dayKey = logger.getTimeGroupKey(testDate, 'day');
      expect(dayKey).toBe('2024-01-15');
      
      const monthKey = logger.getTimeGroupKey(testDate, 'month');
      expect(monthKey).toBe('2024-01');
    });
  });
});
