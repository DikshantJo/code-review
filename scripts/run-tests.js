#!/usr/bin/env node

/**
 * Comprehensive Test Runner for AI Code Review System
 * 
 * This script provides a unified interface for running different types of tests
 * with various configurations and reporting options.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test configurations
const TEST_CONFIGS = {
  unit: {
    pattern: 'src/**/*.test.js',
    description: 'Unit tests for individual components',
    timeout: 10000
  },
  integration: {
    pattern: 'src/**/*.integration.test.js',
    description: 'Integration tests for component interactions',
    timeout: 30000
  },
  performance: {
    pattern: 'src/**/*.performance.test.js',
    description: 'Performance and load tests',
    timeout: 60000
  },
  e2e: {
    pattern: 'src/**/*.e2e.test.js',
    description: 'End-to-end workflow tests',
    timeout: 120000
  },
  all: {
    pattern: 'src/**/*.test.js',
    description: 'All tests',
    timeout: 60000
  }
};

// Test suites
const TEST_SUITES = {
  core: ['config-parser', 'github-client', 'openai-client'],
  review: ['file-filter', 'quality-gates', 'response-handler'],
  notifications: ['email-notifier'],
  logging: ['logger', 'error-logger', 'health-checker'],
  monitoring: ['monitoring-dashboard', 'metrics-aggregator'],
  utilities: ['token-manager', 'large-commit-handler'],
  actions: ['ai-review-action']
};

class TestRunner {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      duration: 0,
      suites: {}
    };
  }

  /**
   * Run tests with specified configuration
   */
  async runTests(config = 'all', options = {}) {
    console.log(`🚀 Starting ${TEST_CONFIGS[config].description}...`);
    console.log(`⏱️  Timeout: ${TEST_CONFIGS[config].timeout}ms`);
    
    const startTime = Date.now();
    
    try {
      const args = this.buildJestArgs(config, options);
      const result = await this.executeJest(args);
      
      this.results.duration = Date.now() - startTime;
      this.parseResults(result);
      
      return this.results;
    } catch (error) {
      console.error('❌ Test execution failed:', error.message);
      throw error;
    }
  }

  /**
   * Run specific test suite
   */
  async runTestSuite(suite, options = {}) {
    console.log(`🧪 Running test suite: ${suite}`);
    
    if (!TEST_SUITES[suite]) {
      throw new Error(`Unknown test suite: ${suite}`);
    }
    
    const patterns = TEST_SUITES[suite].map(component => 
      `src/**/${component}*.test.js`
    );
    
    const args = this.buildJestArgs('all', {
      ...options,
      pattern: patterns.join('|')
    });
    
    return await this.executeJest(args);
  }

  /**
   * Run tests with coverage
   */
  async runTestsWithCoverage(config = 'all', options = {}) {
    console.log('📊 Running tests with coverage...');
    
    const coverageOptions = {
      ...options,
      coverage: true,
      coverageReporters: ['text', 'html', 'lcov']
    };
    
    return await this.runTests(config, coverageOptions);
  }

  /**
   * Run performance tests
   */
  async runPerformanceTests(options = {}) {
    console.log('⚡ Running performance tests...');
    
    const perfOptions = {
      ...options,
      timeout: 120000,
      verbose: true
    };
    
    return await this.runTests('performance', perfOptions);
  }

  /**
   * Build Jest command arguments
   */
  buildJestArgs(config, options = {}) {
    const args = ['node_modules/.bin/jest'];
    
    // Add pattern if specified
    if (options.pattern) {
      args.push('--testPathPattern', options.pattern);
    } else if (TEST_CONFIGS[config].pattern) {
      args.push('--testPathPattern', TEST_CONFIGS[config].pattern);
    }
    
    // Add coverage options
    if (options.coverage) {
      args.push('--coverage');
      args.push('--collectCoverageFrom', 'src/**/*.js');
      args.push('--coverageDirectory', 'coverage');
      
      if (options.coverageReporters) {
        args.push('--coverageReporters', ...options.coverageReporters);
      }
    }
    
    // Add timeout
    const timeout = options.timeout || TEST_CONFIGS[config].timeout;
    args.push('--testTimeout', timeout.toString());
    
    // Add other options
    if (options.verbose) args.push('--verbose');
    if (options.watch) args.push('--watch');
    if (options.ci) args.push('--ci');
    if (options.detectOpenHandles) args.push('--detectOpenHandles');
    if (options.passWithNoTests) args.push('--passWithNoTests');
    
    return args;
  }

  /**
   * Execute Jest process
   */
  executeJest(args) {
    return new Promise((resolve, reject) => {
      console.log(`📝 Executing: ${args.join(' ')}`);
      
      const jestProcess = spawn('node', args, {
        stdio: 'pipe',
        cwd: process.cwd()
      });
      
      let stdout = '';
      let stderr = '';
      
      jestProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        process.stdout.write(data);
      });
      
      jestProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        process.stderr.write(data);
      });
      
      jestProcess.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr, code });
        } else {
          reject(new Error(`Jest process exited with code ${code}\n${stderr}`));
        }
      });
      
      jestProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Parse test results
   */
  parseResults(result) {
    // Extract test statistics from Jest output
    const output = result.stdout;
    
    // Parse test counts
    const testMatch = output.match(/(\d+) tests? passed/);
    const failMatch = output.match(/(\d+) tests? failed/);
    const skipMatch = output.match(/(\d+) tests? skipped/);
    
    this.results.passed = testMatch ? parseInt(testMatch[1]) : 0;
    this.results.failed = failMatch ? parseInt(failMatch[1]) : 0;
    this.results.skipped = skipMatch ? parseInt(skipMatch[1]) : 0;
    this.results.total = this.results.passed + this.results.failed + this.results.skipped;
    
    // Parse coverage if available
    const coverageMatch = output.match(/All files\s+\|\s+(\d+(?:\.\d+)?)\s+\|\s+(\d+(?:\.\d+)?)\s+\|\s+(\d+(?:\.\d+)?)\s+\|\s+(\d+(?:\.\d+)?)/);
    if (coverageMatch) {
      this.results.coverage = {
        statements: parseFloat(coverageMatch[1]),
        branches: parseFloat(coverageMatch[2]),
        functions: parseFloat(coverageMatch[3]),
        lines: parseFloat(coverageMatch[4])
      };
    }
  }

  /**
   * Generate test report
   */
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.results.total,
        passed: this.results.passed,
        failed: this.results.failed,
        skipped: this.results.skipped,
        duration: this.results.duration,
        successRate: this.results.total > 0 ? (this.results.passed / this.results.total * 100).toFixed(2) : 0
      },
      coverage: this.results.coverage,
      suites: this.results.suites
    };
    
    return report;
  }

  /**
   * Save test report
   */
  saveReport(report, filename = 'test-report.json') {
    const reportPath = path.join(process.cwd(), 'reports', filename);
    
    // Ensure reports directory exists
    const reportsDir = path.dirname(reportPath);
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Test report saved to: ${reportPath}`);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'all';
  const options = {};
  
  // Parse command line options
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--coverage') options.coverage = true;
    if (arg === '--verbose') options.verbose = true;
    if (arg === '--watch') options.watch = true;
    if (arg === '--ci') options.ci = true;
    if (arg === '--debug') options.detectOpenHandles = true;
    if (arg === '--timeout' && args[i + 1]) {
      options.timeout = parseInt(args[i + 1]);
      i++;
    }
  }
  
  const runner = new TestRunner();
  
  try {
    let result;
    
    switch (command) {
      case 'unit':
        result = await runner.runTestSuite('core', options);
        break;
      case 'integration':
        result = await runner.runTests('integration', options);
        break;
      case 'performance':
        result = await runner.runPerformanceTests(options);
        break;
      case 'coverage':
        result = await runner.runTestsWithCoverage('all', options);
        break;
      case 'suite':
        const suite = args[1] || 'core';
        result = await runner.runTestSuite(suite, options);
        break;
      case 'all':
      default:
        result = await runner.runTests('all', options);
        break;
    }
    
    const report = runner.generateReport();
    runner.saveReport(report);
    
    console.log('\n📊 Test Summary:');
    console.log(`✅ Passed: ${report.summary.passed}`);
    console.log(`❌ Failed: ${report.summary.failed}`);
    console.log(`⏭️  Skipped: ${report.summary.skipped}`);
    console.log(`📈 Success Rate: ${report.summary.successRate}%`);
    console.log(`⏱️  Duration: ${report.summary.duration}ms`);
    
    if (report.coverage) {
      console.log('\n📊 Coverage Summary:');
      console.log(`📝 Statements: ${report.coverage.statements}%`);
      console.log(`🌿 Branches: ${report.coverage.branches}%`);
      console.log(`🔧 Functions: ${report.coverage.functions}%`);
      console.log(`📄 Lines: ${report.coverage.lines}%`);
    }
    
    process.exit(report.summary.failed > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = TestRunner;



