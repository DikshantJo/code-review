const nodemailer = require('nodemailer');

/**
 * Email notification utility for AI Code Review system
 * Handles service downtime notifications and other alerts
 */
class EmailNotifier {
  constructor(config = {}) {
    this.config = config;
    this.transporter = null;
    
    // Check if email notifications are enabled via config OR environment variables
    this.isEnabled = config?.notifications?.email?.enabled || 
                    (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
    
    console.log(`📧 EmailNotifier initialization:`);
    console.log(`   Config enabled: ${config?.notifications?.email?.enabled}`);
    console.log(`   SMTP_HOST: ${process.env.SMTP_HOST ? '✅ Set' : '❌ Not set'}`);
    console.log(`   SMTP_USER: ${process.env.SMTP_USER ? '✅ Set' : '❌ Not set'}`);
    console.log(`   SMTP_PASS: ${process.env.SMTP_PASS ? '✅ Set' : '❌ Not set'}`);
    console.log(`   Final isEnabled: ${this.isEnabled}`);
    
    if (this.isEnabled) {
      this.initializeTransporter();
      console.log('✅ EmailNotifier transporter initialized successfully');
    } else {
      console.log('❌ EmailNotifier disabled - missing configuration');
    }
  }

  /**
   * Initialize SMTP transporter
   */
  initializeTransporter() {
    // Use config first, then fall back to environment variables
    const emailConfig = this.config.notifications?.email || {};
    
    const smtpHost = emailConfig.smtp_host || process.env.SMTP_HOST;
    const smtpUser = emailConfig.smtp_user || process.env.SMTP_USER;
    const smtpPass = emailConfig.smtp_pass || process.env.SMTP_PASS;
    const smtpPort = emailConfig.smtp_port || process.env.SMTP_PORT || 587;
    const smtpSecure = emailConfig.smtp_secure || (process.env.SMTP_SECURE === 'true');
    
    if (!smtpHost || !smtpUser || !smtpPass) {
      throw new Error('SMTP configuration incomplete. Required: smtp_host, smtp_user, smtp_pass (via config or environment variables)');
    }

    this.transporter = nodemailer.createTransporter({
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });
  }

  /**
   * Send AI service downtime notification
   * @param {Object} context - Review context information
   * @param {Error} error - The error that occurred
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Email send result
   */
  async sendServiceDowntimeNotification(context, error, options = {}) {
    if (!this.isEnabled) {
      console.log('Email notifications disabled, skipping downtime notification');
      return { sent: false, reason: 'disabled' };
    }

    const subject = `[AI Code Review] Service Downtime Alert - ${context.repository}`;
    
    const body = this.formatDowntimeEmail(context, error, options);
    
    return this.sendEmail(subject, body, 'downtime');
  }

  /**
   * Send review failure notification
   * @param {Object} context - Review context information
   * @param {Object} reviewResult - AI review results
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Email send result
   */
  async sendReviewFailureNotification(context, reviewResult, options = {}) {
    if (!this.isEnabled) {
      console.log('Email notifications disabled, skipping review failure notification');
      return { sent: false, reason: 'disabled' };
    }

    const subject = `[AI Code Review] Review Failed - ${context.repository} (${context.targetBranch})`;
    
    const body = this.formatReviewFailureEmail(context, reviewResult, options);
    
    return this.sendEmail(subject, body, 'review_failure');
  }

  /**
   * Send quality gate override notification
   * @param {Object} context - Review context information
   * @param {Object} overrideInfo - Override details
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Email send result
   */
  async sendOverrideNotification(context, overrideInfo, options = {}) {
    if (!this.isEnabled) {
      console.log('Email notifications disabled, skipping override notification');
      return { sent: false, reason: 'disabled' };
    }

    const subject = `[AI Code Review] Quality Gate Override - ${context.repository} (${context.targetBranch})`;
    
    const body = this.formatOverrideEmail(context, overrideInfo, options);
    
    return this.sendEmail(subject, body, 'override');
  }

  /**
   * Send generic email
   * @param {string} subject - Email subject
   * @param {string} body - Email body (HTML)
   * @param {string} type - Email type for tracking
   * @returns {Promise<Object>} Email send result
   */
  async sendEmail(subject, body, type = 'generic') {
    try {
      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }

      const emailConfig = this.config.notifications.email;
      
      const mailOptions = {
        from: emailConfig.from_email || 'ai-review@github.com',
        to: emailConfig.to_emails.join(', '),
        subject: subject,
        html: body,
        headers: {
          'X-Email-Type': type,
          'X-Repository': this.config.repository || 'unknown'
        }
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      console.log(`Email notification sent successfully: ${type}`, {
        messageId: result.messageId,
        to: mailOptions.to
      });

      return {
        sent: true,
        messageId: result.messageId,
        type: type
      };

    } catch (error) {
      console.error('Failed to send email notification:', error);
      
      return {
        sent: false,
        error: error.message,
        type: type
      };
    }
  }

  /**
   * Format downtime notification email
   * @param {Object} context - Review context
   * @param {Error} error - The error
   * @param {Object} options - Additional options
   * @returns {string} Formatted HTML email body
   */
  formatDowntimeEmail(context, error, options = {}) {
    const timestamp = new Date().toISOString();
    const retryCount = options.retryCount || 0;
    const maxRetries = options.maxRetries || 3;

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d73a49;">🚨 AI Code Review Service Downtime Alert</h2>
        
        <div style="background-color: #f6f8fa; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <h3>Service Status</h3>
          <p><strong>Status:</strong> <span style="color: #d73a49;">DOWN</span></p>
          <p><strong>Time:</strong> ${timestamp}</p>
          <p><strong>Retry Attempt:</strong> ${retryCount}/${maxRetries}</p>
        </div>

        <div style="background-color: #f6f8fa; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <h3>Repository Information</h3>
          <p><strong>Repository:</strong> ${context.repository}</p>
          <p><strong>Branch:</strong> ${context.sourceBranch} → ${context.targetBranch}</p>
          <p><strong>Commit:</strong> ${context.commitSha}</p>
          <p><strong>Author:</strong> ${context.author}</p>
        </div>

        <div style="background-color: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <h3>Error Details</h3>
          <p><strong>Error Type:</strong> ${error.name}</p>
          <p><strong>Error Message:</strong> ${error.message}</p>
          ${error.stack ? `<pre style="background-color: #f8f9fa; padding: 10px; border-radius: 4px; overflow-x: auto;">${error.stack}</pre>` : ''}
        </div>

        <div style="background-color: #d1ecf1; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <h3>Impact</h3>
          <ul>
            <li>Code reviews are currently unavailable</li>
            <li>Commits may proceed without AI review</li>
            <li>Manual review is recommended for critical changes</li>
          </ul>
        </div>

        <div style="background-color: #d4edda; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <h3>Next Steps</h3>
          <ul>
            <li>Check OpenAI API status and credentials</li>
            <li>Verify network connectivity</li>
            <li>Review system logs for additional details</li>
            <li>Consider manual code review for this commit</li>
          </ul>
        </div>

        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e1e4e8;">
        <p style="color: #586069; font-size: 12px;">
          This is an automated notification from the AI Code Review system.<br>
          Repository: ${context.repository} | Branch: ${context.targetBranch}
        </p>
      </div>
    `;
  }

  /**
   * Format review failure notification email
   * @param {Object} context - Review context
   * @param {Object} reviewResult - AI review results
   * @param {Object} options - Additional options
   * @returns {string} Formatted HTML email body
   */
  formatReviewFailureEmail(context, reviewResult, options = {}) {
    const timestamp = new Date().toISOString();
    const issueCount = reviewResult.issues?.length || 0;
    const highSeverityCount = reviewResult.issues?.filter(issue => issue.severity === 'HIGH').length || 0;

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d73a49;">⚠️ AI Code Review Failed</h2>
        
        <div style="background-color: #f6f8fa; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <h3>Review Summary</h3>
          <p><strong>Status:</strong> <span style="color: #d73a49;">FAILED</span></p>
          <p><strong>Time:</strong> ${timestamp}</p>
          <p><strong>Total Issues:</strong> ${issueCount}</p>
          <p><strong>High Severity:</strong> ${highSeverityCount}</p>
        </div>

        <div style="background-color: #f6f8fa; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <h3>Repository Information</h3>
          <p><strong>Repository:</strong> ${context.repository}</p>
          <p><strong>Branch:</strong> ${context.sourceBranch} → ${context.targetBranch}</p>
          <p><strong>Commit:</strong> ${context.commitSha}</p>
          <p><strong>Author:</strong> ${context.author}</p>
        </div>

        ${reviewResult.issues && reviewResult.issues.length > 0 ? `
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <h3>Issues Found (${reviewResult.issues.length})</h3>
            ${reviewResult.issues.map(issue => `
              <div style="border-left: 4px solid ${issue.severity === 'HIGH' ? '#d73a49' : issue.severity === 'MEDIUM' ? '#f6a434' : '#28a745'}; padding-left: 15px; margin: 10px 0;">
                <p><strong>${issue.severity}</strong> - ${issue.category}</p>
                <p><strong>File:</strong> ${issue.file}</p>
                <p><strong>Line:</strong> ${issue.line || 'N/A'}</p>
                <p><strong>Description:</strong> ${issue.description}</p>
                ${issue.recommendation ? `<p><strong>Recommendation:</strong> ${issue.recommendation}</p>` : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}

        <div style="background-color: #d1ecf1; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <h3>Next Steps</h3>
          <ul>
            <li>Review the issues identified by the AI</li>
            <li>Address high severity issues before merging</li>
            <li>Check the GitHub issue created for detailed information</li>
            <li>Consider manual review for complex changes</li>
          </ul>
        </div>

        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e1e4e8;">
        <p style="color: #586069; font-size: 12px;">
          This is an automated notification from the AI Code Review system.<br>
          Repository: ${context.repository} | Branch: ${context.targetBranch}
        </p>
      </div>
    `;
  }

  /**
   * Format override notification email
   * @param {Object} context - Review context
   * @param {Object} overrideInfo - Override details
   * @param {Object} options - Additional options
   * @returns {string} Formatted HTML email body
   */
  formatOverrideEmail(context, overrideInfo, options = {}) {
    const timestamp = new Date().toISOString();

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f6a434;">🚨 Quality Gate Override Used</h2>
        
        <div style="background-color: #f6f8fa; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <h3>Override Details</h3>
          <p><strong>Status:</strong> <span style="color: #f6a434;">OVERRIDE APPROVED</span></p>
          <p><strong>Time:</strong> ${timestamp}</p>
          <p><strong>Override Type:</strong> ${overrideInfo.type}</p>
          <p><strong>Override Count:</strong> ${overrideInfo.count || 1}</p>
        </div>

        <div style="background-color: #f6f8fa; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <h3>Repository Information</h3>
          <p><strong>Repository:</strong> ${context.repository}</p>
          <p><strong>Branch:</strong> ${context.sourceBranch} → ${context.targetBranch}</p>
          <p><strong>Commit:</strong> ${context.commitSha}</p>
          <p><strong>Author:</strong> ${context.author}</p>
        </div>

        <div style="background-color: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <h3>Issues Overridden</h3>
          <p><strong>High Severity Issues:</strong> ${overrideInfo.highSeverityCount || 0}</p>
          <p><strong>Medium Severity Issues:</strong> ${overrideInfo.mediumSeverityCount || 0}</p>
          <p><strong>Total Issues:</strong> ${overrideInfo.totalIssues || 0}</p>
        </div>

        <div style="background-color: #d1ecf1; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <h3>Override Justification</h3>
          <p><strong>Commit Message:</strong> ${overrideInfo.commitMessage || 'N/A'}</p>
          <p><strong>Override Keyword:</strong> ${overrideInfo.keyword || 'N/A'}</p>
          <p><strong>Reason:</strong> ${overrideInfo.reason || 'Emergency override'}</p>
        </div>

        <div style="background-color: #d4edda; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <h3>Action Required</h3>
          <ul>
            <li>Review the overridden issues manually</li>
            <li>Ensure the override was justified</li>
            <li>Monitor for any production issues</li>
            <li>Consider implementing fixes in a follow-up commit</li>
          </ul>
        </div>

        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e1e4e8;">
        <p style="color: #586069; font-size: 12px;">
          This is an automated notification from the AI Code Review system.<br>
          Repository: ${context.repository} | Branch: ${context.targetBranch}
        </p>
      </div>
    `;
  }

  /**
   * Test email configuration
   * @returns {Promise<Object>} Test result
   */
  async testConfiguration() {
    if (!this.isEnabled) {
      return { success: false, error: 'Email notifications are disabled' };
    }

    try {
      const testSubject = '[AI Code Review] Configuration Test';
      const testBody = `
        <div style="font-family: Arial, sans-serif;">
          <h2>Email Configuration Test</h2>
          <p>This is a test email to verify the AI Code Review email notification system is working correctly.</p>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
          <p><strong>Repository:</strong> ${this.config.repository || 'Test'}</p>
        </div>
      `;

      const result = await this.sendEmail(testSubject, testBody, 'test');
      
      return {
        success: result.sent,
        messageId: result.messageId,
        error: result.error
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get email notification status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      enabled: this.isEnabled,
      configured: !!this.transporter,
      smtpHost: this.isEnabled ? this.config.notifications.email.smtp_host : null,
      recipientCount: this.isEnabled ? this.config.notifications.email.to_emails.length : 0
    };
  }
}

module.exports = EmailNotifier;



