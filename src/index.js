const core = require('@actions/core');
const github = require('@actions/github');
const AIReviewAction = require('./actions/ai-review-action');

/**
 * Main entry point for the AI Code Review GitHub Action
 * This file is the entry point that GitHub Actions will execute
 */
async function main() {
  try {
    core.info('🚀 Starting AI Code Review Action...');
    
    // Add comprehensive context logging
    core.info('🔍 Checking GitHub context...');
    if (!github.context) {
      core.warning('⚠️ GitHub context is not available, using environment variables');
    } else {
      core.info(`✅ GitHub context available: ${github.context.eventName || 'unknown'} event`);
    }
    
    // Log all context properties for debugging
    core.info('📋 Context Details:');
    core.info(`   Context object: ${JSON.stringify(github.context, null, 2)}`);
    core.info(`   Event Name: ${github.context?.eventName || 'undefined'}`);
    core.info(`   Payload: ${github.context?.payload ? 'available' : 'undefined'}`);
    core.info(`   Repo: ${github.context?.repo ? 'available' : 'undefined'}`);
    core.info(`   SHA: ${github.context?.sha || 'undefined'}`);
    core.info(`   Actor: ${github.context?.actor || 'undefined'}`);
    
    // Log environment variables
    core.info('📋 Environment Variables:');
    core.info(`   GITHUB_EVENT_NAME: ${process.env.GITHUB_EVENT_NAME || 'undefined'}`);
    core.info(`   GITHUB_REPOSITORY: ${process.env.GITHUB_REPOSITORY || 'undefined'}`);
    core.info(`   GITHUB_SHA: ${process.env.GITHUB_SHA || 'undefined'}`);
    core.info(`   GITHUB_ACTOR: ${process.env.GITHUB_ACTOR || 'undefined'}`);
    
    // Create AI review action with detailed logging
    core.info('🔧 Creating AI Review Action...');
    const action = new AIReviewAction();
    core.info('✅ AI Review Action created successfully');
    
    // Execute the action
    core.info('🚀 Executing AI Review Action...');
    await action.execute();
    core.info('✅ AI Code Review completed successfully');
    
  } catch (error) {
    core.error(`❌ AI Code Review failed: ${error.message}`);
    core.error(`📍 Error Location: ${error.stack}`);
    core.error(`📋 Error Details:`);
    core.error(`   Name: ${error.name}`);
    core.error(`   Message: ${error.message}`);
    core.error(`   Stack: ${error.stack}`);
    core.error(`   File: ${error.fileName || 'unknown'}`);
    core.error(`   Line: ${error.lineNumber || 'unknown'}`);
    core.error(`   Column: ${error.columnNumber || 'unknown'}`);
    
    // Log the full error object
    core.error(`🔍 Full Error Object: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`);
    
    core.setFailed(`AI Code Review failed: ${error.message}`);
  }
}

// Add process error handlers
process.on('uncaughtException', (error) => {
  core.error(`💥 Uncaught Exception: ${error.message}`);
  core.error(`📍 Stack: ${error.stack}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  core.error(`💥 Unhandled Rejection: ${reason}`);
  core.error(`📍 Promise: ${promise}`);
  process.exit(1);
});

main();
