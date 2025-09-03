/**
 * Email Configuration Tester
 * 
 * Tests and validates email configuration, SMTP connections,
 * and template rendering without sending actual emails.
 * 
 * @author AI Code Review System
 * @version 1.0.0
 * @last_updated 2024-12-19
 */

const nodemailer = require('nodemailer');
const EmailTemplateManager = require('./email-template-manager');
const EmailTriggerManager = require('./email-trigger-manager');

class EmailConfigTester {
  constructor(config = {}) {
    this.config = config;
    this.testResults = new Map();
    this.testStats = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0
    };
    
    // Initialize managers
    this.templateManager = new EmailTemplateManager(config);
    this.triggerManager = new EmailTriggerManager(config);
  }

  /**
   * Run all email configuration tests
   */
  async runAllTests() {
    console.log('🧪 Starting Email Configuration Tests...\n');
    
    try {
      // Test SMTP configuration
      await this.testSMTPConfiguration();
      
      // Test email templates
      await this.testEmailTemplates();
      
      // Test email triggers
      await this.testEmailTriggers();
      
      // Test recipient configuration
      await this.testRecipientConfiguration();
      
      // Test general settings
      await this.testGeneralSettings();
      
      // Test integration
      await this.testIntegration();
      
      // Generate test report
      const report = this.generateTestReport();
      
      console.log('\n📊 Test Results Summary:');
      console.log(`Total Tests: ${this.testStats.total}`);
      console.log(`Passed: ${this.testStats.passed}`);
      console.log(`Failed: ${this.testStats.failed}`);
      console.log(`Skipped: ${this.testStats.skipped}`);
      
      return report;
      
    } catch (error) {
      console.error('❌ Error running email configuration tests:', error.message);
      throw error;
    }
  }

  /**
   * Test SMTP configuration
   */
  async testSMTPConfiguration() {
    console.log('📧 Testing SMTP Configuration...');
    
    const tests = [
      {
        name: 'smtp_config_exists',
        description: 'SMTP configuration exists',
        test: () => this.testSMTPConfigExists()
      },
      {
        name: 'smtp_required_fields',
        description: 'SMTP required fields are present',
        test: () => this.testSMTPRequiredFields()
      },
      {
        name: 'smtp_connection',
        description: 'SMTP connection can be established',
        test: () => this.testSMTPConnection()
      },
      {
        name: 'smtp_authentication',
        description: 'SMTP authentication works',
        test: () => this.testSMTPAuthentication()
      }
    ];

    await this.runTestSuite('SMTP Configuration', tests);
  }

  /**
   * Test email templates
   */
  async testEmailTemplates() {
    console.log('📝 Testing Email Templates...');
    
    const tests = [
      {
        name: 'template_manager_initialized',
        description: 'Email template manager is initialized',
        test: () => this.testTemplateManagerInitialized()
      },
      {
        name: 'default_templates_exist',
        description: 'Default email templates exist',
        test: () => this.testDefaultTemplatesExist()
      },
      {
        name: 'template_rendering',
        description: 'Templates can be rendered',
        test: () => this.testTemplateRendering()
      },
      {
        name: 'template_html_generation',
        description: 'HTML email generation works',
        test: () => this.testTemplateHTMLGeneration()
      },
      {
        name: 'template_text_generation',
        description: 'Plain text email generation works',
        test: () => this.testTemplateTextGeneration()
      }
    ];

    await this.runTestSuite('Email Templates', tests);
  }

  /**
   * Test email triggers
   */
  async testEmailTriggers() {
    console.log('🔔 Testing Email Triggers...');
    
    const tests = [
      {
        name: 'trigger_manager_initialized',
        description: 'Email trigger manager is initialized',
        test: () => this.testTriggerManagerInitialized()
      },
      {
        name: 'default_triggers_exist',
        description: 'Default email triggers exist',
        test: () => this.testDefaultTriggersExist()
      },
      {
        name: 'trigger_conditions',
        description: 'Trigger conditions can be evaluated',
        test: () => this.testTriggerConditions()
      },
      {
        name: 'trigger_scheduling',
        description: 'Trigger scheduling works',
        test: () => this.testTriggerScheduling()
      }
    ];

    await this.runTestSuite('Email Triggers', tests);
  }

  /**
   * Test recipient configuration
   */
  async testRecipientConfiguration() {
    console.log('👥 Testing Recipient Configuration...');
    
    const tests = [
      {
        name: 'recipients_configured',
        description: 'Email recipients are configured',
        test: () => this.testRecipientsConfigured()
      },
      {
        name: 'recipient_email_format',
        description: 'Recipient email formats are valid',
        test: () => this.testRecipientEmailFormat()
      },
      {
        name: 'recipient_roles',
        description: 'Recipient roles are properly set',
        test: () => this.testRecipientRoles()
      }
    ];

    await this.runTestSuite('Recipient Configuration', tests);
  }

  /**
   * Test general settings
   */
  async testGeneralSettings() {
    console.log('⚙️  Testing General Settings...');
    
    const tests = [
      {
        name: 'email_enabled',
        description: 'Email notifications are enabled',
        test: () => this.testEmailEnabled()
      },
      {
        name: 'subject_prefix',
        description: 'Email subject prefix is configured',
        test: () => this.testSubjectPrefix()
      },
      {
        name: 'email_formats',
        description: 'Email formats are properly configured',
        test: () => this.testEmailFormats()
      }
    ];

    await this.runTestSuite('General Settings', tests);
  }

  /**
   * Test integration
   */
  async testIntegration() {
    console.log('🔗 Testing Integration...');
    
    const tests = [
      {
        name: 'template_trigger_integration',
        description: 'Templates and triggers work together',
        test: () => this.testTemplateTriggerIntegration()
      },
      {
        name: 'end_to_end_flow',
        description: 'End-to-end email flow works',
        test: () => this.testEndToEndFlow()
      }
    ];

    await this.runTestSuite('Integration', tests);
  }

  /**
   * Run a test suite
   */
  async runTestSuite(suiteName, tests) {
    console.log(`\n  📋 ${suiteName}:`);
    
    for (const testCase of tests) {
      await this.runTestCase(suiteName, testCase);
    }
  }

  /**
   * Run a single test case
   */
  async runTestCase(suiteName, testCase) {
    this.testStats.total++;
    
    try {
      console.log(`    🧪 ${testCase.description}...`);
      
      const result = await testCase.test();
      
      if (result.passed) {
        this.testStats.passed++;
        console.log(`      ✅ ${chalk.green('PASSED')}`);
        this.testResults.set(`${suiteName}.${testCase.name}`, {
          passed: true,
          result: result.result,
          error: null
        });
      } else {
        this.testStats.failed++;
        console.log(`      ❌ ${chalk.red('FAILED')}: ${result.error}`);
        this.testResults.set(`${suiteName}.${testCase.name}`, {
          passed: false,
          result: null,
          error: result.error
        });
      }
      
    } catch (error) {
      this.testStats.failed++;
      console.log(`      ❌ ${chalk.red('ERROR')}: ${error.message}`);
      this.testResults.set(`${suiteName}.${testCase.name}`, {
        passed: false,
        result: null,
        error: error.message
      });
    }
  }

  // SMTP Test Methods
  
  /**
   * Test if SMTP configuration exists
   */
  testSMTPConfigExists() {
    const smtpConfig = this.config.smtp;
    
    if (!smtpConfig) {
      return { passed: false, error: 'SMTP configuration is missing' };
    }
    
    return { passed: true, result: 'SMTP configuration found' };
  }

  /**
   * Test if SMTP required fields are present
   */
  testSMTPRequiredFields() {
    const smtpConfig = this.config.smtp;
    const requiredFields = ['host', 'port', 'user', 'pass'];
    const missingFields = [];
    
    for (const field of requiredFields) {
      if (!smtpConfig[field]) {
        missingFields.push(field);
      }
    }
    
    if (missingFields.length > 0) {
      return { 
        passed: false, 
        error: `Missing required SMTP fields: ${missingFields.join(', ')}` 
      };
    }
    
    return { passed: true, result: 'All required SMTP fields are present' };
  }

  /**
   * Test SMTP connection
   */
  async testSMTPConnection() {
    try {
      const smtpConfig = this.config.smtp;
      
      const transporter = nodemailer.createTransporter({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: {
          user: smtpConfig.user,
          pass: smtpConfig.pass
        }
      });
      
      // Verify connection configuration
      await transporter.verify();
      
      return { passed: true, result: 'SMTP connection verified successfully' };
      
    } catch (error) {
      return { passed: false, error: `SMTP connection failed: ${error.message}` };
    }
  }

  /**
   * Test SMTP authentication
   */
  async testSMTPAuthentication() {
    try {
      const smtpConfig = this.config.smtp;
      
      const transporter = nodemailer.createTransporter({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: {
          user: smtpConfig.user,
          pass: smtpConfig.pass
        }
      });
      
      // Test authentication by trying to send a test email (but don't actually send it)
      const testMessage = {
        from: smtpConfig.from_email || smtpConfig.user,
        to: 'test@example.com',
        subject: 'Test Email',
        text: 'This is a test email'
      };
      
      // This will test authentication without sending
      await transporter.verify();
      
      return { passed: true, result: 'SMTP authentication successful' };
      
    } catch (error) {
      return { passed: false, error: `SMTP authentication failed: ${error.message}` };
    }
  }

  // Template Test Methods
  
  /**
   * Test if template manager is initialized
   */
  testTemplateManagerInitialized() {
    if (!this.templateManager) {
      return { passed: false, error: 'Template manager is not initialized' };
    }
    
    return { passed: true, result: 'Template manager initialized successfully' };
  }

  /**
   * Test if default templates exist
   */
  testDefaultTemplatesExist() {
    const requiredTemplates = [
      'notification', 'issue_created', 'issue_updated', 
      'security_issue', 'review_failed', 'review_passed'
    ];
    
    const missingTemplates = [];
    
    for (const templateName of requiredTemplates) {
      if (!this.templateManager.getTemplate(templateName)) {
        missingTemplates.push(templateName);
      }
    }
    
    if (missingTemplates.length > 0) {
      return { 
        passed: false, 
        error: `Missing required templates: ${missingTemplates.join(', ')}` 
      };
    }
    
    return { passed: true, result: 'All required templates are present' };
  }

  /**
   * Test template rendering
   */
  testTemplateRendering() {
    try {
      const testData = {
        issue_number: 123,
        issue_title: 'Test Issue',
        priority: 'high',
        created_by: 'testuser'
      };
      
      const result = this.templateManager.renderTemplate('issue_created', testData);
      
      if (!result.html || !result.text || !result.subject) {
        return { passed: false, error: 'Template rendering incomplete' };
      }
      
      return { passed: true, result: 'Template rendering successful' };
      
    } catch (error) {
      return { passed: false, error: `Template rendering failed: ${error.message}` };
    }
  }

  /**
   * Test HTML email generation
   */
  testTemplateHTMLGeneration() {
    try {
      const testData = {
        issue_number: 123,
        issue_title: 'Test Issue'
      };
      
      const result = this.templateManager.renderTemplate('notification', testData);
      
      if (!result.html || !result.html.includes('<html>')) {
        return { passed: false, error: 'HTML generation failed' };
      }
      
      return { passed: true, result: 'HTML generation successful' };
      
    } catch (error) {
      return { passed: false, error: `HTML generation failed: ${error.message}` };
    }
  }

  /**
   * Test plain text email generation
   */
  testTemplateTextGeneration() {
    try {
      const testData = {
        issue_number: 123,
        issue_title: 'Test Issue'
      };
      
      const result = this.templateManager.renderTemplate('notification', testData);
      
      if (!result.text || result.text.includes('<html>')) {
        return { passed: false, error: 'Text generation failed' };
      }
      
      return { passed: true, result: 'Text generation successful' };
      
    } catch (error) {
      return { passed: false, error: `Text generation failed: ${error.message}` };
    }
  }

  // Trigger Test Methods
  
  /**
   * Test if trigger manager is initialized
   */
  testTriggerManagerInitialized() {
    if (!this.triggerManager) {
      return { passed: false, error: 'Trigger manager is not initialized' };
    }
    
    return { passed: true, result: 'Trigger manager initialized successfully' };
  }

  /**
   * Test if default triggers exist
   */
  testDefaultTriggersExist() {
    const requiredTriggers = ['review_failed', 'security_issue'];
    
    const missingTriggers = [];
    
    for (const triggerName of requiredTriggers) {
      if (!this.triggerManager.triggerConfig.triggers[triggerName]) {
        missingTriggers.push(triggerName);
      }
    }
    
    if (missingTriggers.length > 0) {
      return { 
        passed: false, 
        error: `Missing required triggers: ${missingTriggers.join(', ')}` 
      };
    }
    
    return { passed: true, result: 'All required triggers are present' };
  }

  /**
   * Test trigger conditions
   */
  testTriggerConditions() {
    try {
      const testData = {
        priority: 'high',
        severity: 'critical',
        files_reviewed: 5,
        issues_found: 3
      };
      
      const trigger = this.triggerManager.triggerConfig.triggers.review_failed;
      const shouldExecute = this.triggerManager.shouldExecuteTrigger(trigger, testData);
      
      return { 
        passed: true, 
        result: `Trigger condition evaluation: ${shouldExecute ? 'would execute' : 'would not execute'}` 
      };
      
    } catch (error) {
      return { passed: false, error: `Trigger condition test failed: ${error.message}` };
    }
  }

  /**
   * Test trigger scheduling
   */
  testTriggerScheduling() {
    try {
      const trigger = this.triggerManager.triggerConfig.triggers.review_failed;
      const scheduling = this.triggerManager.triggerConfig.scheduling.review_failed;
      
      if (!scheduling) {
        return { passed: false, error: 'Trigger scheduling not configured' };
      }
      
      return { passed: true, result: 'Trigger scheduling configuration valid' };
      
    } catch (error) {
      return { passed: false, error: `Trigger scheduling test failed: ${error.message}` };
    }
  }

  // Recipient Test Methods
  
  /**
   * Test if recipients are configured
   */
  testRecipientsConfigured() {
    const recipients = this.config.to_emails || [];
    
    if (recipients.length === 0) {
      return { passed: false, error: 'No email recipients configured' };
    }
    
    return { passed: true, result: `${recipients.length} recipients configured` };
  }

  /**
   * Test recipient email format
   */
  testRecipientEmailFormat() {
    const recipients = this.config.to_emails || [];
    const invalidEmails = [];
    
    for (const recipient of recipients) {
      if (!this.isValidEmail(recipient.email)) {
        invalidEmails.push(recipient.email);
      }
    }
    
    if (invalidEmails.length > 0) {
      return { 
        passed: false, 
        error: `Invalid email formats: ${invalidEmails.join(', ')}` 
      };
    }
    
    return { passed: true, result: 'All recipient email formats are valid' };
  }

  /**
   * Test recipient roles
   */
  testRecipientRoles() {
    const recipients = this.config.to_emails || [];
    const validRoles = ['developer', 'team_lead', 'manager', 'security', 'other'];
    const invalidRoles = [];
    
    for (const recipient of recipients) {
      if (recipient.role && !validRoles.includes(recipient.role)) {
        invalidRoles.push(`${recipient.email}: ${recipient.role}`);
      }
    }
    
    if (invalidRoles.length > 0) {
      return { 
        passed: false, 
        error: `Invalid recipient roles: ${invalidRoles.join(', ')}` 
      };
    }
    
    return { passed: true, result: 'All recipient roles are valid' };
  }

  // General Settings Test Methods
  
  /**
   * Test if email is enabled
   */
  testEmailEnabled() {
    const enabled = this.config.general?.enabled !== false;
    
    if (!enabled) {
      return { passed: false, error: 'Email notifications are disabled' };
    }
    
    return { passed: true, result: 'Email notifications are enabled' };
  }

  /**
   * Test subject prefix
   */
  testSubjectPrefix() {
    const prefix = this.config.general?.subject_prefix;
    
    if (!prefix) {
      return { passed: false, error: 'Email subject prefix not configured' };
    }
    
    return { passed: true, result: `Subject prefix: ${prefix}` };
  }

  /**
   * Test email formats
   */
  testEmailFormats() {
    const htmlEnabled = this.config.general?.html_emails !== false;
    const textEnabled = this.config.general?.text_emails !== false;
    
    if (!htmlEnabled && !textEnabled) {
      return { passed: false, error: 'No email formats enabled' };
    }
    
    const formats = [];
    if (htmlEnabled) formats.push('HTML');
    if (textEnabled) formats.push('Plain Text');
    
    return { passed: true, result: `Email formats enabled: ${formats.join(', ')}` };
  }

  // Integration Test Methods
  
  /**
   * Test template and trigger integration
   */
  testTemplateTriggerIntegration() {
    try {
      const trigger = this.triggerManager.triggerConfig.triggers.review_failed;
      const template = this.templateManager.getTemplate(trigger.template);
      
      if (!template) {
        return { passed: false, error: 'Trigger template not found' };
      }
      
      return { passed: true, result: 'Template and trigger integration working' };
      
    } catch (error) {
      return { passed: false, error: `Integration test failed: ${error.message}` };
    }
  }

  /**
   * Test end-to-end email flow
   */
  testEndToEndFlow() {
    try {
      // Simulate a review failure event
      const testData = {
        event_type: 'review_failed',
        priority: 'high',
        files_reviewed: 3,
        issues_found: 2,
        review_score: 65
      };
      
      // Check if trigger would execute
      const trigger = this.triggerManager.triggerConfig.triggers.review_failed;
      const shouldExecute = this.triggerManager.shouldExecuteTrigger(trigger, testData);
      
      if (!shouldExecute) {
        return { passed: false, error: 'Trigger would not execute for test data' };
      }
      
      // Check if template can render
      const template = this.templateManager.getTemplate(trigger.template);
      const rendered = this.templateManager.renderTemplate(trigger.template, testData);
      
      if (!rendered.html || !rendered.text) {
        return { passed: false, error: 'Template rendering failed in end-to-end test' };
      }
      
      return { passed: true, result: 'End-to-end email flow working correctly' };
      
    } catch (error) {
      return { passed: false, error: `End-to-end test failed: ${error.message}` };
    }
  }

  // Utility Methods
  
  /**
   * Validate email format
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Generate test report
   */
  generateTestReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.testStats.total,
        passed: this.testStats.passed,
        failed: this.testStats.failed,
        skipped: this.testStats.skipped,
        success_rate: this.testStats.total > 0 ? 
          (this.testStats.passed / this.testStats.total) * 100 : 0
      },
      results: Object.fromEntries(this.testResults),
      recommendations: this.generateRecommendations()
    };
    
    return report;
  }

  /**
   * Generate recommendations based on test results
   */
  generateRecommendations() {
    const recommendations = [];
    
    // Check for critical failures
    const criticalTests = [
      'SMTP Configuration.smtp_config_exists',
      'SMTP Configuration.smtp_required_fields',
      'Recipient Configuration.recipients_configured'
    ];
    
    for (const testName of criticalTests) {
      const result = this.testResults.get(testName);
      if (result && !result.passed) {
        recommendations.push(`Critical: Fix ${testName} - ${result.error}`);
      }
    }
    
    // Check for common issues
    if (this.testStats.failed > 0) {
      recommendations.push(`Review ${this.testStats.failed} failed tests and fix issues`);
    }
    
    if (this.testStats.passed === this.testStats.total) {
      recommendations.push('All tests passed! Email configuration is ready for use.');
    }
    
    return recommendations;
  }

  /**
   * Export test results
   */
  exportTestResults(format = 'json') {
    const report = this.generateTestReport();
    
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(report, null, 2);
      case 'csv':
        return this.convertToCSV(report);
      case 'html':
        return this.convertToHTML(report);
      default:
        return JSON.stringify(report, null, 2);
    }
  }

  /**
   * Convert report to CSV
   */
  convertToCSV(report) {
    const csvRows = [
      ['Test Name', 'Status', 'Result', 'Error'],
      ['---', '---', '---', '---']
    ];
    
    for (const [testName, result] of Object.entries(report.results)) {
      csvRows.push([
        testName,
        result.passed ? 'PASSED' : 'FAILED',
        result.result || 'N/A',
        result.error || 'N/A'
      ]);
    }
    
    return csvRows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  }

  /**
   * Convert report to HTML
   */
  convertToHTML(report) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <title>Email Configuration Test Report</title>
          <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
              .summary { margin: 20px 0; }
              .test-result { margin: 10px 0; padding: 10px; border-radius: 3px; }
              .passed { background: #d4edda; border-left: 4px solid #28a745; }
              .failed { background: #f8d7da; border-left: 4px solid #dc3545; }
              .recommendations { background: #fff3cd; padding: 15px; border-radius: 5px; }
          </style>
      </head>
      <body>
          <div class="header">
              <h1>Email Configuration Test Report</h1>
              <p>Generated: ${new Date(report.timestamp).toLocaleString()}</p>
          </div>
          
          <div class="summary">
              <h2>Test Summary</h2>
              <p>Total Tests: ${report.summary.total}</p>
              <p>Passed: ${report.summary.passed}</p>
              <p>Failed: ${report.summary.failed}</p>
              <p>Success Rate: ${report.summary.success_rate.toFixed(1)}%</p>
          </div>
          
          <h2>Test Results</h2>
          ${Object.entries(report.results).map(([testName, result]) => `
              <div class="test-result ${result.passed ? 'passed' : 'failed'}">
                  <strong>${testName}</strong>: ${result.passed ? 'PASSED' : 'FAILED'}<br>
                  ${result.result ? `Result: ${result.result}<br>` : ''}
                  ${result.error ? `Error: ${result.error}` : ''}
              </div>
          `).join('')}
          
          <div class="recommendations">
              <h2>Recommendations</h2>
              <ul>
                  ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
              </ul>
          </div>
      </body>
      </html>
    `;
  }
}

module.exports = EmailConfigTester;


