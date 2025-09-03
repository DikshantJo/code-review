const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * Configuration Migration Utility
 * Handles migration of configuration files between different versions
 */
class ConfigMigration {
  constructor(options = {}) {
    this.options = {
      backupDir: options.backupDir || '.backup',
      dryRun: options.dryRun || false,
      verbose: options.verbose || false,
      ...options
    };
    
    this.migrationHistory = [];
    this.supportedVersions = ['1.0', '1.1', '1.2'];
    this.currentVersion = '1.2';
  }

  /**
   * Get migration history for a configuration file
   * @param {string} configPath - Path to configuration file
   * @returns {Array} Migration history
   */
  getMigrationHistory(configPath) {
    const historyFile = path.join(path.dirname(configPath), '.migration-history.json');
    
    try {
      if (fs.existsSync(historyFile)) {
        const history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
        return history[configPath] || [];
      }
    } catch (error) {
      this.log(`Warning: Could not read migration history: ${error.message}`);
    }
    
    return [];
  }

  /**
   * Save migration history
   * @param {string} configPath - Path to configuration file
   * @param {Object} migration - Migration details
   */
  saveMigrationHistory(configPath, migration) {
    const historyFile = path.join(path.dirname(configPath), '.migration-history.json');
    let history = {};
    
    try {
      if (fs.existsSync(historyFile)) {
        history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
      }
    } catch (error) {
      this.log(`Warning: Could not read existing migration history: ${error.message}`);
    }
    
    if (!history[configPath]) {
      history[configPath] = [];
    }
    
    history[configPath].push({
      ...migration,
      timestamp: new Date().toISOString(),
      version: this.currentVersion
    });
    
    try {
      fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
    } catch (error) {
      this.log(`Warning: Could not save migration history: ${error.message}`);
    }
  }

  /**
   * Check if configuration needs migration
   * @param {string} configPath - Path to configuration file
   * @returns {Object} Migration status
   */
  checkMigrationNeeded(configPath) {
    try {
      const config = this.loadConfig(configPath);
      const currentVersion = config.version || '1.0';
      
      if (currentVersion === this.currentVersion) {
        return {
          needsMigration: false,
          currentVersion,
          targetVersion: this.currentVersion,
          message: 'Configuration is up to date'
        };
      }
      
      const availableMigrations = this.getAvailableMigrations(currentVersion);
      
      return {
        needsMigration: true,
        currentVersion,
        targetVersion: this.currentVersion,
        availableMigrations,
        message: `Migration from ${currentVersion} to ${this.currentVersion} available`
      };
      
    } catch (error) {
      return {
        needsMigration: false,
        error: error.message,
        message: 'Could not determine migration status'
      };
    }
  }

  /**
   * Get available migrations for a version
   * @param {string} fromVersion - Source version
   * @returns {Array} Available migrations
   */
  getAvailableMigrations(fromVersion) {
    const migrations = [];
    const versionIndex = this.supportedVersions.indexOf(fromVersion);
    
    if (versionIndex === -1) {
      return migrations;
    }
    
    for (let i = versionIndex + 1; i < this.supportedVersions.length; i++) {
      migrations.push({
        from: this.supportedVersions[i - 1],
        to: this.supportedVersions[i],
        description: this.getMigrationDescription(this.supportedVersions[i - 1], this.supportedVersions[i])
      });
    }
    
    return migrations;
  }

  /**
   * Get migration description
   * @param {string} fromVersion - Source version
   * @param {string} toVersion - Target version
   * @returns {string} Migration description
   */
  getMigrationDescription(fromVersion, toVersion) {
    const descriptions = {
      '1.0-1.1': 'Added enhanced logging configuration and performance monitoring',
      '1.1-1.2': 'Added security scanning configuration and quality gates'
    };
    
    return descriptions[`${fromVersion}-${toVersion}`] || `Migration from ${fromVersion} to ${toVersion}`;
  }

  /**
   * Migrate configuration file
   * @param {string} configPath - Path to configuration file
   * @param {string} targetVersion - Target version (optional)
   * @returns {Object} Migration result
   */
  async migrateConfig(configPath, targetVersion = this.currentVersion) {
    try {
      this.log(`🔄 Starting configuration migration for: ${configPath}`);
      
      // Check if migration is needed
      const migrationStatus = this.checkMigrationNeeded(configPath);
      
      if (!migrationStatus.needsMigration) {
        return {
          success: true,
          message: migrationStatus.message,
          migrated: false
        };
      }
      
      // Create backup
      const backupPath = await this.createBackup(configPath);
      
      // Load current configuration
      const currentConfig = this.loadConfig(configPath);
      const currentVersion = currentConfig.version || '1.0';
      
      // Perform migrations
      let migratedConfig = { ...currentConfig };
      const migrations = this.getAvailableMigrations(currentVersion);
      
      for (const migration of migrations) {
        if (migration.to <= targetVersion) {
          this.log(`  📦 Migrating from ${migration.from} to ${migration.to}`);
          migratedConfig = await this.performMigration(migratedConfig, migration.from, migration.to);
        }
      }
      
      // Update version
      migratedConfig.version = targetVersion;
      
      // Save migrated configuration
      if (!this.options.dryRun) {
        this.saveConfig(configPath, migratedConfig);
        
        // Save migration history
        this.saveMigrationHistory(configPath, {
          fromVersion: currentVersion,
          toVersion: targetVersion,
          backupPath,
          changes: this.getMigrationChanges(currentConfig, migratedConfig)
        });
      }
      
      this.log(`✅ Configuration migration completed successfully`);
      
      return {
        success: true,
        message: `Migrated from ${currentVersion} to ${targetVersion}`,
        migrated: true,
        backupPath,
        changes: this.getMigrationChanges(currentConfig, migratedConfig)
      };
      
    } catch (error) {
      this.log(`❌ Configuration migration failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        message: 'Migration failed'
      };
    }
  }

  /**
   * Perform specific migration
   * @param {Object} config - Configuration object
   * @param {string} fromVersion - Source version
   * @param {string} toVersion - Target version
   * @returns {Object} Migrated configuration
   */
  async performMigration(config, fromVersion, toVersion) {
    const migrationKey = `${fromVersion}-${toVersion}`;
    
    switch (migrationKey) {
      case '1.0-1.1':
        return this.migrateFrom1_0To1_1(config);
      case '1.1-1.2':
        return this.migrateFrom1_1To1_2(config);
      default:
        this.log(`  ⚠️  No migration path from ${fromVersion} to ${toVersion}`);
        return config;
    }
  }

  /**
   * Migrate from version 1.0 to 1.1
   * @param {Object} config - Configuration object
   * @returns {Object} Migrated configuration
   */
  migrateFrom1_0To1_1(config) {
    const migrated = { ...config };
    
    // Add enhanced logging configuration
    if (!migrated.logging) {
      migrated.logging = {
        level: 'info',
        format: 'json',
        destinations: ['console', 'file'],
        retention: {
          days: 30,
          maxSize: '100MB'
        }
      };
    }
    
    // Add performance monitoring
    if (!migrated.monitoring) {
      migrated.monitoring = {
        enabled: true,
        metrics: ['response_time', 'token_usage', 'error_rate'],
        alerts: {
          response_time_threshold: 5000,
          error_rate_threshold: 0.05
        }
      };
    }
    
    return migrated;
  }

  /**
   * Migrate from version 1.1 to 1.2
   * @param {Object} config - Configuration object
   * @returns {Object} Migrated configuration
   */
  migrateFrom1_1To1_2(config) {
    const migrated = { ...config };
    
    // Add security scanning configuration
    if (!migrated.security) {
      migrated.security = {
        scanning: {
          enabled: true,
          rules: ['sql_injection', 'xss', 'path_traversal'],
          severity_threshold: 'medium'
        },
        compliance: {
          enabled: false,
          standards: ['OWASP', 'CWE']
        }
      };
    }
    
    // Add quality gates
    if (!migrated.quality_gates) {
      migrated.quality_gates = {
        enabled: true,
        thresholds: {
          test_coverage: 80,
          security_score: 90,
          performance_score: 85
        },
        blocking: {
          production: true,
          staging: false,
          development: false
        }
      };
    }
    
    return migrated;
  }

  /**
   * Get migration changes
   * @param {Object} oldConfig - Old configuration
   * @param {Object} newConfig - New configuration
   * @returns {Object} Changes summary
   */
  getMigrationChanges(oldConfig, newConfig) {
    const changes = {
      added: [],
      modified: [],
      removed: []
    };
    
    // Compare configurations and identify changes
    const allKeys = new Set([...Object.keys(oldConfig), ...Object.keys(newConfig)]);
    
    for (const key of allKeys) {
      if (!(key in oldConfig)) {
        changes.added.push(key);
      } else if (!(key in newConfig)) {
        changes.removed.push(key);
      } else if (JSON.stringify(oldConfig[key]) !== JSON.stringify(newConfig[key])) {
        changes.modified.push(key);
      }
    }
    
    return changes;
  }

  /**
   * Create backup of configuration file
   * @param {string} configPath - Path to configuration file
   * @returns {string} Backup file path
   */
  async createBackup(configPath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = path.basename(configPath, path.extname(configPath));
    const extension = path.extname(configPath);
    
    // Ensure backup directory exists
    const backupDir = path.resolve(this.options.backupDir);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const backupPath = path.join(backupDir, `${fileName}-${timestamp}${extension}`);
    
    if (!this.options.dryRun) {
      fs.copyFileSync(configPath, backupPath);
      this.log(`  💾 Backup created: ${backupPath}`);
    }
    
    return backupPath;
  }

  /**
   * Load configuration file
   * @param {string} configPath - Path to configuration file
   * @returns {Object} Configuration object
   */
  loadConfig(configPath) {
    const content = fs.readFileSync(configPath, 'utf8');
    const extension = path.extname(configPath).toLowerCase();
    
    if (extension === '.yml' || extension === '.yaml') {
      return yaml.load(content);
    } else if (extension === '.json') {
      return JSON.parse(content);
    } else {
      throw new Error(`Unsupported configuration format: ${extension}`);
    }
  }

  /**
   * Save configuration file
   * @param {string} configPath - Path to configuration file
   * @param {Object} config - Configuration object
   */
  saveConfig(configPath, config) {
    const extension = path.extname(configPath).toLowerCase();
    let content;
    
    if (extension === '.yml' || extension === '.yaml') {
      content = yaml.dump(config, { indent: 2, lineWidth: 120 });
    } else if (extension === '.json') {
      content = JSON.stringify(config, null, 2);
    } else {
      throw new Error(`Unsupported configuration format: ${extension}`);
    }
    
    fs.writeFileSync(configPath, content);
  }

  /**
   * Log message if verbose mode is enabled
   * @param {string} message - Message to log
   */
  log(message) {
    if (this.options.verbose) {
      console.log(message);
    }
  }

  /**
   * Get migration status for all configuration files in a directory
   * @param {string} configDir - Configuration directory
   * @returns {Object} Migration status for all files
   */
  async getDirectoryMigrationStatus(configDir) {
    const status = {};
    const configFiles = this.findConfigFiles(configDir);
    
    for (const configFile of configFiles) {
      const relativePath = path.relative(configDir, configFile);
      status[relativePath] = this.checkMigrationNeeded(configFile);
    }
    
    return status;
  }

  /**
   * Find all configuration files in a directory
   * @param {string} configDir - Configuration directory
   * @returns {Array} Array of configuration file paths
   */
  findConfigFiles(configDir) {
    const configFiles = [];
    const extensions = ['.yml', '.yaml', '.json'];
    
    if (!fs.existsSync(configDir)) {
      return configFiles;
    }
    
    const files = fs.readdirSync(configDir);
    
    for (const file of files) {
      const filePath = path.join(configDir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isFile() && extensions.includes(path.extname(file).toLowerCase())) {
        configFiles.push(filePath);
      }
    }
    
    return configFiles;
  }

  /**
   * Rollback to previous version
   * @param {string} configPath - Path to configuration file
   * @param {string} version - Version to rollback to
   * @returns {Object} Rollback result
   */
  async rollbackConfig(configPath, version) {
    try {
      this.log(`🔄 Rolling back configuration to version: ${version}`);
      
      const history = this.getMigrationHistory(configPath);
      const targetMigration = history.find(m => m.toVersion === version);
      
      if (!targetMigration) {
        throw new Error(`No migration history found for version ${version}`);
      }
      
      // Restore from backup
      if (fs.existsSync(targetMigration.backupPath)) {
        if (!this.options.dryRun) {
          fs.copyFileSync(targetMigration.backupPath, configPath);
          this.log(`✅ Configuration rolled back to version ${version}`);
        }
        
        return {
          success: true,
          message: `Rolled back to version ${version}`,
          restoredFrom: targetMigration.backupPath
        };
      } else {
        throw new Error(`Backup file not found: ${targetMigration.backupPath}`);
      }
      
    } catch (error) {
      this.log(`❌ Configuration rollback failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        message: 'Rollback failed'
      };
    }
  }
}

module.exports = ConfigMigration;
