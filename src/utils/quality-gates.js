/**
 * Quality Gates Utility
 * Handles production quality gates and blocking mechanisms for high-severity issues
 */

const core = require('@actions/core');

class QualityGates {
  constructor(options = {}) {
    this.options = {
      // Quality gate settings
      enabled: options.enabled !== false,
      severityThreshold: options.severityThreshold || 'HIGH',
      blockProduction: options.blockProduction !== false,
      
      // Override settings
      allowUrgentOverride: options.allowUrgentOverride !== false,
      urgentKeyword: options.urgentKeyword || 'URGENT',
      maxOverridesPerDay: options.maxOverridesPerDay || 3,
      
      // Logging
      enableLogging: options.enableLogging !== false,
      logLevel: options.logLevel || 'INFO',
      
      // Override tracking
      overrideTracking: options.overrideTracking || new Map()
    };

    // Audit logger reference (will be set during initialization)
    this.auditLogger = null;

    // Validate configuration
    this.validateConfig();
  }

  /**
   * Set audit logger reference
   * @param {Object} auditLogger - Audit logger instance
   */
  setAuditLogger(auditLogger) {
    this.auditLogger = auditLogger;
  }

  /**
   * Validate quality gate configuration
   */
  validateConfig() {
    const validSeverities = ['LOW', 'MEDIUM', 'HIGH'];
    
    if (!validSeverities.includes(this.options.severityThreshold)) {
      throw new Error(`Invalid severity threshold: ${this.options.severityThreshold}. Must be one of: ${validSeverities.join(', ')}`);
    }

    if (this.options.maxOverridesPerDay < 0) {
      throw new Error('maxOverridesPerDay must be a non-negative number');
    }
  }

  /**
   * Evaluate quality gate for a review with comprehensive logging
   * @param {Object} reviewData - Review data from AI
   * @param {Object} config - Configuration settings
   * @param {Object} context - Additional context for logging
   * @returns {Object} Quality gate result
   */
  async evaluateQualityGate(reviewData, config, context = {}) {
    const startTime = Date.now();
    const sessionId = context.sessionId || `qg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Log quality gate evaluation start
      await this.logQualityGateStart(sessionId, reviewData, config, context);

      if (!this.options.enabled) {
        const result = {
          passed: true,
          blocked: false,
          reason: 'Quality gates disabled',
          overrideUsed: false,
          severityThreshold: this.options.severityThreshold,
          evaluationTime: Date.now() - startTime
        };
        
        await this.logQualityGateDecision(sessionId, result, context);
        return result;
      }

      const { severity_breakdown, commit_message, commit_author, target_branch } = reviewData;
      const environment = config.current_environment || 'unknown';
      
      // Check if this is a production environment
      const isProduction = this.isProductionEnvironment(target_branch, environment);
      
      if (!isProduction || !this.options.blockProduction) {
        const result = {
          passed: true,
          blocked: false,
          reason: 'Not a production environment or blocking disabled',
          overrideUsed: false,
          severityThreshold: this.options.severityThreshold,
          environment,
          targetBranch: target_branch,
          isProduction,
          evaluationTime: Date.now() - startTime
        };
        
        await this.logQualityGateDecision(sessionId, result, context);
        return result;
      }

      // Check for urgent override
      const overrideInfo = await this.checkUrgentOverride(commit_message, commit_author, config, context);
      
      if (overrideInfo.overrideUsed) {
        const result = {
          passed: true,
          blocked: false,
          reason: 'URGENT override applied',
          overrideUsed: true,
          overrideInfo,
          severityThreshold: this.options.severityThreshold,
          environment,
          targetBranch: target_branch,
          evaluationTime: Date.now() - startTime
        };
        
        await this.logQualityGateDecision(sessionId, result, context);
        await this.logOverrideAttempt(sessionId, overrideInfo, context);
        return result;
      }

      // Evaluate severity against threshold
      const evaluation = this.evaluateSeverity(severity_breakdown, config);
      
      if (evaluation.blocked) {
        const result = {
          passed: false,
          blocked: true,
          reason: evaluation.reason,
          overrideUsed: false,
          severityThreshold: this.options.severityThreshold,
          highestSeverity: evaluation.highestSeverity,
          issuesFound: evaluation.issuesFound,
          severityBreakdown: severity_breakdown,
          environment,
          targetBranch: target_branch,
          evaluationTime: Date.now() - startTime
        };
        
        await this.logQualityGateDecision(sessionId, result, context);
        return result;
      }

      const result = {
        passed: true,
        blocked: false,
        reason: 'Quality gate passed',
        overrideUsed: false,
        severityThreshold: this.options.severityThreshold,
        highestSeverity: evaluation.highestSeverity,
        severityBreakdown: severity_breakdown,
        environment,
        targetBranch: target_branch,
        evaluationTime: Date.now() - startTime
      };
      
      await this.logQualityGateDecision(sessionId, result, context);
      return result;

    } catch (error) {
      const errorResult = {
        passed: false,
        blocked: true,
        reason: `Quality gate evaluation failed: ${error.message}`,
        error: error.message,
        evaluationTime: Date.now() - startTime
      };
      
      await this.logQualityGateError(sessionId, error, context);
      return errorResult;
    }
  }

  /**
   * Log quality gate evaluation start
   * @param {string} sessionId - Session ID
   * @param {Object} reviewData - Review data
   * @param {Object} config - Configuration
   * @param {Object} context - Context
   */
  async logQualityGateStart(sessionId, reviewData, config, context) {
    if (!this.auditLogger) return;
    
    try {
      await this.auditLogger.logInfo('quality_gate_start', {
        session_id: sessionId,
        environment: config.current_environment || 'unknown',
        target_branch: reviewData.target_branch,
        severity_threshold: this.options.severityThreshold,
        block_production: this.options.blockProduction,
        allow_override: this.options.allowUrgentOverride,
        max_overrides_per_day: this.options.maxOverridesPerDay
      }, context);
    } catch (error) {
      core.warning(`Failed to log quality gate start: ${error.message}`);
    }
  }

  /**
   * Log quality gate decision
   * @param {string} sessionId - Session ID
   * @param {Object} result - Quality gate result
   * @param {Object} context - Context
   */
  async logQualityGateDecision(sessionId, result, context) {
    if (!this.auditLogger) return;
    
    try {
      const decisionData = {
        session_id: sessionId,
        approved: result.passed,
        reason: result.reason,
        override_used: result.overrideUsed || false,
        override_reason: result.overrideInfo?.reason || null,
        severity_threshold: result.severityThreshold,
        highest_severity: result.highestSeverity,
        issues_found: result.issuesFound,
        environment: result.environment,
        target_branch: result.targetBranch,
        evaluation_time_ms: result.evaluationTime,
        timestamp: new Date().toISOString()
      };

      await this.auditLogger.logQualityGateDecision(decisionData, context);
    } catch (error) {
      core.warning(`Failed to log quality gate decision: ${error.message}`);
    }
  }

  /**
   * Log override attempt
   * @param {string} sessionId - Session ID
   * @param {Object} overrideInfo - Override information
   * @param {Object} context - Context
   */
  async logOverrideAttempt(sessionId, overrideInfo, context) {
    if (!this.auditLogger) return;
    
    try {
      const overrideData = {
        session_id: sessionId,
        override_keyword: overrideInfo.keyword || 'URGENT',
        commit_message: overrideInfo.commitMessage || '',
        user_authorized: overrideInfo.authorized || false,
        reason: overrideInfo.reason || 'URGENT override applied',
        daily_count: overrideInfo.dailyCount || 0,
        max_daily_overrides: this.options.maxOverridesPerDay,
        timestamp: new Date().toISOString()
      };

      await this.auditLogger.logOverrideAttempt(overrideData, context);
    } catch (error) {
      core.warning(`Failed to log override attempt: ${error.message}`);
    }
  }

  /**
   * Log quality gate error
   * @param {string} sessionId - Session ID
   * @param {Error} error - Error object
   * @param {Object} context - Context
   */
  async logQualityGateError(sessionId, error, context) {
    if (!this.auditLogger) return;
    
    try {
      await this.auditLogger.logError('quality_gate_error', {
        session_id: sessionId,
        error_message: error.message,
        error_stack: error.stack,
        timestamp: new Date().toISOString()
      }, context);
    } catch (logError) {
      core.warning(`Failed to log quality gate error: ${logError.message}`);
    }
  }

  /**
   * Check for urgent override in commit message
   * @param {string} commitMessage - Commit message
   * @param {string} commitAuthor - Commit author
   * @param {Object} config - Configuration
   * @param {Object} context - Additional context for logging
   * @returns {Object} Override information
   */
  async checkUrgentOverride(commitMessage, commitAuthor, config, context) {
    if (!this.options.allowUrgentOverride) {
      return { overrideUsed: false, reason: 'Override disabled' };
    }

    const hasUrgentKeyword = this.hasUrgentKeyword(commitMessage);
    
    if (!hasUrgentKeyword) {
      return { overrideUsed: false, reason: 'No override keyword found' };
    }

    // Check override limits
    const overrideLimit = config.quality_gates?.max_overrides_per_day || this.options.maxOverridesPerDay;
    const today = new Date().toDateString();
    const userKey = `${commitAuthor}:${today}`;
    
    const currentOverrides = this.options.overrideTracking.get(userKey) || 0;
    
    if (currentOverrides >= overrideLimit) {
      await this.logOverrideAttempt(context.sessionId || 'unknown', {
        keyword: this.options.urgentKeyword,
        commitMessage: commitMessage,
        authorized: false,
        reason: `Override limit exceeded (${currentOverrides}/${overrideLimit})`,
        dailyCount: currentOverrides,
        maxDailyOverrides: overrideLimit
      }, context);
      
      return {
        overrideUsed: false,
        reason: `Override limit exceeded (${currentOverrides}/${overrideLimit})`,
        limitExceeded: true
      };
    }

    // Track override usage
    this.options.overrideTracking.set(userKey, currentOverrides + 1);
    
    const overrideInfo = {
      overrideUsed: true,
      keyword: this.options.urgentKeyword,
      commitMessage: commitMessage,
      authorized: true,
      reason: 'URGENT override applied',
      author: commitAuthor,
      date: today,
      overridesUsed: currentOverrides + 1,
      limit: overrideLimit,
      dailyCount: currentOverrides + 1
    };

    await this.logOverrideAttempt(context.sessionId || 'unknown', overrideInfo, context);
    return overrideInfo;
  }

  /**
   * Check if commit message contains urgent keyword
   * @param {string} commitMessage - Commit message
   * @returns {boolean} Has urgent keyword
   */
  hasUrgentKeyword(commitMessage) {
    if (!commitMessage) return false;
    
    const urgentPattern = new RegExp(`\\b${this.options.urgentKeyword}\\b`, 'i');
    return urgentPattern.test(commitMessage);
  }

  /**
   * Evaluate severity against configured threshold
   * @param {Object} severityBreakdown - Severity breakdown
   * @param {Object} config - Configuration
   * @returns {Object} Severity evaluation
   */
  evaluateSeverity(severityBreakdown, config) {
    const threshold = config.quality_gates?.severity_threshold || this.options.severityThreshold;
    const highestSeverity = this.getHighestSeverity(severityBreakdown);
    
    // Map severity levels to numeric values for comparison
    const severityLevels = {
      'LOW': 1,
      'MEDIUM': 2,
      'HIGH': 3
    };
    
    const thresholdLevel = severityLevels[threshold];
    const highestLevel = severityLevels[highestSeverity];
    
    if (highestLevel >= thresholdLevel) {
      const issuesFound = this.countIssuesAtOrAboveSeverity(severityBreakdown, threshold);
      return {
        blocked: true,
        reason: `${highestSeverity} severity issues detected (threshold: ${threshold})`,
        highestSeverity,
        issuesFound,
        threshold
      };
    }
    
    return {
      blocked: false,
      reason: `Issues below threshold (${threshold})`,
      highestSeverity,
      threshold
    };
  }

  /**
   * Get highest severity from breakdown
   * @param {Object} severityBreakdown - Severity breakdown
   * @returns {string} Highest severity
   */
  getHighestSeverity(severityBreakdown) {
    if (severityBreakdown.high > 0) return 'HIGH';
    if (severityBreakdown.medium > 0) return 'MEDIUM';
    if (severityBreakdown.low > 0) return 'LOW';
    return 'NONE';
  }

  /**
   * Count issues at or above specified severity
   * @param {Object} severityBreakdown - Severity breakdown
   * @param {string} severity - Severity threshold
   * @returns {number} Issue count
   */
  countIssuesAtOrAboveSeverity(severityBreakdown, severity) {
    const severityLevels = {
      'LOW': 1,
      'MEDIUM': 2,
      'HIGH': 3
    };
    
    const thresholdLevel = severityLevels[severity];
    let count = 0;
    
    if (thresholdLevel <= 3 && severityBreakdown.high > 0) {
      count += severityBreakdown.high;
    }
    if (thresholdLevel <= 2 && severityBreakdown.medium > 0) {
      count += severityBreakdown.medium;
    }
    if (thresholdLevel <= 1 && severityBreakdown.low > 0) {
      count += severityBreakdown.low;
    }
    
    return count;
  }

  /**
   * Check if environment is production
   * @param {string} targetBranch - Target branch name
   * @param {string} environment - Environment name
   * @returns {boolean} Is production environment
   */
  isProductionEnvironment(targetBranch, environment) {
    const productionBranches = ['main', 'master', 'production', 'prod', 'live'];
    const productionEnvironments = ['production', 'prod', 'live'];
    
    return productionBranches.includes(targetBranch.toLowerCase()) || 
           productionEnvironments.includes(environment.toLowerCase());
  }

  /**
   * Generate quality gate status message
   * @param {Object} gateResult - Quality gate result
   * @returns {string} Status message
   */
  generateStatusMessage(gateResult) {
    if (gateResult.passed) {
      if (gateResult.overrideUsed) {
        return `✅ Quality gate passed (URGENT override used)`;
      }
      return `✅ Quality gate passed`;
    } else {
      return `❌ Quality gate failed: ${gateResult.reason}`;
    }
  }

  /**
   * Get override statistics
   * @returns {Object} Override statistics
   */
  getOverrideStats() {
    const stats = {
      totalOverrides: 0,
      usersWithOverrides: new Set(),
      dailyBreakdown: {}
    };
    
    for (const [key, count] of this.options.overrideTracking) {
      const [user, date] = key.split(':');
      stats.totalOverrides += count;
      stats.usersWithOverrides.add(user);
      
      if (!stats.dailyBreakdown[date]) {
        stats.dailyBreakdown[date] = 0;
      }
      stats.dailyBreakdown[date] += count;
    }
    
    stats.usersWithOverrides = Array.from(stats.usersWithOverrides);
    
    return stats;
  }

  /**
   * Clear override tracking data
   * @param {string} olderThan - Clear data older than this date (optional)
   */
  clearOverrideTracking(olderThan = null) {
    if (!olderThan) {
      this.options.overrideTracking.clear();
      this.logInfo('Cleared all override tracking data');
      return;
    }
    
    const cutoffDate = new Date(olderThan);
    const keysToDelete = [];
    
    for (const [key] of this.options.overrideTracking) {
      const [, dateStr] = key.split(':');
      const entryDate = new Date(dateStr);
      
      if (entryDate < cutoffDate) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.options.overrideTracking.delete(key));
    this.logInfo(`Cleared ${keysToDelete.length} old override tracking entries`);
  }

  /**
   * Get quality gate configuration summary
   * @returns {Object} Configuration summary
   */
  getConfigSummary() {
    return {
      enabled: this.options.enabled,
      severityThreshold: this.options.severityThreshold,
      blockProduction: this.options.blockProduction,
      allowUrgentOverride: this.options.allowUrgentOverride,
      urgentKeyword: this.options.urgentKeyword,
      maxOverridesPerDay: this.options.maxOverridesPerDay,
      overrideTrackingSize: this.options.overrideTracking.size
    };
  }

  /**
   * Log information message
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   */
  logInfo(message, ...args) {
    if (this.options.enableLogging && this.options.logLevel === 'INFO') {
      core.info(`[Quality Gates] ${message}`, ...args);
    }
  }

  /**
   * Log warning message
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   */
  logWarning(message, ...args) {
    if (this.options.enableLogging) {
      core.warning(`[Quality Gates] ${message}`, ...args);
    }
  }

  /**
   * Log error message
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   */
  logError(message, ...args) {
    if (this.options.enableLogging) {
      core.error(`[Quality Gates] ${message}`, ...args);
    }
  }
}

module.exports = QualityGates;
