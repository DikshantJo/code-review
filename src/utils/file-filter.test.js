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

  describe('getEnhancedFileCount', () => {
    it('should analyze files with complete metadata', () => {
      const files = [
        {
          filename: 'src/main.js',
          status: 'modified',
          additions: 10,
          deletions: 5,
          changes: 15,
          lines: 15,
          size: 2048,
          priority: 80
        },
        {
          filename: 'src/utils.js',
          status: 'added',
          additions: 25,
          deletions: 0,
          changes: 25,
          lines: 25,
          size: 4096,
          priority: 90
        },
        {
          filename: 'config/settings.json',
          status: 'modified',
          additions: 2,
          deletions: 1,
          changes: 3,
          lines: 3,
          size: 512,
          priority: 60
        }
      ];

      const analysis = fileFilter.getEnhancedFileCount(files);

      // Basic counts
      expect(analysis.totalFiles).toBe(3);
      expect(analysis.includedFiles).toBe(3);
      expect(analysis.excludedFiles).toBe(0);

      // File type breakdown
      expect(analysis.byType.code).toBe(2);
      expect(analysis.byType.config).toBe(1);
      expect(analysis.byType.test).toBe(0);
      expect(analysis.byType.documentation).toBe(0);

      // Size analysis
      expect(analysis.bySize.small).toBe(1);  // 512 bytes
      expect(analysis.bySize.medium).toBe(2); // 2048, 4096 bytes

      // Line count analysis
      expect(analysis.byLines.short).toBe(3);  // 3, 15, 25 lines (all < 50)
      expect(analysis.byLines.medium).toBe(0); // no files with 50-200 lines

      // Status analysis
      expect(analysis.byStatus.added).toBe(1);
      expect(analysis.byStatus.modified).toBe(2);
      expect(analysis.byStatus.deleted).toBe(0);

      // Priority analysis
      expect(analysis.byPriority.high).toBe(0);   // no files > 100
      expect(analysis.byPriority.medium).toBe(3); // 90, 80, 60 (all 51-100)
      expect(analysis.byPriority.low).toBe(0);    // no files ≤ 50

      // Summary statistics
      expect(analysis.summary.totalSize).toBe(6656);
      expect(analysis.summary.totalLines).toBe(43);
      expect(analysis.summary.averageSize).toBe(2219);
      expect(analysis.summary.averageLines).toBe(14);
      expect(analysis.summary.largestFile).toBe('src/utils.js');
      expect(analysis.summary.smallestFile).toBe('config/settings.json');
      expect(analysis.summary.mostComplexFile).toBe('src/utils.js');
    });

    it('should handle files with missing metadata', () => {
      const files = [
        { filename: 'src/app.js' },
        { filename: 'config.env', status: 'modified' },
        { filename: 'README.md', lines: 50 }
      ];

      const analysis = fileFilter.getEnhancedFileCount(files);

      expect(analysis.totalFiles).toBe(3);
      expect(analysis.includedFiles).toBe(3);
      expect(analysis.excludedFiles).toBe(0);

      // Should handle missing properties gracefully
      expect(analysis.summary.totalSize).toBe(0);
      expect(analysis.summary.totalLines).toBe(50);
      expect(analysis.summary.averageSize).toBe(0);
      expect(analysis.summary.averageLines).toBe(17);
    });

    it('should categorize files by extension correctly', () => {
      const files = [
        { filename: 'src/main.js', lines: 100 },
        { filename: 'src/styles.css', lines: 50 },
        { filename: 'tests/main.test.js', lines: 30 },
        { filename: 'docs/README.md', lines: 25 },
        { filename: 'package.json', lines: 15 }
      ];

      const analysis = fileFilter.getEnhancedFileCount(files);

      expect(analysis.byType.code).toBe(1);      // .js file (excluding test files)
      expect(analysis.byType.styles).toBe(1);    // .css file
      expect(analysis.byType.test).toBe(1);      // .test.js file
      expect(analysis.byType.documentation).toBe(1); // .md file
      expect(analysis.byType.config).toBe(1);    // .json file
    });

    it('should analyze file sizes correctly', () => {
      const files = [
        { filename: 'small.js', size: 500 },      // < 1KB
        { filename: 'medium.js', size: 5000 },    // 1KB - 10KB
        { filename: 'large.js', size: 50000 },    // 10KB - 100KB
        { filename: 'xlarge.js', size: 500000 }   // > 100KB
      ];

      const analysis = fileFilter.getEnhancedFileCount(files);

      expect(analysis.bySize.small).toBe(1);
      expect(analysis.bySize.medium).toBe(1);
      expect(analysis.bySize.large).toBe(1);
      expect(analysis.bySize.xlarge).toBe(1);
    });

    it('should analyze line counts correctly', () => {
      const files = [
        { filename: 'short.js', lines: 25 },      // < 50 lines
        { filename: 'medium.js', lines: 100 },    // 50-200 lines
        { filename: 'long.js', lines: 300 },      // 200-500 lines
        { filename: 'xlong.js', lines: 800 }      // > 500 lines
      ];

      const analysis = fileFilter.getEnhancedFileCount(files);

      expect(analysis.byLines.short).toBe(1);
      expect(analysis.byLines.medium).toBe(1);
      expect(analysis.byLines.long).toBe(1);
      expect(analysis.byLines.xlong).toBe(1);
    });

    it('should handle empty file list', () => {
      const analysis = fileFilter.getEnhancedFileCount([]);

      expect(analysis.totalFiles).toBe(0);
      expect(analysis.includedFiles).toBe(0);
      expect(analysis.excludedFiles).toBe(0);
      expect(analysis.summary.totalSize).toBe(0);
      expect(analysis.summary.totalLines).toBe(0);
      expect(analysis.summary.averageSize).toBe(0);
      expect(analysis.summary.averageLines).toBe(0);
      expect(analysis.summary.largestFile).toBeNull();
      expect(analysis.summary.smallestFile).toBeNull();
      expect(analysis.summary.mostComplexFile).toBeNull();
    });

    it('should validate file data integrity', () => {
      const files = [
        { filename: 'valid.js', lines: 100, size: 2048 },
        { filename: '', lines: -5, size: 'invalid' }, // Invalid data
        { filename: 'another.js', lines: 50, size: 1024 }
      ];

      const analysis = fileFilter.getEnhancedFileCount(files);

      expect(analysis.totalFiles).toBe(3);
      expect(analysis.validation.valid).toBe(2);
      expect(analysis.validation.invalid).toBe(1);
      expect(analysis.validation.errors).toHaveLength(1);
    });

    it('should calculate complexity scores correctly', () => {
      const files = [
        { filename: 'simple.js', lines: 10, size: 1024, priority: 30 },
        { filename: 'complex.js', lines: 200, size: 8192, priority: 90 },
        { filename: 'medium.js', lines: 75, size: 2048, priority: 60 }
      ];

      const analysis = fileFilter.getEnhancedFileCount(files);

      // Most complex file should be the one with highest lines + size + priority
      expect(analysis.summary.mostComplexFile).toBe('complex.js');
    });
  });
});
