/**
 * Configuration Parser Utility
 * Handles YAML configuration files for dynamic rule management
 */

const core = require('@actions/core');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

class ConfigParser {
  constructor(options = {}) {
    this.options = {
      // Default configuration paths
      defaultConfigPath: options.defaultConfigPath || '.github/ai-review-config.yml',
      fallbackConfigPath: options.fallbackConfigPath || '.github/ai-review-config.yaml',
      
      // Configuration validation
      strictValidation: options.strictValidation !== false,
      allowUnknownFields: options.allowUnknownFields || false,
      
      // Environment detection
      autoDetectEnvironment: options.autoDetectEnvironment !== false,
      
      // Logging
      enableLogging: options.enableLogging !== false,
      logLevel: options.logLevel || 'INFO'
    };

    // Default configuration schema
    this.defaultConfig = this.getDefaultConfiguration();
    
    // Configuration cache
    this.configCache = new Map();
  }

  /**
   * Get default configuration structure
   * @returns {Object} Default configuration
   */
  getDefaultConfiguration() {
    return {
      version: '1.0',
      enabled: true,
      
      // Global settings
      global: {
        severity_threshold: 'MEDIUM',
        max_files_per_review: 50,
        max_file_size_bytes: 1000000,
        timeout_seconds: 300,
        retry_attempts: 3,
        retry_delay_seconds: 5
      },
      
      // Environment-specific configurations
      environments: {
        development: {
          severity_threshold: 'LOW',
          max_files_per_review: 100,
          timeout_seconds: 600,
          rules: {
            security: { enabled: true, priority: 'HIGH' },
            logic: { enabled: true, priority: 'HIGH' },
            performance: { enabled: true, priority: 'MEDIUM' },
            standards: { enabled: true, priority: 'MEDIUM' },
            maintainability: { enabled: true, priority: 'LOW' }
          }
        },
        staging: {
          severity_threshold: 'MEDIUM',
          max_files_per_review: 75,
          timeout_seconds: 450,
          rules: {
            security: { enabled: true, priority: 'HIGH' },
            logic: { enabled: true, priority: 'HIGH' },
            performance: { enabled: true, priority: 'MEDIUM' },
            standards: { enabled: true, priority: 'MEDIUM' },
            maintainability: { enabled: true, priority: 'LOW' }
          }
        },
        production: {
          severity_threshold: 'HIGH',
          max_files_per_review: 50,
          timeout_seconds: 300,
          rules: {
            security: { enabled: true, priority: 'HIGH' },
            logic: { enabled: true, priority: 'HIGH' },
            performance: { enabled: true, priority: 'HIGH' },
            standards: { enabled: true, priority: 'MEDIUM' },
            maintainability: { enabled: true, priority: 'LOW' }
          }
        }
      },
      
      // Rule definitions
      rules: {
        security: {
          enabled: true,
          priority: 'HIGH',
          checks: [
            'SQL injection vulnerabilities',
            'XSS vulnerabilities',
            'CSRF vulnerabilities',
            'Authentication bypass',
            'Authorization flaws',
            'Input validation issues',
            'Sensitive data exposure',
            'Insecure dependencies'
          ],
          custom_patterns: [],
          excluded_files: ['*.test.js', '*.spec.js', 'tests/**/*']
        },
        logic: {
          enabled: true,
          priority: 'HIGH',
          checks: [
            'Null pointer exceptions',
            'Array bounds checking',
            'Type safety issues',
            'Race conditions',
            'Deadlock potential',
            'Resource leaks',
            'Error handling gaps',
            'Edge case handling'
          ],
          custom_patterns: [],
          excluded_files: ['*.test.js', '*.spec.js', 'tests/**/*']
        },
        performance: {
          enabled: true,
          priority: 'MEDIUM',
          checks: [
            'Inefficient algorithms',
            'Memory leaks',
            'Unnecessary computations',
            'Database query optimization',
            'Network call optimization',
            'Resource usage patterns',
            'Caching opportunities',
            'Async/await usage'
          ],
          custom_patterns: [],
          excluded_files: ['*.test.js', '*.spec.js', 'tests/**/*']
        },
        standards: {
          enabled: true,
          priority: 'MEDIUM',
          checks: [
            'Code style consistency',
            'Naming conventions',
            'Function complexity',
            'Code duplication',
            'Documentation quality',
            'Error handling patterns',
            'Logging standards',
            'Testing coverage'
          ],
          custom_patterns: [],
          excluded_files: ['*.test.js', '*.spec.js', 'tests/**/*']
        },
        maintainability: {
          enabled: true,
          priority: 'LOW',
          checks: [
            'Code readability',
            'Function length',
            'Class design',
            'Separation of concerns',
            'Dependency management',
            'Configuration management',
            'Code organization',
            'Future-proofing'
          ],
          custom_patterns: [],
          excluded_files: ['*.test.js', '*.spec.js', 'tests/**/*']
        }
      },
      
      // File filtering
      file_filtering: {
        exclude_patterns: [
          '*.sql', '*.db', '*.sqlite',
          '.env*', '*.env',
          '*.log', 'logs/**/*',
          '*.key', '*.pem', '*.p12', '*.pfx',
          '*.jpg', '*.png', '*.gif', '*.svg',
          '*.exe', '*.dll', '*.so', '*.jar',
          'node_modules/**/*', '.git/**/*',
          'dist/**/*', 'build/**/*', 'coverage/**/*'
        ],
        include_patterns: [],
        max_file_size_bytes: 1000000,
        max_files_per_review: 50
      },
      
      // Notification settings
      notifications: {
        github_issues: {
          enabled: true,
          assign_to_team_lead: true,
          team_lead_username: '',
          issue_labels: ['ai-review', 'code-quality'],
          issue_template: 'default'
        },
        email: {
          enabled: false,
          smtp_host: '',
          smtp_port: 587,
          smtp_user: '',
          smtp_pass: '',
          from_email: 'ai-review@github.com',
          to_emails: []
        },
        slack: {
          enabled: false,
          webhook_url: '',
          channel: '#ai-reviews',
          notify_on_failure_only: true
        }
      },
      
      // Production quality gates
      quality_gates: {
        enabled: false,
        block_high_severity: true,
        block_medium_severity: false,
        allow_urgent_override: true,
        urgent_keywords: ['URGENT', 'EMERGENCY', 'HOTFIX'],
        override_logging: true,
        max_override_frequency: 5 // per day
      },
      
      // AI settings
      ai: {
        model: 'gpt-4',
        temperature: 0.1,
        max_tokens: 8000,
        system_prompt_template: 'default',
        response_format: 'json',
        language_specific_prompts: true
      },
      
      // Logging and monitoring
      logging: {
        level: 'INFO',
        audit_trail: true,
        performance_metrics: true,
        error_reporting: true,
        log_retention_days: 30
      }
    };
  }

  /**
   * Load configuration from file
   * @param {string} configPath - Path to configuration file
   * @param {string} environment - Target environment
   * @returns {Object} Parsed configuration
   */
  async loadConfiguration(configPath = null, environment = null) {
    try {
      // Determine config path
      const actualConfigPath = configPath || await this.findConfigurationFile();
      
      if (!actualConfigPath) {
        this.logInfo('No configuration file found, using defaults');
        return this.getEnvironmentConfiguration(this.defaultConfig, environment);
      }

      // Check cache first
      const cacheKey = `${actualConfigPath}:${environment}`;
      if (this.configCache.has(cacheKey)) {
        this.logInfo(`Using cached configuration for ${cacheKey}`);
        return this.configCache.get(cacheKey);
      }

      // Load and parse configuration
      const configContent = await this.readConfigurationFile(actualConfigPath);
      const parsedConfig = this.parseConfiguration(configContent);
      
      // Validate configuration
      const validationResult = this.validateConfiguration(parsedConfig);
      if (!validationResult.isValid) {
        throw new Error(`Configuration validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Merge with defaults
      const mergedConfig = this.mergeWithDefaults(parsedConfig);
      
      // Get environment-specific configuration
      const envConfig = this.getEnvironmentConfiguration(mergedConfig, environment);
      
      // Cache the result
      this.configCache.set(cacheKey, envConfig);
      
      this.logInfo(`Configuration loaded successfully from ${actualConfigPath}`);
      return envConfig;
      
    } catch (error) {
      this.logError('Failed to load configuration', error);
      
      // Return default configuration on error
      return this.getEnvironmentConfiguration(this.defaultConfig, environment);
    }
  }

  /**
   * Find configuration file in repository
   * @returns {Promise<string|null>} Path to configuration file or null
   */
  async findConfigurationFile() {
    const possiblePaths = [
      this.options.defaultConfigPath,
      this.options.fallbackConfigPath,
      'ai-review-config.yml',
      'ai-review-config.yaml',
      '.ai-review-config.yml',
      '.ai-review-config.yaml'
    ];

    for (const configPath of possiblePaths) {
      try {
        if (await this.fileExists(configPath)) {
          return configPath;
        }
      } catch (error) {
        // Continue to next path
      }
    }

    return null;
  }

  /**
   * Read configuration file content
   * @param {string} configPath - Path to configuration file
   * @returns {Promise<string>} File content
   */
  async readConfigurationFile(configPath) {
    try {
      const content = await fs.promises.readFile(configPath, 'utf8');
      return content;
    } catch (error) {
      throw new Error(`Failed to read configuration file ${configPath}: ${error.message}`);
    }
  }

  /**
   * Parse YAML configuration content
   * @param {string} content - YAML content
   * @returns {Object} Parsed configuration
   */
  parseConfiguration(content) {
    try {
      const parsed = yaml.load(content);
      
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Configuration must be a valid YAML object');
      }
      
      return parsed;
    } catch (error) {
      throw new Error(`Failed to parse YAML configuration: ${error.message}`);
    }
  }

  /**
   * Validate configuration structure
   * @param {Object} config - Configuration to validate
   * @returns {Object} Validation result
   */
  validateConfiguration(config) {
    const errors = [];
    const warnings = [];

    // Check required fields
    if (!config.version) {
      errors.push('Missing required field: version');
    }

    if (typeof config.enabled !== 'boolean') {
      errors.push('Missing or invalid field: enabled (must be boolean)');
    }

    // Validate global settings
    if (config.global) {
      const globalValidation = this.validateGlobalSettings(config.global);
      errors.push(...globalValidation.errors);
      warnings.push(...globalValidation.warnings);
    }

    // Validate environments
    if (config.environments) {
      const envValidation = this.validateEnvironments(config.environments);
      errors.push(...envValidation.errors);
      warnings.push(...envValidation.warnings);
    }

    // Validate rules
    if (config.rules) {
      const rulesValidation = this.validateRules(config.rules);
      errors.push(...rulesValidation.errors);
      warnings.push(...rulesValidation.warnings);
    }

    // Validate file filtering
    if (config.file_filtering) {
      const filterValidation = this.validateFileFiltering(config.file_filtering);
      errors.push(...filterValidation.errors);
      warnings.push(...filterValidation.warnings);
    }

    // Validate notifications
    if (config.notifications) {
      const notificationValidation = this.validateNotifications(config.notifications);
      errors.push(...notificationValidation.errors);
      warnings.push(...notificationValidation.warnings);
    }

    // Validate quality gates
    if (config.quality_gates) {
      const gateValidation = this.validateQualityGates(config.quality_gates);
      errors.push(...gateValidation.errors);
      warnings.push(...gateValidation.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate global settings
   * @param {Object} global - Global settings
   * @returns {Object} Validation result
   */
  validateGlobalSettings(global) {
    const errors = [];
    const warnings = [];

    const validSeverityLevels = ['LOW', 'MEDIUM', 'HIGH'];
    
    if (global.severity_threshold && !validSeverityLevels.includes(global.severity_threshold)) {
      errors.push(`Invalid severity_threshold: ${global.severity_threshold}. Must be one of: ${validSeverityLevels.join(', ')}`);
    }

    if (global.max_files_per_review !== undefined && (typeof global.max_files_per_review !== 'number' || global.max_files_per_review <= 0)) {
      errors.push('max_files_per_review must be a positive number');
    }

    if (global.max_file_size_bytes !== undefined && (typeof global.max_file_size_bytes !== 'number' || global.max_file_size_bytes <= 0)) {
      errors.push('max_file_size_bytes must be a positive number');
    }

    if (global.timeout_seconds !== undefined && (typeof global.timeout_seconds !== 'number' || global.timeout_seconds <= 0)) {
      errors.push('timeout_seconds must be a positive number');
    }

    return { errors, warnings };
  }

  /**
   * Validate environments configuration
   * @param {Object} environments - Environments configuration
   * @returns {Object} Validation result
   */
  validateEnvironments(environments) {
    const errors = [];
    const warnings = [];

    const validEnvironments = ['development', 'staging', 'production'];
    const validSeverityLevels = ['LOW', 'MEDIUM', 'HIGH'];

    for (const [envName, envConfig] of Object.entries(environments)) {
      if (!validEnvironments.includes(envName)) {
        warnings.push(`Unknown environment: ${envName}`);
      }

      if (envConfig.severity_threshold && !validSeverityLevels.includes(envConfig.severity_threshold)) {
        errors.push(`Invalid severity_threshold for ${envName}: ${envConfig.severity_threshold}. Must be one of: ${validSeverityLevels.join(', ')}`);
      }

      if (envConfig.rules) {
        const rulesValidation = this.validateRules(envConfig.rules);
        errors.push(...rulesValidation.errors.map(err => `${envName}: ${err}`));
        warnings.push(...rulesValidation.warnings.map(warn => `${envName}: ${warn}`));
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate rules configuration
   * @param {Object} rules - Rules configuration
   * @returns {Object} Validation result
   */
  validateRules(rules) {
    const errors = [];
    const warnings = [];

    const validRuleCategories = ['security', 'logic', 'performance', 'standards', 'maintainability'];
    const validPriorities = ['LOW', 'MEDIUM', 'HIGH'];

    for (const [ruleName, ruleConfig] of Object.entries(rules)) {
      if (!validRuleCategories.includes(ruleName)) {
        warnings.push(`Unknown rule category: ${ruleName}`);
      }

      if (typeof ruleConfig.enabled !== 'boolean') {
        errors.push(`Rule ${ruleName}: enabled must be a boolean`);
      }

      if (ruleConfig.priority && !validPriorities.includes(ruleConfig.priority)) {
        errors.push(`Rule ${ruleName}: Invalid priority ${ruleConfig.priority}`);
      }

      if (ruleConfig.checks && !Array.isArray(ruleConfig.checks)) {
        errors.push(`Rule ${ruleName}: checks must be an array`);
      }

      if (ruleConfig.excluded_files && !Array.isArray(ruleConfig.excluded_files)) {
        errors.push(`Rule ${ruleName}: excluded_files must be an array`);
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate file filtering configuration
   * @param {Object} filtering - File filtering configuration
   * @returns {Object} Validation result
   */
  validateFileFiltering(filtering) {
    const errors = [];
    const warnings = [];

    if (filtering.exclude_patterns !== undefined && !Array.isArray(filtering.exclude_patterns)) {
      errors.push('exclude_patterns must be an array');
    }

    if (filtering.include_patterns !== undefined && !Array.isArray(filtering.include_patterns)) {
      errors.push('include_patterns must be an array');
    }

    if (filtering.max_file_size_bytes !== undefined && (typeof filtering.max_file_size_bytes !== 'number' || filtering.max_file_size_bytes <= 0)) {
      errors.push('max_file_size_bytes must be a positive number');
    }

    if (filtering.max_files_per_review !== undefined && (typeof filtering.max_files_per_review !== 'number' || filtering.max_files_per_review <= 0)) {
      errors.push('max_files_per_review must be a positive number');
    }

    return { errors, warnings };
  }

  /**
   * Validate notifications configuration
   * @param {Object} notifications - Notifications configuration
   * @returns {Object} Validation result
   */
  validateNotifications(notifications) {
    const errors = [];
    const warnings = [];

    if (notifications.github_issues) {
      const github = notifications.github_issues;
      
      if (typeof github.enabled !== 'boolean') {
        errors.push('github_issues.enabled must be a boolean');
      }

      if (github.assign_to_team_lead && !github.team_lead_username) {
        warnings.push('github_issues.assign_to_team_lead is true but team_lead_username is not set');
      }
    }

    if (notifications.email) {
      const email = notifications.email;
      
      if (typeof email.enabled !== 'boolean') {
        errors.push('email.enabled must be a boolean');
      }

      if (email.enabled) {
        if (!email.smtp_host) errors.push('email.smtp_host is required when email is enabled');
        if (!email.smtp_user) errors.push('email.smtp_user is required when email is enabled');
        if (!email.smtp_pass) errors.push('email.smtp_pass is required when email is enabled');
        if (!email.to_emails || !Array.isArray(email.to_emails) || email.to_emails.length === 0) {
          errors.push('email.to_emails must be a non-empty array when email is enabled');
        }
      }
    }

    if (notifications.slack) {
      const slack = notifications.slack;
      
      if (typeof slack.enabled !== 'boolean') {
        errors.push('slack.enabled must be a boolean');
      }

      if (slack.enabled && !slack.webhook_url) {
        errors.push('slack.webhook_url is required when slack is enabled');
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate quality gates configuration
   * @param {Object} gates - Quality gates configuration
   * @returns {Object} Validation result
   */
  validateQualityGates(gates) {
    const errors = [];
    const warnings = [];

    if (typeof gates.enabled !== 'boolean') {
      errors.push('quality_gates.enabled must be a boolean');
    }

    if (typeof gates.block_high_severity !== 'boolean') {
      errors.push('quality_gates.block_high_severity must be a boolean');
    }

    if (typeof gates.block_medium_severity !== 'boolean') {
      errors.push('quality_gates.block_medium_severity must be a boolean');
    }

    if (typeof gates.allow_urgent_override !== 'boolean') {
      errors.push('quality_gates.allow_urgent_override must be a boolean');
    }

    if (gates.urgent_keywords && !Array.isArray(gates.urgent_keywords)) {
      errors.push('quality_gates.urgent_keywords must be an array');
    }

    if (gates.max_override_frequency && (typeof gates.max_override_frequency !== 'number' || gates.max_override_frequency <= 0)) {
      errors.push('quality_gates.max_override_frequency must be a positive number');
    }

    return { errors, warnings };
  }

  /**
   * Merge configuration with defaults
   * @param {Object} config - User configuration
   * @returns {Object} Merged configuration
   */
  mergeWithDefaults(config) {
    return this.deepMerge(this.defaultConfig, config);
  }

  /**
   * Deep merge two objects
   * @param {Object} target - Target object
   * @param {Object} source - Source object
   * @returns {Object} Merged object
   */
  deepMerge(target, source) {
    const result = { ...target };

    for (const [key, value] of Object.entries(source)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.deepMerge(result[key] || {}, value);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Get environment-specific configuration
   * @param {Object} config - Base configuration
   * @param {string} environment - Target environment
   * @returns {Object} Environment-specific configuration
   */
  getEnvironmentConfiguration(config, environment = null) {
    // Auto-detect environment if not specified
    if (!environment && this.options.autoDetectEnvironment) {
      environment = this.detectEnvironment();
    }

    // Use default environment if none specified
    if (!environment) {
      environment = 'development';
    }

    // Get environment-specific settings
    const envConfig = config.environments?.[environment] || {};
    
    // Merge with global settings
    const mergedConfig = {
      ...config,
      ...envConfig,
      current_environment: environment
    };

    // Override global settings with environment-specific ones
    if (envConfig.global) {
      mergedConfig.global = { ...mergedConfig.global, ...envConfig.global };
    }

    return mergedConfig;
  }

  /**
   * Detect current environment
   * @returns {string} Detected environment
   */
  detectEnvironment() {
    // Check environment variables
    const env = process.env.NODE_ENV || process.env.ENVIRONMENT || '';
    
    if (env.toLowerCase().includes('prod')) return 'production';
    if (env.toLowerCase().includes('stag')) return 'staging';
    if (env.toLowerCase().includes('dev')) return 'development';
    
    // Default to development
    return 'development';
  }

  /**
   * Get rule configuration for specific environment
   * @param {Object} config - Configuration
   * @param {string} ruleName - Rule name
   * @param {string} environment - Environment
   * @returns {Object} Rule configuration
   */
  getRuleConfiguration(config, ruleName, environment = null) {
    const env = environment || config.current_environment || 'development';
    
    // Get environment-specific rule config
    const envRuleConfig = config.environments?.[env]?.rules?.[ruleName];
    
    // Get global rule config
    const globalRuleConfig = config.rules?.[ruleName];
    
    // Merge configurations
    return {
      ...globalRuleConfig,
      ...envRuleConfig
    };
  }

  /**
   * Check if file exists
   * @param {string} filePath - File path
   * @returns {Promise<boolean>} Whether file exists
   */
  async fileExists(filePath) {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear configuration cache
   */
  clearCache() {
    this.configCache.clear();
    this.logInfo('Configuration cache cleared');
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      size: this.configCache.size,
      keys: Array.from(this.configCache.keys())
    };
  }

  /**
   * Log information message
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   */
  logInfo(message, ...args) {
    if (this.options.enableLogging && this.options.logLevel === 'INFO') {
      core.info(`[Config Parser] ${message}`, ...args);
    }
  }

  /**
   * Log warning message
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   */
  logWarning(message, ...args) {
    if (this.options.enableLogging) {
      core.warning(`[Config Parser] ${message}`, ...args);
    }
  }

  /**
   * Log error message
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   */
  logError(message, ...args) {
    if (this.options.enableLogging) {
      core.error(`[Config Parser] ${message}`, ...args);
    }
  }
}

module.exports = ConfigParser;
