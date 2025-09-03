#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const ConfigBackup = require('../utils/config-backup');

/**
 * Configuration Backup CLI Tool
 * Provides command-line interface for configuration backup operations
 */
class ConfigBackupCLI {
  constructor() {
    this.backup = new ConfigBackup({
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
      configPaths: [],
      description: '',
      backupId: null,
      restoreDir: null,
      overwrite: false,
      verbose: false,
      backupDir: '.backup',
      maxBackups: 10,
      help: false
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      switch (arg) {
        case '--help':
        case '-h':
          options.help = true;
          break;
        case '--verbose':
        case '-v':
          options.verbose = true;
          break;
        case '--backup-dir':
        case '-b':
          options.backupDir = args[++i];
          break;
        case '--max-backups':
        case '-m':
          options.maxBackups = parseInt(args[++i]);
          break;
        case '--description':
        case '-d':
          options.description = args[++i];
          break;
        case '--backup-id':
        case '-i':
          options.backupId = args[++i];
          break;
        case '--restore-dir':
        case '-r':
          options.restoreDir = args[++i];
          break;
        case '--overwrite':
        case '-o':
          options.overwrite = true;
          break;
        default:
          if (!options.command || options.command === 'help') {
            options.command = arg;
          } else if (options.command === 'backup' && !options.configPaths.length) {
            // For backup command, collect all remaining arguments as config paths
            while (i < args.length) {
              options.configPaths.push(args[i]);
              i++;
            }
            break;
          } else if (options.command === 'restore' && !options.backupId) {
            options.backupId = arg;
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
💾 AI Code Review Configuration Backup Tool

USAGE:
  node config-backup-cli.js <command> [options] [arguments]

COMMANDS:
  backup <config-files...>  Create backup of configuration files
  restore <backup-id>       Restore configuration from backup
  list                      List available backups
  info <backup-id>          Show backup details
  validate <backup-id>      Validate backup integrity
  delete <backup-id>        Delete backup
  stats                     Show backup statistics
  help                      Show this help message

OPTIONS:
  -b, --backup-dir <dir>     Backup directory (default: .backup)
  -m, --max-backups <num>    Maximum number of backups to keep (default: 10)
  -d, --description <text>   Description for backup
  -i, --backup-id <id>       Backup ID for operations
  -r, --restore-dir <dir>    Directory to restore to (default: original location)
  -o, --overwrite            Overwrite existing files during restore
  -v, --verbose              Enable verbose output
  -h, --help                 Show help message

EXAMPLES:
  # Create backup of configuration files
  node config-backup-cli.js backup config/email-config.yml config/issue-creation-config.yml

  # Create backup with description
  node config-backup-cli.js backup -d "Before major update" config/*.yml

  # List available backups
  node config-backup-cli.js list

  # Show backup details
  node config-backup-cli.js info abc12345

  # Restore configuration from backup
  node config-backup-cli.js restore abc12345

  # Restore to different directory
  node config-backup-cli.js restore -r /tmp/restore abc12345

  # Validate backup integrity
  node config-backup-cli.js validate abc12345

  # Delete backup
  node config-backup-cli.js delete abc12345

  # Show backup statistics
  node config-backup-cli.js stats
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

    // Update backup options
    this.backup.options = {
      ...this.backup.options,
      verbose: options.verbose,
      backupDir: options.backupDir,
      maxBackups: options.maxBackups
    };

    try {
      // Initialize backup system
      const initialized = await this.backup.initialize();
      if (!initialized) {
        throw new Error('Failed to initialize backup system');
      }

      switch (options.command) {
        case 'backup':
          await this.createBackup(options);
          break;
        case 'restore':
          await this.restoreBackup(options);
          break;
        case 'list':
          await this.listBackups(options);
          break;
        case 'info':
          await this.showBackupInfo(options);
          break;
        case 'validate':
          await this.validateBackup(options);
          break;
        case 'delete':
          await this.deleteBackup(options);
          break;
        case 'stats':
          await this.showStatistics(options);
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
   * Create backup
   * @param {Object} options - Command options
   */
  async createBackup(options) {
    if (!options.configPaths.length) {
      throw new Error('Configuration file path(s) are required for backup');
    }

    console.log(`🔄 Creating backup of ${options.configPaths.length} configuration file(s)...`);
    
    const result = await this.backup.createBackup(
      options.configPaths, 
      options.description
    );

    if (result.success) {
      console.log(`✅ Backup created successfully`);
      console.log(`   ID: ${result.backupId}`);
      console.log(`   Path: ${result.backupPath}`);
      console.log(`   Files: ${result.metadata.fileCount}`);
      console.log(`   Size: ${this.formatBytes(result.metadata.totalSize)}`);
      console.log(`   Compressed: ${this.formatBytes(result.metadata.compressedSize)}`);
    } else {
      console.error(`❌ Backup creation failed: ${result.error}`);
    }
  }

  /**
   * Restore backup
   * @param {Object} options - Command options
   */
  async restoreBackup(options) {
    if (!options.backupId) {
      throw new Error('Backup ID is required for restore');
    }

    console.log(`🔄 Restoring backup: ${options.backupId}`);
    
    const result = await this.backup.restoreBackup(
      options.backupId,
      options.restoreDir,
      options.overwrite
    );

    if (result.success) {
      console.log(`✅ Backup restored successfully`);
      console.log(`   Files restored: ${result.restoredFiles.length}`);
      
      if (result.restoredFiles.length > 0) {
        console.log('\n📄 Restored files:');
        result.restoredFiles.forEach(file => {
          console.log(`   • ${path.basename(file.original)} → ${file.restored}`);
        });
      }
    } else {
      console.error(`❌ Backup restore failed: ${result.error}`);
    }
  }

  /**
   * List backups
   * @param {Object} options - Command options
   */
  async listBackups(options) {
    console.log(`📚 Available backups:`);
    
    const backups = this.backup.listBackups();
    
    if (backups.length === 0) {
      console.log('   No backups found');
      return;
    }

    backups.forEach((backup, index) => {
      const date = new Date(backup.timestamp).toLocaleString();
      const size = this.formatBytes(backup.totalSize);
      const compressed = this.formatBytes(backup.compressedSize);
      
      console.log(`\n   ${index + 1}. ${backup.name}`);
      console.log(`      ID: ${backup.id}`);
      console.log(`      Date: ${date}`);
      console.log(`      Files: ${backup.fileCount}`);
      console.log(`      Size: ${size} (compressed: ${compressed})`);
      
      if (backup.description) {
        console.log(`      Description: ${backup.description}`);
      }
    });
  }

  /**
   * Show backup info
   * @param {Object} options - Command options
   */
  async showBackupInfo(options) {
    if (!options.backupId) {
      throw new Error('Backup ID is required');
    }

    const backup = this.backup.getBackupDetails(options.backupId);
    
    if (!backup) {
      console.error(`❌ Backup not found: ${options.backupId}`);
      return;
    }

    console.log(`📋 Backup Details: ${backup.name}`);
    console.log(`   ID: ${backup.id}`);
    console.log(`   Date: ${new Date(backup.timestamp).toLocaleString()}`);
    console.log(`   Files: ${backup.fileCount}`);
    console.log(`   Size: ${this.formatBytes(backup.totalSize)}`);
    console.log(`   Compressed: ${this.formatBytes(backup.compressedSize)}`);
    console.log(`   Path: ${backup.archivePath}`);
    
    if (backup.description) {
      console.log(`   Description: ${backup.description}`);
    }

    // Validate backup integrity
    console.log('\n🔍 Validating backup integrity...');
    const validation = await this.backup.validateBackup(options.backupId);
    
    if (validation.success && validation.isValid) {
      console.log('   ✅ Backup integrity: Valid');
    } else {
      console.log('   ❌ Backup integrity: Invalid');
      if (validation.error) {
        console.log(`      Error: ${validation.error}`);
      }
    }
  }

  /**
   * Validate backup
   * @param {Object} options - Command options
   */
  async validateBackup(options) {
    if (!options.backupId) {
      throw new Error('Backup ID is required');
    }

    console.log(`🔍 Validating backup: ${options.backupId}`);
    
    const result = await this.backup.validateBackup(options.backupId);

    if (result.success && result.isValid) {
      console.log(`✅ Backup validation passed`);
      console.log(`   ID: ${result.backupId}`);
      console.log(`   Files: ${result.details.fileCount}`);
      console.log(`   Size: ${this.formatBytes(result.details.totalSize)}`);
    } else {
      console.error(`❌ Backup validation failed: ${result.error}`);
    }
  }

  /**
   * Delete backup
   * @param {Object} options - Command options
   */
  async deleteBackup(options) {
    if (!options.backupId) {
      throw new Error('Backup ID is required');
    }

    console.log(`🗑️  Deleting backup: ${options.backupId}`);
    
    const result = await this.backup.deleteBackup(options.backupId);

    if (result.success) {
      console.log(`✅ Backup deleted successfully`);
      console.log(`   ID: ${result.backupId}`);
    } else {
      console.error(`❌ Backup deletion failed: ${result.error}`);
    }
  }

  /**
   * Show statistics
   * @param {Object} options - Command options
   */
  async showStatistics(options) {
    console.log(`📊 Backup Statistics:`);
    
    const stats = this.backup.getStatistics();
    
    console.log(`   Total backups: ${stats.totalBackups}`);
    console.log(`   Total size: ${this.formatBytes(stats.totalSize)}`);
    console.log(`   Compressed size: ${this.formatBytes(stats.totalCompressedSize)}`);
    console.log(`   Compression ratio: ${stats.compressionRatio}%`);
    console.log(`   Average backup size: ${this.formatBytes(stats.averageBackupSize)}`);
    
    if (stats.oldestBackup) {
      console.log(`   Oldest backup: ${new Date(stats.oldestBackup).toLocaleDateString()}`);
    }
    
    if (stats.newestBackup) {
      console.log(`   Newest backup: ${new Date(stats.newestBackup).toLocaleDateString()}`);
    }
  }

  /**
   * Format bytes to human readable format
   * @param {number} bytes - Bytes to format
   * @returns {string} Formatted string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
  const cli = new ConfigBackupCLI();
  cli.run();
}

module.exports = ConfigBackupCLI;
