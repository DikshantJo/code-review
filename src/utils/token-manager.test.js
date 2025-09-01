const TokenManager = require('./token-manager');

describe('TokenManager', () => {
  let manager;
  let config;

  beforeEach(() => {
    config = {
      ai: {
        max_tokens: 4000,
        max_file_size_bytes: 1024 * 1024, // 1MB
        max_total_size_bytes: 5 * 1024 * 1024, // 5MB
        estimated_tokens_per_char: 0.25,
        reserved_tokens: 500
      }
    };
    manager = new TokenManager(config);
  });

  describe('constructor', () => {
    test('should initialize with provided config', () => {
      expect(manager.maxTokens).toBe(4000);
      expect(manager.maxFileSizeBytes).toBe(1024 * 1024);
      expect(manager.maxTotalSizeBytes).toBe(5 * 1024 * 1024);
      expect(manager.estimatedTokensPerChar).toBe(0.25);
      expect(manager.reservedTokens).toBe(500);
    });

    test('should use default values when config is not provided', () => {
      const defaultManager = new TokenManager();
      
      expect(defaultManager.maxTokens).toBe(4000);
      expect(defaultManager.maxFileSizeBytes).toBe(1024 * 1024);
      expect(defaultManager.maxTotalSizeBytes).toBe(5 * 1024 * 1024);
      expect(defaultManager.estimatedTokensPerChar).toBe(0.25);
      expect(defaultManager.reservedTokens).toBe(500);
    });
  });

  describe('calculateTokens', () => {
    test('should calculate tokens for content', () => {
      const content = 'This is a test string with 40 characters';
      const tokens = manager.calculateTokens(content);
      
      expect(tokens).toBe(Math.ceil(40 * 0.25)); // 10 tokens
    });

    test('should handle empty content', () => {
      expect(manager.calculateTokens('')).toBe(0);
      expect(manager.calculateTokens(null)).toBe(0);
      expect(manager.calculateTokens(undefined)).toBe(0);
    });

    test('should handle non-string content', () => {
      expect(manager.calculateTokens(123)).toBe(0);
      expect(manager.calculateTokens({})).toBe(0);
      expect(manager.calculateTokens([])).toBe(0);
    });
  });

  describe('calculateTokensForFiles', () => {
    test('should calculate tokens for multiple files', () => {
      const files = [
        { path: 'src/file1.js', content: 'console.log("test");', size: 1024 },
        { path: 'src/file2.js', content: 'function test() { return true; }', size: 2048 }
      ];

      const analysis = manager.calculateTokensForFiles(files);

      expect(analysis.totalTokens).toBeGreaterThan(0);
      expect(analysis.fileTokens).toHaveLength(2);
      expect(analysis.totalSizeBytes).toBe(3072);
      expect(analysis.estimatedCost).toBeGreaterThan(0);
    });

    test('should detect oversized files', () => {
      const files = [
        { path: 'src/normal.js', content: 'test', size: 1024 },
        { path: 'src/large.js', content: 'large file', size: 2 * 1024 * 1024 }
      ];

      const analysis = manager.calculateTokensForFiles(files);

      expect(analysis.oversizedFiles).toHaveLength(1);
      expect(analysis.oversizedFiles[0].path).toBe('src/large.js');
    });

    test('should handle files with missing properties', () => {
      const files = [
        { path: 'src/file1.js' },
        { path: 'src/file2.js', content: 'test' },
        { path: 'src/file3.js', size: 1024 }
      ];

      const analysis = manager.calculateTokensForFiles(files);

      expect(analysis.totalTokens).toBeGreaterThanOrEqual(0);
      expect(analysis.fileTokens).toHaveLength(3);
    });
  });

  describe('estimateCost', () => {
    test('should estimate cost for tokens', () => {
      const cost = manager.estimateCost(1000);
      
      // 1000 tokens * 0.03 per 1k tokens = 0.03
      expect(cost).toBe(0.03);
    });

    test('should handle zero tokens', () => {
      expect(manager.estimateCost(0)).toBe(0);
    });

    test('should handle large token counts', () => {
      const cost = manager.estimateCost(10000);
      expect(cost).toBe(0.3);
    });
  });

  describe('checkTokenLimits', () => {
    test('should pass when within limits', () => {
      const files = [
        { path: 'src/file1.js', content: 'small file', size: 1024 }
      ];

      const result = manager.checkTokenLimits(files);

      expect(result.withinLimits).toBe(true);
      expect(result.exceeded).toBe(false);
      expect(result.reason).toBeNull();
    });

    test('should fail when token limit exceeded', () => {
      const largeContent = 'x'.repeat(20000); // ~5000 tokens
      const files = [
        { path: 'src/large.js', content: largeContent, size: 1024 }
      ];

      const result = manager.checkTokenLimits(files);

      expect(result.withinLimits).toBe(false);
      expect(result.exceeded).toBe(true);
      expect(result.reason).toBe('token_limit_exceeded');
      expect(result.recommendations).toContain('Token limit exceeded: 5500 tokens used, 4000 available');
    });

    test('should fail when size limit exceeded', () => {
      const files = [
        { path: 'src/large.js', content: 'test', size: 6 * 1024 * 1024 }
      ];

      const result = manager.checkTokenLimits(files);

      expect(result.withinLimits).toBe(false);
      expect(result.exceeded).toBe(true);
      expect(result.reason).toBe('size_limit_exceeded');
      expect(result.recommendations).toContain('Total size exceeded: 6 MB used, 5 MB available');
    });

    test('should fail when oversized files present', () => {
      const files = [
        { path: 'src/large.js', content: 'test', size: 2 * 1024 * 1024 }
      ];

      const result = manager.checkTokenLimits(files);

      expect(result.withinLimits).toBe(false);
      expect(result.exceeded).toBe(true);
      expect(result.reason).toBe('oversized_files');
      expect(result.recommendations).toContain('1 file(s) exceed individual size limit');
    });

    test('should provide utilization information', () => {
      const files = [
        { path: 'src/file1.js', content: 'test', size: 1024 }
      ];

      const result = manager.checkTokenLimits(files);

      expect(result.availableTokens).toBe(3500); // 4000 - 500 reserved
      expect(result.usedTokens).toBeGreaterThan(0);
      expect(result.utilization).toBeGreaterThan(0);
    });
  });

  describe('optimizeForTokens', () => {
    test('should optimize files within token limits', () => {
      const files = [
        { path: 'src/file1.js', content: 'small file', size: 1024 },
        { path: 'src/file2.js', content: 'another small file', size: 1024 }
      ];

      const result = manager.optimizeForTokens(files);

      expect(result.optimized).toHaveLength(2);
      expect(result.excluded).toHaveLength(0);
      expect(result.optimizationApplied).toBe(false);
    });

    test('should exclude files based on patterns', () => {
      const files = [
        { path: 'src/file1.js', content: 'test', size: 1024 },
        { path: 'node_modules/dep.js', content: 'dependency', size: 1024 }
      ];

      const result = manager.optimizeForTokens(files, {
        excludePatterns: ['node_modules']
      });

      expect(result.optimized).toHaveLength(1);
      expect(result.excluded).toHaveLength(1);
      expect(result.excluded[0].path).toBe('node_modules/dep.js');
    });

    test('should include only files matching patterns', () => {
      const files = [
        { path: 'src/file1.js', content: 'test', size: 1024 },
        { path: 'docs/readme.md', content: 'documentation', size: 1024 }
      ];

      const result = manager.optimizeForTokens(files, {
        includePatterns: ['src/']
      });

      expect(result.optimized).toHaveLength(1);
      expect(result.excluded).toHaveLength(1);
      expect(result.optimized[0].path).toBe('src/file1.js');
    });

    test('should truncate large files', () => {
      const largeContent = 'x'.repeat(50000); // Much larger content
      const files = [
        { path: 'src/large.js', content: largeContent, size: 1024 }
      ];

      const result = manager.optimizeForTokens(files, {
        maxTokensPerFile: 1000
      });

      expect(result.optimized).toHaveLength(1);
      expect(result.optimizationApplied).toBe(true);
      expect(result.optimized[0].truncated).toBeDefined();
    });
  });

  describe('sortFilesByImportance', () => {
    test('should sort files by importance score', () => {
      const files = [
        { path: 'node_modules/dep.js', content: 'dependency content', size: 1024 },
        { path: 'src/app.js', content: 'app content', size: 1024 },
        { path: 'test/app.test.js', content: 'test content', size: 1024 }
      ];

      const sorted = manager.sortFilesByImportance(files);

      // Source files should come first
      expect(sorted[0].path).toBe('src/app.js');
      // Test files should come after
      expect(sorted[1].path).toBe('test/app.test.js');
      // Generated files should come last
      expect(sorted[2].path).toBe('node_modules/dep.js');
    });
  });

  describe('calculateFileImportance', () => {
    test('should give higher score to source files', () => {
      const sourceFile = { path: 'src/app.js', content: 'test' };
      const testFile = { path: 'test/app.test.js', content: 'test' };

      const sourceScore = manager.calculateFileImportance(sourceFile);
      const testScore = manager.calculateFileImportance(testFile);

      expect(sourceScore).toBeGreaterThan(testScore);
    });

    test('should give lower score to generated files', () => {
      const sourceFile = { path: 'src/app.js', content: 'test' };
      const generatedFile = { path: 'node_modules/dep.js', content: 'test' };

      const sourceScore = manager.calculateFileImportance(sourceFile);
      const generatedScore = manager.calculateFileImportance(generatedFile);

      expect(sourceScore).toBeGreaterThan(generatedScore);
    });

    test('should give higher score to smaller files', () => {
      const smallFile = { path: 'src/small.js', content: 'small' };
      const largeFile = { path: 'src/large.js', content: 'x'.repeat(1000) };

      const smallScore = manager.calculateFileImportance(smallFile);
      const largeScore = manager.calculateFileImportance(largeFile);

      expect(smallScore).toBeGreaterThan(largeScore);
    });
  });

  describe('shouldExcludeFile', () => {
    test('should exclude files matching exclude patterns', () => {
      const shouldExclude = manager.shouldExcludeFile('node_modules/dep.js', ['node_modules']);
      expect(shouldExclude).toBe(true);
    });

    test('should not exclude files not matching patterns', () => {
      const shouldExclude = manager.shouldExcludeFile('src/app.js', ['node_modules']);
      expect(shouldExclude).toBe(false);
    });

    test('should only include files matching include patterns', () => {
      const shouldExclude = manager.shouldExcludeFile('docs/readme.md', [], ['src/']);
      expect(shouldExclude).toBe(true);
    });

    test('should include files matching include patterns', () => {
      const shouldExclude = manager.shouldExcludeFile('src/app.js', [], ['src/']);
      expect(shouldExclude).toBe(false);
    });
  });

  describe('truncateFile', () => {
    test('should not truncate small files', () => {
      const file = { path: 'src/small.js', content: 'small file' };
      const truncated = manager.truncateFile(file, 1000);

      expect(truncated).toBe(file);
      expect(truncated.truncated).toBeUndefined();
    });

    test('should truncate large files', () => {
      const largeContent = 'x'.repeat(10000);
      const file = { path: 'src/large.js', content: largeContent };
      const truncated = manager.truncateFile(file, 1000);

      expect(truncated).not.toBe(file);
      expect(truncated.truncated).toBe(true);
      expect(truncated.content.length).toBeLessThan(largeContent.length);
    });

    test('should return null for files that cannot be truncated', () => {
      const file = { path: 'src/tiny.js', content: 'x'.repeat(100) };
      const truncated = manager.truncateFile(file, 10);

      expect(truncated).toBeNull();
    });
  });

  describe('intelligentTruncate', () => {
    test('should truncate at line boundaries', () => {
      const content = 'line1\nline2\nline3\nline4\nline5';
      const truncated = manager.intelligentTruncate(content, 15);

      expect(truncated).toContain('line1');
      expect(truncated).toContain('line2');
      expect(truncated).not.toContain('line4');
      expect(truncated).toContain('truncated due to token limits');
    });

    test('should handle content shorter than limit', () => {
      const content = 'short content';
      const truncated = manager.intelligentTruncate(content, 100);

      expect(truncated).toBe(content);
    });

    test('should return null for very small limits', () => {
      const content = 'some content';
      const truncated = manager.intelligentTruncate(content, 10);

      expect(truncated).toBeNull();
    });
  });

  describe('createTokenUsageReport', () => {
    test('should create comprehensive usage report', () => {
      const analysis = {
        totalTokens: 1000,
        fileTokens: [
          { path: 'src/file1.js', tokens: 500, size: 1024, contentLength: 2000 },
          { path: 'src/file2.js', tokens: 500, size: 2048, contentLength: 2000 }
        ],
        oversizedFiles: [
          { path: 'src/large.js', size: 2 * 1024 * 1024, maxSize: 1024 * 1024, tokens: 100 }
        ],
        totalSizeBytes: 3072,
        estimatedCost: 0.03
      };

      const report = manager.createTokenUsageReport(analysis);

      expect(report.summary.totalFiles).toBe(2);
      expect(report.summary.totalTokens).toBe(1000);
      expect(report.files).toHaveLength(2);
      expect(report.oversizedFiles).toHaveLength(1);
      expect(report.recommendations).toBeDefined();
    });
  });

  describe('generateTokenRecommendations', () => {
    test('should recommend splitting for high usage', () => {
      const analysis = {
        totalTokens: 3500, // 87.5% of 4000
        fileTokens: [],
        oversizedFiles: [],
        totalSizeBytes: 1024,
        estimatedCost: 0.03
      };

      const recommendations = manager.generateTokenRecommendations(analysis);

      expect(recommendations).toContain('High token usage - consider splitting the review into smaller chunks');
    });

    test('should recommend excluding oversized files', () => {
      const analysis = {
        totalTokens: 1000,
        fileTokens: [],
        oversizedFiles: [
          { path: 'src/large.js', size: 2 * 1024 * 1024, maxSize: 1024 * 1024, tokens: 100 }
        ],
        totalSizeBytes: 1024,
        estimatedCost: 0.03
      };

      const recommendations = manager.generateTokenRecommendations(analysis);

      expect(recommendations).toContain('Exclude 1 oversized file(s) from review');
    });

    test('should recommend cost optimization for expensive reviews', () => {
      const analysis = {
        totalTokens: 5000,
        fileTokens: [],
        oversizedFiles: [],
        totalSizeBytes: 1024,
        estimatedCost: 0.15
      };

      const recommendations = manager.generateTokenRecommendations(analysis);

      expect(recommendations).toContain('Estimated cost: $0.15 - consider optimizing for cost');
    });
  });

  describe('formatBytes', () => {
    test('should format bytes correctly', () => {
      expect(manager.formatBytes(0)).toBe('0 Bytes');
      expect(manager.formatBytes(1024)).toBe('1 KB');
      expect(manager.formatBytes(1024 * 1024)).toBe('1 MB');
      expect(manager.formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });
  });

  describe('getConfiguration', () => {
    test('should return configuration', () => {
      const config = manager.getConfiguration();

      expect(config.maxTokens).toBe(4000);
      expect(config.maxFileSizeBytes).toBe(1024 * 1024);
      expect(config.maxTotalSizeBytes).toBe(5 * 1024 * 1024);
      expect(config.estimatedTokensPerChar).toBe(0.25);
      expect(config.reservedTokens).toBe(500);
    });
  });
});
