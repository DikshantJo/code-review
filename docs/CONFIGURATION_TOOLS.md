# 🔧 Configuration Management Tools

This document describes the configuration management tools available in the AI Code Review system, including migration utilities and backup/restore capabilities.

## 📋 Overview

The AI Code Review system provides comprehensive configuration management tools to help maintain and evolve your configuration files:

- **Configuration Migration**: Automatically migrate configuration files between versions
- **Configuration Backup**: Create, manage, and restore configuration backups
- **CLI Tools**: Command-line interfaces for all configuration operations

## 🔄 Configuration Migration

### What is Configuration Migration?

Configuration migration automatically updates your configuration files to the latest format when new features are added to the system. This ensures:

- **Backward Compatibility**: Old configurations continue to work
- **Feature Access**: New features are automatically available
- **Consistency**: All configurations use the same format
- **Safety**: Automatic backups are created before migration

### Supported Migration Paths

| From Version | To Version | Changes Added |
|--------------|------------|---------------|
| 1.0 | 1.1 | Enhanced logging configuration, performance monitoring |
| 1.1 | 1.2 | Security scanning configuration, quality gates |

### Using the Migration CLI

#### Check Migration Status

```bash
# Check if migration is needed
npm run config:migrate check config/email-config.yml

# Check status of all configs in directory
npm run config:migrate status config/
```

#### Perform Migration

```bash
# Migrate to latest version
npm run config:migrate migrate config/email-config.yml

# Migrate to specific version
npm run config:migrate migrate -V 1.1 config/email-config.yml

# Dry run (no changes made)
npm run config:migrate migrate -d config/email-config.yml
```

#### Migration History

```bash
# View migration history
npm run config:migrate history config/email-config.yml

# Rollback to previous version
npm run config:migrate rollback -V 1.0 config/email-config.yml
```

### Migration CLI Options

| Option | Short | Description |
|--------|-------|-------------|
| `--help` | `-h` | Show help information |
| `--dry-run` | `-d` | Run without making changes |
| `--verbose` | `-v` | Enable verbose output |
| `--backup-dir` | `-b` | Backup directory (default: .backup) |
| `--version` | `-V` | Target version for migration |

## 💾 Configuration Backup & Restore

### What is Configuration Backup?

Configuration backup creates compressed archives of your configuration files with:

- **Automatic Compression**: ZIP archives with configurable compression levels
- **Metadata Tracking**: Detailed information about each backup
- **Integrity Validation**: Automatic verification of backup integrity
- **Version Management**: Automatic cleanup of old backups

### Using the Backup CLI

#### Create Backups

```bash
# Backup single configuration file
npm run config:backup backup config/email-config.yml

# Backup multiple files
npm run config:backup backup config/*.yml

# Backup with description
npm run config:backup backup -d "Before major update" config/*.yml

# Custom backup directory
npm run config:backup backup -b /custom/backup config/*.yml
```

#### Manage Backups

```bash
# List available backups
npm run config:backup list

# Show backup details
npm run config:backup info abc12345

# Validate backup integrity
npm run config:backup validate abc12345

# Show backup statistics
npm run config:backup stats
```

#### Restore Backups

```bash
# Restore to original location
npm run config:backup restore abc12345

# Restore to different directory
npm run config:backup restore -r /tmp/restore abc12345

# Overwrite existing files
npm run config:backup restore -o abc12345
```

#### Delete Backups

```bash
# Delete specific backup
npm run config:backup delete abc12345
```

### Backup CLI Options

| Option | Short | Description |
|--------|-------|-------------|
| `--help` | `-h` | Show help information |
| `--verbose` | `-v` | Enable verbose output |
| `--backup-dir` | `-b` | Backup directory (default: .backup) |
| `--max-backups` | `-m` | Maximum backups to keep (default: 10) |
| `--description` | `-d` | Description for backup |
| `--backup-id` | `-i` | Backup ID for operations |
| `--restore-dir` | `-r` | Directory to restore to |
| `--overwrite` | `-o` | Overwrite existing files during restore |

## 🏗️ Programmatic Usage

### Configuration Migration

```javascript
const ConfigMigration = require('./src/utils/config-migration');

const migration = new ConfigMigration({
  backupDir: '.backup',
  dryRun: false,
  verbose: true
});

// Check if migration is needed
const status = migration.checkMigrationNeeded('config.yml');
if (status.needsMigration) {
  // Perform migration
  const result = await migration.migrateConfig('config.yml');
  console.log(`Migration result: ${result.message}`);
}
```

### Configuration Backup

```javascript
const ConfigBackup = require('./src/utils/config-backup');

const backup = new ConfigBackup({
  backupDir: '.backup',
  maxBackups: 10,
  verbose: true
});

// Initialize backup system
await backup.initialize();

// Create backup
const result = await backup.createBackup(['config1.yml', 'config2.yml'], 'Monthly backup');
console.log(`Backup created: ${result.backupId}`);

// List backups
const backups = backup.listBackups();
console.log(`Available backups: ${backups.length}`);

// Restore backup
const restoreResult = await backup.restoreBackup(result.backupId);
console.log(`Restored ${restoreResult.restoredFiles.length} files`);
```

## 📁 File Structure

```
.github-review-plugin/
├── .backup/                    # Backup directory
│   ├── .backup-index.json     # Backup index file
│   └── config-backup-*.zip    # Backup archives
├── .migration-history.json    # Migration history
├── config/                    # Configuration files
│   ├── email-config.yml
│   ├── issue-creation-config.yml
│   └── debug-logging-config.yml
└── src/
    ├── cli/
    │   ├── config-migration-cli.js
    │   └── config-backup-cli.js
    └── utils/
        ├── config-migration.js
        └── config-backup.js
```

## 🔒 Security Considerations

### Backup Security

- **File Permissions**: Backups inherit file permissions from source files
- **Compression**: Archives are compressed but not encrypted
- **Access Control**: Ensure backup directory has appropriate access controls
- **Network Storage**: Consider network security when storing backups remotely

### Migration Security

- **Automatic Backups**: Migrations automatically create backups before changes
- **Rollback Capability**: Easy rollback to previous versions if needed
- **Validation**: Automatic validation of migrated configurations
- **Audit Trail**: Complete migration history is maintained

## 🚀 Best Practices

### Migration Best Practices

1. **Test First**: Use dry-run mode to preview changes
2. **Backup Before**: Always have recent backups before migration
3. **Review Changes**: Check migration logs for unexpected changes
4. **Validate After**: Verify configuration works after migration

### Backup Best Practices

1. **Regular Backups**: Create backups before major changes
2. **Descriptive Names**: Use meaningful descriptions for backups
3. **Retention Policy**: Configure appropriate max-backups setting
4. **Offsite Storage**: Consider storing backups in different locations
5. **Test Restores**: Periodically test restore functionality

### Configuration Organization

1. **Version Control**: Keep configurations in version control
2. **Environment Separation**: Use different configs for different environments
3. **Documentation**: Document custom configuration options
4. **Validation**: Use configuration validation tools

## 🐛 Troubleshooting

### Common Migration Issues

**Migration Fails with Permission Error**
```bash
# Check file permissions
ls -la config.yml

# Fix permissions if needed
chmod 644 config.yml
```

**Backup Creation Fails**
```bash
# Check disk space
df -h

# Check backup directory permissions
ls -la .backup/
```

**Restore Fails with File Exists Error**
```bash
# Use overwrite flag
npm run config:backup restore -o abc12345

# Or restore to different location
npm run config:backup restore -r /tmp/restore abc12345
```

### Getting Help

- **CLI Help**: Use `--help` flag with any command
- **Verbose Output**: Use `--verbose` flag for detailed logging
- **Dry Run**: Use `--dry-run` to preview operations
- **Logs**: Check console output for error details

## 📚 Related Documentation

- [Configuration Guide](./CONFIGURATION_GUIDE.md)
- [API Reference](./API_REFERENCE.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
- [Examples](./EXAMPLES.md)

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Initial | Basic configuration management |
| 1.1 | Update | Added migration and backup tools |
| 1.2 | Current | Enhanced CLI tools and validation |

---

For more information or to report issues, please refer to the main project documentation or create an issue in the project repository.
