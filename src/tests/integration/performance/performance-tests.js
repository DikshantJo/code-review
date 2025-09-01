const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

/**
 * Performance Tests for AI Code Review System
 * Tests API response times, throughput, and system performance under load
 */

class PerformanceTestSuite {
  constructor() {
    this.results = [];
    this.config = {
      openai: {
        timeout: 30000,
        maxRetries: 3,
        rateLimit: 10 // requests per minute
      },
      github: {
        timeout: 15000,
        maxRetries: 3,
        rateLimit: 30 // requests per minute
      },
      workflow: {
        timeout: 120000, // 2 minutes
        maxConcurrent: 5
      }
    };
  }

  /**
   * Run all performance tests
   */
  async runAllTests() {
    console.log('🚀 Starting Performance Test Suite...');
    
    const tests = [
      this.testOpenAIResponseTime.bind(this),
      this.testGitHubAPIPerformance.bind(this),
      this.testWorkflowThroughput.bind(this),
      this.testConcurrentReviews.bind(this),
      this.testLargeFileHandling.bind(this),
      this.testMemoryUsage.bind(this),
      this.testErrorRecoveryPerformance.bind(this)
    ];

    for (const test of tests) {
      try {
        await test();
      } catch (error) {
        console.error(`❌ Performance test failed: ${error.message}`);
        this.results.push({
          test: test.name,
          status: 'failed',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    await this.generateReport();
  }

  /**
   * Test OpenAI API response time
   */
  async testOpenAIResponseTime() {
    console.log('📊 Testing OpenAI API Response Time...');
    
    const testCases = [
      { name: 'Small Code Review', tokens: 1000, expectedTime: 5000 },
      { name: 'Medium Code Review', tokens: 5000, expectedTime: 15000 },
      { name: 'Large Code Review', tokens: 15000, expectedTime: 30000 }
    ];

    for (const testCase of testCases) {
      const startTime = Date.now();
      
      try {
        // Simulate OpenAI API call with mock data
        const mockResponse = await this.simulateOpenAICall(testCase.tokens);
        const responseTime = Date.now() - startTime;
        
        this.results.push({
          test: 'OpenAI Response Time',
          scenario: testCase.name,
          responseTime,
          expectedTime: testCase.expectedTime,
          status: responseTime <= testCase.expectedTime ? 'passed' : 'warning',
          tokens: testCase.tokens,
          timestamp: new Date().toISOString()
        });

        console.log(`  ✅ ${testCase.name}: ${responseTime}ms (expected: ${testCase.expectedTime}ms)`);
      } catch (error) {
        this.results.push({
          test: 'OpenAI Response Time',
          scenario: testCase.name,
          error: error.message,
          status: 'failed',
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  /**
   * Test GitHub API performance
   */
  async testGitHubAPIPerformance() {
    console.log('📊 Testing GitHub API Performance...');
    
    const operations = [
      { name: 'Get Pull Request Files', endpoint: 'GET /repos/{owner}/{repo}/pulls/{pull_number}/files' },
      { name: 'Create Issue', endpoint: 'POST /repos/{owner}/{repo}/issues' },
      { name: 'Get Commit Details', endpoint: 'GET /repos/{owner}/{repo}/commits/{sha}' },
      { name: 'Update Status Check', endpoint: 'POST /repos/{owner}/{repo}/statuses/{sha}' }
    ];

    for (const operation of operations) {
      const startTime = Date.now();
      
      try {
        // Simulate GitHub API call
        await this.simulateGitHubAPICall(operation.endpoint);
        const responseTime = Date.now() - startTime;
        
        this.results.push({
          test: 'GitHub API Performance',
          operation: operation.name,
          responseTime,
          expectedTime: 2000,
          status: responseTime <= 2000 ? 'passed' : 'warning',
          timestamp: new Date().toISOString()
        });

        console.log(`  ✅ ${operation.name}: ${responseTime}ms`);
      } catch (error) {
        this.results.push({
          test: 'GitHub API Performance',
          operation: operation.name,
          error: error.message,
          status: 'failed',
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  /**
   * Test workflow throughput
   */
  async testWorkflowThroughput() {
    console.log('📊 Testing Workflow Throughput...');
    
    const scenarios = [
      { name: 'Single Review', reviews: 1, expectedTime: 60000 },
      { name: 'Batch Review (5)', reviews: 5, expectedTime: 180000 },
      { name: 'High Volume (10)', reviews: 10, expectedTime: 300000 }
    ];

    for (const scenario of scenarios) {
      const startTime = Date.now();
      
      try {
        const results = await this.simulateBatchReviews(scenario.reviews);
        const totalTime = Date.now() - startTime;
        const avgTime = totalTime / scenario.reviews;
        
        this.results.push({
          test: 'Workflow Throughput',
          scenario: scenario.name,
          totalTime,
          averageTime: avgTime,
          reviewsCompleted: results.length,
          expectedTime: scenario.expectedTime,
          status: totalTime <= scenario.expectedTime ? 'passed' : 'warning',
          timestamp: new Date().toISOString()
        });

        console.log(`  ✅ ${scenario.name}: ${totalTime}ms total, ${avgTime}ms avg per review`);
      } catch (error) {
        this.results.push({
          test: 'Workflow Throughput',
          scenario: scenario.name,
          error: error.message,
          status: 'failed',
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  /**
   * Test concurrent review handling
   */
  async testConcurrentReviews() {
    console.log('📊 Testing Concurrent Review Handling...');
    
    const concurrencyLevels = [1, 3, 5, 10];
    
    for (const concurrency of concurrencyLevels) {
      const startTime = Date.now();
      
      try {
        const promises = Array(concurrency).fill().map(() => 
          this.simulateSingleReview()
        );
        
        const results = await Promise.allSettled(promises);
        const totalTime = Date.now() - startTime;
        const successful = results.filter(r => r.status === 'fulfilled').length;
        
        this.results.push({
          test: 'Concurrent Reviews',
          concurrency,
          totalTime,
          successful,
          failed: concurrency - successful,
          successRate: (successful / concurrency) * 100,
          status: successful === concurrency ? 'passed' : 'warning',
          timestamp: new Date().toISOString()
        });

        console.log(`  ✅ Concurrency ${concurrency}: ${totalTime}ms, ${successful}/${concurrency} successful`);
      } catch (error) {
        this.results.push({
          test: 'Concurrent Reviews',
          concurrency,
          error: error.message,
          status: 'failed',
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  /**
   * Test large file handling performance
   */
  async testLargeFileHandling() {
    console.log('📊 Testing Large File Handling...');
    
    const fileSizes = [
      { name: 'Small File (1KB)', size: 1024 },
      { name: 'Medium File (100KB)', size: 102400 },
      { name: 'Large File (1MB)', size: 1048576 },
      { name: 'Very Large File (5MB)', size: 5242880 }
    ];

    for (const fileSize of fileSizes) {
      const startTime = Date.now();
      
      try {
        const mockFile = this.generateMockFile(fileSize.size);
        const processingTime = await this.simulateFileProcessing(mockFile);
        const totalTime = Date.now() - startTime;
        
        this.results.push({
          test: 'Large File Handling',
          fileSize: fileSize.name,
          processingTime,
          totalTime,
          fileSizeBytes: fileSize.size,
          status: processingTime <= 10000 ? 'passed' : 'warning',
          timestamp: new Date().toISOString()
        });

        console.log(`  ✅ ${fileSize.name}: ${processingTime}ms processing time`);
      } catch (error) {
        this.results.push({
          test: 'Large File Handling',
          fileSize: fileSize.name,
          error: error.message,
          status: 'failed',
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  /**
   * Test memory usage under load
   */
  async testMemoryUsage() {
    console.log('📊 Testing Memory Usage...');
    
    const initialMemory = process.memoryUsage();
    const memorySnapshots = [];
    
    // Simulate memory-intensive operations
    for (let i = 0; i < 10; i++) {
      const snapshot = process.memoryUsage();
      memorySnapshots.push({
        iteration: i,
        heapUsed: snapshot.heapUsed,
        heapTotal: snapshot.heapTotal,
        external: snapshot.external,
        rss: snapshot.rss
      });
      
      // Simulate processing large data
      await this.simulateMemoryIntensiveOperation();
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }
    
    const finalMemory = process.memoryUsage();
    const memoryGrowth = {
      heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
      heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
      external: finalMemory.external - initialMemory.external,
      rss: finalMemory.rss - initialMemory.rss
    };
    
    this.results.push({
      test: 'Memory Usage',
      initialMemory: {
        heapUsed: initialMemory.heapUsed,
        heapTotal: initialMemory.heapTotal,
        external: initialMemory.external,
        rss: initialMemory.rss
      },
      finalMemory: {
        heapUsed: finalMemory.heapUsed,
        heapTotal: finalMemory.heapTotal,
        external: finalMemory.external,
        rss: finalMemory.rss
      },
      memoryGrowth,
      snapshots: memorySnapshots,
      status: memoryGrowth.heapUsed < 50 * 1024 * 1024 ? 'passed' : 'warning', // 50MB threshold
      timestamp: new Date().toISOString()
    });

    console.log(`  ✅ Memory growth: ${Math.round(memoryGrowth.heapUsed / 1024 / 1024)}MB`);
  }

  /**
   * Test error recovery performance
   */
  async testErrorRecoveryPerformance() {
    console.log('📊 Testing Error Recovery Performance...');
    
    const errorScenarios = [
      { name: 'Network Timeout', type: 'timeout', expectedRecoveryTime: 5000 },
      { name: 'Rate Limit Exceeded', type: 'rateLimit', expectedRecoveryTime: 10000 },
      { name: 'API Error', type: 'apiError', expectedRecoveryTime: 3000 },
      { name: 'Invalid Response', type: 'invalidResponse', expectedRecoveryTime: 2000 }
    ];

    for (const scenario of errorScenarios) {
      const startTime = Date.now();
      
      try {
        await this.simulateErrorRecovery(scenario.type);
        const recoveryTime = Date.now() - startTime;
        
        this.results.push({
          test: 'Error Recovery Performance',
          scenario: scenario.name,
          recoveryTime,
          expectedTime: scenario.expectedRecoveryTime,
          status: recoveryTime <= scenario.expectedRecoveryTime ? 'passed' : 'warning',
          timestamp: new Date().toISOString()
        });

        console.log(`  ✅ ${scenario.name}: ${recoveryTime}ms recovery time`);
      } catch (error) {
        this.results.push({
          test: 'Error Recovery Performance',
          scenario: scenario.name,
          error: error.message,
          status: 'failed',
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  /**
   * Simulate OpenAI API call
   */
  async simulateOpenAICall(tokenCount) {
    // Simulate API call delay based on token count
    const baseDelay = 1000;
    const tokenDelay = tokenCount * 0.5;
    const delay = baseDelay + tokenDelay;
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return {
      id: 'mock-response-id',
      tokens: tokenCount,
      response: 'Mock AI review response'
    };
  }

  /**
   * Simulate GitHub API call
   */
  async simulateGitHubAPICall(endpoint) {
    // Simulate different endpoint response times
    const delays = {
      'GET /repos/{owner}/{repo}/pulls/{pull_number}/files': 500,
      'POST /repos/{owner}/{repo}/issues': 1000,
      'GET /repos/{owner}/{repo}/commits/{sha}': 300,
      'POST /repos/{owner}/{repo}/statuses/{sha}': 400
    };
    
    const delay = delays[endpoint] || 500;
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return { endpoint, status: 'success' };
  }

  /**
   * Simulate batch reviews
   */
  async simulateBatchReviews(count) {
    const reviews = [];
    
    for (let i = 0; i < count; i++) {
      const review = await this.simulateSingleReview();
      reviews.push(review);
    }
    
    return reviews;
  }

  /**
   * Simulate single review
   */
  async simulateSingleReview() {
    const startTime = Date.now();
    
    // Simulate review workflow steps
    await this.simulateGitHubAPICall('GET /repos/{owner}/{repo}/pulls/{pull_number}/files');
    await this.simulateOpenAICall(2000);
    await this.simulateGitHubAPICall('POST /repos/{owner}/{repo}/issues');
    
    return {
      id: `review-${Date.now()}`,
      duration: Date.now() - startTime,
      status: 'completed'
    };
  }

  /**
   * Generate mock file content
   */
  generateMockFile(size) {
    const chunk = 'const mockCode = "This is mock JavaScript code for testing purposes";\n';
    const chunks = Math.ceil(size / chunk.length);
    return chunk.repeat(chunks).substring(0, size);
  }

  /**
   * Simulate file processing
   */
  async simulateFileProcessing(content) {
    const startTime = Date.now();
    
    // Simulate file processing operations
    const lines = content.split('\n').length;
    const processingDelay = lines * 0.1; // 0.1ms per line
    
    await new Promise(resolve => setTimeout(resolve, processingDelay));
    
    return Date.now() - startTime;
  }

  /**
   * Simulate memory intensive operation
   */
  async simulateMemoryIntensiveOperation() {
    // Create temporary large objects
    const tempData = [];
    for (let i = 0; i < 1000; i++) {
      tempData.push({
        id: i,
        data: 'x'.repeat(1000),
        timestamp: Date.now()
      });
    }
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Clear references to allow garbage collection
    tempData.length = 0;
  }

  /**
   * Simulate error recovery
   */
  async simulateErrorRecovery(errorType) {
    const recoveryDelays = {
      timeout: 3000,
      rateLimit: 8000,
      apiError: 2000,
      invalidResponse: 1000
    };
    
    const delay = recoveryDelays[errorType] || 2000;
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return { errorType, recovered: true };
  }

  /**
   * Generate performance report
   */
  async generateReport() {
    console.log('\n📋 Generating Performance Test Report...');
    
    const report = {
      summary: {
        totalTests: this.results.length,
        passed: this.results.filter(r => r.status === 'passed').length,
        warnings: this.results.filter(r => r.status === 'warning').length,
        failed: this.results.filter(r => r.status === 'failed').length,
        timestamp: new Date().toISOString()
      },
      results: this.results,
      recommendations: this.generateRecommendations()
    };

    // Save report to file
    const reportPath = path.join(process.cwd(), 'performance-test-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    // Print summary
    console.log('\n📊 Performance Test Summary:');
    console.log(`  Total Tests: ${report.summary.totalTests}`);
    console.log(`  Passed: ${report.summary.passed}`);
    console.log(`  Warnings: ${report.summary.warnings}`);
    console.log(`  Failed: ${report.summary.failed}`);
    console.log(`  Report saved to: ${reportPath}`);
    
    // Print recommendations
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach(rec => console.log(`  - ${rec}`));
    }
  }

  /**
   * Generate recommendations based on test results
   */
  generateRecommendations() {
    const recommendations = [];
    
    // Analyze response times
    const openaiTests = this.results.filter(r => r.test === 'OpenAI Response Time');
    const slowResponses = openaiTests.filter(r => r.status === 'warning');
    
    if (slowResponses.length > 0) {
      recommendations.push('Consider implementing response caching for OpenAI API calls');
      recommendations.push('Review token usage optimization strategies');
    }
    
    // Analyze concurrent performance
    const concurrentTests = this.results.filter(r => r.test === 'Concurrent Reviews');
    const lowSuccessRates = concurrentTests.filter(r => r.successRate < 100);
    
    if (lowSuccessRates.length > 0) {
      recommendations.push('Implement better rate limiting and retry mechanisms');
      recommendations.push('Consider using connection pooling for API calls');
    }
    
    // Analyze memory usage
    const memoryTests = this.results.filter(r => r.test === 'Memory Usage');
    const highMemoryGrowth = memoryTests.filter(r => r.status === 'warning');
    
    if (highMemoryGrowth.length > 0) {
      recommendations.push('Implement memory leak detection and cleanup');
      recommendations.push('Consider streaming large file processing');
    }
    
    return recommendations;
  }
}

// Run performance tests if executed directly
if (require.main === module) {
  const testSuite = new PerformanceTestSuite();
  testSuite.runAllTests().catch(console.error);
}

module.exports = PerformanceTestSuite;



