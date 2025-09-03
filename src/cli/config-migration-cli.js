#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const ConfigMigration = require('../utils/config-migration');

/**
 * Configuration Migration CLI Tool
 * Provides command-line interface for configuration migration operations
 */
class ConfigMigrationCLI {
  constructor() {
    this.migration = new ConfigMigration({
      verbose: true
    });
  }

  /**
   * Parse command line arguments
   * @returns {Object} Parsed arguments
   */
  parseArguments() {
    const args = process.argv.slice(2);
    const options = {
      command: 'help',
      configPath: null,
      targetVersion: null,
      dryRun: false,
      verbose: false,
      backupDir: '.backup',
      help: false
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      switch (arg) {
        case '--help':
        case '-h':
          options.help = true;
          break;
        case '--dry-run':
        case '-d':
          options.dryRun = true;
          break;
        case '--verbose':
        case '-v':
          options.verbose = true;
          break;
        case '--backup-dir':
        case '-b':
          options.backupDir = args[++i];
          break;
        case '--version':
        case '-V':
          options.targetVersion = args[++i];
          break;
        case '--config':
        case '-c':
          options.configPath = args[++i];
          break;
        default:
          if (!options.command || options.command === 'help') {
            options.command = arg;
          } else if (!options.configPath) {
            options.configPath = arg;
          }
          break;
      }
    }

    return options;
  }

  /**
   * Show help information
   */
  showHelp() {
    console.log(`
🔧 AI Code Review Configuration Migration Tool

USAGE:
  node config-migration-cli.js <command> [options] [config-file]

COMMANDS:
  check       Check if configuration needs migration
  migrate     Migrate configuration to latest version
  status      Show migration status for directory
  rollback    Rollback to previous version
  history     Show migration history
  help        Show this help message

OPTIONS:
  -c, --config <path>     Configuration file path
  -V, --version <ver>     Target version for migration
  -d, --dry-run          Run without making changes
  -v, --verbose          Enable verbose output
  -b, --backup-dir <dir> Backup directory (default: .backup)
  -h, --help             Show help message

EXAMPLES:
  # Check if migration is needed
  node config-migration-cli.js check config/email-config.yml

  # Migrate configuration to latest version
  node config-migration-cli.js migrate config/email-config.yml

  # Migrate to specific version
  node config-migration-cli.js migrate -V 1.1 config/email-config.yml

  # Check status of all configs in directory
  node config-migration-cli.js status config/

  # Rollback to previous version
  node config-migration-cli.js rollback -V 1.0 config/email-config.yml

  # Show migration history
  node config-migration-cli.js history config/email-config.yml
`);
  }

  /**
   * Execute command
   * @param {Object} options - Command options
   */
  async execute(options) {
    if (options.help) {
      this.showHelp();
      return;
    }

    // Update migration options
    this.migration.options = {
      ...this.migration.options,
      dryRun: options.dryRun,
      verbose: options.verbose,
      backupDir: options.backupDir
    };

    try {
      switch (options.command) {
        case 'check':
          await this.checkMigration(options);
          break;
        case 'migrate':
          await this.migrateConfig(options);
          break;
        case 'status':
          await this.showStatus(options);
          break;
        case 'rollback':
          await this.rollbackConfig(options);
          break;
        case 'history':
          await this.showHistory(options);
          break;
        case 'help':
        default:
          this.showHelp();
          break;
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Check if migration is needed
   * @param {Object} options - Command options
   */
  async checkMigration(options) {
    if (!options.configPath) {
      throw new Error('Configuration file path is required');
    }

    console.log(`🔍 Checking migration status for: ${options.configPath}`);
    
    const status = this.migration.checkMigrationNeeded(options.configPath);
    
    if (status.error) {
      console.error(`❌ Error checking migration: ${status.error}`);
      return;
    }

    if (status.needsMigration) {
      console.log(`⚠️  Migration needed: ${status.currentVersion} → ${status.targetVersion}`);
      console.log(`   ${status.message}`);
      
      if (status.availableMigrations && status.availableMigrations.length > 0) {
        console.log('\n📦 Available migrations:');
        status.availableMigrations.forEach(migration => {
          console.log(`   • ${migration.from} → ${migration.to}: ${migration.description}`);
        });
      }
    } else {
      console.log(`✅ ${status.message}`);
    }
  }

  /**
   * Migrate configuration
   * @param {Object} options - Command options
   */
  async migrateConfig(options) {
    if (!options.configPath) {
      throw new Error('Configuration file path is required');
    }

    console.log(`🔄 Starting configuration migration...`);
    
    const result = await this.migration.migrateConfig(
      options.configPath, 
      options.targetVersion
    );

    if (result.success) {
      if (result.migrated) {
        console.log(`✅ ${result.message}`);
        console.log(`   Backup created: ${result.backupPath}`);
        
        if (result.changes) {
          console.log('\n📝 Changes made:');
          if (result.changes.added.length > 0) {
            console.log(`   Added: ${result.changes.added.join(', ')}`);
          }
          if (result.changes.modified.length > 0) {
            console.log(`   Modified: ${result.changes.modified.join(', ')}`);
          }
          if (result.changes.removed.length > 0) {
            console.log(`   Removed: ${result.changes.removed.join(', ')}`);
          }
        }
      } else {
        console.log(`ℹ️  ${result.message}`);
      }
    } else {
      console.error(`❌ ${result.message}`);
      if (result.error) {
        console.error(`   Error: ${result.error}`);
      }
    }
  }

  /**
   * Show migration status for directory
   * @param {Object} options - Command options
   */
  async showStatus(options) {
    const configDir = options.configPath || '.';
    
    console.log(`📊 Migration status for directory: ${configDir}`);
    
    const status = await this.migration.getDirectoryMigrationStatus(configDir);
    
    if (Object.keys(status).length === 0) {
      console.log('   No configuration files found');
      return;
    }

    for (const [filePath, fileStatus] of Object.entries(status)) {
      if (fileStatus.error) {
        console.log(`   ❌ ${filePath}: ${fileStatus.error}`);
      } else if (fileStatus.needsMigration) {
        console.log(`   ⚠️  ${filePath}: ${fileStatus.currentVersion} → ${fileStatus.targetVersion}`);
      } else {
        console.log(`   ✅ ${filePath}: ${fileStatus.message}`);
      }
    }
  }

  /**
   * Rollback configuration
   * @param {Object} options - Command options
   */
  async rollbackConfig(options) {
    if (!options.configPath) {
      throw new Error('Configuration file path is required');
    }
    
    if (!options.targetVersion) {
      throw new Error('Target version is required for rollback');
    }

    console.log(`🔄 Rolling back configuration to version: ${options.targetVersion}`);
    
    const result = await this.migration.rollbackConfig(
      options.configPath, 
      options.targetVersion
    );

    if (result.success) {
      console.log(`✅ ${result.message}`);
      console.log(`   Restored from: ${result.restoredFrom}`);
    } else {
      console.error(`❌ ${result.message}`);
      if (result.error) {
        console.error(`   Error: ${result.error}`);
      }
    }
  }

  /**
   * Show migration history
   * @param {Object} options - Command options
   */
  async showHistory(options) {
    if (!options.configPath) {
      throw new Error('Configuration file path is required');
    }

    console.log(`📚 Migration history for: ${options.configPath}`);
    
    const history = this.migration.getMigrationHistory(options.configPath);
    
    if (history.length === 0) {
      console.log('   No migration history found');
      return;
    }

    history.forEach((migration, index) => {
      console.log(`\n   Migration ${index + 1}:`);
      console.log(`   • From: ${migration.fromVersion}`);
      console.log(`   • To: ${migration.toVersion}`);
      console.log(`   • Date: ${migration.timestamp}`);
      console.log(`   • Backup: ${migration.backupPath}`);
      
      if (migration.changes) {
        console.log(`   • Changes:`);
        if (migration.changes.added.length > 0) {
          console.log(`     Added: ${migration.changes.added.join(', ')}`);
        }
        if (migration.changes.modified.length > 0) {
          console.log(`     Modified: ${migration.changes.modified.join(', ')}`);
        }
        if (migration.changes.removed.length > 0) {
          console.log(`     Removed: ${migration.changes.removed.join(', ')}`);
        }
      }
    });
  }

  /**
   * Main entry point
   */
  async run() {
    try {
      const options = this.parseArguments();
      await this.execute(options);
    } catch (error) {
      console.error(`❌ Fatal error: ${error.message}`);
      process.exit(1);
    }
  }
}

// Run CLI if this file is executed directly
if (require.main === module) {
  const cli = new ConfigMigrationCLI();
  cli.run();
}

module.exports = ConfigMigrationCLI;
