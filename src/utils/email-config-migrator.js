/**
 * Email Configuration Migrator
 * 
 * Handles upgrading email configurations between different versions,
 * migrating from old formats, and providing backward compatibility.
 * 
 * @author AI Code Review System
 * @version 1.0.0
 * @last_updated 2024-12-19
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

class EmailConfigMigrator {
  constructor() {
    this.currentVersion = '2.0.0';
    this.supportedVersions = ['1.0.0', '1.5.0', '2.0.0'];
    this.migrationPath = [
      { from: '1.0.0', to: '1.5.0', handler: 'migrateFromV1ToV1_5' },
      { from: '1.5.0', to: '2.0.0', handler: 'migrateFromV1_5ToV2' }
    ];
    
    // Migration history
    this.migrationHistory = [];
  }

  /**
   * Detect configuration version
   */
  detectVersion(config) {
    if (config.version) {
      return config.version;
    }
    
    // Version detection based on structure
    if (config.email_triggers && config.email_templates) {
      return '2.0.0';
    } else if (config.triggers && config.templates) {
      return '1.5.0';
    } else if (config.smtp && config.to_emails) {
      return '1.0.0';
    }
    
    return '1.0.0'; // Default to oldest version
  }

  /**
   * Check if migration is needed
   */
  needsMigration(config) {
    const detectedVersion = this.detectVersion(config);
    return detectedVersion !== this.currentVersion;
  }

  /**
   * Get migration path
   */
  getMigrationPath(fromVersion, toVersion = this.currentVersion) {
    const path = [];
    let currentVersion = fromVersion;
    
    for (const migration of this.migrationPath) {
      if (migration.from === currentVersion && migration.to !== toVersion) {
        path.push(migration);
        currentVersion = migration.to;
      }
    }
    
    return path;
  }

  /**
   * Migrate configuration to latest version
   */
  async migrateConfiguration(config, targetVersion = this.currentVersion) {
    const currentVersion = this.detectVersion(config);
    
    if (currentVersion === targetVersion) {
      return {
        migrated: false,
        config: config,
        message: 'Configuration is already at target version'
      };
    }
    
    console.log(`🔄 Migrating email configuration from ${currentVersion} to ${targetVersion}...`);
    
    const migrationPath = this.getMigrationPath(currentVersion, targetVersion);
    
    if (migrationPath.length === 0) {
      return {
        migrated: false,
        config: config,
        error: `No migration path found from ${currentVersion} to ${targetVersion}`
      };
    }
    
    let migratedConfig = { ...config };
    
    for (const migration of migrationPath) {
      console.log(`  📋 Migrating from ${migration.from} to ${migration.to}...`);
      
      try {
        migratedConfig = await this[migration.handler](migratedConfig);
        
        // Record migration
        this.recordMigration(migration.from, migration.to, migratedConfig);
        
        console.log(`  ✅ Migration to ${migration.to} completed`);
        
      } catch (error) {
        console.error(`  ❌ Migration to ${migration.to} failed:`, error.message);
        throw new Error(`Migration from ${migration.from} to ${migration.to} failed: ${error.message}`);
      }
    }
    
    // Update version
    migratedConfig.version = targetVersion;
    migratedConfig.last_migrated = new Date().toISOString();
    
    console.log(`✅ Configuration migration completed successfully`);
    
    return {
      migrated: true,
      config: migratedConfig,
      message: `Successfully migrated from ${currentVersion} to ${targetVersion}`,
      migration_path: migrationPath.map(m => `${m.from} → ${m.to}`)
    };
  }

  /**
   * Migrate from version 1.0.0 to 1.5.0
   */
  async migrateFromV1ToV1_5(config) {
    console.log('    📝 Applying v1.0.0 → v1.5.0 migration...');
    
    const migratedConfig = { ...config };
    
    // Add new structure for triggers
    if (!migratedConfig.triggers) {
      migratedConfig.triggers = this.createV1_5Triggers(config);
    }
    
    // Add new structure for templates
    if (!migratedConfig.templates) {
      migratedConfig.templates = this.createV1_5Templates(config);
    }
    
    // Add notification settings
    if (!migratedConfig.notifications) {
      migratedConfig.notifications = {
        enabled: true,
        subject_prefix: '[AI Code Review]',
        include_attachments: false,
        max_attachment_size_mb: 10
      };
    }
    
    // Add rate limiting
    if (!migratedConfig.rate_limiting) {
      migratedConfig.rate_limiting = {
        max_emails_per_hour: 100,
        max_emails_per_minute: 10,
        cooldown_minutes: 5
      };
    }
    
    // Add logging
    if (!migratedConfig.logging) {
      migratedConfig.logging = {
        enabled: true,
        level: 'info',
        log_sent_emails: true,
        log_failed_emails: true
      };
    }
    
    return migratedConfig;
  }

  /**
   * Migrate from version 1.5.0 to 2.0.0
   */
  async migrateFromV1_5ToV2(config) {
    console.log('    📝 Applying v1.5.0 → v2.0.0 migration...');
    
    const migratedConfig = { ...config };
    
    // Restructure triggers to new format
    if (migratedConfig.triggers) {
      migratedConfig.email_triggers = {
        enabled: true,
        triggers: this.convertTriggersToV2(migratedConfig.triggers),
        conditions: this.createV2Conditions(),
        throttling: this.createV2Throttling(migratedConfig.rate_limiting),
        scheduling: this.createV2Scheduling()
      };
      
      // Remove old triggers
      delete migratedConfig.triggers;
    }
    
    // Restructure templates to new format
    if (migratedConfig.templates) {
      migratedConfig.email_templates = {
        base_path: './templates/email',
        default_language: 'en',
        supported_languages: ['en'],
        theme: 'default',
        branding: this.createV2Branding()
      };
      
      // Remove old templates
      delete migratedConfig.templates;
    }
    
    // Restructure notifications to general settings
    if (migratedConfig.notifications) {
      migratedConfig.general = {
        enabled: migratedConfig.notifications.enabled,
        subject_prefix: migratedConfig.notifications.subject_prefix,
        include_attachments: migratedConfig.notifications.include_attachments,
        max_attachment_size_mb: migratedConfig.notifications.max_attachment_size_mb,
        html_emails: true,
        text_emails: true
      };
      
      // Remove old notifications
      delete migratedConfig.notifications;
    }
    
    // Restructure rate limiting
    if (migratedConfig.rate_limiting) {
      // Rate limiting is now part of email_triggers.throttling
      delete migratedConfig.rate_limiting;
    }
    
    // Restructure logging
    if (migratedConfig.logging) {
      migratedConfig.logging = {
        enabled: migratedConfig.logging.enabled,
        level: migratedConfig.logging.level,
        log_sent_emails: migratedConfig.logging.log_sent_emails,
        log_failed_emails: migratedConfig.logging.log_failed_emails,
        retention_days: 30,
        max_log_size_mb: 100
      };
    }
    
    // Add new v2.0.0 features
    migratedConfig.security = {
      enable_encryption: false,
      require_authentication: true,
      allowed_domains: [],
      block_suspicious_emails: true
    };
    
    migratedConfig.analytics = {
      enabled: true,
      track_delivery_rates: true,
      track_open_rates: false,
      track_click_rates: false,
      retention_days: 90
    };
    
    return migratedConfig;
  }

  /**
   * Create v1.5 triggers structure
   */
  createV1_5Triggers(config) {
    return {
      review_failed: {
        enabled: true,
        events: ['review_failed'],
        template: 'review_failed',
        recipients: ['team', 'assignees'],
        conditions: {
          priority: { minimum: 'medium' },
          issue_count: { min: 1 }
        }
      },
      security_issue: {
        enabled: true,
        events: ['security_issue_detected'],
        template: 'security_issue',
        recipients: ['security_team', 'assignees'],
        conditions: {
          severity: { minimum: 'high' }
        }
      }
    };
  }

  /**
   * Create v1.5 templates structure
   */
  createV1_5Templates(config) {
    return {
      base_path: './templates/email',
      default_language: 'en',
      theme: 'default'
    };
  }

  /**
   * Convert triggers to v2 format
   */
  convertTriggersToV2(triggers) {
    const v2Triggers = {};
    
    for (const [name, trigger] of Object.entries(triggers)) {
      v2Triggers[name] = {
        enabled: trigger.enabled !== false,
        events: trigger.events || [],
        template: trigger.template || 'notification',
        recipients: trigger.recipients || [],
        conditions: trigger.conditions || {},
        subject_template: trigger.subject_template,
        delay_ms: trigger.delay_ms || 0
      };
    }
    
    return v2Triggers;
  }

  /**
   * Create v2 conditions structure
   */
  createV2Conditions() {
    return {
      priority: {
        levels: ['critical', 'high', 'medium', 'low'],
        default: 'medium'
      },
      severity: {
        levels: ['critical', 'high', 'medium', 'low'],
        default: 'medium'
      },
      file_count: {
        min: 1,
        max: 1000
      },
      issue_count: {
        min: 0,
        max: 100
      },
      score_threshold: {
        min: 0,
        max: 100
      }
    };
  }

  /**
   * Create v2 throttling structure
   */
  createV2Throttling(rateLimiting) {
    return {
      default: {
        min_interval_ms: 60000, // 1 minute
        max_per_hour: rateLimiting?.max_emails_per_hour || 100
      },
      security_issue: {
        min_interval_ms: 0, // No throttling for security issues
        max_per_hour: 100
      },
      review_failed: {
        min_interval_ms: 300000, // 5 minutes
        max_per_hour: rateLimiting?.max_emails_per_minute * 60 || 20
      }
    };
  }

  /**
   * Create v2 scheduling structure
   */
  createV2Scheduling() {
    return {
      default: {
        enabled: false,
        time_windows: [
          { start: 9, end: 17 } // Business hours
        ]
      },
      review_failed: {
        enabled: true,
        time_windows: [
          { start: 9, end: 17 } // Business hours only
        ]
      }
    };
  }

  /**
   * Create v2 branding structure
   */
  createV2Branding() {
    return {
      company_name: 'AI Code Review System',
      logo_url: null,
      primary_color: '#007cba',
      secondary_color: '#f0f0f0'
    };
  }

  /**
   * Record migration in history
   */
  recordMigration(fromVersion, toVersion, config) {
    const migration = {
      from_version: fromVersion,
      to_version: toVersion,
      timestamp: new Date().toISOString(),
      config_snapshot: this.createConfigSnapshot(config)
    };
    
    this.migrationHistory.push(migration);
    
    // Keep only last 10 migrations
    if (this.migrationHistory.length > 10) {
      this.migrationHistory = this.migrationHistory.slice(-10);
    }
  }

  /**
   * Create configuration snapshot
   */
  createConfigSnapshot(config) {
    return {
      smtp_configured: !!config.smtp,
      recipients_count: config.to_emails?.length || 0,
      triggers_count: Object.keys(config.email_triggers?.triggers || {}).length,
      templates_configured: !!config.email_templates,
      general_enabled: config.general?.enabled !== false
    };
  }

  /**
   * Validate migrated configuration
   */
  validateMigratedConfig(config) {
    const errors = [];
    const warnings = [];
    
    // Check required fields
    if (!config.smtp) {
      errors.push('SMTP configuration is missing');
    }
    
    if (!config.to_emails || config.to_emails.length === 0) {
      errors.push('No email recipients configured');
    }
    
    if (!config.email_triggers) {
      errors.push('Email triggers configuration is missing');
    }
    
    if (!config.email_templates) {
      errors.push('Email templates configuration is missing');
    }
    
    // Check SMTP required fields
    if (config.smtp) {
      const requiredSMTPFields = ['host', 'port', 'user', 'pass'];
      for (const field of requiredSMTPFields) {
        if (!config.smtp[field]) {
          errors.push(`SMTP ${field} is missing`);
        }
      }
    }
    
    // Check version
    if (!config.version) {
      warnings.push('Configuration version not set');
    }
    
    // Check for deprecated fields
    const deprecatedFields = ['triggers', 'templates', 'notifications', 'rate_limiting'];
    for (const field of deprecatedFields) {
      if (config[field]) {
        warnings.push(`Deprecated field '${field}' found - should be removed`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Create backup of original configuration
   */
  createBackup(config, backupPath) {
    try {
      const backup = {
        original_config: config,
        backup_timestamp: new Date().toISOString(),
        backup_reason: 'Migration to v2.0.0',
        original_version: this.detectVersion(config)
      };
      
      const backupContent = yaml.dump(backup, { 
        indent: 2, 
        lineWidth: 120,
        noRefs: true 
      });
      
      fs.writeFileSync(backupPath, backupContent, 'utf8');
      
      console.log(`💾 Backup created at: ${backupPath}`);
      return true;
      
    } catch (error) {
      console.error('❌ Failed to create backup:', error.message);
      return false;
    }
  }

  /**
   * Restore configuration from backup
   */
  async restoreFromBackup(backupPath) {
    try {
      if (!fs.existsSync(backupPath)) {
        throw new Error('Backup file not found');
      }
      
      const backupContent = fs.readFileSync(backupPath, 'utf8');
      const backup = yaml.load(backupContent);
      
      if (!backup.original_config) {
        throw new Error('Invalid backup format');
      }
      
      console.log(`🔄 Restoring configuration from backup (${backup.original_version})`);
      
      return {
        success: true,
        config: backup.original_config,
        version: backup.original_version,
        message: 'Configuration restored from backup'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get migration history
   */
  getMigrationHistory() {
    return this.migrationHistory;
  }

  /**
   * Get migration statistics
   */
  getMigrationStats() {
    const stats = {
      total_migrations: this.migrationHistory.length,
      last_migration: this.migrationHistory.length > 0 ? 
        this.migrationHistory[this.migrationHistory.length - 1] : null,
      version_distribution: {}
    };
    
    // Count migrations by version
    for (const migration of this.migrationHistory) {
      const toVersion = migration.to_version;
      stats.version_distribution[toVersion] = (stats.version_distribution[toVersion] || 0) + 1;
    }
    
    return stats;
  }

  /**
   * Export migration report
   */
  exportMigrationReport(format = 'json') {
    const report = {
      timestamp: new Date().toISOString(),
      current_version: this.currentVersion,
      supported_versions: this.supportedVersions,
      migration_history: this.migrationHistory,
      migration_stats: this.getMigrationStats()
    };
    
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(report, null, 2);
      case 'yaml':
        return yaml.dump(report, { indent: 2, lineWidth: 120 });
      case 'html':
        return this.convertToHTML(report);
      default:
        return JSON.stringify(report, null, 2);
    }
  }

  /**
   * Convert report to HTML
   */
  convertToHTML(report) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <title>Email Configuration Migration Report</title>
          <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
              .stats { margin: 20px 0; }
              .migration-item { margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 3px; }
              .version-badge { display: inline-block; padding: 4px 8px; background: #007cba; color: white; border-radius: 3px; font-size: 12px; }
          </style>
      </head>
      <body>
          <div class="header">
              <h1>Email Configuration Migration Report</h1>
              <p>Generated: ${new Date(report.timestamp).toLocaleString()}</p>
              <p>Current Version: <span class="version-badge">${report.current_version}</span></p>
          </div>
          
          <div class="stats">
              <h2>Migration Statistics</h2>
              <p>Total Migrations: ${report.migration_stats.total_migrations}</p>
              <p>Supported Versions: ${report.supported_versions.join(', ')}</p>
          </div>
          
          <h2>Migration History</h2>
          ${report.migration_history.map(migration => `
              <div class="migration-item">
                  <strong>${migration.from_version} → ${migration.to_version}</strong><br>
                  <small>${new Date(migration.timestamp).toLocaleString()}</small>
              </div>
          `).join('')}
      </body>
      </html>
    `;
  }

  /**
   * Check for configuration compatibility issues
   */
  checkCompatibility(config) {
    const issues = [];
    
    // Check for unsupported features
    if (config.smtp?.auth?.pass && config.smtp.auth.pass.length < 8) {
      issues.push({
        type: 'warning',
        message: 'SMTP password is very short - consider using a stronger password',
        field: 'smtp.auth.pass'
      });
    }
    
    // Check for deprecated SMTP settings
    if (config.smtp?.tls) {
      issues.push({
        type: 'warning',
        message: 'TLS setting is deprecated - use "secure" instead',
        field: 'smtp.tls',
        suggestion: 'Replace with smtp.secure: true'
      });
    }
    
    // Check for missing recommended settings
    if (!config.security) {
      issues.push({
        type: 'info',
        message: 'Security settings not configured - consider adding security configuration',
        field: 'security',
        suggestion: 'Add security configuration for enhanced email security'
      });
    }
    
    return issues;
  }

  /**
   * Generate migration recommendations
   */
  generateMigrationRecommendations(config) {
    const recommendations = [];
    const currentVersion = this.detectVersion(config);
    
    if (currentVersion !== this.currentVersion) {
      recommendations.push({
        priority: 'high',
        message: `Upgrade configuration from ${currentVersion} to ${this.currentVersion}`,
        action: 'Run migration to get latest features and security updates'
      });
    }
    
    // Check for missing modern features
    if (!config.email_triggers) {
      recommendations.push({
        priority: 'medium',
        message: 'Add email triggers for better notification control',
        action: 'Configure email triggers for different events and conditions'
      });
    }
    
    if (!config.email_templates) {
      recommendations.push({
        priority: 'medium',
        message: 'Add email templates for consistent messaging',
        action: 'Configure email templates for different notification types'
      });
    }
    
    if (!config.security) {
      recommendations.push({
        priority: 'medium',
        message: 'Add security configuration',
        action: 'Configure security settings for enhanced email security'
      });
    }
    
    return recommendations;
  }
}

module.exports = EmailConfigMigrator;


