const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * Configuration loader utility for AI Code Review system
 * Loads configuration from multiple sources with proper inheritance
 */
class ConfigLoader {
  constructor(options = {}) {
    this.options = {
      configDir: options.configDir || '.',
      configFile: options.configFile || 'ai-review-config.yml',
      envFile: options.envFile || '.env',
      validateOnLoad: options.validateOnLoad !== false,
      ...options
    };
    
    this.config = null;
    this.loadedSources = [];
    this.validationErrors = [];
  }

  /**
   * Load configuration from all available sources
   * @returns {Object} Merged configuration
   */
  async loadConfiguration() {
    const configs = [];
    
    try {
      // 1. Load default configuration
      const defaultConfig = this.loadDefaultConfig();
      configs.push({ source: 'default', config: defaultConfig, priority: 1 });
      
      // 2. Load project-level configuration file
      const projectConfig = await this.loadProjectConfig();
      if (projectConfig) {
        configs.push({ source: 'project', config: projectConfig, priority: 2 });
      }
      
      // 3. Load environment variables
      const envConfig = this.loadEnvironmentConfig();
      configs.push({ source: 'environment', config: envConfig, priority: 3 });
      
      // 4. Load command line arguments
      const cliConfig = this.loadCommandLineConfig();
      if (Object.keys(cliConfig).length > 0) {
        configs.push({ source: 'command_line', config: cliConfig, priority: 4 });
      }
      
      // 5. Merge configurations by priority
      this.config = this.mergeConfigurations(configs);
      
      // 6. Validate configuration if enabled
      if (this.options.validateOnLoad) {
        const validation = this.validateConfiguration(this.config);
        if (!validation.isValid) {
          console.warn('Configuration validation warnings:', validation.warnings);
          if (validation.errors.length > 0) {
            throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
          }
        }
      }
      
      // 7. Process environment-specific overrides
      this.config = this.applyEnvironmentOverrides(this.config);
      
      // 8. Set up configuration watchers
      this.setupConfigWatchers();
      
      return this.config;
      
    } catch (error) {
      console.error('Failed to load configuration:', error.message);
      throw error;
    }
  }

  /**
   * Load default configuration
   * @returns {Object} Default configuration
   */
  loadDefaultConfig() {
    return {
      notifications: {
        email: {
          enabled: false,
          smtp_host: 'smtp.gmail.com',
          smtp_port: 587,
          smtp_secure: false,
          from_email: 'ai-review@github.com',
          to_emails: [],
          rate_limiting: {
            max_per_hour: 10,
            max_per_day: 50,
            cooldown_minutes: 30
          }
        }
      },
      ai: {
        model: 'gpt-4',
        max_tokens: 4000,
        temperature: 0.1,
        timeout: 30000
      },
      review: {
        max_files: 100,
        max_file_size: 1024 * 1024, // 1MB
        quality_gates: {
          enabled: true,
          min_score: 0.7,
          max_issues: 10
        }
      },
      logging: {
        level: 'info',
        format: 'json',
        destination: 'console'
      }
    };
  }

  /**
   * Load project-level configuration file
   * @returns {Object|null} Project configuration or null if not found
   */
  async loadProjectConfig() {
    const configPaths = [
      path.join(this.options.configDir, this.options.configFile),
      path.join(this.options.configDir, 'ai-review-config.yml'),
      path.join(this.options.configDir, 'ai-review-config.yaml'),
      path.join(this.options.configDir, 'config', 'ai-review-config.yml'),
      path.join(process.cwd(), this.options.configFile),
      path.join(process.cwd(), 'ai-review-config.yml')
    ];
    
    for (const configPath of configPaths) {
      try {
        if (fs.existsSync(configPath)) {
          const content = fs.readFileSync(configPath, 'utf8');
          const config = yaml.load(content);
          
          // Process environment variable substitutions
          const processedConfig = this.processEnvironmentSubstitutions(config);
          
          this.loadedSources.push({
            type: 'file',
            path: configPath,
            timestamp: fs.statSync(configPath).mtime
          });
          
          console.log(`✅ Loaded configuration from: ${configPath}`);
          return processedConfig;
        }
      } catch (error) {
        console.warn(`Failed to load config from ${configPath}:`, error.message);
      }
    }
    
    console.log('ℹ️ No project configuration file found, using defaults');
    return null;
  }

  /**
   * Load configuration from environment variables
   * @returns {Object} Environment-based configuration
   */
  loadEnvironmentConfig() {
    const envConfig = {};
    
    // Email configuration
    if (process.env.SMTP_HOST) envConfig.smtp_host = process.env.SMTP_HOST;
    if (process.env.SMTP_PORT) envConfig.smtp_port = parseInt(process.env.SMTP_PORT);
    if (process.env.SMTP_USER) envConfig.smtp_user = process.env.SMTP_USER;
    if (process.env.SMTP_PASS) envConfig.smtp_pass = process.env.SMTP_PASS;
    if (process.env.SMTP_SECURE) envConfig.smtp_secure = process.env.SMTP_SECURE === 'true';
    if (process.env.EMAIL_FROM) envConfig.from_email = process.env.EMAIL_FROM;
    if (process.env.EMAIL_TO) envConfig.to_emails = process.env.EMAIL_TO.split(',').map(e => e.trim());
    
    // AI configuration
    if (process.env.AI_MODEL) envConfig.model = process.env.AI_MODEL;
    if (process.env.AI_MAX_TOKENS) envConfig.max_tokens = parseInt(process.env.AI_MAX_TOKENS);
    if (process.env.AI_TEMPERATURE) envConfig.temperature = parseFloat(process.env.AI_TEMPERATURE);
    if (process.env.AI_TIMEOUT) envConfig.timeout = parseInt(process.env.AI_TIMEOUT);
    
    // Review configuration
    if (process.env.REVIEW_MAX_FILES) envConfig.max_files = parseInt(process.env.REVIEW_MAX_FILES);
    if (process.env.REVIEW_MAX_FILE_SIZE) envConfig.max_file_size = parseInt(process.env.REVIEW_MAX_FILE_SIZE);
    if (process.env.REVIEW_MIN_SCORE) envConfig.min_score = parseFloat(process.env.REVIEW_MIN_SCORE);
    if (process.env.REVIEW_MAX_ISSUES) envConfig.max_issues = parseInt(process.env.REVIEW_MAX_ISSUES);
    
    // Logging configuration
    if (process.env.LOG_LEVEL) envConfig.level = process.env.LOG_LEVEL;
    if (process.env.LOG_FORMAT) envConfig.format = process.env.LOG_FORMAT;
    if (process.env.LOG_DESTINATION) envConfig.destination = process.env.LOG_DESTINATION;
    
    // Environment
    if (process.env.NODE_ENV) envConfig.environment = process.env.NODE_ENV;
    
    if (Object.keys(envConfig).length > 0) {
      this.loadedSources.push({
        type: 'environment',
        timestamp: new Date(),
        variables: Object.keys(envConfig)
      });
      
      console.log(`✅ Loaded configuration from environment variables: ${Object.keys(envConfig).join(', ')}`);
    }
    
    return envConfig;
  }

  /**
   * Load configuration from command line arguments
   * @returns {Object} Command line configuration
   */
  loadCommandLineConfig() {
    const cliConfig = {};
    const args = process.argv.slice(2);
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg.startsWith('--')) {
        const key = arg.slice(2);
        const value = args[i + 1];
        
        if (value && !value.startsWith('--')) {
          // Try to parse as JSON, number, or boolean
          try {
            cliConfig[key] = JSON.parse(value);
          } catch {
            // If not JSON, check if it's a number
            if (!isNaN(value)) {
              cliConfig[key] = parseFloat(value);
            } else if (value === 'true' || value === 'false') {
              cliConfig[key] = value === 'true';
            } else {
              cliConfig[key] = value;
            }
          }
          i++; // Skip the value
        } else {
          cliConfig[key] = true; // Flag without value
        }
      }
    }
    
    if (Object.keys(cliConfig).length > 0) {
      this.loadedSources.push({
        type: 'command_line',
        timestamp: new Date(),
        arguments: Object.keys(cliConfig)
      });
      
      console.log(`✅ Loaded configuration from command line: ${Object.keys(cliConfig).join(', ')}`);
    }
    
    return cliConfig;
  }

  /**
   * Process environment variable substitutions in configuration
   * @param {Object} config - Configuration object
   * @returns {Object} Processed configuration
   */
  processEnvironmentSubstitutions(config) {
    const processed = JSON.parse(JSON.stringify(config));
    
    const processValue = (value) => {
      if (typeof value === 'string') {
        // Replace ${VAR} or ${VAR:-default} patterns
        return value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
          const [name, defaultValue] = varName.split(':-');
          return process.env[name] || defaultValue || '';
        });
      } else if (Array.isArray(value)) {
        return value.map(processValue);
      } else if (typeof value === 'object' && value !== null) {
        const processed = {};
        for (const [key, val] of Object.entries(value)) {
          processed[key] = processValue(val);
        }
        return processed;
      }
      return value;
    };
    
    return processValue(processed);
  }

  /**
   * Merge configurations by priority
   * @param {Array} configs - Array of configuration objects with priority
   * @returns {Object} Merged configuration
   */
  mergeConfigurations(configs) {
    // Sort by priority (higher number = higher priority)
    configs.sort((a, b) => a.priority - b.priority);
    
    let merged = {};
    
    for (const { config } of configs) {
      merged = this.deepMerge(merged, config);
    }
    
    return merged;
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
   * Apply environment-specific overrides
   * @param {Object} config - Base configuration
   * @returns {Object} Configuration with environment overrides
   */
  applyEnvironmentOverrides(config) {
    const environment = config.environment || process.env.NODE_ENV || 'development';
    
    if (config.environments && config.environments[environment]) {
      const envOverrides = config.environments[environment];
      console.log(`✅ Applying environment-specific overrides for: ${environment}`);
      return this.deepMerge(config, envOverrides);
    }
    
    return config;
  }

  /**
   * Validate configuration
   * @param {Object} config - Configuration to validate
   * @returns {Object} Validation result
   */
  validateConfiguration(config) {
    const errors = [];
    const warnings = [];
    
    // Validate email configuration
    if (config.notifications?.email?.enabled) {
      const emailConfig = config.notifications.email;
      
      if (!emailConfig.smtp_host) {
        errors.push('SMTP_HOST is required when email notifications are enabled');
      }
      
      if (!emailConfig.smtp_user) {
        errors.push('SMTP_USER is required when email notifications are enabled');
      }
      
      if (!emailConfig.smtp_pass) {
        errors.push('SMTP_PASS is required when email notifications are enabled');
      }
      
      if (!emailConfig.to_emails || emailConfig.to_emails.length === 0) {
        errors.push('EMAIL_TO is required when email notifications are enabled');
      }
      
      // Validate email format
      if (emailConfig.to_emails) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const invalidEmails = emailConfig.to_emails.filter(email => !emailRegex.test(email));
        
        if (invalidEmails.length > 0) {
          errors.push(`Invalid email format(s): ${invalidEmails.join(', ')}`);
        }
      }
    }
    
    // Validate AI configuration
    if (config.ai) {
      if (config.ai.max_tokens && (config.ai.max_tokens < 1 || config.ai.max_tokens > 100000)) {
        warnings.push('AI max_tokens should be between 1 and 100000');
      }
      
      if (config.ai.temperature && (config.ai.temperature < 0 || config.ai.temperature > 2)) {
        warnings.push('AI temperature should be between 0 and 2');
      }
    }
    
    // Validate review configuration
    if (config.review) {
      if (config.review.max_files && config.review.max_files < 1) {
        warnings.push('Review max_files should be at least 1');
      }
      
      if (config.review.quality_gates?.min_score && 
          (config.review.quality_gates.min_score < 0 || config.review.quality_gates.min_score > 1)) {
        warnings.push('Quality gate min_score should be between 0 and 1');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors,
      warnings: warnings
    };
  }

  /**
   * Set up configuration file watchers
   */
  setupConfigWatchers() {
    // Implementation for watching config files for changes
    // This would be useful for hot-reloading configuration
  }

  /**
   * Get configuration summary
   * @returns {Object} Configuration summary
   */
  getConfigurationSummary() {
    return {
      loadedSources: this.loadedSources,
      environment: this.config?.environment || process.env.NODE_ENV || 'development',
      emailEnabled: this.config?.notifications?.email?.enabled || false,
      aiModel: this.config?.ai?.model || 'default',
      reviewMaxFiles: this.config?.review?.max_files || 'default',
      validationErrors: this.validationErrors
    };
  }

  /**
   * Reload configuration
   * @returns {Promise<Object>} Reloaded configuration
   */
  async reloadConfiguration() {
    this.config = null;
    this.loadedSources = [];
    this.validationErrors = [];
    
    return this.loadConfiguration();
  }
}

module.exports = ConfigLoader;

