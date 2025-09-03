/**
 * Integration Tests for AI Review System
 * Tests the complete workflow from configuration loading to issue creation
 */

const AIReviewAction = require('../../src/actions/ai-review-action');
const ConfigLoader = require('../../src/utils/config-loader');
const GitHubClient = require('../../src/utils/github-client');
const EmailNotifier = require('../../src/utils/email-notifier');

// Mock GitHub context for testing
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
      title: 'Test PR',
      body: 'Test PR description',
      user: { login: 'test-user' }
    }
  }
};

// Mock configuration
const mockConfig = {
  ai: {
    model: 'gpt-4',
    max_tokens: 4000,
    temperature: 0.1
  },
  notifications: {
    email: {
      enabled: true,
      smtp_host: 'smtp.test.com',
      smtp_user: 'test@test.com',
      smtp_pass: 'test-pass'
    }
  },
  review: {
    max_files: 100,
    quality_gates: {
      enabled: true,
      min_score: 0.7
    }
  },
  environments: {
    development: {
      ai: {
        model: 'gpt-3.5-turbo',
        max_tokens: 2000
      }
    },
    production: {
      ai: {
        model: 'gpt-4',
        max_tokens: 4000
      }
    }
  }
};

describe('AI Review System Integration Tests', () => {
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
    
    // Mock the AIReviewAction constructor dependencies
    aiReviewAction = new AIReviewAction();
    
    // Mock the context
    aiReviewAction.context = mockContext;
  });

  describe('Configuration Loading Integration', () => {
    it('should load and merge configuration from multiple sources', async () => {
      // Mock file system operations
      jest.spyOn(require('fs'), 'readFileSync').mockReturnValue(
        JSON.stringify(mockConfig)
      );
      
      // Mock environment detection
      process.env.NODE_ENV = 'development';
      
      const config = await configLoader.loadConfiguration();
      
      expect(config).toBeDefined();
      expect(config.ai.model).toBe('gpt-3.5-turbo'); // Development override
      expect(config.ai.max_tokens).toBe(2000); // Development override
      expect(config.review.quality_gates.enabled).toBe(true); // Base config
    });

    it('should apply environment-specific overrides correctly', async () => {
      // Mock file system operations
      jest.spyOn(require('fs'), 'readFileSync').mockReturnValue(
        JSON.stringify(mockConfig)
      );
      
      // Test development environment
      process.env.NODE_ENV = 'development';
      let config = await configLoader.loadConfiguration();
      expect(config.ai.model).toBe('gpt-3.5-turbo');
      
      // Test production environment
      process.env.NODE_ENV = 'production';
      config = await configLoader.loadConfiguration();
      expect(config.ai.model).toBe('gpt-4');
    });

    it('should validate configuration and report errors', async () => {
      const invalidConfig = {
        notifications: {
          email: {
            enabled: true,
            // Missing required fields
          }
        }
      };
      
      jest.spyOn(require('fs'), 'readFileSync').mockReturnValue(
        JSON.stringify(invalidConfig)
      );
      
      try {
        await configLoader.loadConfiguration();
        fail('Should have thrown validation error');
      } catch (error) {
        expect(error.message).toContain('Configuration validation failed');
      }
    });
  });

  describe('GitHub Integration', () => {
    it('should detect branch types correctly', () => {
      const branchInfo = aiReviewAction.branchDetector.detectBranches();
      
      expect(branchInfo).toBeDefined();
      expect(branchInfo.targetBranch).toBe('feature/test-branch');
      expect(branchInfo.environment).toBe('development');
    });

    it('should validate branch movement rules', () => {
      const branchInfo = aiReviewAction.branchDetector.detectBranches();
      
      // Test valid branch movement
      const isValid = aiReviewAction.branchDetector.isValidBranchMovement(branchInfo);
      expect(typeof isValid).toBe('boolean');
    });

    it('should get changed files from GitHub API', async () => {
      // Mock GitHub API response
      const mockFiles = [
        { filename: 'src/test.js', status: 'added', additions: 10, deletions: 0 },
        { filename: 'tests/test.test.js', status: 'added', additions: 5, deletions: 0 }
      ];
      
      jest.spyOn(githubClient, 'getPullRequestFiles').mockResolvedValue(mockFiles);
      
      const files = await aiReviewAction.getChangedFiles();
      
      expect(files).toBeDefined();
      expect(files.length).toBe(2);
      expect(files[0].filename).toBe('src/test.js');
    });
  });

  describe('AI Review Workflow Integration', () => {
    it('should perform complete review workflow', async () => {
      // Mock all dependencies
      jest.spyOn(aiReviewAction, 'loadConfiguration').mockResolvedValue(mockConfig);
      jest.spyOn(aiReviewAction, 'getChangedFiles').mockResolvedValue([
        { filename: 'src/test.js', status: 'added', additions: 10, deletions: 0 }
      ]);
      
      // Mock AI response
      const mockAIResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              passed: false,
              issues: [
                {
                  title: 'Test Issue',
                  description: 'Test issue description',
                  severity: 'medium',
                  line: 5
                }
              ],
              summary: 'Test summary',
              recommendations: ['Test recommendation']
            }
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
      
      // Mock issue creation
      jest.spyOn(githubClient, 'createIssue').mockResolvedValue({ id: 123 });
      
      // Execute review
      const result = await aiReviewAction.execute();
      
      expect(result.success).toBe(true);
      expect(result.files).toBe(1);
      expect(result.reviewResult).toBeDefined();
    });

    it('should handle review failures gracefully', async () => {
      // Mock configuration loading failure
      jest.spyOn(aiReviewAction, 'loadConfiguration').mockRejectedValue(
        new Error('Configuration failed')
      );
      
      try {
        await aiReviewAction.execute();
        fail('Should have thrown error');
      } catch (error) {
        expect(error.message).toContain('Configuration failed');
      }
    });
  });

  describe('Quality Gates Integration', () => {
    it('should enforce quality gates for production', async () => {
      // Mock production environment
      const productionBranchInfo = {
        targetBranch: 'main',
        environment: 'production',
        branchType: 'production'
      };
      
      // Mock failed review
      const failedReview = {
        passed: false,
        qualityScore: 0.5,
        issues: [
          { title: 'Critical Issue', severity: 'critical' }
        ]
      };
      
      // Mock quality gate check
      const gateResult = await aiReviewAction.checkQualityGates(
        'test-session',
        productionBranchInfo,
        failedReview
      );
      
      expect(gateResult).toBeDefined();
      expect(gateResult.passed).toBe(false);
    });

    it('should allow development branches to pass with lower scores', async () => {
      // Mock development environment
      const devBranchInfo = {
        targetBranch: 'feature/test',
        environment: 'development',
        branchType: 'feature'
      };
      
      // Mock review with low score
      const lowScoreReview = {
        passed: false,
        qualityScore: 0.3,
        issues: [
          { title: 'Minor Issue', severity: 'low' }
        ]
      };
      
      // Mock quality gate check
      const gateResult = await aiReviewAction.checkQualityGates(
        'test-session',
        devBranchInfo,
        lowScoreReview
      );
      
      expect(gateResult).toBeDefined();
      // Development branches should be more lenient
      expect(gateResult.passed).toBe(true);
    });
  });

  describe('Notification Integration', () => {
    it('should send email notifications for failed reviews', async () => {
      // Mock failed review
      const failedReview = {
        passed: false,
        issues: [
          { title: 'Test Issue', severity: 'medium' }
        ]
      };
      
      // Mock email sending
      jest.spyOn(emailNotifier, 'sendReviewNotification').mockResolvedValue(true);
      
      const result = await aiReviewAction.sendNotifications(
        { targetBranch: 'feature/test', environment: 'development' },
        failedReview,
        { passed: false }
      );
      
      expect(emailNotifier.sendReviewNotification).toHaveBeenCalled();
    });

    it('should create GitHub issues for failed reviews', async () => {
      // Mock failed review
      const failedReview = {
        passed: false,
        issues: [
          { title: 'Test Issue', severity: 'medium' }
        ]
      };
      
      // Mock issue creation
      jest.spyOn(githubClient, 'createIssue').mockResolvedValue({ id: 123 });
      
      await aiReviewAction.createReviewIssue(
        { targetBranch: 'feature/test', environment: 'development' },
        failedReview
      );
      
      expect(githubClient.createIssue).toHaveBeenCalled();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle GitHub API failures gracefully', async () => {
      // Mock GitHub API failure
      jest.spyOn(githubClient, 'getPullRequestFiles').mockRejectedValue(
        new Error('GitHub API rate limit exceeded')
      );
      
      try {
        await aiReviewAction.getChangedFiles();
        fail('Should have thrown error');
      } catch (error) {
        expect(error.message).toContain('GitHub API rate limit exceeded');
      }
    });

    it('should handle AI API failures gracefully', async () => {
      // Mock AI API failure
      jest.spyOn(aiReviewAction.openaiClient, 'reviewCode').mockRejectedValue(
        new Error('OpenAI API error')
      );
      
      try {
        await aiReviewAction.performReview(
          [{ filename: 'src/test.js' }],
          { targetBranch: 'feature/test' },
          mockConfig
        );
        fail('Should have thrown error');
      } catch (error) {
        expect(error.message).toContain('OpenAI API error');
      }
    });

    it('should handle configuration validation failures', async () => {
      // Mock invalid configuration
      const invalidConfig = {
        ai: {
          max_tokens: -1 // Invalid value
        }
      };
      
      try {
        await configLoader.validateConfiguration(invalidConfig);
        fail('Should have thrown validation error');
      } catch (error) {
        expect(error.message).toContain('Configuration validation failed');
      }
    });
  });

  describe('Performance Integration', () => {
    it('should track response times and performance metrics', async () => {
      // Mock AI response with timing
      const startTime = Date.now();
      const mockAIResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              passed: true,
              issues: [],
              summary: 'Test summary'
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
      
      // Mock file list
      jest.spyOn(aiReviewAction, 'getChangedFiles').mockResolvedValue([
        { filename: 'src/test.js', status: 'added', additions: 10, deletions: 0 }
      ]);
      
      const result = await aiReviewAction.performReview(
        [{ filename: 'src/test.js' }],
        { targetBranch: 'feature/test' },
        mockConfig
      );
      
      expect(result.aiResponseTime).toBeDefined();
      expect(result.aiResponseTime).toBeGreaterThan(0);
      expect(result.tokenUsage).toBeDefined();
      expect(result.tokenUsage.totalTokens).toBe(150);
    });
  });
});
