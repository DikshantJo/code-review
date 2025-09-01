/**
 * Unit tests for BranchDetector utility
 */

const BranchDetector = require('./branch-detector');

// Mock GitHub Actions core module
jest.mock('@actions/core', () => ({
  setFailed: jest.fn(),
  warning: jest.fn()
}));

// Mock GitHub Actions github module
jest.mock('@actions/github', () => ({
  context: {
    eventName: 'push',
    ref: 'refs/heads/dev',
    sha: 'abc123',
    repo: { owner: 'test-owner', repo: 'test-repo' },
    workflow: 'test-workflow',
    runId: 12345,
    actor: 'test-user'
  }
}));

describe('BranchDetector', () => {
  let branchDetector;
  let mockContext;

  beforeEach(() => {
    mockContext = {
      eventName: 'push',
      ref: 'refs/heads/dev',
      sha: 'abc123',
      repo: { owner: 'test-owner', repo: 'test-repo' },
      workflow: 'test-workflow',
      runId: 12345,
      actor: 'test-user',
      payload: {}
    };
    
    branchDetector = new BranchDetector(mockContext);
  });

  describe('detectBranches', () => {
    it('should detect push event branches correctly', () => {
      mockContext.eventName = 'push';
      mockContext.payload = {
        before: 'def456',
        after: 'abc123'
      };

      const result = branchDetector.detectBranches();

      expect(result).toEqual({
        sourceBranch: 'def456',
        targetBranch: 'dev',
        sourceCommit: 'def456',
        targetCommit: 'abc123',
        eventType: 'push',
        isDirectPush: true,
        isMerge: false,
        branchType: 'development'
      });
    });

    it('should detect pull request event branches correctly', () => {
      mockContext.eventName = 'pull_request';
      mockContext.payload = {
        pull_request: {
          head: { ref: 'feature/new-feature', sha: 'abc123' },
          base: { ref: 'dev', sha: 'def456' },
          merged: true,
          number: 123,
          title: 'Add new feature',
          user: { login: 'test-user' }
        }
      };

      const result = branchDetector.detectBranches();

      expect(result).toEqual({
        sourceBranch: 'feature/new-feature',
        targetBranch: 'dev',
        sourceCommit: 'abc123',
        targetCommit: 'def456',
        eventType: 'pull_request',
        isDirectPush: false,
        isMerge: true,
        branchType: 'development',
        pullRequestNumber: 123,
        pullRequestTitle: 'Add new feature',
        pullRequestAuthor: 'test-user'
      });
    });

    it('should detect manual workflow dispatch branches correctly', () => {
      mockContext.eventName = 'workflow_dispatch';
      mockContext.payload = {
        inputs: {
          target_branch: 'uat'
        }
      };

      const result = branchDetector.detectBranches();

      expect(result).toEqual({
        sourceBranch: null,
        targetBranch: 'uat',
        sourceCommit: null,
        targetCommit: 'abc123',
        eventType: 'workflow_dispatch',
        isDirectPush: false,
        isMerge: false,
        branchType: 'staging',
        manualTrigger: true
      });
    });

    it('should throw error for unsupported event type', () => {
      mockContext.eventName = 'unsupported_event';

      expect(() => branchDetector.detectBranches()).toThrow('Unsupported event type: unsupported_event');
    });
  });

  describe('getBranchType', () => {
    it('should identify development branches', () => {
      expect(branchDetector.getBranchType('dev')).toBe('development');
      expect(branchDetector.getBranchType('development')).toBe('development');
    });

    it('should identify staging branches', () => {
      expect(branchDetector.getBranchType('uat')).toBe('staging');
      expect(branchDetector.getBranchType('staging')).toBe('staging');
    });

    it('should identify production branches', () => {
      expect(branchDetector.getBranchType('main')).toBe('production');
      expect(branchDetector.getBranchType('master')).toBe('production');
      expect(branchDetector.getBranchType('production')).toBe('production');
    });

    it('should identify feature branches', () => {
      expect(branchDetector.getBranchType('feature/new-feature')).toBe('feature');
      expect(branchDetector.getBranchType('bugfix/fix-issue')).toBe('feature');
      expect(branchDetector.getBranchType('hotfix/critical-fix')).toBe('feature');
    });

    it('should identify other branches', () => {
      expect(branchDetector.getBranchType('random-branch')).toBe('other');
    });
  });

  describe('isValidBranchMovement', () => {
    it('should return true for valid branch movements', () => {
      const validMovements = [
        { targetBranch: 'dev', eventType: 'push', isMerge: false },
        { targetBranch: 'uat', eventType: 'pull_request', isMerge: true },
        { targetBranch: 'main', eventType: 'pull_request', isMerge: true }
      ];

      validMovements.forEach(movement => {
        expect(branchDetector.isValidBranchMovement(movement)).toBe(true);
      });
    });

    it('should return false for invalid branch movements', () => {
      const invalidMovements = [
        { targetBranch: 'feature-branch', eventType: 'push', isMerge: false },
        { targetBranch: 'dev', eventType: 'pull_request', isMerge: false },
        { targetBranch: 'random-branch', eventType: 'push', isMerge: false }
      ];

      invalidMovements.forEach(movement => {
        expect(branchDetector.isValidBranchMovement(movement)).toBe(false);
      });
    });
  });

  describe('getEnvironmentConfig', () => {
    it('should return development config for dev branches', () => {
      const config = branchDetector.getEnvironmentConfig('dev');
      
      expect(config).toEqual({
        severityThreshold: 'LOW',
        enableProductionGates: false,
        maxFiles: 100,
        timeout: 300
      });
    });

    it('should return staging config for uat branches', () => {
      const config = branchDetector.getEnvironmentConfig('uat');
      
      expect(config).toEqual({
        severityThreshold: 'MEDIUM',
        enableProductionGates: false,
        maxFiles: 50,
        timeout: 300
      });
    });

    it('should return production config for main branches', () => {
      const config = branchDetector.getEnvironmentConfig('main');
      
      expect(config).toEqual({
        severityThreshold: 'HIGH',
        enableProductionGates: true,
        maxFiles: 25,
        timeout: 600
      });
    });
  });

  describe('validateBranchInfo', () => {
    it('should return true for valid branch info', () => {
      const validInfo = {
        targetBranch: 'dev',
        eventType: 'push',
        branchType: 'development'
      };

      expect(branchDetector.validateBranchInfo(validInfo)).toBe(true);
    });

    it('should return false for invalid branch info', () => {
      const invalidInfo = {
        targetBranch: 'dev',
        eventType: 'push'
        // Missing branchType
      };

      expect(branchDetector.validateBranchInfo(invalidInfo)).toBe(false);
    });
  });

  describe('getDetailedInfo', () => {
    it('should return detailed branch information', () => {
      const branchInfo = {
        targetBranch: 'dev',
        eventType: 'push',
        branchType: 'development'
      };

      const detailedInfo = branchDetector.getDetailedInfo(branchInfo);

      expect(detailedInfo).toMatchObject({
        targetBranch: 'dev',
        eventType: 'push',
        branchType: 'development',
        repository: { owner: 'test-owner', repo: 'test-repo' },
        workflow: 'test-workflow',
        runId: 12345,
        actor: 'test-user'
      });
      expect(detailedInfo.timestamp).toBeDefined();
    });
  });
});



