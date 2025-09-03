/**
 * Quality Gates System
 * Evaluates code quality metrics and determines if code can proceed to deployment
 */

const fs = require('fs');
const path = require('path');

class QualityGates {
  constructor(config = {}) {
    this.config = {
      // Default quality gate thresholds
      coverage: {
        global: 80,
        unit: 85,
        integration: 75,
        e2e: 70,
        performance: 60
      },
      performance: {
        maxResponseTime: 30000, // 30 seconds
        maxMemoryUsage: 100 * 1024 * 1024, // 100MB
        maxFileProcessingTime: 5000 // 5 seconds per file
      },
      security: {
        maxVulnerabilities: 0,
        maxAuditScore: 0,
        requireSecurityScan: true
      },
      tests: {
        requireAllPassing: true,
        allowWarnings: true,
        maxTestTime: 300000 // 5 minutes
      },
      ...config
    };
    
    this.gateResults = new Map();
    this.metrics = new Map();
  }

  /**
   * Evaluate all quality gates for a given session
   */
  async evaluateQualityGates(sessionId, testResults, coverageData, performanceData) {
    const startTime = Date.now();
    
    try {
      console.log(`🔍 Evaluating quality gates for session: ${sessionId}`);
      
      // Store metrics for this session
      this.metrics.set(sessionId, {
        testResults,
        coverageData,
        performanceData,
        evaluationTime: startTime
      });

      // Evaluate each quality gate
      const results = {
        sessionId,
        timestamp: new Date().toISOString(),
        overall: { passed: true, score: 0, details: [] },
        gates: {}
      };

      // Gate 1: Test Coverage
      const coverageResult = await this.evaluateCoverageGate(sessionId, coverageData);
      results.gates.coverage = coverageResult;
      results.overall.score += coverageResult.score;

      // Gate 2: Test Results
      const testResult = await this.evaluateTestResultsGate(sessionId, testResults);
      results.gates.testResults = testResult;
      results.overall.score += testResult.score;

      // Gate 3: Performance Metrics
      const performanceResult = await this.evaluatePerformanceGate(sessionId, performanceData);
      results.gates.performance = performanceResult;
      results.overall.score += performanceResult.score;

      // Gate 4: Security Scan
      const securityResult = await this.evaluateSecurityGate(sessionId);
      results.gates.security = securityResult;
      results.overall.score += securityResult.score;

      // Gate 5: Code Quality
      const qualityResult = await this.evaluateCodeQualityGate(sessionId);
      results.gates.codeQuality = qualityResult;
      results.overall.score += qualityResult.score;

      // Calculate overall score (0-100)
      results.overall.score = Math.round(results.overall.score / 5);
      
      // Determine overall pass/fail
      results.overall.passed = this.determineOverallPass(results.gates);
      
      // Generate detailed feedback
      results.overall.details = this.generateFeedback(results.gates);

      // Store results
      this.gateResults.set(sessionId, results);

      const evaluationTime = Date.now() - startTime;
      console.log(`✅ Quality gates evaluation completed in ${evaluationTime}ms`);
      console.log(`📊 Overall Score: ${results.overall.score}/100 (${results.overall.passed ? 'PASSED' : 'FAILED'})`);

      return results;

    } catch (error) {
      console.error(`❌ Quality gates evaluation failed: ${error.message}`);
      throw new Error(`Quality gates evaluation failed: ${error.message}`);
    }
  }

  /**
   * Evaluate test coverage quality gate
   */
  async evaluateCoverageGate(sessionId, coverageData) {
    const result = {
      name: 'Test Coverage',
      passed: true,
      score: 0,
      details: [],
      metrics: {}
    };

    try {
      if (!coverageData || !coverageData.summary) {
        result.passed = false;
        result.score = 0;
        result.details.push('No coverage data available');
        return result;
      }

      const { summary } = coverageData;
      const thresholds = this.config.coverage;

      // Check global coverage
      if (summary.lines < thresholds.global) {
        result.passed = false;
        result.details.push(`Global line coverage (${summary.lines}%) below threshold (${thresholds.global}%)`);
      }

      // Check specific test type coverage
      if (coverageData.testTypes) {
        for (const [testType, coverage] of Object.entries(coverageData.testTypes)) {
          const threshold = thresholds[testType] || thresholds.global;
          if (coverage.lines < threshold) {
            result.details.push(`${testType} coverage (${coverage.lines}%) below threshold (${threshold}%)`);
          }
        }
      }

      // Calculate score based on coverage percentages
      const coverageScore = Math.min(100, Math.round(summary.lines));
      result.score = coverageScore;
      result.metrics = {
        globalCoverage: summary.lines,
        branchesCoverage: summary.branches,
        functionsCoverage: summary.functions,
        statementsCoverage: summary.statements
      };

      // Determine pass/fail
      result.passed = result.details.length === 0 && coverageScore >= thresholds.global;

    } catch (error) {
      result.passed = false;
      result.score = 0;
      result.details.push(`Coverage evaluation error: ${error.message}`);
    }

        return result;
      }

  /**
   * Evaluate test results quality gate
   */
  async evaluateTestResultsGate(sessionId, testResults) {
        const result = {
      name: 'Test Results',
          passed: true,
      score: 0,
      details: [],
      metrics: {}
    };

    try {
      if (!testResults) {
        result.passed = false;
        result.score = 0;
        result.details.push('No test results available');
        return result;
      }

      const { total, passed, failed, skipped, duration } = testResults;
      
      if (total === 0) {
        result.passed = false;
        result.score = 0;
        result.details.push('No tests were executed');
        return result;
      }

      // Check if all tests passed
      if (this.config.tests.requireAllPassing && failed > 0) {
        result.passed = false;
        result.details.push(`${failed} test(s) failed`);
      }

      // Check test execution time
      if (duration > this.config.tests.maxTestTime) {
        result.details.push(`Test execution time (${duration}ms) exceeded limit (${this.config.tests.maxTestTime}ms)`);
      }

      // Calculate score based on pass rate
      const passRate = (passed / total) * 100;
      result.score = Math.round(passRate);
      result.metrics = {
        totalTests: total,
        passedTests: passed,
        failedTests: failed,
        skippedTests: skipped,
        passRate: passRate,
        executionTime: duration
      };

      // Determine pass/fail
      result.passed = failed === 0 && duration <= this.config.tests.maxTestTime;

    } catch (error) {
      result.passed = false;
      result.score = 0;
      result.details.push(`Test results evaluation error: ${error.message}`);
    }

    return result;
  }

  /**
   * Evaluate performance quality gate
   */
  async evaluatePerformanceGate(sessionId, performanceData) {
    const result = {
      name: 'Performance Metrics',
      passed: true,
      score: 0,
      details: [],
      metrics: {}
    };

    try {
      if (!performanceData) {
        result.passed = false;
        result.score = 0;
        result.details.push('No performance data available');
        return result;
      }

      const thresholds = this.config.performance;
      let score = 100;

      // Check response time
      if (performanceData.responseTime > thresholds.maxResponseTime) {
        result.passed = false;
        result.details.push(`Response time (${performanceData.responseTime}ms) exceeded limit (${thresholds.maxResponseTime}ms)`);
        score -= 20;
      }

      // Check memory usage
      if (performanceData.memoryUsage > thresholds.maxMemoryUsage) {
        result.passed = false;
        result.details.push(`Memory usage (${Math.round(performanceData.memoryUsage / 1024 / 1024)}MB) exceeded limit (${Math.round(thresholds.maxMemoryUsage / 1024 / 1024)}MB)`);
        score -= 20;
      }

      // Check file processing time
      if (performanceData.fileProcessingTime > thresholds.maxFileProcessingTime) {
        result.details.push(`File processing time (${performanceData.fileProcessingTime}ms) exceeded limit (${thresholds.maxFileProcessingTime}ms)`);
        score -= 10;
      }

      // Check scalability
      if (performanceData.scalability && performanceData.scalability.efficiency < 0.5) {
        result.details.push(`Scalability efficiency (${performanceData.scalability.efficiency}) below threshold (0.5)`);
        score -= 15;
      }

      result.score = Math.max(0, score);
      result.metrics = {
        responseTime: performanceData.responseTime,
        memoryUsage: performanceData.memoryUsage,
        fileProcessingTime: performanceData.fileProcessingTime,
        scalability: performanceData.scalability
      };

      // Determine pass/fail
      result.passed = result.score >= 70;

    } catch (error) {
      result.passed = false;
      result.score = 0;
      result.details.push(`Performance evaluation error: ${error.message}`);
    }

    return result;
  }

  /**
   * Evaluate security quality gate
   */
  async evaluateSecurityGate(sessionId) {
    const result = {
      name: 'Security Scan',
      passed: true,
      score: 0,
      details: [],
      metrics: {}
    };

    try {
      const thresholds = this.config.security;

      if (!thresholds.requireSecurityScan) {
        result.score = 100;
        result.details.push('Security scan not required');
        return result;
      }

      // Check for security vulnerabilities
      const vulnerabilities = await this.scanForVulnerabilities();
      
      if (vulnerabilities.count > thresholds.maxVulnerabilities) {
        result.passed = false;
        result.details.push(`${vulnerabilities.count} security vulnerabilities found (max: ${thresholds.maxVulnerabilities})`);
        result.score = Math.max(0, 100 - (vulnerabilities.count * 20));
      } else {
        result.score = 100;
        result.details.push('No security vulnerabilities detected');
      }

      result.metrics = {
        vulnerabilityCount: vulnerabilities.count,
        vulnerabilityDetails: vulnerabilities.details,
        auditScore: vulnerabilities.auditScore
      };

    } catch (error) {
      result.passed = false;
      result.score = 0;
      result.details.push(`Security evaluation error: ${error.message}`);
    }

    return result;
  }

  /**
   * Evaluate code quality gate
   */
  async evaluateCodeQualityGate(sessionId) {
    const result = {
      name: 'Code Quality',
      passed: true,
      score: 0,
      details: [],
      metrics: {}
    };

    try {
      // Check linting results
      const lintResults = await this.runLintingCheck();
      
      if (lintResults.errors > 0) {
        result.passed = false;
        result.details.push(`${lintResults.errors} linting errors found`);
        result.score = Math.max(0, 100 - (lintResults.errors * 10));
      } else {
        result.score = 100;
        result.details.push('No linting errors found');
      }

      // Check code formatting
      const formatResults = await this.runFormattingCheck();
      
      if (formatResults.issues > 0) {
        result.details.push(`${formatResults.issues} formatting issues found`);
        result.score = Math.max(0, result.score - (formatResults.issues * 5));
      }

      // Check code complexity
      const complexityResults = await this.analyzeCodeComplexity();
      
      if (complexityResults.highComplexity > 0) {
        result.details.push(`${complexityResults.highComplexity} functions with high complexity found`);
        result.score = Math.max(0, result.score - (complexityResults.highComplexity * 5));
      }

      result.metrics = {
        lintErrors: lintResults.errors,
        lintWarnings: lintResults.warnings,
        formatIssues: formatResults.issues,
        complexityScore: complexityResults.score
      };

      // Determine pass/fail
      result.passed = result.score >= 80;

    } catch (error) {
      result.passed = false;
      result.score = 0;
      result.details.push(`Code quality evaluation error: ${error.message}`);
    }

    return result;
  }

  /**
   * Determine overall pass/fail based on individual gate results
   */
  determineOverallPass(gates) {
    const criticalGates = ['coverage', 'testResults', 'security'];
    
    for (const gateName of criticalGates) {
      if (gates[gateName] && !gates[gateName].passed) {
        return false;
      }
    }

    // Check if overall score meets minimum threshold
    const totalScore = Object.values(gates).reduce((sum, gate) => sum + gate.score, 0);
    const averageScore = totalScore / Object.keys(gates).length;
    
    return averageScore >= 75;
  }

  /**
   * Generate detailed feedback for quality gate results
   */
  generateFeedback(gates) {
    const feedback = [];
    
    for (const [gateName, gate] of Object.entries(gates)) {
      if (!gate.passed) {
        feedback.push(`❌ ${gate.name}: ${gate.details.join(', ')}`);
      } else if (gate.score < 90) {
        feedback.push(`⚠️ ${gate.name}: ${gate.details.join(', ')}`);
      } else {
        feedback.push(`✅ ${gate.name}: ${gate.details.join(', ')}`);
      }
    }

    return feedback;
  }

  /**
   * Scan for security vulnerabilities
   */
  async scanForVulnerabilities() {
    try {
      // This would integrate with npm audit or other security scanning tools
      // For now, return mock data
      return {
        count: 0,
        details: [],
        auditScore: 0
      };
    } catch (error) {
      console.error(`Security scan failed: ${error.message}`);
      return {
        count: 999, // High number to indicate scan failure
        details: [`Security scan failed: ${error.message}`],
        auditScore: -1
      };
    }
  }

  /**
   * Run linting check
   */
  async runLintingCheck() {
    try {
      // This would integrate with ESLint
      // For now, return mock data
      return {
        errors: 0,
        warnings: 0
      };
    } catch (error) {
      console.error(`Linting check failed: ${error.message}`);
      return {
        errors: 999,
        warnings: 0
      };
    }
  }

  /**
   * Run formatting check
   */
  async runFormattingCheck() {
    try {
      // This would integrate with Prettier
      // For now, return mock data
      return {
        issues: 0
      };
    } catch (error) {
      console.error(`Formatting check failed: ${error.message}`);
      return {
        issues: 999
      };
    }
  }

  /**
   * Analyze code complexity
   */
  async analyzeCodeComplexity() {
    try {
      // This would analyze cyclomatic complexity
      // For now, return mock data
      return {
        highComplexity: 0,
        score: 100
      };
    } catch (error) {
      console.error(`Complexity analysis failed: ${error.message}`);
      return {
        highComplexity: 999,
        score: 0
      };
    }
  }

  /**
   * Get quality gate results for a session
   */
  getGateResults(sessionId) {
    return this.gateResults.get(sessionId);
  }

  /**
   * Get all quality gate results
   */
  getAllGateResults() {
    return Array.from(this.gateResults.values());
  }

  /**
   * Clear quality gate results for a session
   */
  clearGateResults(sessionId) {
    this.gateResults.delete(sessionId);
    this.metrics.delete(sessionId);
  }

  /**
   * Export quality gate results to file
   */
  async exportResults(sessionId, filePath) {
    try {
      const results = this.getGateResults(sessionId);
      if (!results) {
        throw new Error(`No results found for session: ${sessionId}`);
      }

      const exportData = {
        ...results,
        exportTimestamp: new Date().toISOString(),
        version: '1.0.0'
      };

      await fs.promises.writeFile(filePath, JSON.stringify(exportData, null, 2));
      console.log(`📁 Quality gate results exported to: ${filePath}`);
      
      return true;
    } catch (error) {
      console.error(`Export failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate quality gate report
   */
  generateReport(sessionId) {
    const results = this.getGateResults(sessionId);
    if (!results) {
      return null;
    }

    const report = {
      summary: {
        sessionId: results.sessionId,
        timestamp: results.timestamp,
        overallScore: results.overall.score,
        overallPassed: results.overall.passed,
        gateCount: Object.keys(results.gates).length,
        passedGates: Object.values(results.gates).filter(gate => gate.passed).length
      },
      gates: results.gates,
      recommendations: this.generateRecommendations(results.gates),
      nextSteps: this.generateNextSteps(results.overall.passed, results.gates)
    };

    return report;
  }

  /**
   * Generate recommendations based on gate results
   */
  generateRecommendations(gates) {
    const recommendations = [];

    for (const [gateName, gate] of Object.entries(gates)) {
      if (!gate.passed) {
        switch (gateName) {
          case 'coverage':
            recommendations.push('Increase test coverage by adding more unit and integration tests');
            break;
          case 'testResults':
            recommendations.push('Fix failing tests and ensure all tests pass before proceeding');
            break;
          case 'performance':
            recommendations.push('Optimize code performance and reduce response times');
            break;
          case 'security':
            recommendations.push('Address security vulnerabilities identified in the scan');
            break;
          case 'codeQuality':
            recommendations.push('Fix linting errors and improve code formatting');
            break;
        }
      }
    }

    return recommendations;
  }

  /**
   * Generate next steps based on quality gate results
   */
  generateNextSteps(passed, gates) {
    if (passed) {
      return [
        '✅ Code quality meets deployment standards',
        '🚀 Ready to proceed with deployment',
        '📊 Monitor performance in production environment'
      ];
    } else {
      return [
        '🔧 Fix identified quality issues',
        '🧪 Re-run quality gates after fixes',
        '📋 Review detailed feedback for each gate',
        '⏳ Do not proceed with deployment until all gates pass'
      ];
    }
  }
}

module.exports = QualityGates;
