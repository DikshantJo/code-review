const AuditLogger = require('../../src/utils/logger');

describe('Debug Logging Configuration', () => {
  let logger;
  let config;

  beforeEach(() => {
    // Default config without debug settings
    config = {
      logging: {
        log_level: 'info',
        enable_console_logging: true,
        enable_file_logging: false
      }
    };
    
    logger = new AuditLogger(config);
  });

  describe('Constructor and Default Values', () => {
    test('should initialize with default debug configuration', () => {
      expect(logger.debugMode).toBe(false);
      expect(logger.verboseLogging).toBe(false);
      expect(logger.debugCategories).toEqual(['all']);
      expect(logger.debugFilters).toEqual([]);
      expect(logger.logLevel).toBe('info');
    });

    test('should initialize with custom debug configuration', () => {
      const debugConfig = {
        logging: {
          log_level: 'debug',
          debug_mode: true,
          verbose_logging: true,
          debug_categories: ['ai-review', 'file-detection'],
          debug_filters: [
            { type: 'exclude', pattern: 'sensitive' }
          ]
        }
      };
      
      const debugLogger = new AuditLogger(debugConfig);
      
      expect(debugLogger.debugMode).toBe(true);
      expect(debugLogger.verboseLogging).toBe(true);
      expect(debugLogger.debugCategories).toEqual(['ai-review', 'file-detection']);
      expect(debugLogger.debugFilters).toHaveLength(1);
      expect(debugLogger.logLevel).toBe('debug');
    });
  });

  describe('shouldLog Method', () => {
    test('should respect log level hierarchy', () => {
      // With log level 'info'
      expect(logger.shouldLog('error')).toBe(true);
      expect(logger.shouldLog('warn')).toBe(true);
      expect(logger.shouldLog('info')).toBe(true);
      expect(logger.shouldLog('debug')).toBe(false);
      expect(logger.shouldLog('trace')).toBe(false);
    });

    test('should debug the shouldLog method', () => {
      // Test basic properties
      console.log('=== DEBUG TEST ===');
      console.log('Initial debugMode:', logger.debugMode);
      console.log('Initial logLevel:', logger.logLevel);
      console.log('Initial debugCategories:', logger.debugCategories);
      
      // Test shouldLog with different levels
      console.log('shouldLog("error"):', logger.shouldLog('error'));
      console.log('shouldLog("warn"):', logger.shouldLog('warn'));
      console.log('shouldLog("info"):', logger.shouldLog('info'));
      console.log('shouldLog("debug"):', logger.shouldLog('debug'));
      console.log('shouldLog("trace"):', logger.shouldLog('trace'));
      
      // Change properties
      logger.debugMode = true;
      logger.logLevel = 'debug';
      
      console.log('After change - debugMode:', logger.debugMode);
      console.log('After change - logLevel:', logger.logLevel);
      console.log('After change - shouldLog("debug"):', logger.shouldLog('debug'));
      console.log('After change - shouldLog("trace"):', logger.shouldLog('trace'));
      
      // This should pass now
      expect(logger.shouldLog('debug')).toBe(true);
      expect(logger.shouldLog('trace')).toBe(true);
    });

    test('should allow debug logging when debug mode is enabled', () => {
      logger.debugMode = true;
      logger.logLevel = 'debug';
      
      console.log('Debug mode:', logger.debugMode);
      console.log('Log level:', logger.logLevel);
      console.log('Should log debug:', logger.shouldLog('debug'));
      console.log('Should log trace:', logger.shouldLog('trace'));
      
      expect(logger.shouldLog('debug')).toBe(true);
      expect(logger.shouldLog('trace')).toBe(true);
    });

    test('should block debug logging when debug mode is disabled', () => {
      logger.debugMode = false;
      logger.logLevel = 'debug';
      
      expect(logger.shouldLog('debug')).toBe(false);
      expect(logger.shouldLog('trace')).toBe(false);
    });

    test('should respect debug categories', () => {
      logger.debugMode = true;
      logger.debugCategories = ['ai-review', 'file-detection'];
      
      expect(logger.shouldLog('debug', 'ai-review')).toBe(true);
      expect(logger.shouldLog('debug', 'file-detection')).toBe(true);
      expect(logger.shouldLog('debug', 'github-api')).toBe(false);
    });

    test('should allow all categories when debug_categories is ["all"]', () => {
      logger.debugMode = true;
      logger.debugCategories = ['all'];
      
      expect(logger.shouldLog('debug', 'ai-review')).toBe(true);
      expect(logger.shouldLog('debug', 'file-detection')).toBe(true);
      expect(logger.shouldLog('debug', 'github-api')).toBe(true);
      expect(logger.shouldLog('debug', 'unknown-category')).toBe(true);
    });

    test('should respect debug filters', () => {
      logger.debugMode = true;
      logger.debugFilters = [
        { type: 'exclude', pattern: 'sensitive' },
        { type: 'include', pattern: 'ai-review|file-detection' }
      ];
      
      expect(logger.shouldLog('debug', 'ai-review')).toBe(true);
      expect(logger.shouldLog('debug', 'file-detection')).toBe(true);
      expect(logger.shouldLog('debug', 'sensitive-data')).toBe(false);
      expect(logger.shouldLog('debug', 'github-api')).toBe(false);
    });
  });

  describe('Debug Configuration Methods', () => {
    test('should configure debug logging', () => {
      const debugConfig = {
        debug_mode: true,
        verbose_logging: true,
        debug_categories: ['ai-review'],
        log_level: 'debug'
      };
      
      logger.configureDebugLogging(debugConfig);
      
      expect(logger.debugMode).toBe(true);
      expect(logger.verboseLogging).toBe(true);
      expect(logger.debugCategories).toEqual(['ai-review']);
      expect(logger.logLevel).toBe('debug');
    });

    test('should enable debug mode', () => {
      logger.enableDebugMode(['ai-review', 'file-detection']);
      
      expect(logger.debugMode).toBe(true);
      expect(logger.debugCategories).toEqual(['ai-review', 'file-detection']);
      expect(logger.logLevel).toBe('debug');
    });

    test('should disable debug mode', () => {
      logger.debugMode = true;
      logger.logLevel = 'debug';
      
      logger.disableDebugMode();
      
      expect(logger.debugMode).toBe(false);
      expect(logger.logLevel).toBe('info');
    });

    test('should add debug category', () => {
      logger.addDebugCategory('ai-review');
      
      expect(logger.debugCategories).toContain('ai-review');
    });

    test('should remove debug category', () => {
      logger.debugCategories = ['ai-review', 'file-detection'];
      
      logger.removeDebugCategory('ai-review');
      
      expect(logger.debugCategories).not.toContain('ai-review');
      expect(logger.debugCategories).toContain('file-detection');
    });

    test('should add debug filter', () => {
      const filter = { type: 'exclude', pattern: 'sensitive' };
      
      logger.addDebugFilter(filter);
      
      expect(logger.debugFilters).toContain(filter);
    });

    test('should remove debug filter', () => {
      const filter = { type: 'exclude', pattern: 'sensitive' };
      logger.debugFilters = [filter];
      
      logger.removeDebugFilter('sensitive');
      
      expect(logger.debugFilters).not.toContain(filter);
    });
  });

  describe('Debug Logging Methods', () => {
    test('should provide debug convenience method', async () => {
      logger.debugMode = true;
      logger.logLevel = 'debug';
      
      const result = await logger.debug('test_event', { data: 'test' }, { category: 'test' });
      
      expect(result.logged).toBe(true);
      expect(result.level).toBe('debug');
      expect(result.eventType).toBe('test_event');
    });

    test('should provide trace convenience method', async () => {
      logger.debugMode = true;
      logger.logLevel = 'trace';
      
      const result = await logger.trace('test_event', { data: 'test' }, { category: 'test' });
      
      expect(result.logged).toBe(true);
      expect(result.level).toBe('trace');
      expect(result.eventType).toBe('test_event');
    });

    test('should filter debug logs based on configuration', async () => {
      logger.debugMode = false;
      logger.logLevel = 'info';
      
      const result = await logger.debug('test_event', { data: 'test' });
      
      expect(result.logged).toBe(false);
      expect(result.reason).toBe('log_level_filtered');
    });
  });

  describe('Debug Configuration Status', () => {
    test('should get debug configuration', () => {
      const debugConfig = logger.getDebugConfig();
      
      expect(debugConfig).toHaveProperty('debugMode');
      expect(debugConfig).toHaveProperty('verboseLogging');
      expect(debugConfig).toHaveProperty('logLevel');
      expect(debugConfig).toHaveProperty('debugCategories');
      expect(debugConfig).toHaveProperty('debugFilters');
      expect(debugConfig).toHaveProperty('enableConsole');
      expect(debugConfig).toHaveProperty('enableFileLogging');
    });

    test('should test debug configuration', () => {
      const testResults = logger.testDebugConfig();
      
      expect(testResults).toHaveProperty('debugMode');
      expect(testResults).toHaveProperty('verboseLogging');
      expect(testResults).toHaveProperty('logLevel');
      expect(testResults).toHaveProperty('debugCategories');
      expect(testResults).toHaveProperty('debugFilters');
      expect(testResults).toHaveProperty('tests');
      expect(testResults.tests).toHaveProperty('logLevelFiltering');
      expect(testResults.tests).toHaveProperty('categoryFiltering');
      expect(testResults.tests).toHaveProperty('filterFunctionality');
    });
  });

  describe('Integration with logEvent', () => {
    test('should filter logs based on shouldLog result', async () => {
      logger.debugMode = false;
      logger.logLevel = 'info';
      
      const result = await logger.logEvent('test_event', {}, 'debug', { category: 'test' });
      
      expect(result.logged).toBe(false);
      expect(result.reason).toBe('log_level_filtered');
    });

    test('should log when shouldLog returns true', async () => {
      logger.debugMode = true;
      logger.logLevel = 'debug';
      
      const result = await logger.logEvent('test_event', {}, 'debug', { category: 'test' });
      
      expect(result.logged).toBe(true);
      expect(result.level).toBe('debug');
    });
  });
});
