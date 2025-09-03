/**
 * Integration Tests for File Detection with GitHub API
 * Tests file detection methods using actual GitHub API response structures
 */

const FileFilter = require('../../src/utils/file-filter');
const GitHubClient = require('../../src/utils/github-client');

// Mock GitHub API responses for integration testing
const mockGitHubResponses = {
  commit: {
    data: {
      sha: 'abc123def456',
      commit: {
        message: 'feat: add new authentication system',
        author: { name: 'John Doe', email: 'john@example.com' }
      },
      files: [
        {
          filename: 'src/auth/login.js',
          status: 'added',
          additions: 45,
          deletions: 0,
          changes: 45,
          blob_url: 'https://github.com/test/repo/blob/abc123/src/auth/login.js',
          raw_url: 'https://github.com/test/repo/raw/abc123/src/auth/login.js',
          contents_url: 'https://api.github.com/repos/test/repo/contents/src/auth/login.js'
        },
        {
          filename: 'src/auth/register.js',
          status: 'added',
          additions: 38,
          deletions: 0,
          changes: 38,
          blob_url: 'https://github.com/test/repo/blob/abc123/src/auth/register.js',
          raw_url: 'https://github.com/test/repo/raw/abc123/src/auth/register.js',
          contents_url: 'https://api.github.com/repos/test/repo/contents/src/auth/register.js'
        },
        {
          filename: 'tests/auth/login.test.js',
          status: 'added',
          additions: 25,
          deletions: 0,
          changes: 25,
          blob_url: 'https://github.com/test/repo/blob/abc123/tests/auth/login.test.js',
          raw_url: 'https://github.com/test/repo/raw/abc123/tests/auth/login.test.js',
          contents_url: 'https://api.github.com/repos/test/repo/contents/tests/auth/login.test.js'
        },
        {
          filename: 'src/config/auth.json',
          status: 'modified',
          additions: 12,
          deletions: 8,
          changes: 20,
          blob_url: 'https://github.com/test/repo/blob/abc123/src/config/auth.json',
          raw_url: 'https://github.com/test/repo/raw/abc123/src/config/auth.json',
          contents_url: 'https://api.github.com/repos/test/repo/contents/src/config/auth.json'
        },
        {
          filename: 'docs/auth.md',
          status: 'added',
          additions: 67,
          deletions: 0,
          changes: 67,
          blob_url: 'https://github.com/test/repo/blob/abc123/docs/auth.md',
          raw_url: 'https://github.com/test/repo/raw/abc123/docs/auth.md',
          contents_url: 'https://api.github.com/repos/test/repo/contents/docs/auth.md'
        }
      ]
    }
  },
  pullRequest: {
    data: [
      {
        filename: 'src/components/Button.jsx',
        status: 'modified',
        additions: 23,
        deletions: 15,
        changes: 38,
        blob_url: 'https://github.com/test/repo/blob/abc123/src/components/Button.jsx',
        raw_url: 'https://github.com/test/repo/raw/abc123/src/components/Button.jsx',
        contents_url: 'https://api.github.com/repos/test/repo/contents/src/components/Button.jsx'
      },
      {
        filename: 'src/components/Button.test.jsx',
        status: 'modified',
        additions: 18,
        deletions: 5,
        changes: 23,
        blob_url: 'https://github.com/test/repo/blob/abc123/src/components/Button.test.jsx',
        raw_url: 'https://github.com/test/repo/raw/abc123/src/components/Button.test.jsx',
        contents_url: 'https://api.github.com/repos/test/repo/contents/src/components/Button.test.jsx'
      },
      {
        filename: 'src/styles/button.css',
        status: 'added',
        additions: 34,
        deletions: 0,
        changes: 34,
        blob_url: 'https://github.com/test/repo/blob/abc123/src/styles/button.css',
        raw_url: 'https://github.com/test/repo/raw/abc123/src/styles/button.css',
        contents_url: 'https://api.github.com/repos/test/repo/contents/src/styles/button.css'
      },
      {
        filename: 'package.json',
        status: 'modified',
        additions: 3,
        deletions: 1,
        changes: 4,
        blob_url: 'https://github.com/test/repo/blob/abc123/src/components/Button.jsx',
        raw_url: 'https://github.com/test/repo/raw/abc123/src/components/Button.jsx',
        contents_url: 'https://api.github.com/repos/test/repo/contents/src/components/Button.jsx'
      }
    ]
  }
};

describe('File Detection Integration Tests', () => {
  let fileFilter;
  let githubClient;

  beforeEach(() => {
    fileFilter = new FileFilter();
    githubClient = new GitHubClient();
  });

  describe('GitHub Commit File Integration', () => {
    it('should process commit files with GitHub API response structure', () => {
      const commitFiles = mockGitHubResponses.commit.data.files;
      
      // Transform GitHub API response to our internal format
      const processedFiles = commitFiles.map(file => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        size: (file.additions + file.deletions) * 50, // Estimate size
        lines: file.additions + file.deletions,
        priority: file.status === 'added' ? 80 : 60
      }));

      const analysis = fileFilter.getEnhancedFileCount(processedFiles);

      // Verify basic counts
      expect(analysis.totalFiles).toBe(5);
      expect(analysis.includedFiles).toBe(5); // All files should be included
      expect(analysis.excludedFiles).toBe(0);

      // Verify file type categorization
      expect(analysis.byType.code).toBe(2);      // login.js, register.js
      expect(analysis.byType.test).toBe(1);      // login.test.js
      expect(analysis.byType.config).toBe(1);    // auth.json
      expect(analysis.byType.documentation).toBe(1); // auth.md

      // Verify status analysis
      expect(analysis.byStatus.added).toBe(4);
      expect(analysis.byStatus.modified).toBe(1);

      // Verify size analysis (estimated)
      expect(analysis.bySize.medium).toBeGreaterThan(0); // Files with estimated sizes
    });

    it('should handle large commit with many files', () => {
      // Create a large commit scenario
      const largeCommitFiles = Array.from({ length: 25 }, (_, i) => ({
        filename: `src/feature${i}/component${i}.js`,
        status: 'added',
        additions: 50 + (i * 10),
        deletions: 0,
        changes: 50 + (i * 10),
        size: (50 + (i * 10)) * 50,
        lines: 50 + (i * 10),
        priority: 70
      }));

      const analysis = fileFilter.getEnhancedFileCount(largeCommitFiles);

      expect(analysis.totalFiles).toBe(25);
      expect(analysis.byType.code).toBe(25);
      expect(analysis.byStatus.added).toBe(25);
      expect(analysis.summary.totalLines).toBeGreaterThan(1000);
    });

    it('should categorize mixed file types correctly', () => {
      const mixedFiles = [
        { filename: 'src/main.js', status: 'modified', additions: 20, deletions: 10, size: 1500, lines: 30, priority: 75 },
        { filename: 'src/styles/main.css', status: 'added', additions: 45, deletions: 0, size: 2200, lines: 45, priority: 80 },
        { filename: 'tests/integration/api.test.js', status: 'added', additions: 67, deletions: 0, size: 3200, lines: 67, priority: 85 },
        { filename: 'docs/API.md', status: 'modified', additions: 12, deletions: 8, size: 800, lines: 20, priority: 60 },
        { filename: 'config/database.yml', status: 'added', additions: 23, deletions: 0, size: 1100, lines: 23, priority: 70 }
      ];

      const analysis = fileFilter.getEnhancedFileCount(mixedFiles);

      expect(analysis.byType.code).toBe(1);      // main.js
      expect(analysis.byType.styles).toBe(1);    // main.css
      expect(analysis.byType.test).toBe(1);      // api.test.js
      expect(analysis.byType.documentation).toBe(1); // API.md
      expect(analysis.byType.config).toBe(1);    // database.yml
    });
  });

  describe('GitHub Pull Request File Integration', () => {
    it('should process pull request files with GitHub API response structure', () => {
      const prFiles = mockGitHubResponses.pullRequest.data;
      
      // Transform GitHub API response to our internal format
      const processedFiles = prFiles.map(file => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        size: (file.additions + file.deletions) * 50, // Estimate size
        lines: file.additions + file.deletions,
        priority: file.status === 'added' ? 80 : 70
      }));

      const analysis = fileFilter.getEnhancedFileCount(processedFiles);

      // Verify basic counts
      expect(analysis.totalFiles).toBe(4);
      expect(analysis.byType.code).toBe(1);      // Button.jsx
      expect(analysis.byType.test).toBe(1);      // Button.test.jsx
      expect(analysis.byType.styles).toBe(1);    // button.css
      expect(analysis.byType.config).toBe(1);    // package.json

      // Verify status analysis
      expect(analysis.byStatus.added).toBe(1);
      expect(analysis.byStatus.modified).toBe(3);
    });

    it('should handle complex file changes with renames and deletions', () => {
      const complexFiles = [
        { filename: 'src/old/component.js', status: 'deleted', additions: 0, deletions: 45, size: 0, lines: 0, priority: 50 },
        { filename: 'src/new/component.js', status: 'added', additions: 67, deletions: 0, size: 3350, lines: 67, priority: 90 },
        { filename: 'src/utils/helper.js', status: 'renamed', additions: 12, deletions: 8, size: 1000, lines: 20, priority: 65 },
        { filename: 'src/styles/component.css', status: 'modified', additions: 23, deletions: 15, size: 1900, lines: 38, priority: 75 }
      ];

      const analysis = fileFilter.getEnhancedFileCount(complexFiles);

      expect(analysis.totalFiles).toBe(4);
      expect(analysis.byStatus.deleted).toBe(1);
      expect(analysis.byStatus.added).toBe(1);
      expect(analysis.byStatus.renamed).toBe(1);
      expect(analysis.byStatus.modified).toBe(1);
    });
  });

  describe('Real-World File Patterns Integration', () => {
    it('should handle common project structure patterns', () => {
      const projectFiles = [
        // Source code
        { filename: 'src/index.js', status: 'modified', additions: 15, deletions: 5, size: 1000, lines: 20, priority: 70 },
        { filename: 'src/components/Header.jsx', status: 'added', additions: 89, deletions: 0, size: 4450, lines: 89, priority: 85 },
        { filename: 'src/utils/helpers.ts', status: 'modified', additions: 23, deletions: 12, size: 1750, lines: 35, priority: 75 },
        
        // Tests
        { filename: 'tests/unit/index.test.js', status: 'added', additions: 34, deletions: 0, size: 1700, lines: 34, priority: 80 },
        { filename: 'tests/e2e/Header.spec.ts', status: 'added', additions: 56, deletions: 0, size: 2800, lines: 56, priority: 85 },
        
        // Configuration
        { filename: 'tsconfig.json', status: 'modified', additions: 8, deletions: 3, size: 550, lines: 11, priority: 60 },
        { filename: 'webpack.config.js', status: 'modified', additions: 12, deletions: 7, size: 950, lines: 19, priority: 65 },
        
        // Documentation
        { filename: 'docs/README.md', status: 'modified', additions: 45, deletions: 12, size: 2850, lines: 57, priority: 55 },
        { filename: 'docs/CHANGELOG.md', status: 'added', additions: 23, deletions: 0, size: 1150, lines: 23, priority: 50 },
        
        // Additional file to make it 10
        { filename: 'src/styles/main.css', status: 'added', additions: 34, deletions: 0, size: 1700, lines: 34, priority: 75 }
      ];

      // For integration testing, we'll test the core file processing logic
      // by directly testing the file categorization methods
      
      // Debug: Log the input files to verify we have 10 files
      console.log('Input project files count:', projectFiles.length);
      console.log('Input project files:', projectFiles.map(f => f.filename));

      // Test file categorization directly
      const fileTypes = projectFiles.map(file => {
        const fileType = fileFilter.getFileCategory(file.filename);
        const mappedType = fileFilter.mapFileTypeToCategory(fileType);
        return { filename: file.filename, type: fileType, mappedType };
      });

      console.log('File categorization results:', fileTypes);

      // Verify file categorization works correctly
      expect(fileTypes).toHaveLength(10);
      
      // Check specific categorizations
      const indexJs = fileTypes.find(f => f.filename === 'src/index.js');
      expect(indexJs.mappedType).toBe('code');
      
      const headerJsx = fileTypes.find(f => f.filename === 'src/components/Header.jsx');
      expect(headerJsx.mappedType).toBe('code');
      
      const helpersTs = fileTypes.find(f => f.filename === 'src/utils/helpers.ts');
      expect(helpersTs.mappedType).toBe('code'); // TypeScript should be mapped to code
      
      const testFile = fileTypes.find(f => f.filename === 'tests/unit/index.test.js');
      expect(testFile.mappedType).toBe('test');
      
      const specFile = fileTypes.find(f => f.filename === 'tests/e2e/Header.spec.ts');
      expect(specFile.mappedType).toBe('test');
      
      const tsconfig = fileTypes.find(f => f.filename === 'tsconfig.json');
      expect(tsconfig.mappedType).toBe('config');
      
      const webpack = fileTypes.find(f => f.filename === 'webpack.config.js');
      expect(webpack.mappedType).toBe('config');
      
      const readme = fileTypes.find(f => f.filename === 'docs/README.md');
      expect(readme.mappedType).toBe('documentation');
      
      const changelog = fileTypes.find(f => f.filename === 'docs/CHANGELOG.md');
      expect(changelog.mappedType).toBe('documentation');
      
      const mainCss = fileTypes.find(f => f.filename === 'src/styles/main.css');
      expect(mainCss.mappedType).toBe('styles');
    });

    it('should handle monorepo structure patterns', () => {
      const monorepoFiles = [
        // Package A
        { filename: 'packages/package-a/src/index.js', status: 'added', additions: 67, deletions: 0, size: 3350, lines: 67, priority: 90 },
        { filename: 'packages/package-a/tests/index.test.js', status: 'added', additions: 34, deletions: 0, size: 1700, lines: 34, priority: 85 },
        { filename: 'packages/package-a/package.json', status: 'added', additions: 23, deletions: 0, size: 1150, lines: 23, priority: 70 },
        
        // Package B
        { filename: 'packages/package-b/src/utils.js', status: 'modified', additions: 12, deletions: 8, size: 1000, lines: 20, priority: 75 },
        { filename: 'packages/package-b/dist/bundle.min.js', status: 'added', additions: 156, deletions: 0, size: 7800, lines: 156, priority: 60 },
        
        // Root level
        { filename: 'lerna.json', status: 'modified', additions: 5, deletions: 2, size: 350, lines: 7, priority: 65 },
        { filename: 'jest.config.js', status: 'modified', additions: 8, deletions: 3, size: 550, lines: 11, priority: 70 }
      ];

      // Test file categorization directly for monorepo structure
      const monorepoFileTypes = monorepoFiles.map(file => {
        const fileType = fileFilter.getFileCategory(file.filename);
        const mappedType = fileFilter.mapFileTypeToCategory(fileType);
        return { filename: file.filename, type: fileType, mappedType };
      });

      console.log('Monorepo file categorization results:', monorepoFileTypes);

      // Verify file categorization works correctly
      expect(monorepoFileTypes).toHaveLength(7);
      
      // Check specific categorizations
      const packageAIndex = monorepoFileTypes.find(f => f.filename === 'packages/package-a/src/index.js');
      expect(packageAIndex.mappedType).toBe('code');
      
      const packageBUtils = monorepoFileTypes.find(f => f.filename === 'packages/package-b/src/utils.js');
      expect(packageBUtils.mappedType).toBe('code');
      
      const packageATest = monorepoFileTypes.find(f => f.filename === 'packages/package-a/tests/index.test.js');
      expect(packageATest.mappedType).toBe('test');
      
      const packageAPkg = monorepoFileTypes.find(f => f.filename === 'packages/package-a/package.json');
      expect(packageAPkg.mappedType).toBe('config');
      
      const lerna = monorepoFileTypes.find(f => f.filename === 'lerna.json');
      expect(lerna.mappedType).toBe('config');
      
      const jest = monorepoFileTypes.find(f => f.filename === 'jest.config.js');
      expect(jest.mappedType).toBe('config');
      
      const bundle = monorepoFileTypes.find(f => f.filename === 'packages/package-b/dist/bundle.min.js');
      expect(bundle.mappedType).toBe('build');
    });
  });

  describe('Performance and Scalability Integration', () => {
    it('should handle large file sets efficiently', () => {
      const largeFileSet = Array.from({ length: 100 }, (_, i) => ({
        filename: `src/feature${i}/component${i}.js`,
        status: i % 3 === 0 ? 'added' : i % 3 === 1 ? 'modified' : 'deleted',
        additions: Math.floor(Math.random() * 100) + 10,
        deletions: Math.floor(Math.random() * 50),
        changes: Math.floor(Math.random() * 150) + 10,
        size: Math.floor(Math.random() * 5000) + 500,
        lines: Math.floor(Math.random() * 200) + 20,
        priority: Math.floor(Math.random() * 100) + 20
      }));

      const startTime = Date.now();
      const analysis = fileFilter.getEnhancedFileCount(largeFileSet);
      const endTime = Date.now();

      expect(analysis.totalFiles).toBe(100);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      
      // Verify all files were processed
      expect(analysis.byType.code).toBeGreaterThan(0);
      expect(analysis.summary.totalSize).toBeGreaterThan(0);
      expect(analysis.summary.totalLines).toBeGreaterThan(0);
    });

    it('should maintain accuracy with complex file patterns', () => {
      const complexFiles = [
        // Edge cases
        { filename: 'src/component.with.dots.js', status: 'added', additions: 45, deletions: 0, size: 2250, lines: 45, priority: 80 },
        { filename: 'src/component-with-dashes.js', status: 'modified', additions: 23, deletions: 12, size: 1750, lines: 35, priority: 75 },
        { filename: 'src/COMPONENT_UPPERCASE.js', status: 'added', additions: 67, deletions: 0, size: 3350, lines: 67, priority: 85 },
        { filename: 'src/component123.js', status: 'modified', additions: 12, deletions: 8, size: 1000, lines: 20, priority: 70 },
        
        // Special characters
        { filename: 'src/component@v2.js', status: 'added', additions: 34, deletions: 0, size: 1700, lines: 34, priority: 75 },
        { filename: 'src/component#hash.js', status: 'modified', additions: 18, deletions: 9, size: 1350, lines: 27, priority: 65 }
      ];

      const analysis = fileFilter.getEnhancedFileCount(complexFiles);

      expect(analysis.totalFiles).toBe(6);
      expect(analysis.byType.code).toBe(6); // All should be categorized as code files
      expect(analysis.byStatus.added).toBe(3);
      expect(analysis.byStatus.modified).toBe(3);
    });
  });

  describe('Error Handling and Edge Cases Integration', () => {
    it('should handle malformed GitHub API responses gracefully', () => {
      const malformedFiles = [
        { filename: null, status: 'added', additions: 45, deletions: 0, size: 2250, lines: 45, priority: 80 },
        { filename: '', status: 'modified', additions: 23, deletions: 12, size: 1750, lines: 35, priority: 75 },
        { filename: 'src/valid.js', status: 'added', additions: 67, deletions: 0, size: 3350, lines: 67, priority: 85 },
        { filename: undefined, status: 'modified', additions: 12, deletions: 8, size: 1000, lines: 20, priority: 70 }
      ];

      const analysis = fileFilter.getEnhancedFileCount(malformedFiles);

      expect(analysis.totalFiles).toBe(4);
      expect(analysis.validation.valid).toBe(1); // Only valid.js
      expect(analysis.validation.invalid).toBe(3); // null, empty, undefined filenames
      expect(analysis.validation.errors).toHaveLength(3);
    });

    it('should handle files with extreme values', () => {
      const extremeFiles = [
        { filename: 'src/tiny.js', status: 'added', additions: 1, deletions: 0, size: 50, lines: 1, priority: 10 },
        { filename: 'src/huge.js', status: 'added', additions: 10000, deletions: 0, size: 500000, lines: 10000, priority: 100 },
        { filename: 'src/zero.js', status: 'modified', additions: 0, deletions: 0, size: 0, lines: 0, priority: 0 },
        { filename: 'src/negative.js', status: 'modified', additions: -5, deletions: -3, size: -400, lines: -8, priority: -10 }
      ];

      // Test file validation directly for extreme values
      const validationResults = extremeFiles.map(file => {
        const validation = fileFilter.validateFileData(file);
        return { filename: file.filename, validation };
      });

      console.log('Extreme files validation results:', validationResults);

      // Verify validation works correctly
      expect(validationResults).toHaveLength(4);
      
      // Check specific validations
      const tinyValidation = validationResults.find(f => f.filename === 'src/tiny.js');
      expect(tinyValidation.validation.isValid).toBe(true);
      
      const hugeValidation = validationResults.find(f => f.filename === 'src/huge.js');
      expect(hugeValidation.validation.isValid).toBe(true);
      
      const zeroValidation = validationResults.find(f => f.filename === 'src/zero.js');
      expect(zeroValidation.validation.isValid).toBe(true);
      
      const negativeValidation = validationResults.find(f => f.filename === 'src/negative.js');
      expect(negativeValidation.validation.isValid).toBe(false);
      expect(negativeValidation.validation.error).toContain('Invalid');
    });
  });

  describe('Integration with GitHub Client Methods', () => {
    it('should work seamlessly with getCommitFiles response', async () => {
      // Mock the GitHub client to return our test data
      jest.spyOn(githubClient, 'getCommitFiles').mockResolvedValue(mockGitHubResponses.commit.data.files);

      const commitSha = 'abc123def456';
      const files = await githubClient.getCommitFiles(commitSha);

      // Process files through file filter
      const processedFiles = files.map(file => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        size: (file.additions + file.deletions) * 50,
        lines: file.additions + file.deletions,
        priority: file.status === 'added' ? 80 : 60
      }));

      const analysis = fileFilter.getEnhancedFileCount(processedFiles);

      expect(analysis.totalFiles).toBe(5);
      expect(analysis.byType.code).toBe(2);
      expect(analysis.byType.test).toBe(1);
      expect(analysis.byType.config).toBe(1);
      expect(analysis.byType.documentation).toBe(1);

      // Clean up mock
      jest.restoreAllMocks();
    });

    it('should work seamlessly with getPullRequestFiles response', async () => {
      // Mock the GitHub client to return our test data
      jest.spyOn(githubClient, 'getPullRequestFiles').mockResolvedValue(mockGitHubResponses.pullRequest.data);

      const prNumber = 123;
      const files = await githubClient.getPullRequestFiles(prNumber);

      // Process files through file filter
      const processedFiles = files.map(file => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        size: (file.additions + file.deletions) * 50,
        lines: file.additions + file.deletions,
        priority: file.status === 'added' ? 80 : 70
      }));

      const analysis = fileFilter.getEnhancedFileCount(processedFiles);

      expect(analysis.totalFiles).toBe(4);
      expect(analysis.byType.code).toBe(1);
      expect(analysis.byType.test).toBe(1);
      expect(analysis.byType.styles).toBe(1);
      expect(analysis.byType.config).toBe(1);

      // Clean up mock
      jest.restoreAllMocks();
    });
  });
});
