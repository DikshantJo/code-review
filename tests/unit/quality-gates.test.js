/**
 * Unit Tests for Quality Gates System
 */

const QualityGates = require('../../src/utils/quality-gates');

describe('QualityGates', () => {
  let qualityGates;
  let mockTestResults;
  let mockCoverageData;
  let mockPerformanceData;

  beforeEach(() => {
    qualityGates = new QualityGates();
    
    // Mock test results
    mockTestResults = {
      total: 100,
      passed: 95,
      failed: 5,
      skipped: 0,
      duration: 120000 // 2 minutes
    };

    // Mock coverage data
    mockCoverageData = {
      summary: {
        lines: 85,
        branches: 80,
        functions: 88,
        statements: 87
      },
      testTypes: {
        unit: { lines: 90, branches: 85, functions: 92, statements: 90 },
        integration: { lines: 80, branches: 75, functions: 85, statements: 82 },
        e2e: { lines: 75, branches: 70, functions: 80, statements: 78 },
        performance: { lines: 65, branches: 60, functions: 70, statements: 68 }
      }
    };

    // Mock performance data
    mockPerformanceData = {
      responseTime: 15000, // 15 seconds
      memoryUsage: 50 * 1024 * 1024, // 50MB
      fileProcessingTime: 3000, // 3 seconds
      scalability: {
        efficiency: 0.8
      }
    };
  });

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      expect(qualityGates.config.coverage.global).toBe(80);
      expect(qualityGates.config.performance.maxResponseTime).toBe(30000);
      expect(qualityGates.config.security.maxVulnerabilities).toBe(0);
      expect(qualityGates.config.tests.requireAllPassing).toBe(true);
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        coverage: { global: 90 },
        performance: { maxResponseTime: 60000 }
      };
      
      const customQualityGates = new QualityGates(customConfig);
      expect(customQualityGates.config.coverage.global).toBe(90);
      expect(customQualityGates.config.performance.maxResponseTime).toBe(60000);
    });

    it('should initialize empty maps for results and metrics', () => {
      expect(qualityGates.gateResults).toBeInstanceOf(Map);
      expect(qualityGates.metrics).toBeInstanceOf(Map);
      expect(qualityGates.gateResults.size).toBe(0);
      expect(qualityGates.metrics.size).toBe(0);
    });
  });

  describe('evaluateQualityGates', () => {
    it('should evaluate all quality gates successfully', async () => {
      const sessionId = 'test-session-123';
      const results = await qualityGates.evaluateQualityGates(
        sessionId,
        mockTestResults,
        mockCoverageData,
        mockPerformanceData
      );

      expect(results.sessionId).toBe(sessionId);
      expect(results.timestamp).toBeDefined();
      expect(results.overall).toBeDefined();
      expect(results.gates).toBeDefined();
      expect(results.gates.coverage).toBeDefined();
      expect(results.gates.testResults).toBeDefined();
      expect(results.gates.performance).toBeDefined();
      expect(results.gates.security).toBeDefined();
      expect(results.gates.codeQuality).toBeDefined();
    });

    it('should store metrics for the session', async () => {
      const sessionId = 'test-session-456';
      await qualityGates.evaluateQualityGates(
        sessionId,
        mockTestResults,
        mockCoverageData,
        mockPerformanceData
      );

      const metrics = qualityGates.metrics.get(sessionId);
      expect(metrics).toBeDefined();
      expect(metrics.testResults).toEqual(mockTestResults);
      expect(metrics.coverageData).toEqual(mockCoverageData);
      expect(metrics.performanceData).toEqual(mockPerformanceData);
    });

    it('should handle missing data gracefully', async () => {
      const sessionId = 'test-session-missing-data';
      const results = await qualityGates.evaluateQualityGates(
        sessionId,
        null,
        null,
        null
      );

      expect(results.overall.passed).toBe(false);
      expect(results.gates.coverage.passed).toBe(false);
      expect(results.gates.testResults.passed).toBe(false);
      expect(results.gates.performance.passed).toBe(false);
    });

    it('should calculate overall score correctly', async () => {
      const sessionId = 'test-session-score';
      const results = await qualityGates.evaluateQualityGates(
        sessionId,
        mockTestResults,
        mockCoverageData,
        mockPerformanceData
      );

      expect(results.overall.score).toBeGreaterThanOrEqual(0);
      expect(results.overall.score).toBeLessThanOrEqual(100);
      expect(typeof results.overall.score).toBe('number');
    });
  });

  describe('evaluateCoverageGate', () => {
    it('should pass when coverage meets thresholds', async () => {
      const sessionId = 'test-coverage-pass';
      const result = await qualityGates.evaluateCoverageGate(sessionId, mockCoverageData);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(85);
      expect(result.details.length).toBe(0);
      expect(result.metrics.globalCoverage).toBe(85);
    });

    it('should fail when global coverage is below threshold', async () => {
      const lowCoverageData = {
        summary: { lines: 75, branches: 70, functions: 78, statements: 77 },
        testTypes: mockCoverageData.testTypes
      };

      const sessionId = 'test-coverage-fail';
      const result = await qualityGates.evaluateCoverageGate(sessionId, lowCoverageData);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(75);
      expect(result.details.length).toBeGreaterThan(0);
      expect(result.details[0]).toContain('below threshold');
    });

    it('should handle missing coverage data', async () => {
      const sessionId = 'test-coverage-missing';
      const result = await qualityGates.evaluateCoverageGate(sessionId, null);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.details[0]).toContain('No coverage data available');
    });

    it('should check test type specific thresholds', async () => {
      const mixedCoverageData = {
        summary: { lines: 85, branches: 80, functions: 88, statements: 87 },
        testTypes: {
          unit: { lines: 80, branches: 75, functions: 82, statements: 80 }, // Below 85% threshold
          integration: { lines: 80, branches: 75, functions: 85, statements: 82 }, // Meets 75% threshold
          e2e: { lines: 65, branches: 60, functions: 70, statements: 68 } // Below 70% threshold
        }
      };

      const sessionId = 'test-coverage-mixed';
      const result = await qualityGates.evaluateCoverageGate(sessionId, mixedCoverageData);

      expect(result.passed).toBe(false);
      expect(result.details.length).toBeGreaterThan(0);
      expect(result.details.some(detail => detail.includes('unit'))).toBe(true);
      expect(result.details.some(detail => detail.includes('e2e'))).toBe(true);
    });
  });

  describe('evaluateTestResultsGate', () => {
    it('should pass when all tests pass', async () => {
      const passingTestResults = {
        total: 100,
        passed: 100,
        failed: 0,
        skipped: 0,
        duration: 120000
      };

      const sessionId = 'test-results-pass';
      const result = await qualityGates.evaluateTestResultsGate(sessionId, passingTestResults);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(100);
      expect(result.details.length).toBe(0);
    });

    it('should fail when tests fail', async () => {
      const failingTestResults = {
        total: 100,
        passed: 90,
        failed: 10,
        skipped: 0,
        duration: 120000
      };

      const sessionId = 'test-results-fail';
      const result = await qualityGates.evaluateTestResultsGate(sessionId, failingTestResults);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(90);
      expect(result.details.some(detail => detail.includes('10 test(s) failed'))).toBe(true);
    });

    it('should fail when execution time exceeds limit', async () => {
      const slowTestResults = {
        total: 100,
        passed: 100,
        failed: 0,
        skipped: 0,
        duration: 400000 // 6.7 minutes, exceeds 5 minute limit
      };

      const sessionId = 'test-results-slow';
      const result = await qualityGates.evaluateTestResultsGate(sessionId, slowTestResults);

      expect(result.passed).toBe(false);
      expect(result.details.some(detail => detail.includes('exceeded limit'))).toBe(true);
    });

    it('should handle missing test results', async () => {
      const sessionId = 'test-results-missing';
      const result = await qualityGates.evaluateTestResultsGate(sessionId, null);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.details[0]).toContain('No test results available');
    });

    it('should fail when no tests were executed', async () => {
      const noTestResults = {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0
      };

      const sessionId = 'test-results-none';
      const result = await qualityGates.evaluateTestResultsGate(sessionId, noTestResults);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.details[0]).toContain('No tests were executed');
    });
  });

  describe('evaluatePerformanceGate', () => {
    it('should pass when performance meets thresholds', async () => {
      const sessionId = 'test-performance-pass';
      const result = await qualityGates.evaluatePerformanceGate(sessionId, mockPerformanceData);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(100);
      expect(result.details.length).toBe(0);
    });

    it('should fail when response time exceeds limit', async () => {
      const slowPerformanceData = {
        ...mockPerformanceData,
        responseTime: 40000 // 40 seconds, exceeds 30 second limit
      };

      const sessionId = 'test-performance-slow';
      const result = await qualityGates.evaluatePerformanceGate(sessionId, slowPerformanceData);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(80); // 100 - 20
      expect(result.details.some(detail => detail.includes('Response time'))).toBe(true);
    });

    it('should fail when memory usage exceeds limit', async () => {
      const highMemoryData = {
        ...mockPerformanceData,
        memoryUsage: 150 * 1024 * 1024 // 150MB, exceeds 100MB limit
      };

      const sessionId = 'test-performance-memory';
      const result = await qualityGates.evaluatePerformanceGate(sessionId, highMemoryData);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(80); // 100 - 20
      expect(result.details.some(detail => detail.includes('Memory usage'))).toBe(true);
    });

    it('should handle missing performance data', async () => {
      const sessionId = 'test-performance-missing';
      const result = await qualityGates.evaluatePerformanceGate(sessionId, null);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.details[0]).toContain('No performance data available');
    });

    it('should penalize poor scalability', async () => {
      const poorScalabilityData = {
        ...mockPerformanceData,
        scalability: { efficiency: 0.3 } // Below 0.5 threshold
      };

      const sessionId = 'test-performance-scalability';
      const result = await qualityGates.evaluatePerformanceGate(sessionId, poorScalabilityData);

      expect(result.score).toBe(85); // 100 - 15
      expect(result.details.some(detail => detail.includes('Scalability efficiency'))).toBe(true);
    });
  });

  describe('evaluateSecurityGate', () => {
    it('should pass when no vulnerabilities are found', async () => {
      const sessionId = 'test-security-pass';
      const result = await qualityGates.evaluateSecurityGate(sessionId);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(100);
      expect(result.details[0]).toContain('No security vulnerabilities detected');
    });

    it('should fail when vulnerabilities exceed threshold', async () => {
      // Mock the scanForVulnerabilities method to return vulnerabilities
      jest.spyOn(qualityGates, 'scanForVulnerabilities').mockResolvedValue({
        count: 5,
        details: ['CVE-2023-1234', 'CVE-2023-5678'],
        auditScore: -50
      });

      const sessionId = 'test-security-vulnerabilities';
      const result = await qualityGates.evaluateSecurityGate(sessionId);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0); // 100 - (5 * 20) = 0
      expect(result.details[0]).toContain('5 security vulnerabilities found');

      jest.restoreAllMocks();
    });

    it('should handle security scan failures', async () => {
      // Mock the scanForVulnerabilities method to throw an error
      jest.spyOn(qualityGates, 'scanForVulnerabilities').mockRejectedValue(
        new Error('Security scan failed')
      );

      const sessionId = 'test-security-scan-fail';
      const result = await qualityGates.evaluateSecurityGate(sessionId);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.details[0]).toContain('Security evaluation error');

      jest.restoreAllMocks();
    });
  });

  describe('evaluateCodeQualityGate', () => {
    it('should pass when code quality meets standards', async () => {
      const sessionId = 'test-quality-pass';
      const result = await qualityGates.evaluateCodeQualityGate(sessionId);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(100);
      expect(result.details[0]).toContain('No linting errors found');
    });

    it('should fail when linting errors are found', async () => {
      // Mock the runLintingCheck method to return errors
      jest.spyOn(qualityGates, 'runLintingCheck').mockResolvedValue({
        errors: 3,
        warnings: 5
      });

      const sessionId = 'test-quality-lint-errors';
      const result = await qualityGates.evaluateCodeQualityGate(sessionId);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(70); // 100 - (3 * 10)
      expect(result.details[0]).toContain('3 linting errors found');

      jest.restoreAllMocks();
    });

    it('should handle formatting issues', async () => {
      // Mock the runFormattingCheck method to return issues
      jest.spyOn(qualityGates, 'runFormattingCheck').mockResolvedValue({
        issues: 2
      });

      const sessionId = 'test-quality-format-issues';
      const result = await qualityGates.evaluateCodeQualityGate(sessionId);

      expect(result.score).toBe(90); // 100 - (2 * 5)
      expect(result.details.some(detail => detail.includes('2 formatting issues found'))).toBe(true);

      jest.restoreAllMocks();
    });

    it('should handle high complexity functions', async () => {
      // Mock the analyzeCodeComplexity method to return high complexity
      jest.spyOn(qualityGates, 'analyzeCodeComplexity').mockResolvedValue({
        highComplexity: 4,
        score: 80
      });

      const sessionId = 'test-quality-complexity';
      const result = await qualityGates.evaluateCodeQualityGate(sessionId);

      expect(result.score).toBe(80); // 100 - (4 * 5)
      expect(result.details.some(detail => detail.includes('4 functions with high complexity found'))).toBe(true);

      jest.restoreAllMocks();
    });
  });

  describe('determineOverallPass', () => {
    it('should pass when all critical gates pass', () => {
      const passingGates = {
        coverage: { passed: true, score: 85 },
        testResults: { passed: true, score: 95 },
        security: { passed: true, score: 100 },
        performance: { passed: true, score: 90 },
        codeQuality: { passed: true, score: 95 }
      };

      const result = qualityGates.determineOverallPass(passingGates);
      expect(result).toBe(true);
    });

    it('should fail when coverage gate fails', () => {
      const failingGates = {
        coverage: { passed: false, score: 70 },
        testResults: { passed: true, score: 95 },
        security: { passed: true, score: 100 },
        performance: { passed: true, score: 90 },
        codeQuality: { passed: true, score: 95 }
      };

      const result = qualityGates.determineOverallPass(failingGates);
      expect(result).toBe(false);
    });

    it('should fail when test results gate fails', () => {
      const failingGates = {
        coverage: { passed: true, score: 85 },
        testResults: { passed: false, score: 80 },
        security: { passed: true, score: 100 },
        performance: { passed: true, score: 90 },
        codeQuality: { passed: true, score: 95 }
      };

      const result = qualityGates.determineOverallPass(failingGates);
      expect(result).toBe(false);
    });

    it('should fail when security gate fails', () => {
      const failingGates = {
        coverage: { passed: true, score: 85 },
        testResults: { passed: true, score: 95 },
        security: { passed: false, score: 60 },
        performance: { passed: true, score: 90 },
        codeQuality: { passed: true, score: 95 }
      };

      const result = qualityGates.determineOverallPass(failingGates);
      expect(result).toBe(false);
    });

    it('should pass when critical gates pass but non-critical fail', () => {
      const mixedGates = {
        coverage: { passed: true, score: 85 },
        testResults: { passed: true, score: 95 },
        security: { passed: true, score: 100 },
        performance: { passed: false, score: 65 },
        codeQuality: { passed: false, score: 75 }
      };

      const result = qualityGates.determineOverallPass(mixedGates);
      expect(result).toBe(true);
    });
  });

  describe('generateFeedback', () => {
    it('should generate feedback for all gates', () => {
      const gates = {
        coverage: { name: 'Test Coverage', passed: true, details: ['Good coverage'] },
        testResults: { name: 'Test Results', passed: false, details: ['Some tests failed'] },
        performance: { name: 'Performance', passed: true, details: ['Good performance'], score: 95 }
      };

      const feedback = qualityGates.generateFeedback(gates);
      expect(feedback.length).toBe(3);
      expect(feedback[0]).toContain('✅ Test Coverage');
      expect(feedback[1]).toContain('❌ Test Results');
      expect(feedback[2]).toContain('⚠️ Performance');
    });
  });

  describe('Utility Methods', () => {
    it('should get gate results for a session', async () => {
      const sessionId = 'test-session-util';
      await qualityGates.evaluateQualityGates(
        sessionId,
        mockTestResults,
        mockCoverageData,
        mockPerformanceData
      );

      const results = qualityGates.getGateResults(sessionId);
      expect(results).toBeDefined();
      expect(results.sessionId).toBe(sessionId);
    });

    it('should get all gate results', async () => {
      const sessionId1 = 'test-session-1';
      const sessionId2 = 'test-session-2';

      await qualityGates.evaluateQualityGates(
        sessionId1,
        mockTestResults,
        mockCoverageData,
        mockPerformanceData
      );

      await qualityGates.evaluateQualityGates(
        sessionId2,
        mockTestResults,
        mockCoverageData,
        mockPerformanceData
      );

      const allResults = qualityGates.getAllGateResults();
      expect(allResults.length).toBe(2);
    });

    it('should clear gate results for a session', async () => {
      const sessionId = 'test-session-clear';
      await qualityGates.evaluateQualityGates(
        sessionId,
        mockTestResults,
        mockCoverageData,
        mockPerformanceData
      );

      expect(qualityGates.getGateResults(sessionId)).toBeDefined();
      qualityGates.clearGateResults(sessionId);
      expect(qualityGates.getGateResults(sessionId)).toBeUndefined();
    });

    it('should generate report for a session', async () => {
      const sessionId = 'test-session-report';
      await qualityGates.evaluateQualityGates(
        sessionId,
        mockTestResults,
        mockCoverageData,
        mockPerformanceData
      );

      const report = qualityGates.generateReport(sessionId);
      expect(report).toBeDefined();
      expect(report.summary.sessionId).toBe(sessionId);
      expect(report.gates).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.nextSteps).toBeDefined();
    });

    it('should return null for non-existent session report', () => {
      const report = qualityGates.generateReport('non-existent');
      expect(report).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in coverage evaluation gracefully', async () => {
      // Mock coverage data that will cause an error
      const invalidCoverageData = {
        summary: null // This will cause an error in the evaluation
      };

      const sessionId = 'test-error-coverage';
      const result = await qualityGates.evaluateCoverageGate(sessionId, invalidCoverageData);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.details[0]).toContain('Coverage evaluation error');
    });

    it('should handle errors in test results evaluation gracefully', async () => {
      // Mock test results that will cause an error
      const invalidTestResults = {
        total: 'invalid', // This will cause an error in the evaluation
        passed: 95,
        failed: 5
      };

      const sessionId = 'test-error-test-results';
      const result = await qualityGates.evaluateTestResultsGate(sessionId, invalidTestResults);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.details[0]).toContain('Test results evaluation error');
    });

    it('should handle errors in performance evaluation gracefully', async () => {
      // Mock performance data that will cause an error
      const invalidPerformanceData = {
        responseTime: 'invalid', // This will cause an error in the evaluation
        memoryUsage: 50 * 1024 * 1024
      };

      const sessionId = 'test-error-performance';
      const result = await qualityGates.evaluatePerformanceGate(sessionId, invalidPerformanceData);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.details[0]).toContain('Performance evaluation error');
    });
  });
});
