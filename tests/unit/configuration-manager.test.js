const { describe, it, beforeEach, afterEach, expect, jest } = require('@jest/globals');
const ConfigurationManager = require('../../src/utils/configuration-manager');
const ConfigLoader = require('../../src/utils/config-loader');

// Mock dependencies
jest.mock('../../src/utils/config-loader');
jest.mock('fs');
jest.mock('path');
jest.mock('js-yaml');

describe('ConfigurationManager', () => {
  let configManager;
  let mockConfigLoader;
  let mockConfig;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock configuration data
    mockConfig = {
      environment: 'test',
      notifications: {
        email: {
          enabled: true,
          smtp_host: 'smtp.test.com',
          smtp_user: 'test@test.com'
        }
      },
      ai: {
        model: 'gpt-4',
        max_tokens: 4000
      },
      environments: {
        test: {
          notifications: {
            email: {
              to_emails: ['test@example.com']
            }
          }
        }
      }
    };

    // Mock ConfigLoader
    mockConfigLoader = {
      loadConfiguration: jest.fn().mockResolvedValue(mockConfig),
      reloadConfiguration: jest.fn().mockResolvedValue(mockConfig),
      validateConfiguration: jest.fn().mockResolvedValue({ isValid: true, errors: [], warnings: [] }),
      loadedSources: [
        { type: 'default', timestamp: new Date() },
        { type: 'file', path: '/test/config.yml', timestamp: new Date() }
      ],
      validationErrors: []
    };

    ConfigLoader.mockImplementation(() => mockConfigLoader);
    
    // Create ConfigurationManager instance
    configManager = new ConfigurationManager({
      configDir: '/test',
      configFile: 'test-config.yml',
      validateOnLoad: true,
      watchForChanges: false
    });
  });

  afterEach(() => {
    if (configManager) {
      configManager.cleanup();
    }
  });

  describe('Constructor', () => {
    it('should create instance with default options', () => {
      const manager = new ConfigurationManager();
      expect(manager.options.configDir).toBe('.');
      expect(manager.options.configFile).toBe('ai-review-config.yml');
      expect(manager.options.validateOnLoad).toBe(true);
      expect(manager.options.watchForChanges).toBe(false);
    });

    it('should create instance with custom options', () => {
      const customOptions = {
        configDir: '/custom',
        configFile: 'custom.yml',
        validateOnLoad: false,
        watchForChanges: true
      };
      
      const manager = new ConfigurationManager(customOptions);
      expect(manager.options.configDir).toBe('/custom');
      expect(manager.options.configFile).toBe('custom.yml');
      expect(manager.options.validateOnLoad).toBe(false);
      expect(manager.options.watchForChanges).toBe(true);
    });
  });

  describe('initialize', () => {
    it('should initialize successfully with valid configuration', async () => {
      const result = await configManager.initialize();
      
      expect(result).toEqual(mockConfig);
      expect(mockConfigLoader.loadConfiguration).toHaveBeenCalledTimes(1);
      expect(mockConfigLoader.validateConfiguration).toHaveBeenCalledTimes(1);
      expect(configManager.config).toEqual(mockConfig);
      expect(configManager.lastConfigHash).toBeDefined();
    });

    it('should throw error if configuration loading fails', async () => {
      const error = new Error('Config loading failed');
      mockConfigLoader.loadConfiguration.mockRejectedValue(error);
      
      await expect(configManager.initialize()).rejects.toThrow('Config loading failed');
      expect(configManager.config).toBeNull();
    });

    it('should throw error if validation fails', async () => {
      const validationError = new Error('Validation failed');
      mockConfigLoader.validateConfiguration.mockRejectedValue(validationError);
      
      await expect(configManager.initialize()).rejects.toThrow('Validation failed');
    });

    it('should set up file watchers when enabled', async () => {
      configManager.options.watchForChanges = true;
      const setupWatchersSpy = jest.spyOn(configManager, 'setupConfigWatchers');
      
      await configManager.initialize();
      
      expect(setupWatchersSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('get', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    it('should get top-level configuration value', () => {
      const value = configManager.get('environment');
      expect(value).toBe('test');
    });

    it('should get nested configuration value', () => {
      const value = configManager.get('notifications.email.enabled');
      expect(value).toBe(true);
    });

    it('should return default value for missing key', () => {
      const value = configManager.get('nonexistent.key', 'default');
      expect(value).toBe('default');
    });

    it('should throw error if not initialized', () => {
      const uninitializedManager = new ConfigurationManager();
      expect(() => uninitializedManager.get('test')).toThrow('Configuration not initialized');
    });
  });

  describe('set', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    it('should set top-level configuration value', () => {
      configManager.set('newKey', 'newValue');
      expect(configManager.get('newKey')).toBe('newValue');
    });

    it('should set nested configuration value', () => {
      configManager.set('notifications.email.newSetting', 'newValue');
      expect(configManager.get('notifications.email.newSetting')).toBe('newValue');
    });

    it('should create nested objects if they don\'t exist', () => {
      configManager.set('deeply.nested.new.key', 'value');
      expect(configManager.get('deeply.nested.new.key')).toBe('value');
    });

    it('should update configuration hash after setting', () => {
      const originalHash = configManager.lastConfigHash;
      configManager.set('testKey', 'testValue');
      expect(configManager.lastConfigHash).not.toBe(originalHash);
    });

    it('should throw error if not initialized', () => {
      const uninitializedManager = new ConfigurationManager();
      expect(() => uninitializedManager.set('test', 'value')).toThrow('Configuration not initialized');
    });
  });

  describe('has', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    it('should return true for existing key', () => {
      expect(configManager.has('environment')).toBe(true);
    });

    it('should return true for existing nested key', () => {
      expect(configManager.has('notifications.email.enabled')).toBe(true);
    });

    it('should return false for missing key', () => {
      expect(configManager.has('nonexistent.key')).toBe(false);
    });

    it('should return false if not initialized', () => {
      const uninitializedManager = new ConfigurationManager();
      expect(uninitializedManager.has('test')).toBe(false);
    });
  });

  describe('getAll', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    it('should return complete configuration', () => {
      const allConfig = configManager.getAll();
      expect(allConfig).toEqual(mockConfig);
    });

    it('should return deep copy of configuration', () => {
      const allConfig = configManager.getAll();
      allConfig.newKey = 'newValue';
      expect(configManager.get('newKey')).toBeUndefined();
    });

    it('should throw error if not initialized', () => {
      const uninitializedManager = new ConfigurationManager();
      expect(() => uninitializedManager.getAll()).toThrow('Configuration not initialized');
    });
  });

  describe('getSection', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    it('should return configuration section', () => {
      const emailSection = configManager.getSection('notifications.email');
      expect(emailSection).toEqual({
        enabled: true,
        smtp_host: 'smtp.test.com',
        smtp_user: 'test@test.com'
      });
    });

    it('should return empty object for missing section', () => {
      const missingSection = configManager.getSection('nonexistent');
      expect(missingSection).toEqual({});
    });

    it('should throw error if not initialized', () => {
      const uninitializedManager = new ConfigurationManager();
      expect(() => uninitializedManager.getSection('test')).toThrow('Configuration not initialized');
    });
  });

  describe('getEnvironmentConfig', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    it('should return environment-specific configuration', () => {
      const testEnvConfig = configManager.getEnvironmentConfig('test');
      expect(testEnvConfig.notifications.email.to_emails).toEqual(['test@example.com']);
    });

    it('should return empty object for missing environment', () => {
      const missingEnvConfig = configManager.getEnvironmentConfig('nonexistent');
      expect(missingEnvConfig).toEqual({});
    });

    it('should throw error if not initialized', () => {
      const uninitializedManager = new ConfigurationManager();
      expect(() => uninitializedManager.getEnvironmentConfig('test')).toThrow('Configuration not initialized');
    });
  });

  describe('getCurrentEnvironmentConfig', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    it('should return current environment configuration', () => {
      const currentEnvConfig = configManager.getCurrentEnvironmentConfig();
      expect(currentEnvConfig.environment).toBe('test');
    });

    it('should use NODE_ENV if environment not set', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const newManager = new ConfigurationManager();
      const mockProdConfig = { ...mockConfig, environment: 'production' };
      mockConfigLoader.loadConfiguration.mockResolvedValue(mockProdConfig);
      
      await newManager.initialize();
      const currentEnvConfig = newManager.getCurrentEnvironmentConfig();
      expect(currentEnvConfig.environment).toBe('production');
      
      process.env.NODE_ENV = originalEnv;
      newManager.cleanup();
    });
  });

  describe('validateConfiguration', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    it('should validate configuration successfully', async () => {
      const result = await configManager.validateConfiguration();
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should throw error if validation fails', async () => {
      const validationError = new Error('Validation failed');
      mockConfigLoader.validateConfiguration.mockRejectedValue(validationError);
      
      await expect(configManager.validateConfiguration()).rejects.toThrow('Validation failed');
    });
  });

  describe('reloadConfiguration', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    it('should reload configuration successfully', async () => {
      const updatedConfig = { ...mockConfig, newKey: 'newValue' };
      mockConfigLoader.reloadConfiguration.mockResolvedValue(updatedConfig);
      
      const result = await configManager.reloadConfiguration();
      
      expect(result).toEqual(updatedConfig);
      expect(configManager.config).toEqual(updatedConfig);
      expect(mockConfigLoader.reloadConfiguration).toHaveBeenCalledTimes(1);
    });

    it('should clear cache after reload', async () => {
      const clearCacheSpy = jest.spyOn(configManager, 'clearCache');
      
      await configManager.reloadConfiguration();
      
      expect(clearCacheSpy).toHaveBeenCalledTimes(1);
    });

    it('should update configuration hash after reload', async () => {
      const originalHash = configManager.lastConfigHash;
      
      await configManager.reloadConfiguration();
      
      expect(configManager.lastConfigHash).not.toBe(originalHash);
    });

    it('should throw error if reload fails', async () => {
      const reloadError = new Error('Reload failed');
      mockConfigLoader.reloadConfiguration.mockRejectedValue(reloadError);
      
      await expect(configManager.reloadConfiguration()).rejects.toThrow('Reload failed');
    });
  });

  describe('Configuration Change Callbacks', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    it('should register configuration change callback', () => {
      const callback = jest.fn();
      configManager.onConfigChange(callback, 'test.key');
      
      expect(configManager.changeCallbacks).toHaveLength(1);
      expect(configManager.changeCallbacks[0].callback).toBe(callback);
      expect(configManager.changeCallbacks[0].key).toBe('test.key');
    });

    it('should remove configuration change callback', () => {
      const callback = jest.fn();
      configManager.onConfigChange(callback);
      
      expect(configManager.changeCallbacks).toHaveLength(1);
      
      configManager.offConfigChange(callback);
      expect(configManager.changeCallbacks).toHaveLength(0);
    });

    it('should notify callbacks when configuration changes', () => {
      const callback = jest.fn();
      configManager.onConfigChange(callback, 'test.key');
      
      configManager.set('test.key', 'newValue');
      
      expect(callback).toHaveBeenCalledWith('test.key', 'newValue', configManager.config);
    });

    it('should notify wildcard callbacks for any change', () => {
      const wildcardCallback = jest.fn();
      const specificCallback = jest.fn();
      
      configManager.onConfigChange(wildcardCallback, '*');
      configManager.onConfigChange(specificCallback, 'specific.key');
      
      configManager.set('different.key', 'newValue');
      
      expect(wildcardCallback).toHaveBeenCalledWith('different.key', 'newValue', configManager.config);
      expect(specificCallback).not.toHaveBeenCalled();
    });
  });

  describe('Configuration Hash', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    it('should generate consistent hash for same configuration', () => {
      const hash1 = configManager.generateConfigHash(mockConfig);
      const hash2 = configManager.generateConfigHash(mockConfig);
      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different configuration', () => {
      const config1 = { key: 'value1' };
      const config2 = { key: 'value2' };
      
      const hash1 = configManager.generateConfigHash(config1);
      const hash2 = configManager.generateConfigHash(config2);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should detect configuration changes', () => {
      expect(configManager.hasConfigurationChanged()).toBe(false);
      
      configManager.set('newKey', 'newValue');
      
      expect(configManager.hasConfigurationChanged()).toBe(true);
    });
  });

  describe('Configuration Statistics', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    it('should return configuration summary', () => {
      const summary = configManager.getConfigurationSummary();
      
      expect(summary.environment).toBe('test');
      expect(summary.sources).toHaveLength(2);
      expect(summary.hash).toBeDefined();
      expect(summary.hasChanges).toBe(false);
    });

    it('should return configuration statistics', () => {
      const stats = configManager.getConfigurationStats();
      
      expect(stats.totalKeys).toBeGreaterThan(0);
      expect(stats.sections).toBeGreaterThan(0);
      expect(stats.environment).toBe('test');
      expect(stats.sources).toBe(2);
      expect(stats.validationErrors).toBe(0);
    });
  });

  describe('Cleanup', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    it('should cleanup resources properly', () => {
      const clearCacheSpy = jest.spyOn(configManager, 'clearCache');
      
      configManager.cleanup();
      
      expect(clearCacheSpy).toHaveBeenCalledTimes(1);
      expect(configManager.changeCallbacks).toHaveLength(0);
      expect(configManager.configWatchers.size).toBe(0);
    });

    it('should handle cleanup errors gracefully', () => {
      // Mock watcher close to throw error
      const mockWatcher = { close: jest.fn().mockImplementation(() => { throw new Error('Close failed'); }) };
      configManager.configWatchers.set('/test/path', mockWatcher);
      
      // Should not throw error during cleanup
      expect(() => configManager.cleanup()).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors gracefully', async () => {
      const error = new Error('Initialization failed');
      mockConfigLoader.loadConfiguration.mockRejectedValue(error);
      
      await expect(configManager.initialize()).rejects.toThrow('Initialization failed');
      expect(configManager.config).toBeNull();
    });

    it('should handle validation errors gracefully', async () => {
      const validationError = new Error('Validation failed');
      mockConfigLoader.validateConfiguration.mockRejectedValue(validationError);
      
      await expect(configManager.initialize()).rejects.toThrow('Validation failed');
    });

    it('should handle reload errors gracefully', async () => {
      await configManager.initialize();
      
      const reloadError = new Error('Reload failed');
      mockConfigLoader.reloadConfiguration.mockRejectedValue(reloadError);
      
      await expect(configManager.reloadConfiguration()).rejects.toThrow('Reload failed');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty configuration', async () => {
      const emptyConfig = {};
      mockConfigLoader.loadConfiguration.mockResolvedValue(emptyConfig);
      
      await configManager.initialize();
      
      expect(configManager.get('nonexistent.key', 'default')).toBe('default');
      expect(configManager.has('nonexistent.key')).toBe(false);
    });

    it('should handle null configuration values', async () => {
      const configWithNull = { key: null };
      mockConfigLoader.loadConfiguration.mockResolvedValue(configWithNull);
      
      await configManager.initialize();
      
      expect(configManager.get('key')).toBeNull();
      expect(configManager.has('key')).toBe(true);
    });

    it('should handle undefined configuration values', async () => {
      const configWithUndefined = { key: undefined };
      mockConfigLoader.loadConfiguration.mockResolvedValue(configWithUndefined);
      
      await configManager.initialize();
      
      expect(configManager.get('key')).toBeUndefined();
      expect(configManager.has('key')).toBe(false);
    });
  });
});

