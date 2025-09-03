/**
 * Email Trigger Manager
 * 
 * Manages configurable email notification triggers based on various
 * events and conditions in the AI code review system.
 * 
 * @author AI Code Review System
 * @version 1.0.0
 * @last_updated 2024-12-19
 */

const EventEmitter = require('events');

class EmailTriggerManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = config;
    
    // Trigger configuration
    this.triggerConfig = {
      enabled: config.email_triggers?.enabled ?? true,
      triggers: config.email_triggers?.triggers ?? this.getDefaultTriggers(),
      conditions: config.email_triggers?.conditions ?? this.getDefaultConditions(),
      throttling: config.email_triggers?.throttling ?? this.getDefaultThrottling(),
      scheduling: config.email_triggers?.scheduling ?? this.getDefaultScheduling()
    };
    
    // Trigger state
    this.triggerHistory = new Map();
    this.triggerCounts = new Map();
    this.lastTriggerTime = new Map();
    this.scheduledTriggers = new Map();
    
    // Initialize triggers
    this.initializeTriggers();
    
    // Bind methods
    this.checkTrigger = this.checkTrigger.bind(this);
    this.executeTrigger = this.executeTrigger.bind(this);
    this.scheduleTrigger = this.scheduleTrigger.bind(this);
    this.cancelScheduledTrigger = this.cancelScheduledTrigger.bind(this);
  }

  /**
   * Initialize email triggers
   */
  initializeTriggers() {
    console.log('📧 Initializing email triggers...');
    
    // Set up event listeners for various system events
    this.setupEventListeners();
    
    // Initialize trigger counters
    for (const triggerName of Object.keys(this.triggerConfig.triggers)) {
      this.triggerCounts.set(triggerName, 0);
      this.lastTriggerTime.set(triggerName, 0);
    }
    
    console.log('✅ Email triggers initialized successfully');
  }

  /**
   * Set up event listeners for system events
   */
  setupEventListeners() {
    // Code review events
    this.on('review_started', (data) => this.handleReviewEvent('review_started', data));
    this.on('review_completed', (data) => this.handleReviewEvent('review_completed', data));
    this.on('review_failed', (data) => this.handleReviewEvent('review_failed', data));
    this.on('review_passed', (data) => this.handleReviewEvent('review_passed', data));
    
    // Issue events
    this.on('issue_created', (data) => this.handleIssueEvent('issue_created', data));
    this.on('issue_updated', (data) => this.handleIssueEvent('issue_updated', data));
    this.on('issue_closed', (data) => this.handleIssueEvent('issue_closed', data));
    this.on('issue_escalated', (data) => this.handleIssueEvent('issue_escalated', data));
    
    // Security events
    this.on('security_issue_detected', (data) => this.handleSecurityEvent('security_issue_detected', data));
    this.on('vulnerability_found', (data) => this.handleSecurityEvent('vulnerability_found', data));
    
    // System events
    this.on('system_error', (data) => this.handleSystemEvent('system_error', data));
    this.on('performance_degradation', (data) => this.handleSystemEvent('performance_degradation', data));
    
    // Quality events
    this.on('quality_threshold_exceeded', (data) => this.handleQualityEvent('quality_threshold_exceeded', data));
    this.on('code_complexity_high', (data) => this.handleQualityEvent('code_complexity_high', data));
  }

  /**
   * Handle review events
   */
  handleReviewEvent(eventType, data) {
    const triggers = this.getTriggersForEvent(eventType);
    
    for (const trigger of triggers) {
      if (this.shouldExecuteTrigger(trigger, data)) {
        this.executeTrigger(trigger, data);
      }
    }
  }

  /**
   * Handle issue events
   */
  handleIssueEvent(eventType, data) {
    const triggers = this.getTriggersForEvent(eventType);
    
    for (const trigger of triggers) {
      if (this.shouldExecuteTrigger(trigger, data)) {
        this.executeTrigger(trigger, data);
      }
    }
  }

  /**
   * Handle security events
   */
  handleSecurityEvent(eventType, data) {
    const triggers = this.getTriggersForEvent(eventType);
    
    for (const trigger of triggers) {
      if (this.shouldExecuteTrigger(trigger, data)) {
        this.executeTrigger(trigger, data);
      }
    }
  }

  /**
   * Handle system events
   */
  handleSystemEvent(eventType, data) {
    const triggers = this.getTriggersForEvent(eventType);
    
    for (const trigger of triggers) {
      if (this.shouldExecuteTrigger(trigger, data)) {
        this.executeTrigger(trigger, data);
      }
    }
  }

  /**
   * Handle quality events
   */
  handleQualityEvent(eventType, data) {
    const triggers = this.getTriggersForEvent(eventType);
    
    for (const trigger of triggers) {
      if (this.shouldExecuteTrigger(trigger, data)) {
        this.executeTrigger(trigger, data);
      }
    }
  }

  /**
   * Get triggers for a specific event type
   */
  getTriggersForEvent(eventType) {
    const triggers = [];
    
    for (const [triggerName, trigger] of Object.entries(this.triggerConfig.triggers)) {
      if (trigger.enabled && trigger.events.includes(eventType)) {
        triggers.push({ name: triggerName, ...trigger });
      }
    }
    
    return triggers;
  }

  /**
   * Check if a trigger should be executed
   */
  shouldExecuteTrigger(trigger, data) {
    // Check if trigger is enabled
    if (!trigger.enabled) return false;
    
    // Check throttling
    if (!this.checkThrottling(trigger)) return false;
    
    // Check conditions
    if (!this.checkConditions(trigger.conditions, data)) return false;
    
    // Check scheduling
    if (!this.checkScheduling(trigger)) return false;
    
    return true;
  }

  /**
   * Check throttling for a trigger
   */
  checkThrottling(trigger) {
    const throttling = this.triggerConfig.throttling[trigger.name] || this.triggerConfig.throttling.default;
    const now = Date.now();
    const lastTime = this.lastTriggerTime.get(trigger.name) || 0;
    
    // Check minimum interval
    if (now - lastTime < throttling.min_interval_ms) {
      return false;
    }
    
    // Check maximum frequency
    const count = this.triggerCounts.get(trigger.name) || 0;
    if (count >= throttling.max_per_hour) {
      const hourAgo = now - (60 * 60 * 1000);
      if (lastTime > hourAgo) {
        return false;
      }
      // Reset counter if hour has passed
      this.triggerCounts.set(trigger.name, 0);
    }
    
    return true;
  }

  /**
   * Check conditions for a trigger
   */
  checkConditions(conditions, data) {
    if (!conditions || Object.keys(conditions).length === 0) {
      return true;
    }
    
    for (const [conditionType, condition] of Object.entries(conditions)) {
      if (!this.evaluateCondition(conditionType, condition, data)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Evaluate a single condition
   */
  evaluateCondition(conditionType, condition, data) {
    switch (conditionType) {
      case 'priority':
        return this.evaluatePriorityCondition(condition, data);
      case 'severity':
        return this.evaluateSeverityCondition(condition, data);
      case 'file_count':
        return this.evaluateFileCountCondition(condition, data);
      case 'issue_count':
        return this.evaluateIssueCountCondition(condition, data);
      case 'score_threshold':
        return this.evaluateScoreThresholdCondition(condition, data);
      case 'time_based':
        return this.evaluateTimeBasedCondition(condition, data);
      case 'user_based':
        return this.evaluateUserBasedCondition(condition, data);
      case 'repository_based':
        return this.evaluateRepositoryBasedCondition(condition, data);
      case 'custom':
        return this.evaluateCustomCondition(condition, data);
      default:
        console.warn(`⚠️  Unknown condition type: ${conditionType}`);
        return true;
    }
  }

  /**
   * Evaluate priority condition
   */
  evaluatePriorityCondition(condition, data) {
    const priority = data.priority || data.severity || 'medium';
    const priorityLevels = { critical: 4, high: 3, medium: 2, low: 1 };
    
    const dataPriority = priorityLevels[priority] || 2;
    const requiredPriority = priorityLevels[condition.minimum] || 2;
    
    return dataPriority >= requiredPriority;
  }

  /**
   * Evaluate severity condition
   */
  evaluateSeverityCondition(condition, data) {
    const severity = data.severity || data.priority || 'medium';
    const severityLevels = { critical: 4, high: 3, medium: 2, low: 1 };
    
    const dataSeverity = severityLevels[severity] || 2;
    const requiredSeverity = severityLevels[condition.minimum] || 2;
    
    return dataSeverity >= requiredSeverity;
  }

  /**
   * Evaluate file count condition
   */
  evaluateFileCountCondition(condition, data) {
    const fileCount = data.files_reviewed || data.file_count || 0;
    
    if (condition.min && fileCount < condition.min) return false;
    if (condition.max && fileCount > condition.max) return false;
    
    return true;
  }

  /**
   * Evaluate issue count condition
   */
  evaluateIssueCountCondition(condition, data) {
    const issueCount = data.issues_found || data.issue_count || 0;
    
    if (condition.min && issueCount < condition.min) return false;
    if (condition.max && issueCount > condition.max) return false;
    
    return true;
  }

  /**
   * Evaluate score threshold condition
   */
  evaluateScoreThresholdCondition(condition, data) {
    const score = data.review_score || data.score || 100;
    
    if (condition.min && score < condition.min) return false;
    if (condition.max && score > condition.max) return false;
    
    return true;
  }

  /**
   * Evaluate time-based condition
   */
  evaluateTimeBasedCondition(condition, data) {
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();
    
    // Check business hours
    if (condition.business_hours_only) {
      if (currentHour < 9 || currentHour > 17) return false;
      if (currentDay === 0 || currentDay === 6) return false; // Weekend
    }
    
    // Check specific time windows
    if (condition.time_windows) {
      const inTimeWindow = condition.time_windows.some(window => {
        const start = window.start || 0;
        const end = window.end || 24;
        return currentHour >= start && currentHour < end;
      });
      
      if (!inTimeWindow) return false;
    }
    
    return true;
  }

  /**
   * Evaluate user-based condition
   */
  evaluateUserBasedCondition(condition, data) {
    const user = data.user || data.created_by || data.updated_by;
    
    if (!user) return true;
    
    // Check user roles
    if (condition.roles && condition.roles.length > 0) {
      const userRole = data.user_role || 'user';
      if (!condition.roles.includes(userRole)) return false;
    }
    
    // Check user groups
    if (condition.groups && condition.groups.length > 0) {
      const userGroups = data.user_groups || [];
      const hasMatchingGroup = condition.groups.some(group => userGroups.includes(group));
      if (!hasMatchingGroup) return false;
    }
    
    return true;
  }

  /**
   * Evaluate repository-based condition
   */
  evaluateRepositoryBasedCondition(condition, data) {
    const repository = data.repository || data.repo;
    
    if (!repository) return true;
    
    // Check repository names
    if (condition.repositories && condition.repositories.length > 0) {
      if (!condition.repositories.includes(repository)) return false;
    }
    
    // Check repository patterns
    if (condition.repository_patterns && condition.repository_patterns.length > 0) {
      const matchesPattern = condition.repository_patterns.some(pattern => {
        const regex = new RegExp(pattern);
        return regex.test(repository);
      });
      
      if (!matchesPattern) return false;
    }
    
    return true;
  }

  /**
   * Evaluate custom condition
   */
  evaluateCustomCondition(condition, data) {
    try {
      if (typeof condition.evaluator === 'function') {
        return condition.evaluator(data);
      }
      
      if (typeof condition.expression === 'string') {
        // Simple expression evaluation (be careful with eval in production)
        const safeEval = new Function('data', `return ${condition.expression}`);
        return safeEval(data);
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error evaluating custom condition:', error.message);
      return false;
    }
  }

  /**
   * Check scheduling for a trigger
   */
  checkScheduling(trigger) {
    const scheduling = this.triggerConfig.scheduling[trigger.name] || this.triggerConfig.scheduling.default;
    
    if (!scheduling.enabled) return true;
    
    const now = new Date();
    
    // Check if trigger is scheduled for later
    if (scheduling.delay_ms) {
      return false; // Will be handled by scheduleTrigger
    }
    
    // Check specific time windows
    if (scheduling.time_windows) {
      const currentHour = now.getHours();
      const inTimeWindow = scheduling.time_windows.some(window => {
        const start = window.start || 0;
        const end = window.end || 24;
        return currentHour >= start && currentHour < end;
      });
      
      if (!inTimeWindow) return false;
    }
    
    return true;
  }

  /**
   * Execute a trigger
   */
  async executeTrigger(trigger, data) {
    try {
      console.log(`📧 Executing email trigger: ${trigger.name}`);
      
      // Update trigger state
      this.triggerCounts.set(trigger.name, (this.triggerCounts.get(trigger.name) || 0) + 1);
      this.lastTriggerTime.set(trigger.name, Date.now());
      
      // Record trigger execution
      this.recordTriggerExecution(trigger, data);
      
      // Emit trigger executed event
      this.emit('trigger_executed', { trigger, data, timestamp: new Date() });
      
      // Send email notification
      await this.sendEmailNotification(trigger, data);
      
      console.log(`✅ Email trigger executed successfully: ${trigger.name}`);
      
    } catch (error) {
      console.error(`❌ Error executing email trigger ${trigger.name}:`, error.message);
      this.emit('trigger_error', { trigger, data, error });
    }
  }

  /**
   * Schedule a trigger for later execution
   */
  scheduleTrigger(trigger, data, delayMs) {
    const triggerId = `${trigger.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const timeoutId = setTimeout(() => {
      this.executeTrigger(trigger, data);
      this.scheduledTriggers.delete(triggerId);
    }, delayMs);
    
    this.scheduledTriggers.set(triggerId, {
      trigger,
      data,
      timeoutId,
      scheduledAt: new Date(),
      executeAt: new Date(Date.now() + delayMs)
    });
    
    console.log(`⏰ Scheduled email trigger: ${trigger.name} for ${new Date(Date.now() + delayMs).toLocaleString()}`);
    
    return triggerId;
  }

  /**
   * Cancel a scheduled trigger
   */
  cancelScheduledTrigger(triggerId) {
    const scheduled = this.scheduledTriggers.get(triggerId);
    
    if (scheduled) {
      clearTimeout(scheduled.timeoutId);
      this.scheduledTriggers.delete(triggerId);
      console.log(`❌ Cancelled scheduled email trigger: ${scheduled.trigger.name}`);
      return true;
    }
    
    return false;
  }

  /**
   * Record trigger execution
   */
  recordTriggerExecution(trigger, data) {
    const execution = {
      trigger_name: trigger.name,
      timestamp: new Date().toISOString(),
      data_summary: this.summarizeData(data),
      conditions_met: this.getConditionsSummary(trigger.conditions, data)
    };
    
    this.triggerHistory.set(`${trigger.name}_${Date.now()}`, execution);
    
    // Keep only last 1000 executions per trigger
    const triggerExecutions = Array.from(this.triggerHistory.entries())
      .filter(([key, value]) => value.trigger_name === trigger.name)
      .sort((a, b) => new Date(b[1].timestamp) - new Date(a[1].timestamp))
      .slice(0, 1000);
    
    // Remove old executions
    for (const [key, value] of this.triggerHistory.entries()) {
      if (value.trigger_name === trigger.name && !triggerExecutions.find(([k, v]) => k === key)) {
        this.triggerHistory.delete(key);
      }
    }
  }

  /**
   * Summarize data for logging
   */
  summarizeData(data) {
    return {
      event_type: data.event_type || 'unknown',
      priority: data.priority || 'medium',
      severity: data.severity || 'medium',
      files_reviewed: data.files_reviewed || 0,
      issues_found: data.issues_found || 0,
      review_score: data.review_score || 100,
      user: data.user || data.created_by || 'unknown',
      repository: data.repository || 'unknown'
    };
  }

  /**
   * Get conditions summary
   */
  getConditionsSummary(conditions, data) {
    if (!conditions) return { all_met: true };
    
    const summary = {};
    let allMet = true;
    
    for (const [conditionType, condition] of Object.entries(conditions)) {
      const met = this.evaluateCondition(conditionType, condition, data);
      summary[conditionType] = { met, condition };
      if (!met) allMet = false;
    }
    
    summary.all_met = allMet;
    return summary;
  }

  /**
   * Send email notification
   */
  async sendEmailNotification(trigger, data) {
    // This would integrate with the EmailNotifier class
    // For now, emit an event that can be handled by other systems
    
    this.emit('email_notification_ready', {
      trigger,
      data,
      template: trigger.template || 'notification',
      recipients: trigger.recipients || [],
      subject: this.generateEmailSubject(trigger, data),
      timestamp: new Date()
    });
  }

  /**
   * Generate email subject
   */
  generateEmailSubject(trigger, data) {
    if (trigger.subject_template) {
      return this.interpolateTemplate(trigger.subject_template, data);
    }
    
    const eventType = data.event_type || 'notification';
    const priority = data.priority || 'medium';
    
    return `[${priority.toUpperCase()}] ${eventType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`;
  }

  /**
   * Interpolate template with data
   */
  interpolateTemplate(template, data) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] || match;
    });
  }

  /**
   * Get trigger statistics
   */
  getTriggerStats() {
    const stats = {
      total_triggers: Object.keys(this.triggerConfig.triggers).length,
      enabled_triggers: Object.values(this.triggerConfig.triggers).filter(t => t.enabled).length,
      trigger_counts: Object.fromEntries(this.triggerCounts),
      scheduled_triggers: this.scheduledTriggers.size,
      recent_executions: this.getRecentExecutions(10)
    };
    
    return stats;
  }

  /**
   * Get recent trigger executions
   */
  getRecentExecutions(limit = 10) {
    const executions = Array.from(this.triggerHistory.values())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
    
    return executions;
  }

  // Default configuration methods
  getDefaultTriggers() {
    return {
      review_failed: {
        enabled: true,
        events: ['review_failed'],
        template: 'review_failed',
        recipients: ['team', 'assignees'],
        conditions: {
          priority: { minimum: 'medium' },
          issue_count: { min: 1 }
        }
      },
      review_passed: {
        enabled: false, // Usually don't notify for passed reviews
        events: ['review_passed'],
        template: 'review_passed',
        recipients: ['assignees'],
        conditions: {
          score_threshold: { min: 90 }
        }
      },
      security_issue: {
        enabled: true,
        events: ['security_issue_detected', 'vulnerability_found'],
        template: 'security_issue',
        recipients: ['security_team', 'assignees'],
        conditions: {
          severity: { minimum: 'high' }
        }
      },
      issue_escalated: {
        enabled: true,
        events: ['issue_escalated'],
        template: 'issue_escalated',
        recipients: ['managers', 'assignees'],
        conditions: {
          priority: { minimum: 'high' }
        }
      },
      quality_threshold: {
        enabled: true,
        events: ['quality_threshold_exceeded', 'code_complexity_high'],
        template: 'quality_alert',
        recipients: ['team_lead', 'assignees'],
        conditions: {
          score_threshold: { max: 70 }
        }
      }
    };
  }

  getDefaultConditions() {
    return {
      priority: {
        levels: ['critical', 'high', 'medium', 'low'],
        default: 'medium'
      },
      severity: {
        levels: ['critical', 'high', 'medium', 'low'],
        default: 'medium'
      },
      file_count: {
        min: 1,
        max: 1000
      },
      issue_count: {
        min: 0,
        max: 100
      },
      score_threshold: {
        min: 0,
        max: 100
      }
    };
  }

  getDefaultThrottling() {
    return {
      default: {
        min_interval_ms: 60000, // 1 minute
        max_per_hour: 10
      },
      security_issue: {
        min_interval_ms: 0, // No throttling for security issues
        max_per_hour: 100
      },
      review_failed: {
        min_interval_ms: 300000, // 5 minutes
        max_per_hour: 20
      }
    };
  }

  getDefaultScheduling() {
    return {
      default: {
        enabled: false,
        time_windows: [
          { start: 9, end: 17 } // Business hours
        ]
      },
      review_failed: {
        enabled: true,
        time_windows: [
          { start: 9, end: 17 } // Business hours only
        ]
      }
    };
  }
}

module.exports = EmailTriggerManager;


