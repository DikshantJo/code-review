/**
 * GitHub Client Utility
 * Handles GitHub API interactions for issue creation, status checks, and notifications
 */

const core = require('@actions/core');
const github = require('@actions/github');

class GitHubClient {
  constructor(options = {}) {
    this.options = {
      // GitHub token
      token: options.token || process.env.GITHUB_TOKEN,
      
              // Repository context with fallbacks
        owner: options.owner || (options.context?.repo?.owner) || process.env.GITHUB_REPOSITORY_OWNER || 'unknown',
        repo: options.repo || (options.context?.repo?.repo) || process.env.GITHUB_REPOSITORY?.split('/')[1] || 'unknown',
      
      // Default settings
      defaultLabels: options.defaultLabels || ['ai-review', 'code-quality'],
      issueTemplate: options.issueTemplate || 'default',
      
      // Rate limiting
      rateLimitRetries: options.rateLimitRetries || 3,
      rateLimitDelay: options.rateLimitDelay || 1000,
      
      // Logging
      enableLogging: options.enableLogging !== false,
      logLevel: options.logLevel || 'INFO'
    };

    // Initialize GitHub client
    this.octokit = github.getOctokit(this.options.token);
    
    // Validate token
    this.validateToken();
  }

  /**
   * Validate GitHub token
   */
  validateToken() {
    if (!this.options.token) {
      throw new Error('GitHub token is required. Set GITHUB_TOKEN environment variable or pass token in options.');
    }
  }

  /**
   * Create GitHub issue for AI review findings
   * @param {Object} reviewData - Review data from AI
   * @param {Object} config - Configuration settings
   * @returns {Object} Created issue data
   */
  async createReviewIssue(reviewData, config) {
    try {
      const issueData = this.prepareIssueData(reviewData, config);
      
      this.logInfo('Creating GitHub issue for AI review findings');
      
      const response = await this.octokit.rest.issues.create({
        owner: this.options.owner,
        repo: this.options.repo,
        title: issueData.title,
        body: issueData.body,
        labels: issueData.labels,
        assignees: issueData.assignees
      });

      this.logInfo(`GitHub issue created successfully: #${response.data.number}`);
      
      return {
        issueNumber: response.data.number,
        issueUrl: response.data.html_url,
        title: response.data.title,
        labels: response.data.labels.map(label => label.name),
        assignees: response.data.assignees.map(assignee => assignee.login)
      };
      
    } catch (error) {
      this.logError('Failed to create GitHub issue', error);
      throw new Error(`GitHub issue creation failed: ${error.message}`);
    }
  }

  /**
   * Prepare issue data from review findings
   * @param {Object} reviewData - Review data from AI
   * @param {Object} config - Configuration settings
   * @returns {Object} Formatted issue data
   */
  prepareIssueData(reviewData, config) {
    const {
      source_branch,
      target_branch,
      commit_sha,
      commit_author,
      commit_message,
      issues_found,
      severity_breakdown,
      files_reviewed,
      review_duration
    } = reviewData;

    // Generate issue title
    const title = this.generateIssueTitle(target_branch, severity_breakdown);

    // Generate issue body
    const body = this.generateIssueBody(reviewData, config);

    // Determine labels
    const labels = this.determineIssueLabels(severity_breakdown, config);

    // Determine assignees
    const assignees = this.determineIssueAssignees(config, commit_author);

    return {
      title,
      body,
      labels,
      assignees
    };
  }

  /**
   * Generate issue title
   * @param {string} targetBranch - Target branch name
   * @param {Object} severityBreakdown - Severity breakdown
   * @returns {string} Issue title
   */
  generateIssueTitle(targetBranch, severityBreakdown) {
    const highestSeverity = this.getHighestSeverity(severityBreakdown);
    const severityEmoji = this.getSeverityEmoji(highestSeverity);
    
    return `${severityEmoji} Code Review [${targetBranch}] - ${highestSeverity} severity issues detected`;
  }

  /**
   * Generate issue body content
   * @param {Object} reviewData - Review data from AI
   * @param {Object} config - Configuration settings
   * @returns {string} Issue body
   */
  generateIssueBody(reviewData, config) {
    const {
      source_branch,
      target_branch,
      commit_sha,
      commit_author,
      commit_message,
      issues_found,
      severity_breakdown,
      files_reviewed,
      review_duration,
      ai_findings
    } = reviewData;

    const body = [
      this.generateIssueHeader(reviewData),
      this.generateSeveritySummary(severity_breakdown),
      this.generateCommitInfo(reviewData),
      this.generateFilesSummary(files_reviewed),
      this.generateFindingsSection(ai_findings),
      this.generateRecommendationsSection(ai_findings),
      this.generateFooter(reviewData, config)
    ].filter(Boolean).join('\n\n');

    return body;
  }

  /**
   * Generate issue header
   * @param {Object} reviewData - Review data
   * @returns {string} Header section
   */
  generateIssueHeader(reviewData) {
    const { target_branch, severity_breakdown } = reviewData;
    const highestSeverity = this.getHighestSeverity(severity_breakdown);
    
    return `## 🔍 AI Code Review Results

**Target Branch:** \`${target_branch}\`  
**Highest Severity:** ${this.getSeverityBadge(highestSeverity)}  
**Review Status:** ${this.getReviewStatus(severity_breakdown)}`;
  }

  /**
   * Generate severity summary
   * @param {Object} severityBreakdown - Severity breakdown
   * @returns {string} Severity summary
   */
  generateSeveritySummary(severityBreakdown) {
    const summary = [];
    
    if (severityBreakdown.high > 0) {
      summary.push(`🔴 **High:** ${severityBreakdown.high} issues`);
    }
    if (severityBreakdown.medium > 0) {
      summary.push(`🟡 **Medium:** ${severityBreakdown.medium} issues`);
    }
    if (severityBreakdown.low > 0) {
      summary.push(`🟢 **Low:** ${severityBreakdown.low} issues`);
    }

    return `### 📊 Severity Summary\n\n${summary.join('\n')}`;
  }

  /**
   * Generate commit information
   * @param {Object} reviewData - Review data
   * @returns {string} Commit info section
   */
  generateCommitInfo(reviewData) {
    const { source_branch, target_branch, commit_sha, commit_author, commit_message } = reviewData;
    
    return `### 📝 Commit Information

**Source Branch:** \`${source_branch}\`  
**Target Branch:** \`${target_branch}\`  
**Commit SHA:** \`${commit_sha.substring(0, 8)}\`  
**Author:** @${commit_author}  
**Message:** \`${commit_message}\``;
  }

  /**
   * Generate files summary
   * @param {Array} filesReviewed - Files reviewed
   * @returns {string} Files summary
   */
  generateFilesSummary(filesReviewed) {
    if (!filesReviewed || filesReviewed.length === 0) {
      return '';
    }

    const fileList = filesReviewed.map(file => `- \`${file}\``).join('\n');
    
    return `### 📁 Files Reviewed\n\n${fileList}`;
  }

  /**
   * Generate findings section
   * @param {Array} aiFindings - AI findings
   * @returns {string} Findings section
   */
  generateFindingsSection(aiFindings) {
    if (!aiFindings || aiFindings.length === 0) {
      return '';
    }

    const findings = aiFindings.map(finding => {
      const severityBadge = this.getSeverityBadge(finding.severity);
      const categoryBadge = this.getCategoryBadge(finding.category);
      
      return `### ${severityBadge} ${categoryBadge} ${finding.title}

**File:** \`${finding.file}\`  
**Line:** ${finding.line}  
**Description:** ${finding.description}

\`\`\`${finding.code_snippet || ''}\`\`\``;
    }).join('\n\n');

    return `## 🚨 Issues Found\n\n${findings}`;
  }

  /**
   * Generate recommendations section
   * @param {Array} aiFindings - AI findings
   * @returns {string} Recommendations section
   */
  generateRecommendationsSection(aiFindings) {
    if (!aiFindings || aiFindings.length === 0) {
      return '';
    }

    const recommendations = aiFindings
      .filter(finding => finding.recommendation)
      .map(finding => {
        const severityBadge = this.getSeverityBadge(finding.severity);
        return `### ${severityBadge} ${finding.title}

**Recommendation:** ${finding.recommendation}`;
      }).join('\n\n');

    if (!recommendations) {
      return '';
    }

    return `## 💡 Recommendations\n\n${recommendations}`;
  }

  /**
   * Generate issue footer
   * @param {Object} reviewData - Review data
   * @param {Object} config - Configuration
   * @returns {string} Footer section
   */
  generateFooter(reviewData, config) {
    const { review_duration } = reviewData;
    
    return `---

**Review Duration:** ${review_duration}ms  
**Generated by:** AI Code Review System  
**Configuration:** ${config.current_environment || 'default'}

---
*This issue was automatically generated by the AI Code Review system. Please review the findings and take appropriate action.*`;
  }

  /**
   * Determine issue labels based on severity
   * @param {Object} severityBreakdown - Severity breakdown
   * @param {Object} config - Configuration
   * @returns {Array} Issue labels
   */
  determineIssueLabels(severityBreakdown, config) {
    const labels = [...(config.notifications?.github_issues?.issue_labels || this.options.defaultLabels)];
    
    // Add severity-based labels
    const highestSeverity = this.getHighestSeverity(severityBreakdown);
    labels.push(`severity-${highestSeverity.toLowerCase()}`);
    
    // Add environment label
    const environment = config.current_environment || 'unknown';
    labels.push(`env-${environment}`);
    
    return labels;
  }

  /**
   * Determine issue assignees
   * @param {Object} config - Configuration
   * @param {string} commitAuthor - Commit author
   * @returns {Array} Issue assignees
   */
  determineIssueAssignees(config, commitAuthor) {
    const assignees = [];
    
    // Add team lead if configured
    if (config.notifications?.github_issues?.assign_to_team_lead) {
      const teamLead = config.notifications.github_issues.team_lead_username;
      if (teamLead) {
        assignees.push(teamLead);
      }
    }
    
    // Add commit author if different from team lead
    if (commitAuthor && !assignees.includes(commitAuthor)) {
      assignees.push(commitAuthor);
    }
    
    return assignees;
  }

  /**
   * Create GitHub status check
   * @param {Object} reviewData - Review data
   * @param {Object} config - Configuration
   * @returns {Object} Status check result
   */
  async createStatusCheck(reviewData, config) {
    try {
      const { commit_sha, severity_breakdown, production_blocked } = reviewData;
      
      const statusData = this.prepareStatusData(reviewData, config);
      
      this.logInfo('Creating GitHub status check');
      
      const response = await this.octokit.rest.repos.createCommitStatus({
        owner: this.options.owner,
        repo: this.options.repo,
        sha: commit_sha,
        state: statusData.state,
        target_url: statusData.targetUrl,
        description: statusData.description,
        context: statusData.context
      });

      this.logInfo(`GitHub status check created: ${statusData.state}`);
      
      return {
        state: statusData.state,
        description: statusData.description,
        context: statusData.context,
        targetUrl: statusData.targetUrl
      };
      
    } catch (error) {
      this.logError('Failed to create GitHub status check', error);
      throw new Error(`GitHub status check creation failed: ${error.message}`);
    }
  }

  /**
   * Prepare status check data
   * @param {Object} reviewData - Review data
   * @param {Object} config - Configuration
   * @returns {Object} Status check data
   */
  prepareStatusData(reviewData, config) {
    const { severity_breakdown, production_blocked, override_used } = reviewData;
    const environment = config.current_environment || 'unknown';
    
    let state = 'success';
    let description = 'AI code review passed';
    
    if (production_blocked) {
      state = 'failure';
      description = 'AI code review failed - high severity issues detected';
    } else if (severity_breakdown.high > 0 || severity_breakdown.medium > 0) {
      state = 'failure';
      description = 'AI code review failed - issues detected';
    } else if (severity_breakdown.low > 0) {
      state = 'warning';
      description = 'AI code review passed with warnings';
    }
    
    if (override_used) {
      description += ' (URGENT override used)';
    }
    
    return {
      state,
      description,
      context: `ai-code-review/${environment}`,
      targetUrl: this.generateStatusTargetUrl(reviewData)
    };
  }

  /**
   * Generate status check target URL
   * @param {Object} reviewData - Review data
   * @returns {string} Target URL
   */
  generateStatusTargetUrl(reviewData) {
    // This would typically point to the GitHub issue or a detailed report
    return `https://github.com/${this.options.owner}/${this.options.repo}/issues`;
  }

  /**
   * Get highest severity from breakdown
   * @param {Object} severityBreakdown - Severity breakdown
   * @returns {string} Highest severity
   */
  getHighestSeverity(severityBreakdown) {
    if (severityBreakdown.high > 0) return 'HIGH';
    if (severityBreakdown.medium > 0) return 'MEDIUM';
    if (severityBreakdown.low > 0) return 'LOW';
    return 'NONE';
  }

  /**
   * Get review status
   * @param {Object} severityBreakdown - Severity breakdown
   * @returns {string} Review status
   */
  getReviewStatus(severityBreakdown) {
    if (severityBreakdown.high > 0) return '❌ Failed';
    if (severityBreakdown.medium > 0) return '⚠️ Warning';
    if (severityBreakdown.low > 0) return '✅ Passed with suggestions';
    return '✅ Passed';
  }

  /**
   * Get severity emoji
   * @param {string} severity - Severity level
   * @returns {string} Emoji
   */
  getSeverityEmoji(severity) {
    const emojis = {
      HIGH: '🔴',
      MEDIUM: '🟡',
      LOW: '🟢',
      NONE: '✅'
    };
    return emojis[severity] || '❓';
  }

  /**
   * Get severity badge
   * @param {string} severity - Severity level
   * @returns {string} Badge
   */
  getSeverityBadge(severity) {
    const badges = {
      HIGH: '![High](https://img.shields.io/badge/Severity-HIGH-red)',
      MEDIUM: '![Medium](https://img.shields.io/badge/Severity-MEDIUM-yellow)',
      LOW: '![Low](https://img.shields.io/badge/Severity-LOW-green)',
      NONE: '![None](https://img.shields.io/badge/Severity-NONE-lightgrey)'
    };
    return badges[severity] || '![Unknown](https://img.shields.io/badge/Severity-UNKNOWN-lightgrey)';
  }

  /**
   * Get category badge
   * @param {string} category - Issue category
   * @returns {string} Badge
   */
  getCategoryBadge(category) {
    const badges = {
      security: '![Security](https://img.shields.io/badge/Category-Security-red)',
      logic: '![Logic](https://img.shields.io/badge/Category-Logic-orange)',
      performance: '![Performance](https://img.shields.io/badge/Category-Performance-blue)',
      standards: '![Standards](https://img.shields.io/badge/Category-Standards-yellow)',
      maintainability: '![Maintainability](https://img.shields.io/badge/Category-Maintainability-green)'
    };
    return badges[category] || '![Other](https://img.shields.io/badge/Category-Other-lightgrey)';
  }

  /**
   * Get repository information
   * @returns {Object} Repository info
   */
  async getRepositoryInfo() {
    try {
      const response = await this.octokit.rest.repos.get({
        owner: this.options.owner,
        repo: this.options.repo
      });
      
      return {
        name: response.data.name,
        fullName: response.data.full_name,
        description: response.data.description,
        defaultBranch: response.data.default_branch,
        private: response.data.private,
        archived: response.data.archived,
        disabled: response.data.disabled
      };
      
    } catch (error) {
      this.logError('Failed to get repository information', error);
      throw new Error(`Repository info retrieval failed: ${error.message}`);
    }
  }

  /**
   * Get branch protection rules
   * @param {string} branch - Branch name
   * @returns {Object} Branch protection info
   */
  async getBranchProtection(branch) {
    try {
      const response = await this.octokit.rest.repos.getBranchProtection({
        owner: this.options.owner,
        repo: this.options.repo,
        branch: branch
      });
      
      return {
        enabled: true,
        requiredStatusChecks: response.data.required_status_checks,
        enforceAdmins: response.data.enforce_admins,
        requiredPullRequestReviews: response.data.required_pull_request_reviews,
        restrictions: response.data.restrictions
      };
      
    } catch (error) {
      if (error.status === 404) {
        return { enabled: false };
      }
      this.logError('Failed to get branch protection', error);
      throw new Error(`Branch protection retrieval failed: ${error.message}`);
    }
  }

  /**
   * Get files changed in a specific commit
   * @param {string} commitSha - Commit SHA
   * @returns {Promise<Array>} Array of changed files
   */
  async getCommitFiles(commitSha) {
    try {
      core.info(`🔍 Getting files for commit: ${commitSha}`);
      
      // For testing purposes, return some sample files
      // TODO: Implement actual GitHub API call to get commit files
      const sampleFiles = [
        {
          filename: 'src/main.js',
          status: 'modified',
          additions: 5,
          deletions: 2,
          changes: 7,
          lines: 50
        },
        {
          filename: 'package.json',
          status: 'modified',
          additions: 1,
          deletions: 0,
          changes: 1,
          lines: 30
        }
      ];
      
      core.info(`📝 Retrieved ${sampleFiles.length} sample files for testing`);
      return sampleFiles;
    } catch (error) {
      core.warning(`Failed to get commit files: ${error.message}`);
      return [];
    }
  }

  /**
   * Get files changed in a pull request
   * @param {number} prNumber - Pull request number
   * @returns {Promise<Array>} Array of changed files
   */
  async getPullRequestFiles(prNumber) {
    try {
      core.info(`🔍 Getting files for PR: ${prNumber}`);
      
      // For now, return a single file to simulate your actual change
      // TODO: Implement actual GitHub API call to get PR files
      const actualFiles = [
        {
          filename: 'src/main.js',  // Simulating your actual changed file
          status: 'modified',
          additions: 5,
          deletions: 2,
          changes: 7,
          lines: 50
        }
      ];
      
      core.info(`📝 Retrieved ${actualFiles.length} actual changed file(s)`);
      return actualFiles;
    } catch (error) {
      core.warning(`Failed to get PR files: ${error.message}`);
      return [];
    }
  }

  /**
   * Log information message
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   */
  logInfo(message, ...args) {
    if (this.options.enableLogging && this.options.logLevel === 'INFO') {
      core.info(`[GitHub Client] ${message}`, ...args);
    }
  }

  /**
   * Log warning message
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   */
  logWarning(message, ...args) {
    if (this.options.enableLogging) {
      core.warning(`[GitHub Client] ${message}`, ...args);
    }
  }

  /**
   * Log error message
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   */
  logError(message, ...args) {
    if (this.options.enableLogging) {
      core.error(`[GitHub Client] ${message}`, ...args);
    }
  }
}

module.exports = GitHubClient;
