/**
 * Unit tests for GitHubClient utility
 */

const GitHubClient = require('./github-client');

// Mock @actions/core
jest.mock('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn()
}));

// Mock @actions/github
jest.mock('@actions/github', () => ({
  getOctokit: jest.fn(),
  context: {
    repo: {
      owner: 'test-owner',
      repo: 'test-repo'
    }
  }
}));

describe('GitHubClient', () => {
  let githubClient;
  let mockOctokit;
  let mockCore;

  beforeEach(() => {
    // Setup mock octokit
    mockOctokit = {
      rest: {
        issues: {
          create: jest.fn()
        },
        repos: {
          createCommitStatus: jest.fn(),
          get: jest.fn(),
          getBranchProtection: jest.fn()
        }
      }
    };

    require('@actions/github').getOctokit.mockReturnValue(mockOctokit);
    mockCore = require('@actions/core');

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should initialize with default options', () => {
      process.env.GITHUB_TOKEN = 'test-token';
      
      githubClient = new GitHubClient();
      
      expect(githubClient.options.token).toBe('test-token');
      expect(githubClient.options.owner).toBe('test-owner');
      expect(githubClient.options.repo).toBe('test-repo');
      expect(githubClient.options.defaultLabels).toEqual(['ai-review', 'code-quality']);
      expect(githubClient.options.enableLogging).toBe(true);
      expect(githubClient.options.logLevel).toBe('INFO');
      
      delete process.env.GITHUB_TOKEN;
    });

    test('should initialize with custom options', () => {
      const customOptions = {
        token: 'custom-token',
        owner: 'custom-owner',
        repo: 'custom-repo',
        defaultLabels: ['custom-label'],
        enableLogging: false,
        logLevel: 'ERROR'
      };
      
      githubClient = new GitHubClient(customOptions);
      
      expect(githubClient.options.token).toBe('custom-token');
      expect(githubClient.options.owner).toBe('custom-owner');
      expect(githubClient.options.repo).toBe('custom-repo');
      expect(githubClient.options.defaultLabels).toEqual(['custom-label']);
      expect(githubClient.options.enableLogging).toBe(false);
      expect(githubClient.options.logLevel).toBe('ERROR');
    });

    test('should throw error when no token provided', () => {
      delete process.env.GITHUB_TOKEN;
      
      expect(() => {
        new GitHubClient();
      }).toThrow('GitHub token is required');
    });
  });

  describe('createReviewIssue', () => {
    beforeEach(() => {
      process.env.GITHUB_TOKEN = 'test-token';
      githubClient = new GitHubClient();
    });

    afterEach(() => {
      delete process.env.GITHUB_TOKEN;
    });

    test('should create GitHub issue successfully', async () => {
      const reviewData = {
        source_branch: 'feature/test',
        target_branch: 'main',
        commit_sha: 'abc123456789',
        commit_author: 'test-user',
        commit_message: 'Test commit',
        issues_found: 2,
        severity_breakdown: { high: 1, medium: 1, low: 0 },
        files_reviewed: ['src/test.js'],
        review_duration: 1500,
        ai_findings: [
          {
            title: 'Security Issue',
            severity: 'HIGH',
            category: 'security',
            file: 'src/test.js',
            line: 10,
            description: 'Potential SQL injection',
            code_snippet: 'query = "SELECT * FROM users WHERE id = " + userId',
            recommendation: 'Use parameterized queries'
          }
        ]
      };

      const config = {
        current_environment: 'production',
        notifications: {
          github_issues: {
            enabled: true,
            assign_to_team_lead: true,
            team_lead_username: 'team-lead',
            issue_labels: ['ai-review', 'security']
          }
        }
      };

      const mockResponse = {
        data: {
          number: 123,
          html_url: 'https://github.com/test-owner/test-repo/issues/123',
          title: '🔴 Code Review [main] - HIGH severity issues detected',
          labels: [
            { name: 'ai-review' },
            { name: 'security' },
            { name: 'severity-high' },
            { name: 'env-production' }
          ],
          assignees: [
            { login: 'team-lead' },
            { login: 'test-user' }
          ]
        }
      };

      mockOctokit.rest.issues.create.mockResolvedValue(mockResponse);

      const result = await githubClient.createReviewIssue(reviewData, config);

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        title: expect.stringContaining('Code Review [main]'),
        body: expect.stringContaining('AI Code Review Results'),
        labels: expect.arrayContaining(['ai-review', 'security', 'severity-high', 'env-production']),
        assignees: expect.arrayContaining(['team-lead', 'test-user'])
      });

      expect(result.issueNumber).toBe(123);
      expect(result.issueUrl).toBe('https://github.com/test-owner/test-repo/issues/123');
      expect(result.title).toBe('🔴 Code Review [main] - HIGH severity issues detected');
    });

    test('should handle issue creation errors', async () => {
      const reviewData = {
        source_branch: 'feature/test',
        target_branch: 'main',
        commit_sha: 'abc123456789',
        commit_author: 'test-user',
        commit_message: 'Test commit',
        issues_found: 0,
        severity_breakdown: { high: 0, medium: 0, low: 0 },
        files_reviewed: ['src/test.js'],
        review_duration: 1000,
        ai_findings: []
      };

      const config = {
        current_environment: 'development'
      };

      const error = new Error('API rate limit exceeded');
      mockOctokit.rest.issues.create.mockRejectedValue(error);

      await expect(githubClient.createReviewIssue(reviewData, config))
        .rejects.toThrow('GitHub issue creation failed: API rate limit exceeded');
    });
  });

  describe('prepareIssueData', () => {
    beforeEach(() => {
      process.env.GITHUB_TOKEN = 'test-token';
      githubClient = new GitHubClient();
    });

    afterEach(() => {
      delete process.env.GITHUB_TOKEN;
    });

    test('should prepare issue data with high severity', () => {
      const reviewData = {
        source_branch: 'feature/test',
        target_branch: 'main',
        commit_sha: 'abc123456789',
        commit_author: 'test-user',
        commit_message: 'Test commit',
        issues_found: 1,
        severity_breakdown: { high: 1, medium: 0, low: 0 },
        files_reviewed: ['src/test.js'],
        review_duration: 1000,
        ai_findings: [
          {
            title: 'Security Issue',
            severity: 'HIGH',
            category: 'security',
            file: 'src/test.js',
            line: 10,
            description: 'Potential SQL injection',
            recommendation: 'Use parameterized queries'
          }
        ]
      };

      const config = {
        current_environment: 'production',
        notifications: {
          github_issues: {
            issue_labels: ['ai-review']
          }
        }
      };

      const result = githubClient.prepareIssueData(reviewData, config);

      expect(result.title).toContain('🔴 Code Review [main]');
      expect(result.title).toContain('HIGH severity issues detected');
      expect(result.body).toContain('AI Code Review Results');
      expect(result.body).toContain('🔴 **High:** 1 issues');
      expect(result.body).toContain('Security Issue');
      expect(result.labels).toContain('severity-high');
      expect(result.labels).toContain('env-production');
    });

    test('should prepare issue data with medium severity', () => {
      const reviewData = {
        source_branch: 'feature/test',
        target_branch: 'develop',
        commit_sha: 'abc123456789',
        commit_author: 'test-user',
        commit_message: 'Test commit',
        issues_found: 2,
        severity_breakdown: { high: 0, medium: 2, low: 0 },
        files_reviewed: ['src/app.js'],
        review_duration: 1000,
        ai_findings: [
          {
            title: 'Performance Issue',
            severity: 'MEDIUM',
            category: 'performance',
            file: 'src/app.js',
            line: 25,
            description: 'Inefficient loop',
            recommendation: 'Use array methods'
          }
        ]
      };

      const config = {
        current_environment: 'development'
      };

      const result = githubClient.prepareIssueData(reviewData, config);

      expect(result.title).toContain('🟡 Code Review [develop]');
      expect(result.title).toContain('MEDIUM severity issues detected');
      expect(result.body).toContain('🟡 **Medium:** 2 issues');
    });

    test('should prepare issue data with low severity', () => {
      const reviewData = {
        source_branch: 'feature/test',
        target_branch: 'feature/test',
        commit_sha: 'abc123456789',
        commit_author: 'test-user',
        commit_message: 'Test commit',
        issues_found: 1,
        severity_breakdown: { high: 0, medium: 0, low: 1 },
        files_reviewed: ['src/utils.js'],
        review_duration: 1000,
        ai_findings: [
          {
            title: 'Code Style Issue',
            severity: 'LOW',
            category: 'standards',
            file: 'src/utils.js',
            line: 15,
            description: 'Inconsistent naming',
            recommendation: 'Follow naming conventions'
          }
        ]
      };

      const config = {
        current_environment: 'development'
      };

      const result = githubClient.prepareIssueData(reviewData, config);

      expect(result.title).toContain('🟢 Code Review [feature/test]');
      expect(result.title).toContain('LOW severity issues detected');
      expect(result.body).toContain('🟢 **Low:** 1 issues');
    });

    test('should handle no issues found', () => {
      const reviewData = {
        source_branch: 'feature/test',
        target_branch: 'main',
        commit_sha: 'abc123456789',
        commit_author: 'test-user',
        commit_message: 'Test commit',
        issues_found: 0,
        severity_breakdown: { high: 0, medium: 0, low: 0 },
        files_reviewed: ['src/test.js'],
        review_duration: 1000,
        ai_findings: []
      };

      const config = {
        current_environment: 'production'
      };

      const result = githubClient.prepareIssueData(reviewData, config);

      expect(result.title).toContain('✅ Code Review [main]');
      expect(result.title).toContain('NONE severity issues detected');
      expect(result.body).toContain('✅ Passed');
    });
  });

  describe('createStatusCheck', () => {
    beforeEach(() => {
      process.env.GITHUB_TOKEN = 'test-token';
      githubClient = new GitHubClient();
    });

    afterEach(() => {
      delete process.env.GITHUB_TOKEN;
    });

    test('should create success status check', async () => {
      const reviewData = {
        commit_sha: 'abc123456789',
        severity_breakdown: { high: 0, medium: 0, low: 0 },
        production_blocked: false,
        override_used: false
      };

      const config = {
        current_environment: 'development'
      };

      const mockResponse = {
        data: {
          state: 'success',
          description: 'AI code review passed',
          context: 'ai-code-review/development'
        }
      };

      mockOctokit.rest.repos.createCommitStatus.mockResolvedValue(mockResponse);

      const result = await githubClient.createStatusCheck(reviewData, config);

      expect(mockOctokit.rest.repos.createCommitStatus).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        sha: 'abc123456789',
        state: 'success',
        description: 'AI code review passed',
        context: 'ai-code-review/development',
        target_url: expect.any(String)
      });

      expect(result.state).toBe('success');
      expect(result.description).toBe('AI code review passed');
    });

    test('should create failure status check for high severity issues', async () => {
      const reviewData = {
        commit_sha: 'abc123456789',
        severity_breakdown: { high: 1, medium: 0, low: 0 },
        production_blocked: true,
        override_used: false
      };

      const config = {
        current_environment: 'production'
      };

      const mockResponse = {
        data: {
          state: 'failure',
          description: 'AI code review failed - high severity issues detected',
          context: 'ai-code-review/production'
        }
      };

      mockOctokit.rest.repos.createCommitStatus.mockResolvedValue(mockResponse);

      const result = await githubClient.createStatusCheck(reviewData, config);

      expect(mockOctokit.rest.repos.createCommitStatus).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        sha: 'abc123456789',
        state: 'failure',
        description: 'AI code review failed - high severity issues detected',
        context: 'ai-code-review/production',
        target_url: expect.any(String)
      });

      expect(result.state).toBe('failure');
    });

    test('should create warning status check for low severity issues', async () => {
      const reviewData = {
        commit_sha: 'abc123456789',
        severity_breakdown: { high: 0, medium: 0, low: 1 },
        production_blocked: false,
        override_used: false
      };

      const config = {
        current_environment: 'development'
      };

      const mockResponse = {
        data: {
          state: 'warning',
          description: 'AI code review passed with warnings',
          context: 'ai-code-review/development'
        }
      };

      mockOctokit.rest.repos.createCommitStatus.mockResolvedValue(mockResponse);

      const result = await githubClient.createStatusCheck(reviewData, config);

      expect(result.state).toBe('warning');
      expect(result.description).toBe('AI code review passed with warnings');
    });

    test('should handle override used in status check', async () => {
      const reviewData = {
        commit_sha: 'abc123456789',
        severity_breakdown: { high: 1, medium: 0, low: 0 },
        production_blocked: false,
        override_used: true
      };

      const config = {
        current_environment: 'production'
      };

      const mockResponse = {
        data: {
          state: 'failure',
          description: 'AI code review failed - issues detected (URGENT override used)',
          context: 'ai-code-review/production'
        }
      };

      mockOctokit.rest.repos.createCommitStatus.mockResolvedValue(mockResponse);

      const result = await githubClient.createStatusCheck(reviewData, config);

      expect(result.description).toContain('(URGENT override used)');
    });
  });

  describe('getRepositoryInfo', () => {
    beforeEach(() => {
      process.env.GITHUB_TOKEN = 'test-token';
      githubClient = new GitHubClient();
    });

    afterEach(() => {
      delete process.env.GITHUB_TOKEN;
    });

    test('should get repository information successfully', async () => {
      const mockResponse = {
        data: {
          name: 'test-repo',
          full_name: 'test-owner/test-repo',
          description: 'Test repository',
          default_branch: 'main',
          private: false,
          archived: false,
          disabled: false
        }
      };

      mockOctokit.rest.repos.get.mockResolvedValue(mockResponse);

      const result = await githubClient.getRepositoryInfo();

      expect(mockOctokit.rest.repos.get).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo'
      });

      expect(result.name).toBe('test-repo');
      expect(result.fullName).toBe('test-owner/test-repo');
      expect(result.description).toBe('Test repository');
      expect(result.defaultBranch).toBe('main');
      expect(result.private).toBe(false);
    });

    test('should handle repository info errors', async () => {
      const error = new Error('Repository not found');
      mockOctokit.rest.repos.get.mockRejectedValue(error);

      await expect(githubClient.getRepositoryInfo())
        .rejects.toThrow('Repository info retrieval failed: Repository not found');
    });
  });

  describe('getBranchProtection', () => {
    beforeEach(() => {
      process.env.GITHUB_TOKEN = 'test-token';
      githubClient = new GitHubClient();
    });

    afterEach(() => {
      delete process.env.GITHUB_TOKEN;
    });

    test('should get branch protection when enabled', async () => {
      const mockResponse = {
        data: {
          required_status_checks: {
            strict: true,
            contexts: ['ai-code-review/production']
          },
          enforce_admins: true,
          required_pull_request_reviews: {
            required_approving_review_count: 2
          },
          restrictions: null
        }
      };

      mockOctokit.rest.repos.getBranchProtection.mockResolvedValue(mockResponse);

      const result = await githubClient.getBranchProtection('main');

      expect(mockOctokit.rest.repos.getBranchProtection).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        branch: 'main'
      });

      expect(result.enabled).toBe(true);
      expect(result.requiredStatusChecks).toBeDefined();
      expect(result.enforceAdmins).toBe(true);
    });

    test('should return disabled when branch protection not found', async () => {
      const error = new Error('Branch protection not found');
      error.status = 404;
      mockOctokit.rest.repos.getBranchProtection.mockRejectedValue(error);

      const result = await githubClient.getBranchProtection('feature/test');

      expect(result.enabled).toBe(false);
    });

    test('should handle branch protection errors', async () => {
      const error = new Error('Permission denied');
      error.status = 403;
      mockOctokit.rest.repos.getBranchProtection.mockRejectedValue(error);

      await expect(githubClient.getBranchProtection('main'))
        .rejects.toThrow('Branch protection retrieval failed: Permission denied');
    });
  });

  describe('getCommitFiles', () => {
    beforeEach(() => {
      process.env.GITHUB_TOKEN = 'test-token';
      githubClient = new GitHubClient();
      
      // Setup mock octokit for commit files
      mockOctokit.rest.repos.getCommit = jest.fn();
    });

    afterEach(() => {
      delete process.env.GITHUB_TOKEN;
    });

    test('should retrieve files from commit successfully', async () => {
      const mockCommitResponse = {
        data: {
          files: [
            {
              filename: 'src/main.js',
              status: 'modified',
              additions: 10,
              deletions: 5,
              changes: 15,
              sha: 'abc123',
              blob_url: 'https://github.com/test-owner/test-repo/blob/abc123/src/main.js',
              raw_url: 'https://raw.githubusercontent.com/test-owner/test-repo/abc123/src/main.js'
            },
            {
              filename: 'src/utils.js',
              status: 'added',
              additions: 25,
              deletions: 0,
              changes: 25,
              sha: 'def456',
              blob_url: 'https://github.com/test-owner/test-repo/blob/def456/src/utils.js',
              raw_url: 'https://raw.githubusercontent.com/test-owner/test-repo/def456/src/utils.js'
            }
          ]
        }
      };

      mockOctokit.rest.repos.getCommit.mockResolvedValue(mockCommitResponse);

      const files = await githubClient.getCommitFiles('abc123def456');

      expect(mockOctokit.rest.repos.getCommit).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        ref: 'abc123def456'
      });

      expect(files).toHaveLength(2);
      expect(files[0]).toEqual({
        filename: 'src/main.js',
        status: 'modified',
        additions: 10,
        deletions: 5,
        changes: 15,
        lines: 15,
        patch: '',
        sha: 'abc123',
        blob_url: 'https://github.com/test-owner/test-repo/blob/abc123/src/main.js',
        raw_url: 'https://raw.githubusercontent.com/test-owner/test-repo/abc123/src/main.js'
      });
      expect(files[1]).toEqual({
        filename: 'src/utils.js',
        status: 'added',
        additions: 25,
        deletions: 0,
        changes: 25,
        lines: 25,
        patch: '',
        sha: 'def456',
        blob_url: 'https://github.com/test-owner/test-repo/blob/def456/src/utils.js',
        raw_url: 'https://raw.githubusercontent.com/test-owner/test-repo/def456/src/utils.js'
      });
    });

    test('should handle commit with no files', async () => {
      const mockCommitResponse = {
        data: {
          files: []
        }
      };

      mockOctokit.rest.repos.getCommit.mockResolvedValue(mockCommitResponse);

      const files = await githubClient.getCommitFiles('abc123def456');

      expect(files).toHaveLength(0);
    });

    test('should handle commit response without files property', async () => {
      const mockCommitResponse = {
        data: {}
      };

      mockOctokit.rest.repos.getCommit.mockResolvedValue(mockCommitResponse);

      const files = await githubClient.getCommitFiles('abc123def456');

      expect(files).toHaveLength(0);
    });

    test('should handle null commit response', async () => {
      const mockCommitResponse = {
        data: null
      };

      mockOctokit.rest.repos.getCommit.mockResolvedValue(mockCommitResponse);

      const files = await githubClient.getCommitFiles('abc123def456');

      expect(files).toHaveLength(0);
    });

    test('should handle files with missing optional properties', async () => {
      const mockCommitResponse = {
        data: {
          files: [
            {
              filename: 'src/test.js',
              status: 'deleted'
              // Missing additions, deletions, changes, sha, etc.
            }
          ]
        }
      };

      mockOctokit.rest.repos.getCommit.mockResolvedValue(mockCommitResponse);

      const files = await githubClient.getCommitFiles('abc123def456');

      expect(files).toHaveLength(1);
      expect(files[0]).toEqual({
        filename: 'src/test.js',
        status: 'deleted',
        additions: 0,
        deletions: 0,
        changes: 0,
        lines: 0,
        patch: '',
        sha: '',
        blob_url: '',
        raw_url: ''
      });
    });

    test('should throw error for invalid commit SHA', async () => {
      await expect(githubClient.getCommitFiles('abc')).rejects.toThrow('Invalid commit SHA provided');
      await expect(githubClient.getCommitFiles('')).rejects.toThrow('Invalid commit SHA provided');
      await expect(githubClient.getCommitFiles(null)).rejects.toThrow('Invalid commit SHA provided');
      await expect(githubClient.getCommitFiles(undefined)).rejects.toThrow('Invalid commit SHA provided');
    });

    test('should handle GitHub API errors gracefully', async () => {
      const apiError = new Error('GitHub API Error');
      apiError.status = 404;
      apiError.response = {
        data: {
          message: 'Not Found'
        }
      };

      mockOctokit.rest.repos.getCommit.mockRejectedValue(apiError);

      const files = await githubClient.getCommitFiles('abc123def456');

      expect(files).toHaveLength(0);
    });

    test('should handle network errors gracefully', async () => {
      const networkError = new Error('Network Error');
      mockOctokit.rest.repos.getCommit.mockRejectedValue(networkError);

      const files = await githubClient.getCommitFiles('abc123def456');

      expect(files).toHaveLength(0);
    });
  });

  describe('getPullRequestFiles', () => {
    beforeEach(() => {
      process.env.GITHUB_TOKEN = 'test-token';
      githubClient = new GitHubClient();
      
      // Setup mock octokit for PR files
      mockOctokit.rest.pulls = {
        listFiles: jest.fn()
      };
    });

    afterEach(() => {
      delete process.env.GITHUB_TOKEN;
    });

    test('should retrieve files from pull request successfully', async () => {
      const mockPRResponse = {
        data: [
          {
            filename: 'src/feature.js',
            status: 'added',
            additions: 30,
            deletions: 0,
            changes: 30,
            sha: 'ghi789',
            blob_url: 'https://github.com/test-owner/test-repo/blob/ghi789/src/feature.js',
            raw_url: 'https://raw.githubusercontent.com/test-owner/test-repo/ghi789/src/feature.js'
          },
          {
            filename: 'src/legacy.js',
            status: 'deleted',
            additions: 0,
            deletions: 15,
            changes: 15,
            sha: 'jkl012',
            blob_url: 'https://github.com/test-owner/test-repo/blob/jkl012/src/legacy.js',
            raw_url: 'https://raw.githubusercontent.com/test-owner/test-repo/jkl012/src/legacy.js'
          },
          {
            filename: 'src/renamed.js',
            status: 'renamed',
            additions: 20,
            deletions: 20,
            changes: 40,
            sha: 'mno345',
            blob_url: 'https://github.com/test-owner/test-repo/blob/mno345/src/renamed.js',
            raw_url: 'https://raw.githubusercontent.com/test-owner/test-repo/mno345/src/renamed.js',
            previous_filename: 'src/old-name.js'
          }
        ]
      };

      mockOctokit.rest.pulls.listFiles.mockResolvedValue(mockPRResponse);

      const files = await githubClient.getPullRequestFiles(123);

      expect(mockOctokit.rest.pulls.listFiles).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 123
      });

      expect(files).toHaveLength(3);
      
      // Test added file
      expect(files[0]).toEqual({
        filename: 'src/feature.js',
        status: 'added',
        additions: 30,
        deletions: 0,
        changes: 30,
        lines: 30,
        patch: '',
        sha: 'ghi789',
        blob_url: 'https://github.com/test-owner/test-repo/blob/ghi789/src/feature.js',
        raw_url: 'https://raw.githubusercontent.com/test-owner/test-repo/ghi789/src/feature.js',
        previous_filename: null
      });

      // Test deleted file
      expect(files[1]).toEqual({
        filename: 'src/legacy.js',
        status: 'deleted',
        additions: 0,
        deletions: 15,
        changes: 15,
        lines: 15,
        patch: '',
        sha: 'jkl012',
        blob_url: 'https://github.com/test-owner/test-repo/blob/jkl012/src/legacy.js',
        raw_url: 'https://raw.githubusercontent.com/test-owner/test-repo/jkl012/src/legacy.js',
        previous_filename: null
      });

      // Test renamed file
      expect(files[2]).toEqual({
        filename: 'src/renamed.js',
        status: 'renamed',
        additions: 20,
        deletions: 20,
        changes: 40,
        lines: 40,
        patch: '',
        sha: 'mno345',
        blob_url: 'https://github.com/test-owner/test-repo/blob/mno345/src/renamed.js',
        raw_url: 'https://raw.githubusercontent.com/test-owner/test-repo/mno345/src/renamed.js',
        previous_filename: 'src/old-name.js'
      });
    });

    test('should handle pull request with no files', async () => {
      const mockPRResponse = {
        data: []
      };

      mockOctokit.rest.pulls.listFiles.mockResolvedValue(mockPRResponse);

      const files = await githubClient.getPullRequestFiles(123);

      expect(files).toHaveLength(0);
    });

    test('should handle PR response without data property', async () => {
      const mockPRResponse = {};

      mockOctokit.rest.pulls.listFiles.mockResolvedValue(mockPRResponse);

      const files = await githubClient.getPullRequestFiles(123);

      expect(files).toHaveLength(0);
    });

    test('should handle null PR response', async () => {
      const mockPRResponse = {
        data: null
      };

      mockOctokit.rest.pulls.listFiles.mockResolvedValue(mockPRResponse);

      const files = await githubClient.getPullRequestFiles(123);

      expect(files).toHaveLength(0);
    });

    test('should handle files with missing optional properties', async () => {
      const mockPRResponse = {
        data: [
          {
            filename: 'src/minimal.js',
            status: 'modified'
            // Missing additions, deletions, changes, sha, etc.
          }
        ]
      };

      mockOctokit.rest.pulls.listFiles.mockResolvedValue(mockPRResponse);

      const files = await githubClient.getPullRequestFiles(123);

      expect(files).toHaveLength(1);
      expect(files[0]).toEqual({
        filename: 'src/minimal.js',
        status: 'modified',
        additions: 0,
        deletions: 0,
        changes: 0,
        lines: 0,
        patch: '',
        sha: '',
        blob_url: '',
        raw_url: '',
        previous_filename: null
      });
    });

    test('should throw error for invalid PR number', async () => {
      await expect(githubClient.getPullRequestFiles(0)).rejects.toThrow('Invalid pull request number provided');
      await expect(githubClient.getPullRequestFiles(-1)).rejects.toThrow('Invalid pull request number provided');
      await expect(githubClient.getPullRequestFiles('abc')).rejects.toThrow('Invalid pull request number provided');
      await expect(githubClient.getPullRequestFiles(null)).rejects.toThrow('Invalid pull request number provided');
      await expect(githubClient.getPullRequestFiles(undefined)).rejects.toThrow('Invalid pull request number provided');
    });

    test('should handle GitHub API errors gracefully', async () => {
      const apiError = new Error('GitHub API Error');
      apiError.status = 404;
      apiError.response = {
        data: {
          message: 'Pull request not found'
        }
      };

      mockOctokit.rest.pulls.listFiles.mockRejectedValue(apiError);

      const files = await githubClient.getPullRequestFiles(123);

      expect(files).toHaveLength(0);
    });

    test('should handle network errors gracefully', async () => {
      const networkError = new Error('Network Error');
      mockOctokit.rest.pulls.listFiles.mockRejectedValue(networkError);

      const files = await githubClient.getPullRequestFiles(123);

      expect(files).toHaveLength(0);
    });
  });

  describe('Utility methods', () => {
    beforeEach(() => {
      process.env.GITHUB_TOKEN = 'test-token';
      githubClient = new GitHubClient();
    });

    afterEach(() => {
      delete process.env.GITHUB_TOKEN;
    });

    test('should get highest severity correctly', () => {
      expect(githubClient.getHighestSeverity({ high: 1, medium: 0, low: 0 })).toBe('HIGH');
      expect(githubClient.getHighestSeverity({ high: 0, medium: 1, low: 0 })).toBe('MEDIUM');
      expect(githubClient.getHighestSeverity({ high: 0, medium: 0, low: 1 })).toBe('LOW');
      expect(githubClient.getHighestSeverity({ high: 0, medium: 0, low: 0 })).toBe('NONE');
    });

    test('should get review status correctly', () => {
      expect(githubClient.getReviewStatus({ high: 1, medium: 0, low: 0 })).toBe('❌ Failed');
      expect(githubClient.getReviewStatus({ high: 0, medium: 1, low: 0 })).toBe('⚠️ Warning');
      expect(githubClient.getReviewStatus({ high: 0, medium: 0, low: 1 })).toBe('✅ Passed with suggestions');
      expect(githubClient.getReviewStatus({ high: 0, medium: 0, low: 0 })).toBe('✅ Passed');
    });

    test('should get severity emoji correctly', () => {
      expect(githubClient.getSeverityEmoji('HIGH')).toBe('🔴');
      expect(githubClient.getSeverityEmoji('MEDIUM')).toBe('🟡');
      expect(githubClient.getSeverityEmoji('LOW')).toBe('🟢');
      expect(githubClient.getSeverityEmoji('NONE')).toBe('✅');
      expect(githubClient.getSeverityEmoji('UNKNOWN')).toBe('❓');
    });

    test('should get severity badge correctly', () => {
      expect(githubClient.getSeverityBadge('HIGH')).toContain('Severity-HIGH-red');
      expect(githubClient.getSeverityBadge('MEDIUM')).toContain('Severity-MEDIUM-yellow');
      expect(githubClient.getSeverityBadge('LOW')).toContain('Severity-LOW-green');
      expect(githubClient.getSeverityBadge('NONE')).toContain('Severity-NONE-lightgrey');
    });

    test('should get category badge correctly', () => {
      expect(githubClient.getCategoryBadge('security')).toContain('Category-Security-red');
      expect(githubClient.getCategoryBadge('logic')).toContain('Category-Logic-orange');
      expect(githubClient.getCategoryBadge('performance')).toContain('Category-Performance-blue');
      expect(githubClient.getCategoryBadge('standards')).toContain('Category-Standards-yellow');
      expect(githubClient.getCategoryBadge('maintainability')).toContain('Category-Maintainability-green');
      expect(githubClient.getCategoryBadge('unknown')).toContain('Category-Other-lightgrey');
    });
  });

  describe('Logging', () => {
    test('should log info messages when enabled', () => {
      const client = new GitHubClient({ 
        token: 'test-token',
        enableLogging: true, 
        logLevel: 'INFO' 
      });
      
      client.logInfo('Test message');
      
      expect(mockCore.info).toHaveBeenCalledWith('[GitHub Client] Test message');
    });

    test('should not log info messages when disabled', () => {
      const client = new GitHubClient({ 
        token: 'test-token',
        enableLogging: false 
      });
      
      client.logInfo('Test message');
      
      expect(mockCore.info).not.toHaveBeenCalled();
    });

    test('should log warning messages', () => {
      const client = new GitHubClient({ 
        token: 'test-token',
        enableLogging: true 
      });
      
      client.logWarning('Test warning');
      
      expect(mockCore.warning).toHaveBeenCalledWith('[GitHub Client] Test warning');
    });

    test('should log error messages', () => {
      const client = new GitHubClient({ 
        token: 'test-token',
        enableLogging: true 
      });
      
      client.logError('Test error');
      
      expect(mockCore.error).toHaveBeenCalledWith('[GitHub Client] Test error');
    });
  });
});
