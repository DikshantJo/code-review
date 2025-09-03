/**
 * Issue Resolution Workflow Manager
 * 
 * Manages structured workflows for resolving different types of GitHub issues,
 * including bug fixes, feature requests, security issues, and documentation updates.
 * 
 * @author AI Code Review System
 * @version 1.0.0
 * @last_updated 2024-12-19
 */

const { Octokit } = require('@octokit/rest');
const EventEmitter = require('events');

class IssueResolutionWorkflow extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = config;
    this.octokit = new Octokit({
      auth: config.github?.token || process.env.GITHUB_TOKEN,
      baseUrl: config.github?.api_url || 'https://api.github.com'
    });
    
    this.repository = config.github?.repository || process.env.GITHUB_REPOSITORY;
    
    // Workflow configuration
    this.workflowConfig = {
      enabled: config.issue_workflows?.enabled ?? true,
      auto_assign: config.issue_workflows?.auto_assign ?? true,
      enforce_stages: config.issue_workflows?.enforce_stages ?? true,
      require_approval: config.issue_workflows?.require_approval ?? true,
      auto_progress: config.issue_workflows?.auto_progress ?? false,
      workflow_timeouts: config.issue_workflows?.timeouts ?? {
        bug_fix: { hours: 72, action: 'escalate' },
        feature: { hours: 168, action: 'remind' },
        security: { hours: 24, action: 'escalate' },
        documentation: { hours: 120, action: 'remind' }
      }
    };
    
    // Workflow definitions
    this.workflows = this.defineWorkflows();
    
    // Active workflows
    this.activeWorkflows = new Map();
    this.workflowHistory = new Map();
    this.workflowMetrics = new Map();
    
    // Workflow state
    this.isProcessing = false;
    this.processingQueue = [];
    
    // Bind methods
    this.startWorkflow = this.startWorkflow.bind(this);
    this.progressWorkflow = this.progressWorkflow.bind(this);
    this.completeWorkflow = this.completeWorkflow.bind(this);
    this.handleWorkflowTimeout = this.handleWorkflowTimeout.bind(this);
  }

  /**
   * Define available workflow types
   */
  defineWorkflows() {
    return {
      bug_fix: {
        name: 'Bug Fix Workflow',
        description: 'Standard workflow for resolving bug reports',
        stages: [
          {
            name: 'triage',
            label: 'triage',
            description: 'Issue triaged and categorized',
            required_actions: ['categorize', 'assign_priority'],
            estimated_duration: '2h',
            auto_progress: false
          },
          {
            name: 'investigation',
            label: 'investigating',
            description: 'Root cause investigation in progress',
            required_actions: ['identify_root_cause', 'assess_impact'],
            estimated_duration: '4h',
            auto_progress: false
          },
          {
            name: 'development',
            label: 'in-progress',
            description: 'Fix development in progress',
            required_actions: ['implement_fix', 'add_tests'],
            estimated_duration: '8h',
            auto_progress: false
          },
          {
            name: 'testing',
            label: 'testing',
            description: 'Fix testing and validation',
            required_actions: ['unit_tests', 'integration_tests'],
            estimated_duration: '4h',
            auto_progress: false
          },
          {
            name: 'review',
            label: 'review',
            description: 'Code review and approval',
            required_actions: ['code_review', 'approval'],
            estimated_duration: '2h',
            auto_progress: false
          },
          {
            name: 'deployment',
            label: 'ready-for-deployment',
            description: 'Ready for deployment',
            required_actions: ['deploy', 'verify'],
            estimated_duration: '1h',
            auto_progress: false
          },
          {
            name: 'verification',
            label: 'verification',
            description: 'Post-deployment verification',
            required_actions: ['monitor', 'confirm_resolution'],
            estimated_duration: '24h',
            auto_progress: true
          },
          {
            name: 'closed',
            label: 'resolved',
            description: 'Issue resolved and closed',
            required_actions: ['close_issue', 'document_lessons'],
            estimated_duration: '0h',
            auto_progress: false
          }
        ]
      },
      
      feature: {
        name: 'Feature Request Workflow',
        description: 'Workflow for implementing new features',
        stages: [
          {
            name: 'planning',
            label: 'planning',
            description: 'Feature planning and design',
            required_actions: ['gather_requirements', 'design_solution'],
            estimated_duration: '16h',
            auto_progress: false
          },
          {
            name: 'design_review',
            label: 'design-review',
            description: 'Design review and approval',
            required_actions: ['design_review', 'stakeholder_approval'],
            estimated_duration: '8h',
            auto_progress: false
          },
          {
            name: 'development',
            label: 'in-progress',
            description: 'Feature development',
            required_actions: ['implement_feature', 'add_tests'],
            estimated_duration: '40h',
            auto_progress: false
          },
          {
            name: 'testing',
            label: 'testing',
            description: 'Feature testing',
            required_actions: ['unit_tests', 'integration_tests', 'user_acceptance'],
            estimated_duration: '16h',
            auto_progress: false
          },
          {
            name: 'review',
            label: 'review',
            description: 'Code review and approval',
            required_actions: ['code_review', 'approval'],
            estimated_duration: '4h',
            auto_progress: false
          },
          {
            name: 'deployment',
            label: 'ready-for-deployment',
            description: 'Ready for deployment',
            required_actions: ['deploy', 'verify'],
            estimated_duration: '2h',
            auto_progress: false
          },
          {
            name: 'verification',
            label: 'verification',
            description: 'Post-deployment verification',
            required_actions: ['monitor', 'user_feedback'],
            estimated_duration: '72h',
            auto_progress: true
          },
          {
            name: 'closed',
            label: 'completed',
            description: 'Feature completed and closed',
            required_actions: ['close_issue', 'document_feature'],
            estimated_duration: '0h',
            auto_progress: false
          }
        ]
      },
      
      security: {
        name: 'Security Issue Workflow',
        description: 'High-priority workflow for security vulnerabilities',
        stages: [
          {
            name: 'assessment',
            label: 'security-assessment',
            description: 'Security impact assessment',
            required_actions: ['assess_severity', 'identify_scope'],
            estimated_duration: '2h',
            auto_progress: false
          },
          {
            name: 'containment',
            label: 'containment',
            description: 'Immediate containment measures',
            required_actions: ['implement_mitigation', 'isolate_affected_systems'],
            estimated_duration: '4h',
            auto_progress: false
          },
          {
            name: 'investigation',
            label: 'investigating',
            description: 'Detailed security investigation',
            required_actions: ['forensic_analysis', 'identify_attack_vector'],
            estimated_duration: '8h',
            auto_progress: false
          },
          {
            name: 'fix_development',
            label: 'fix-development',
            description: 'Security fix development',
            required_actions: ['develop_patch', 'security_testing'],
            estimated_duration: '16h',
            auto_progress: false
          },
          {
            name: 'emergency_review',
            label: 'emergency-review',
            description: 'Emergency security review',
            required_actions: ['security_review', 'emergency_approval'],
            estimated_duration: '2h',
            auto_progress: false
          },
          {
            name: 'emergency_deployment',
            label: 'emergency-deployment',
            description: 'Emergency security patch deployment',
            required_actions: ['deploy_patch', 'verify_fix'],
            estimated_duration: '2h',
            auto_progress: false
          },
          {
            name: 'post_incident',
            label: 'post-incident',
            description: 'Post-incident analysis and documentation',
            required_actions: ['incident_report', 'lessons_learned'],
            estimated_duration: '24h',
            auto_progress: true
          },
          {
            name: 'closed',
            label: 'security-resolved',
            description: 'Security issue resolved',
            required_actions: ['close_issue', 'update_security_docs'],
            estimated_duration: '0h',
            auto_progress: false
          }
        ]
      },
      
      documentation: {
        name: 'Documentation Update Workflow',
        description: 'Workflow for documentation improvements',
        stages: [
          {
            name: 'planning',
            label: 'doc-planning',
            description: 'Documentation planning',
            required_actions: ['identify_gaps', 'plan_structure'],
            estimated_duration: '4h',
            auto_progress: false
          },
          {
            name: 'writing',
            label: 'writing',
            description: 'Documentation writing',
            required_actions: ['write_content', 'add_examples'],
            estimated_duration: '16h',
            auto_progress: false
          },
          {
            name: 'review',
            label: 'doc-review',
            description: 'Documentation review',
            required_actions: ['technical_review', 'copy_edit'],
            estimated_duration: '8h',
            auto_progress: false
          },
          {
            name: 'approval',
            label: 'doc-approval',
            description: 'Documentation approval',
            required_actions: ['stakeholder_approval', 'final_review'],
            estimated_duration: '4h',
            auto_progress: false
          },
          {
            name: 'publishing',
            label: 'publishing',
            description: 'Documentation publishing',
            required_actions: ['publish', 'notify_users'],
            estimated_duration: '2h',
            auto_progress: false
          },
          {
            name: 'closed',
            label: 'documentation-complete',
            description: 'Documentation update complete',
            required_actions: ['close_issue', 'archive_old_docs'],
            estimated_duration: '0h',
            auto_progress: false
          }
        ]
      }
    };
  }

  /**
   * Start a new workflow for an issue
   */
  async startWorkflow(issueNumber, workflowType = 'bug_fix', options = {}) {
    try {
      // Validate workflow type
      if (!this.workflows[workflowType]) {
        throw new Error(`Unknown workflow type: ${workflowType}`);
      }
      
      // Get issue details
      const issue = await this.getIssue(issueNumber);
      if (!issue) {
        throw new Error(`Issue #${issueNumber} not found`);
      }
      
      // Check if workflow already exists
      if (this.activeWorkflows.has(issueNumber)) {
        throw new Error(`Workflow already exists for issue #${issueNumber}`);
      }
      
      // Create workflow instance
      const workflow = {
        issue_number: issueNumber,
        workflow_type: workflowType,
        current_stage: 0,
        stages: this.workflows[workflowType].stages,
        status: 'active',
        started_at: new Date().toISOString(),
        current_stage_started: new Date().toISOString(),
        stage_history: [],
        actions_completed: new Set(),
        metadata: {
          title: issue.title,
          assignees: issue.assignees?.map(a => a.login) || [],
          labels: issue.labels?.map(l => l.name) || [],
          priority: this.determinePriority(issue),
          estimated_completion: this.calculateEstimatedCompletion(workflowType)
        },
        options: {
          auto_progress: options.auto_progress ?? this.workflowConfig.auto_progress,
          require_approval: options.require_approval ?? this.workflowConfig.require_approval,
          enforce_stages: options.enforce_stages ?? this.workflowConfig.enforce_stages
        }
      };
      
      // Initialize first stage
      await this.initializeStage(workflow, 0);
      
      // Add to active workflows
      this.activeWorkflows.set(issueNumber, workflow);
      
      // Update issue labels
      await this.updateIssueLabels(issueNumber, workflow);
      
      // Emit workflow started event
      this.emit('workflow_started', { workflow });
      
      console.log(`🚀 Started ${workflowType} workflow for issue #${issueNumber}`);
      
      return workflow;
      
    } catch (error) {
      console.error(`❌ Error starting workflow for issue #${issueNumber}:`, error.message);
      this.emit('workflow_error', { issue_number: issueNumber, error });
      throw error;
    }
  }

  /**
   * Progress workflow to next stage
   */
  async progressWorkflow(issueNumber, stageIndex = null, action = null) {
    try {
      const workflow = this.activeWorkflows.get(issueNumber);
      if (!workflow) {
        throw new Error(`No active workflow found for issue #${issueNumber}`);
      }
      
      // Determine next stage
      let nextStage = stageIndex !== null ? stageIndex : workflow.current_stage + 1;
      
      // Validate stage progression
      if (nextStage >= workflow.stages.length) {
        throw new Error(`Cannot progress beyond final stage`);
      }
      
      if (nextStage <= workflow.current_stage) {
        throw new Error(`Cannot progress to previous or current stage`);
      }
      
      // Check if current stage requirements are met
      if (workflow.options.enforce_stages) {
        const currentStage = workflow.stages[workflow.current_stage];
        const missingActions = currentStage.required_actions.filter(
          action => !workflow.actions_completed.has(action)
        );
        
        if (missingActions.length > 0) {
          throw new Error(`Cannot progress: missing required actions: ${missingActions.join(', ')}`);
        }
      }
      
      // Record stage completion
      await this.completeStage(workflow, workflow.current_stage, action);
      
      // Update workflow state
      workflow.current_stage = nextStage;
      workflow.current_stage_started = new Date().toISOString();
      
      // Initialize new stage
      await this.initializeStage(workflow, nextStage);
      
      // Update issue labels
      await this.updateIssueLabels(issueNumber, workflow);
      
      // Check if workflow is complete
      if (nextStage === workflow.stages.length - 1) {
        await this.completeWorkflow(issueNumber);
      }
      
      // Emit stage progressed event
      this.emit('stage_progressed', { workflow, stage_index: nextStage });
      
      console.log(`🔄 Progressed workflow for issue #${issueNumber} to stage ${nextStage}: ${workflow.stages[nextStage].name}`);
      
      return workflow;
      
    } catch (error) {
      console.error(`❌ Error progressing workflow for issue #${issueNumber}:`, error.message);
      this.emit('workflow_error', { issue_number: issueNumber, error });
      throw error;
    }
  }

  /**
   * Complete a workflow
   */
  async completeWorkflow(issueNumber) {
    try {
      const workflow = this.activeWorkflows.get(issueNumber);
      if (!workflow) {
        throw new Error(`No active workflow found for issue #${issueNumber}`);
      }
      
      // Record final stage completion
      await this.completeStage(workflow, workflow.current_stage, 'workflow_completed');
      
      // Update workflow status
      workflow.status = 'completed';
      workflow.completed_at = new Date().toISOString();
      workflow.total_duration = this.calculateDuration(workflow.started_at, workflow.completed_at);
      
      // Move to history
      this.workflowHistory.set(issueNumber, workflow);
      this.activeWorkflows.delete(issueNumber);
      
      // Update issue labels
      await this.updateIssueLabels(issueNumber, workflow);
      
      // Calculate metrics
      this.calculateWorkflowMetrics(workflow);
      
      // Emit workflow completed event
      this.emit('workflow_completed', { workflow });
      
      console.log(`✅ Completed workflow for issue #${issueNumber}`);
      
      return workflow;
      
    } catch (error) {
      console.error(`❌ Error completing workflow for issue #${issueNumber}:`, error.message);
      this.emit('workflow_error', { issue_number: issueNumber, error });
      throw error;
    }
  }

  /**
   * Initialize a workflow stage
   */
  async initializeStage(workflow, stageIndex) {
    const stage = workflow.stages[stageIndex];
    
    // Add stage to history
    workflow.stage_history.push({
      stage_index: stageIndex,
      stage_name: stage.name,
      started_at: new Date().toISOString(),
      status: 'active',
      actions_completed: [],
      estimated_duration: stage.estimated_duration
    });
    
    // Set timeout for stage if auto-progress is enabled
    if (workflow.options.auto_progress && stage.auto_progress) {
      const timeoutMs = this.parseDuration(stage.estimated_duration);
      setTimeout(() => {
        this.handleWorkflowTimeout(workflow.issue_number, stageIndex);
      }, timeoutMs);
    }
    
    // Emit stage initialized event
    this.emit('stage_initialized', { workflow, stage_index: stageIndex, stage });
  }

  /**
   * Complete a workflow stage
   */
  async completeStage(workflow, stageIndex, action = null) {
    const stageHistory = workflow.stage_history.find(h => h.stage_index === stageIndex);
    if (stageHistory) {
      stageHistory.status = 'completed';
      stageHistory.completed_at = new Date().toISOString();
      stageHistory.duration = this.calculateDuration(stageHistory.started_at, stageHistory.completed_at);
      
      if (action) {
        stageHistory.actions_completed.push(action);
      }
    }
    
    // Emit stage completed event
    this.emit('stage_completed', { workflow, stage_index: stageIndex, stage_history: stageHistory });
  }

  /**
   * Handle workflow timeout
   */
  async handleWorkflowTimeout(issueNumber, stageIndex) {
    try {
      const workflow = this.activeWorkflows.get(issueNumber);
      if (!workflow || workflow.current_stage !== stageIndex) {
        return; // Workflow has progressed or doesn't exist
      }
      
      const stage = workflow.stages[stageIndex];
      const timeoutConfig = this.workflowConfig.workflow_timeouts[workflow.workflow_type];
      
      if (timeoutConfig) {
        if (timeoutConfig.action === 'escalate') {
          await this.escalateWorkflow(issueNumber, `Stage ${stage.name} timed out`);
        } else if (timeoutConfig.action === 'remind') {
          await this.sendReminder(issueNumber, `Stage ${stage.name} is taking longer than expected`);
        }
      }
      
      // Emit timeout event
      this.emit('stage_timeout', { workflow, stage_index: stageIndex, stage });
      
    } catch (error) {
      console.error(`❌ Error handling timeout for issue #${issueNumber}:`, error.message);
    }
  }

  /**
   * Escalate a workflow
   */
  async escalateWorkflow(issueNumber, reason) {
    try {
      const workflow = this.activeWorkflows.get(issueNumber);
      if (!workflow) return;
      
      // Add escalation label
      await this.addIssueLabel(issueNumber, 'escalated');
      
      // Create escalation comment
      await this.createIssueComment(issueNumber, `🚨 **Workflow Escalation**\n\n**Reason**: ${reason}\n**Current Stage**: ${workflow.stages[workflow.current_stage].name}\n**Started**: ${workflow.current_stage_started}\n\nThis issue requires immediate attention.`);
      
      // Emit escalation event
      this.emit('workflow_escalated', { workflow, reason });
      
      console.log(`🚨 Escalated workflow for issue #${issueNumber}: ${reason}`);
      
    } catch (error) {
      console.error(`❌ Error escalating workflow for issue #${issueNumber}:`, error.message);
    }
  }

  /**
   * Send reminder for workflow
   */
  async sendReminder(issueNumber, message) {
    try {
      await this.createIssueComment(issueNumber, `⏰ **Workflow Reminder**\n\n${message}\n\nPlease update the issue status or progress the workflow.`);
      
      // Emit reminder event
      this.emit('workflow_reminder', { issue_number: issueNumber, message });
      
      console.log(`⏰ Sent reminder for issue #${issueNumber}: ${message}`);
      
    } catch (error) {
      console.error(`❌ Error sending reminder for issue #${issueNumber}:`, error.message);
    }
  }

  /**
   * Update issue labels based on workflow
   */
  async updateIssueLabels(issueNumber, workflow) {
    try {
      const currentStage = workflow.stages[workflow.current_stage];
      const newLabels = [currentStage.label];
      
      // Add workflow type label
      newLabels.push(`workflow-${workflow.workflow_type}`);
      
      // Add status labels
      if (workflow.status === 'active') {
        newLabels.push('workflow-active');
      } else if (workflow.status === 'completed') {
        newLabels.push('workflow-completed');
      }
      
      // Update issue labels
      await this.setIssueLabels(issueNumber, newLabels);
      
    } catch (error) {
      console.error(`❌ Error updating labels for issue #${issueNumber}:`, error.message);
    }
  }

  /**
   * Get workflow status for an issue
   */
  getWorkflowStatus(issueNumber) {
    const activeWorkflow = this.activeWorkflows.get(issueNumber);
    const historicalWorkflow = this.workflowHistory.get(issueNumber);
    
    if (activeWorkflow) {
      return {
        ...activeWorkflow,
        is_active: true,
        progress_percentage: Math.round(((activeWorkflow.current_stage + 1) / activeWorkflow.stages.length) * 100)
      };
    } else if (historicalWorkflow) {
      return {
        ...historicalWorkflow,
        is_active: false,
        progress_percentage: 100
      };
    }
    
    return null;
  }

  /**
   * Get all active workflows
   */
  getActiveWorkflows() {
    return Array.from(this.activeWorkflows.values());
  }

  /**
   * Get workflow statistics
   */
  getWorkflowStats() {
    const stats = {
      total_workflows: this.activeWorkflows.size + this.workflowHistory.size,
      active_workflows: this.activeWorkflows.size,
      completed_workflows: this.workflowHistory.size,
      workflows_by_type: {},
      average_completion_time: 0,
      stage_distribution: {}
    };
    
    // Calculate type distribution
    for (const workflow of this.activeWorkflows.values()) {
      stats.workflows_by_type[workflow.workflow_type] = (stats.workflows_by_type[workflow.workflow_type] || 0) + 1;
    }
    
    for (const workflow of this.workflowHistory.values()) {
      stats.workflows_by_type[workflow.workflow_type] = (stats.workflows_by_type[workflow.workflow_type] || 0) + 1;
    }
    
    // Calculate average completion time
    let totalTime = 0;
    let completedCount = 0;
    
    for (const workflow of this.workflowHistory.values()) {
      if (workflow.total_duration) {
        totalTime += workflow.total_duration;
        completedCount++;
      }
    }
    
    if (completedCount > 0) {
      stats.average_completion_time = totalTime / completedCount;
    }
    
    return stats;
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
   * Determine issue priority
   */
  determinePriority(issue) {
    const labels = issue.labels?.map(l => l.name.toLowerCase()) || [];
    
    if (labels.includes('critical') || labels.includes('p0')) return 'critical';
    if (labels.includes('high') || labels.includes('p1')) return 'high';
    if (labels.includes('medium') || labels.includes('p2')) return 'medium';
    if (labels.includes('low') || labels.includes('p3')) return 'low';
    
    return 'medium';
  }

  /**
   * Calculate estimated completion time
   */
  calculateEstimatedCompletion(workflowType) {
    const workflow = this.workflows[workflowType];
    if (!workflow) return null;
    
    let totalHours = 0;
    for (const stage of workflow.stages) {
      totalHours += this.parseDuration(stage.estimated_duration) / (1000 * 60 * 60);
    }
    
    return {
      total_hours: totalHours,
      estimated_days: Math.ceil(totalHours / 8),
      confidence: 'medium'
    };
  }

  /**
   * Parse duration string to milliseconds
   */
  parseDuration(duration) {
    const match = duration.match(/(\d+)([hmd])/);
    if (!match) return 0;
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 'h': return value * 60 * 60 * 1000;
      case 'm': return value * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 0;
    }
  }

  /**
   * Calculate duration between two timestamps
   */
  calculateDuration(startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    return end - start;
  }

  /**
   * Add label to issue
   */
  async addIssueLabel(issueNumber, label) {
    try {
      const [owner, repo] = this.repository.split('/');
      await this.octokit.issues.addLabels({
        owner,
        repo,
        issue_number: issueNumber,
        labels: [label]
      });
    } catch (error) {
      console.error(`❌ Error adding label ${label} to issue #${issueNumber}:`, error.message);
    }
  }

  /**
   * Set issue labels
   */
  async setIssueLabels(issueNumber, labels) {
    try {
      const [owner, repo] = this.repository.split('/');
      await this.octokit.issues.setLabels({
        owner,
        repo,
        issue_number: issueNumber,
        labels: labels
      });
    } catch (error) {
      console.error(`❌ Error setting labels for issue #${issueNumber}:`, error.message);
    }
  }

  /**
   * Create issue comment
   */
  async createIssueComment(issueNumber, body) {
    try {
      const [owner, repo] = this.repository.split('/');
      await this.octokit.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body: body
      });
    } catch (error) {
      console.error(`❌ Error creating comment for issue #${issueNumber}:`, error.message);
    }
  }

  /**
   * Calculate workflow metrics
   */
  calculateWorkflowMetrics(workflow) {
    const metrics = {
      workflow_type: workflow.workflow_type,
      total_duration: workflow.total_duration,
      stage_durations: {},
      efficiency_score: 0,
      bottlenecks: []
    };
    
    // Calculate stage durations
    for (const stageHistory of workflow.stage_history) {
      if (stageHistory.duration) {
        metrics.stage_durations[stageHistory.stage_name] = stageHistory.duration;
      }
    }
    
    // Calculate efficiency score
    const estimatedTotal = this.calculateEstimatedCompletion(workflow.workflow_type)?.total_hours * 60 * 60 * 1000;
    if (estimatedTotal && workflow.total_duration) {
      metrics.efficiency_score = Math.round((estimatedTotal / workflow.total_duration) * 100);
    }
    
    // Identify bottlenecks (stages that took longer than estimated)
    for (const stageHistory of workflow.stage_history) {
      if (stageHistory.duration && stageHistory.estimated_duration) {
        const estimated = this.parseDuration(stageHistory.estimated_duration);
        if (stageHistory.duration > estimated * 1.5) { // 50% over estimated
          metrics.bottlenecks.push({
            stage: stageHistory.stage_name,
            actual_duration: stageHistory.duration,
            estimated_duration: estimated,
            overrun_percentage: Math.round(((stageHistory.duration - estimated) / estimated) * 100)
          });
        }
      }
    }
    
    this.workflowMetrics.set(workflow.issue_number, metrics);
  }
}

module.exports = IssueResolutionWorkflow;


