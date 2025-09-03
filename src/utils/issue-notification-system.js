/**
 * Issue Notification System
 * 
 * Comprehensive notification system for GitHub issues, providing
 * multiple notification channels (email, Slack, webhooks, in-app)
 * with intelligent routing, delivery management, and user preferences.
 * 
 * @author AI Code Review System
 * @version 1.0.0
 * @last_updated 2024-12-19
 */

const { Octokit } = require('@octokit/rest');
const EventEmitter = require('events');
const nodemailer = require('nodemailer');

class IssueNotificationSystem extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = config;
    this.octokit = new Octokit({
      auth: config.github?.token || process.env.GITHUB_TOKEN,
      baseUrl: config.github?.api_url || 'https://api.github.com'
    });
    
    this.repository = config.github?.repository || process.env.GITHUB_REPOSITORY;
    
    // Notification configuration
    this.notificationConfig = {
      enabled: config.issue_notifications?.enabled ?? true,
      channels: config.issue_notifications?.channels ?? {
        email: true,
        slack: false,
        webhook: false,
        github: true,
        in_app: true
      },
      routing: config.issue_notifications?.routing ?? {
        auto_assign: true,
        smart_grouping: true,
        priority_based: true,
        time_based: true
      },
      delivery: config.issue_notifications?.delivery ?? {
        immediate: ['critical', 'security'],
        delayed: ['high', 'medium'],
        batched: ['low', 'documentation'],
        batch_interval_minutes: 30
      },
      templates: config.issue_notifications?.templates ?? {
        email: 'default',
        slack: 'default',
        github: 'default'
      }
    };
    
    // Notification state
    this.notificationQueue = [];
    this.deliveryHistory = new Map();
    this.userPreferences = new Map();
    this.channelStatus = new Map();
    
    // Initialize channels
    this.initializeChannels();
    
    // Bind methods
    this.sendNotification = this.sendNotification.bind(this);
    this.queueNotification = this.queueNotification.bind(this);
    this.processQueue = this.processQueue.bind(this);
    this.updateUserPreferences = this.updateUserPreferences.bind(this);
  }

  /**
   * Initialize notification channels
   */
  initializeChannels() {
    // Initialize email channel
    if (this.notificationConfig.channels.email) {
      this.initializeEmailChannel();
    }
    
    // Initialize Slack channel
    if (this.notificationConfig.channels.slack) {
      this.initializeSlackChannel();
    }
    
    // Initialize webhook channel
    if (this.notificationConfig.channels.webhook) {
      this.initializeWebhookChannel();
    }
    
    // Initialize GitHub channel
    if (this.notificationConfig.channels.github) {
      this.initializeGitHubChannel();
    }
    
    // Initialize in-app channel
    if (this.notificationConfig.channels.in_app) {
      this.initializeInAppChannel();
    }
  }

  /**
   * Initialize email notification channel
   */
  initializeEmailChannel() {
    try {
      const emailConfig = this.config.email || {};
      
      this.emailTransporter = nodemailer.createTransporter({
        host: emailConfig.smtp_host || process.env.SMTP_HOST,
        port: emailConfig.smtp_port || process.env.SMTP_PORT || 587,
        secure: emailConfig.smtp_secure || process.env.SMTP_SECURE === 'true',
        auth: {
          user: emailConfig.smtp_user || process.env.SMTP_USER,
          pass: emailConfig.smtp_pass || process.env.SMTP_PASS
        }
      });
      
      this.channelStatus.set('email', 'ready');
      console.log('✅ Email notification channel initialized');
      
    } catch (error) {
      console.error('❌ Error initializing email channel:', error.message);
      this.channelStatus.set('email', 'error');
    }
  }

  /**
   * Initialize Slack notification channel
   */
  initializeSlackChannel() {
    try {
      const slackConfig = this.config.slack || {};
      
      if (slackConfig.webhook_url || process.env.SLACK_WEBHOOK_URL) {
        this.slackWebhookUrl = slackConfig.webhook_url || process.env.SLACK_WEBHOOK_URL;
        this.channelStatus.set('slack', 'ready');
        console.log('✅ Slack notification channel initialized');
      } else {
        this.channelStatus.set('slack', 'disabled');
        console.log('⚠️  Slack channel disabled - no webhook URL configured');
      }
      
    } catch (error) {
      console.error('❌ Error initializing Slack channel:', error.message);
      this.channelStatus.set('slack', 'error');
    }
  }

  /**
   * Initialize webhook notification channel
   */
  initializeWebhookChannel() {
    try {
      const webhookConfig = this.config.webhook || {};
      
      if (webhookConfig.endpoints && webhookConfig.endpoints.length > 0) {
        this.webhookEndpoints = webhookConfig.endpoints;
        this.channelStatus.set('webhook', 'ready');
        console.log('✅ Webhook notification channel initialized');
      } else {
        this.channelStatus.set('webhook', 'disabled');
        console.log('⚠️  Webhook channel disabled - no endpoints configured');
      }
      
    } catch (error) {
      console.error('❌ Error initializing webhook channel:', error.message);
      this.channelStatus.set('webhook', 'error');
    }
  }

  /**
   * Initialize GitHub notification channel
   */
  initializeGitHubChannel() {
    try {
      // GitHub channel is always available when we have API access
      this.channelStatus.set('github', 'ready');
      console.log('✅ GitHub notification channel initialized');
      
    } catch (error) {
      console.error('❌ Error initializing GitHub channel:', error.message);
      this.channelStatus.set('github', 'error');
    }
  }

  /**
   * Initialize in-app notification channel
   */
  initializeInAppChannel() {
    try {
      // In-app notifications are handled through events
      this.channelStatus.set('in_app', 'ready');
      console.log('✅ In-app notification channel initialized');
      
    } catch (error) {
      console.error('❌ Error initializing in-app channel:', error.message);
      this.channelStatus.set('in_app', 'error');
    }
  }

  /**
   * Send notification for an issue
   */
  async sendNotification(issue, notificationType = 'issue_created', options = {}) {
    try {
      console.log(`📢 Sending ${notificationType} notification for issue #${issue.number}`);
      
      // Determine notification priority and delivery timing
      const priority = this.determineNotificationPriority(issue, notificationType);
      const deliveryTiming = this.determineDeliveryTiming(priority);
      
      // Create notification object
      const notification = {
        id: this.generateNotificationId(),
        issue_number: issue.number,
        issue_title: issue.title,
        notification_type: notificationType,
        priority: priority,
        delivery_timing: deliveryTiming,
        channels: this.determineChannels(issue, notificationType),
        recipients: this.determineRecipients(issue, notificationType),
        content: this.generateNotificationContent(issue, notificationType, options),
        metadata: {
          created_at: new Date().toISOString(),
          issue_state: issue.state,
          issue_labels: issue.labels?.map(l => l.name) || [],
          assignees: issue.assignees?.map(a => a.login) || [],
          milestone: issue.milestone?.title || null
        }
      };
      
      // Handle immediate delivery
      if (deliveryTiming === 'immediate') {
        await this.deliverNotification(notification);
      } else {
        // Queue for later delivery
        this.queueNotification(notification);
      }
      
      // Emit notification event
      this.emit('notification_created', notification);
      
      return notification;
      
    } catch (error) {
      console.error('❌ Error sending notification:', error.message);
      this.emit('notification_error', { issue, error });
      throw error;
    }
  }

  /**
   * Determine notification priority
   */
  determineNotificationPriority(issue, notificationType) {
    // Base priority from issue labels
    const labels = issue.labels?.map(l => l.name.toLowerCase()) || [];
    
    if (labels.includes('critical') || labels.includes('p0')) return 'critical';
    if (labels.includes('high') || labels.includes('p1')) return 'high';
    if (labels.includes('medium') || labels.includes('p2')) return 'medium';
    if (labels.includes('low') || labels.includes('p3')) return 'low';
    
    // Adjust based on notification type
    if (notificationType === 'security_issue') return 'critical';
    if (notificationType === 'issue_escalated') return 'high';
    if (notificationType === 'issue_stale') return 'medium';
    if (notificationType === 'issue_updated') return 'medium';
    
    // Default priority
    return 'medium';
  }

  /**
   * Determine delivery timing based on priority
   */
  determineDeliveryTiming(priority) {
    const deliveryConfig = this.notificationConfig.delivery;
    
    if (deliveryConfig.immediate.includes(priority)) return 'immediate';
    if (deliveryConfig.delayed.includes(priority)) return 'delayed';
    if (deliveryConfig.batched.includes(priority)) return 'batched';
    
    return 'delayed';
  }

  /**
   * Determine notification channels
   */
  determineChannels(issue, notificationType) {
    const channels = [];
    
    // Always include GitHub for issue-related notifications
    if (this.channelStatus.get('github') === 'ready') {
      channels.push('github');
    }
    
    // Include email for important notifications
    if (this.channelStatus.get('email') === 'ready' && 
        ['issue_created', 'issue_escalated', 'security_issue'].includes(notificationType)) {
      channels.push('email');
    }
    
    // Include Slack for team notifications
    if (this.channelStatus.get('slack') === 'ready' && 
        ['issue_created', 'issue_updated', 'issue_escalated'].includes(notificationType)) {
      channels.push('slack');
    }
    
    // Include webhook for external integrations
    if (this.channelStatus.get('webhook') === 'ready' && 
        ['issue_created', 'issue_closed'].includes(notificationType)) {
      channels.push('webhook');
    }
    
    // Always include in-app for user notifications
    if (this.channelStatus.get('in_app') === 'ready') {
      channels.push('in_app');
    }
    
    return channels;
  }

  /**
   * Determine notification recipients
   */
  determineRecipients(issue, notificationType) {
    const recipients = {
      assignees: issue.assignees?.map(a => a.login) || [],
      watchers: [],
      team_members: [],
      external_stakeholders: []
    };
    
    // Add assignees
    if (issue.assignees && issue.assignees.length > 0) {
      recipients.assignees = issue.assignees.map(a => a.login);
    }
    
    // Add team members based on issue type
    if (this.notificationConfig.routing.auto_assign) {
      recipients.team_members = this.getTeamMembersForIssue(issue);
    }
    
    // Add external stakeholders for security issues
    if (notificationType === 'security_issue') {
      recipients.external_stakeholders = this.getSecurityStakeholders();
    }
    
    return recipients;
  }

  /**
   * Generate notification content
   */
  generateNotificationContent(issue, notificationType, options = {}) {
    const templates = this.notificationConfig.templates;
    
    switch (notificationType) {
      case 'issue_created':
        return this.generateIssueCreatedContent(issue, templates);
      case 'issue_updated':
        return this.generateIssueUpdatedContent(issue, templates, options);
      case 'issue_escalated':
        return this.generateIssueEscalatedContent(issue, templates, options);
      case 'security_issue':
        return this.generateSecurityIssueContent(issue, templates);
      case 'issue_stale':
        return this.generateIssueStaleContent(issue, templates);
      case 'issue_closed':
        return this.generateIssueClosedContent(issue, templates);
      default:
        return this.generateDefaultContent(issue, notificationType, templates);
    }
  }

  /**
   * Generate issue created notification content
   */
  generateIssueCreatedContent(issue, templates) {
    const baseContent = {
      subject: `New Issue: ${issue.title}`,
      title: `🚨 New Issue Created`,
      summary: `A new issue has been created in ${this.repository}`,
      details: {
        issue_number: issue.number,
        title: issue.title,
        description: issue.body || 'No description provided',
        labels: issue.labels?.map(l => l.name) || [],
        assignees: issue.assignees?.map(a => a.login) || [],
        priority: this.determineNotificationPriority(issue, 'issue_created'),
        created_by: issue.user?.login || 'Unknown'
      },
      actions: [
        { text: 'View Issue', url: issue.html_url },
        { text: 'Assign to Me', action: 'assign_self' },
        { text: 'Add Labels', action: 'add_labels' }
      ]
    };
    
    return this.applyTemplate(baseContent, templates);
  }

  /**
   * Generate issue updated notification content
   */
  generateIssueUpdatedContent(issue, templates, options) {
    const changes = options.changes || {};
    const changeSummary = Object.keys(changes).map(key => 
      `${key}: ${changes[key].from} → ${changes[key].to}`
    ).join(', ');
    
    const baseContent = {
      subject: `Issue Updated: ${issue.title}`,
      title: `🔄 Issue Updated`,
      summary: `Issue #${issue.number} has been updated`,
      details: {
        issue_number: issue.number,
        title: issue.title,
        changes: changeSummary,
        updated_by: options.updated_by || 'Unknown',
        updated_at: new Date().toISOString()
      },
      actions: [
        { text: 'View Issue', url: issue.html_url },
        { text: 'View Changes', action: 'view_changes' }
      ]
    };
    
    return this.applyTemplate(baseContent, templates);
  }

  /**
   * Generate issue escalated notification content
   */
  generateIssueEscalatedContent(issue, templates, options) {
    const baseContent = {
      subject: `🚨 ISSUE ESCALATED: ${issue.title}`,
      title: `🚨 Issue Escalated`,
      summary: `Issue #${issue.number} has been escalated and requires immediate attention`,
      details: {
        issue_number: issue.number,
        title: issue.title,
        escalation_reason: options.reason || 'Manual escalation',
        escalated_by: options.escalated_by || 'System',
        escalated_at: new Date().toISOString(),
        current_assignees: issue.assignees?.map(a => a.login) || [],
        priority: 'critical'
      },
      actions: [
        { text: 'View Issue', url: issue.html_url },
        { text: 'Take Ownership', action: 'take_ownership' },
        { text: 'Request Help', action: 'request_help' }
      ]
    };
    
    return this.applyTemplate(baseContent, templates);
  }

  /**
   * Generate security issue notification content
   */
  generateSecurityIssueContent(issue, templates) {
    const baseContent = {
      subject: `🔒 SECURITY ISSUE: ${issue.title}`,
      title: `🔒 Security Issue Detected`,
      summary: `A security-related issue has been identified and requires immediate attention`,
      details: {
        issue_number: issue.number,
        title: issue.title,
        security_level: 'high',
        affected_components: this.extractSecurityComponents(issue),
        risk_assessment: this.assessSecurityRisk(issue),
        recommended_actions: this.getSecurityRecommendations(issue),
        created_at: issue.created_at
      },
      actions: [
        { text: 'View Issue', url: issue.html_url },
        { text: 'Security Review', action: 'security_review' },
        { text: 'Emergency Response', action: 'emergency_response' }
      ]
    };
    
    return this.applyTemplate(baseContent, templates);
  }

  /**
   * Generate issue stale notification content
   */
  generateIssueStaleContent(issue, templates) {
    const daysSinceUpdate = this.calculateDaysSinceUpdate(issue);
    
    const baseContent = {
      subject: `⏰ Stale Issue: ${issue.title}`,
      title: `⏰ Issue Requires Attention`,
      summary: `Issue #${issue.number} has been inactive for ${daysSinceUpdate} days`,
      details: {
        issue_number: issue.number,
        title: issue.title,
        days_since_update: daysSinceUpdate,
        last_activity: issue.updated_at,
        current_assignees: issue.assignees?.map(a => a.login) || [],
        priority: this.determineNotificationPriority(issue, 'issue_stale')
      },
      actions: [
        { text: 'View Issue', url: issue.html_url },
        { text: 'Update Status', action: 'update_status' },
        { text: 'Reassign', action: 'reassign' }
      ]
    };
    
    return this.applyTemplate(baseContent, templates);
  }

  /**
   * Generate issue closed notification content
   */
  generateIssueClosedContent(issue, templates) {
    const baseContent = {
      subject: `✅ Issue Closed: ${issue.title}`,
      title: `✅ Issue Resolved`,
      summary: `Issue #${issue.number} has been successfully resolved and closed`,
      details: {
        issue_number: issue.number,
        title: issue.title,
        closed_at: issue.closed_at,
        closed_by: issue.closed_by?.login || 'Unknown',
        resolution_time: this.calculateResolutionTime(issue),
        final_labels: issue.labels?.map(l => l.name) || []
      },
      actions: [
        { text: 'View Issue', url: issue.html_url },
        { text: 'View Resolution', action: 'view_resolution' },
        { text: 'Reopen if Needed', action: 'reopen_issue' }
      ]
    };
    
    return this.applyTemplate(baseContent, templates);
  }

  /**
   * Generate default notification content
   */
  generateDefaultContent(issue, notificationType, templates) {
    const baseContent = {
      subject: `Issue Notification: ${issue.title}`,
      title: `📋 Issue Notification`,
      summary: `Notification for issue #${issue.number}`,
      details: {
        issue_number: issue.number,
        title: issue.title,
        notification_type: notificationType,
        timestamp: new Date().toISOString()
      },
      actions: [
        { text: 'View Issue', url: issue.html_url }
      ]
    };
    
    return this.applyTemplate(baseContent, templates);
  }

  /**
   * Apply template to notification content
   */
  applyTemplate(content, templates) {
    // For now, return the base content
    // In a full implementation, this would apply template-specific formatting
    return content;
  }

  /**
   * Queue notification for later delivery
   */
  queueNotification(notification) {
    this.notificationQueue.push(notification);
    
    // Emit queued event
    this.emit('notification_queued', notification);
    
    console.log(`📬 Notification queued for issue #${notification.issue_number}`);
  }

  /**
   * Process notification queue
   */
  async processQueue() {
    if (this.notificationQueue.length === 0) {
      return;
    }
    
    console.log(`📬 Processing ${this.notificationQueue.length} queued notifications`);
    
    const batchSize = 10;
    const batch = this.notificationQueue.splice(0, batchSize);
    
    for (const notification of batch) {
      try {
        await this.deliverNotification(notification);
      } catch (error) {
        console.error(`❌ Error delivering queued notification:`, error.message);
        // Re-queue failed notifications
        this.notificationQueue.unshift(notification);
      }
    }
    
    // Schedule next queue processing
    if (this.notificationQueue.length > 0) {
      setTimeout(() => this.processQueue(), 
        this.notificationConfig.delivery.batch_interval_minutes * 60 * 1000);
    }
  }

  /**
   * Deliver notification through all specified channels
   */
  async deliverNotification(notification) {
    const deliveryResults = [];
    
    for (const channel of notification.channels) {
      try {
        const result = await this.deliverToChannel(notification, channel);
        deliveryResults.push({ channel, success: true, result });
      } catch (error) {
        console.error(`❌ Error delivering to ${channel}:`, error.message);
        deliveryResults.push({ channel, success: false, error: error.message });
      }
    }
    
    // Record delivery history
    this.deliveryHistory.set(notification.id, {
      notification,
      delivery_results: deliveryResults,
      delivered_at: new Date().toISOString()
    });
    
    // Emit delivery completed event
    this.emit('notification_delivered', { notification, delivery_results: deliveryResults });
    
    return deliveryResults;
  }

  /**
   * Deliver notification to specific channel
   */
  async deliverToChannel(notification, channel) {
    switch (channel) {
      case 'email':
        return await this.deliverEmail(notification);
      case 'slack':
        return await this.deliverSlack(notification);
      case 'webhook':
        return await this.deliverWebhook(notification);
      case 'github':
        return await this.deliverGitHub(notification);
      case 'in_app':
        return await this.deliverInApp(notification);
      default:
        throw new Error(`Unknown notification channel: ${channel}`);
    }
  }

  /**
   * Deliver email notification
   */
  async deliverEmail(notification) {
    if (!this.emailTransporter) {
      throw new Error('Email transporter not initialized');
    }
    
    const emailContent = notification.content;
    const recipients = this.getEmailRecipients(notification);
    
    const mailOptions = {
      from: this.config.email?.from_email || process.env.EMAIL_FROM,
      to: recipients,
      subject: emailContent.subject,
      html: this.formatEmailContent(emailContent),
      text: this.formatEmailText(emailContent)
    };
    
    const result = await this.emailTransporter.sendMail(mailOptions);
    
    console.log(`📧 Email notification sent to ${recipients.length} recipients`);
    return result;
  }

  /**
   * Deliver Slack notification
   */
  async deliverSlack(notification) {
    if (!this.slackWebhookUrl) {
      throw new Error('Slack webhook not configured');
    }
    
    const slackContent = this.formatSlackContent(notification.content);
    
    const response = await fetch(this.slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackContent)
    });
    
    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
    }
    
    console.log(`💬 Slack notification sent`);
    return { success: true };
  }

  /**
   * Deliver webhook notification
   */
  async deliverWebhook(notification) {
    if (!this.webhookEndpoints || this.webhookEndpoints.length === 0) {
      throw new Error('No webhook endpoints configured');
    }
    
    const webhookContent = this.formatWebhookContent(notification);
    const results = [];
    
    for (const endpoint of this.webhookEndpoints) {
      try {
        const response = await fetch(endpoint.url, {
          method: endpoint.method || 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...endpoint.headers
          },
          body: JSON.stringify(webhookContent)
        });
        
        results.push({
          endpoint: endpoint.url,
          success: response.ok,
          status: response.status
        });
      } catch (error) {
        results.push({
          endpoint: endpoint.url,
          success: false,
          error: error.message
        });
      }
    }
    
    console.log(`🔗 Webhook notifications sent to ${this.webhookEndpoints.length} endpoints`);
    return results;
  }

  /**
   * Deliver GitHub notification
   */
  async deliverGitHub(notification) {
    // GitHub notifications are typically handled through comments or issue updates
    // For now, we'll emit an event that can be handled by other systems
    
    this.emit('github_notification', notification);
    
    console.log(`🐙 GitHub notification event emitted`);
    return { success: true, method: 'event_emission' };
  }

  /**
   * Deliver in-app notification
   */
  async deliverInApp(notification) {
    // In-app notifications are handled through events
    this.emit('in_app_notification', notification);
    
    console.log(`📱 In-app notification event emitted`);
    return { success: true, method: 'event_emission' };
  }

  // Helper methods

  /**
   * Generate unique notification ID
   */
  generateNotificationId() {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get team members for an issue
   */
  getTeamMembersForIssue(issue) {
    // This would integrate with team management system
    // For now, return empty array
    return [];
  }

  /**
   * Get security stakeholders
   */
  getSecurityStakeholders() {
    // This would return configured security team members
    // For now, return empty array
    return [];
  }

  /**
   * Extract security components from issue
   */
  extractSecurityComponents(issue) {
    // This would analyze issue content to identify affected components
    // For now, return basic analysis
    return ['unknown'];
  }

  /**
   * Assess security risk
   */
  assessSecurityRisk(issue) {
    // This would perform risk assessment based on issue content
    // For now, return medium risk
    return 'medium';
  }

  /**
   * Get security recommendations
   */
  getSecurityRecommendations(issue) {
    // This would provide security-specific recommendations
    // For now, return basic recommendations
    return [
      'Review code changes',
      'Check for known vulnerabilities',
      'Update dependencies if needed'
    ];
  }

  /**
   * Calculate days since last update
   */
  calculateDaysSinceUpdate(issue) {
    const lastUpdate = new Date(issue.updated_at);
    const now = new Date();
    return Math.floor((now - lastUpdate) / (1000 * 60 * 60 * 24));
  }

  /**
   * Calculate resolution time
   */
  calculateResolutionTime(issue) {
    if (!issue.closed_at) return null;
    
    const created = new Date(issue.created_at);
    const closed = new Date(issue.closed_at);
    return Math.floor((closed - created) / (1000 * 60 * 60 * 24));
  }

  /**
   * Get email recipients
   */
  getEmailRecipients(notification) {
    const recipients = [];
    
    // Add assignees
    for (const assignee of notification.recipients.assignees) {
      const email = this.getUserEmail(assignee);
      if (email) recipients.push(email);
    }
    
    // Add team members
    for (const member of notification.recipients.team_members) {
      const email = this.getUserEmail(member);
      if (email) recipients.push(email);
    }
    
    // Add external stakeholders
    for (const stakeholder of notification.recipients.external_stakeholders) {
      const email = this.getUserEmail(stakeholder);
      if (email) recipients.push(email);
    }
    
    return recipients;
  }

  /**
   * Get user email (placeholder implementation)
   */
  getUserEmail(username) {
    // This would integrate with user management system
    // For now, return a placeholder
    return `${username}@example.com`;
  }

  /**
   * Format email content as HTML
   */
  formatEmailContent(content) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">${content.title}</h2>
        <p style="color: #666;">${content.summary}</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
          <h3>Details:</h3>
          <ul>
            ${Object.entries(content.details).map(([key, value]) => 
              `<li><strong>${key}:</strong> ${value}</li>`
            ).join('')}
          </ul>
        </div>
        <div style="margin-top: 20px;">
          <h3>Actions:</h3>
          ${content.actions.map(action => 
            `<a href="#" style="display: inline-block; margin: 5px; padding: 10px 15px; background: #007cba; color: white; text-decoration: none; border-radius: 3px;">${action.text}</a>`
          ).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Format email content as text
   */
  formatEmailText(content) {
    return `
      ${content.title}
      ${content.summary}
      
      Details:
      ${Object.entries(content.details).map(([key, value]) => `${key}: ${value}`).join('\n')}
      
      Actions:
      ${content.actions.map(action => action.text).join(', ')}
    `;
  }

  /**
   * Format Slack content
   */
  formatSlackContent(content) {
    return {
      text: content.title,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: content.title
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: content.summary
          }
        },
        {
          type: 'section',
          fields: Object.entries(content.details).map(([key, value]) => ({
            type: 'mrkdwn',
            text: `*${key}:* ${value}`
          }))
        }
      ]
    };
  }

  /**
   * Format webhook content
   */
  formatWebhookContent(notification) {
    return {
      notification_id: notification.id,
      issue_number: notification.issue_number,
      notification_type: notification.notification_type,
      priority: notification.priority,
      content: notification.content,
      metadata: notification.metadata,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Update user notification preferences
   */
  updateUserPreferences(username, preferences) {
    this.userPreferences.set(username, {
      ...this.userPreferences.get(username),
      ...preferences
    });
    
    console.log(`⚙️  Updated preferences for user: ${username}`);
  }

  /**
   * Get notification statistics
   */
  getNotificationStats() {
    const stats = {
      total_notifications: this.deliveryHistory.size,
      queued_notifications: this.notificationQueue.length,
      channel_status: Object.fromEntries(this.channelStatus),
      delivery_success_rate: this.calculateDeliverySuccessRate(),
      recent_notifications: this.getRecentNotifications()
    };
    
    return stats;
  }

  /**
   * Calculate delivery success rate
   */
  calculateDeliverySuccessRate() {
    if (this.deliveryHistory.size === 0) return 0;
    
    let successfulDeliveries = 0;
    let totalDeliveries = 0;
    
    for (const [id, record] of this.deliveryHistory) {
      for (const result of record.delivery_results) {
        totalDeliveries++;
        if (result.success) successfulDeliveries++;
      }
    }
    
    return totalDeliveries > 0 ? (successfulDeliveries / totalDeliveries) * 100 : 0;
  }

  /**
   * Get recent notifications
   */
  getRecentNotifications(limit = 10) {
    const notifications = Array.from(this.deliveryHistory.values())
      .sort((a, b) => new Date(b.delivered_at) - new Date(a.delivered_at))
      .slice(0, limit);
    
    return notifications;
  }
}

module.exports = IssueNotificationSystem;


