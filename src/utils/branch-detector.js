/**
 * Branch Detection Utility
 * Identifies source and target branches for AI code review
 */

const core = require('@actions/core');
const github = require('@actions/github');

class BranchDetector {
  constructor(context) {
    // Add null checks and fallbacks for context
    this.context = context || {};
    
    // Ensure context has required properties with fallbacks
    if (!this.context.eventName) {
      this.context.eventName = process.env.GITHUB_EVENT_NAME || 'unknown';
    }
    if (!this.context.payload) {
      this.context.payload = {};
    }
    if (!this.context.repo) {
      this.context.repo = {
        owner: process.env.GITHUB_REPOSITORY_OWNER || 'unknown',
        repo: process.env.GITHUB_REPOSITORY?.split('/')[1] || 'unknown'
      };
    }
    if (!this.context.sha) {
      this.context.sha = process.env.GITHUB_SHA || 'unknown';
    }
    if (!this.context.actor) {
      this.context.actor = process.env.GITHUB_ACTOR || 'unknown';
    }
    
    this.eventName = this.context.eventName;
    this.payload = this.context.payload;
    
    // Log context initialization for debugging
    core.info(`🔧 BranchDetector initialized:`);
    core.info(`   Event Name: ${this.eventName}`);
    core.info(`   Repository: ${this.context.repo?.owner || 'unknown'}/${this.context.repo?.repo || 'unknown'}`);
    core.info(`   SHA: ${this.context.sha || 'unknown'}`);
    core.info(`   Actor: ${this.context.actor || 'unknown'}`);
  }

  /**
   * Detect source and target branches based on GitHub event
   * @returns {Object} Object containing source and target branch information
   */
  detectBranches() {
    try {
      // Add additional safety check
      if (!this.eventName || this.eventName === 'unknown') {
        core.warning('⚠️ Event name not available, defaulting to push event');
        this.eventName = 'push';
      }
      
      switch (this.eventName) {
        case 'push':
          return this.detectPushBranches();
        case 'pull_request':
          return this.detectPullRequestBranches();
        case 'workflow_dispatch':
          return this.detectManualBranches();
        default:
          core.warning(`⚠️ Unsupported event type: ${this.eventName}, defaulting to push`);
          return this.detectPushBranches();
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
    // Add safety checks for context properties
    if (!this.context.ref) {
      core.warning('⚠️ Context ref not available, using default branch');
      const targetBranch = 'main';
      return {
        sourceBranch: 'unknown',
        targetBranch: targetBranch,
        sourceCommit: 'unknown',
        targetCommit: this.context.sha || 'unknown',
        eventType: 'push',
        isDirectPush: true,
        isMerge: false,
        branchType: this.getBranchType(targetBranch)
      };
    }
    
    const targetBranch = this.context.ref ? this.context.ref.replace('refs/heads/', '') : 'main';
    const sourceBranch = this.payload.before || 'unknown'; // Previous commit SHA
    const currentCommit = this.payload.after || this.context.sha || 'unknown'; // Current commit SHA

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
    const currentCommit = this.context.sha || 'unknown';

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
      repository: this.context.repo || {},
      workflow: this.context.workflow || 'unknown',
      runId: this.context.runId || 'unknown',
      actor: this.context.actor || 'unknown',
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = BranchDetector;



