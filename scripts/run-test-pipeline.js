#!/usr/bin/env node

/**
 * Local Test Pipeline Runner
 * Mimics the automated testing pipeline for local development
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Test pipeline configuration
const TEST_PIPELINE = [
  {
    name: '🔍 Linting',
    command: 'npm run lint',
    timeout: 30000,
    critical: true
  },
  {
    name: '🎨 Code Formatting Check',
    command: 'npm run format:check',
    timeout: 15000,
    critical: true
  },
  {
    name: '🧪 Unit Tests',
    command: 'npm run test:unit',
    timeout: 60000,
    critical: true
  },
  {
    name: '🔗 Integration Tests',
    command: 'npm run test:integration',
    timeout: 120000,
    critical: true
  },
  {
    name: '🌐 End-to-End Tests',
    command: 'npm run test:e2e',
    timeout: 300000,
    critical: true
  },
  {
    name: '⚡ Performance Tests',
    command: 'npm run test:performance',
    timeout: 600000,
    critical: false
  },
  {
    name: '📊 Coverage Analysis',
    command: 'npm run test:coverage',
    timeout: 120000,
    critical: true
  },
  {
    name: '🔒 Security Audit',
    command: 'npm audit --audit-level=moderate',
    timeout: 60000,
    critical: false
  }
];

// Test results storage
const testResults = {
  startTime: Date.now(),
  results: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    criticalFailures: 0
  }
};

/**
 * Print colored output
 */
function print(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Print header
 */
function printHeader() {
  print('\n' + '='.repeat(80), 'cyan');
  print('🧪 AI REVIEW SYSTEM - LOCAL TEST PIPELINE', 'bright');
  print('='.repeat(80), 'cyan');
  print(`Started at: ${new Date().toISOString()}`, 'blue');
  print('='.repeat(80), 'cyan');
}

/**
 * Print test result
 */
function printTestResult(test, result, duration) {
  const status = result.success ? '✅ PASSED' : '❌ FAILED';
  const color = result.success ? 'green' : 'red';
  const critical = test.critical ? ' [CRITICAL]' : '';
  
  print(`${status} ${test.name}${critical} (${duration}ms)`, color);
  
  if (!result.success && result.error) {
    print(`   Error: ${result.error}`, 'red');
  }
}

/**
 * Print summary
 */
function printSummary() {
  const totalTime = Date.now() - testResults.startTime;
  const { total, passed, failed, skipped, criticalFailures } = testResults.summary;
  
  print('\n' + '='.repeat(80), 'cyan');
  print('📊 TEST PIPELINE SUMMARY', 'bright');
  print('='.repeat(80), 'cyan');
  
  print(`Total Tests: ${total}`, 'blue');
  print(`✅ Passed: ${passed}`, 'green');
  print(`❌ Failed: ${failed}`, 'red');
  print(`⏭️ Skipped: ${skipped}`, 'yellow');
  print(`🚨 Critical Failures: ${criticalFailures}`, criticalFailures > 0 ? 'red' : 'green');
  print(`⏱️ Total Time: ${Math.round(totalTime / 1000)}s`, 'blue');
  
  if (criticalFailures > 0) {
    print('\n🚨 CRITICAL FAILURES DETECTED!', 'red');
    print('Please fix these issues before proceeding.', 'red');
  } else if (failed > 0) {
    print('\n⚠️ Some tests failed, but no critical failures.', 'yellow');
    print('Review the failures and fix as needed.', 'yellow');
  } else {
    print('\n🎉 ALL TESTS PASSED!', 'green');
    print('Ready for deployment.', 'green');
  }
  
  print('='.repeat(80), 'cyan');
}

/**
 * Run a single test
 */
async function runTest(test) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    print(`\n🔄 Running: ${test.name}`, 'blue');
    
    try {
      const child = spawn(test.command, [], {
        shell: true,
        stdio: 'pipe'
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        const duration = Date.now() - startTime;
        resolve({
          success: false,
          error: `Timeout after ${test.timeout}ms`,
          duration,
          stdout,
          stderr
        });
      }, test.timeout);
      
      child.on('close', (code) => {
        clearTimeout(timeout);
        const duration = Date.now() - startTime;
        
        if (code === 0) {
          resolve({
            success: true,
            duration,
            stdout,
            stderr
          });
        } else {
          resolve({
            success: false,
            error: `Process exited with code ${code}`,
            duration,
            stdout,
            stderr
          });
        }
      });
      
      child.on('error', (error) => {
        clearTimeout(timeout);
        const duration = Date.now() - startTime;
        resolve({
          success: false,
          error: error.message,
          duration,
          stdout,
          stderr
        });
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      resolve({
        success: false,
        error: error.message,
        duration
      });
    }
  });
}

/**
 * Check if we should skip a test
 */
function shouldSkipTest(test, index) {
  // Skip performance tests in CI environments
  if (process.env.CI && test.name.includes('Performance')) {
    return true;
  }
  
  // Skip non-critical tests if previous critical tests failed
  if (!test.critical && testResults.summary.criticalFailures > 0) {
    return true;
  }
  
  return false;
}

/**
 * Main pipeline execution
 */
async function runPipeline() {
  printHeader();
  
  for (let i = 0; i < TEST_PIPELINE.length; i++) {
    const test = TEST_PIPELINE[i];
    
    if (shouldSkipTest(test, i)) {
      print(`\n⏭️ Skipping: ${test.name}`, 'yellow');
      testResults.results.push({
        test: test.name,
        success: true,
        skipped: true,
        duration: 0
      });
      testResults.summary.skipped++;
      continue;
    }
    
    const result = await runTest(test);
    result.test = test.name;
    result.skipped = false;
    
    testResults.results.push(result);
    testResults.summary.total++;
    
    if (result.success) {
      testResults.summary.passed++;
    } else {
      testResults.summary.failed++;
      if (test.critical) {
        testResults.summary.criticalFailures++;
      }
    }
    
    printTestResult(test, result, result.duration);
    
    // Stop on critical failures
    if (test.critical && !result.success) {
      print(`\n🚨 Critical test failed: ${test.name}`, 'red');
      print('Stopping pipeline execution.', 'red');
      break;
    }
  }
  
  printSummary();
  
  // Exit with appropriate code
  if (testResults.summary.criticalFailures > 0) {
    process.exit(1);
  } else if (testResults.summary.failed > 0) {
    process.exit(2);
  } else {
    process.exit(0);
  }
}

/**
 * Handle command line arguments
 */
function parseArguments() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    print('Usage: node scripts/run-test-pipeline.js [options]', 'bright');
    print('\nOptions:', 'bright');
    print('  --help, -h     Show this help message', 'blue');
    print('  --quick        Run only critical tests', 'blue');
    print('  --verbose      Show detailed output', 'blue');
    print('  --coverage     Run with coverage analysis', 'blue');
    process.exit(0);
  }
  
  if (args.includes('--quick')) {
    TEST_PIPELINE.forEach(test => {
      if (!test.critical) {
        test.skip = true;
      }
    });
  }
  
  if (args.includes('--verbose')) {
    process.env.VERBOSE = 'true';
  }
  
  if (args.includes('--coverage')) {
    // Coverage is already included in the pipeline
  }
}

// Main execution
if (require.main === module) {
  try {
    parseArguments();
    runPipeline();
  } catch (error) {
    print(`\n💥 Pipeline execution failed: ${error.message}`, 'red');
    print(error.stack, 'red');
    process.exit(1);
  }
}

module.exports = { runPipeline, TEST_PIPELINE };
