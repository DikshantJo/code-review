/**
 * Unit tests for ConfigParser utility
 */

const fs = require('fs');
const path = require('path');
const ConfigParser = require('./config-parser');

// Mock @actions/core
jest.mock('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn()
}));

// Mock fs.promises
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    readFile: jest.fn(),
    access: jest.fn()
  }
}));

describe('ConfigParser', () => {
  let configParser;
  let mockCore;

  beforeEach(() => {
    configParser = new ConfigParser({
      enableLogging: false,
      strictValidation: true
    });
    mockCore = require('@actions/core');
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should initialize with default options', () => {
      const parser = new ConfigParser();
      
      expect(parser.options.defaultConfigPath).toBe('.github/ai-review-config.yml');
      expect(parser.options.fallbackConfigPath).toBe('.github/ai-review-config.yaml');
      expect(parser.options.strictValidation).toBe(true);
      expect(parser.options.autoDetectEnvironment).toBe(true);
      expect(parser.options.enableLogging).toBe(true);
      expect(parser.options.logLevel).toBe('INFO');
      expect(parser.configCache).toBeInstanceOf(Map);
    });

    test('should initialize with custom options', () => {
      const customOptions = {
        defaultConfigPath: 'custom-config.yml',
        strictValidation: false,
        enableLogging: false,
        logLevel: 'ERROR'
      };
      
      const parser = new ConfigParser(customOptions);
      
      expect(parser.options.defaultConfigPath).toBe('custom-config.yml');
      expect(parser.options.strictValidation).toBe(false);
      expect(parser.options.enableLogging).toBe(false);
      expect(parser.options.logLevel).toBe('ERROR');
    });
  });

  describe('getDefaultConfiguration', () => {
    test('should return complete default configuration', () => {
      const config = configParser.getDefaultConfiguration();
      
      expect(config).toHaveProperty('version', '1.0');
      expect(config).toHaveProperty('enabled', true);
      expect(config).toHaveProperty('global');
      expect(config).toHaveProperty('environments');
      expect(config).toHaveProperty('rules');
      expect(config).toHaveProperty('file_filtering');
      expect(config).toHaveProperty('notifications');
      expect(config).toHaveProperty('quality_gates');
      expect(config).toHaveProperty('ai');
      expect(config).toHaveProperty('logging');
    });

    test('should include all environment configurations', () => {
      const config = configParser.getDefaultConfiguration();
      
      expect(config.environments).toHaveProperty('development');
      expect(config.environments).toHaveProperty('staging');
      expect(config.environments).toHaveProperty('production');
    });

    test('should include all rule categories', () => {
      const config = configParser.getDefaultConfiguration();
      
      expect(config.rules).toHaveProperty('security');
      expect(config.rules).toHaveProperty('logic');
      expect(config.rules).toHaveProperty('performance');
      expect(config.rules).toHaveProperty('standards');
      expect(config.rules).toHaveProperty('maintainability');
    });
  });

  describe('loadConfiguration', () => {
    test('should return default configuration when no file found', async () => {
      const config = await configParser.loadConfiguration();
      
      expect(config).toHaveProperty('version', '1.0');
      expect(config).toHaveProperty('enabled', true);
      expect(config).toHaveProperty('current_environment', 'development');
    });

    test('should load configuration from specified path', async () => {
      const mockConfig = {
        version: '1.0',
        enabled: true,
        global: {
          severity_threshold: 'HIGH'
        }
      };
      
      fs.promises.readFile.mockResolvedValue(JSON.stringify(mockConfig));
      
      const config = await configParser.loadConfiguration('test-config.yml');
      
      expect(fs.promises.readFile).toHaveBeenCalledWith('test-config.yml', 'utf8');
      expect(config.global.severity_threshold).toBe('HIGH');
    });

    test('should cache configuration results', async () => {
      const mockConfig = { version: '1.0', enabled: true };
      fs.promises.readFile.mockResolvedValue(JSON.stringify(mockConfig));
      
      // Load configuration twice
      await configParser.loadConfiguration('test.yml', 'development');
      await configParser.loadConfiguration('test.yml', 'development');
      
      // Should only read file once due to caching
      expect(fs.promises.readFile).toHaveBeenCalledTimes(1);
    });

    test('should handle configuration parsing errors gracefully', async () => {
      fs.promises.readFile.mockResolvedValue('invalid yaml content');
      
      const config = await configParser.loadConfiguration('test.yml');
      
      // Should return default configuration on error
      expect(config).toHaveProperty('version', '1.0');
      expect(config).toHaveProperty('enabled', true);
    });
  });

  describe('findConfigurationFile', () => {
    test('should find configuration file in order of preference', async () => {
      // Mock fileExists to return true for the second path
      configParser.fileExists = jest.fn()
        .mockResolvedValueOnce(false)  // .github/ai-review-config.yml
        .mockResolvedValueOnce(true);  // .github/ai-review-config.yaml
      
      const result = await configParser.findConfigurationFile();
      
      expect(result).toBe('.github/ai-review-config.yaml');
      expect(configParser.fileExists).toHaveBeenCalledTimes(2);
    });

    test('should return null when no configuration file found', async () => {
      configParser.fileExists = jest.fn().mockResolvedValue(false);
      
      const result = await configParser.findConfigurationFile();
      
      expect(result).toBeNull();
    });
  });

  describe('parseConfiguration', () => {
    test('should parse valid YAML content', () => {
      const yamlContent = `
version: '1.0'
enabled: true
global:
  severity_threshold: 'HIGH'
`;
      
      const result = configParser.parseConfiguration(yamlContent);
      
      expect(result).toHaveProperty('version', '1.0');
      expect(result).toHaveProperty('enabled', true);
      expect(result.global).toHaveProperty('severity_threshold', 'HIGH');
    });

    test('should throw error for invalid YAML', () => {
      const invalidYaml = 'invalid: yaml: content: [';
      
      expect(() => {
        configParser.parseConfiguration(invalidYaml);
      }).toThrow('Failed to parse YAML configuration');
    });

    test('should throw error for non-object YAML', () => {
      const nonObjectYaml = 'just a string';
      
      expect(() => {
        configParser.parseConfiguration(nonObjectYaml);
      }).toThrow('Configuration must be a valid YAML object');
    });
  });

  describe('validateConfiguration', () => {
    test('should validate complete configuration successfully', () => {
      const validConfig = {
        version: '1.0',
        enabled: true,
        global: {
          severity_threshold: 'MEDIUM',
          max_files_per_review: 50
        },
        environments: {
          development: {
            severity_threshold: 'LOW'
          }
        },
        rules: {
          security: {
            enabled: true,
            priority: 'HIGH'
          }
        }
      };
      
      const result = configParser.validateConfiguration(validConfig);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect missing required fields', () => {
      const invalidConfig = {
        enabled: true
        // Missing version
      };
      
      const result = configParser.validateConfiguration(invalidConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required field: version');
    });

    test('should validate global settings', () => {
      const config = {
        version: '1.0',
        enabled: true,
        global: {
          severity_threshold: 'INVALID',
          max_files_per_review: -1
        }
      };
      
      const result = configParser.validateConfiguration(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid severity_threshold: INVALID. Must be one of: LOW, MEDIUM, HIGH');
      expect(result.errors).toContain('max_files_per_review must be a positive number');
    });

    test('should validate environment configurations', () => {
      const config = {
        version: '1.0',
        enabled: true,
        environments: {
          development: {
            severity_threshold: 'INVALID'
          }
        }
      };
      
      const result = configParser.validateConfiguration(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid severity_threshold for development: INVALID. Must be one of: LOW, MEDIUM, HIGH');
    });

    test('should validate rules configuration', () => {
      const config = {
        version: '1.0',
        enabled: true,
        rules: {
          security: {
            enabled: 'not a boolean',
            priority: 'INVALID'
          }
        }
      };
      
      const result = configParser.validateConfiguration(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Rule security: enabled must be a boolean');
      expect(result.errors).toContain('Rule security: Invalid priority INVALID');
    });
  });

  describe('validateGlobalSettings', () => {
    test('should validate valid global settings', () => {
      const global = {
        severity_threshold: 'MEDIUM',
        max_files_per_review: 50,
        max_file_size_bytes: 1000000,
        timeout_seconds: 300
      };
      
      const result = configParser.validateGlobalSettings(global);
      
      expect(result.errors).toHaveLength(0);
    });

    test('should detect invalid severity threshold', () => {
      const global = {
        severity_threshold: 'INVALID'
      };
      
      const result = configParser.validateGlobalSettings(global);
      
      expect(result.errors).toContain('Invalid severity_threshold: INVALID. Must be one of: LOW, MEDIUM, HIGH');
    });

    test('should detect invalid numeric values', () => {
      const global = {
        max_files_per_review: -1,
        max_file_size_bytes: 0,
        timeout_seconds: 'not a number'
      };
      
      const result = configParser.validateGlobalSettings(global);
      
      expect(result.errors).toContain('max_files_per_review must be a positive number');
      expect(result.errors).toContain('max_file_size_bytes must be a positive number');
      expect(result.errors).toContain('timeout_seconds must be a positive number');
    });
  });

  describe('validateEnvironments', () => {
    test('should validate valid environment configurations', () => {
      const environments = {
        development: {
          severity_threshold: 'LOW'
        },
        production: {
          severity_threshold: 'HIGH'
        }
      };
      
      const result = configParser.validateEnvironments(environments);
      
      expect(result.errors).toHaveLength(0);
    });

    test('should warn about unknown environments', () => {
      const environments = {
        unknown_env: {
          severity_threshold: 'LOW'
        }
      };
      
      const result = configParser.validateEnvironments(environments);
      
      expect(result.warnings).toContain('Unknown environment: unknown_env');
    });

    test('should detect invalid severity thresholds in environments', () => {
      const environments = {
        development: {
          severity_threshold: 'INVALID'
        }
      };
      
      const result = configParser.validateEnvironments(environments);
      
      expect(result.errors).toContain('Invalid severity_threshold for development: INVALID. Must be one of: LOW, MEDIUM, HIGH');
    });
  });

  describe('validateRules', () => {
    test('should validate valid rules configuration', () => {
      const rules = {
        security: {
          enabled: true,
          priority: 'HIGH',
          checks: ['SQL injection'],
          excluded_files: ['*.test.js']
        }
      };
      
      const result = configParser.validateRules(rules);
      
      expect(result.errors).toHaveLength(0);
    });

    test('should warn about unknown rule categories', () => {
      const rules = {
        unknown_rule: {
          enabled: true
        }
      };
      
      const result = configParser.validateRules(rules);
      
      expect(result.warnings).toContain('Unknown rule category: unknown_rule');
    });

    test('should detect invalid rule configurations', () => {
      const rules = {
        security: {
          enabled: 'not boolean',
          priority: 'INVALID',
          checks: 'not an array',
          excluded_files: 'not an array'
        }
      };
      
      const result = configParser.validateRules(rules);
      
      expect(result.errors).toContain('Rule security: enabled must be a boolean');
      expect(result.errors).toContain('Rule security: Invalid priority INVALID');
      expect(result.errors).toContain('Rule security: checks must be an array');
      expect(result.errors).toContain('Rule security: excluded_files must be an array');
    });
  });

  describe('validateFileFiltering', () => {
    test('should validate valid file filtering configuration', () => {
      const filtering = {
        exclude_patterns: ['*.log'],
        include_patterns: ['*.js'],
        max_file_size_bytes: 1000000,
        max_files_per_review: 50
      };
      
      const result = configParser.validateFileFiltering(filtering);
      
      expect(result.errors).toHaveLength(0);
    });

    test('should detect invalid file filtering configuration', () => {
      const filtering = {
        exclude_patterns: 'not an array',
        include_patterns: 'not an array',
        max_file_size_bytes: -1,
        max_files_per_review: 0
      };
      
      const result = configParser.validateFileFiltering(filtering);
      
      expect(result.errors).toContain('exclude_patterns must be an array');
      expect(result.errors).toContain('include_patterns must be an array');
      expect(result.errors).toContain('max_file_size_bytes must be a positive number');
      expect(result.errors).toContain('max_files_per_review must be a positive number');
    });
  });

  describe('validateNotifications', () => {
    test('should validate valid notifications configuration', () => {
      const notifications = {
        github_issues: {
          enabled: true,
          assign_to_team_lead: false
        },
        email: {
          enabled: false
        },
        slack: {
          enabled: false
        }
      };
      
      const result = configParser.validateNotifications(notifications);
      
      expect(result.errors).toHaveLength(0);
    });

    test('should validate required email fields when enabled', () => {
      const notifications = {
        email: {
          enabled: true
          // Missing required fields
        }
      };
      
      const result = configParser.validateNotifications(notifications);
      
      expect(result.errors).toContain('email.smtp_host is required when email is enabled');
      expect(result.errors).toContain('email.smtp_user is required when email is enabled');
      expect(result.errors).toContain('email.smtp_pass is required when email is enabled');
      expect(result.errors).toContain('email.to_emails must be a non-empty array when email is enabled');
    });

    test('should validate required slack fields when enabled', () => {
      const notifications = {
        slack: {
          enabled: true
          // Missing webhook_url
        }
      };
      
      const result = configParser.validateNotifications(notifications);
      
      expect(result.errors).toContain('slack.webhook_url is required when slack is enabled');
    });
  });

  describe('validateQualityGates', () => {
    test('should validate valid quality gates configuration', () => {
      const gates = {
        enabled: true,
        block_high_severity: true,
        block_medium_severity: false,
        allow_urgent_override: true,
        urgent_keywords: ['URGENT'],
        override_logging: true,
        max_override_frequency: 5
      };
      
      const result = configParser.validateQualityGates(gates);
      
      expect(result.errors).toHaveLength(0);
    });

    test('should detect invalid quality gates configuration', () => {
      const gates = {
        enabled: 'not boolean',
        block_high_severity: 'not boolean',
        block_medium_severity: 'not boolean',
        allow_urgent_override: 'not boolean',
        urgent_keywords: 'not an array',
        max_override_frequency: -1
      };
      
      const result = configParser.validateQualityGates(gates);
      
      expect(result.errors).toContain('quality_gates.enabled must be a boolean');
      expect(result.errors).toContain('quality_gates.block_high_severity must be a boolean');
      expect(result.errors).toContain('quality_gates.block_medium_severity must be a boolean');
      expect(result.errors).toContain('quality_gates.allow_urgent_override must be a boolean');
      expect(result.errors).toContain('quality_gates.urgent_keywords must be an array');
      expect(result.errors).toContain('quality_gates.max_override_frequency must be a positive number');
    });
  });

  describe('mergeWithDefaults', () => {
    test('should merge user configuration with defaults', () => {
      const userConfig = {
        version: '1.0',
        enabled: true,
        global: {
          severity_threshold: 'HIGH'
        }
      };
      
      const result = configParser.mergeWithDefaults(userConfig);
      
      expect(result.global.severity_threshold).toBe('HIGH');
      expect(result.global.max_files_per_review).toBe(50); // From defaults
      expect(result.rules).toBeDefined(); // From defaults
    });

    test('should deep merge nested objects', () => {
      const userConfig = {
        global: {
          severity_threshold: 'HIGH',
          custom_setting: 'value'
        }
      };
      
      const result = configParser.mergeWithDefaults(userConfig);
      
      expect(result.global.severity_threshold).toBe('HIGH');
      expect(result.global.custom_setting).toBe('value');
      expect(result.global.max_files_per_review).toBe(50); // From defaults
    });
  });

  describe('getEnvironmentConfiguration', () => {
    test('should return environment-specific configuration', () => {
      const config = {
        global: { setting: 'global' },
        environments: {
          development: { setting: 'dev' },
          production: { setting: 'prod' }
        }
      };
      
      const result = configParser.getEnvironmentConfiguration(config, 'production');
      
      expect(result.setting).toBe('prod');
      expect(result.current_environment).toBe('production');
    });

    test('should auto-detect environment when not specified', () => {
      // Mock detectEnvironment
      configParser.detectEnvironment = jest.fn().mockReturnValue('staging');
      
      const config = {
        environments: {
          staging: { setting: 'staging' }
        }
      };
      
      const result = configParser.getEnvironmentConfiguration(config);
      
      expect(result.setting).toBe('staging');
      expect(result.current_environment).toBe('staging');
    });

    test('should default to development when no environment specified', () => {
      const config = {
        environments: {
          development: { setting: 'dev' }
        }
      };
      
      const result = configParser.getEnvironmentConfiguration(config);
      
      expect(result.setting).toBe('dev');
      expect(result.current_environment).toBe('development');
    });
  });

  describe('detectEnvironment', () => {
    test('should detect production environment', () => {
      // Clear any existing environment variables
      delete process.env.ENVIRONMENT;
      process.env.NODE_ENV = 'production';
      
      const result = configParser.detectEnvironment();
      
      expect(result).toBe('production');
      
      // Clean up
      delete process.env.NODE_ENV;
    });

    test('should detect staging environment', () => {
      // Clear any existing environment variables
      delete process.env.NODE_ENV;
      process.env.ENVIRONMENT = 'staging';
      
      const result = configParser.detectEnvironment();
      
      expect(result).toBe('staging');
      
      // Clean up
      delete process.env.ENVIRONMENT;
    });

    test('should default to development', () => {
      delete process.env.NODE_ENV;
      delete process.env.ENVIRONMENT;
      
      const result = configParser.detectEnvironment();
      
      expect(result).toBe('development');
    });
  });

  describe('getRuleConfiguration', () => {
    test('should return merged rule configuration', () => {
      const config = {
        current_environment: 'production',
        rules: {
          security: {
            enabled: true,
            priority: 'HIGH'
          }
        },
        environments: {
          production: {
            rules: {
              security: {
                priority: 'MEDIUM'
              }
            }
          }
        }
      };
      
      const result = configParser.getRuleConfiguration(config, 'security');
      
      expect(result.enabled).toBe(true);
      expect(result.priority).toBe('MEDIUM'); // Overridden by environment
    });
  });

  describe('fileExists', () => {
    test('should return true for existing file', async () => {
      fs.promises.access.mockResolvedValue();
      
      const result = await configParser.fileExists('test.yml');
      
      expect(result).toBe(true);
      expect(fs.promises.access).toHaveBeenCalledWith('test.yml', fs.constants.F_OK);
    });

    test('should return false for non-existing file', async () => {
      fs.promises.access.mockRejectedValue(new Error('File not found'));
      
      const result = await configParser.fileExists('test.yml');
      
      expect(result).toBe(false);
    });
  });

  describe('Cache management', () => {
    test('should clear cache', () => {
      configParser.configCache.set('key', 'value');
      
      configParser.clearCache();
      
      expect(configParser.configCache.size).toBe(0);
    });

    test('should return cache statistics', () => {
      configParser.configCache.set('key1', 'value1');
      configParser.configCache.set('key2', 'value2');
      
      const stats = configParser.getCacheStats();
      
      expect(stats.size).toBe(2);
      expect(stats.keys).toContain('key1');
      expect(stats.keys).toContain('key2');
    });
  });

  describe('Logging', () => {
    test('should log info messages when enabled', () => {
      const parser = new ConfigParser({ enableLogging: true, logLevel: 'INFO' });
      
      parser.logInfo('Test message');
      
      expect(mockCore.info).toHaveBeenCalledWith('[Config Parser] Test message');
    });

    test('should not log info messages when disabled', () => {
      const parser = new ConfigParser({ enableLogging: false });
      
      parser.logInfo('Test message');
      
      expect(mockCore.info).not.toHaveBeenCalled();
    });

    test('should log warning messages', () => {
      const parser = new ConfigParser({ enableLogging: true });
      
      parser.logWarning('Test warning');
      
      expect(mockCore.warning).toHaveBeenCalledWith('[Config Parser] Test warning');
    });

    test('should log error messages', () => {
      const parser = new ConfigParser({ enableLogging: true });
      
      parser.logError('Test error');
      
      expect(mockCore.error).toHaveBeenCalledWith('[Config Parser] Test error');
    });
  });
});
