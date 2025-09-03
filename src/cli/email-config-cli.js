#!/usr/bin/env node

/**
 * Email Configuration CLI Tool
 * 
 * Command-line interface for managing email configuration,
 * templates, triggers, and settings in the AI Code Review system.
 * 
 * @author AI Code Review System
 * @version 1.0.0
 * @last_updated 2024-12-19
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const yaml = require('js-yaml');
const chalk = require('chalk');
const inquirer = require('inquirer');

class EmailConfigCLI {
  constructor() {
    this.configPath = './config/email-config.yml';
    this.templatePath = './templates/email';
    this.config = {};
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  /**
   * Main CLI entry point
   */
  async run() {
    try {
      console.log(chalk.blue.bold('📧 AI Code Review - Email Configuration CLI\n'));
      
      // Load existing configuration
      await this.loadConfiguration();
      
      // Show main menu
      await this.showMainMenu();
      
    } catch (error) {
      console.error(chalk.red('❌ CLI Error:'), error.message);
      process.exit(1);
    } finally {
      this.rl.close();
    }
  }

  /**
   * Load configuration from file
   */
  async loadConfiguration() {
    try {
      if (fs.existsSync(this.configPath)) {
        const configContent = fs.readFileSync(this.configPath, 'utf8');
        this.config = yaml.load(configContent);
        console.log(chalk.green('✅ Configuration loaded from:', this.configPath));
      } else {
        console.log(chalk.yellow('⚠️  No configuration file found, using defaults'));
        this.config = this.getDefaultConfig();
      }
    } catch (error) {
      console.error(chalk.red('❌ Error loading configuration:'), error.message);
      this.config = this.getDefaultConfig();
    }
  }

  /**
   * Save configuration to file
   */
  async saveConfiguration() {
    try {
      // Ensure directory exists
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      const configContent = yaml.dump(this.config, { 
        indent: 2, 
        lineWidth: 120,
        noRefs: true 
      });
      
      fs.writeFileSync(this.configPath, configContent, 'utf8');
      console.log(chalk.green('✅ Configuration saved to:', this.configPath));
      
    } catch (error) {
      console.error(chalk.red('❌ Error saving configuration:'), error.message);
      throw error;
    }
  }

  /**
   * Show main menu
   */
  async showMainMenu() {
    const choices = [
      { name: '📧 Configure SMTP Settings', value: 'smtp' },
      { name: '👥 Configure Recipients', value: 'recipients' },
      { name: '📝 Manage Email Templates', value: 'templates' },
      { name: '🔔 Configure Email Triggers', value: 'triggers' },
      { name: '⚙️  General Settings', value: 'general' },
      { name: '🧪 Test Email Configuration', value: 'test' },
      { name: '📊 Show Configuration Status', value: 'status' },
      { name: '💾 Save Configuration', value: 'save' },
      { name: '❌ Exit', value: 'exit' }
    ];

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to configure?',
        choices: choices
      }
    ]);

    switch (action) {
      case 'smtp':
        await this.configureSMTP();
        break;
      case 'recipients':
        await this.configureRecipients();
        break;
      case 'templates':
        await this.manageTemplates();
        break;
      case 'triggers':
        await this.configureTriggers();
        break;
      case 'general':
        await this.configureGeneral();
        break;
      case 'test':
        await this.testConfiguration();
        break;
      case 'status':
        await this.showStatus();
        break;
      case 'save':
        await this.saveConfiguration();
        break;
      case 'exit':
        console.log(chalk.blue('👋 Goodbye!'));
        process.exit(0);
        break;
    }

    // Return to main menu
    await this.showMainMenu();
  }

  /**
   * Configure SMTP settings
   */
  async configureSMTP() {
    console.log(chalk.blue('\n📧 SMTP Configuration\n'));
    
    const smtpConfig = this.config.smtp || {};
    
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'host',
        message: 'SMTP Host:',
        default: smtpConfig.host || 'smtp.gmail.com',
        validate: (input) => input.trim() ? true : 'Host is required'
      },
      {
        type: 'input',
        name: 'port',
        message: 'SMTP Port:',
        default: smtpConfig.port || '587',
        validate: (input) => !isNaN(input) && input > 0 ? true : 'Port must be a positive number'
      },
      {
        type: 'confirm',
        name: 'secure',
        message: 'Use secure connection (TLS/SSL)?',
        default: smtpConfig.secure || false
      },
      {
        type: 'input',
        name: 'user',
        message: 'SMTP Username:',
        default: smtpConfig.user || '',
        validate: (input) => input.trim() ? true : 'Username is required'
      },
      {
        type: 'password',
        name: 'pass',
        message: 'SMTP Password:',
        default: smtpConfig.pass || '',
        validate: (input) => input.trim() ? true : 'Password is required'
      },
      {
        type: 'input',
        name: 'from_email',
        message: 'From Email Address:',
        default: smtpConfig.from_email || smtpConfig.user || '',
        validate: (input) => this.isValidEmail(input) ? true : 'Valid email address is required'
      },
      {
        type: 'input',
        name: 'from_name',
        message: 'From Name (optional):',
        default: smtpConfig.from_name || 'AI Code Review System'
      }
    ]);

    this.config.smtp = answers;
    console.log(chalk.green('✅ SMTP configuration updated'));
  }

  /**
   * Configure recipients
   */
  async configureRecipients() {
    console.log(chalk.blue('\n👥 Recipients Configuration\n'));
    
    const recipients = this.config.to_emails || [];
    
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do with recipients?',
        choices: [
          { name: '➕ Add Recipient', value: 'add' },
          { name: '➖ Remove Recipient', value: 'remove' },
          { name: '👀 View Current Recipients', value: 'view' },
          { name: '📋 Import from File', value: 'import' },
          { name: '🔙 Back to Main Menu', value: 'back' }
        ]
      }
    ]);

    switch (action) {
      case 'add':
        await this.addRecipient(recipients);
        break;
      case 'remove':
        await this.removeRecipient(recipients);
        break;
      case 'view':
        await this.viewRecipients(recipients);
        break;
      case 'import':
        await this.importRecipients(recipients);
        break;
      case 'back':
        return;
    }

    this.config.to_emails = recipients;
    await this.configureRecipients(); // Show menu again
  }

  /**
   * Add a new recipient
   */
  async addRecipient(recipients) {
    const { email, name, role } = await inquirer.prompt([
      {
        type: 'input',
        name: 'email',
        message: 'Email Address:',
        validate: (input) => this.isValidEmail(input) ? true : 'Valid email address is required'
      },
      {
        type: 'input',
        name: 'name',
        message: 'Name (optional):',
        default: ''
      },
      {
        type: 'list',
        name: 'role',
        message: 'Role:',
        choices: [
          { name: 'Developer', value: 'developer' },
          { name: 'Team Lead', value: 'team_lead' },
          { name: 'Manager', value: 'manager' },
          { name: 'Security Team', value: 'security' },
          { name: 'Other', value: 'other' }
        ]
      }
    ]);

    const recipient = { email, name, role };
    recipients.push(recipient);
    
    console.log(chalk.green(`✅ Added recipient: ${email}`));
  }

  /**
   * Remove a recipient
   */
  async removeRecipient(recipients) {
    if (recipients.length === 0) {
      console.log(chalk.yellow('⚠️  No recipients configured'));
      return;
    }

    const choices = recipients.map((r, i) => ({
      name: `${r.email}${r.name ? ` (${r.name})` : ''} - ${r.role}`,
      value: i
    }));

    const { index } = await inquirer.prompt([
      {
        type: 'list',
        name: 'index',
        message: 'Select recipient to remove:',
        choices: choices
      }
    ]);

    const removed = recipients.splice(index, 1)[0];
    console.log(chalk.green(`✅ Removed recipient: ${removed.email}`));
  }

  /**
   * View current recipients
   */
  async viewRecipients(recipients) {
    if (recipients.length === 0) {
      console.log(chalk.yellow('⚠️  No recipients configured'));
      return;
    }

    console.log(chalk.blue('\n📋 Current Recipients:\n'));
    
    recipients.forEach((recipient, index) => {
      console.log(`${index + 1}. ${chalk.cyan(recipient.email)}`);
      if (recipient.name) console.log(`   Name: ${recipient.name}`);
      console.log(`   Role: ${recipient.role}`);
      console.log('');
    });
  }

  /**
   * Import recipients from file
   */
  async importRecipients(recipients) {
    const { filePath } = await inquirer.prompt([
      {
        type: 'input',
        name: 'filePath',
        message: 'Path to recipients file (CSV or JSON):',
        default: './recipients.csv'
      }
    ]);

    try {
      if (!fs.existsSync(filePath)) {
        console.log(chalk.red('❌ File not found'));
        return;
      }

      const content = fs.readFileSync(filePath, 'utf8');
      let imported = [];

      if (filePath.endsWith('.csv')) {
        imported = this.parseCSVRecipients(content);
      } else if (filePath.endsWith('.json')) {
        imported = JSON.parse(content);
      } else {
        console.log(chalk.red('❌ Unsupported file format. Use CSV or JSON'));
        return;
      }

      const validRecipients = imported.filter(r => this.isValidEmail(r.email));
      recipients.push(...validRecipients);

      console.log(chalk.green(`✅ Imported ${validRecipients.length} recipients`));
      
    } catch (error) {
      console.error(chalk.red('❌ Error importing recipients:'), error.message);
    }
  }

  /**
   * Parse CSV recipients
   */
  parseCSVRecipients(csvContent) {
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const recipient = {};
      
      headers.forEach((header, index) => {
        recipient[header] = values[index] || '';
      });
      
      return recipient;
    });
  }

  /**
   * Manage email templates
   */
  async manageTemplates() {
    console.log(chalk.blue('\n📝 Email Templates Management\n'));
    
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do with templates?',
        choices: [
          { name: '👀 View Available Templates', value: 'view' },
          { name: '📝 Edit Template', value: 'edit' },
          { name: '➕ Create New Template', value: 'create' },
          { name: '🔙 Back to Main Menu', value: 'back' }
        ]
      }
    ]);

    switch (action) {
      case 'view':
        await this.viewTemplates();
        break;
      case 'edit':
        await this.editTemplate();
        break;
      case 'create':
        await this.createTemplate();
        break;
      case 'back':
        return;
    }

    await this.manageTemplates(); // Show menu again
  }

  /**
   * View available templates
   */
  async viewTemplates() {
    const templates = this.getAvailableTemplates();
    
    if (templates.length === 0) {
      console.log(chalk.yellow('⚠️  No templates found'));
      return;
    }

    console.log(chalk.blue('\n📋 Available Templates:\n'));
    
    templates.forEach(template => {
      console.log(`📧 ${chalk.cyan(template.name)}`);
      console.log(`   Type: ${template.type}`);
      console.log(`   Description: ${template.description}`);
      console.log('');
    });
  }

  /**
   * Get available templates
   */
  getAvailableTemplates() {
    const templates = [
      { name: 'notification', type: 'General', description: 'Default notification template' },
      { name: 'issue_created', type: 'Issue', description: 'New issue notification' },
      { name: 'issue_updated', type: 'Issue', description: 'Issue update notification' },
      { name: 'security_issue', type: 'Security', description: 'Security issue alert' },
      { name: 'issue_escalated', type: 'Issue', description: 'Issue escalation alert' },
      { name: 'review_failed', type: 'Review', description: 'Code review failure notification' },
      { name: 'review_passed', type: 'Review', description: 'Code review success notification' }
    ];

    return templates;
  }

  /**
   * Edit template
   */
  async editTemplate() {
    const templates = this.getAvailableTemplates();
    
    const { templateName } = await inquirer.prompt([
      {
        type: 'list',
        name: 'templateName',
        message: 'Select template to edit:',
        choices: templates.map(t => ({ name: `${t.name} - ${t.description}`, value: t.name }))
      }
    ]);

    console.log(chalk.yellow(`⚠️  Template editing not implemented yet for: ${templateName}`));
    console.log(chalk.blue('💡 You can edit templates manually in the templates/email directory'));
  }

  /**
   * Create new template
   */
  async createTemplate() {
    const { name, type, description } = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Template name:',
        validate: (input) => input.trim() ? true : 'Template name is required'
      },
      {
        type: 'list',
        name: 'type',
        message: 'Template type:',
        choices: ['General', 'Issue', 'Security', 'Review', 'Custom']
      },
      {
        type: 'input',
        name: 'description',
        message: 'Template description:',
        default: ''
      }
    ]);

    console.log(chalk.yellow(`⚠️  Template creation not implemented yet for: ${name}`));
    console.log(chalk.blue('💡 You can create templates manually in the templates/email directory'));
  }

  /**
   * Configure email triggers
   */
  async configureTriggers() {
    console.log(chalk.blue('\n🔔 Email Triggers Configuration\n'));
    
    const triggers = this.config.email_triggers?.triggers || this.getDefaultTriggers();
    
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do with triggers?',
        choices: [
          { name: '👀 View Current Triggers', value: 'view' },
          { name: '✅ Enable/Disable Trigger', value: 'toggle' },
          { name: '⚙️  Configure Trigger Conditions', value: 'conditions' },
          { name: '⏰ Configure Trigger Scheduling', value: 'scheduling' },
          { name: '🔙 Back to Main Menu', value: 'back' }
        ]
      }
    ]);

    switch (action) {
      case 'view':
        await this.viewTriggers(triggers);
        break;
      case 'toggle':
        await this.toggleTrigger(triggers);
        break;
      case 'conditions':
        await this.configureTriggerConditions(triggers);
        break;
      case 'scheduling':
        await this.configureTriggerScheduling(triggers);
        break;
      case 'back':
        return;
    }

    this.config.email_triggers = this.config.email_triggers || {};
    this.config.email_triggers.triggers = triggers;
    await this.configureTriggers(); // Show menu again
  }

  /**
   * View current triggers
   */
  async viewTriggers(triggers) {
    console.log(chalk.blue('\n🔔 Current Triggers:\n'));
    
    Object.entries(triggers).forEach(([name, trigger]) => {
      const status = trigger.enabled ? chalk.green('✅ Enabled') : chalk.red('❌ Disabled');
      console.log(`${status} ${chalk.cyan(name)}`);
      console.log(`   Events: ${trigger.events.join(', ')}`);
      console.log(`   Template: ${trigger.template}`);
      console.log(`   Recipients: ${trigger.recipients.join(', ')}`);
      console.log('');
    });
  }

  /**
   * Toggle trigger enabled/disabled
   */
  async toggleTrigger(triggers) {
    const choices = Object.entries(triggers).map(([name, trigger]) => ({
      name: `${name} - ${trigger.enabled ? 'Enabled' : 'Disabled'}`,
      value: name
    }));

    const { triggerName } = await inquirer.prompt([
      {
        type: 'list',
        name: 'triggerName',
        message: 'Select trigger to toggle:',
        choices: choices
      }
    ]);

    triggers[triggerName].enabled = !triggers[triggerName].enabled;
    const status = triggers[triggerName].enabled ? 'enabled' : 'disabled';
    
    console.log(chalk.green(`✅ Trigger '${triggerName}' ${status}`));
  }

  /**
   * Configure trigger conditions
   */
  async configureTriggerConditions(triggers) {
    const choices = Object.keys(triggers).map(name => ({
      name: name,
      value: name
    }));

    const { triggerName } = await inquirer.prompt([
      {
        type: 'list',
        name: 'triggerName',
        message: 'Select trigger to configure conditions:',
        choices: choices
      }
    ]);

    console.log(chalk.yellow(`⚠️  Condition configuration not implemented yet for: ${triggerName}`));
    console.log(chalk.blue('💡 You can configure conditions manually in the configuration file'));
  }

  /**
   * Configure trigger scheduling
   */
  async configureTriggerScheduling(triggers) {
    const choices = Object.keys(triggers).map(name => ({
      name: name,
      value: name
    }));

    const { triggerName } = await inquirer.prompt([
      {
        type: 'list',
        name: 'triggerName',
        message: 'Select trigger to configure scheduling:',
        choices: choices
      }
    ]);

    console.log(chalk.yellow(`⚠️  Scheduling configuration not implemented yet for: ${triggerName}`));
    console.log(chalk.blue('💡 You can configure scheduling manually in the configuration file'));
  }

  /**
   * Configure general settings
   */
  async configureGeneral() {
    console.log(chalk.blue('\n⚙️  General Email Settings\n'));
    
    const general = this.config.general || {};
    
    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'enabled',
        message: 'Enable email notifications?',
        default: general.enabled !== false
      },
      {
        type: 'input',
        name: 'subject_prefix',
        message: 'Email subject prefix:',
        default: general.subject_prefix || '[AI Code Review]'
      },
      {
        type: 'confirm',
        name: 'include_attachments',
        message: 'Include file attachments in emails?',
        default: general.include_attachments || false
      },
      {
        type: 'number',
        name: 'max_attachment_size_mb',
        message: 'Maximum attachment size (MB):',
        default: general.max_attachment_size_mb || 10,
        when: (answers) => answers.include_attachments
      },
      {
        type: 'confirm',
        name: 'html_emails',
        message: 'Send HTML emails?',
        default: general.html_emails !== false
      },
      {
        type: 'confirm',
        name: 'text_emails',
        message: 'Send plain text emails?',
        default: general.text_emails || true
      }
    ]);

    this.config.general = answers;
    console.log(chalk.green('✅ General settings updated'));
  }

  /**
   * Test email configuration
   */
  async testConfiguration() {
    console.log(chalk.blue('\n🧪 Test Email Configuration\n'));
    
    if (!this.config.smtp || !this.config.to_emails || this.config.to_emails.length === 0) {
      console.log(chalk.red('❌ Cannot test: SMTP or recipients not configured'));
      return;
    }

    const { testType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'testType',
        message: 'Select test type:',
        choices: [
          { name: '📧 Send Test Email', value: 'send' },
          { name: '🔍 Validate Configuration', value: 'validate' },
          { name: '🔙 Back to Main Menu', value: 'back' }
        ]
      }
    ]);

    switch (testType) {
      case 'send':
        await this.sendTestEmail();
        break;
      case 'validate':
        await this.validateConfiguration();
        break;
      case 'back':
        return;
    }
  }

  /**
   * Send test email
   */
  async sendTestEmail() {
    const { recipient } = await inquirer.prompt([
      {
        type: 'list',
        name: 'recipient',
        message: 'Select test recipient:',
        choices: this.config.to_emails.map((r, i) => ({
          name: `${r.email}${r.name ? ` (${r.name})` : ''}`,
          value: i
        }))
      }
    ]);

    console.log(chalk.yellow('⚠️  Test email sending not implemented yet'));
    console.log(chalk.blue('💡 You can test the configuration by running a code review'));
  }

  /**
   * Validate configuration
   */
  async validateConfiguration() {
    console.log(chalk.blue('\n🔍 Validating Configuration...\n'));
    
    const issues = [];
    
    // Check SMTP configuration
    if (!this.config.smtp) {
      issues.push('❌ SMTP configuration missing');
    } else {
      if (!this.config.smtp.host) issues.push('❌ SMTP host not configured');
      if (!this.config.smtp.port) issues.push('❌ SMTP port not configured');
      if (!this.config.smtp.user) issues.push('❌ SMTP username not configured');
      if (!this.config.smtp.pass) issues.push('❌ SMTP password not configured');
      if (!this.config.smtp.from_email) issues.push('❌ From email not configured');
    }
    
    // Check recipients
    if (!this.config.to_emails || this.config.to_emails.length === 0) {
      issues.push('❌ No recipients configured');
    } else {
      this.config.to_emails.forEach((r, i) => {
        if (!this.isValidEmail(r.email)) {
          issues.push(`❌ Invalid email format: ${r.email}`);
        }
      });
    }
    
    // Check general settings
    if (this.config.general?.enabled === false) {
      issues.push('⚠️  Email notifications are disabled');
    }
    
    if (issues.length === 0) {
      console.log(chalk.green('✅ Configuration is valid!'));
    } else {
      console.log(chalk.red('❌ Configuration issues found:\n'));
      issues.forEach(issue => console.log(issue));
    }
  }

  /**
   * Show configuration status
   */
  async showStatus() {
    console.log(chalk.blue('\n📊 Configuration Status\n'));
    
    // SMTP Status
    const smtpStatus = this.config.smtp ? 
      chalk.green('✅ Configured') : 
      chalk.red('❌ Not Configured');
    console.log(`SMTP Settings: ${smtpStatus}`);
    
    // Recipients Status
    const recipientCount = this.config.to_emails?.length || 0;
    const recipientStatus = recipientCount > 0 ? 
      chalk.green(`✅ ${recipientCount} recipients`) : 
      chalk.red('❌ No recipients');
    console.log(`Recipients: ${recipientStatus}`);
    
    // Templates Status
    const templateCount = this.getAvailableTemplates().length;
    console.log(`Templates: ${chalk.blue(`📝 ${templateCount} available`)}`);
    
    // Triggers Status
    const triggers = this.config.email_triggers?.triggers || this.getDefaultTriggers();
    const enabledTriggers = Object.values(triggers).filter(t => t.enabled).length;
    const totalTriggers = Object.keys(triggers).length;
    console.log(`Triggers: ${chalk.blue(`🔔 ${enabledTriggers}/${totalTriggers} enabled`)}`);
    
    // General Status
    const generalStatus = this.config.general?.enabled !== false ? 
      chalk.green('✅ Enabled') : 
      chalk.red('❌ Disabled');
    console.log(`Email Notifications: ${generalStatus}`);
    
    console.log('');
  }

  /**
   * Get default configuration
   */
  getDefaultConfig() {
    return {
      smtp: {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        user: '',
        pass: '',
        from_email: '',
        from_name: 'AI Code Review System'
      },
      to_emails: [],
      general: {
        enabled: true,
        subject_prefix: '[AI Code Review]',
        include_attachments: false,
        max_attachment_size_mb: 10,
        html_emails: true,
        text_emails: true
      },
      email_triggers: {
        enabled: true,
        triggers: this.getDefaultTriggers()
      }
    };
  }

  /**
   * Get default triggers
   */
  getDefaultTriggers() {
    return {
      review_failed: {
        enabled: true,
        events: ['review_failed'],
        template: 'review_failed',
        recipients: ['team', 'assignees']
      },
      security_issue: {
        enabled: true,
        events: ['security_issue_detected'],
        template: 'security_issue',
        recipients: ['security_team', 'assignees']
      }
    };
  }

  /**
   * Validate email format
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

// Run CLI if called directly
if (require.main === module) {
  const cli = new EmailConfigCLI();
  cli.run().catch(error => {
    console.error(chalk.red('❌ CLI Error:'), error.message);
    process.exit(1);
  });
}

module.exports = EmailConfigCLI;


