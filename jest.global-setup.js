// Global setup for Jest tests

module.exports = async () => {
  // Set up test environment variables
  process.env.NODE_ENV = 'test';
  process.env.GITHUB_TOKEN = 'test-github-token';
  process.env.OPENAI_API_KEY = 'test-openai-api-key';
  
  // Create test directories if they don't exist
  const fs = require('fs').promises;
  const path = require('path');
  
  const testDirs = [
    './test-logs',
    './test-dashboard',
    './test-coverage'
  ];
  
  for (const dir of testDirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory might already exist, ignore error
    }
  }
  
  console.log('✅ Global test setup completed');
};



