// Global teardown for Jest tests

module.exports = async () => {
  // Clean up test directories
  const fs = require('fs').promises;
  const path = require('path');
  
  const testDirs = [
    './test-logs',
    './test-dashboard',
    './test-coverage'
  ];
  
  for (const dir of testDirs) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist, ignore error
    }
  }
  
  // Clear environment variables
  delete process.env.GITHUB_TOKEN;
  delete process.env.OPENAI_API_KEY;
  
  console.log('✅ Global test teardown completed');
};



