const core = require('@actions/core');
const github = require('@actions/github');
const AIReviewAction = require('./actions/ai-review-action');

/**
 * Main entry point for the AI Code Review GitHub Action
 * This file is the entry point that GitHub Actions will execute
 */
async function main() {
  try {
    // Log action start
    core.info('🚀 Starting AI Code Review Action...');
    
    // Verify GitHub context is available
    core.info('🔍 Checking GitHub context...');
    if (!github.context) {
      core.warning('⚠️ GitHub context is not available, using environment variables');
    } else {
      core.info(`✅ GitHub context available: ${github.context.eventName || 'unknown'} event`);
    }
    
    // Get action inputs
    const inputs = {
      configPath: core.getInput('config-path', { required: false }) || '.github/ai-review-config.yml',
      severityThreshold: core.getInput('severity-threshold', { required: false }) || 'MEDIUM',
      enableProductionGates: core.getInput('enable-production-gates', { required: false }) === 'true',
      targetBranch: core.getInput('target-branch', { required: true }),
      timeout: parseInt(core.getInput('timeout', { required: false }) || '300'),
      maxFiles: parseInt(core.getInput('max-files', { required: false }) || '50'),
      maxFileSize: parseInt(core.getInput('max-file-size', { required: false }) || '1000000'),
      teamLead: core.getInput('team-lead', { required: false }) || '',
      emailNotifications: core.getInput('email-notifications', { required: false }) !== 'false',
      slackNotifications: core.getInput('slack-notifications', { required: false }) === 'true',
      logLevel: core.getInput('log-level', { required: false }) || 'INFO',
      auditLogEnabled: core.getInput('audit-log-enabled', { required: false }) !== 'false',
      retryAttempts: parseInt(core.getInput('retry-attempts', { required: false }) || '3'),
      retryDelay: parseInt(core.getInput('retry-delay', { required: false }) || '5')
    };

    // Validate required inputs
    if (!inputs.targetBranch) {
      throw new Error('target-branch input is required');
    }

    // Log configuration
    core.info(`📋 Configuration loaded:`);
    core.info(`   Target Branch: ${inputs.targetBranch}`);
    core.info(`   Severity Threshold: ${inputs.severityThreshold}`);
    core.info(`   Production Gates: ${inputs.enableProductionGates}`);
    core.info(`   Max Files: ${inputs.maxFiles}`);
    core.info(`   Timeout: ${inputs.timeout}s`);

    // Create and run the AI review action
    const action = new AIReviewAction();
    
    // Set action outputs
    core.setOutput('review-status', 'RUNNING');
    core.setOutput('target-branch', inputs.targetBranch);
    core.setOutput('severity-threshold', inputs.severityThreshold);
    
    // Execute the review
    await action.run();
    
    // Set success outputs
    core.setOutput('review-status', 'PASS');
    core.setOutput('review-duration', Math.floor((Date.now() - Date.now()) / 1000));
    
    core.info('✅ AI Code Review completed successfully!');
    
  } catch (error) {
    // Log error details
    core.error(`❌ AI Code Review failed: ${error.message}`);
    
    if (error.stack) {
      core.debug(`Stack trace: ${error.stack}`);
    }
    
    // Set failure outputs
    core.setOutput('review-status', 'FAIL');
    core.setOutput('error-message', error.message);
    
    // Set the action as failed
    core.setFailed(`AI Code Review failed: ${error.message}`);
  }
}

// Export for testing
module.exports = { main };

// Execute if this is the main module (GitHub Actions runtime)
if (require.main === module) {
  main().catch(error => {
    core.error(`Unhandled error in main: ${error.message}`);
    core.setFailed(`Unhandled error: ${error.message}`);
    process.exit(1);
  });
}
