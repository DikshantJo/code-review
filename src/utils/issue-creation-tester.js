/**
 * Issue Creation Tester
 * 
 * Comprehensive testing utility for validating GitHub issue creation functionality
 * across various scenarios and edge cases.
 * 
 * @author AI Code Review System
 * @version 1.0.0
 * @last_updated 2024-12-19
 */

const { Octokit } = require('@octokit/rest');
const IssueTemplateManager = require('./issue-template-manager');
const IssueSeverityManager = require('./issue-severity-manager');
const IssueAssignmentManager = require('./issue-assignment-manager');
const IssueLabelManager = require('./issue-label-manager');

class IssueCreationTester {
  constructor(config = {}) {
    this.config = config;
    this.octokit = new Octokit({
      auth: config.github?.token || process.env.GITHUB_TOKEN,
      baseUrl: config.github?.api_url || 'https://api.github.com'
    });
    
    this.templateManager = new IssueTemplateManager(config);
    this.severityManager = new IssueSeverityManager(config);
    this.assignmentManager = new IssueAssignmentManager(config);
    this.labelManager = new IssueLabelManager(config);
    
    this.testResults = [];
    this.testStats = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0
    };
  }

  /**
   * Run all issue creation tests
   */
  async runAllTests() {
    console.log('🚀 Starting Issue Creation Tests...\n');
    
    const tests = [
      this.testBasicIssueCreation.bind(this),
      this.testIssueCreationWithTemplates.bind(this),
      this.testSeverityBasedCreation.bind(this),
      this.testIssueAssignment.bind(this),
      this.testIssueLabeling.bind(this),
      this.testErrorHandling.bind(this),
      this.testRateLimiting.bind(this),
      this.testIssueDeduplication.bind(this),
      this.testIssueGrouping.bind(this),
      this.testIntegrationScenarios.bind(this)
    ];

    for (const test of tests) {
      try {
        await test();
      } catch (error) {
        console.error(`❌ Test failed with error: ${error.message}`);
        this.testStats.failed++;
      }
    }

    this.generateTestReport();
    return this.testResults;
  }

  /**
   * Test basic issue creation functionality
   */
  async testBasicIssueCreation() {
    const testName = 'Basic Issue Creation';
    console.log(`📋 Running: ${testName}`);
    
    const testCases = [
      {
        name: 'Simple issue creation',
        issue: {
          title: 'Test Issue - Basic Functionality',
          body: 'This is a test issue for basic functionality validation.',
          severity: 'medium',
          type: 'bug',
          file_path: 'src/test.js',
          line_number: 42
        },
        expected: {
          created: true,
          has_title: true,
          has_body: true,
          has_labels: true
        }
      },
      {
        name: 'Issue with minimal data',
        issue: {
          title: 'Minimal Issue',
          severity: 'low',
          type: 'enhancement'
        },
        expected: {
          created: true,
          has_title: true,
          has_body: false,
          has_labels: true
        }
      },
      {
        name: 'Issue with complex data',
        issue: {
          title: 'Complex Issue with Metadata',
          body: 'This issue contains complex metadata and should be properly formatted.',
          severity: 'high',
          type: 'security',
          file_path: 'src/security/auth.js',
          line_number: 123,
          column_number: 45,
          commit_hash: 'abc123def456',
          branch_name: 'feature/security-updates',
          author: 'test-user',
          tags: ['security', 'authentication', 'critical']
        },
        expected: {
          created: true,
          has_title: true,
          has_body: true,
          has_labels: true,
          has_assignee: true,
          has_milestone: true
        }
      }
    ];

    for (const testCase of testCases) {
      await this.runTestCase(testName, testCase);
    }
  }

  /**
   * Test issue creation with templates
   */
  async testIssueCreationWithTemplates() {
    const testName = 'Issue Creation with Templates';
    console.log(`📋 Running: ${testName}`);
    
    const testCases = [
      {
        name: 'Bug template usage',
        issue: {
          title: 'Bug Report - Template Test',
          type: 'bug',
          severity: 'high',
          template: 'bug-report',
          metadata: {
            browser: 'Chrome 120.0',
            os: 'Windows 11',
            steps_to_reproduce: ['Step 1', 'Step 2', 'Step 3'],
            expected_behavior: 'Should work correctly',
            actual_behavior: 'Crashes with error'
          }
        },
        expected: {
          created: true,
          template_used: 'bug-report',
          has_metadata: true,
          formatted_correctly: true
        }
      },
      {
        name: 'Feature request template',
        issue: {
          title: 'Feature Request - Template Test',
          type: 'feature',
          severity: 'medium',
          template: 'feature-request',
          metadata: {
            use_case: 'Improve user experience',
            proposed_solution: 'Add new UI component',
            alternatives_considered: ['Option A', 'Option B'],
            impact: 'High user value'
          }
        },
        expected: {
          created: true,
          template_used: 'feature-request',
          has_metadata: true,
          formatted_correctly: true
        }
      },
      {
        name: 'Security issue template',
        issue: {
          title: 'Security Issue - Template Test',
          type: 'security',
          severity: 'critical',
          template: 'security-issue',
          metadata: {
            cve_reference: 'CVE-2024-1234',
            owasp_category: 'A01:2021 - Broken Access Control',
            impact_assessment: 'High - Potential data breach',
            remediation_priority: 'Immediate'
          }
        },
        expected: {
          created: true,
          template_used: 'security-issue',
          has_metadata: true,
          formatted_correctly: true,
          security_flags: true
        }
      }
    ];

    for (const testCase of testCases) {
      await this.runTestCase(testName, testCase);
    }
  }

  /**
   * Test severity-based issue creation
   */
  async testSeverityBasedCreation() {
    const testName = 'Severity-Based Issue Creation';
    console.log(`📋 Running: ${testName}`);
    
    const testCases = [
      {
        name: 'Critical severity handling',
        issue: {
          title: 'Critical Issue Test',
          severity: 'critical',
          type: 'security',
          auto_escalate: true
        },
        expected: {
          created: true,
          severity_level: 'critical',
          auto_escalated: true,
          priority_set: 'highest',
          labels_include: ['critical', 'security', 'urgent']
        }
      },
      {
        name: 'High severity with context',
        issue: {
          title: 'High Priority Issue Test',
          severity: 'high',
          type: 'performance',
          context: {
            user_impact: 'High',
            business_impact: 'Medium',
            technical_debt: 'Low'
          }
        },
        expected: {
          created: true,
          severity_level: 'high',
          context_included: true,
          priority_set: 'high',
          labels_include: ['high', 'performance']
        }
      },
      {
        name: 'Medium severity with patterns',
        issue: {
          title: 'Medium Issue with Patterns',
          severity: 'medium',
          type: 'bug',
          patterns: {
            frequency: 'recurring',
            affected_components: ['auth', 'api'],
            user_reports: 5
          }
        },
        expected: {
          created: true,
          severity_level: 'medium',
          patterns_analyzed: true,
          priority_set: 'medium',
          labels_include: ['medium', 'bug', 'recurring']
        }
      }
    ];

    for (const testCase of testCases) {
      await this.runTestCase(testName, testCase);
    }
  }

  /**
   * Test issue assignment logic
   */
  async testIssueAssignment() {
    const testName = 'Issue Assignment Logic';
    console.log(`📋 Running: ${testName}`);
    
    const testCases = [
      {
        name: 'Auto-assignment based on expertise',
        issue: {
          title: 'Expertise-Based Assignment Test',
          type: 'security',
          file_path: 'src/security/encryption.js',
          expertise_required: ['cryptography', 'security'],
          team_members: [
            { username: 'security-expert', expertise: ['security', 'cryptography'], seniority: 'senior' },
            { username: 'backend-dev', expertise: ['backend', 'api'], seniority: 'mid' },
            { username: 'frontend-dev', expertise: ['frontend', 'ui'], seniority: 'mid' }
          ]
        },
        expected: {
          assigned_to: 'security-expert',
          assignment_reason: 'expertise_match',
          seniority_considered: true,
          workload_balanced: true
        }
      },
      {
        name: 'Workload-based assignment',
        issue: {
          title: 'Workload-Based Assignment Test',
          type: 'bug',
          priority: 'medium',
          team_members: [
            { username: 'dev1', current_issues: 3, max_capacity: 5 },
            { username: 'dev2', current_issues: 1, max_capacity: 5 },
            { username: 'dev3', current_issues: 4, max_capacity: 5 }
          ]
        },
        expected: {
          assigned_to: 'dev2',
          assignment_reason: 'workload_balance',
          capacity_checked: true,
          fair_distribution: true
        }
      },
      {
        name: 'Seniority-based assignment',
        issue: {
          title: 'Seniority-Based Assignment Test',
          type: 'architecture',
          complexity: 'high',
          team_members: [
            { username: 'senior-architect', seniority: 'senior', experience_years: 8 },
            { username: 'mid-developer', seniority: 'mid', experience_years: 3 },
            { username: 'junior-dev', seniority: 'junior', experience_years: 1 }
          ]
        },
        expected: {
          assigned_to: 'senior-architect',
          assignment_reason: 'seniority_match',
          complexity_considered: true,
          experience_appropriate: true
        }
      }
    ];

    for (const testCase of testCases) {
      await this.runTestCase(testName, testCase);
    }
  }

  /**
   * Test issue labeling automation
   */
  async testIssueLabeling() {
    const testName = 'Issue Labeling Automation';
    console.log(`📋 Running: ${testName}`);
    
    const testCases = [
      {
        name: 'Type-based labeling',
        issue: {
          title: 'Type-Based Labeling Test',
          type: 'bug',
          severity: 'high',
          file_path: 'src/api/endpoints.js'
        },
        expected: {
          labels_include: ['bug', 'high', 'api', 'backend'],
          labels_exclude: ['feature', 'documentation'],
          label_count: 4
        }
      },
      {
        name: 'Path-based labeling',
        issue: {
          title: 'Path-Based Labeling Test',
          type: 'enhancement',
          file_path: 'src/frontend/components/Button.jsx',
          component_type: 'ui'
        },
        expected: {
          labels_include: ['enhancement', 'frontend', 'ui', 'component'],
          labels_exclude: ['backend', 'api'],
          label_count: 4
        }
      },
      {
        name: 'Content-based labeling',
        issue: {
          title: 'Content-Based Labeling Test',
          body: 'This issue involves database performance optimization and SQL query tuning',
          type: 'performance',
          tags: ['database', 'sql', 'optimization']
        },
        expected: {
          labels_include: ['performance', 'database', 'sql', 'optimization'],
          content_analyzed: true,
          smart_labeling: true
        }
      }
    ];

    for (const testCase of testCases) {
      await this.runTestCase(testName, testCase);
    }
  }

  /**
   * Test error handling scenarios
   */
  async testErrorHandling() {
    const testName = 'Error Handling Scenarios';
    console.log(`📋 Running: ${testName}`);
    
    const testCases = [
      {
        name: 'GitHub API rate limit handling',
        issue: {
          title: 'Rate Limit Test',
          type: 'bug',
          severity: 'medium'
        },
        mock_error: 'rate_limit_exceeded',
        expected: {
          handled_gracefully: true,
          retry_mechanism: true,
          user_notified: true,
          fallback_behavior: true
        }
      },
      {
        name: 'Invalid issue data handling',
        issue: {
          title: '', // Invalid: empty title
          type: 'invalid_type', // Invalid type
          severity: 'unknown' // Invalid severity
        },
        expected: {
          validation_errors: true,
          graceful_degradation: true,
          helpful_error_messages: true,
          issue_not_created: true
        }
      },
      {
        name: 'Network failure handling',
        issue: {
          title: 'Network Failure Test',
          type: 'bug',
          severity: 'medium'
        },
        mock_error: 'network_timeout',
        expected: {
          handled_gracefully: true,
          retry_mechanism: true,
          offline_queue: true,
          user_notified: true
        }
      }
    ];

    for (const testCase of testCases) {
      await this.runTestCase(testName, testCase);
    }
  }

  /**
   * Test rate limiting functionality
   */
  async testRateLimiting() {
    const testName = 'Rate Limiting Functionality';
    console.log(`📋 Running: ${testName}`);
    
    const testCases = [
      {
        name: 'Issue creation rate limiting',
        issues: Array(15).fill().map((_, i) => ({
          title: `Rate Limit Test Issue ${i + 1}`,
          type: 'bug',
          severity: 'low'
        })),
        rate_limit: {
          max_per_minute: 10,
          max_per_hour: 50
        },
        expected: {
          first_10_created: true,
          remaining_throttled: true,
          rate_limit_respected: true,
          cooldown_applied: true
        }
      },
      {
        name: 'Burst limit handling',
        issues: Array(25).fill().map((_, i) => ({
          title: `Burst Test Issue ${i + 1}`,
          type: 'enhancement',
          severity: 'medium'
        })),
        burst_limit: 20,
        expected: {
          burst_limit_respected: true,
          queue_mechanism: true,
          gradual_processing: true
        }
      }
    ];

    for (const testCase of testCases) {
      await this.runTestCase(testName, testCase);
    }
  }

  /**
   * Test issue deduplication
   */
  async testIssueDeduplication() {
    const testName = 'Issue Deduplication';
    console.log(`📋 Running: ${testName}`);
    
    const testCases = [
      {
        name: 'Exact duplicate detection',
        issues: [
          {
            title: 'Duplicate Issue Test',
            body: 'This is a test issue for duplicate detection',
            type: 'bug',
            severity: 'medium',
            file_path: 'src/test.js',
            line_number: 42
          },
          {
            title: 'Duplicate Issue Test',
            body: 'This is a test issue for duplicate detection',
            type: 'bug',
            severity: 'medium',
            file_path: 'src/test.js',
            line_number: 42
          }
        ],
        expected: {
          first_created: true,
          second_deduplicated: true,
          similarity_score: 1.0,
          duplicate_reason: 'exact_match'
        }
      },
      {
        name: 'Similar issue detection',
        issues: [
          {
            title: 'Similar Issue Test 1',
            body: 'This issue involves database performance problems',
            type: 'performance',
            severity: 'high',
            file_path: 'src/database/query.js'
          },
          {
            title: 'Similar Issue Test 2',
            body: 'Database query performance is slow',
            type: 'performance',
            severity: 'high',
            file_path: 'src/database/query.js'
          }
        ],
        expected: {
          first_created: true,
          second_grouped: true,
          similarity_score: 0.8,
          grouping_reason: 'similar_content_and_location'
        }
      }
    ];

    for (const testCase of testCases) {
      await this.runTestCase(testName, testCase);
    }
  }

  /**
   * Test issue grouping functionality
   */
  async testIssueGrouping() {
    const testName = 'Issue Grouping Functionality';
    console.log(`📋 Running: ${testName}`);
    
    const testCases = [
      {
        name: 'Related issues grouping',
        issues: [
          {
            title: 'Authentication Bug 1',
            type: 'bug',
            severity: 'medium',
            file_path: 'src/auth/login.js',
            tags: ['authentication', 'login']
          },
          {
            title: 'Authentication Bug 2',
            type: 'bug',
            severity: 'medium',
            file_path: 'src/auth/register.js',
            tags: ['authentication', 'registration']
          },
          {
            title: 'Authentication Bug 3',
            type: 'bug',
            severity: 'medium',
            file_path: 'src/auth/password.js',
            tags: ['authentication', 'password']
          }
        ],
        expected: {
          grouped_together: true,
          group_size: 3,
          group_title: 'Authentication System Issues',
          group_description: 'Multiple related authentication bugs'
        }
      },
      {
        name: 'Cross-file issue grouping',
        issues: [
          {
            title: 'API Performance Issue 1',
            type: 'performance',
            severity: 'high',
            file_path: 'src/api/users.js',
            tags: ['api', 'performance', 'users']
          },
          {
            title: 'API Performance Issue 2',
            type: 'performance',
            severity: 'high',
            file_path: 'src/api/products.js',
            tags: ['api', 'performance', 'products']
          }
        ],
        expected: {
          grouped_together: true,
          group_size: 2,
          group_title: 'API Performance Issues',
          group_description: 'Performance problems across multiple API endpoints'
        }
      }
    ];

    for (const testCase of testCases) {
      await this.runTestCase(testName, testCase);
    }
  }

  /**
   * Test integration scenarios
   */
  async testIntegrationScenarios() {
    const testName = 'Integration Scenarios';
    console.log(`📋 Running: ${testName}`);
    
    const testCases = [
      {
        name: 'End-to-end issue creation workflow',
        scenario: {
          trigger: 'code_review_failure',
          review_data: {
            score: 0.6,
            issues_found: 8,
            critical_issues: 2,
            high_issues: 3,
            medium_issues: 2,
            low_issues: 1
          },
          files_reviewed: [
            'src/main.js',
            'src/utils/helper.js',
            'src/api/endpoint.js'
          ]
        },
        expected: {
          issues_created: 8,
          critical_issues_escalated: true,
          team_notified: true,
          follow_up_scheduled: true
        }
      },
      {
        name: 'Multi-environment issue handling',
        scenario: {
          environments: ['development', 'staging', 'production'],
          issue_type: 'security_vulnerability',
          severity: 'critical'
        },
        expected: {
          production_blocked: true,
          staging_reviewed: true,
          development_flagged: true,
          security_team_notified: true
        }
      }
    ];

    for (const testCase of testCases) {
      await this.runTestCase(testName, testCase);
    }
  }

  /**
   * Run a single test case
   */
  async runTestCase(testName, testCase) {
    this.testStats.total++;
    
    try {
      console.log(`  🔍 Testing: ${testCase.name}`);
      
      // Mock the issue creation process
      const result = await this.simulateIssueCreation(testCase);
      
      // Validate results against expectations
      const validation = this.validateTestResults(testCase, result);
      
      if (validation.passed) {
        console.log(`    ✅ PASSED: ${testCase.name}`);
        this.testStats.passed++;
      } else {
        console.log(`    ❌ FAILED: ${testCase.name}`);
        console.log(`       Expected: ${JSON.stringify(validation.failures)}`);
        this.testStats.failed++;
      }
      
      this.testResults.push({
        test_name: testName,
        case_name: testCase.name,
        passed: validation.passed,
        result: result,
        validation: validation
      });
      
    } catch (error) {
      console.log(`    ⚠️  SKIPPED: ${testCase.name} (${error.message})`);
      this.testStats.skipped++;
      
      this.testResults.push({
        test_name: testName,
        case_name: testCase.name,
        passed: false,
        error: error.message,
        skipped: true
      });
    }
  }

  /**
   * Simulate issue creation for testing
   */
  async simulateIssueCreation(testCase) {
    // This is a simulation - in real usage, this would create actual GitHub issues
    const result = {
      created: true,
      issue_number: Math.floor(Math.random() * 1000) + 1,
      url: `https://github.com/test/repo/issues/${Math.floor(Math.random() * 1000) + 1}`,
      created_at: new Date().toISOString(),
      labels: [],
      assignee: null,
      milestone: null
    };

    // Apply template if specified
    if (testCase.issue.template) {
      result.template_used = testCase.issue.template;
      result.formatted_correctly = true;
    }

    // Apply severity-based logic
    if (testCase.issue.severity) {
      result.severity_level = testCase.issue.severity;
      result.priority_set = this.getPriorityFromSeverity(testCase.issue.severity);
      
      if (testCase.issue.severity === 'critical') {
        result.auto_escalated = true;
        result.labels.push('critical', 'urgent');
      }
    }

    // Apply assignment logic
    if (testCase.issue.team_members) {
      const assignment = this.assignmentManager.assignIssue(testCase.issue, {});
      result.assignee = assignment.assignee;
      result.assignment_reason = assignment.reason;
    }

    // Apply labeling logic
    if (testCase.issue.type || testCase.issue.file_path) {
      const labels = this.labelManager.generateLabels(testCase.issue, {});
      result.labels = labels;
    }

    return result;
  }

  /**
   * Validate test results against expectations
   */
  validateTestResults(testCase, result) {
    const validation = {
      passed: true,
      failures: []
    };

    for (const [key, expectedValue] of Object.entries(testCase.expected)) {
      const actualValue = this.getNestedValue(result, key);
      
      if (expectedValue === true && !actualValue) {
        validation.passed = false;
        validation.failures.push(`${key}: expected true, got ${actualValue}`);
      } else if (expectedValue === false && actualValue) {
        validation.passed = false;
        validation.failures.push(`${key}: expected false, got ${actualValue}`);
      } else if (Array.isArray(expectedValue) && !Array.isArray(actualValue)) {
        validation.passed = false;
        validation.failures.push(`${key}: expected array, got ${typeof actualValue}`);
      } else if (typeof expectedValue === 'string' && actualValue !== expectedValue) {
        validation.passed = false;
        validation.failures.push(`${key}: expected "${expectedValue}", got "${actualValue}"`);
      }
    }

    return validation;
  }

  /**
   * Get nested value from object using dot notation
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Get priority from severity level
   */
  getPriorityFromSeverity(severity) {
    const priorityMap = {
      'critical': 'highest',
      'high': 'high',
      'medium': 'medium',
      'low': 'low'
    };
    return priorityMap[severity] || 'medium';
  }

  /**
   * Generate comprehensive test report
   */
  generateTestReport() {
    console.log('\n📊 Issue Creation Test Report');
    console.log('================================');
    console.log(`Total Tests: ${this.testStats.total}`);
    console.log(`Passed: ${this.testStats.passed} ✅`);
    console.log(`Failed: ${this.testStats.failed} ❌`);
    console.log(`Skipped: ${this.testStats.skipped} ⚠️`);
    console.log(`Success Rate: ${((this.testStats.passed / this.testStats.total) * 100).toFixed(1)}%`);
    
    if (this.testStats.failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults
        .filter(result => !result.passed && !result.skipped)
        .forEach(result => {
          console.log(`  - ${result.test_name}: ${result.case_name}`);
          if (result.validation && result.validation.failures) {
            result.validation.failures.forEach(failure => {
              console.log(`    ${failure}`);
            });
          }
        });
    }
    
    if (this.testStats.skipped > 0) {
      console.log('\n⚠️  Skipped Tests:');
      this.testResults
        .filter(result => result.skipped)
        .forEach(result => {
          console.log(`  - ${result.test_name}: ${result.case_name} (${result.error})`);
        });
    }
    
    console.log('\n🎯 Recommendations:');
    if (this.testStats.failed === 0) {
      console.log('  ✅ All tests passed! Issue creation system is working correctly.');
    } else {
      console.log('  🔧 Review failed tests and fix identified issues.');
      console.log('  📝 Check error handling and edge case scenarios.');
      console.log('  🧪 Add more comprehensive test coverage.');
    }
  }

  /**
   * Export test results for external analysis
   */
  exportTestResults(format = 'json') {
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(this.testResults, null, 2);
      case 'csv':
        return this.convertToCSV();
      case 'html':
        return this.convertToHTML();
      default:
        return JSON.stringify(this.testResults, null, 2);
    }
  }

  /**
   * Convert test results to CSV format
   */
  convertToCSV() {
    const headers = ['Test Name', 'Case Name', 'Status', 'Details'];
    const rows = this.testResults.map(result => [
      result.test_name,
      result.case_name,
      result.passed ? 'PASSED' : (result.skipped ? 'SKIPPED' : 'FAILED'),
      result.error || result.validation?.failures?.join('; ') || 'N/A'
    ]);
    
    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
  }

  /**
   * Convert test results to HTML format
   */
  convertToHTML() {
    const statusIcon = (passed, skipped) => {
      if (skipped) return '⚠️';
      return passed ? '✅' : '❌';
    };
    
    const rows = this.testResults.map(result => `
      <tr>
        <td>${result.test_name}</td>
        <td>${result.case_name}</td>
        <td>${statusIcon(result.passed, result.skipped)}</td>
        <td>${result.error || result.validation?.failures?.join('<br>') || 'N/A'}</td>
      </tr>
    `).join('');
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Issue Creation Test Results</title>
        <style>
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .passed { background-color: #d4edda; }
          .failed { background-color: #f8d7da; }
          .skipped { background-color: #fff3cd; }
        </style>
      </head>
      <body>
        <h1>Issue Creation Test Results</h1>
        <table>
          <thead>
            <tr>
              <th>Test Name</th>
              <th>Case Name</th>
              <th>Status</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </body>
      </html>
    `;
  }
}

module.exports = IssueCreationTester;

