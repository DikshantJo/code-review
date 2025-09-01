/**
 * Branch Detection Utility
 * Identifies source and target branches for AI code review
 */

const core = require('@actions/core');
const github = require('@actions/github');

class BranchDetector {
  constructor(context) {
    core.info('🔧 Starting BranchDetector constructor...');
    
    try {
      core.info('🔍 Checking context parameter...');
      core.info(`   context exists: ${!!context}`);
      core.info(`   context type: ${typeof context}`);
      core.info(`   context value: ${JSON.stringify(context, null, 2)}`);
      
      // Add null checks and fallbacks for context
      this.context = context || {};
      core.info('🔧 Initializing BranchDetector context...');
      
      // Ensure context has required properties with fallbacks
      core.info('🔍 Accessing eventName...');
      if (!this.context.eventName) {
        core.info('   eventName is undefined/null, setting from env...');
        this.context.eventName = process.env.GITHUB_EVENT_NAME || 'unknown';
        core.info(`   Event Name: ${this.context.eventName || 'unknown'} (from env)`);
      } else {
        core.info(`   Event Name: ${this.context.eventName || 'unknown'}`);
      }
      
      core.info('🔍 Accessing payload...');
      if (!this.context.payload) {
        core.info('   payload is undefined/null, setting empty object...');
        this.context.payload = {};
        core.info('   Payload: {} (empty)');
      } else {
        core.info('   Payload: available');
      }
      
      core.info('🔍 Accessing repo...');
      if (!this.context.repo) {
        core.info('   repo is undefined/null, setting from env...');
        this.context.repo = {
          owner: process.env.GITHUB_REPOSITORY_OWNER || 'unknown',
          repo: process.env.GITHUB_REPOSITORY?.split('/')[1] || 'unknown'
        };
        core.info(`   Repository: ${this.context.repo?.owner || 'unknown'}/${this.context.repo?.repo || 'unknown'} (from env)`);
      } else {
        core.info(`   Repository: ${this.context.repo?.owner || 'unknown'}/${this.context.repo?.repo || 'unknown'}`);
      }
      
      core.info('🔍 Accessing sha...');
      if (!this.context.sha) {
        core.info('   sha is undefined/null, setting from env...');
        this.context.sha = process.env.GITHUB_SHA || 'unknown';
        core.info(`   SHA: ${this.context.sha || 'unknown'} (from env)`);
      } else {
        core.info(`   SHA: ${this.context.sha || 'unknown'}`);
      }
      
      core.info('🔍 Accessing actor...');
      if (!this.context.actor) {
        core.info('   actor is undefined/null, setting from env...');
        this.context.actor = process.env.GITHUB_ACTOR || 'unknown';
        core.info(`   Actor: ${this.context.actor || 'unknown'} (from env)`);
      } else {
        core.info(`   Actor: ${this.context.actor || 'unknown'}`);
      }
      
      // Set instance properties with fallbacks
      core.info('🔍 Setting instance properties...');
      this.eventName = this.context.eventName || 'unknown';
      this.payload = this.context.payload || {};
      
      // Log context initialization for debugging
      core.info(`🔧 BranchDetector initialized:`);
      core.info(`   Event Name: ${this.eventName || 'unknown'}`);
      core.info(`   Repository: ${this.context.repo?.owner || 'unknown'}/${this.context.repo?.repo || 'unknown'}`);
      core.info(`   SHA: ${this.context.sha || 'unknown'}`);
      core.info(`   Actor: ${this.context.actor || 'unknown'}`);
      
      core.info('✅ BranchDetector constructor completed successfully');
      
    } catch (error) {
      core.error(`💥 BranchDetector Constructor Error: ${error.message}`);
      core.error(`📍 Constructor Error Stack: ${error.stack}`);
      core.error(`📍 Constructor Error File: ${error.fileName || 'unknown'}`);
      core.error(`📍 Constructor Error Line: ${error.lineNumber || 'unknown'}`);
      throw error;
    }
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
    
    core.info(`🔍 Checking branch movement validity:`);
    core.info(`   Target Branch: ${targetBranch}`);
    core.info(`   Event Type: ${eventType}`);
    core.info(`   Is Merge: ${isMerge}`);
    
    // Define target branches that should trigger reviews
    const targetBranches = ['dev', 'uat', 'staging', 'main', 'master', 'production'];
    const isValidTarget = targetBranches.includes(targetBranch.toLowerCase());
    
    core.info(`   Is Valid Target: ${isValidTarget}`);
    
    // Allow reviews on:
    // 1. Direct pushes to target branches (main, dev, staging, etc.)
    // 2. Pull request merges to target branches
    // 3. Any push to main/master/production
    
    if (eventType === 'push' && isValidTarget) {
      core.info(`✅ Valid: Direct push to target branch '${targetBranch}'`);
      return true;
    }
    
    if (eventType === 'pull_request' && isValidTarget) {
      core.info(`✅ Valid: PR to target branch '${targetBranch}'`);
      return true;
    }
    
    if (eventType === 'workflow_dispatch') {
      core.info(`✅ Valid: Manual workflow dispatch`);
      return true;
    }
    
    core.info(`❌ Invalid: Event type '${eventType}' to branch '${targetBranch}'`);
    return false;
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



