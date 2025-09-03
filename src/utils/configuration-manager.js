const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const ConfigLoader = require('./config-loader');

/**
 * Centralized Configuration Manager for AI Code Review System
 * Provides unified access to all configuration sources
 */
class ConfigurationManager {
  constructor(options = {}) {
    this.options = {
      configDir: options.configDir || '.',
      configFile: options.configFile || 'ai-review-config.yml',
      envFile: options.envFile || '.env',
      validateOnLoad: options.validateOnLoad !== false,
      watchForChanges: options.watchForChanges !== false,
      ...options
    };
    
    this.configLoader = new ConfigLoader(this.options);
    this.config = null;
    this.configWatchers = new Map();
    this.changeCallbacks = [];
    this.lastConfigHash = null;
    
    // Configuration cache
    this.cache = {
      config: null,
      timestamp: null,
      hash: null,
      ttl: 5 * 60 * 1000 // 5 minutes
    };
  }

  /**
   * Initialize configuration manager
   * @returns {Promise<Object>} Loaded configuration
   */
  async initialize() {
    try {
      console.log('🔧 Initializing Configuration Manager...');
      
      // Load configuration
      this.config = await this.configLoader.loadConfiguration();
      
      // Validate configuration
      await this.validateConfiguration();
      
      // Set up file watchers if enabled
      if (this.options.watchForChanges) {
        this.setupConfigWatchers();
      }
      
      // Generate configuration hash
      this.lastConfigHash = this.generateConfigHash(this.config);
      
      console.log('✅ Configuration Manager initialized successfully');
      console.log(`   Sources loaded: ${this.configLoader.loadedSources.length}`);
      console.log(`   Environment: ${this.config.environment || 'development'}`);
      
      return this.config;
      
    } catch (error) {
      console.error('❌ Failed to initialize Configuration Manager:', error.message);
      throw error;
    }
  }

  /**
   * Get configuration value with fallback support
   * @param {string} key - Configuration key (dot notation supported)
   * @param {*} defaultValue - Default value if key not found
   * @returns {*} Configuration value
   */
  get(key, defaultValue = undefined) {
    if (!this.config) {
      throw new Error('Configuration not initialized. Call initialize() first.');
    }
    
    const value = this.getNestedValue(this.config, key);
    return value !== undefined ? value : defaultValue;
  }

  /**
   * Get nested configuration value
   * @param {Object} obj - Object to search
   * @param {string} path - Dot notation path
   * @returns {*} Value at path
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Set configuration value
   * @param {string} key - Configuration key
   * @param {*} value - Value to set
   */
  set(key, value) {
    if (!this.config) {
      throw new Error('Configuration not initialized. Call initialize() first.');
    }
    
    const keys = key.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      return current[key];
    }, this.config);
    
    target[lastKey] = value;
    
    // Update hash
    this.lastConfigHash = this.generateConfigHash(this.config);
    
    // Notify change callbacks
    this.notifyConfigChange(key, value);
  }

  /**
   * Check if configuration key exists
   * @param {string} key - Configuration key
   * @returns {boolean} True if key exists
   */
  has(key) {
    if (!this.config) {
      return false;
    }
    
    return this.getNestedValue(this.config, key) !== undefined;
  }

  /**
   * Get all configuration
   * @returns {Object} Complete configuration
   */
  getAll() {
    if (!this.config) {
      throw new Error('Configuration not initialized. Call initialize() first.');
    }
    
    return JSON.parse(JSON.stringify(this.config));
  }

  /**
   * Get configuration section
   * @param {string} section - Section name
   * @returns {Object} Configuration section
   */
  getSection(section) {
    if (!this.config) {
      throw new Error('Configuration not initialized. Call initialize() first.');
    }
    
    return this.config[section] || {};
  }

  /**
   * Get environment-specific configuration
   * @param {string} environment - Environment name
   * @returns {Object} Environment-specific configuration
   */
  getEnvironmentConfig(environment) {
    if (!this.config) {
      throw new Error('Configuration not initialized. Call initialize() first.');
    }
    
    const envConfig = this.config.environments?.[environment];
    if (!envConfig) {
      return {};
    }
    
    // Merge with base config
    return this.mergeConfigurations([this.config, envConfig]);
  }

  /**
   * Get current environment configuration
   * @returns {Object} Current environment configuration
   */
  getCurrentEnvironmentConfig() {
    const currentEnv = this.get('environment') || process.env.NODE_ENV || 'development';
    return this.getEnvironmentConfig(currentEnv);
  }

  /**
   * Validate configuration
   * @returns {Promise<Object>} Validation result
   */
  async validateConfiguration() {
    try {
      const validation = this.configLoader.validateConfiguration(this.config);
      
      if (!validation.isValid) {
        console.warn('⚠️ Configuration validation warnings:', validation.warnings);
        if (validation.errors.length > 0) {
          throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
        }
      }
      
      return validation;
      
    } catch (error) {
      console.error('❌ Configuration validation failed:', error.message);
      throw error;
    }
  }

  /**
   * Reload configuration
   * @returns {Promise<Object>} Reloaded configuration
   */
  async reloadConfiguration() {
    try {
      console.log('🔄 Reloading configuration...');
      
      // Clear cache
      this.clearCache();
      
      // Reload configuration
      this.config = await this.configLoader.reloadConfiguration();
      
      // Validate configuration
      await this.validateConfiguration();
      
      // Update hash
      this.lastConfigHash = this.generateConfigHash(this.config);
      
      // Notify change callbacks
      this.notifyConfigChange('*', this.config);
      
      console.log('✅ Configuration reloaded successfully');
      
      return this.config;
      
    } catch (error) {
      console.error('❌ Failed to reload configuration:', error.message);
      throw error;
    }
  }

  /**
   * Export configuration to file
   * @param {string} filePath - File path to export to
   * @param {string} format - Export format (json, yaml)
   * @returns {Promise<string>} Exported file path
   */
  async exportConfiguration(filePath, format = 'yaml') {
    try {
      if (!this.config) {
        throw new Error('Configuration not initialized. Call initialize() first.');
      }
      
      const content = format === 'json' 
        ? JSON.stringify(this.config, null, 2)
        : yaml.dump(this.config, { indent: 2 });
      
      await fs.promises.writeFile(filePath, content, 'utf8');
      
      console.log(`✅ Configuration exported to: ${filePath}`);
      return filePath;
      
    } catch (error) {
      console.error('❌ Failed to export configuration:', error.message);
      throw error;
    }
  }

  /**
   * Import configuration from file
   * @param {string} filePath - File path to import from
   * @returns {Promise<Object>} Imported configuration
   */
  async importConfiguration(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`Configuration file not found: ${filePath}`);
      }
      
      const content = await fs.promises.readFile(filePath, 'utf8');
      const fileExt = path.extname(filePath).toLowerCase();
      
      let importedConfig;
      if (fileExt === '.json') {
        importedConfig = JSON.parse(content);
      } else if (['.yml', '.yaml'].includes(fileExt)) {
        importedConfig = yaml.load(content);
      } else {
        throw new Error(`Unsupported file format: ${fileExt}`);
      }
      
      // Validate imported configuration
      const validation = this.configLoader.validateConfiguration(importedConfig);
      if (!validation.isValid) {
        throw new Error(`Imported configuration validation failed: ${validation.errors.join(', ')}`);
      }
      
      // Update configuration
      this.config = importedConfig;
      this.lastConfigHash = this.generateConfigHash(this.config);
      
      console.log(`✅ Configuration imported from: ${filePath}`);
      return this.config;
      
    } catch (error) {
      console.error('❌ Failed to import configuration:', error.message);
      throw error;
    }
  }

  /**
   * Set up configuration file watchers
   */
  setupConfigWatchers() {
    try {
      const configPaths = [
        path.join(this.options.configDir, this.options.configFile),
        path.join(this.options.configDir, 'ai-review-config.yml'),
        path.join(this.options.configDir, 'ai-review-config.yaml')
      ];
      
      configPaths.forEach(configPath => {
        if (fs.existsSync(configPath)) {
          this.watchConfigFile(configPath);
        }
      });
      
      console.log('👀 Configuration file watchers set up');
      
    } catch (error) {
      console.warn('⚠️ Failed to set up configuration watchers:', error.message);
    }
  }

  /**
   * Watch individual configuration file
   * @param {string} filePath - File path to watch
   */
  watchConfigFile(filePath) {
    try {
      const watcher = fs.watch(filePath, (eventType, filename) => {
        if (eventType === 'change') {
          console.log(`📝 Configuration file changed: ${filename}`);
          this.handleConfigFileChange(filePath);
        }
      });
      
      this.configWatchers.set(filePath, watcher);
      
    } catch (error) {
      console.warn(`⚠️ Failed to watch config file ${filePath}:`, error.message);
    }
  }

  /**
   * Handle configuration file change
   * @param {string} filePath - Changed file path
   */
  async handleConfigFileChange(filePath) {
    try {
      // Debounce changes
      if (this.changeTimeout) {
        clearTimeout(this.changeTimeout);
      }
      
      this.changeTimeout = setTimeout(async () => {
        await this.reloadConfiguration();
      }, 1000); // 1 second debounce
      
    } catch (error) {
      console.error('❌ Failed to handle config file change:', error.message);
    }
  }

  /**
   * Add configuration change callback
   * @param {Function} callback - Callback function
   * @param {string} key - Optional key to watch (use '*' for all changes)
   */
  onConfigChange(callback, key = '*') {
    this.changeCallbacks.push({ callback, key });
  }

  /**
   * Remove configuration change callback
   * @param {Function} callback - Callback function to remove
   */
  offConfigChange(callback) {
    this.changeCallbacks = this.changeCallbacks.filter(cb => cb.callback !== callback);
  }

  /**
   * Notify configuration change callbacks
   * @param {string} key - Changed key
   * @param {*} value - New value
   */
  notifyConfigChange(key, value) {
    this.changeCallbacks.forEach(({ callback, watchKey }) => {
      if (watchKey === '*' || watchKey === key) {
        try {
          callback(key, value, this.config);
        } catch (error) {
          console.error('❌ Configuration change callback error:', error.message);
        }
      }
    });
  }

  /**
   * Generate configuration hash
   * @param {Object} config - Configuration object
   * @returns {string} Configuration hash
   */
  generateConfigHash(config) {
    const configStr = JSON.stringify(config);
    let hash = 0;
    
    for (let i = 0; i < configStr.length; i++) {
      const char = configStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString();
  }

  /**
   * Check if configuration has changed
   * @returns {boolean} True if configuration changed
   */
  hasConfigurationChanged() {
    if (!this.config || !this.lastConfigHash) {
      return false;
    }
    
    const currentHash = this.generateConfigHash(this.config);
    return currentHash !== this.lastConfigHash;
  }

  /**
   * Clear configuration cache
   */
  clearCache() {
    this.cache = {
      config: null,
      timestamp: null,
      hash: null,
      ttl: 5 * 60 * 1000
    };
  }

  /**
   * Get configuration summary
   * @returns {Object} Configuration summary
   */
  getConfigurationSummary() {
    if (!this.config) {
      return { error: 'Configuration not initialized' };
    }
    
    return {
      environment: this.config.environment || process.env.NODE_ENV || 'development',
      sources: this.configLoader.loadedSources,
      validation: this.configLoader.validationErrors,
      hash: this.lastConfigHash,
      lastModified: this.cache.timestamp,
      hasChanges: this.hasConfigurationChanged()
    };
  }

  /**
   * Get configuration statistics
   * @returns {Object} Configuration statistics
   */
  getConfigurationStats() {
    if (!this.config) {
      return { error: 'Configuration not initialized' };
    }
    
    const stats = {
      totalKeys: this.countConfigurationKeys(this.config),
      sections: Object.keys(this.config).length,
      environment: this.config.environment || 'development',
      sources: this.configLoader.loadedSources.length,
      validationErrors: this.configLoader.validationErrors.length
    };
    
    return stats;
  }

  /**
   * Count configuration keys recursively
   * @param {Object} obj - Object to count keys in
   * @returns {number} Total key count
   */
  countConfigurationKeys(obj) {
    if (typeof obj !== 'object' || obj === null) {
      return 0;
    }
    
    let count = Object.keys(obj).length;
    
    for (const value of Object.values(obj)) {
      if (typeof value === 'object' && value !== null) {
        count += this.countConfigurationKeys(value);
      }
    }
    
    return count;
  }

  /**
   * Merge configurations
   * @param {Array} configs - Array of configurations to merge
   * @returns {Object} Merged configuration
   */
  mergeConfigurations(configs) {
    return this.configLoader.mergeConfigurations(
      configs.map((config, index) => ({
        source: `merge_${index}`,
        config,
        priority: index + 1
      }))
    );
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    // Stop file watchers
    this.configWatchers.forEach((watcher, filePath) => {
      try {
        watcher.close();
        console.log(`👀 Stopped watching: ${filePath}`);
      } catch (error) {
        console.warn(`⚠️ Failed to stop watcher for ${filePath}:`, error.message);
      }
    });
    
    this.configWatchers.clear();
    
    // Clear callbacks
    this.changeCallbacks = [];
    
    // Clear cache
    this.clearCache();
    
    console.log('🧹 Configuration Manager cleaned up');
  }
}

module.exports = ConfigurationManager;

