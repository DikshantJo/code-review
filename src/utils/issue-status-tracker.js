/**
 * Issue Status Tracker
 * 
 * Comprehensive tracking system for monitoring GitHub issue lifecycle,
 * status changes, workflow transitions, and performance metrics.
 * 
 * @author AI Code Review System
 * @version 1.0.0
 * @last_updated 2024-12-19
 */

const { Octokit } = require('@octokit/rest');
const EventEmitter = require('events');

class IssueStatusTracker extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = config;
    this.octokit = new Octokit({
      auth: config.github?.token || process.env.GITHUB_TOKEN,
      baseUrl: config.github?.api_url || 'https://api.github.com'
    });
    
    this.repository = config.github?.repository || process.env.GITHUB_REPOSITORY;
    
    // Status tracking configuration
    this.trackingConfig = {
      enabled: config.issue_tracking?.enabled ?? true,
      auto_track: config.issue_tracking?.auto_track ?? true,
      track_workflow: config.issue_tracking?.workflow_tracking ?? true,
      track_performance: config.issue_tracking?.performance_tracking ?? true,
      track_metrics: config.issue_tracking?.metrics_tracking ?? true,
      update_interval_ms: config.issue_tracking?.update_interval_ms ?? 300000, // 5 minutes
      max_history_days: config.issue_tracking?.max_history_days ?? 90,
      alert_thresholds: config.issue_tracking?.alert_thresholds ?? {
        stale_issues_days: 7,
        blocked_issues_hours: 24,
        high_priority_response_hours: 4,
        critical_response_hours: 1
      }
    };
    
    // Status tracking data
    this.issueStatuses = new Map();
    this.workflowHistory = new Map();
    this.performanceMetrics = new Map();
    this.statusTransitions = new Map();
    this.alerts = [];
    
    // Workflow definitions
    this.workflows = this.defineWorkflows();
    
    // Tracking state
    this.isTracking = false;
    this.trackingInterval = null;
    this.lastUpdate = null;
    
    // Bind methods
    this.startTracking = this.startTracking.bind(this);
    this.stopTracking = this.stopTracking.bind(this);
    this.updateIssueStatus = this.updateIssueStatus.bind(this);
    
    // Auto-start tracking if enabled
    if (this.trackingConfig.auto_track) {
      this.startTracking();
    }
  }

  /**
   * Start automatic issue status tracking
   */
  async startTracking() {
    if (this.isTracking) {
      console.log('⚠️  Issue status tracking is already running');
      return;
    }
    
    console.log('🚀 Starting issue status tracking...');
    this.isTracking = true;
    
    // Initial status scan
    await this.scanAllIssues();
    
    // Set up periodic updates
    this.trackingInterval = setInterval(async () => {
      try {
        await this.updateAllStatuses();
      } catch (error) {
        console.error('❌ Error during status update cycle:', error.message);
        this.emit('tracking_error', error);
      }
    }, this.trackingConfig.update_interval_ms);
    
    this.emit('tracking_started');
    console.log('✅ Issue status tracking started successfully');
  }

  /**
   * Stop automatic issue status tracking
   */
  stopTracking() {
    if (!this.isTracking) {
      console.log('⚠️  Issue status tracking is not running');
      return;
    }
    
    console.log('🛑 Stopping issue status tracking...');
    this.isTracking = false;
    
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }
    
    this.emit('tracking_stopped');
    console.log('✅ Issue status tracking stopped');
  }

  /**
   * Scan all issues in the repository
   */
  async scanAllIssues() {
    try {
      console.log('🔍 Scanning all repository issues...');
      
      const [owner, repo] = this.repository.split('/');
      let page = 1;
      let allIssues = [];
      
      while (true) {
        const response = await this.octokit.issues.listForRepo({
          owner,
          repo,
          state: 'all',
          per_page: 100,
          page: page
        });
        
        if (response.data.length === 0) break;
        
        allIssues = allIssues.concat(response.data);
        page++;
        
        // Rate limiting
        await this.delay(1000);
      }
      
      console.log(`📊 Found ${allIssues.length} issues to track`);
      
      // Initialize tracking for each issue
      for (const issue of allIssues) {
        await this.initializeIssueTracking(issue);
      }
      
      this.lastUpdate = new Date();
      this.emit('scan_completed', { total_issues: allIssues.length });
      
    } catch (error) {
      console.error('❌ Error scanning issues:', error.message);
      this.emit('scan_error', error);
      throw error;
    }
  }

  /**
   * Initialize tracking for a specific issue
   */
  async initializeIssueTracking(issue) {
    const issueId = issue.number;
    
    // Create initial status record
    const statusRecord = {
      issue_number: issueId,
      title: issue.title,
      state: issue.state,
      status: this.determineIssueStatus(issue),
      workflow_stage: this.determineWorkflowStage(issue),
      priority: this.determinePriority(issue),
      assignees: issue.assignees?.map(a => a.login) || [],
      labels: issue.labels?.map(l => l.name) || [],
      milestone: issue.milestone?.title || null,
      created_at: issue.created_at,
      updated_at: issue.updated_at,
      closed_at: issue.closed_at,
      last_tracked: new Date().toISOString(),
      tracking_history: [],
      performance_metrics: this.initializePerformanceMetrics(),
      workflow_transitions: []
    };
    
    // Add to tracking maps
    this.issueStatuses.set(issueId, statusRecord);
    this.workflowHistory.set(issueId, []);
    this.performanceMetrics.set(issueId, statusRecord.performance_metrics);
    this.statusTransitions.set(issueId, []);
    
    // Record initial status
    this.recordStatusTransition(issueId, 'initialized', statusRecord.status);
    
    return statusRecord;
  }

  /**
   * Update status for all tracked issues
   */
  async updateAllStatuses() {
    if (!this.isTracking) return;
    
    console.log('🔄 Updating status for all tracked issues...');
    const updatePromises = [];
    
    for (const [issueId, statusRecord] of this.issueStatuses) {
      updatePromises.push(this.updateIssueStatus(issueId));
    }
    
    try {
      const results = await Promise.allSettled(updatePromises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      console.log(`✅ Status update completed: ${successful} successful, ${failed} failed`);
      
      // Check for alerts
      await this.checkAlertConditions();
      
      this.lastUpdate = new Date();
      this.emit('status_update_completed', { successful, failed, total: this.issueStatuses.size });
      
    } catch (error) {
      console.error('❌ Error during status update:', error.message);
      this.emit('status_update_error', error);
    }
  }

  /**
   * Update status for a specific issue
   */
  async updateIssueStatus(issueId) {
    try {
      // Get current issue from GitHub
      const currentIssue = await this.getIssue(issueId);
      if (!currentIssue) {
        console.warn(`⚠️  Issue #${issueId} not found, removing from tracking`);
        this.removeIssueTracking(issueId);
        return;
      }
      
      const currentStatus = this.issueStatuses.get(issueId);
      if (!currentStatus) {
        console.warn(`⚠️  Issue #${issueId} not in tracking, initializing`);
        await this.initializeIssueTracking(currentIssue);
        return;
      }
      
      // Determine new status
      const newStatus = this.determineIssueStatus(currentIssue);
      const newWorkflowStage = this.determineWorkflowStage(currentIssue);
      const newPriority = this.determinePriority(currentIssue);
      
      // Check for changes
      const hasStatusChanged = currentStatus.status !== newStatus;
      const hasWorkflowChanged = currentStatus.workflow_stage !== newWorkflowStage;
      const hasPriorityChanged = currentStatus.priority !== newPriority;
      const hasStateChanged = currentStatus.state !== currentIssue.state;
      
      if (hasStatusChanged || hasWorkflowChanged || hasPriorityChanged || hasStateChanged) {
        // Update status record
        const updatedStatus = {
          ...currentStatus,
          status: newStatus,
          workflow_stage: newWorkflowStage,
          priority: newPriority,
          state: currentIssue.state,
          assignees: currentIssue.assignees?.map(a => a.login) || [],
          labels: currentIssue.labels?.map(l => l.name) || [],
          milestone: currentIssue.milestone?.title || null,
          updated_at: currentIssue.updated_at,
          closed_at: currentIssue.closed_at,
          last_tracked: new Date().toISOString()
        };
        
        // Record transitions
        if (hasStatusChanged) {
          this.recordStatusTransition(issueId, currentStatus.status, newStatus);
        }
        
        if (hasWorkflowChanged) {
          this.recordWorkflowTransition(issueId, currentStatus.workflow_stage, newWorkflowStage);
        }
        
        if (hasPriorityChanged) {
          this.recordPriorityChange(issueId, currentStatus.priority, newPriority);
        }
        
        // Update tracking data
        this.issueStatuses.set(issueId, updatedStatus);
        
        // Update performance metrics
        this.updatePerformanceMetrics(issueId, updatedStatus);
        
        // Emit change events
        this.emit('issue_status_changed', {
          issue_id: issueId,
          old_status: currentStatus,
          new_status: updatedStatus,
          changes: {
            status: hasStatusChanged,
            workflow: hasWorkflowChanged,
            priority: hasPriorityChanged,
            state: hasStateChanged
          }
        });
        
        console.log(`🔄 Issue #${issueId} status updated: ${currentStatus.status} → ${newStatus}`);
      }
      
    } catch (error) {
      console.error(`❌ Error updating issue #${issueId}:`, error.message);
      this.emit('issue_update_error', { issue_id: issueId, error });
    }
  }

  /**
   * Determine issue status based on current state and context
   */
  determineIssueStatus(issue) {
    if (issue.state === 'closed') {
      return 'resolved';
    }
    
    // Check labels for status indicators
    const labels = issue.labels?.map(l => l.name.toLowerCase()) || [];
    
    if (labels.includes('blocked')) return 'blocked';
    if (labels.includes('in-progress')) return 'in_progress';
    if (labels.includes('pending')) return 'pending';
    if (labels.includes('review')) return 'under_review';
    if (labels.includes('testing')) return 'testing';
    if (labels.includes('ready')) return 'ready';
    
    // Check assignees
    if (issue.assignees && issue.assignees.length > 0) {
      return 'assigned';
    }
    
    // Check if stale
    const daysSinceUpdate = this.getDaysSinceUpdate(issue.updated_at);
    if (daysSinceUpdate > this.trackingConfig.alert_thresholds.stale_issues_days) {
      return 'stale';
    }
    
    return 'open';
  }

  /**
   * Determine workflow stage
   */
  determineWorkflowStage(issue) {
    const status = this.determineIssueStatus(issue);
    const labels = issue.labels?.map(l => l.name.toLowerCase()) || [];
    
    // Map status to workflow stage
    const stageMap = {
      'open': 'backlog',
      'assigned': 'assigned',
      'in_progress': 'development',
      'under_review': 'review',
      'testing': 'testing',
      'ready': 'ready_for_deployment',
      'blocked': 'blocked',
      'pending': 'waiting',
      'resolved': 'completed',
      'stale': 'needs_attention'
    };
    
    return stageMap[status] || 'unknown';
  }

  /**
   * Determine issue priority
   */
  determinePriority(issue) {
    const labels = issue.labels?.map(l => l.name.toLowerCase()) || [];
    
    if (labels.includes('critical') || labels.includes('p0')) return 'critical';
    if (labels.includes('high') || labels.includes('p1')) return 'high';
    if (labels.includes('medium') || labels.includes('p2')) return 'medium';
    if (labels.includes('low') || labels.includes('p3')) return 'low';
    
    // Default priority based on issue type
    if (issue.title.toLowerCase().includes('bug') || issue.title.toLowerCase().includes('fix')) {
      return 'medium';
    }
    
    return 'medium';
  }

  /**
   * Record status transition
   */
  recordStatusTransition(issueId, fromStatus, toStatus) {
    const transition = {
      timestamp: new Date().toISOString(),
      from: fromStatus,
      to: toStatus,
      duration: this.calculateTransitionDuration(issueId, fromStatus)
    };
    
    if (!this.statusTransitions.has(issueId)) {
      this.statusTransitions.set(issueId, []);
    }
    
    this.statusTransitions.get(issueId).push(transition);
    
    // Keep only last 50 transitions
    const transitions = this.statusTransitions.get(issueId);
    if (transitions.length > 50) {
      transitions.splice(0, transitions.length - 50);
    }
    
    this.emit('status_transition', { issue_id: issueId, transition });
  }

  /**
   * Record workflow transition
   */
  recordWorkflowTransition(issueId, fromStage, toStage) {
    const transition = {
      timestamp: new Date().toISOString(),
      from: fromStage,
      to: toStage,
      duration: this.calculateTransitionDuration(issueId, fromStage)
    };
    
    if (!this.workflowHistory.has(issueId)) {
      this.workflowHistory.set(issueId, []);
    }
    
    this.workflowHistory.get(issueId).push(transition);
    
    // Keep only last 50 workflow transitions
    const workflowTransitions = this.workflowHistory.get(issueId);
    if (workflowTransitions.length > 50) {
      workflowTransitions.splice(0, workflowTransitions.length - 50);
    }
    
    this.emit('workflow_transition', { issue_id: issueId, transition });
  }

  /**
   * Record priority change
   */
  recordPriorityChange(issueId, fromPriority, toPriority) {
    const change = {
      timestamp: new Date().toISOString(),
      from: fromPriority,
      to: toPriority
    };
    
    this.emit('priority_change', { issue_id: issueId, change });
  }

  /**
   * Initialize performance metrics
   */
  initializePerformanceMetrics() {
    return {
      time_in_stages: {
        backlog: 0,
        assigned: 0,
        development: 0,
        review: 0,
        testing: 0,
        ready_for_deployment: 0,
        blocked: 0,
        waiting: 0
      },
      total_lifetime: 0,
      resolution_time: 0,
      response_time: 0,
      review_cycles: 0,
      reassignments: 0,
      label_changes: 0,
      comment_count: 0,
      last_activity: new Date().toISOString()
    };
  }

  /**
   * Update performance metrics
   */
  updatePerformanceMetrics(issueId, statusRecord) {
    const metrics = this.performanceMetrics.get(issueId);
    if (!metrics) return;
    
    // Update time in current stage
    const currentStage = statusRecord.workflow_stage;
    if (metrics.time_in_stages[currentStage] !== undefined) {
      metrics.time_in_stages[currentStage]++;
    }
    
    // Update total lifetime
    const created = new Date(statusRecord.created_at);
    const now = new Date();
    metrics.total_lifetime = Math.floor((now - created) / (1000 * 60 * 60 * 24)); // days
    
    // Update resolution time if closed
    if (statusRecord.state === 'closed' && statusRecord.closed_at) {
      const closed = new Date(statusRecord.closed_at);
      metrics.resolution_time = Math.floor((closed - created) / (1000 * 60 * 60 * 24)); // days
    }
    
    // Update last activity
    metrics.last_activity = statusRecord.last_tracked;
    
    this.performanceMetrics.set(issueId, metrics);
  }

  /**
   * Check alert conditions
   */
  async checkAlertConditions() {
    const alerts = [];
    
    for (const [issueId, statusRecord] of this.issueStatuses) {
      // Check for stale issues
      if (statusRecord.status === 'stale') {
        alerts.push({
          type: 'stale_issue',
          issue_id: issueId,
          priority: 'medium',
          message: `Issue #${issueId} has been stale for ${this.getDaysSinceUpdate(statusRecord.last_tracked)} days`,
          timestamp: new Date().toISOString()
        });
      }
      
      // Check for blocked issues
      if (statusRecord.status === 'blocked') {
        const hoursBlocked = this.getHoursSinceUpdate(statusRecord.last_tracked);
        if (hoursBlocked > this.trackingConfig.alert_thresholds.blocked_issues_hours) {
          alerts.push({
            type: 'blocked_issue',
            issue_id: issueId,
            priority: 'high',
            message: `Issue #${issueId} has been blocked for ${hoursBlocked} hours`,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      // Check for high priority response times
      if (statusRecord.priority === 'high' || statusRecord.priority === 'critical') {
        const hoursSinceUpdate = this.getHoursSinceUpdate(statusRecord.last_tracked);
        const threshold = statusRecord.priority === 'critical' 
          ? this.trackingConfig.alert_thresholds.critical_response_hours
          : this.trackingConfig.alert_thresholds.high_priority_response_hours;
        
        if (hoursSinceUpdate > threshold) {
          alerts.push({
            type: 'response_time_exceeded',
            issue_id: issueId,
            priority: statusRecord.priority === 'critical' ? 'critical' : 'high',
            message: `High priority issue #${issueId} has exceeded response time threshold (${threshold}h)`,
            timestamp: new Date().toISOString()
          });
        }
      }
    }
    
    // Update alerts
    this.alerts = alerts;
    
    // Emit alerts
    if (alerts.length > 0) {
      this.emit('alerts_generated', alerts);
      console.log(`🚨 Generated ${alerts.length} alerts`);
    }
  }

  /**
   * Get issue status summary
   */
  getIssueStatusSummary(issueId) {
    const statusRecord = this.issueStatuses.get(issueId);
    if (!statusRecord) return null;
    
    const workflowHistory = this.workflowHistory.get(issueId) || [];
    const performanceMetrics = this.performanceMetrics.get(issueId);
    const statusTransitions = this.statusTransitions.get(issueId) || [];
    
    return {
      ...statusRecord,
      workflow_history: workflowHistory,
      performance_metrics: performanceMetrics,
      status_transitions: statusTransitions,
      current_stage_duration: this.getCurrentStageDuration(issueId),
      estimated_completion: this.estimateCompletion(issueId)
    };
  }

  /**
   * Get overall tracking statistics
   */
  getTrackingStats() {
    const stats = {
      total_issues: this.issueStatuses.size,
      status_distribution: {},
      workflow_distribution: {},
      priority_distribution: {},
      performance_averages: {
        avg_resolution_time: 0,
        avg_time_in_stages: {},
        avg_response_time: 0
      },
      alerts: {
        total: this.alerts.length,
        by_type: {},
        by_priority: {}
      },
      last_update: this.lastUpdate,
      tracking_active: this.isTracking
    };
    
    // Calculate distributions
    for (const statusRecord of this.issueStatuses.values()) {
      // Status distribution
      stats.status_distribution[statusRecord.status] = (stats.status_distribution[statusRecord.status] || 0) + 1;
      
      // Workflow distribution
      stats.workflow_distribution[statusRecord.workflow_stage] = (stats.workflow_distribution[statusRecord.workflow_stage] || 0) + 1;
      
      // Priority distribution
      stats.priority_distribution[statusRecord.priority] = (stats.priority_distribution[statusRecord.priority] || 0) + 1;
    }
    
    // Calculate performance averages
    let totalResolutionTime = 0;
    let resolvedCount = 0;
    let totalResponseTime = 0;
    let responseCount = 0;
    
    for (const metrics of this.performanceMetrics.values()) {
      if (metrics.resolution_time > 0) {
        totalResolutionTime += metrics.resolution_time;
        resolvedCount++;
      }
      
      if (metrics.response_time > 0) {
        totalResponseTime += metrics.response_time;
        responseCount++;
      }
    }
    
    if (resolvedCount > 0) {
      stats.performance_averages.avg_resolution_time = totalResolutionTime / resolvedCount;
    }
    
    if (responseCount > 0) {
      stats.performance_averages.avg_response_time = totalResponseTime / responseCount;
    }
    
    // Calculate alert statistics
    for (const alert of this.alerts) {
      stats.alerts.by_type[alert.type] = (stats.alerts.by_type[alert.type] || 0) + 1;
      stats.alerts.by_priority[alert.priority] = (stats.alerts.by_priority[alert.priority] || 0) + 1;
    }
    
    return stats;
  }

  /**
   * Export tracking data
   */
  exportTrackingData(format = 'json') {
    const data = {
      metadata: {
        exported_at: new Date().toISOString(),
        total_issues: this.issueStatuses.size,
        tracking_config: this.trackingConfig
      },
      issue_statuses: Array.from(this.issueStatuses.values()),
      workflow_history: Array.from(this.workflowHistory.entries()),
      performance_metrics: Array.from(this.performanceMetrics.entries()),
      status_transitions: Array.from(this.statusTransitions.entries()),
      alerts: this.alerts,
      statistics: this.getTrackingStats()
    };
    
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'csv':
        return this.convertToCSV(data);
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  /**
   * Convert data to CSV format
   */
  convertToCSV(data) {
    const csvRows = [];
    
    // Add metadata
    csvRows.push(['Metadata', 'Value']);
    csvRows.push(['Exported At', data.metadata.exported_at]);
    csvRows.push(['Total Issues', data.metadata.total_issues]);
    
    // Add issue statuses
    csvRows.push([]);
    csvRows.push(['Issue Statuses']);
    csvRows.push(['Issue Number', 'Title', 'Status', 'Workflow Stage', 'Priority', 'State', 'Last Tracked']);
    
    for (const status of data.issue_statuses) {
      csvRows.push([
        status.issue_number,
        status.title,
        status.status,
        status.workflow_stage,
        status.priority,
        status.state,
        status.last_tracked
      ]);
    }
    
    return csvRows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  }

  /**
   * Remove issue from tracking
   */
  removeIssueTracking(issueId) {
    this.issueStatuses.delete(issueId);
    this.workflowHistory.delete(issueId);
    this.performanceMetrics.delete(issueId);
    this.statusTransitions.delete(issueId);
    
    this.emit('issue_removed_from_tracking', { issue_id: issueId });
  }

  /**
   * Clear all tracking data
   */
  clearTrackingData() {
    this.issueStatuses.clear();
    this.workflowHistory.clear();
    this.performanceMetrics.clear();
    this.statusTransitions.clear();
    this.alerts = [];
    
    this.emit('tracking_data_cleared');
  }

  // Helper methods

  /**
   * Get issue from GitHub
   */
  async getIssue(issueNumber) {
    try {
      const [owner, repo] = this.repository.split('/');
      const response = await this.octokit.issues.get({
        owner,
        repo,
        issue_number: issueNumber
      });
      return response.data;
    } catch (error) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Define workflow stages
   */
  defineWorkflows() {
    return {
      default: [
        'backlog',
        'assigned',
        'development',
        'review',
        'testing',
        'ready_for_deployment',
        'completed'
      ],
      bug_fix: [
        'backlog',
        'assigned',
        'development',
        'testing',
        'review',
        'ready_for_deployment',
        'completed'
      ],
      feature: [
        'backlog',
        'planning',
        'assigned',
        'development',
        'review',
        'testing',
        'ready_for_deployment',
        'completed'
      ]
    };
  }

  /**
   * Calculate transition duration
   */
  calculateTransitionDuration(issueId, fromStatus) {
    const transitions = this.statusTransitions.get(issueId) || [];
    if (transitions.length < 2) return 0;
    
    const lastTransition = transitions[transitions.length - 2];
    const currentTransition = transitions[transitionsitions.length - 1];
    
    if (lastTransition.to === fromStatus) {
      const from = new Date(lastTransition.timestamp);
      const to = new Date(currentTransition.timestamp);
      return Math.floor((to - from) / (1000 * 60 * 60 * 24)); // days
    }
    
    return 0;
  }

  /**
   * Get days since update
   */
  getDaysSinceUpdate(timestamp) {
    const updateTime = new Date(timestamp);
    const now = new Date();
    return Math.floor((now - updateTime) / (1000 * 60 * 60 * 24));
  }

  /**
   * Get hours since update
   */
  getHoursSinceUpdate(timestamp) {
    const updateTime = new Date(timestamp);
    const now = new Date();
    return Math.floor((now - updateTime) / (1000 * 60 * 60));
  }

  /**
   * Get current stage duration
   */
  getCurrentStageDuration(issueId) {
    const transitions = this.workflowHistory.get(issueId) || [];
    if (transitions.length === 0) return 0;
    
    const lastTransition = transitions[transitions.length - 1];
    const from = new Date(lastTransition.timestamp);
    const now = new Date();
    return Math.floor((now - from) / (1000 * 60 * 60 * 24)); // days
  }

  /**
   * Estimate completion time
   */
  estimateCompletion(issueId) {
    const metrics = this.performanceMetrics.get(issueId);
    if (!metrics) return null;
    
    const currentStage = this.issueStatuses.get(issueId)?.workflow_stage;
    if (!currentStage) return null;
    
    const avgTimeInStage = metrics.time_in_stages[currentStage] || 1;
    const remainingStages = this.getRemainingStages(currentStage);
    
    return {
      estimated_days: avgTimeInStage * remainingStages,
      confidence: this.calculateConfidence(issueId),
      factors: this.getCompletionFactors(issueId)
    };
  }

  /**
   * Get remaining workflow stages
   */
  getRemainingStages(currentStage) {
    const workflow = this.workflows.default;
    const currentIndex = workflow.indexOf(currentStage);
    
    if (currentIndex === -1) return 0;
    
    return workflow.length - currentIndex - 1;
  }

  /**
   * Calculate completion confidence
   */
  calculateConfidence(issueId) {
    const metrics = this.performanceMetrics.get(issueId);
    if (!metrics) return 0;
    
    // Simple confidence calculation based on data quality
    let confidence = 0;
    
    if (metrics.total_lifetime > 0) confidence += 20;
    if (metrics.resolution_time > 0) confidence += 30;
    if (metrics.time_in_stages.development > 0) confidence += 25;
    if (metrics.time_in_stages.review > 0) confidence += 25;
    
    return Math.min(confidence, 100);
  }

  /**
   * Get completion factors
   */
  getCompletionFactors(issueId) {
    const statusRecord = this.issueStatuses.get(issueId);
    if (!statusRecord) return [];
    
    const factors = [];
    
    if (statusRecord.assignees.length === 0) {
      factors.push('No assignee');
    }
    
    if (statusRecord.labels.includes('blocked')) {
      factors.push('Blocked');
    }
    
    if (statusRecord.status === 'stale') {
      factors.push('Stale issue');
    }
    
    if (statusRecord.priority === 'critical') {
      factors.push('High priority');
    }
    
    return factors;
  }

  /**
   * Delay execution
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = IssueStatusTracker;


