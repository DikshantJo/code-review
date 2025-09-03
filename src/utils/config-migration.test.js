const fs = require('fs');
const path = require('path');
const ConfigMigration = require('./config-migration');

// Mock fs module
jest.mock('fs');

describe('ConfigMigration', () => {
  let configMigration;
  let mockConfig;

  beforeEach(() => {
    configMigration = new ConfigMigration({
      backupDir: '.backup',
      dryRun: false,
      verbose: false
    });

    mockConfig = {
      version: '1.0',
      enabled: true,
      settings: {
        timeout: 5000
      }
    };

    // Reset fs mocks
    fs.existsSync.mockReset();
    fs.readFileSync.mockReset();
    fs.writeFileSync.mockReset();
    fs.mkdirSync.mockReset();
    fs.copyFileSync.mockReset();
    fs.readdirSync.mockReset();
    fs.statSync.mockReset();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const migration = new ConfigMigration();
      
      expect(migration.options.backupDir).toBe('.backup');
      expect(migration.options.dryRun).toBe(false);
      expect(migration.options.verbose).toBe(false);
      expect(migration.currentVersion).toBe('1.2');
      expect(migration.supportedVersions).toEqual(['1.0', '1.1', '1.2']);
    });

    it('should initialize with custom options', () => {
      const migration = new ConfigMigration({
        backupDir: '/custom/backup',
        dryRun: true,
        verbose: true
      });
      
      expect(migration.options.backupDir).toBe('/custom/backup');
      expect(migration.options.dryRun).toBe(true);
      expect(migration.options.verbose).toBe(true);
    });
  });

  describe('checkMigrationNeeded', () => {
    it('should return no migration needed for current version', () => {
      const configPath = '/test/config.yml';
      const configContent = 'version: "1.2"\nenabled: true';
      
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(configContent);
      
      const result = configMigration.checkMigrationNeeded(configPath);
      
      expect(result.needsMigration).toBe(false);
      expect(result.currentVersion).toBe('1.2');
      expect(result.targetVersion).toBe('1.2');
      expect(result.message).toBe('Configuration is up to date');
    });

    it('should return migration needed for older version', () => {
      const configPath = '/test/config.yml';
      const configContent = 'version: "1.0"\nenabled: true';
      
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(configContent);
      
      const result = configMigration.checkMigrationNeeded(configPath);
      
      expect(result.needsMigration).toBe(true);
      expect(result.currentVersion).toBe('1.0');
      expect(result.targetVersion).toBe('1.2');
      expect(result.message).toBe('Migration from 1.0 to 1.2 available');
      expect(result.availableMigrations).toHaveLength(2);
    });

    it('should handle missing version field', () => {
      const configPath = '/test/config.yml';
      const configContent = 'enabled: true';
      
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(configContent);
      
      const result = configMigration.checkMigrationNeeded(configPath);
      
      expect(result.needsMigration).toBe(true);
      expect(result.currentVersion).toBe('1.0');
      expect(result.targetVersion).toBe('1.2');
    });

    it('should handle file read errors', () => {
      const configPath = '/test/config.yml';
      
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('File read error');
      });
      
      const result = configMigration.checkMigrationNeeded(configPath);
      
      expect(result.needsMigration).toBe(false);
      expect(result.error).toBe('File read error');
      expect(result.message).toBe('Could not determine migration status');
    });
  });

  describe('getAvailableMigrations', () => {
    it('should return empty array for current version', () => {
      const migrations = configMigration.getAvailableMigrations('1.2');
      expect(migrations).toHaveLength(0);
    });

    it('should return migrations for version 1.0', () => {
      const migrations = configMigration.getAvailableMigrations('1.0');
      
      expect(migrations).toHaveLength(2);
      expect(migrations[0]).toEqual({
        from: '1.0',
        to: '1.1',
        description: 'Added enhanced logging configuration and performance monitoring'
      });
      expect(migrations[1]).toEqual({
        from: '1.1',
        to: '1.2',
        description: 'Added security scanning configuration and quality gates'
      });
    });

    it('should return migrations for version 1.1', () => {
      const migrations = configMigration.getAvailableMigrations('1.1');
      
      expect(migrations).toHaveLength(1);
      expect(migrations[0]).toEqual({
        from: '1.1',
        to: '1.2',
        description: 'Added security scanning configuration and quality gates'
      });
    });

    it('should return empty array for unsupported version', () => {
      const migrations = configMigration.getAvailableMigrations('0.9');
      expect(migrations).toHaveLength(0);
    });
  });

  describe('performMigration', () => {
    it('should migrate from 1.0 to 1.1', async () => {
      const config = { version: '1.0', enabled: true };
      
      const result = await configMigration.performMigration(config, '1.0', '1.1');
      
      expect(result.version).toBe('1.0');
      expect(result.enabled).toBe(true);
      expect(result.logging).toBeDefined();
      expect(result.logging.level).toBe('info');
      expect(result.monitoring).toBeDefined();
      expect(result.monitoring.enabled).toBe(true);
    });

    it('should migrate from 1.1 to 1.2', async () => {
      const config = { 
        version: '1.1', 
        enabled: true,
        logging: { level: 'debug' },
        monitoring: { enabled: false }
      };
      
      const result = await configMigration.performMigration(config, '1.1', '1.2');
      
      expect(result.version).toBe('1.1');
      expect(result.enabled).toBe(true);
      expect(result.logging.level).toBe('debug');
      expect(result.monitoring.enabled).toBe(false);
      expect(result.security).toBeDefined();
      expect(result.security.scanning.enabled).toBe(true);
      expect(result.quality_gates).toBeDefined();
      expect(result.quality_gates.enabled).toBe(true);
    });

    it('should handle unknown migration path', async () => {
      const config = { version: '1.0', enabled: true };
      
      const result = await configMigration.performMigration(config, '1.0', '1.3');
      
      expect(result).toEqual(config);
    });
  });

  describe('migrateFrom1_0To1_1', () => {
    it('should add logging and monitoring configuration', () => {
      const config = { version: '1.0', enabled: true };
      
      const result = configMigration.migrateFrom1_0To1_1(config);
      
      expect(result.logging).toBeDefined();
      expect(result.logging.level).toBe('info');
      expect(result.logging.format).toBe('json');
      expect(result.logging.destinations).toEqual(['console', 'file']);
      expect(result.logging.retention.days).toBe(30);
      expect(result.logging.retention.maxSize).toBe('100MB');
      
      expect(result.monitoring).toBeDefined();
      expect(result.monitoring.enabled).toBe(true);
      expect(result.monitoring.metrics).toEqual(['response_time', 'token_usage', 'error_rate']);
      expect(result.monitoring.alerts.response_time_threshold).toBe(5000);
      expect(result.monitoring.alerts.error_rate_threshold).toBe(0.05);
    });

    it('should preserve existing configuration', () => {
      const config = { 
        version: '1.0', 
        enabled: true,
        custom: 'value'
      };
      
      const result = configMigration.migrateFrom1_0To1_1(config);
      
      expect(result.version).toBe('1.0');
      expect(result.enabled).toBe(true);
      expect(result.custom).toBe('value');
    });
  });

  describe('migrateFrom1_1To1_2', () => {
    it('should add security and quality gates configuration', () => {
      const config = { version: '1.1', enabled: true };
      
      const result = configMigration.migrateFrom1_1To1_2(config);
      
      expect(result.security).toBeDefined();
      expect(result.security.scanning.enabled).toBe(true);
      expect(result.security.scanning.rules).toEqual(['sql_injection', 'xss', 'path_traversal']);
      expect(result.security.scanning.severity_threshold).toBe('medium');
      expect(result.security.compliance.enabled).toBe(false);
      expect(result.security.compliance.standards).toEqual(['OWASP', 'CWE']);
      
      expect(result.quality_gates).toBeDefined();
      expect(result.quality_gates.enabled).toBe(true);
      expect(result.quality_gates.thresholds.test_coverage).toBe(80);
      expect(result.quality_gates.thresholds.security_score).toBe(90);
      expect(result.quality_gates.thresholds.performance_score).toBe(85);
      expect(result.quality_gates.blocking.production).toBe(true);
      expect(result.quality_gates.blocking.staging).toBe(false);
      expect(result.quality_gates.blocking.development).toBe(false);
    });

    it('should preserve existing configuration', () => {
      const config = { 
        version: '1.1', 
        enabled: true,
        logging: { level: 'debug' },
        monitoring: { enabled: false }
      };
      
      const result = configMigration.migrateFrom1_1To1_2(config);
      
      expect(result.version).toBe('1.1');
      expect(result.enabled).toBe(true);
      expect(result.logging.level).toBe('debug');
      expect(result.monitoring.enabled).toBe(false);
    });
  });

  describe('getMigrationChanges', () => {
    it('should detect added fields', () => {
      const oldConfig = { version: '1.0', enabled: true };
      const newConfig = { version: '1.1', enabled: true, logging: {} };
      
      const changes = configMigration.getMigrationChanges(oldConfig, newConfig);
      
      expect(changes.added).toContain('logging');
      expect(changes.modified).toHaveLength(0);
      expect(changes.removed).toHaveLength(0);
    });

    it('should detect modified fields', () => {
      const oldConfig = { version: '1.0', enabled: true };
      const newConfig = { version: '1.1', enabled: false };
      
      const changes = configMigration.getMigrationChanges(oldConfig, newConfig);
      
      expect(changes.added).toHaveLength(0);
      expect(changes.modified).toContain('enabled');
      expect(changes.removed).toHaveLength(0);
    });

    it('should detect removed fields', () => {
      const oldConfig = { version: '1.0', enabled: true, deprecated: true };
      const newConfig = { version: '1.1', enabled: true };
      
      const changes = configMigration.getMigrationChanges(oldConfig, newConfig);
      
      expect(changes.added).toHaveLength(0);
      expect(changes.modified).toHaveLength(0);
      expect(changes.removed).toContain('deprecated');
    });

    it('should handle nested objects', () => {
      const oldConfig = { 
        version: '1.0', 
        settings: { timeout: 5000, retries: 3 }
      };
      const newConfig = { 
        version: '1.1', 
        settings: { timeout: 10000, retries: 3, maxConnections: 10 }
      };
      
      const changes = configMigration.getMigrationChanges(oldConfig, newConfig);
      
      expect(changes.added).toContain('settings.maxConnections');
      expect(changes.modified).toContain('settings.timeout');
      expect(changes.removed).toHaveLength(0);
    });
  });

  describe('createBackup', () => {
    it('should create backup directory if it does not exist', async () => {
      const configPath = '/test/config.yml';
      
      fs.existsSync.mockReturnValue(false);
      fs.mkdirSync.mockImplementation(() => {});
      fs.copyFileSync.mockImplementation(() => {});
      
      const backupPath = await configMigration.createBackup(configPath);
      
      expect(fs.mkdirSync).toHaveBeenCalledWith('.backup', { recursive: true });
      expect(fs.copyFileSync).toHaveBeenCalledWith(configPath, backupPath);
      expect(backupPath).toMatch(/\.backup\/config-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.yml$/);
    });

    it('should not create backup in dry run mode', async () => {
      configMigration.options.dryRun = true;
      const configPath = '/test/config.yml';
      
      fs.existsSync.mockReturnValue(false);
      fs.mkdirSync.mockImplementation(() => {});
      fs.copyFileSync.mockImplementation(() => {});
      
      const backupPath = await configMigration.createBackup(configPath);
      
      expect(fs.copyFileSync).not.toHaveBeenCalled();
      expect(backupPath).toMatch(/\.backup\/config-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.yml$/);
    });
  });

  describe('loadConfig and saveConfig', () => {
    it('should load YAML configuration', () => {
      const configPath = '/test/config.yml';
      const configContent = 'version: "1.0"\nenabled: true';
      
      fs.readFileSync.mockReturnValue(configContent);
      
      const result = configMigration.loadConfig(configPath);
      
      expect(result.version).toBe('1.0');
      expect(result.enabled).toBe(true);
    });

    it('should load JSON configuration', () => {
      const configPath = '/test/config.json';
      const configContent = '{"version": "1.0", "enabled": true}';
      
      fs.readFileSync.mockReturnValue(configContent);
      
      const result = configMigration.loadConfig(configPath);
      
      expect(result.version).toBe('1.0');
      expect(result.enabled).toBe(true);
    });

    it('should throw error for unsupported format', () => {
      const configPath = '/test/config.txt';
      
      expect(() => {
        configMigration.loadConfig(configPath);
      }).toThrow('Unsupported configuration format: .txt');
    });

    it('should save YAML configuration', () => {
      const configPath = '/test/config.yml';
      const config = { version: '1.0', enabled: true };
      
      fs.writeFileSync.mockImplementation(() => {});
      
      configMigration.saveConfig(configPath, config);
      
      expect(fs.writeFileSync).toHaveBeenCalledWith(configPath, expect.stringContaining('version: "1.0"'));
    });

    it('should save JSON configuration', () => {
      const configPath = '/test/config.json';
      const config = { version: '1.0', enabled: true };
      
      fs.writeFileSync.mockImplementation(() => {});
      
      configMigration.saveConfig(configPath, config);
      
      expect(fs.writeFileSync).toHaveBeenCalledWith(configPath, expect.stringContaining('"version": "1.0"'));
    });
  });

  describe('findConfigFiles', () => {
    it('should find configuration files in directory', () => {
      const configDir = '/test/config';
      const files = [
        'config.yml',
        'email-config.yaml',
        'settings.json',
        'readme.md',
        'config.txt'
      ];
      
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(files);
      fs.statSync.mockImplementation((filePath) => ({
        isFile: () => !filePath.endsWith('/'),
        isDirectory: () => filePath.endsWith('/')
      }));
      
      const configFiles = configMigration.findConfigFiles(configDir);
      
      expect(configFiles).toHaveLength(3);
      expect(configFiles).toContain('/test/config/config.yml');
      expect(configFiles).toContain('/test/config/email-config.yaml');
      expect(configFiles).toContain('/test/config/settings.json');
    });

    it('should return empty array for non-existent directory', () => {
      fs.existsSync.mockReturnValue(false);
      
      const configFiles = configMigration.findConfigFiles('/non/existent');
      
      expect(configFiles).toHaveLength(0);
    });
  });

  describe('rollbackConfig', () => {
    it('should rollback to previous version', async () => {
      const configPath = '/test/config.yml';
      const version = '1.0';
      const backupPath = '/backup/config-1.0.yml';
      
      const history = [{
        toVersion: '1.0',
        backupPath: backupPath
      }];
      
      fs.existsSync.mockReturnValue(true);
      fs.copyFileSync.mockImplementation(() => {});
      
      // Mock getMigrationHistory
      jest.spyOn(configMigration, 'getMigrationHistory').mockReturnValue(history);
      
      const result = await configMigration.rollbackConfig(configPath, version);
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Rolled back to version 1.0');
      expect(result.restoredFrom).toBe(backupPath);
      expect(fs.copyFileSync).toHaveBeenCalledWith(backupPath, configPath);
    });

    it('should handle missing migration history', async () => {
      const configPath = '/test/config.yml';
      const version = '1.0';
      
      jest.spyOn(configMigration, 'getMigrationHistory').mockReturnValue([]);
      
      const result = await configMigration.rollbackConfig(configPath, version);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('No migration history found for version 1.0');
    });

    it('should handle missing backup file', async () => {
      const configPath = '/test/config.yml';
      const version = '1.0';
      const backupPath = '/backup/config-1.0.yml';
      
      const history = [{
        toVersion: '1.0',
        backupPath: backupPath
      }];
      
      fs.existsSync.mockReturnValue(false);
      
      jest.spyOn(configMigration, 'getMigrationHistory').mockReturnValue(history);
      
      const result = await configMigration.rollbackConfig(configPath, version);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe(`Backup file not found: ${backupPath}`);
    });
  });
});
