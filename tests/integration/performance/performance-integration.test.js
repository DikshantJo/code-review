/**
 * Performance Integration Tests for AI Review System
 * Tests system performance under various load conditions and scenarios
 */

const AIReviewAction = require('../../../src/actions/ai-review-action');
const ConfigLoader = require('../../../src/utils/config-loader');
const GitHubClient = require('../../../src/utils/github-client');
const EmailNotifier = require('../../../src/utils/email-notifier');

// Performance test configurations
const PERFORMANCE_CONFIGS = {
  small: {
    files: 5,
    maxTokens: 2000,
    expectedTime: 10000, // 10 seconds
    description: 'Small review (5 files, 2K tokens)'
  },
  medium: {
    files: 20,
    maxTokens: 5000,
    expectedTime: 25000, // 25 seconds
    description: 'Medium review (20 files, 5K tokens)'
  },
  large: {
    files: 50,
    maxTokens: 10000,
    expectedTime: 60000, // 60 seconds
    description: 'Large review (50 files, 10K tokens)'
  },
  xlarge: {
    files: 100,
    maxTokens: 15000,
    expectedTime: 120000, // 2 minutes
    description: 'Extra large review (100 files, 15K tokens)'
  }
};

// Mock data generators
const generateMockFiles = (count) => {
  return Array.from({ length: count }, (_, i) => ({
    filename: `src/file${i}.js`,
    status: 'modified',
    additions: Math.floor(Math.random() * 100) + 10,
    deletions: Math.floor(Math.random() * 50),
    changes: 0,
    patch: `@@ -1,3 +1,25 @@\n+// File ${i} content\n+function function${i}() {\n+  console.log('File ${i}');\n+  return true;\n+}\n+// ... rest of patch`
  }));
};

const generateMockAIResponse = (fileCount, tokenCount) => {
  const issuesPerFile = Math.floor(tokenCount / fileCount / 100);
  const issues = [];
  
  for (let i = 0; i < fileCount * issuesPerFile; i++) {
    issues.push({
      title: `Issue ${i}`,
      description: `Description for issue ${i}`.repeat(5),
      severity: ['low', 'medium', 'high'][i % 3],
      line: i + 1,
      file: `src/file${i % fileCount}.js`
    });
  }
  
  return {
    choices: [{
      message: {
        content: JSON.stringify({
          passed: Math.random() > 0.3,
          qualityScore: 0.5 + Math.random() * 0.4,
          issues: issues,
          summary: `Review of ${fileCount} files completed`,
          recommendations: Array.from({ length: 5 }, (_, i) => `Recommendation ${i}`)
        })
      },
      finish_reason: 'stop'
    }],
    usage: {
      prompt_tokens: Math.floor(tokenCount * 0.6),
      completion_tokens: Math.floor(tokenCount * 0.4),
      total_tokens: tokenCount
    }
  };
};

describe('AI Review System Performance Tests', () => {
  let aiReviewAction;
  let configLoader;
  let githubClient;
  let emailNotifier;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create instances
    configLoader = new ConfigLoader();
    githubClient = new GitHubClient();
    emailNotifier = new EmailNotifier();
    
    // Create AI review action
    aiReviewAction = new AIReviewAction();
    aiReviewAction.context = {
      repo: { owner: 'test-owner', repo: 'test-repo' },
      ref: 'refs/heads/feature/test',
      sha: 'abc123def456',
      actor: 'test-user'
    };
  });

  describe('Single Review Performance', () => {
    Object.entries(PERFORMANCE_CONFIGS).forEach(([size, config]) => {
      it(`should complete ${config.description} within expected time`, async () => {
        // Mock configuration
        const mockConfig = {
          ai: {
            model: 'gpt-4',
            max_tokens: config.maxTokens,
            temperature: 0.1
          },
          review: {
            max_files: config.files * 2,
            quality_gates: { enabled: true, min_score: 0.7 }
          }
        };
        
        jest.spyOn(aiReviewAction, 'loadConfiguration').mockResolvedValue(mockConfig);
        
        // Mock file list
        const mockFiles = generateMockFiles(config.files);
        jest.spyOn(githubClient, 'getPullRequestFiles').mockResolvedValue(mockFiles);
        
        // Mock AI response
        const mockAIResponse = generateMockAIResponse(config.files, config.maxTokens);
        jest.spyOn(aiReviewAction.openaiClient, 'reviewCode').mockResolvedValue(mockAIResponse);
        
        // Mock issue creation
        jest.spyOn(githubClient, 'createIssue').mockResolvedValue({ id: 123 });
        
        // Measure performance
        const startTime = Date.now();
        const result = await aiReviewAction.execute();
        const executionTime = Date.now() - startTime;
        
        // Verify results
        expect(result.success).toBe(true);
        expect(result.files).toBe(config.files);
        expect(executionTime).toBeLessThan(config.expectedTime);
        
        // Log performance metrics
        console.log(`✅ ${config.description}: ${executionTime}ms (expected: ${config.expectedTime}ms)`);
        console.log(`   Files processed: ${result.files}`);
        console.log(`   AI response time: ${result.reviewResult?.aiResponseTime || 'N/A'}ms`);
        console.log(`   Total tokens used: ${result.reviewResult?.tokenUsage?.totalTokens || 'N/A'}`);
      }, config.expectedTime + 10000); // Add 10s buffer for test timeout
    });
  });

  describe('Concurrent Review Performance', () => {
    it('should handle 3 concurrent reviews efficiently', async () => {
      const concurrentCount = 3;
      const config = PERFORMANCE_CONFIGS.medium;
      
      // Mock configuration
      const mockConfig = {
        ai: {
          model: 'gpt-4',
          max_tokens: config.maxTokens,
          temperature: 0.1
        },
        review: {
          max_files: config.files * 2,
          quality_gates: { enabled: true, min_score: 0.7 }
        }
      };
      
      jest.spyOn(aiReviewAction, 'loadConfiguration').mockResolvedValue(mockConfig);
      
      // Mock file lists for each concurrent review
      const mockFiles = generateMockFiles(config.files);
      jest.spyOn(githubClient, 'getPullRequestFiles').mockResolvedValue(mockFiles);
      
      // Mock AI responses
      const mockAIResponse = generateMockAIResponse(config.files, config.maxTokens);
      jest.spyOn(aiReviewAction.openaiClient, 'reviewCode').mockResolvedValue(mockAIResponse);
      
      // Mock issue creation
      jest.spyOn(githubClient, 'createIssue').mockResolvedValue({ id: 123 });
      
      // Execute concurrent reviews
      const startTime = Date.now();
      const promises = Array.from({ length: concurrentCount }, () => aiReviewAction.execute());
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      
      // Verify all reviews completed successfully
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.files).toBe(config.files);
      });
      
      // Performance should be better than sequential execution
      const sequentialTime = config.expectedTime * concurrentCount;
      expect(totalTime).toBeLessThan(sequentialTime);
      
      console.log(`✅ 3 concurrent ${config.description}: ${totalTime}ms (sequential would be ~${sequentialTime}ms)`);
      console.log(`   Efficiency improvement: ${Math.round((1 - totalTime / sequentialTime) * 100)}%`);
    }, 120000); // 2 minutes timeout
  });

  describe('Memory Usage Performance', () => {
    it('should maintain stable memory usage during large reviews', async () => {
      const config = PERFORMANCE_CONFIGS.large;
      
      // Mock configuration
      const mockConfig = {
        ai: {
          model: 'gpt-4',
          max_tokens: config.maxTokens,
          temperature: 0.1
        },
        review: {
          max_files: config.files * 2,
          quality_gates: { enabled: true, min_score: 0.7 }
        }
      };
      
      jest.spyOn(aiReviewAction, 'loadConfiguration').mockResolvedValue(mockConfig);
      
      // Mock large file list
      const mockFiles = generateMockFiles(config.files);
      jest.spyOn(githubClient, 'getPullRequestFiles').mockResolvedValue(mockFiles);
      
      // Mock large AI response
      const mockAIResponse = generateMockAIResponse(config.files, config.maxTokens);
      jest.spyOn(aiReviewAction.openaiClient, 'reviewCode').mockResolvedValue(mockAIResponse);
      
      // Mock issue creation
      jest.spyOn(githubClient, 'createIssue').mockResolvedValue({ id: 123 });
      
      // Measure memory usage
      const initialMemory = process.memoryUsage();
      
      const startTime = Date.now();
      const result = await aiReviewAction.execute();
      const executionTime = Date.now() - startTime;
      
      const finalMemory = process.memoryUsage();
      
      // Verify results
      expect(result.success).toBe(true);
      expect(result.files).toBe(config.files);
      
      // Calculate memory growth
      const heapGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      const externalGrowth = finalMemory.external - initialMemory.external;
      const rssGrowth = finalMemory.rss - initialMemory.rss;
      
      // Memory growth should be reasonable (less than 50MB)
      expect(heapGrowth).toBeLessThan(50 * 1024 * 1024); // 50MB
      expect(externalGrowth).toBeLessThan(20 * 1024 * 1024); // 20MB
      expect(rssGrowth).toBeLessThan(100 * 1024 * 1024); // 100MB
      
      console.log(`✅ Memory usage for ${config.description}:`);
      console.log(`   Heap growth: ${Math.round(heapGrowth / 1024 / 1024)}MB`);
      console.log(`   External growth: ${Math.round(externalGrowth / 1024 / 1024)}MB`);
      console.log(`   RSS growth: ${Math.round(rssGrowth / 1024 / 1024)}MB`);
      console.log(`   Execution time: ${executionTime}ms`);
    }, 120000); // 2 minutes timeout
  });

  describe('API Rate Limiting Performance', () => {
    it('should handle GitHub API rate limiting gracefully', async () => {
      const config = PERFORMANCE_CONFIGS.medium;
      
      // Mock configuration
      const mockConfig = {
        ai: {
          model: 'gpt-4',
          max_tokens: config.maxTokens,
          temperature: 0.1
        },
        review: {
          max_files: config.files * 2,
          quality_gates: { enabled: true, min_score: 0.7 }
        }
      };
      
      jest.spyOn(aiReviewAction, 'loadConfiguration').mockResolvedValue(mockConfig);
      
      // Mock file list
      const mockFiles = generateMockFiles(config.files);
      
      // Mock rate limiting scenario
      let callCount = 0;
      jest.spyOn(githubClient, 'getPullRequestFiles').mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          // First two calls succeed
          return Promise.resolve(mockFiles);
        } else {
          // Subsequent calls fail with rate limit
          return Promise.reject(new Error('GitHub API rate limit exceeded'));
        }
      });
      
      // Mock AI response
      const mockAIResponse = generateMockAIResponse(config.files, config.maxTokens);
      jest.spyOn(aiReviewAction.openaiClient, 'reviewCode').mockResolvedValue(mockAIResponse);
      
      // Mock issue creation
      jest.spyOn(githubClient, 'createIssue').mockResolvedValue({ id: 123 });
      
      // Measure performance with retries
      const startTime = Date.now();
      const result = await aiReviewAction.execute();
      const executionTime = Date.now() - startTime;
      
      // Verify results
      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(60000); // Should complete within 1 minute even with retries
      
      console.log(`✅ Rate limiting handling: ${executionTime}ms`);
      console.log(`   GitHub API calls: ${callCount}`);
    }, 120000); // 2 minutes timeout
  });

  describe('Error Recovery Performance', () => {
    it('should recover from AI API failures within reasonable time', async () => {
      const config = PERFORMANCE_CONFIGS.small;
      
      // Mock configuration
      const mockConfig = {
        ai: {
          model: 'gpt-4',
          max_tokens: config.maxTokens,
          temperature: 0.1
        },
        review: {
          max_files: config.files * 2,
          quality_gates: { enabled: true, min_score: 0.7 }
        }
      };
      
      jest.spyOn(aiReviewAction, 'loadConfiguration').mockResolvedValue(mockConfig);
      
      // Mock file list
      const mockFiles = generateMockFiles(config.files);
      jest.spyOn(githubClient, 'getPullRequestFiles').mockResolvedValue(mockFiles);
      
      // Mock AI API failures followed by success
      let aiCallCount = 0;
      jest.spyOn(aiReviewAction.openaiClient, 'reviewCode').mockImplementation(() => {
        aiCallCount++;
        if (aiCallCount <= 2) {
          // First two calls fail
          return Promise.reject(new Error('OpenAI API temporary failure'));
        } else {
          // Third call succeeds
          return Promise.resolve(generateMockAIResponse(config.files, config.maxTokens));
        }
      });
      
      // Mock issue creation
      jest.spyOn(githubClient, 'createIssue').mockResolvedValue({ id: 123 });
      
      // Measure recovery performance
      const startTime = Date.now();
      const result = await aiReviewAction.execute();
      const executionTime = Date.now() - startTime;
      
      // Verify results
      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(30000); // Should recover within 30 seconds
      
      console.log(`✅ Error recovery performance: ${executionTime}ms`);
      console.log(`   AI API calls: ${aiCallCount}`);
      console.log(`   Recovery time: ${executionTime}ms`);
    }, 60000); // 1 minute timeout
  });

  describe('Scalability Performance', () => {
    it('should scale linearly with file count', async () => {
      const testSizes = [5, 10, 20, 30];
      const results = [];
      
      for (const fileCount of testSizes) {
        const config = {
          files: fileCount,
          maxTokens: fileCount * 200,
          expectedTime: fileCount * 1000
        };
        
        // Mock configuration
        const mockConfig = {
          ai: {
            model: 'gpt-4',
            max_tokens: config.maxTokens,
            temperature: 0.1
          },
          review: {
            max_files: fileCount * 2,
            quality_gates: { enabled: true, min_score: 0.7 }
          }
        };
        
        jest.spyOn(aiReviewAction, 'loadConfiguration').mockResolvedValue(mockConfig);
        
        // Mock file list
        const mockFiles = generateMockFiles(fileCount);
        jest.spyOn(githubClient, 'getPullRequestFiles').mockResolvedValue(mockFiles);
        
        // Mock AI response
        const mockAIResponse = generateMockAIResponse(fileCount, config.maxTokens);
        jest.spyOn(aiReviewAction.openaiClient, 'reviewCode').mockResolvedValue(mockAIResponse);
        
        // Mock issue creation
        jest.spyOn(githubClient, 'createIssue').mockResolvedValue({ id: 123 });
        
        // Measure performance
        const startTime = Date.now();
        const result = await aiReviewAction.execute();
        const executionTime = Date.now() - startTime;
        
        results.push({
          fileCount,
          executionTime,
          expectedTime: config.expectedTime,
          efficiency: config.expectedTime / executionTime
        });
        
        // Verify results
        expect(result.success).toBe(true);
        expect(result.files).toBe(fileCount);
      }
      
      // Analyze scalability
      console.log('📊 Scalability Analysis:');
      results.forEach(result => {
        console.log(`   ${result.fileCount} files: ${result.executionTime}ms (efficiency: ${result.efficiency.toFixed(2)})`);
      });
      
      // Performance should scale reasonably (not exponentially)
      const avgEfficiency = results.reduce((sum, r) => sum + r.efficiency, 0) / results.length;
      expect(avgEfficiency).toBeGreaterThan(0.5); // At least 50% efficiency
      
      console.log(`   Average efficiency: ${avgEfficiency.toFixed(2)}`);
    }, 300000); // 5 minutes timeout
  });

  describe('Resource Cleanup Performance', () => {
    it('should clean up resources efficiently after large operations', async () => {
      const config = PERFORMANCE_CONFIGS.large;
      
      // Mock configuration
      const mockConfig = {
        ai: {
          model: 'gpt-4',
          max_tokens: config.maxTokens,
          temperature: 0.1
        },
        review: {
          max_files: config.files * 2,
          quality_gates: { enabled: true, min_score: 0.7 }
        }
      };
      
      jest.spyOn(aiReviewAction, 'loadConfiguration').mockResolvedValue(mockConfig);
      
      // Mock file list
      const mockFiles = generateMockFiles(config.files);
      jest.spyOn(githubClient, 'getPullRequestFiles').mockResolvedValue(mockFiles);
      
      // Mock AI response
      const mockAIResponse = generateMockAIResponse(config.files, config.maxTokens);
      jest.spyOn(aiReviewAction.openaiClient, 'reviewCode').mockResolvedValue(mockAIResponse);
      
      // Mock issue creation
      jest.spyOn(githubClient, 'createIssue').mockResolvedValue({ id: 123 });
      
      // Measure memory before operation
      const memoryBefore = process.memoryUsage();
      
      // Execute operation
      const startTime = Date.now();
      const result = await aiReviewAction.execute();
      const executionTime = Date.now() - startTime;
      
      // Wait for garbage collection
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Measure memory after cleanup
      const memoryAfter = process.memoryUsage();
      
      // Verify results
      expect(result.success).toBe(true);
      expect(result.files).toBe(config.files);
      
      // Calculate cleanup efficiency
      const heapCleanup = memoryBefore.heapUsed - memoryAfter.heapUsed;
      const externalCleanup = memoryBefore.external - memoryAfter.external;
      
      console.log(`✅ Resource cleanup for ${config.description}:`);
      console.log(`   Execution time: ${executionTime}ms`);
      console.log(`   Heap cleanup: ${Math.round(heapCleanup / 1024 / 1024)}MB`);
      console.log(`   External cleanup: ${Math.round(externalCleanup / 1024 / 1024)}MB`);
      
      // Should clean up at least some memory
      expect(heapCleanup).toBeGreaterThan(0);
    }, 120000); // 2 minutes timeout
  });
});
