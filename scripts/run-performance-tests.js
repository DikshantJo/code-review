#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const PerformanceTestSuite = require('../src/tests/integration/performance/performance-tests');

/**
 * Performance Test Runner
 * Provides CLI interface for running performance tests
 */

class PerformanceTestRunner {
  constructor() {
    this.testSuite = new PerformanceTestSuite();
    this.options = {
      output: 'performance-test-report.json',
      verbose: false,
      timeout: 300000, // 5 minutes
      concurrency: 5,
      iterations: 1
    };
  }

  /**
   * Parse command line arguments
   */
  parseArgs() {
    const args = process.argv.slice(2);
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      switch (arg) {
        case '--help':
        case '-h':
          this.showHelp();
          process.exit(0);
          break;
          
        case '--verbose':
        case '-v':
          this.options.verbose = true;
          break;
          
        case '--output':
        case '-o':
          this.options.output = args[++i];
          break;
          
        case '--timeout':
        case '-t':
          this.options.timeout = parseInt(args[++i]) * 1000;
          break;
          
        case '--concurrency':
        case '-c':
          this.options.concurrency = parseInt(args[++i]);
          break;
          
        case '--iterations':
        case '-i':
          this.options.iterations = parseInt(args[++i]);
          break;
          
        case '--quick':
        case '-q':
          this.options.quick = true;
          break;
          
        case '--stress':
        case '-s':
          this.options.stress = true;
          break;
      }
    }
  }

  /**
   * Show help information
   */
  showHelp() {
    console.log(`
🚀 AI Code Review System - Performance Test Runner

Usage: node scripts/run-performance-tests.js [options]

Options:
  -h, --help              Show this help message
  -v, --verbose           Enable verbose output
  -o, --output <file>     Output file for test results (default: performance-test-report.json)
  -t, --timeout <seconds> Test timeout in seconds (default: 300)
  -c, --concurrency <n>   Number of concurrent tests (default: 5)
  -i, --iterations <n>    Number of test iterations (default: 1)
  -q, --quick             Run quick performance tests only
  -s, --stress            Run stress tests with high load

Examples:
  node scripts/run-performance-tests.js
  node scripts/run-performance-tests.js --verbose --output results.json
  node scripts/run-performance-tests.js --quick --iterations 3
  node scripts/run-performance-tests.js --stress --concurrency 10

Test Categories:
  - OpenAI API Response Time
  - GitHub API Performance
  - Workflow Throughput
  - Concurrent Review Handling
  - Large File Processing
  - Memory Usage Analysis
  - Error Recovery Performance
    `);
  }

  /**
   * Run performance tests
   */
  async runTests() {
    console.log('🚀 Starting Performance Test Runner...');
    console.log(`📊 Configuration: ${JSON.stringify(this.options, null, 2)}\n`);

    const startTime = Date.now();
    const results = [];

    try {
      // Run tests for specified number of iterations
      for (let iteration = 1; iteration <= this.options.iterations; iteration++) {
        console.log(`\n🔄 Running iteration ${iteration}/${this.options.iterations}...`);
        
        const iterationStart = Date.now();
        await this.testSuite.runAllTests();
        const iterationTime = Date.now() - iterationStart;
        
        results.push({
          iteration,
          duration: iterationTime,
          results: [...this.testSuite.results]
        });

        console.log(`✅ Iteration ${iteration} completed in ${iterationTime}ms`);
        
        // Clear results for next iteration
        this.testSuite.results = [];
      }

      // Generate aggregated report
      await this.generateAggregatedReport(results, startTime);
      
    } catch (error) {
      console.error(`❌ Performance test runner failed: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Generate aggregated performance report
   */
  async generateAggregatedReport(iterationResults, startTime) {
    console.log('\n📋 Generating Aggregated Performance Report...');
    
    const totalTime = Date.now() - startTime;
    const allResults = iterationResults.flatMap(ir => ir.results);
    
    // Calculate aggregated metrics
    const aggregatedMetrics = this.calculateAggregatedMetrics(allResults);
    const performanceTrends = this.analyzePerformanceTrends(iterationResults);
    const recommendations = this.generateRecommendations(aggregatedMetrics);
    
    const report = {
      metadata: {
        generatedAt: new Date().toISOString(),
        totalDuration: totalTime,
        iterations: this.options.iterations,
        concurrency: this.options.concurrency,
        options: this.options
      },
      summary: {
        totalTests: allResults.length,
        passed: allResults.filter(r => r.status === 'passed').length,
        warnings: allResults.filter(r => r.status === 'warning').length,
        failed: allResults.filter(r => r.status === 'failed').length,
        successRate: (allResults.filter(r => r.status === 'passed').length / allResults.length) * 100
      },
      aggregatedMetrics,
      performanceTrends,
      recommendations,
      iterationResults,
      detailedResults: allResults
    };

    // Save report
    const reportPath = path.resolve(this.options.output);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    // Print summary
    this.printSummary(report);
    
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }

  /**
   * Calculate aggregated metrics across all iterations
   */
  calculateAggregatedMetrics(allResults) {
    const metrics = {};
    
    // Group results by test type
    const testGroups = {};
    allResults.forEach(result => {
      if (!testGroups[result.test]) {
        testGroups[result.test] = [];
      }
      testGroups[result.test].push(result);
    });

    // Calculate metrics for each test type
    Object.entries(testGroups).forEach(([testType, results]) => {
      const responseTimes = results
        .filter(r => r.responseTime)
        .map(r => r.responseTime);
      
      const recoveryTimes = results
        .filter(r => r.recoveryTime)
        .map(r => r.recoveryTime);
      
      const totalTimes = results
        .filter(r => r.totalTime)
        .map(r => r.totalTime);

      metrics[testType] = {
        count: results.length,
        passed: results.filter(r => r.status === 'passed').length,
        warnings: results.filter(r => r.status === 'warning').length,
        failed: results.filter(r => r.status === 'failed').length,
        successRate: (results.filter(r => r.status === 'passed').length / results.length) * 100,
        responseTime: responseTimes.length > 0 ? {
          min: Math.min(...responseTimes),
          max: Math.max(...responseTimes),
          avg: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
          p95: this.calculatePercentile(responseTimes, 95),
          p99: this.calculatePercentile(responseTimes, 99)
        } : null,
        recoveryTime: recoveryTimes.length > 0 ? {
          min: Math.min(...recoveryTimes),
          max: Math.max(...recoveryTimes),
          avg: recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length
        } : null,
        totalTime: totalTimes.length > 0 ? {
          min: Math.min(...totalTimes),
          max: Math.max(...totalTimes),
          avg: totalTimes.reduce((a, b) => a + b, 0) / totalTimes.length
        } : null
      };
    });

    return metrics;
  }

  /**
   * Analyze performance trends across iterations
   */
  analyzePerformanceTrends(iterationResults) {
    const trends = {};
    
    // Analyze response time trends
    const responseTimeTrends = {};
    iterationResults.forEach((iteration, index) => {
      iteration.results.forEach(result => {
        if (result.responseTime) {
          if (!responseTimeTrends[result.test]) {
            responseTimeTrends[result.test] = [];
          }
          responseTimeTrends[result.test].push({
            iteration: index + 1,
            responseTime: result.responseTime
          });
        }
      });
    });

    // Calculate trend direction for each test type
    Object.entries(responseTimeTrends).forEach(([testType, data]) => {
      if (data.length >= 2) {
        const firstHalf = data.slice(0, Math.ceil(data.length / 2));
        const secondHalf = data.slice(Math.ceil(data.length / 2));
        
        const firstAvg = firstHalf.reduce((sum, d) => sum + d.responseTime, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, d) => sum + d.responseTime, 0) / secondHalf.length;
        
        const change = ((secondAvg - firstAvg) / firstAvg) * 100;
        
        trends[testType] = {
          trend: change > 5 ? 'increasing' : change < -5 ? 'decreasing' : 'stable',
          changePercent: change,
          dataPoints: data.length
        };
      }
    });

    return trends;
  }

  /**
   * Calculate percentile
   */
  calculatePercentile(values, percentile) {
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }

  /**
   * Generate recommendations based on aggregated metrics
   */
  generateRecommendations(metrics) {
    const recommendations = [];
    
    // Analyze response times
    Object.entries(metrics).forEach(([testType, metric]) => {
      if (metric.responseTime) {
        if (metric.responseTime.avg > 10000) {
          recommendations.push(`Optimize ${testType}: Average response time is ${Math.round(metric.responseTime.avg)}ms`);
        }
        
        if (metric.responseTime.p95 > 20000) {
          recommendations.push(`Address ${testType} latency: 95th percentile is ${Math.round(metric.responseTime.p95)}ms`);
        }
      }
      
      if (metric.successRate < 95) {
        recommendations.push(`Improve ${testType} reliability: Success rate is ${metric.successRate.toFixed(1)}%`);
      }
    });

    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push('Performance is within acceptable thresholds');
    }

    return recommendations;
  }

  /**
   * Print performance summary
   */
  printSummary(report) {
    console.log('\n📊 Performance Test Summary:');
    console.log(`  Total Duration: ${Math.round(report.metadata.totalDuration / 1000)}s`);
    console.log(`  Iterations: ${report.metadata.iterations}`);
    console.log(`  Total Tests: ${report.summary.totalTests}`);
    console.log(`  Success Rate: ${report.summary.successRate.toFixed(1)}%`);
    console.log(`  Passed: ${report.summary.passed}`);
    console.log(`  Warnings: ${report.summary.warnings}`);
    console.log(`  Failed: ${report.summary.failed}`);

    // Print test-specific metrics
    console.log('\n📈 Test Performance Metrics:');
    Object.entries(report.aggregatedMetrics).forEach(([testType, metrics]) => {
      console.log(`  ${testType}:`);
      console.log(`    Success Rate: ${metrics.successRate.toFixed(1)}%`);
      if (metrics.responseTime) {
        console.log(`    Avg Response Time: ${Math.round(metrics.responseTime.avg)}ms`);
        console.log(`    P95 Response Time: ${Math.round(metrics.responseTime.p95)}ms`);
      }
    });

    // Print trends
    if (Object.keys(report.performanceTrends).length > 0) {
      console.log('\n📈 Performance Trends:');
      Object.entries(report.performanceTrends).forEach(([testType, trend]) => {
        console.log(`  ${testType}: ${trend.trend} (${trend.changePercent.toFixed(1)}% change)`);
      });
    }

    // Print recommendations
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach(rec => console.log(`  - ${rec}`));
    }
  }
}

// Run the performance test runner
async function main() {
  const runner = new PerformanceTestRunner();
  runner.parseArgs();
  await runner.runTests();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = PerformanceTestRunner;



