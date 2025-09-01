/**
 * Branch Detection Utility
 * Identifies source and target branches for AI code review
 */

const core = require('@actions/core');
const github = require('@actions/github');

class BranchDetector {
  constructor(context) {
    this.context = context;
    this.eventName = context.eventName;
    this.payload = context.payload;
  }

  /**
   * Detect source and target branches based on GitHub event
   * @returns {Object} Object containing source and target branch information
   */
  detectBranches() {
    try {
      switch (this.eventName) {
        case 'push':
          return this.detectPushBranches();
        case 'pull_request':
          return this.detectPullRequestBranches();
        case 'workflow_dispatch':
          return this.detectManualBranches();
        default:
          throw new Error(`Unsupported event type: ${this.eventName}`);
      }
    } catch (error) {
      core.setFailed(`Branch detection failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Detect branches for push events
   * @returns {Object} Source and target branch info
   */
  detectPushBranches() {
    const targetBranch = this.context.ref.replace('refs/heads/', '');
    const sourceBranch = this.payload.before; // Previous commit SHA
    const currentCommit = this.payload.after; // Current commit SHA

    return {
      sourceBranch: sourceBranch,
      targetBranch: targetBranch,
      sourceCommit: sourceBranch,
      targetCommit: currentCommit,
      eventType: 'push',
      isDirectPush: true,
      isMerge: false,
      branchType: this.getBranchType(targetBranch)
    };
  }

  /**
   * Detect branches for pull request events
   * @returns {Object} Source and target branch info
   */
  detectPullRequestBranches() {
    const pr = this.payload.pull_request;
    
    if (!pr) {
      throw new Error('Pull request data not available');
    }

    const sourceBranch = pr.head.ref;
    const targetBranch = pr.base.ref;
    const sourceCommit = pr.head.sha;
    const targetCommit = pr.base.sha;
    const isMerged = pr.merged === true;

    return {
      sourceBranch: sourceBranch,
      targetBranch: targetBranch,
      sourceCommit: sourceCommit,
      targetCommit: targetCommit,
      eventType: 'pull_request',
      isDirectPush: false,
      isMerge: isMerged,
      branchType: this.getBranchType(targetBranch),
      pullRequestNumber: pr.number,
      pullRequestTitle: pr.title,
      pullRequestAuthor: pr.user.login
    };
  }

  /**
   * Detect branches for manual workflow dispatch
   * @returns {Object} Source and target branch info
   */
  detectManualBranches() {
    const targetBranch = this.payload.inputs?.target_branch || 'dev';
    const currentCommit = this.context.sha;

    return {
      sourceBranch: null,
      targetBranch: targetBranch,
      sourceCommit: null,
      targetCommit: currentCommit,
      eventType: 'workflow_dispatch',
      isDirectPush: false,
      isMerge: false,
      branchType: this.getBranchType(targetBranch),
      manualTrigger: true
    };
  }

  /**
   * Determine the type of branch (dev, uat, production, etc.)
   * @param {string} branchName - Name of the branch
   * @returns {string} Branch type
   */
  getBranchType(branchName) {
    const branch = branchName.toLowerCase();
    
    if (branch === 'dev' || branch === 'development') {
      return 'development';
    } else if (branch === 'uat' || branch === 'staging') {
      return 'staging';
    } else if (branch === 'main' || branch === 'master' || branch === 'production') {
      return 'production';
    } else if (branch.includes('feature/') || branch.includes('bugfix/') || branch.includes('hotfix/')) {
      return 'feature';
    } else {
      return 'other';
    }
  }

  /**
   * Check if the branch movement is valid for AI review
   * @param {Object} branchInfo - Branch information object
   * @returns {boolean} Whether the branch movement should trigger review
   */
  isValidBranchMovement(branchInfo) {
    const { targetBranch, eventType, isMerge } = branchInfo;
    
    // Only review on merges to target branches or direct pushes to protected branches
    if (eventType === 'pull_request' && !isMerge) {
      return false; // Don't review on PR open/update, only on merge
    }

    // Define target branches that should trigger reviews
    const targetBranches = ['dev', 'uat', 'staging', 'main', 'master', 'production'];
    
    return targetBranches.includes(targetBranch.toLowerCase());
  }

  /**
   * Get environment-specific configuration based on target branch
   * @param {string} targetBranch - Target branch name
   * @returns {Object} Environment configuration
   */
  getEnvironmentConfig(targetBranch) {
    const branchType = this.getBranchType(targetBranch);
    
    const configs = {
      development: {
        severityThreshold: 'LOW',
        enableProductionGates: false,
        maxFiles: 100,
        timeout: 300
      },
      staging: {
        severityThreshold: 'MEDIUM',
        enableProductionGates: false,
        maxFiles: 50,
        timeout: 300
      },
      production: {
        severityThreshold: 'HIGH',
        enableProductionGates: true,
        maxFiles: 25,
        timeout: 600
      },
      feature: {
        severityThreshold: 'LOW',
        enableProductionGates: false,
        maxFiles: 50,
        timeout: 300
      },
      other: {
        severityThreshold: 'MEDIUM',
        enableProductionGates: false,
        maxFiles: 50,
        timeout: 300
      }
    };

    return configs[branchType] || configs.other;
  }

  /**
   * Validate branch detection results
   * @param {Object} branchInfo - Branch information object
   * @returns {boolean} Whether the branch info is valid
   */
  validateBranchInfo(branchInfo) {
    const required = ['targetBranch', 'eventType', 'branchType'];
    
    for (const field of required) {
      if (!branchInfo[field]) {
        core.warning(`Missing required field: ${field}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Get detailed branch information for logging
   * @param {Object} branchInfo - Branch information object
   * @returns {Object} Detailed branch information
   */
  getDetailedInfo(branchInfo) {
    return {
      ...branchInfo,
      repository: this.context.repo,
      workflow: this.context.workflow,
      runId: this.context.runId,
      actor: this.context.actor,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = BranchDetector;



