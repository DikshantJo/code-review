/**
 * Email Template Manager
 * 
 * Manages email templates for different notification types with
 * support for dynamic content, styling, and internationalization.
 * 
 * @author AI Code Review System
 * @version 1.0.0
 * @last_updated 2024-12-19
 */

const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');

class EmailTemplateManager {
  constructor(config = {}) {
    this.config = config;
    this.templates = new Map();
    this.partials = new Map();
    this.helpers = new Map();
    
    // Template configuration
    this.templateConfig = {
      base_path: config.email_templates?.base_path || './templates/email',
      default_language: config.email_templates?.default_language || 'en',
      supported_languages: config.email_templates?.supported_languages || ['en'],
      theme: config.email_templates?.theme || 'default',
      branding: config.email_templates?.branding || {
        company_name: 'AI Code Review System',
        logo_url: null,
        primary_color: '#007cba',
        secondary_color: '#f0f0f0'
      }
    };
    
    // Initialize templates and helpers
    this.initializeTemplates();
    this.registerHelpers();
  }

  /**
   * Initialize email templates
   */
  initializeTemplates() {
    try {
      const templatePath = this.templateConfig.base_path;
      
      if (fs.existsSync(templatePath)) {
        this.loadTemplatesFromDirectory(templatePath);
      } else {
        this.createDefaultTemplates();
      }
      
      console.log('✅ Email templates initialized successfully');
      
    } catch (error) {
      console.error('❌ Error initializing email templates:', error.message);
      this.createDefaultTemplates();
    }
  }

  /**
   * Load templates from directory
   */
  loadTemplatesFromDirectory(templatePath) {
    const files = fs.readdirSync(templatePath);
    
    for (const file of files) {
      if (file.endsWith('.hbs') || file.endsWith('.handlebars')) {
        const templateName = path.basename(file, path.extname(file));
        const templatePath = path.join(templatePath, file);
        const templateContent = fs.readFileSync(templatePath, 'utf8');
        
        this.templates.set(templateName, Handlebars.compile(templateContent));
        console.log(`📧 Loaded template: ${templateName}`);
      }
    }
  }

  /**
   * Create default email templates
   */
  createDefaultTemplates() {
    console.log('📧 Creating default email templates...');
    
    // Default notification template
    this.templates.set('notification', Handlebars.compile(this.getDefaultNotificationTemplate()));
    
    // Default issue created template
    this.templates.set('issue_created', Handlebars.compile(this.getDefaultIssueCreatedTemplate()));
    
    // Default issue updated template
    this.templates.set('issue_updated', Handlebars.compile(this.getDefaultIssueUpdatedTemplate()));
    
    // Default security issue template
    this.templates.set('security_issue', Handlebars.compile(this.getDefaultSecurityIssueTemplate()));
    
    // Default issue escalated template
    this.templates.set('issue_escalated', Handlebars.compile(this.getDefaultIssueEscalatedTemplate()));
    
    // Default issue stale template
    this.templates.set('issue_stale', Handlebars.compile(this.getDefaultIssueStaleTemplate()));
    
    // Default issue closed template
    this.templates.set('issue_closed', Handlebars.compile(this.getDefaultIssueClosedTemplate()));
    
    // Default review failed template
    this.templates.set('review_failed', Handlebars.compile(this.getDefaultReviewFailedTemplate()));
    
    // Default review passed template
    this.templates.set('review_passed', Handlebars.compile(this.getDefaultReviewPassedTemplate()));
  }

  /**
   * Register Handlebars helpers
   */
  registerHelpers() {
    // Date formatting helper
    Handlebars.registerHelper('formatDate', function(date, format) {
      if (!date) return 'N/A';
      
      const d = new Date(date);
      if (isNaN(d.getTime())) return 'Invalid Date';
      
      switch (format) {
        case 'short':
          return d.toLocaleDateString();
        case 'long':
          return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
        case 'relative':
          return getRelativeTime(d);
        default:
          return d.toLocaleDateString();
      }
    });

    // Number formatting helper
    Handlebars.registerHelper('formatNumber', function(num, decimals = 0) {
      if (typeof num !== 'number') return '0';
      return num.toFixed(decimals);
    });

    // Array length helper
    Handlebars.registerHelper('length', function(array) {
      return Array.isArray(array) ? array.length : 0;
    });

    // Conditional helper
    Handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
      return arg1 === arg2 ? options.fn(this) : options.inverse(this);
    });

    // Truncate text helper
    Handlebars.registerHelper('truncate', function(text, length = 100) {
      if (!text || text.length <= length) return text;
      return text.substring(0, length) + '...';
    });

    // Join array helper
    Handlebars.registerHelper('join', function(array, separator = ', ') {
      return Array.isArray(array) ? array.join(separator) : '';
    });

    // Capitalize helper
    Handlebars.registerHelper('capitalize', function(text) {
      if (!text) return '';
      return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    });

    // Priority color helper
    Handlebars.registerHelper('priorityColor', function(priority) {
      const colors = {
        critical: '#dc3545',
        high: '#fd7e14',
        medium: '#ffc107',
        low: '#28a745'
      };
      return colors[priority] || colors.medium;
    });

    // Status badge helper
    Handlebars.registerHelper('statusBadge', function(status, options) {
      const badges = {
        open: '<span class="badge badge-success">Open</span>',
        closed: '<span class="badge badge-secondary">Closed</span>',
        pending: '<span class="badge badge-warning">Pending</span>',
        escalated: '<span class="badge badge-danger">Escalated</span>'
      };
      return badges[status] || badges.open;
    });
  }

  /**
   * Get template by name
   */
  getTemplate(templateName) {
    if (!this.templates.has(templateName)) {
      console.warn(`⚠️  Template not found: ${templateName}, using default notification template`);
      return this.templates.get('notification');
    }
    
    return this.templates.get(templateName);
  }

  /**
   * Render email template
   */
  renderTemplate(templateName, data) {
    try {
      const template = this.getTemplate(templateName);
      const html = template(data);
      
      return {
        html: this.wrapInEmailLayout(html, data),
        text: this.convertToText(html),
        subject: this.generateSubject(data)
      };
      
    } catch (error) {
      console.error(`❌ Error rendering template ${templateName}:`, error.message);
      
      // Fallback to basic template
      return {
        html: this.generateFallbackEmail(data),
        text: this.generateFallbackText(data),
        subject: this.generateSubject(data)
      };
    }
  }

  /**
   * Wrap content in email layout
   */
  wrapInEmailLayout(content, data) {
    const layout = this.getEmailLayout();
    const layoutTemplate = Handlebars.compile(layout);
    
    return layoutTemplate({
      ...data,
      content: content,
      branding: this.templateConfig.branding,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get email layout template
   */
  getEmailLayout() {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>{{subject}}</title>
          <style>
              body { 
                  font-family: Arial, sans-serif; 
                  line-height: 1.6; 
                  color: #333; 
                  margin: 0; 
                  padding: 0; 
                  background-color: #f4f4f4; 
              }
              .email-container { 
                  max-width: 600px; 
                  margin: 0 auto; 
                  background-color: #ffffff; 
                  box-shadow: 0 0 10px rgba(0,0,0,0.1); 
              }
              .header { 
                  background-color: {{branding.primary_color}}; 
                  color: white; 
                  padding: 20px; 
                  text-align: center; 
              }
              .header h1 { 
                  margin: 0; 
                  font-size: 24px; 
              }
              .content { 
                  padding: 30px; 
              }
              .footer { 
                  background-color: {{branding.secondary_color}}; 
                  padding: 20px; 
                  text-align: center; 
                  font-size: 12px; 
                  color: #666; 
              }
              .button { 
                  display: inline-block; 
                  padding: 12px 24px; 
                  background-color: {{branding.primary_color}}; 
                  color: white; 
                  text-decoration: none; 
                  border-radius: 5px; 
                  margin: 10px 5px; 
              }
              .button:hover { 
                  background-color: {{branding.primary_color}}dd; 
              }
              .alert { 
                  padding: 15px; 
                  margin: 15px 0; 
                  border-radius: 5px; 
                  border-left: 4px solid; 
              }
              .alert-info { 
                  background-color: #d1ecf1; 
                  border-color: #17a2b8; 
                  color: #0c5460; 
              }
              .alert-warning { 
                  background-color: #fff3cd; 
                  border-color: #ffc107; 
                  color: #856404; 
              }
              .alert-danger { 
                  background-color: #f8d7da; 
                  border-color: #dc3545; 
                  color: #721c24; 
              }
              .alert-success { 
                  background-color: #d4edda; 
                  border-color: #28a745; 
                  color: #155724; 
              }
              .badge { 
                  display: inline-block; 
                  padding: 4px 8px; 
                  font-size: 12px; 
                  font-weight: bold; 
                  border-radius: 3px; 
                  color: white; 
              }
              .badge-success { background-color: #28a745; }
              .badge-warning { background-color: #ffc107; color: #212529; }
              .badge-danger { background-color: #dc3545; }
              .badge-secondary { background-color: #6c757d; }
              .info-grid { 
                  display: grid; 
                  grid-template-columns: 1fr 1fr; 
                  gap: 15px; 
                  margin: 20px 0; 
              }
              .info-item { 
                  background-color: #f8f9fa; 
                  padding: 15px; 
                  border-radius: 5px; 
                  border: 1px solid #dee2e6; 
              }
              .info-label { 
                  font-weight: bold; 
                  color: #495057; 
                  margin-bottom: 5px; 
              }
              .info-value { 
                  color: #212529; 
              }
              @media (max-width: 600px) {
                  .email-container { margin: 10px; }
                  .content { padding: 20px; }
                  .info-grid { grid-template-columns: 1fr; }
              }
          </style>
      </head>
      <body>
          <div class="email-container">
              <div class="header">
                  <h1>{{branding.company_name}}</h1>
                  {{#if subject}}<p>{{subject}}</p>{{/if}}
              </div>
              
              <div class="content">
                  {{{content}}}
              </div>
              
              <div class="footer">
                  <p>This email was sent by {{branding.company_name}}</p>
                  <p>Generated on {{formatDate timestamp 'long'}}</p>
                  {{#if unsubscribe_url}}
                  <p><a href="{{unsubscribe_url}}">Unsubscribe</a></p>
                  {{/if}}
              </div>
          </div>
      </body>
      </html>
    `;
  }

  /**
   * Convert HTML to plain text
   */
  convertToText(html) {
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
      .replace(/&amp;/g, '&') // Replace &amp; with &
      .replace(/&lt;/g, '<') // Replace &lt; with <
      .replace(/&gt;/g, '>') // Replace &gt; with >
      .replace(/&quot;/g, '"') // Replace &quot; with "
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
  }

  /**
   * Generate email subject
   */
  generateSubject(data) {
    if (data.subject) return data.subject;
    if (data.title) return data.title;
    return 'Notification from AI Code Review System';
  }

  /**
   * Generate fallback email
   */
  generateFallbackEmail(data) {
    return `
      <div class="alert alert-info">
          <h2>Notification</h2>
          <p><strong>Type:</strong> ${data.notification_type || 'Unknown'}</p>
          <p><strong>Issue:</strong> #${data.issue_number || 'N/A'}</p>
          <p><strong>Title:</strong> ${data.issue_title || 'N/A'}</p>
          <p><strong>Priority:</strong> ${data.priority || 'Medium'}</p>
          <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
      </div>
    `;
  }

  /**
   * Generate fallback text
   */
  generateFallbackText(data) {
    return `
      Notification
      Type: ${data.notification_type || 'Unknown'}
      Issue: #${data.issue_number || 'N/A'}
      Title: ${data.issue_title || 'N/A'}
      Priority: ${data.priority || 'Medium'}
      Timestamp: ${new Date().toLocaleString()}
    `;
  }

  // Default template methods
  getDefaultNotificationTemplate() {
    return `
      <div class="alert alert-info">
          <h2>{{title}}</h2>
          <p>{{summary}}</p>
          
          {{#if details}}
          <div class="info-grid">
              {{#each details}}
              <div class="info-item">
                  <div class="info-label">{{@key}}</div>
                  <div class="info-value">{{this}}</div>
              </div>
              {{/each}}
          </div>
          {{/if}}
          
          {{#if actions}}
          <div style="text-align: center; margin-top: 20px;">
              {{#each actions}}
              <a href="{{url}}" class="button">{{text}}</a>
              {{/each}}
          </div>
          {{/if}}
      </div>
    `;
  }

  getDefaultIssueCreatedTemplate() {
    return `
      <div class="alert alert-info">
          <h2>🚨 New Issue Created</h2>
          <p>A new issue has been created in the repository.</p>
          
          <div class="info-grid">
              <div class="info-item">
                  <div class="info-label">Issue Number</div>
                  <div class="info-value">#{{issue_number}}</div>
              </div>
              <div class="info-item">
                  <div class="info-label">Title</div>
                  <div class="info-value">{{title}}</div>
              </div>
              <div class="info-item">
                  <div class="info-label">Priority</div>
                  <div class="info-value">{{priority}}</div>
              </div>
              <div class="info-item">
                  <div class="info-label">Created By</div>
                  <div class="info-value">{{created_by}}</div>
              </div>
          </div>
          
          {{#if description}}
          <div style="margin: 20px 0;">
              <h3>Description</h3>
              <p>{{truncate description 200}}</p>
          </div>
          {{/if}}
          
          {{#if labels.length}}
          <div style="margin: 20px 0;">
              <h3>Labels</h3>
              <p>{{join labels}}</p>
          </div>
          {{/if}}
          
          <div style="text-align: center; margin-top: 20px;">
              <a href="{{html_url}}" class="button">View Issue</a>
              <a href="#" class="button">Assign to Me</a>
          </div>
      </div>
    `;
  }

  getDefaultIssueUpdatedTemplate() {
    return `
      <div class="alert alert-warning">
          <h2>🔄 Issue Updated</h2>
          <p>Issue #{{issue_number}} has been updated.</p>
          
          {{#if changes}}
          <div style="margin: 20px 0;">
              <h3>Changes Made</h3>
              <p>{{changes}}</p>
          </div>
          {{/if}}
          
          <div class="info-grid">
              <div class="info-item">
                  <div class="info-label">Updated By</div>
                  <div class="info-value">{{updated_by}}</div>
              </div>
              <div class="info-item">
                  <div class="info-label">Updated At</div>
                  <div class="info-value">{{formatDate updated_at 'long'}}</div>
              </div>
          </div>
          
          <div style="text-align: center; margin-top: 20px;">
              <a href="{{html_url}}" class="button">View Issue</a>
              <a href="#" class="button">View Changes</a>
          </div>
      </div>
    `;
  }

  getDefaultSecurityIssueTemplate() {
    return `
      <div class="alert alert-danger">
          <h2>🔒 Security Issue Detected</h2>
          <p>A security-related issue has been identified and requires immediate attention.</p>
          
          <div class="info-grid">
              <div class="info-item">
                  <div class="info-label">Issue Number</div>
                  <div class="info-value">#{{issue_number}}</div>
              </div>
              <div class="info-item">
                  <div class="info-label">Security Level</div>
                  <div class="info-value">{{security_level}}</div>
              </div>
              <div class="info-item">
                  <div class="info-label">Risk Assessment</div>
                  <div class="info-value">{{risk_assessment}}</div>
              </div>
          </div>
          
          {{#if recommended_actions.length}}
          <div style="margin: 20px 0;">
              <h3>Recommended Actions</h3>
              <ul>
                  {{#each recommended_actions}}
                  <li>{{this}}</li>
                  {{/each}}
              </ul>
          </div>
          {{/if}}
          
          <div style="text-align: center; margin-top: 20px;">
              <a href="{{html_url}}" class="button">View Issue</a>
              <a href="#" class="button">Security Review</a>
              <a href="#" class="button">Emergency Response</a>
          </div>
      </div>
    `;
  }

  getDefaultIssueEscalatedTemplate() {
    return `
      <div class="alert alert-danger">
          <h2>🚨 Issue Escalated</h2>
          <p>Issue #{{issue_number}} has been escalated and requires immediate attention.</p>
          
          <div class="info-grid">
              <div class="info-item">
                  <div class="info-label">Escalation Reason</div>
                  <div class="info-value">{{escalation_reason}}</div>
              </div>
              <div class="info-item">
                  <div class="info-label">Escalated By</div>
                  <div class="info-value">{{escalated_by}}</div>
              </div>
              <div class="info-item">
                  <div class="info-label">Priority</div>
                  <div class="info-value">{{priority}}</div>
              </div>
          </div>
          
          <div style="text-align: center; margin-top: 20px;">
              <a href="{{html_url}}" class="button">View Issue</a>
              <a href="#" class="button">Take Ownership</a>
              <a href="#" class="button">Request Help</a>
          </div>
      </div>
    `;
  }

  getDefaultIssueStaleTemplate() {
    return `
      <div class="alert alert-warning">
          <h2>⏰ Issue Requires Attention</h2>
          <p>Issue #{{issue_number}} has been inactive for {{days_since_update}} days.</p>
          
          <div class="info-grid">
              <div class="info-item">
                  <div class="info-label">Days Since Update</div>
                  <div class="info-value">{{days_since_update}}</div>
              </div>
              <div class="info-item">
                  <div class="info-label">Last Activity</div>
                  <div class="info-value">{{formatDate last_activity 'long'}}</div>
              </div>
              <div class="info-item">
                  <div class="info-label">Current Assignees</div>
                  <div class="info-value">{{join current_assignees}}</div>
              </div>
          </div>
          
          <div style="text-align: center; margin-top: 20px;">
              <a href="{{html_url}}" class="button">View Issue</a>
              <a href="#" class="button">Update Status</a>
              <a href="#" class="button">Reassign</a>
          </div>
      </div>
    `;
  }

  getDefaultIssueClosedTemplate() {
    return `
      <div class="alert alert-success">
          <h2>✅ Issue Resolved</h2>
          <p>Issue #{{issue_number}} has been successfully resolved and closed.</p>
          
          <div class="info-grid">
              <div class="info-item">
                  <div class="info-label">Closed At</div>
                  <div class="info-value">{{formatDate closed_at 'long'}}</div>
              </div>
              <div class="info-item">
                  <div class="info-label">Closed By</div>
                  <div class="info-value">{{closed_by}}</div>
              </div>
              <div class="info-item">
                  <div class="info-label">Resolution Time</div>
                  <div class="info-value">{{resolution_time}} days</div>
              </div>
          </div>
          
          <div style="text-align: center; margin-top: 20px;">
              <a href="{{html_url}}" class="button">View Issue</a>
              <a href="#" class="button">View Resolution</a>
          </div>
      </div>
    `;
  }

  getDefaultReviewFailedTemplate() {
    return `
      <div class="alert alert-danger">
          <h2>❌ Code Review Failed</h2>
          <p>The code review has failed and requires attention.</p>
          
          <div class="info-grid">
              <div class="info-item">
                  <div class="info-label">Files Reviewed</div>
                  <div class="info-value">{{files_reviewed}}</div>
              </div>
              <div class="info-item">
                  <div class="info-label">Issues Found</div>
                  <div class="info-value">{{issues_found}}</div>
              </div>
              <div class="info-item">
                  <div class="info-label">Review Score</div>
                  <div class="info-value">{{review_score}}%</div>
              </div>
          </div>
          
          {{#if issues.length}}
          <div style="margin: 20px 0;">
              <h3>Issues Found</h3>
              <ul>
                  {{#each issues}}
                  <li><strong>{{severity}}:</strong> {{description}}</li>
                  {{/each}}
              </ul>
          </div>
          {{/if}}
          
          <div style="text-align: center; margin-top: 20px;">
              <a href="{{review_url}}" class="button">View Review</a>
              <a href="#" class="button">Fix Issues</a>
          </div>
      </div>
    `;
  }

  getDefaultReviewPassedTemplate() {
    return `
      <div class="alert alert-success">
          <h2>✅ Code Review Passed</h2>
          <p>The code review has passed successfully!</p>
          
          <div class="info-grid">
              <div class="info-item">
                  <div class="info-label">Files Reviewed</div>
                  <div class="info-value">{{files_reviewed}}</div>
              </div>
              <div class="info-item">
                  <div class="info-label">Issues Found</div>
                  <div class="info-value">{{issues_found}}</div>
              </div>
              <div class="info-item">
                  <div class="info-label">Review Score</div>
                  <div class="info-value">{{review_score}}%</div>
              </div>
          </div>
          
          <div style="text-align: center; margin-top: 20px;">
              <a href="{{review_url}}" class="button">View Review</a>
              <a href="#" class="button">View Details</a>
          </div>
      </div>
    `;
  }
}

// Helper function for relative time
function getRelativeTime(date) {
  const now = new Date();
  const diff = now - date;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
}

module.exports = EmailTemplateManager;


