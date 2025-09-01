/**
 * Unit tests for FileFilter utility
 */

const FileFilter = require('./file-filter');
const fs = require('fs');
const path = require('path');

// Mock fs module
jest.mock('fs');
jest.mock('@actions/core', () => ({
  warning: jest.fn()
}));

describe('FileFilter', () => {
  let fileFilter;
  let mockFs;

  beforeEach(() => {
    fileFilter = new FileFilter();
    mockFs = fs;
    
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with default configuration', () => {
      expect(fileFilter.config.maxFileSize).toBe(1000000);
      expect(fileFilter.config.maxFiles).toBe(50);
      expect(fileFilter.config.excludePatterns).toBeDefined();
      expect(fileFilter.config.excludeExtensions).toBeDefined();
      expect(fileFilter.config.excludeDirectories).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        maxFileSize: 2000000,
        maxFiles: 100,
        excludeExtensions: ['.test']
      };
      
      const customFilter = new FileFilter(customConfig);
      
      expect(customFilter.config.maxFileSize).toBe(2000000);
      expect(customFilter.config.maxFiles).toBe(100);
      expect(customFilter.config.excludeExtensions).toContain('.test');
    });
  });

  describe('getDefaultExcludePatterns', () => {
    it('should return all required exclusion patterns', () => {
      const patterns = fileFilter.getDefaultExcludePatterns();
      
      expect(patterns.database).toBeDefined();
      expect(patterns.environment).toBeDefined();
      expect(patterns.config).toBeDefined();
      expect(patterns.logs).toBeDefined();
      expect(patterns.confidential).toBeDefined();
      expect(patterns.images).toBeDefined();
      expect(patterns.binary).toBeDefined();
      expect(patterns.archives).toBeDefined();
      expect(patterns.generated).toBeDefined();
      expect(patterns.ide).toBeDefined();
      expect(patterns.os).toBeDefined();
    });

    it('should have valid regex patterns', () => {
      const patterns = fileFilter.getDefaultExcludePatterns();
      
      for (const [category, pattern] of Object.entries(patterns)) {
        expect(() => new RegExp(pattern)).not.toThrow();
      }
    });
  });

  describe('shouldExcludeFile', () => {
    beforeEach(() => {
      // Mock file stats
      mockFs.statSync.mockReturnValue({
        isDirectory: () => false,
        size: 1000
      });
    });

    it('should exclude database files', () => {
      const testFiles = [
        'database.sql',
        'data.db',
        'cache.sqlite',
        'backup.sqlite3'
      ];

      testFiles.forEach(file => {
        const result = fileFilter.shouldExcludeFile(file);
        expect(result.shouldExclude).toBe(true);
        expect(result.category).toBe('database');
      });
    });

    it('should exclude environment files', () => {
      const testFiles = [
        '.env',
        '.env.local',
        '.env.development',
        '.env.test',
        '.env.production'
      ];

      testFiles.forEach(file => {
        const result = fileFilter.shouldExcludeFile(file);
        expect(result.shouldExclude).toBe(true);
        expect(result.category).toBe('environment');
      });
    });

    it('should exclude configuration files', () => {
      const testFiles = [
        'config.js',
        'app.conf',
        'settings.ini',
        'config.yaml',
        'docker-compose.yml',
        'package.json'
      ];

      testFiles.forEach(file => {
        const result = fileFilter.shouldExcludeFile(file);
        expect(result.shouldExclude).toBe(true);
        expect(result.category).toBe('config');
      });
    });

    it('should exclude log files', () => {
      const testFiles = [
        'app.log',
        'error.logs',
        'debug.log'
      ];

      testFiles.forEach(file => {
        const result = fileFilter.shouldExcludeFile(file);
        expect(result.shouldExclude).toBe(true);
        expect(result.category).toBe('logs');
      });
    });

    it('should exclude confidential files', () => {
      const testFiles = [
        'private.key',
        'certificate.pem',
        'keystore.p12',
        'cert.pfx',
        'ca.crt',
        'server.cer'
      ];

      testFiles.forEach(file => {
        const result = fileFilter.shouldExcludeFile(file);
        expect(result.shouldExclude).toBe(true);
        expect(result.category).toBe('confidential');
      });
    });

    it('should exclude image files', () => {
      const testFiles = [
        'logo.jpg',
        'icon.png',
        'banner.gif',
        'diagram.svg',
        'photo.jpeg',
        'favicon.ico'
      ];

      testFiles.forEach(file => {
        const result = fileFilter.shouldExcludeFile(file);
        expect(result.shouldExclude).toBe(true);
        expect(result.category).toBe('images');
      });
    });

    it('should exclude binary files', () => {
      const testFiles = [
        'app.exe',
        'library.dll',
        'module.so',
        'app.jar',
        'binary.o',
        'lib.a'
      ];

      testFiles.forEach(file => {
        const result = fileFilter.shouldExcludeFile(file);
        expect(result.shouldExclude).toBe(true);
        expect(result.category).toBe('binary');
      });
    });

    it('should exclude files in excluded directories', () => {
      const testFiles = [
        'node_modules/package/index.js',
        '.git/HEAD',
        'dist/bundle.js',
        'build/app.js',
        'coverage/report.html',
        'logs/error.log',
        'tmp/temp.txt'
      ];

      testFiles.forEach(file => {
        const result = fileFilter.shouldExcludeFile(file);
        expect(result.shouldExclude).toBe(true);
        expect(result.category).toBe('directory');
      });
    });

    it('should exclude files by name', () => {
      const testFiles = [
        'config.js',
        'package-lock.json',
        'yarn.lock',
        '.gitignore',
        'README.md',
        'Dockerfile'
      ];

      testFiles.forEach(file => {
        const result = fileFilter.shouldExcludeFile(file);
        expect(result.shouldExclude).toBe(true);
        expect(result.category).toBe('filename');
      });
    });

    it('should exclude files that exceed size limit', () => {
      mockFs.statSync.mockReturnValue({
        isDirectory: () => false,
        size: 2000000 // 2MB, exceeds 1MB limit
      });

      const result = fileFilter.shouldExcludeFile('large-file.js');
      expect(result.shouldExclude).toBe(true);
      expect(result.category).toBe('size');
      expect(result.reason).toContain('File size exceeds limit');
    });

    it('should exclude directories', () => {
      mockFs.statSync.mockReturnValue({
        isDirectory: () => true,
        size: 1000
      });

      const result = fileFilter.shouldExcludeFile('src/components');
      expect(result.shouldExclude).toBe(true);
      expect(result.category).toBe('type');
      expect(result.reason).toBe('Directory');
    });

    it('should exclude inaccessible files', () => {
      mockFs.statSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = fileFilter.shouldExcludeFile('inaccessible.js');
      expect(result.shouldExclude).toBe(true);
      expect(result.category).toBe('accessibility');
      expect(result.reason).toBe('File not found or not accessible');
    });

    it('should include valid source code files', () => {
      const testFiles = [
        'src/app.js',
        'components/Button.jsx',
        'utils/helper.ts',
        'styles/main.css',
        'index.html',
        'README.md'
      ];

      testFiles.forEach(file => {
        const result = fileFilter.shouldExcludeFile(file);
        expect(result.shouldExclude).toBe(false);
        expect(result.category).toBe('included');
      });
    });

    it('should respect include patterns when specified', () => {
      const customFilter = new FileFilter({
        includePatterns: [/\.js$/, /\.ts$/]
      });

      // Should include JS and TS files
      expect(customFilter.shouldExcludeFile('app.js').shouldExclude).toBe(false);
      expect(customFilter.shouldExcludeFile('utils.ts').shouldExclude).toBe(false);

      // Should exclude other files
      expect(customFilter.shouldExcludeFile('styles.css').shouldExclude).toBe(true);
      expect(customFilter.shouldExcludeFile('index.html').shouldExclude).toBe(true);
    });
  });

  describe('filterFiles', () => {
    beforeEach(() => {
      mockFs.statSync.mockReturnValue({
        isDirectory: () => false,
        size: 1000
      });
    });

    it('should filter a list of files correctly', () => {
      const files = [
        'src/app.js',
        'database.sql',
        'config.yaml',
        'styles.css',
        '.env',
        'README.md'
      ];

      const result = fileFilter.filterFiles(files);

      expect(result.included).toContain('src/app.js');
      expect(result.included).toContain('styles.css');
      expect(result.excluded).toHaveLength(4);
      expect(result.summary.total).toBe(6);
      expect(result.summary.included).toBe(2);
      expect(result.summary.excluded).toBe(4);
    });

    it('should respect file count limits', () => {
      const customFilter = new FileFilter({ maxFiles: 2 });
      const files = ['file1.js', 'file2.js', 'file3.js', 'file4.js'];

      const result = customFilter.filterFiles(files);

      expect(result.included).toHaveLength(2);
      expect(result.excluded).toHaveLength(2);
      expect(result.summary.included).toBe(2);
      expect(result.excluded[2].category).toBe('limit');
    });

    it('should categorize excluded files correctly', () => {
      const files = [
        'database.sql',      // database
        '.env',              // environment
        'config.yaml',       // config
        'app.log',           // logs
        'private.key',       // confidential
        'logo.png',          // images
        'app.exe',           // binary
        'src/app.js'         // included
      ];

      const result = fileFilter.filterFiles(files);

      expect(result.summary.categories.database).toBe(1);
      expect(result.summary.categories.environment).toBe(1);
      expect(result.summary.categories.config).toBe(1);
      expect(result.summary.categories.logs).toBe(1);
      expect(result.summary.categories.confidential).toBe(1);
      expect(result.summary.categories.images).toBe(1);
      expect(result.summary.categories.binary).toBe(1);
      expect(result.summary.categories.included).toBe(1);
    });

    it('should handle empty file list', () => {
      const result = fileFilter.filterFiles([]);

      expect(result.included).toHaveLength(0);
      expect(result.excluded).toHaveLength(0);
      expect(result.summary.total).toBe(0);
      expect(result.summary.included).toBe(0);
      expect(result.summary.excluded).toBe(0);
    });
  });

  describe('getFileStats', () => {
    beforeEach(() => {
      mockFs.statSync.mockImplementation((filePath) => {
        const sizes = {
          'small.js': 100,
          'medium.js': 1000,
          'large.js': 10000
        };
        return {
          isDirectory: () => false,
          size: sizes[filePath] || 500
        };
      });
    });

    it('should calculate file statistics correctly', () => {
      const files = ['small.js', 'medium.js', 'large.js'];
      const stats = fileFilter.getFileStats(files);

      expect(stats.totalFiles).toBe(3);
      expect(stats.totalSize).toBe(11100);
      expect(stats.averageSize).toBe(3700);
      expect(stats.largestFile.path).toBe('large.js');
      expect(stats.largestFile.size).toBe(10000);
      expect(stats.smallestFile.path).toBe('small.js');
      expect(stats.smallestFile.size).toBe(100);
    });

    it('should categorize files by extension', () => {
      const files = ['app.js', 'styles.css', 'index.html'];
      const stats = fileFilter.getFileStats(files);

      expect(stats.sizeByExtension['.js']).toBe(500);
      expect(stats.sizeByExtension['.css']).toBe(500);
      expect(stats.sizeByExtension['.html']).toBe(500);
    });

    it('should categorize files by type', () => {
      const files = ['app.js', 'styles.css', 'index.html'];
      const stats = fileFilter.getFileStats(files);

      expect(stats.sizeByCategory.javascript).toBe(500);
      expect(stats.sizeByCategory.styles).toBe(500);
      expect(stats.sizeByCategory.html).toBe(500);
    });

    it('should handle inaccessible files gracefully', () => {
      mockFs.statSync.mockImplementation((filePath) => {
        if (filePath === 'inaccessible.js') {
          throw new Error('Permission denied');
        }
        return {
          isDirectory: () => false,
          size: 500
        };
      });

      const files = ['app.js', 'inaccessible.js', 'styles.css'];
      const stats = fileFilter.getFileStats(files);

      expect(stats.totalFiles).toBe(3);
      expect(stats.totalSize).toBe(1000); // Only accessible files
    });
  });

  describe('getFileCategory', () => {
    it('should categorize JavaScript files', () => {
      expect(fileFilter.getFileCategory('app.js')).toBe('javascript');
      expect(fileFilter.getFileCategory('component.jsx')).toBe('javascript');
    });

    it('should categorize TypeScript files', () => {
      expect(fileFilter.getFileCategory('app.ts')).toBe('typescript');
      expect(fileFilter.getFileCategory('component.tsx')).toBe('typescript');
    });

    it('should categorize Python files', () => {
      expect(fileFilter.getFileCategory('script.py')).toBe('python');
    });

    it('should categorize Java files', () => {
      expect(fileFilter.getFileCategory('App.java')).toBe('java');
    });

    it('should categorize CSS files', () => {
      expect(fileFilter.getFileCategory('styles.css')).toBe('styles');
      expect(fileFilter.getFileCategory('main.scss')).toBe('styles');
    });

    it('should categorize HTML files', () => {
      expect(fileFilter.getFileCategory('index.html')).toBe('html');
      expect(fileFilter.getFileCategory('page.htm')).toBe('html');
    });

    it('should categorize JSON files', () => {
      expect(fileFilter.getFileCategory('config.json')).toBe('json');
    });

    it('should categorize shell scripts', () => {
      expect(fileFilter.getFileCategory('script.sh')).toBe('shell');
      expect(fileFilter.getFileCategory('setup.bash')).toBe('shell');
    });

    it('should categorize unknown files as other', () => {
      expect(fileFilter.getFileCategory('unknown.xyz')).toBe('other');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(fileFilter.formatFileSize(0)).toBe('0 Bytes');
      expect(fileFilter.formatFileSize(1024)).toBe('1 KB');
      expect(fileFilter.formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(fileFilter.formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
    });

    it('should handle decimal sizes', () => {
      expect(fileFilter.formatFileSize(1500)).toBe('1.46 KB');
      expect(fileFilter.formatFileSize(1536)).toBe('1.5 KB');
    });
  });

  describe('validateConfig', () => {
    it('should validate correct configuration', () => {
      const result = fileFilter.validateConfig();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid maxFileSize', () => {
      const invalidFilter = new FileFilter({ maxFileSize: -1 });
      const result = invalidFilter.validateConfig();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('maxFileSize must be greater than 0');
    });

    it('should detect invalid maxFiles', () => {
      const invalidFilter = new FileFilter({ maxFiles: 0 });
      const result = invalidFilter.validateConfig();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('maxFiles must be greater than 0');
    });

    it('should warn about large limits', () => {
      const largeFilter = new FileFilter({ 
        maxFileSize: 200 * 1024 * 1024, // 200MB
        maxFiles: 2000
      });
      const result = largeFilter.validateConfig();
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('maxFileSize is very large (>100MB), consider reducing for performance');
      expect(result.warnings).toContain('maxFiles is very large (>1000), consider reducing for performance');
    });

    it('should detect invalid regex patterns', () => {
      const invalidFilter = new FileFilter({
        excludePatterns: {
          invalid: /invalid\[regex/
        }
      });
      const result = invalidFilter.validateConfig();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid regex pattern for invalid');
    });
  });

  describe('getConfigSummary', () => {
    it('should return configuration summary', () => {
      const summary = fileFilter.getConfigSummary();
      
      expect(summary.maxFileSize).toBe(1000000);
      expect(summary.maxFiles).toBe(50);
      expect(summary.excludePatterns).toContain('database');
      expect(summary.excludePatterns).toContain('environment');
      expect(summary.excludeExtensions).toContain('.sql');
      expect(summary.excludeExtensions).toContain('.env');
      expect(summary.excludeDirectories).toContain('node_modules');
      expect(summary.excludeFileNames).toContain('config.js');
    });
  });
});
