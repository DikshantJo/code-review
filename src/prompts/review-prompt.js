/**
 * Structured Prompt Generation Utility
 * Generates consistent and effective prompts for AI code review
 */

class ReviewPromptGenerator {
  constructor(config = {}) {
    this.config = {
      // Prompt Configuration
      includeContext: config.includeContext !== false,
      includeFileMetadata: config.includeFileMetadata !== false,
      includeReviewHistory: config.includeReviewHistory !== false,
      maxContextLength: config.maxContextLength || 1000,
      
      // Review Criteria
      defaultCriteria: config.defaultCriteria || this.getDefaultReviewCriteria(),
      
      // Language-specific prompts
      languagePrompts: config.languagePrompts || this.getLanguageSpecificPrompts(),
      
      // Response format
      responseFormat: config.responseFormat || this.getDefaultResponseFormat(),
      
      // Prompt templates
      templates: config.templates || this.getPromptTemplates()
    };
  }

  /**
   * Get default review criteria
   * @returns {Object} Default review criteria
   */
  getDefaultReviewCriteria() {
    return {
      security: {
        enabled: true,
        priority: 'HIGH',
        checks: [
          'SQL injection vulnerabilities',
          'XSS vulnerabilities',
          'CSRF vulnerabilities',
          'Authentication bypass',
          'Authorization flaws',
          'Input validation issues',
          'Sensitive data exposure',
          'Insecure dependencies'
        ]
      },
      logic: {
        enabled: true,
        priority: 'HIGH',
        checks: [
          'Null pointer exceptions',
          'Array bounds checking',
          'Type safety issues',
          'Race conditions',
          'Deadlock potential',
          'Resource leaks',
          'Error handling gaps',
          'Edge case handling'
        ]
      },
      performance: {
        enabled: true,
        priority: 'MEDIUM',
        checks: [
          'Inefficient algorithms',
          'Memory leaks',
          'Unnecessary computations',
          'Database query optimization',
          'Network call optimization',
          'Resource usage patterns',
          'Caching opportunities',
          'Async/await usage'
        ]
      },
      standards: {
        enabled: true,
        priority: 'MEDIUM',
        checks: [
          'Code style consistency',
          'Naming conventions',
          'Function complexity',
          'Code duplication',
          'Documentation quality',
          'Error handling patterns',
          'Logging standards',
          'Testing coverage'
        ]
      },
      maintainability: {
        enabled: true,
        priority: 'LOW',
        checks: [
          'Code readability',
          'Function length',
          'Class design',
          'Separation of concerns',
          'Dependency management',
          'Configuration management',
          'Code organization',
          'Future-proofing'
        ]
      }
    };
  }

  /**
   * Get language-specific prompts
   * @returns {Object} Language-specific prompt additions
   */
  getLanguageSpecificPrompts() {
    return {
      javascript: {
        additionalChecks: [
          'ESLint rule violations',
          'Promise handling',
          'Async/await patterns',
          'Event listener cleanup',
          'Memory leaks in closures',
          'Prototype pollution',
          'Type coercion issues'
        ],
        bestPractices: [
          'Use const/let instead of var',
          'Prefer arrow functions for callbacks',
          'Handle promises properly',
          'Use strict mode',
          'Avoid global variables'
        ]
      },
      typescript: {
        additionalChecks: [
          'Type safety violations',
          'Interface compliance',
          'Generic type usage',
          'Type assertion safety',
          'Null/undefined handling',
          'Enum usage patterns'
        ],
        bestPractices: [
          'Use strict type checking',
          'Prefer interfaces over types',
          'Use readonly when appropriate',
          'Handle optional properties',
          'Use union types effectively'
        ]
      },
      python: {
        additionalChecks: [
          'PEP 8 violations',
          'Exception handling',
          'Context manager usage',
          'List comprehensions',
          'Generator usage',
          'Decorator patterns'
        ],
        bestPractices: [
          'Use virtual environments',
          'Follow PEP 8 style guide',
          'Use type hints',
          'Handle exceptions properly',
          'Use context managers'
        ]
      },
      java: {
        additionalChecks: [
          'Null pointer exceptions',
          'Exception handling',
          'Resource management',
          'Thread safety',
          'Memory leaks',
          'Design patterns'
        ],
        bestPractices: [
          'Use try-with-resources',
          'Handle exceptions properly',
          'Use immutable objects',
          'Follow naming conventions',
          'Use appropriate access modifiers'
        ]
      }
    };
  }

  /**
   * Get default response format
   * @returns {Object} Default response format specification
   */
  getDefaultResponseFormat() {
    return {
      structure: {
        summary: {
          overall_status: 'PASS|FAIL|WARNING',
          total_issues: 'number',
          high_severity: 'number',
          medium_severity: 'number',
          low_severity: 'number',
          confidence_score: 'number (0-1)'
        },
        issues: [
          {
            file: 'string',
            line: 'number',
            severity: 'HIGH|MEDIUM|LOW',
            category: 'SECURITY|LOGIC|PERFORMANCE|STANDARDS|MAINTAINABILITY',
            title: 'string',
            description: 'string',
            recommendation: 'string',
            code_snippet: 'string (optional)',
            cwe_id: 'string (optional, for security issues)',
            confidence: 'number (0-1)'
          }
        ],
        recommendations: {
          immediate_actions: ['array of strings'],
          long_term_improvements: ['array of strings'],
          priority_order: ['array of issue IDs']
        },
        metadata: {
          review_duration: 'number (seconds)',
          files_reviewed: 'number',
          total_lines: 'number',
          language_distribution: 'object'
        }
      },
      validation: {
        required_fields: ['summary', 'issues', 'recommendations'],
        severity_values: ['HIGH', 'MEDIUM', 'LOW'],
        category_values: ['SECURITY', 'LOGIC', 'PERFORMANCE', 'STANDARDS', 'MAINTAINABILITY'],
        status_values: ['PASS', 'FAIL', 'WARNING']
      }
    };
  }

  /**
   * Get prompt templates
   * @returns {Object} Prompt templates
   */
  getPromptTemplates() {
    return {
      system: this.getSystemPromptTemplate(),
      context: this.getContextPromptTemplate(),
      review: this.getReviewPromptTemplate(),
      language: this.getLanguagePromptTemplate()
    };
  }

  /**
   * Generate system prompt
   * @param {Object} options - Generation options
   * @returns {string} System prompt
   */
  generateSystemPrompt(options = {}) {
    const {
      targetBranch = 'main',
      severityThreshold = 'MEDIUM',
      reviewCriteria = this.config.defaultCriteria,
      environment = 'production'
    } = options;

    let prompt = this.config.templates.system;

    // Replace placeholders
    prompt = prompt.replace('{{TARGET_BRANCH}}', targetBranch);
    prompt = prompt.replace('{{SEVERITY_THRESHOLD}}', severityThreshold);
    prompt = prompt.replace('{{ENVIRONMENT}}', environment);

    // Add review criteria
    const criteriaText = this.formatReviewCriteria(reviewCriteria);
    prompt = prompt.replace('{{REVIEW_CRITERIA}}', criteriaText);

    // Add response format
    const formatText = this.formatResponseFormat();
    prompt = prompt.replace('{{RESPONSE_FORMAT}}', formatText);

    return prompt;
  }

  /**
   * Generate context prompt
   * @param {Object} options - Context options
   * @returns {string} Context prompt
   */
  generateContextPrompt(options = {}) {
    const {
      branchInfo,
      commitInfo,
      fileChanges,
      reviewHistory = []
    } = options;

    let prompt = this.config.templates.context;

    // Add branch information
    if (branchInfo) {
      prompt = prompt.replace('{{BRANCH_INFO}}', this.formatBranchInfo(branchInfo));
    }

    // Add commit information
    if (commitInfo) {
      prompt = prompt.replace('{{COMMIT_INFO}}', this.formatCommitInfo(commitInfo));
    }

    // Add file changes summary
    if (fileChanges) {
      prompt = prompt.replace('{{FILE_CHANGES}}', this.formatFileChanges(fileChanges));
    }

    // Add review history
    if (reviewHistory.length > 0 && this.config.includeReviewHistory) {
      prompt = prompt.replace('{{REVIEW_HISTORY}}', this.formatReviewHistory(reviewHistory));
    }

    return prompt;
  }

  /**
   * Generate review prompt for specific files
   * @param {Array} files - Files to review
   * @param {Object} options - Review options
   * @returns {string} Review prompt
   */
  generateReviewPrompt(files, options = {}) {
    const {
      language = 'auto',
      focusAreas = [],
      excludePatterns = []
    } = options;

    let prompt = this.config.templates.review;

    // Add language-specific guidance
    if (language !== 'auto' && this.config.languagePrompts[language]) {
      const languagePrompt = this.config.templates.language;
      const languageGuidance = this.formatLanguageGuidance(language);
      prompt = prompt.replace('{{LANGUAGE_GUIDANCE}}', languageGuidance);
    }

    // Add focus areas
    if (focusAreas.length > 0) {
      const focusText = this.formatFocusAreas(focusAreas);
      prompt = prompt.replace('{{FOCUS_AREAS}}', focusText);
    }

    // Add file content
    const fileContent = this.formatFileContent(files);
    prompt = prompt.replace('{{FILE_CONTENT}}', fileContent);

    return prompt;
  }

  /**
   * Generate complete review prompt
   * @param {Object} reviewData - Complete review data
   * @returns {Object} Complete prompt with system and user messages
   */
  generateCompletePrompt(reviewData) {
    const {
      files,
      targetBranch,
      severityThreshold,
      reviewCriteria,
      branchInfo,
      commitInfo,
      language,
      focusAreas,
      reviewHistory
    } = reviewData;

    // Generate system prompt
    const systemPrompt = this.generateSystemPrompt({
      targetBranch,
      severityThreshold,
      reviewCriteria,
      environment: this.getEnvironmentFromBranch(targetBranch)
    });

    // Generate context prompt
    const contextPrompt = this.generateContextPrompt({
      branchInfo,
      commitInfo,
      fileChanges: this.summarizeFileChanges(files),
      reviewHistory
    });

    // Generate review prompt
    const reviewPrompt = this.generateReviewPrompt(files, {
      language,
      focusAreas
    });

    // Combine prompts
    const userPrompt = `${contextPrompt}\n\n${reviewPrompt}`;

    return {
      system: systemPrompt,
      user: userPrompt,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    };
  }

  /**
   * Format review criteria for prompt
   * @param {Object} criteria - Review criteria
   * @returns {string} Formatted criteria
   */
  formatReviewCriteria(criteria) {
    const sections = [];
    
    for (const [category, config] of Object.entries(criteria)) {
      if (config.enabled) {
        const checks = config.checks.map(check => `- ${check}`).join('\n');
        sections.push(`${category.toUpperCase()} (${config.priority} priority):\n${checks}`);
      }
    }
    
    return sections.join('\n\n');
  }

  /**
   * Format response format for prompt
   * @returns {string} Formatted response format
   */
  formatResponseFormat() {
    const format = this.config.responseFormat.structure;
    return JSON.stringify(format, null, 2);
  }

  /**
   * Format branch information
   * @param {Object} branchInfo - Branch information
   * @returns {string} Formatted branch info
   */
  formatBranchInfo(branchInfo) {
    return `Source Branch: ${branchInfo.sourceBranch || 'N/A'}
Target Branch: ${branchInfo.targetBranch}
Branch Type: ${branchInfo.branchType}
Event Type: ${branchInfo.eventType}
Is Merge: ${branchInfo.isMerge}`;
  }

  /**
   * Format commit information
   * @param {Object} commitInfo - Commit information
   * @returns {string} Formatted commit info
   */
  formatCommitInfo(commitInfo) {
    return `Commit SHA: ${commitInfo.sha}
Author: ${commitInfo.author}
Message: ${commitInfo.message}
Timestamp: ${commitInfo.timestamp}`;
  }

  /**
   * Format file changes summary
   * @param {Array} fileChanges - File changes
   * @returns {string} Formatted file changes
   */
  formatFileChanges(fileChanges) {
    const summary = {
      total: fileChanges.length,
      added: fileChanges.filter(f => f.status === 'added').length,
      modified: fileChanges.filter(f => f.status === 'modified').length,
      deleted: fileChanges.filter(f => f.status === 'deleted').length
    };

    return `Total Files: ${summary.total}
Added: ${summary.added}
Modified: ${summary.modified}
Deleted: ${summary.deleted}`;
  }

  /**
   * Format review history
   * @param {Array} history - Review history
   * @returns {string} Formatted history
   */
  formatReviewHistory(history) {
    if (history.length === 0) return 'No previous reviews found.';

    const recentReviews = history.slice(-3); // Last 3 reviews
    return recentReviews.map(review => 
      `- ${review.timestamp}: ${review.summary.overall_status} (${review.summary.total_issues} issues)`
    ).join('\n');
  }

  /**
   * Format language guidance
   * @param {string} language - Programming language
   * @returns {string} Formatted language guidance
   */
  formatLanguageGuidance(language) {
    const langConfig = this.config.languagePrompts[language];
    if (!langConfig) return '';

    const checks = langConfig.additionalChecks.map(check => `- ${check}`).join('\n');
    const practices = langConfig.bestPractices.map(practice => `- ${practice}`).join('\n');

    return `Additional ${language.toUpperCase()} specific checks:\n${checks}\n\nBest practices:\n${practices}`;
  }

  /**
   * Format focus areas
   * @param {Array} focusAreas - Focus areas
   * @returns {string} Formatted focus areas
   */
  formatFocusAreas(focusAreas) {
    return `Focus on these specific areas:\n${focusAreas.map(area => `- ${area}`).join('\n')}`;
  }

  /**
   * Format file content for prompt
   * @param {Array} files - Files to review
   * @returns {string} Formatted file content
   */
  formatFileContent(files) {
    return files.map(file => {
      const metadata = this.config.includeFileMetadata ? 
        `\nFile: ${file.path}\nLanguage: ${file.language || 'unknown'}\nSize: ${file.size || 'unknown'} bytes\n` : 
        `\nFile: ${file.path}\n`;
      
      return `${metadata}\`\`\`${file.language || ''}\n${file.content}\n\`\`\``;
    }).join('\n\n');
  }

  /**
   * Summarize file changes
   * @param {Array} files - Files
   * @returns {Array} File changes summary
   */
  summarizeFileChanges(files) {
    return files.map(file => ({
      path: file.path,
      status: file.status || 'modified',
      language: file.language,
      size: file.size
    }));
  }

  /**
   * Get environment from branch name
   * @param {string} branchName - Branch name
   * @returns {string} Environment
   */
  getEnvironmentFromBranch(branchName) {
    const branch = branchName.toLowerCase();
    
    if (branch === 'main' || branch === 'master' || branch === 'production') {
      return 'production';
    } else if (branch === 'staging' || branch === 'uat') {
      return 'staging';
    } else if (branch === 'dev' || branch === 'development') {
      return 'development';
    }
    
    return 'development';
  }

  /**
   * Get system prompt template
   * @returns {string} System prompt template
   */
  getSystemPromptTemplate() {
    return `You are an expert code reviewer performing automated code review for a GitHub repository targeting {{TARGET_BRANCH}} branch in {{ENVIRONMENT}} environment.

REVIEW OBJECTIVES:
- Identify security vulnerabilities and potential exploits
- Detect logical flaws and edge cases
- Check for coding standards violations
- Assess performance implications
- Review maintainability and readability

SEVERITY LEVELS:
- HIGH: Critical security issues, major logic flaws, severe performance problems
- MEDIUM: Moderate security concerns, coding standards violations, performance optimizations
- LOW: Minor issues, style inconsistencies, documentation improvements

REVIEW CRITERIA:
{{REVIEW_CRITERIA}}

RESPONSE FORMAT:
You must respond with a valid JSON object in the following structure:
{{RESPONSE_FORMAT}}

IMPORTANT:
- Only report issues that meet or exceed the severity threshold: {{SEVERITY_THRESHOLD}}
- Be specific and actionable in your recommendations
- Focus on real issues, not style preferences unless they affect maintainability
- Consider the target environment: {{ENVIRONMENT}}
- Provide clear, implementable solutions
- Include confidence scores for each issue
- Prioritize issues by severity and impact`;
  }

  /**
   * Get context prompt template
   * @returns {string} Context prompt template
   */
  getContextPromptTemplate() {
    return `REVIEW CONTEXT:
{{BRANCH_INFO}}

{{COMMIT_INFO}}

{{FILE_CHANGES}}

{{REVIEW_HISTORY}}`;
  }

  /**
   * Get review prompt template
   * @returns {string} Review prompt template
   */
  getReviewPromptTemplate() {
    return `{{LANGUAGE_GUIDANCE}}

{{FOCUS_AREAS}}

Please review the following code changes:

{{FILE_CONTENT}}

Provide a comprehensive review following the specified format and criteria.`;
  }

  /**
   * Get language prompt template
   * @returns {string} Language prompt template
   */
  getLanguagePromptTemplate() {
    return `{{LANGUAGE_GUIDANCE}}`;
  }
}

module.exports = ReviewPromptGenerator;



