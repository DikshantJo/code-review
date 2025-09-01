const LargeCommitHandler = require('./large-commit-handler');

describe('LargeCommitHandler', () => {
  let handler;
  let config;

  beforeEach(() => {
    config = {
      ai: {
        max_files_per_review: 50,
        max_file_size_bytes: 1024 * 1024, // 1MB
        max_total_size_bytes: 5 * 1024 * 1024, // 5MB
        max_tokens: 4000
      }
    };
    handler = new LargeCommitHandler(config);
  });

  describe('constructor', () => {
    test('should initialize with provided config', () => {
      expect(handler.maxFilesPerReview).toBe(50);
      expect(handler.maxFileSizeBytes).toBe(1024 * 1024);
      expect(handler.maxTotalSizeBytes).toBe(5 * 1024 * 1024);
      expect(handler.maxTokens).toBe(4000);
    });

    test('should use default values when config is not provided', () => {
      const defaultHandler = new LargeCommitHandler();
      
      expect(defaultHandler.maxFilesPerReview).toBe(50);
      expect(defaultHandler.maxFileSizeBytes).toBe(1024 * 1024);
      expect(defaultHandler.maxTotalSizeBytes).toBe(5 * 1024 * 1024);
      expect(defaultHandler.maxTokens).toBe(4000);
    });

    test('should use custom values from config', () => {
      const customConfig = {
        ai: {
          max_files_per_review: 25,
          max_file_size_bytes: 512 * 1024,
          max_total_size_bytes: 2 * 1024 * 1024,
          max_tokens: 2000
        }
      };
      
      const customHandler = new LargeCommitHandler(customConfig);
      
      expect(customHandler.maxFilesPerReview).toBe(25);
      expect(customHandler.maxFileSizeBytes).toBe(512 * 1024);
      expect(customHandler.maxTotalSizeBytes).toBe(2 * 1024 * 1024);
      expect(customHandler.maxTokens).toBe(2000);
    });
  });

  describe('analyzeCommitSize', () => {
    test('should analyze small commit correctly', () => {
      const files = [
        { path: 'src/file1.js', size: 1024, content: 'console.log("test");' },
        { path: 'src/file2.js', size: 2048, content: 'function test() {}' }
      ];

      const analysis = handler.analyzeCommitSize(files);

      expect(analysis.totalFiles).toBe(2);
      expect(analysis.totalSizeBytes).toBe(3072);
      expect(analysis.estimatedTokens).toBeGreaterThan(0);
      expect(analysis.needsHandling).toBe(false);
      expect(analysis.handlingStrategy).toBeNull();
      expect(analysis.reason).toBeNull();
    });

    test('should detect total size exceeded', () => {
      const files = [
        { path: 'src/large-file.js', size: 6 * 1024 * 1024, content: 'x'.repeat(1000) }
      ];

      const analysis = handler.analyzeCommitSize(files);

      expect(analysis.needsHandling).toBe(true);
      expect(analysis.handlingStrategy).toBe('skip');
      expect(analysis.reason).toBe('total_size_exceeded');
      expect(analysis.recommendations).toContain('Total commit size (6 MB) exceeds limit (5 MB)');
    });

    test('should detect file count exceeded', () => {
      const files = Array.from({ length: 55 }, (_, i) => ({
        path: `src/file${i}.js`,
        size: 1024,
        content: 'test'
      }));

      const analysis = handler.analyzeCommitSize(files);

      expect(analysis.needsHandling).toBe(true);
      expect(analysis.handlingStrategy).toBe('split');
      expect(analysis.reason).toBe('file_count_exceeded');
      expect(analysis.recommendations).toContain('File count (55) exceeds limit (50). Consider splitting into smaller commits.');
    });

    test('should detect token limit exceeded', () => {
      const largeContent = 'x'.repeat(20000); // ~5000 tokens
      const files = [
        { path: 'src/large-file.js', size: 1024, content: largeContent }
      ];

      const analysis = handler.analyzeCommitSize(files);

      expect(analysis.needsHandling).toBe(true);
      expect(analysis.handlingStrategy).toBe('split');
      expect(analysis.reason).toBe('token_limit_exceeded');
      expect(analysis.recommendations).toContain('Estimated tokens (5000) exceeds limit (4000). Consider splitting into smaller commits.');
    });

    test('should detect oversized files', () => {
      const files = [
        { path: 'src/normal.js', size: 1024, content: 'test' },
        { path: 'src/large.js', size: 2 * 1024 * 1024, content: 'large file' }
      ];

      const analysis = handler.analyzeCommitSize(files);

      expect(analysis.needsHandling).toBe(true);
      expect(analysis.handlingStrategy).toBe('skip');
      expect(analysis.reason).toBe('oversized_files');
      expect(analysis.oversizedFiles).toHaveLength(1);
      expect(analysis.oversizedFiles[0].path).toBe('src/large.js');
      expect(analysis.recommendations).toContain('1 file(s) exceed size limit. Consider excluding large files from review.');
    });

    test('should prioritize total size over other limits', () => {
      const files = [
        { path: 'src/large.js', size: 6 * 1024 * 1024, content: 'x'.repeat(1000) },
        ...Array.from({ length: 55 }, (_, i) => ({
          path: `src/file${i}.js`,
          size: 1024,
          content: 'test'
        }))
      ];

      const analysis = handler.analyzeCommitSize(files);

      expect(analysis.handlingStrategy).toBe('skip');
      expect(analysis.reason).toBe('total_size_exceeded');
    });
  });

  describe('splitFilesIntoChunks', () => {
    test('should split files by file count limit', () => {
      const files = Array.from({ length: 75 }, (_, i) => ({
        path: `src/file${i}.js`,
        size: 1024,
        content: 'test'
      }));

      const analysis = handler.analyzeCommitSize(files);
      const chunks = handler.splitFilesIntoChunks(files, analysis);

      expect(chunks.length).toBe(2);
      expect(chunks[0].fileCount).toBe(50);
      expect(chunks[1].fileCount).toBe(25);
      expect(chunks[0].totalSize).toBe(50 * 1024);
      expect(chunks[1].totalSize).toBe(25 * 1024);
    });

    test('should split files by size limit', () => {
      const files = [
        { path: 'src/large1.js', size: 3 * 1024 * 1024, content: 'x'.repeat(1000) },
        { path: 'src/large2.js', size: 3 * 1024 * 1024, content: 'x'.repeat(1000) }
      ];

      const analysis = handler.analyzeCommitSize(files);
      const chunks = handler.splitFilesIntoChunks(files, analysis);

      expect(chunks.length).toBe(2);
      expect(chunks[0].fileCount).toBe(1);
      expect(chunks[1].fileCount).toBe(1);
      expect(chunks[0].totalSize).toBe(3 * 1024 * 1024);
      expect(chunks[1].totalSize).toBe(3 * 1024 * 1024);
    });

    test('should optimize chunking by sorting files by size', () => {
      const files = [
        { path: 'src/large.js', size: 4 * 1024 * 1024, content: 'x'.repeat(1000) },
        { path: 'src/small1.js', size: 1024, content: 'small' },
        { path: 'src/small2.js', size: 1024, content: 'small' },
        { path: 'src/small3.js', size: 1024, content: 'small' }
      ];

      const analysis = handler.analyzeCommitSize(files);
      const chunks = handler.splitFilesIntoChunks(files, analysis);

      expect(chunks.length).toBe(1);
      // All files should be in one chunk since total size is under limit
      expect(chunks[0].fileCount).toBe(4);
      expect(chunks[0].totalSize).toBe(4 * 1024 * 1024 + 3 * 1024);
    });

    test('should handle single file that exceeds limits', () => {
      const files = [
        { path: 'src/huge.js', size: 6 * 1024 * 1024, content: 'x'.repeat(1000) }
      ];

      const analysis = handler.analyzeCommitSize(files);
      const chunks = handler.splitFilesIntoChunks(files, analysis);

      expect(chunks.length).toBe(1);
      expect(chunks[0].fileCount).toBe(1);
      expect(chunks[0].totalSize).toBe(6 * 1024 * 1024);
    });
  });

  describe('generateSkipNotification', () => {
    test('should generate skip notification for total size exceeded', () => {
      const files = [
        { path: 'src/large.js', size: 6 * 1024 * 1024, content: 'x'.repeat(1000) }
      ];
      const context = { repository: 'test-repo', targetBranch: 'main' };

      const analysis = handler.analyzeCommitSize(files);
      const notification = handler.generateSkipNotification(analysis, context);

      expect(notification.type).toBe('large_commit_skipped');
      expect(notification.title).toBe('Large Commit Skipped - test-repo (main)');
      expect(notification.message).toContain('AI code review was skipped due to commit size limitations');
      expect(notification.message).toContain('6 MB');
      expect(notification.message).toContain('5 MB');
      expect(notification.severity).toBe('warning');
      expect(notification.details.totalFiles).toBe(1);
      expect(notification.details.reason).toBe('total_size_exceeded');
    });

    test('should generate skip notification for oversized files', () => {
      const files = [
        { path: 'src/large.js', size: 2 * 1024 * 1024, content: 'x'.repeat(1000) }
      ];
      const context = { repository: 'test-repo', targetBranch: 'main' };

      const analysis = handler.analyzeCommitSize(files);
      const notification = handler.generateSkipNotification(analysis, context);

      expect(notification.type).toBe('large_commit_skipped');
      expect(notification.message).toContain('1 file(s) exceed the 1 MB individual file size limit');
      expect(notification.details.reason).toBe('oversized_files');
    });
  });

  describe('generateSplitNotification', () => {
    test('should generate split notification', () => {
      const files = Array.from({ length: 75 }, (_, i) => ({
        path: `src/file${i}.js`,
        size: 1024,
        content: 'test'
      }));
      const context = { repository: 'test-repo', targetBranch: 'main' };

      const analysis = handler.analyzeCommitSize(files);
      const chunks = handler.splitFilesIntoChunks(files, analysis);
      const notification = handler.generateSplitNotification(chunks, analysis, context);

      expect(notification.type).toBe('large_commit_split');
      expect(notification.title).toBe('Large Commit Split for Review - test-repo (main)');
      expect(notification.message).toContain('split into 2 review chunks');
      expect(notification.severity).toBe('info');
      expect(notification.details.originalFiles).toBe(75);
      expect(notification.details.chunks).toHaveLength(2);
      expect(notification.details.chunks[0].chunkNumber).toBe(1);
      expect(notification.details.chunks[0].fileCount).toBe(50);
      expect(notification.details.chunks[1].chunkNumber).toBe(2);
      expect(notification.details.chunks[1].fileCount).toBe(25);
    });
  });

  describe('filterOversizedFiles', () => {
    test('should filter out oversized files', () => {
      const files = [
        { path: 'src/normal.js', size: 1024, content: 'normal' },
        { path: 'src/large.js', size: 2 * 1024 * 1024, content: 'large' },
        { path: 'src/small.js', size: 512, content: 'small' }
      ];

      const result = handler.filterOversizedFiles(files);

      expect(result.included).toHaveLength(2);
      expect(result.included[0].path).toBe('src/normal.js');
      expect(result.included[1].path).toBe('src/small.js');
      
      expect(result.excluded).toHaveLength(1);
      expect(result.excluded[0].path).toBe('src/large.js');
      expect(result.excluded[0].reason).toBe('file_too_large');
      expect(result.excluded[0].maxSize).toBe(1024 * 1024);
    });

    test('should handle all files within size limit', () => {
      const files = [
        { path: 'src/small1.js', size: 1024, content: 'small' },
        { path: 'src/small2.js', size: 512, content: 'small' }
      ];

      const result = handler.filterOversizedFiles(files);

      expect(result.included).toHaveLength(2);
      expect(result.excluded).toHaveLength(0);
    });

    test('should handle all files exceeding size limit', () => {
      const files = [
        { path: 'src/large1.js', size: 2 * 1024 * 1024, content: 'large' },
        { path: 'src/large2.js', size: 3 * 1024 * 1024, content: 'large' }
      ];

      const result = handler.filterOversizedFiles(files);

      expect(result.included).toHaveLength(0);
      expect(result.excluded).toHaveLength(2);
    });
  });

  describe('getRecommendations', () => {
    test('should provide recommendations for total size exceeded', () => {
      const files = [{ path: 'src/large.js', size: 6 * 1024 * 1024, content: 'x'.repeat(1000) }];
      const analysis = handler.analyzeCommitSize(files);

      const recommendations = handler.getRecommendations(analysis);

      expect(recommendations).toContain('Consider splitting the commit into smaller, focused changes');
      expect(recommendations).toContain('Review if all files in the commit are necessary for this change');
      expect(recommendations).toContain('Consider excluding large binary files or generated files from review');
    });

    test('should provide recommendations for file count exceeded', () => {
      const files = Array.from({ length: 55 }, (_, i) => ({
        path: `src/file${i}.js`,
        size: 1024,
        content: 'test'
      }));
      const analysis = handler.analyzeCommitSize(files);

      const recommendations = handler.getRecommendations(analysis);

      expect(recommendations).toContain('Break down the commit into logical units (e.g., feature + tests)');
      expect(recommendations).toContain('Consider reviewing related files in separate commits');
      expect(recommendations).toContain('Use smaller, incremental commits for better reviewability');
    });

    test('should provide recommendations for oversized files', () => {
      const files = [{ path: 'src/large.js', size: 2 * 1024 * 1024, content: 'large' }];
      const analysis = handler.analyzeCommitSize(files);

      const recommendations = handler.getRecommendations(analysis);

      expect(recommendations).toContain('Exclude large files (binaries, generated files) from AI review');
      expect(recommendations).toContain('Consider manual review for large files');
      expect(recommendations).toContain('Add large files to .gitignore or review exclusion patterns');
    });
  });

  describe('formatBytes', () => {
    test('should format bytes correctly', () => {
      expect(handler.formatBytes(0)).toBe('0 Bytes');
      expect(handler.formatBytes(1024)).toBe('1 KB');
      expect(handler.formatBytes(1024 * 1024)).toBe('1 MB');
      expect(handler.formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
      expect(handler.formatBytes(1536)).toBe('1.5 KB');
    });
  });

  describe('getConfiguration', () => {
    test('should return configuration summary', () => {
      const config = handler.getConfiguration();

      expect(config.maxFilesPerReview).toBe(50);
      expect(config.maxFileSizeBytes).toBe(1024 * 1024);
      expect(config.maxTotalSizeBytes).toBe(5 * 1024 * 1024);
      expect(config.maxTokens).toBe(4000);
      expect(config.estimatedTokensPerChar).toBe(0.25);
    });
  });
});
