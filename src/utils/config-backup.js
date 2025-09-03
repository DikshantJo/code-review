const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const archiver = require('archiver');
const yaml = require('js-yaml');

/**
 * Configuration Backup and Restore Utility
 * Handles backup, restore, and management of configuration files
 */
class ConfigBackup {
  constructor(options = {}) {
    this.options = {
      backupDir: options.backupDir || '.backup',
      maxBackups: options.maxBackups || 10,
      compressionLevel: options.compressionLevel || 6,
      includeMetadata: options.includeMetadata !== false,
      verbose: options.verbose || false,
      ...options
    };
    
    this.backupIndexFile = path.join(this.options.backupDir, '.backup-index.json');
    this.backupHistory = [];
  }

  /**
   * Initialize backup system
   */
  async initialize() {
    try {
      // Ensure backup directory exists
      if (!fs.existsSync(this.options.backupDir)) {
        fs.mkdirSync(this.options.backupDir, { recursive: true });
        this.log('📁 Created backup directory');
      }

      // Load existing backup index
      await this.loadBackupIndex();
      
      this.log('✅ Configuration backup system initialized');
      return true;
    } catch (error) {
      this.log(`❌ Failed to initialize backup system: ${error.message}`);
      return false;
    }
  }

  /**
   * Create backup of configuration files
   * @param {string|Array} configPaths - Path(s) to configuration files
   * @param {string} description - Optional description for the backup
   * @returns {Object} Backup result
   */
  async createBackup(configPaths, description = '') {
    try {
      const paths = Array.isArray(configPaths) ? configPaths : [configPaths];
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupId = this.generateBackupId();
      const backupName = `config-backup-${timestamp}-${backupId}`;
      const backupPath = path.join(this.options.backupDir, backupName);
      
      this.log(`🔄 Creating backup: ${backupName}`);

      // Validate all paths exist
      for (const configPath of paths) {
        if (!fs.existsSync(configPath)) {
          throw new Error(`Configuration file not found: ${configPath}`);
        }
      }

      // Create backup directory
      fs.mkdirSync(backupPath, { recursive: true });

      // Copy configuration files
      const copiedFiles = [];
      for (const configPath of paths) {
        const fileName = path.basename(configPath);
        const destPath = path.join(backupPath, fileName);
        
        fs.copyFileSync(configPath, destPath);
        copiedFiles.push({
          original: configPath,
          backup: destPath,
          size: fs.statSync(configPath).size
        });
      }

      // Create metadata file
      const metadata = {
        backupId,
        timestamp: new Date().toISOString(),
        description,
        files: copiedFiles,
        system: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch
        },
        options: this.options
      };

      const metadataPath = path.join(backupPath, 'backup-metadata.json');
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

      // Create compressed archive
      const archivePath = `${backupPath}.zip`;
      await this.createArchive(backupPath, archivePath);

      // Clean up uncompressed backup
      fs.rmSync(backupPath, { recursive: true, force: true });

      // Update backup index
      const backupEntry = {
        id: backupId,
        name: backupName,
        timestamp: metadata.timestamp,
        description,
        archivePath,
        fileCount: copiedFiles.length,
        totalSize: copiedFiles.reduce((sum, file) => sum + file.size, 0),
        compressedSize: fs.statSync(archivePath).size
      };

      this.backupHistory.push(backupEntry);
      await this.saveBackupIndex();

      // Clean up old backups if needed
      await this.cleanupOldBackups();

      this.log(`✅ Backup created successfully: ${archivePath}`);
      this.log(`   Files: ${copiedFiles.length}, Size: ${this.formatBytes(backupEntry.totalSize)}`);

      return {
        success: true,
        backupId,
        backupPath: archivePath,
        metadata: backupEntry
      };

    } catch (error) {
      this.log(`❌ Backup creation failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Restore configuration from backup
   * @param {string} backupId - Backup ID to restore from
   * @param {string} restoreDir - Directory to restore to (default: original location)
   * @param {boolean} overwrite - Whether to overwrite existing files
   * @returns {Object} Restore result
   */
  async restoreBackup(backupId, restoreDir = null, overwrite = false) {
    try {
      this.log(`🔄 Restoring backup: ${backupId}`);

      // Find backup in index
      const backupEntry = this.backupHistory.find(b => b.id === backupId);
      if (!backupEntry) {
        throw new Error(`Backup not found: ${backupId}`);
      }

      if (!fs.existsSync(backupEntry.archivePath)) {
        throw new Error(`Backup archive not found: ${backupEntry.archivePath}`);
      }

      // Extract backup
      const tempDir = path.join(this.options.backupDir, `temp-restore-${backupId}`);
      fs.mkdirSync(tempDir, { recursive: true });

      await this.extractArchive(backupEntry.archivePath, tempDir);

      // Read metadata
      const metadataPath = path.join(tempDir, 'backup-metadata.json');
      if (!fs.existsSync(metadataPath)) {
        throw new Error('Backup metadata not found');
      }

      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      const restoredFiles = [];

      // Restore files
      for (const fileInfo of metadata.files) {
        const fileName = path.basename(fileInfo.original);
        const sourcePath = path.join(tempDir, fileName);
        const targetPath = restoreDir ? path.join(restoreDir, fileName) : fileInfo.original;

        // Check if target file exists
        if (fs.existsSync(targetPath) && !overwrite) {
          throw new Error(`Target file exists and overwrite not allowed: ${targetPath}`);
        }

        // Ensure target directory exists
        const targetDir = path.dirname(targetPath);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        // Copy file
        fs.copyFileSync(sourcePath, targetPath);
        restoredFiles.push({
          original: fileInfo.original,
          restored: targetPath,
          size: fileInfo.size
        });

        this.log(`   📄 Restored: ${fileName}`);
      }

      // Clean up temp directory
      fs.rmSync(tempDir, { recursive: true, force: true });

      this.log(`✅ Backup restored successfully`);
      this.log(`   Files restored: ${restoredFiles.length}`);

      return {
        success: true,
        backupId,
        restoredFiles,
        metadata
      };

    } catch (error) {
      this.log(`❌ Backup restore failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * List available backups
   * @returns {Array} List of backup entries
   */
  listBackups() {
    return this.backupHistory.sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );
  }

  /**
   * Get backup details
   * @param {string} backupId - Backup ID
   * @returns {Object|null} Backup details
   */
  getBackupDetails(backupId) {
    return this.backupHistory.find(b => b.id === backupId) || null;
  }

  /**
   * Delete backup
   * @param {string} backupId - Backup ID to delete
   * @returns {Object} Delete result
   */
  async deleteBackup(backupId) {
    try {
      const backupEntry = this.backupHistory.find(b => b.id === backupId);
      if (!backupEntry) {
        throw new Error(`Backup not found: ${backupId}`);
      }

      // Remove archive file
      if (fs.existsSync(backupEntry.archivePath)) {
        fs.unlinkSync(backupEntry.archivePath);
      }

      // Remove from index
      this.backupHistory = this.backupHistory.filter(b => b.id !== backupId);
      await this.saveBackupIndex();

      this.log(`✅ Backup deleted: ${backupId}`);

      return {
        success: true,
        backupId
      };

    } catch (error) {
      this.log(`❌ Backup deletion failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate backup integrity
   * @param {string} backupId - Backup ID to validate
   * @returns {Object} Validation result
   */
  async validateBackup(backupId) {
    try {
      const backupEntry = this.backupHistory.find(b => b.id === backupId);
      if (!backupEntry) {
        throw new Error(`Backup not found: ${backupId}`);
      }

      if (!fs.existsSync(backupEntry.archivePath)) {
        throw new Error(`Backup archive not found: ${backupEntry.archivePath}`);
      }

      // Check file size
      const actualSize = fs.statSync(backupEntry.archivePath).size;
      if (actualSize !== backupEntry.compressedSize) {
        throw new Error(`Backup size mismatch: expected ${backupEntry.compressedSize}, got ${actualSize}`);
      }

      // Test archive extraction
      const tempDir = path.join(this.options.backupDir, `temp-validate-${backupId}`);
      fs.mkdirSync(tempDir, { recursive: true });

      try {
        await this.extractArchive(backupEntry.archivePath, tempDir);
        
        // Check metadata file
        const metadataPath = path.join(tempDir, 'backup-metadata.json');
        if (!fs.existsSync(metadataPath)) {
          throw new Error('Backup metadata not found');
        }

        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        
        // Check all files exist
        for (const fileInfo of metadata.files) {
          const fileName = path.basename(fileInfo.original);
          const filePath = path.join(tempDir, fileName);
          
          if (!fs.existsSync(filePath)) {
            throw new Error(`Backup file not found: ${fileName}`);
          }
        }

        // Clean up
        fs.rmSync(tempDir, { recursive: true, force: true });

        this.log(`✅ Backup validation passed: ${backupId}`);

        return {
          success: true,
          backupId,
          isValid: true,
          details: backupEntry
        };

      } catch (extractError) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        throw extractError;
      }

    } catch (error) {
      this.log(`❌ Backup validation failed: ${error.message}`);
      return {
        success: false,
        backupId,
        isValid: false,
        error: error.message
      };
    }
  }

  /**
   * Create compressed archive
   * @param {string} sourceDir - Source directory
   * @param {string} archivePath - Archive file path
   */
  async createArchive(sourceDir, archivePath) {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(archivePath);
      const archive = archiver('zip', {
        zlib: { level: this.options.compressionLevel }
      });

      output.on('close', () => resolve());
      archive.on('error', (err) => reject(err));

      archive.pipe(output);
      archive.directory(sourceDir, false);
      archive.finalize();
    });
  }

  /**
   * Extract compressed archive
   * @param {string} archivePath - Archive file path
   * @param {string} extractDir - Extraction directory
   */
  async extractArchive(archivePath, extractDir) {
    return new Promise((resolve, reject) => {
      const unzipper = require('unzipper');
      
      fs.createReadStream(archivePath)
        .pipe(unzipper.Extract({ path: extractDir }))
        .on('close', () => resolve())
        .on('error', (err) => reject(err));
    });
  }

  /**
   * Load backup index from file
   */
  async loadBackupIndex() {
    try {
      if (fs.existsSync(this.backupIndexFile)) {
        const indexData = fs.readFileSync(this.backupIndexFile, 'utf8');
        this.backupHistory = JSON.parse(indexData);
        this.log(`📚 Loaded ${this.backupHistory.length} backup entries`);
      } else {
        this.backupHistory = [];
        this.log('📚 No existing backup index found');
      }
    } catch (error) {
      this.log(`⚠️  Could not load backup index: ${error.message}`);
      this.backupHistory = [];
    }
  }

  /**
   * Save backup index to file
   */
  async saveBackupIndex() {
    try {
      const indexData = JSON.stringify(this.backupHistory, null, 2);
      fs.writeFileSync(this.backupIndexFile, indexData);
    } catch (error) {
      this.log(`⚠️  Could not save backup index: ${error.message}`);
    }
  }

  /**
   * Clean up old backups based on maxBackups setting
   */
  async cleanupOldBackups() {
    if (this.backupHistory.length <= this.options.maxBackups) {
      return;
    }

    // Sort by timestamp (oldest first)
    const sortedBackups = this.backupHistory.sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );

    const backupsToDelete = sortedBackups.slice(0, this.backupHistory.length - this.options.maxBackups);
    
    for (const backup of backupsToDelete) {
      this.log(`🗑️  Cleaning up old backup: ${backup.id}`);
      await this.deleteBackup(backup.id);
    }
  }

  /**
   * Generate unique backup ID
   * @returns {string} Backup ID
   */
  generateBackupId() {
    return crypto.randomBytes(8).toString('hex');
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
   * Log message if verbose mode is enabled
   * @param {string} message - Message to log
   */
  log(message) {
    if (this.options.verbose) {
      console.log(message);
    }
  }

  /**
   * Get backup statistics
   * @returns {Object} Backup statistics
   */
  getStatistics() {
    const totalBackups = this.backupHistory.length;
    const totalSize = this.backupHistory.reduce((sum, b) => sum + b.totalSize, 0);
    const totalCompressedSize = this.backupHistory.reduce((sum, b) => sum + b.compressedSize, 0);
    
    return {
      totalBackups,
      totalSize,
      totalCompressedSize,
      compressionRatio: totalSize > 0 ? ((totalSize - totalCompressedSize) / totalSize * 100).toFixed(2) : 0,
      averageBackupSize: totalBackups > 0 ? Math.round(totalSize / totalBackups) : 0,
      oldestBackup: totalBackups > 0 ? this.backupHistory[0].timestamp : null,
      newestBackup: totalBackups > 0 ? this.backupHistory[totalBackups - 1].timestamp : null
    };
  }
}

module.exports = ConfigBackup;
