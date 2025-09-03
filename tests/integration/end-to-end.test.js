/**
 * End-to-End Tests for AI Review System
 * Tests the complete system workflow from configuration to final output
 */

const AIReviewAction = require('../../src/actions/ai-review-action');
const ConfigLoader = require('../../src/utils/config-loader');
const GitHubClient = require('../../src/utils/github-client');
const EmailNotifier = require('../../src/utils/email-notifier');
const FileFilter = require('../../src/utils/file-filter');

// Mock file system for testing
const mockFileSystem = {
  'ai-review-config.yml': `
ai:
  model: 'gpt-4'
  max_tokens: 4000
  temperature: 0.1

notifications:
  email:
    enabled: true
    smtp_host: 'smtp.test.com'
    smtp_user: 'test@test.com'
    smtp_pass: 'test-pass'
    to_emails: ['dev@test.com', 'qa@test.com']

review:
  max_files: 100
  quality_gates:
    enabled: true
    min_score: 0.7
    block_high_severity: true

environments:
  development:
    ai:
      model: 'gpt-3.5-turbo'
      max_tokens: 2000
    review:
      quality_gates:
        min_score: 0.5
        block_high_severity: false
  
  production:
    ai:
      model: 'gpt-4'
      max_tokens: 4000
    review:
      quality_gates:
        min_score: 0.8
        block_high_severity: true
  `,
  
  'src/test-file.js': `
// Test JavaScript file
function testFunction() {
  console.log('Hello World');
  return true;
}

// Missing semicolon
const testVar = 'test'

// Unused variable
const unusedVar = 'unused';

// Security issue - hardcoded password
const password = 'secret123';

// Performance issue - inefficient loop
for (let i = 0; i < 1000000; i++) {
  console.log(i);
}

module.exports = { testFunction };
  `,
  
  'tests/test-file.test.js': `
const { testFunction } = require('../src/test-file');

describe('testFunction', () => {
  it('should return true', () => {
    expect(testFunction()).toBe(true);
  });
});
  `
};

// Mock GitHub context
const mockContext = {
  repo: {
    owner: 'test-owner',
    repo: 'test-repo'
  },
  ref: 'refs/heads/feature/test-branch',
  sha: 'abc123def456',
  actor: 'test-user',
  eventName: 'pull_request',
  payload: {
    pull_request: {
      number: 123,
      title: 'Test PR with code quality issues',
      body: 'This PR adds a new test function but has some code quality issues',
      user: { login: 'test-user' }
    }
  }
};

// Mock GitHub API responses
const mockGitHubResponses = {
  pullRequestFiles: [
    {
      filename: 'src/test-file.js',
      status: 'modified',
      additions: 25,
      deletions: 5,
      changes: 30,
      patch: '@@ -1,3 +1,25 @@\n+// Test JavaScript file\n+function testFunction() {\n+  console.log(\'Hello World\');\n+  return true;\n+}\n+// ... rest of patch'
    },
    {
      filename: 'tests/test-file.test.js',
      status: 'added',
      additions: 8,
      deletions: 0,
      changes: 8,
      patch: '@@ -0,0 +1,8 @@\n+const { testFunction } = require(\'../src/test-file\');\n+// ... rest of patch'
    }
  ],
  
  createIssue: {
    id: 123,
    number: 123,
    title: 'Code Review [feature/test-branch] - 5 Issue(s) Found',
    body: 'AI review found several code quality issues...',
    labels: ['ai-review', 'code-quality', 'medium', 'low'],
    assignees: ['dev@test.com']
  }
};

describe('AI Review System End-to-End Tests', () => {
  let aiReviewAction;
  let configLoader;
  let githubClient;
  let emailNotifier;
  let fileFilter;

  beforeEach(() => {
    // Reset mocks and environment
    jest.clearAllMocks();
    process.env.NODE_ENV = 'development';
    
    // Create instances
    configLoader = new ConfigLoader();
    githubClient = new GitHubClient();
    emailNotifier = new EmailNotifier();
    fileFilter = new FileFilter();
    
    // Create AI review action
    aiReviewAction = new AIReviewAction();
    aiReviewAction.context = mockContext;
    
    // Mock file system operations
    jest.spyOn(require('fs'), 'readFileSync').mockImplementation((path) => {
      if (mockFileSystem[path]) {
        return mockFileSystem[path];
      }
      throw new Error(`File not found: ${path}`);
    });
    
    jest.spyOn(require('fs'), 'existsSync').mockImplementation((path) => {
      return mockFileSystem.hasOwnProperty(path);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Complete Workflow - Development Environment', () => {
    it('should complete full review workflow in development environment', async () => {
      // 1. Configuration Loading
      const config = await configLoader.loadConfiguration();
      expect(config.ai.model).toBe('gpt-3.5-turbo'); // Development override
      expect(config.review.quality_gates.min_score).toBe(0.5); // Development override
      
      // 2. Branch Detection
      const branchInfo = aiReviewAction.branchDetector.detectBranches();
      expect(branchInfo.environment).toBe('development');
      expect(branchInfo.targetBranch).toBe('feature/test-branch');
      
      // 3. File Detection
      jest.spyOn(githubClient, 'getPullRequestFiles').mockResolvedValue(
        mockGitHubResponses.pullRequestFiles
      );
      
      const files = await aiReviewAction.getChangedFiles();
      expect(files).toHaveLength(2);
      expect(files[0].filename).toBe('src/test-file.js');
      
      // 4. File Filtering
      const filteredFiles = fileFilter.filterFiles(files);
      expect(filteredFiles.length).toBeGreaterThan(0);
      
      // 5. AI Review
      const mockAIResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              passed: false,
              qualityScore: 0.6,
              issues: [
                {
                  title: 'Missing semicolon',
                  description: 'Line 8 is missing a semicolon',
                  severity: 'low',
                  line: 8,
                  file: 'src/test-file.js'
                },
                {
                  title: 'Unused variable',
                  description: 'Variable unusedVar is declared but never used',
                  severity: 'low',
                  line: 11,
                  file: 'src/test-file.js'
                },
                {
                  title: 'Hardcoded password',
                  description: 'Password should not be hardcoded in source code',
                  severity: 'high',
                  line: 14,
                  file: 'src/test-file.js'
                },
                {
                  title: 'Inefficient loop',
                  description: 'Loop iterates 1 million times which may cause performance issues',
                  severity: 'medium',
                  line: 17,
                  file: 'src/test-file.js'
                },
                {
                  title: 'Missing test coverage',
                  description: 'Function testFunction lacks comprehensive test coverage',
                  severity: 'medium',
                  line: 2,
                  file: 'src/test-file.js'
                }
              ],
              summary: 'Code review found 5 issues including security concerns and performance issues',
              recommendations: [
                'Add semicolons where missing',
                'Remove unused variables',
                'Use environment variables for sensitive data',
                'Optimize loop performance',
                'Add more comprehensive tests'
              ]
            })
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 150,
          completion_tokens: 200,
          total_tokens: 350
        }
      };
      
      jest.spyOn(aiReviewAction.openaiClient, 'reviewCode').mockResolvedValue(mockAIResponse);
      
      // 6. Review Execution
      const reviewResult = await aiReviewAction.performReview(files, branchInfo, config);
      expect(reviewResult.passed).toBe(false);
      expect(reviewResult.qualityScore).toBe(0.6);
      expect(reviewResult.issues).toHaveLength(5);
      
      // 7. Quality Gates Check
      const gateResult = await aiReviewAction.checkQualityGates(
        'test-session',
        branchInfo,
        reviewResult
      );
      expect(gateResult.passed).toBe(true); // Development allows lower scores
      
      // 8. Issue Creation
      jest.spyOn(githubClient, 'createIssue').mockResolvedValue(
        mockGitHubResponses.createIssue
      );
      
      await aiReviewAction.createReviewIssue(branchInfo, reviewResult);
      expect(githubClient.createIssue).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('5 Issue(s) Found'),
          labels: expect.arrayContaining(['ai-review', 'code-quality'])
        })
      );
      
      // 9. Email Notification
      jest.spyOn(emailNotifier, 'sendReviewNotification').mockResolvedValue(true);
      
      await aiReviewAction.sendNotifications(branchInfo, reviewResult, gateResult);
      expect(emailNotifier.sendReviewNotification).toHaveBeenCalled();
      
      // 10. Final Result
      const finalResult = await aiReviewAction.execute();
      expect(finalResult.success).toBe(true);
      expect(finalResult.files).toBe(2);
      expect(finalResult.reviewResult).toBeDefined();
      expect(finalResult.gateResult).toBeDefined();
    });
  });

  describe('Complete Workflow - Production Environment', () => {
    it('should enforce stricter quality gates in production', async () => {
      // Set production environment
      process.env.NODE_ENV = 'production';
      
      // 1. Configuration Loading
      const config = await configLoader.loadConfiguration();
      expect(config.ai.model).toBe('gpt-4'); // Production model
      expect(config.review.quality_gates.min_score).toBe(0.8); // Stricter threshold
      
      // 2. Branch Detection
      const branchInfo = {
        targetBranch: 'main',
        environment: 'production',
        branchType: 'production'
      };
      
      // 3. Mock AI Review with low score
      const mockAIResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              passed: false,
              qualityScore: 0.7, // Below production threshold
              issues: [
                {
                  title: 'Critical security issue',
                  description: 'SQL injection vulnerability',
                  severity: 'critical',
                  line: 25,
                  file: 'src/database.js'
                }
              ],
              summary: 'Critical security vulnerability found',
              recommendations: ['Fix SQL injection vulnerability immediately']
            })
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 200,
          completion_tokens: 100,
          total_tokens: 300
        }
      };
      
      jest.spyOn(aiReviewAction.openaiClient, 'reviewCode').mockResolvedValue(mockAIResponse);
      
      // 4. Review Execution
      const files = [{ filename: 'src/database.js', status: 'modified' }];
      const reviewResult = await aiReviewAction.performReview(files, branchInfo, config);
      expect(reviewResult.passed).toBe(false);
      expect(reviewResult.qualityScore).toBe(0.7);
      
      // 5. Quality Gates Check - Should fail in production
      const gateResult = await aiReviewAction.checkQualityGates(
        'test-session',
        branchInfo,
        reviewResult
      );
      expect(gateResult.passed).toBe(false); // Production blocks low scores
      expect(gateResult.blocked).toBe(true);
      
      // 6. Issue Creation - Should still create issue
      jest.spyOn(githubClient, 'createIssue').mockResolvedValue(
        mockGitHubResponses.createIssue
      );
      
      await aiReviewAction.createReviewIssue(branchInfo, reviewResult);
      expect(githubClient.createIssue).toHaveBeenCalled();
      
      // 7. Final Result - Should indicate failure
      const finalResult = await aiReviewAction.execute();
      expect(finalResult.success).toBe(false);
      expect(finalResult.gateResult.passed).toBe(false);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle configuration errors gracefully', async () => {
      // Mock configuration loading failure
      jest.spyOn(configLoader, 'loadConfiguration').mockRejectedValue(
        new Error('Invalid YAML syntax')
      );
      
      try {
        await aiReviewAction.execute();
        fail('Should have thrown configuration error');
      } catch (error) {
        expect(error.message).toContain('Invalid YAML syntax');
      }
    });

    it('should handle GitHub API failures gracefully', async () => {
      // Mock GitHub API failure
      jest.spyOn(githubClient, 'getPullRequestFiles').mockRejectedValue(
        new Error('GitHub API rate limit exceeded')
      );
      
      try {
        await aiReviewAction.getChangedFiles();
        fail('Should have thrown GitHub API error');
      } catch (error) {
        expect(error.message).toContain('GitHub API rate limit exceeded');
      }
    });

    it('should handle AI API failures gracefully', async () => {
      // Mock AI API failure
      jest.spyOn(aiReviewAction.openaiClient, 'reviewCode').mockRejectedValue(
        new Error('OpenAI API authentication failed')
      );
      
      try {
        await aiReviewAction.performReview(
          [{ filename: 'src/test.js' }],
          { targetBranch: 'feature/test' },
          await configLoader.loadConfiguration()
        );
        fail('Should have thrown AI API error');
      } catch (error) {
        expect(error.message).toContain('OpenAI API authentication failed');
      }
    });

    it('should handle email notification failures gracefully', async () => {
      // Mock email failure
      jest.spyOn(emailNotifier, 'sendReviewNotification').mockRejectedValue(
        new Error('SMTP connection failed')
      );
      
      // Mock successful review
      const reviewResult = {
        passed: true,
        issues: [],
        qualityScore: 0.9
      };
      
      const branchInfo = { targetBranch: 'feature/test', environment: 'development' };
      const gateResult = { passed: true };
      
      // Should not throw error, just log it
      await expect(
        aiReviewAction.sendNotifications(branchInfo, reviewResult, gateResult)
      ).resolves.not.toThrow();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large numbers of files efficiently', async () => {
      // Mock large file list
      const largeFileList = Array.from({ length: 100 }, (_, i) => ({
        filename: `src/file${i}.js`,
        status: 'modified',
        additions: Math.floor(Math.random() * 100) + 1,
        deletions: Math.floor(Math.random() * 50),
        changes: 0
      }));
      
      jest.spyOn(githubClient, 'getPullRequestFiles').mockResolvedValue(largeFileList);
      
      const startTime = Date.now();
      const files = await aiReviewAction.getChangedFiles();
      const loadTime = Date.now() - startTime;
      
      expect(files).toHaveLength(100);
      expect(loadTime).toBeLessThan(1000); // Should load in under 1 second
    });

    it('should handle large AI responses efficiently', async () => {
      // Mock large AI response
      const largeAIResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              passed: false,
              issues: Array.from({ length: 50 }, (_, i) => ({
                title: `Issue ${i}`,
                description: `Description for issue ${i}`.repeat(10),
                severity: ['low', 'medium', 'high'][i % 3],
                line: i + 1,
                file: `src/file${i}.js`
              })),
              summary: 'Large number of issues found',
              recommendations: Array.from({ length: 20 }, (_, i) => `Recommendation ${i}`)
            })
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 1000,
          completion_tokens: 5000,
          total_tokens: 6000
        }
      };
      
      jest.spyOn(aiReviewAction.openaiClient, 'reviewCode').mockResolvedValue(largeAIResponse);
      
      const startTime = Date.now();
      const result = await aiReviewAction.performReview(
        [{ filename: 'src/test.js' }],
        { targetBranch: 'feature/test' },
        await configLoader.loadConfiguration()
      );
      const processingTime = Date.now() - startTime;
      
      expect(result.issues).toHaveLength(50);
      expect(processingTime).toBeLessThan(5000); // Should process in under 5 seconds
    });
  });

  describe('Data Consistency and Validation', () => {
    it('should maintain data consistency throughout the workflow', async () => {
      // 1. Load configuration
      const config = await configLoader.loadConfiguration();
      
      // 2. Get files
      jest.spyOn(githubClient, 'getPullRequestFiles').mockResolvedValue(
        mockGitHubResponses.pullRequestFiles
      );
      const files = await aiReviewAction.getChangedFiles();
      
      // 3. Perform review
      const mockAIResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              passed: false,
              qualityScore: 0.6,
              issues: [
                {
                  title: 'Test Issue',
                  description: 'Test description',
                  severity: 'medium',
                  line: 5,
                  file: 'src/test-file.js'
                }
              ],
              summary: 'Test summary',
              recommendations: ['Test recommendation']
            })
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150
        }
      };
      
      jest.spyOn(aiReviewAction.openaiClient, 'reviewCode').mockResolvedValue(mockAIResponse);
      
      const reviewResult = await aiReviewAction.performReview(files, { targetBranch: 'feature/test' }, config);
      
      // 4. Verify data consistency
      expect(reviewResult.filesCount).toBe(files.length);
      expect(reviewResult.issues).toHaveLength(1);
      expect(reviewResult.issues[0].file).toBe('src/test-file.js');
      expect(reviewResult.qualityScore).toBe(0.6);
      expect(reviewResult.passed).toBe(false);
      
      // 5. Verify token usage consistency
      expect(reviewResult.tokenUsage.totalTokens).toBe(150);
      expect(reviewResult.tokenUsage.promptTokens).toBe(100);
      expect(reviewResult.tokenUsage.completionTokens).toBe(50);
    });

    it('should validate all data structures throughout the workflow', async () => {
      // Mock AI response with invalid structure
      const invalidAIResponse = {
        choices: [{
          message: {
            content: 'Invalid JSON content' // Not valid JSON
          }
        }]
      };
      
      jest.spyOn(aiReviewAction.openaiClient, 'reviewCode').mockResolvedValue(invalidAIResponse);
      
      try {
        await aiReviewAction.performReview(
          [{ filename: 'src/test.js' }],
          { targetBranch: 'feature/test' },
          await configLoader.loadConfiguration()
        );
        fail('Should have thrown parsing error');
      } catch (error) {
        expect(error.message).toContain('Failed to parse AI response');
      }
    });
  });
});
