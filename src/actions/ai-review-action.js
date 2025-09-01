const core = require('@actions/core');
const github = require('@actions/github');

// Import utilities
const AuditLogger = require('../utils/logger');
const FileFilter = require('../utils/file-filter');
const OpenAIClient = require('../utils/openai-client');
const GitHubClient = require('../utils/github-client');
const ConfigParser = require('../utils/config-parser');
const BranchDetector = require('../utils/branch-detector');
const CommitParser = require('../utils/commit-parser');
const QualityGates = require('../utils/quality-gates');
const EmailNotifier = require('../utils/email-notifier');
const LargeCommitHandler = require('../utils/large-commit-handler');
const TokenManager = require('../utils/token-manager');
const ResponseHandler = require('../utils/response-handler');
const FallbackHandler = require('../utils/fallback-handler');
const ServiceAvailabilityHandler = require('../utils/service-availability');
const ErrorLogger = require('../utils/error-logger');
const HealthChecker = require('../utils/health-checker');
const MonitoringDashboard = require('../utils/monitoring-dashboard');

/**
 * Main AI Code Review Action
 * Orchestrates the complete AI-powered code review workflow
 */
class AIReviewAction {
  constructor() {
    core.info('🔧 Starting AIReviewAction constructor...');
    
    try {
      core.info('🔍 Checking github.context availability...');
      core.info(`   github.context exists: ${!!github.context}`);
      core.info(`   github.context type: ${typeof github.context}`);
      core.info(`   github.context value: ${JSON.stringify(github.context, null, 2)}`);
      
      // Initialize context with comprehensive logging
      this.context = github.context || {};
      core.info('🔧 Initializing GitHub context...');
      
      // Log each property access attempt
      core.info('🔍 Accessing eventName...');
      if (!this.context.eventName) {
        core.info('   eventName is undefined/null, setting from env...');
        this.context.eventName = process.env.GITHUB_EVENT_NAME || 'unknown';
        core.info(`   Event Name: ${this.context.eventName || 'unknown'} (from env)`);
      } else {
        core.info(`   Event Name: ${this.context.eventName || 'unknown'}`);
      }
      
      core.info('🔍 Accessing payload...');
      if (!this.context.payload) {
        core.info('   payload is undefined/null, setting empty object...');
        this.context.payload = {};
        core.info('   Payload: {} (empty)');
      } else {
        core.info('   Payload: available');
      }
      
      core.info('🔍 Accessing repo...');
      if (!this.context.repo) {
        core.info('   repo is undefined/null, setting from env...');
        this.context.repo = {
          owner: process.env.GITHUB_REPOSITORY_OWNER || 'unknown',
          repo: process.env.GITHUB_REPOSITORY?.split('/')[1] || 'unknown'
        };
        core.info(`   Repository: ${this.context.repo?.owner || 'unknown'}/${this.context.repo?.repo || 'unknown'} (from env)`);
      } else {
        core.info(`   Repository: ${this.context.repo?.owner || 'unknown'}/${this.context.repo?.repo || 'unknown'}`);
      }
      
      core.info('🔍 Accessing sha...');
      if (!this.context.sha) {
        core.info('   sha is undefined/null, setting from env...');
        this.context.sha = process.env.GITHUB_SHA || 'unknown';
        core.info(`   SHA: ${this.context.sha || 'unknown'} (from env)`);
      } else {
        core.info(`   SHA: ${this.context.sha || 'unknown'}`);
      }
      
      core.info('🔍 Accessing actor...');
      if (!this.context.actor) {
        core.info('   actor is undefined/null, setting from env...');
        this.context.actor = process.env.GITHUB_ACTOR || 'unknown';
        core.info(`   Actor: ${this.context.actor || 'unknown'} (from env)`);
      } else {
        core.info(`   Actor: ${this.context.actor || 'unknown'}`);
      }
      
      core.info('✅ GitHub context initialized successfully');
      
      // Initialize other properties
      this.config = null;
      this.auditLogger = null;
      this.errorLogger = null;
      this.healthChecker = null;
      this.serviceAvailability = null;
      
      core.info('🔧 Initializing core components...');
      try {
        core.info('   Creating FileFilter...');
        this.fileFilter = new FileFilter();
        core.info('   ✅ FileFilter created');
        
        core.info('   Creating OpenAIClient...');
        this.openaiClient = new OpenAIClient();
        core.info('   ✅ OpenAIClient created');
        
        core.info('   Creating GitHubClient...');
        this.githubClient = new GitHubClient({ context: this.context });
        core.info('   ✅ GitHubClient created');
        
        core.info('   Creating BranchDetector...');
        this.branchDetector = new BranchDetector(this.context);
        core.info('   ✅ BranchDetector created');
        
        core.info('   Creating CommitParser...');
        this.commitParser = new CommitParser();
        core.info('   ✅ CommitParser created');
        
        core.info('   Creating QualityGates...');
        this.qualityGates = new QualityGates();
        core.info('   ✅ QualityGates created');
        
        core.info('   Creating EmailNotifier...');
        this.emailNotifier = new EmailNotifier();
        core.info('   ✅ EmailNotifier created');
        
        core.info('   Creating LargeCommitHandler...');
        this.largeCommitHandler = new LargeCommitHandler();
        core.info('   ✅ LargeCommitHandler created');
        
        core.info('   Creating TokenManager...');
        this.tokenManager = new TokenManager();
        core.info('   ✅ TokenManager created');
        
        core.info('   Creating ResponseHandler...');
        this.responseHandler = new ResponseHandler();
        core.info('   ✅ ResponseHandler created');
        
        core.info('   Creating FallbackHandler...');
        this.fallbackHandler = new FallbackHandler();
        core.info('   ✅ FallbackHandler created');
        
        this.monitoringDashboard = null;
        core.info('✅ Core components initialized successfully');
      } catch (error) {
        core.error(`❌ Failed to initialize core components: ${error.message}`);
        core.error(`📍 Component Error Stack: ${error.stack}`);
        throw error;
      }
      
    } catch (error) {
      core.error(`💥 Constructor Error: ${error.message}`);
      core.error(`📍 Constructor Error Stack: ${error.stack}`);
      core.error(`📍 Constructor Error File: ${error.fileName || 'unknown'}`);
      core.error(`📍 Constructor Error Line: ${error.lineNumber || 'unknown'}`);
      throw error;
    }
    
    core.info('✅ AIReviewAction constructor completed successfully');
  }

  /**
   * Initialize the action with configuration and logging
   */
  async initialize() {
    try {
      // Load configuration
      this.config = await this.loadConfiguration();
      
      // Initialize logging systems
      await this.initializeLogging();
      
      // Initialize health checker
      this.healthChecker = new HealthChecker(this.config);
      
      // Initialize service availability handler
      this.serviceAvailability = new ServiceAvailabilityHandler(this.config);
      
      // Set audit logger reference for quality gates
      if (this.qualityGates && this.auditLogger) {
        this.qualityGates.setAuditLogger(this.auditLogger);
      }
      
      // Initialize monitoring dashboard
      if (this.config.monitoring) {
        this.monitoringDashboard = new MonitoringDashboard(this.config);
        await this.monitoringDashboard.initialize();
        core.info('Monitoring dashboard initialized successfully');
      }
      
      core.info('AI Review Action initialized successfully');
    } catch (error) {
      core.setFailed(`Failed to initialize AI Review Action: ${error.message}`);
      throw error;
    }
  }

  /**
   * Load configuration from repository and environment
   */
  async loadConfiguration() {
    try {
      const configParser = new ConfigParser();
      const config = await configParser.loadConfiguration();
      
      // Override with environment variables if provided
      if (process.env.OPENAI_API_KEY) {
        config.openai.api_key = process.env.OPENAI_API_KEY;
      }
      
      if (process.env.GITHUB_TOKEN) {
        config.github.token = process.env.GITHUB_TOKEN;
      }
      
      return config;
    } catch (error) {
      core.warning(`Failed to load configuration: ${error.message}`);
      // Return default configuration
      return this.getDefaultConfig();
    }
  }

  /**
   * Get default configuration
   */
  getDefaultConfig() {
    return {
      openai: {
        api_key: process.env.OPENAI_API_KEY,
        model: 'gpt-4',
        max_tokens: 4000,
        temperature: 0.1
      },
      github: {
        token: process.env.GITHUB_TOKEN
      },
      review: {
        enabled: true,
        severity_thresholds: {
          dev: 'medium',
          uat: 'high',
          production: 'high'
        }
      },
      logging: {
        audit_log_dir: './logs/audit',
        error_log_dir: './logs/errors',
        enable_console_logging: true,
        enable_file_logging: true,
        log_level: 'info',
        compliance_mode: false
      },
      notifications: {
        email: {
          enabled: false,
          smtp_host: process.env.SMTP_HOST,
          smtp_port: process.env.SMTP_PORT,
          smtp_user: process.env.SMTP_USER,
          smtp_pass: process.env.SMTP_PASS
        }
      }
    };
  }

  /**
   * Initialize logging systems
   */
  async initializeLogging() {
    try {
      // Initialize audit logger
      this.auditLogger = new AuditLogger(this.config);
      
      // Initialize error logger
      this.errorLogger = new ErrorLogger(this.config);
      
      core.info('Logging systems initialized');
    } catch (error) {
      core.warning(`Failed to initialize logging: ${error.message}`);
      // Continue without logging if it fails
    }
  }

  /**
   * Main execution method
   */
  async run() {
    const startTime = Date.now();
    let reviewSessionId = null;
    
    try {
      await this.initialize();
      
      // Generate session ID for this review
      reviewSessionId = this.generateSessionId();
      
      // Log review attempt start
      await this.logReviewAttemptStart(reviewSessionId);
      
      // Detect branch information
      const branchInfo = await this.detectBranchInfo();
      
      // Check if review is needed for this branch
      if (!this.shouldReviewBranch(branchInfo)) {
        await this.logReviewSkipped(reviewSessionId, branchInfo, 'Branch not configured for review');
        core.info(`Review skipped for branch: ${branchInfo.targetBranch}`);
        return;
      }
      
      // Get changed files
      const changedFiles = await this.getChangedFiles();
      
      // Filter files for review
      const reviewFiles = await this.filterFilesForReview(changedFiles);
      
      if (reviewFiles.length === 0) {
        await this.logReviewSkipped(reviewSessionId, branchInfo, 'No files to review after filtering');
        core.info('No files to review after filtering');
        return;
      }
      
      // Check for large commits
      const commitAnalysis = await this.analyzeCommitSize(reviewFiles);
      if (commitAnalysis.isLarge) {
        await this.handleLargeCommit(reviewSessionId, branchInfo, commitAnalysis);
        return;
      }
      
      // Perform AI review
      const reviewResult = await this.performAIReview(reviewSessionId, branchInfo, reviewFiles);
      
      // Process review results
      await this.processReviewResults(reviewSessionId, branchInfo, reviewResult);
      
      // Log review completion
      await this.logReviewCompletion(reviewSessionId, reviewResult, Date.now() - startTime);
      
    } catch (error) {
      await this.handleError(reviewSessionId, error, Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Log review attempt start with comprehensive context
   */
  async logReviewAttemptStart(sessionId) {
    if (!this.auditLogger) return;
    
    try {
      const reviewData = {
        session_id: sessionId,
        action: 'review_start',
        repository: this.context.repo?.owner + '/' + this.context.repo?.repo,
        event_name: this.context.eventName || 'unknown',
        event_action: this.context.payload?.action || 'unknown',
        actor: this.context.actor || 'unknown',
        workflow: this.context.workflow || 'unknown',
        run_id: this.context.runId || 'unknown',
        sha: this.context.sha || 'unknown',
        ref: this.context.ref || 'unknown',
        head_ref: this.context.payload?.head_ref || 'unknown',
        base_ref: this.context.payload?.base_ref || 'unknown'
      };
      
      const context = {
        user: this.context.actor || 'unknown',
        repository: this.context.repo?.owner + '/' + this.context.repo?.repo,
        branch: this.context.ref ? this.context.ref.replace('refs/heads/', '') : 'unknown',
        commitSha: this.context.sha || 'unknown',
        sessionId: sessionId,
        userAgent: 'AI-Code-Review-System',
        version: '1.0.0'
      };
      
      await this.auditLogger.logReviewAttempt(reviewData, context);
      core.info(`Review session started: ${sessionId}`);
    } catch (error) {
      core.warning(`Failed to log review attempt start: ${error.message}`);
    }
  }

  /**
   * Log review skipped with reason
   */
  async logReviewSkipped(sessionId, branchInfo, reason) {
    if (!this.auditLogger) return;
    
    try {
      const reviewData = {
        session_id: sessionId,
        action: 'review_skipped',
        reason: reason,
        source_branch: branchInfo.sourceBranch,
        target_branch: branchInfo.targetBranch,
        environment: branchInfo.environment
      };
      
      const context = {
        user: this.context.actor || 'unknown',
        repository: this.context.repo?.owner + '/' + this.context.repo?.repo,
        branch: branchInfo.targetBranch,
        commitSha: this.context.sha || 'unknown',
        sessionId: sessionId
      };
      
      await this.auditLogger.logReviewOutcome({
        passed: true,
        skipped: true,
        reason: reason,
        issues: []
      }, context);
      
      core.info(`Review skipped: ${reason}`);
    } catch (error) {
      core.warning(`Failed to log review skipped: ${error.message}`);
    }
  }

  /**
   * Log review completion with detailed pass/fail analysis and metrics
   */
  async logReviewCompletion(sessionId, reviewResult, duration) {
    if (!this.auditLogger) return;
    
    try {
      // Calculate detailed pass/fail criteria
      const passFailAnalysis = this.analyzePassFailCriteria(reviewResult);
      
      // Prepare comprehensive review data
      const reviewData = {
        session_id: sessionId,
        action: 'review_completed',
        duration_ms: duration,
        passed: reviewResult.passed,
        pass_fail_analysis: passFailAnalysis,
        issues_count: reviewResult.issues?.length || 0,
        severity_breakdown: reviewResult.severityBreakdown || {},
        ai_response_time: reviewResult.aiResponseTime || 0,
        tokens_used: reviewResult.tokensUsed || 0,
        model_used: reviewResult.modelUsed || 'unknown',
        quality_score: reviewResult.qualityScore || 0,
        environment: reviewResult.environment,
        target_branch: reviewResult.targetBranch,
        files_reviewed: reviewResult.filesReviewed || 0,
        lines_of_code: reviewResult.linesOfCode || 0,
        review_coverage: reviewResult.reviewCoverage || 0
      };
      
      const context = {
        user: this.context.actor || 'unknown',
        repository: this.context.repo?.owner + '/' + this.context.repo?.repo,
        branch: reviewResult.targetBranch,
        commitSha: this.context.sha || 'unknown',
        sessionId: sessionId
      };
      
      // Log detailed review outcome
      await this.auditLogger.logReviewOutcome({
        passed: reviewResult.passed,
        issues: reviewResult.issues || [],
        duration: duration,
        aiResponseTime: reviewResult.aiResponseTime,
        tokensUsed: reviewResult.tokensUsed,
        modelUsed: reviewResult.modelUsed,
        passFailAnalysis: passFailAnalysis,
        qualityScore: reviewResult.qualityScore || 0,
        environment: reviewResult.environment,
        filesReviewed: reviewResult.filesReviewed || 0,
        linesOfCode: reviewResult.linesOfCode || 0,
        reviewCoverage: reviewResult.reviewCoverage || 0
      }, context);
      
      // Log AI response metrics with enhanced tracking
      await this.auditLogger.logAIResponseMetrics({
        responseTime: reviewResult.aiResponseTime,
        tokensUsed: reviewResult.tokensUsed,
        model: reviewResult.modelUsed,
        qualityScore: reviewResult.qualityScore || 0,
        filesReviewed: reviewResult.filesReviewed || 0,
        linesOfCode: reviewResult.linesOfCode || 0,
        reviewCoverage: reviewResult.reviewCoverage || 0,
        modelVersion: reviewResult.modelVersion,
        apiVersion: reviewResult.apiVersion,
        temperature: reviewResult.temperature,
        maxTokens: reviewResult.maxTokens,
        retryCount: reviewResult.retryCount || 0,
        fallbackUsed: reviewResult.fallbackUsed || false,
        errorType: reviewResult.errorType,
        errorMessage: reviewResult.errorMessage
      }, context);
      
      // Log detailed pass/fail summary
      await this.logPassFailSummary(sessionId, reviewResult, passFailAnalysis, context);
      
      // Update monitoring dashboard
      if (this.monitoringDashboard) {
        await this.updateMonitoringDashboard(reviewResult, duration);
      }
      
      core.info(`Review completed in ${duration}ms - ${reviewResult.passed ? 'PASSED' : 'FAILED'} - ${passFailAnalysis.reason}`);
    } catch (error) {
      core.warning(`Failed to log review completion: ${error.message}`);
    }
  }

  /**
   * Analyze pass/fail criteria based on review results
   */
  analyzePassFailCriteria(reviewResult) {
    const analysis = {
      passed: reviewResult.passed,
      reason: '',
      criteria_met: [],
      criteria_failed: [],
      severity_thresholds: {},
      environment_thresholds: {}
    };

    // Get environment-specific thresholds
    const environment = reviewResult.environment || 'unknown';
    const thresholds = this.config.review?.severity_thresholds || {};
    const envThreshold = thresholds[environment] || 'medium';

    analysis.environment_thresholds = {
      environment: environment,
      threshold: envThreshold,
      configured_thresholds: thresholds
    };

    // Analyze issues by severity
    const severityBreakdown = reviewResult.severityBreakdown || {};
    const criticalIssues = severityBreakdown.critical || 0;
    const highIssues = severityBreakdown.high || 0;
    const mediumIssues = severityBreakdown.medium || 0;
    const lowIssues = severityBreakdown.low || 0;

    analysis.severity_thresholds = {
      critical: criticalIssues,
      high: highIssues,
      medium: mediumIssues,
      low: lowIssues,
      total: criticalIssues + highIssues + mediumIssues + lowIssues
    };

    // Determine pass/fail based on environment and severity
    let shouldPass = true;
    let failReason = '';

    // Critical issues always fail
    if (criticalIssues > 0) {
      shouldPass = false;
      failReason = `Critical issues found: ${criticalIssues}`;
      analysis.criteria_failed.push(`critical_issues: ${criticalIssues}`);
    } else {
      analysis.criteria_met.push('no_critical_issues');
    }

    // High issues fail for all environments
    if (highIssues > 0) {
      shouldPass = false;
      failReason = `High severity issues found: ${highIssues}`;
      analysis.criteria_failed.push(`high_issues: ${highIssues}`);
    } else {
      analysis.criteria_met.push('no_high_issues');
    }

    // Medium issues fail for production and UAT
    if (mediumIssues > 0 && ['production', 'uat', 'staging'].includes(environment)) {
      shouldPass = false;
      failReason = `Medium severity issues found: ${mediumIssues} (not allowed in ${environment})`;
      analysis.criteria_failed.push(`medium_issues_in_${environment}: ${mediumIssues}`);
    } else if (mediumIssues > 0) {
      analysis.criteria_met.push(`medium_issues_allowed_in_${environment}: ${mediumIssues}`);
    } else {
      analysis.criteria_met.push('no_medium_issues');
    }

    // Low issues are generally allowed but logged
    if (lowIssues > 0) {
      analysis.criteria_met.push(`low_issues_allowed: ${lowIssues}`);
    } else {
      analysis.criteria_met.push('no_low_issues');
    }

    // Quality score analysis
    const qualityScore = reviewResult.qualityScore || 0;
    const minQualityScore = this.config.review?.min_quality_score || 0.7;
    
    if (qualityScore < minQualityScore) {
      shouldPass = false;
      failReason = `Quality score below threshold: ${qualityScore} < ${minQualityScore}`;
      analysis.criteria_failed.push(`quality_score: ${qualityScore} < ${minQualityScore}`);
    } else {
      analysis.criteria_met.push(`quality_score_met: ${qualityScore} >= ${minQualityScore}`);
    }

    // Set final reason
    if (shouldPass) {
      analysis.reason = 'All criteria met';
      if (analysis.severity_thresholds.total > 0) {
        analysis.reason += ` (${analysis.severity_thresholds.total} issues within acceptable limits)`;
      }
    } else {
      analysis.reason = failReason;
    }

    analysis.passed = shouldPass;
    return analysis;
  }

  /**
   * Log detailed pass/fail summary
   */
  async logPassFailSummary(sessionId, reviewResult, passFailAnalysis, context) {
    if (!this.auditLogger) return;
    
    try {
      const summaryData = {
        session_id: sessionId,
        action: 'pass_fail_summary',
        passed: passFailAnalysis.passed,
        reason: passFailAnalysis.reason,
        environment: reviewResult.environment,
        target_branch: reviewResult.targetBranch,
        criteria_met: passFailAnalysis.criteria_met,
        criteria_failed: passFailAnalysis.criteria_failed,
        severity_breakdown: passFailAnalysis.severity_thresholds,
        environment_thresholds: passFailAnalysis.environment_thresholds,
        quality_score: reviewResult.qualityScore || 0,
        total_issues: passFailAnalysis.severity_thresholds.total,
        files_reviewed: reviewResult.filesReviewed || 0,
        review_coverage: reviewResult.reviewCoverage || 0
      };

      await this.auditLogger.logInfo('pass_fail_summary', summaryData, context);
    } catch (error) {
      core.warning(`Failed to log pass/fail summary: ${error.message}`);
    }
  }

  /**
   * Handle errors with comprehensive logging
   */
  async handleError(sessionId, error, duration) {
    try {
      // Log error to error logger
      if (this.errorLogger) {
        await this.errorLogger.logError('ai_review_failed', {
          session_id: sessionId,
          error_message: error.message,
          error_stack: error.stack,
          duration_ms: duration,
          context: {
            repository: this.context.repo.owner + '/' + this.context.repo.repo,
            branch: this.context.ref.replace('refs/heads/', ''),
            commit_sha: this.context.sha,
            actor: this.context.actor
          }
        });
      }
      
      // Log to audit trail
      if (this.auditLogger) {
        await this.auditLogger.logError('review_failed', {
          session_id: sessionId,
          error_message: error.message,
          duration_ms: duration
        }, {
          user: this.context.actor,
          repository: this.context.repo.owner + '/' + this.context.repo.repo,
          branch: this.context.ref.replace('refs/heads/', ''),
          commitSha: this.context.sha,
          sessionId: sessionId
        });
      }
      
      core.error(`Review failed after ${duration}ms: ${error.message}`);
    } catch (logError) {
      core.warning(`Failed to log error: ${logError.message}`);
    }
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Detect branch information
   */
  async detectBranchInfo() {
    return await this.branchDetector.detectBranches(this.context);
  }

  /**
   * Check if branch should be reviewed
   */
  shouldReviewBranch(branchInfo) {
    const targetBranch = branchInfo.targetBranch.toLowerCase();
    return ['dev', 'development', 'uat', 'staging', 'main', 'master', 'production'].includes(targetBranch);
  }

  /**
   * Get changed files from the event
   */
  async getChangedFiles() {
    // Add defensive checks
    if (!this.context || !this.context.eventName) {
      core.warning('GitHub context not available, cannot determine changed files');
      return [];
    }
    
    try {
      if (this.context.eventName === 'pull_request') {
        return await this.githubClient.getPullRequestFiles(this.context.payload.pull_request.number);
      } else if (this.context.eventName === 'push') {
        return await this.githubClient.getCommitFiles(this.context.sha);
      }
      
      core.info(`Event type '${this.context.eventName}' not supported for file detection`);
      return [];
    } catch (error) {
      core.warning(`Failed to get changed files: ${error.message}`);
      return [];
    }
  }

  /**
   * Filter files for review
   */
  async filterFilesForReview(files) {
    return files.filter(file => this.fileFilter.shouldReviewFile(file.filename));
  }

  /**
   * Analyze commit size
   */
  async analyzeCommitSize(files) {
    return await this.largeCommitHandler.analyzeCommit(files);
  }

  /**
   * Handle large commits
   */
  async handleLargeCommit(sessionId, branchInfo, commitAnalysis) {
    // Log large commit detection
    if (this.auditLogger) {
      await this.auditLogger.logWarn('large_commit_detected', {
        session_id: sessionId,
        file_count: commitAnalysis.fileCount,
        total_size: commitAnalysis.totalSize,
        estimated_tokens: commitAnalysis.estimatedTokens,
        recommendation: commitAnalysis.recommendation
      }, {
        user: this.context.actor,
        repository: this.context.repo.owner + '/' + this.context.repo.repo,
        branch: branchInfo.targetBranch,
        commitSha: this.context.sha,
        sessionId: sessionId
      });
    }
    
    // Handle according to configuration
    if (this.config.review.skip_large_commits) {
      await this.logReviewSkipped(sessionId, branchInfo, 'Large commit detected - skipping review');
      return;
    }
    
    // Continue with review but log the large commit
    core.warning(`Large commit detected: ${commitAnalysis.recommendation}`);
  }

  /**
   * Perform AI review with comprehensive metrics
   */
  async performAIReview(sessionId, branchInfo, files) {
    const startTime = Date.now();
    
    try {
      // Prepare review content
      const reviewContent = await this.prepareReviewContent(files);
      
      // Check token limits
      const tokenAnalysis = await this.tokenManager.analyzeContent(reviewContent);
      if (tokenAnalysis.exceedsLimit) {
        throw new Error(`Content exceeds token limit: ${tokenAnalysis.estimatedTokens} > ${tokenAnalysis.maxTokens}`);
      }
      
      // Calculate review metrics
      const reviewMetrics = this.calculateReviewMetrics(files);
      
      // Perform AI review
      const aiResponse = await this.openaiClient.reviewCode(reviewContent, this.config);
      
      // Parse and validate response
      const parsedResponse = await this.responseHandler.parseResponse(aiResponse);
      
      // Calculate timing metrics
      const aiResponseTime = Date.now() - startTime;
      
      // Calculate quality score
      const qualityScore = this.calculateQualityScore(parsedResponse, reviewMetrics);
      
      return {
        passed: parsedResponse.passed,
        issues: parsedResponse.issues,
        severityBreakdown: parsedResponse.severityBreakdown,
        aiResponseTime: aiResponseTime,
        tokensUsed: aiResponse.usage?.total_tokens || 0,
        modelUsed: this.config.openai.model,
        qualityScore: qualityScore,
        targetBranch: branchInfo.targetBranch,
        environment: branchInfo.environment,
        filesReviewed: reviewMetrics.filesCount,
        linesOfCode: reviewMetrics.totalLines,
        reviewCoverage: reviewMetrics.coverage,
        reviewMetrics: reviewMetrics,
        
        // Enhanced metrics for tracking
        modelVersion: aiResponse.model || this.config.openai.model,
        apiVersion: aiResponse.api_version || 'unknown',
        temperature: this.config.openai.temperature || 0.1,
        maxTokens: this.config.openai.max_tokens || 0,
        retryCount: aiResponse.retry_count || 0,
        fallbackUsed: false,
        errorType: null,
        errorMessage: null,
        
        // Performance metrics
        preparationTime: aiResponse.preparation_time || 0,
        parsingTime: aiResponse.parsing_time || 0,
        totalProcessingTime: aiResponseTime
      };
      
    } catch (error) {
      const errorTime = Date.now() - startTime;
      
      // Handle AI service failures
      const fallbackStrategy = await this.fallbackHandler.determineStrategy(error, {
        sessionId,
        branchInfo,
        files
      });
      
      const fallbackResult = await this.fallbackHandler.executeStrategy(fallbackStrategy, {
        sessionId,
        branchInfo,
        files,
        error
      });
      
      // Add error tracking metrics to fallback result
      return {
        ...fallbackResult,
        aiResponseTime: errorTime,
        tokensUsed: 0,
        modelUsed: this.config.openai.model,
        fallbackUsed: true,
        errorType: error.name || 'UnknownError',
        errorMessage: error.message,
        retryCount: fallbackResult.retryCount || 0,
        modelVersion: this.config.openai.model,
        apiVersion: 'unknown',
        temperature: this.config.openai.temperature || 0.1,
        maxTokens: this.config.openai.max_tokens || 0
      };
    }
  }

  /**
   * Calculate comprehensive review metrics
   */
  calculateReviewMetrics(files) {
    let totalLines = 0;
    let totalSize = 0;
    let codeFiles = 0;
    let configFiles = 0;
    let testFiles = 0;
    
    const fileTypes = {
      code: ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.cs', '.php', '.rb', '.go', '.rs'],
      config: ['.json', '.yaml', '.yml', '.xml', '.toml', '.ini', '.conf'],
      test: ['.test.js', '.spec.js', '.test.ts', '.spec.ts', '.test.py', '.spec.py']
    };
    
    files.forEach(file => {
      const extension = file.filename.toLowerCase().substring(file.filename.lastIndexOf('.'));
      const isCodeFile = fileTypes.code.includes(extension);
      const isConfigFile = fileTypes.config.includes(extension);
      const isTestFile = fileTypes.test.some(testExt => file.filename.toLowerCase().includes(testExt));
      
      if (isCodeFile) codeFiles++;
      if (isConfigFile) configFiles++;
      if (isTestFile) testFiles++;
      
      totalLines += file.lines || 0;
      totalSize += file.size || 0;
    });
    
    const totalFiles = files.length;
    const coverage = totalFiles > 0 ? (codeFiles / totalFiles) * 100 : 0;
    
    return {
      filesCount: totalFiles,
      codeFiles: codeFiles,
      configFiles: configFiles,
      testFiles: testFiles,
      totalLines: totalLines,
      totalSize: totalSize,
      coverage: Math.round(coverage * 100) / 100, // Round to 2 decimal places
      averageLinesPerFile: totalFiles > 0 ? Math.round(totalLines / totalFiles) : 0,
      averageSizePerFile: totalFiles > 0 ? Math.round(totalSize / totalFiles) : 0
    };
  }

  /**
   * Calculate quality score based on review results and metrics
   */
  calculateQualityScore(parsedResponse, reviewMetrics) {
    let score = 1.0; // Start with perfect score
    
    // Deduct points for issues by severity
    const severityBreakdown = parsedResponse.severityBreakdown || {};
    const criticalIssues = severityBreakdown.critical || 0;
    const highIssues = severityBreakdown.high || 0;
    const mediumIssues = severityBreakdown.medium || 0;
    const lowIssues = severityBreakdown.low || 0;
    
    // Deduct points based on severity (critical issues have highest impact)
    score -= (criticalIssues * 0.3); // 30% deduction per critical issue
    score -= (highIssues * 0.15);    // 15% deduction per high issue
    score -= (mediumIssues * 0.05);  // 5% deduction per medium issue
    score -= (lowIssues * 0.01);     // 1% deduction per low issue
    
    // Bonus for good code coverage
    if (reviewMetrics.coverage > 80) {
      score += 0.05; // 5% bonus for high coverage
    } else if (reviewMetrics.coverage > 60) {
      score += 0.02; // 2% bonus for moderate coverage
    }
    
    // Penalty for very large files (potential complexity)
    if (reviewMetrics.averageLinesPerFile > 500) {
      score -= 0.1; // 10% penalty for very large files
    } else if (reviewMetrics.averageLinesPerFile > 200) {
      score -= 0.05; // 5% penalty for large files
    }
    
    // Ensure score is between 0 and 1
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Prepare content for AI review
   */
  async prepareReviewContent(files) {
    // Implementation to prepare file content for AI review
    // This would include file diffs, metadata, etc.
    return {
      files: files,
      metadata: {
        repository: this.context.repo.owner + '/' + this.context.repo.repo,
        branch: this.context.ref.replace('refs/heads/', ''),
        commit: this.context.sha,
        author: this.context.actor
      }
    };
  }

  /**
   * Process review results
   */
  async processReviewResults(sessionId, branchInfo, reviewResult) {
    // Create GitHub issue for any issues found (not just when passed is false)
    if (reviewResult.issues && reviewResult.issues.length > 0) {
      await this.createReviewIssue(branchInfo, reviewResult);
      core.info(`✅ GitHub issue created for ${reviewResult.issues.length} issue(s) found`);
    } else {
      core.info('✅ No issues found - no GitHub issue needed');
    }
    
    // Check quality gates for production
    if (branchInfo.environment === 'production') {
      await this.checkQualityGates(sessionId, branchInfo, reviewResult);
    }
  }

  /**
   * Create GitHub issue for failed review
   */
  async createReviewIssue(branchInfo, reviewResult) {
    try {
      // Generate severity-based labels
      const severityLabels = this.generateSeverityLabels(reviewResult);
      
      const issueData = {
        title: `Code Review [${branchInfo.targetBranch}] - ${reviewResult.issues.length} Issue(s) Found`,
        body: this.formatIssueBody(branchInfo, reviewResult),
        labels: ['ai-review', 'code-quality', ...severityLabels],
        assignees: this.config.github?.team_leads || []
      };
      
      await this.githubClient.createIssue(issueData);
      core.info(`✅ GitHub issue created with severity labels: ${severityLabels.join(', ')}`);
    } catch (error) {
      core.error(`Failed to create GitHub issue: ${error.message}`);
    }
  }

  /**
   * Generate severity-based labels for GitHub issues
   */
  generateSeverityLabels(reviewResult) {
    const labels = [];
    
    if (reviewResult.severityBreakdown?.critical > 0) {
      labels.push('severity-critical');
    }
    if (reviewResult.severityBreakdown?.high > 0) {
      labels.push('severity-high');
    }
    if (reviewResult.severityBreakdown?.medium > 0) {
      labels.push('severity-medium');
    }
    if (reviewResult.severityBreakdown?.low > 0) {
      labels.push('severity-low');
    }
    
    return labels;
  }

  /**
   * Format issue body
   */
  formatIssueBody(branchInfo, reviewResult) {
    const severityEmojis = {
      'CRITICAL': '🚨',
      'HIGH': '🔴',
      'MEDIUM': '🟡',
      'LOW': '🟢'
    };

    const severityColors = {
      'CRITICAL': 'red',
      'HIGH': 'red',
      'MEDIUM': 'orange',
      'LOW': 'green'
    };

    return `## AI Code Review Results

**Environment:** ${branchInfo.environment}
**Source Branch:** ${branchInfo.sourceBranch}
**Target Branch:** ${branchInfo.targetBranch}
**Commit:** ${this.context.sha}

### Issues Found (${reviewResult.issues.length})

${reviewResult.issues.map(issue => `
#### ${severityEmojis[issue.severity] || '⚪'} **${issue.severity.toUpperCase()}** - ${issue.title}
- **File:** \`${issue.file}\`
- **Line:** ${issue.line || 'N/A'}
- **Category:** ${issue.category || 'General'}
- **Description:** ${issue.description}
- **Recommendation:** ${issue.recommendation}

---
`).join('\n')}

### Severity Breakdown
${Object.entries(reviewResult.severityBreakdown || {}).map(([severity, count]) => {
  if (count > 0) {
    const emoji = severityEmojis[severity.toUpperCase()] || '⚪';
    return `- ${emoji} **${severity.charAt(0).toUpperCase() + severity.slice(1)}:** ${count}`;
  }
  return null;
}).filter(Boolean).join('\n')}

### Review Metrics
- **Quality Score:** ${reviewResult.qualityScore || 'N/A'}/100
- **AI Response Time:** ${reviewResult.aiResponseTime || 'N/A'}ms
- **Tokens Used:** ${reviewResult.tokensUsed || 'N/A'}
- **Model:** ${reviewResult.modelUsed || 'N/A'}

### Next Steps
1. Review the issues above based on severity priority
2. Address **CRITICAL** and **HIGH** severity issues first
3. Consider **MEDIUM** and **LOW** severity issues for code quality improvements
4. Update this issue when fixes are implemented

---
*This issue was automatically generated by the AI Code Review System*`;
  }

  /**
   * Check quality gates for production with comprehensive logging
   */
  async checkQualityGates(sessionId, branchInfo, reviewResult) {
    try {
      // Prepare review data for quality gates
      const reviewData = {
        severity_breakdown: reviewResult.severityBreakdown || {},
        commit_message: this.context.payload.head_commit?.message || '',
        commit_author: this.context.actor,
        target_branch: branchInfo.targetBranch
      };

      // Prepare context for quality gates
      const context = {
        sessionId: sessionId,
        user: this.context.actor,
        repository: this.context.repo.owner + '/' + this.context.repo.repo,
        branch: branchInfo.targetBranch,
        commitSha: this.context.sha
      };

      // Evaluate quality gate with comprehensive logging
      const decision = await this.qualityGates.evaluateQualityGate(reviewData, this.config, context);
      
      if (!decision.passed) {
        // Block the merge
        await this.githubClient.createStatusCheck({
          state: 'failure',
          description: decision.reason,
          context: 'AI Code Review'
        });
        
        core.setFailed(`Quality gate failed: ${decision.reason}`);
      } else {
        core.info(`Quality gate passed: ${decision.reason}`);
      }
    } catch (error) {
      core.error(`Quality gate check failed: ${error.message}`);
      
      // Log quality gate error
      if (this.auditLogger) {
        await this.auditLogger.logError('quality_gate_check_failed', {
          session_id: sessionId,
          error_message: error.message,
          error_stack: error.stack,
          target_branch: branchInfo.targetBranch,
          environment: branchInfo.environment
        }, {
          user: this.context.actor,
          repository: this.context.repo.owner + '/' + this.context.repo.repo,
          branch: branchInfo.targetBranch,
          commitSha: this.context.sha,
          sessionId: sessionId
        });
      }
    }
  }

  /**
   * Update monitoring dashboard with review metrics
   */
  async updateMonitoringDashboard(reviewResult, duration) {
    try {
      if (!this.monitoringDashboard) return;

      // Calculate metrics for dashboard
      const metrics = {
        totalReviews: 1, // This would be aggregated from historical data
        successRate: reviewResult.passed ? 100 : 0,
        avgResponseTime: reviewResult.aiResponseTime || duration,
        avgQualityScore: reviewResult.qualityScore || 0,
        totalCost: reviewResult.costEstimate || 0,
        errorRate: reviewResult.fallbackUsed ? 1 : 0,
        reviewDuration: duration,
        filesReviewed: reviewResult.filesReviewed || 0,
        linesOfCode: reviewResult.linesOfCode || 0,
        reviewCoverage: reviewResult.reviewCoverage || 0
      };

      // Update dashboard with latest metrics
      await this.monitoringDashboard.updateDashboard(metrics);
      
      core.info('Monitoring dashboard updated successfully');
    } catch (error) {
      core.warning(`Failed to update monitoring dashboard: ${error.message}`);
    }
  }

  /**
   * Generate monitoring report
   */
  async generateMonitoringReport(startDate = null, endDate = null) {
    try {
      if (!this.monitoringDashboard) {
        throw new Error('Monitoring dashboard not initialized');
      }

      const report = await this.monitoringDashboard.generateReport(startDate, endDate);
      return report;
    } catch (error) {
      core.error(`Failed to generate monitoring report: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get dashboard URL
   */
  getDashboardUrl() {
    if (!this.monitoringDashboard) {
      return null;
    }
    return this.monitoringDashboard.getDashboardUrl();
  }

  /**
   * Execute the AI code review
   * @returns {Promise<Object>} Review results
   */
  async execute() {
    core.info('🚀 Starting AI code review execution...');
    
    try {
      // Get configuration
      const config = await this.loadConfiguration();
      core.info('✅ Configuration loaded');
      
      // Detect branches
      const branchInfo = this.branchDetector.detectBranches();
      core.info(`✅ Branch detection completed: ${branchInfo.targetBranch}`);
      
      // Check if review should be skipped
      if (!this.branchDetector.isValidBranchMovement(branchInfo)) {
        core.info('⏭️ Skipping review - invalid branch movement');
        return { skipped: true, reason: 'Invalid branch movement' };
      }
      
      // Get changed files
      const files = await this.getChangedFiles();
      core.info(`✅ Found ${files.length} changed files`);
      
      // Perform AI review
      const reviewResult = await this.performReview(files, branchInfo, config);
      core.info('✅ AI review completed');
      
      // Generate session ID for this review
      const sessionId = `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Check quality gates
      const gateResult = await this.checkQualityGates(sessionId, branchInfo, reviewResult);
      core.info('✅ Quality gates checked');
      
      // Send notifications
      await this.sendNotifications(branchInfo, reviewResult, gateResult);
      core.info('✅ Notifications sent');
      
      return {
        success: true,
        reviewResult,
        gateResult,
        files: files.length
      };
      
    } catch (error) {
      core.error(`❌ Execution failed: ${error.message}`);
      core.error(`📍 Execution Error Stack: ${error.stack}`);
      throw error;
    }
  }

  /**
   * Load configuration from file or environment
   * @returns {Promise<Object>} Configuration object
   */
  async loadConfiguration() {
    try {
      // For now, return a basic configuration
      // TODO: Implement actual config file loading
      return {
        severityThreshold: 'MEDIUM',
        enableProductionGates: true,
        maxFiles: 100,
        timeout: 300,
        emailNotifications: true,
        slackNotifications: false
      };
    } catch (error) {
      core.warning(`Failed to load configuration: ${error.message}`);
      // Return default configuration
      return {
        severityThreshold: 'MEDIUM',
        enableProductionGates: true,
        maxFiles: 100,
        timeout: 300,
        emailNotifications: true,
        slackNotifications: false
      };
    }
  }

  /**
   * Perform AI code review on files
   * @param {Array} files - Array of files to review
   * @param {Object} branchInfo - Branch information
   * @param {Object} config - Configuration object
   * @returns {Promise<Object>} Review results
   */
    async performReview(files, branchInfo, config) {
    core.info('🤖 Starting AI code review...');
    
    try {
      if (!files || files.length === 0) {
        core.info('📝 No files to review');
        return {
          passed: true,
          issues: [],
          targetBranch: branchInfo.targetBranch,
          environment: branchInfo.branchType,
          filesReviewed: 0,
          linesOfCode: 0,
          reviewCoverage: 0,
          aiResponseTime: 0,
          tokensUsed: 0,
          modelUsed: 'none',
          qualityScore: 100
        };
      }

      // Prepare content for AI review
      const reviewContent = this.prepareReviewContent(files, branchInfo);
      core.info(`📝 Prepared ${files.length} files for AI review`);
      
      // Call the real AI review
      const startTime = Date.now();
      core.info('🤖 Calling OpenAI API for code review...');
      
      const aiResponse = await this.openaiClient.performCodeReview(reviewContent);
      core.info('📡 Received response from OpenAI API');
      
      // Log the actual AI response
      core.info('🤖 AI Response Details:');
      core.info(`   Model: ${aiResponse.model || 'unknown'}`);
      core.info(`   Tokens Used: ${aiResponse.usage?.total_tokens || 'unknown'}`);
      core.info(`   Response Length: ${JSON.stringify(aiResponse).length} characters`);
      
      // Parse and validate the AI response
      const parsedResponse = await this.responseHandler.parseResponse(aiResponse);
      core.info('✅ AI response parsed successfully');
      
      // Calculate timing metrics
      const aiResponseTime = Date.now() - startTime;
      
      // Calculate quality score
      const qualityScore = this.calculateQualityScore(parsedResponse, { filesCount: files.length });
      
      const reviewResult = {
        passed: parsedResponse.passed,
        issues: parsedResponse.issues || [],
        targetBranch: branchInfo.targetBranch,
        environment: branchInfo.branchType,
        filesReviewed: files.length,
        linesOfCode: files.reduce((total, file) => total + (file.lines || 0), 0),
        reviewCoverage: 100,
        aiResponseTime: aiResponseTime,
        tokensUsed: aiResponse.usage?.total_tokens || 0,
        modelUsed: aiResponse.model || 'gpt-4',
        qualityScore: qualityScore,
        severityBreakdown: parsedResponse.severityBreakdown || {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0
        },
        // Store the raw AI response for detailed logging
        rawAIResponse: aiResponse,
        parsedAIResponse: parsedResponse
      };

      core.info(`✅ AI review completed: ${reviewResult.filesReviewed} files reviewed`);
      core.info(`📊 Review Summary: Quality Score ${qualityScore}, ${reviewResult.issues.length} issues found`);
      
      // Log detailed AI findings if any
      if (reviewResult.issues && reviewResult.issues.length > 0) {
        core.info('🔍 AI Found Issues:');
        reviewResult.issues.forEach((issue, index) => {
          core.info(`   ${index + 1}. [${issue.severity}] ${issue.title} - ${issue.file}:${issue.line || 'N/A'}`);
        });
      } else {
        core.info('✅ No issues found by AI');
      }
      
      return reviewResult;
      
    } catch (error) {
      core.error(`❌ AI review failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check quality gates based on review results
   * @param {string} sessionId - Session ID
   * @param {Object} branchInfo - Branch information
   * @param {Object} reviewResult - Review results
   * @returns {Promise<Object>} Quality gate results
   */
  async checkQualityGates(sessionId, branchInfo, reviewResult) {
    try {
      // Simple quality gate check
      const passed = reviewResult.passed && reviewResult.qualityScore >= 80;
      
      return {
        passed,
        qualityScore: reviewResult.qualityScore,
        threshold: 80,
        branch: branchInfo.targetBranch
      };
    } catch (error) {
      core.warning(`Quality gate check failed: ${error.message}`);
      return { passed: false, qualityScore: 0, threshold: 80, branch: branchInfo.targetBranch };
    }
  }

  /**
   * Send notifications about review results
   * @param {Object} branchInfo - Branch information
   * @param {Object} reviewResult - Review results
   * @param {Object} gateResult - Quality gate results
   */
  async sendNotifications(branchInfo, reviewResult, gateResult) {
    try {
      core.info('📧 Sending notifications...');
      
      // Log notification details for verification
      core.info(`📋 Notification Summary:`);
      core.info(`   Repository: ${branchInfo.targetBranch}`);
      core.info(`   Branch: ${branchInfo.targetBranch}`);
      core.info(`   Review Status: ${reviewResult.passed ? 'PASSED' : 'FAILED'}`);
      core.info(`   Quality Score: ${reviewResult.qualityScore || 'N/A'}`);
      core.info(`   Files Reviewed: ${reviewResult.filesReviewed || 0}`);
      core.info(`   Issues Found: ${reviewResult.issues?.length || 0}`);
      core.info(`   Quality Gate: ${gateResult.passed ? 'PASSED' : 'FAILED'}`);
      
      // Actually send email notifications if configured
      let emailSent = false;
      let emailError = null;
      
      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        try {
          core.info('📧 Sending email notification...');
          
          // Create email content
          const emailSubject = `[AI Code Review] ${reviewResult.passed ? 'PASSED' : 'FAILED'} - ${branchInfo.targetBranch}`;
          const emailBody = `
AI Code Review Results

Repository: ${branchInfo.targetBranch}
Branch: ${branchInfo.targetBranch}
Review Status: ${reviewResult.passed ? 'PASSED' : 'FAILED'}
Quality Score: ${reviewResult.qualityScore || 'N/A'}
Files Reviewed: ${reviewResult.filesReviewed || 0}
Issues Found: ${reviewResult.issues?.length || 0}
Quality Gate: ${gateResult.passed ? 'PASSED' : 'FAILED'}

Review completed at: ${new Date().toISOString()}
          `.trim();
          
          // Send email using EmailNotifier
          if (this.emailNotifier && this.emailNotifier.isEnabled) {
            const emailResult = await this.emailNotifier.sendGenericEmail(
              emailSubject,
              emailBody,
              'ai_review_results'
            );
            
            if (emailResult && emailResult.sent) {
              emailSent = true;
              core.info('✅ Email notification sent successfully');
            } else {
              emailError = emailResult?.error || 'Unknown email error';
              core.warning(`❌ Email notification failed: ${emailError}`);
            }
          } else {
            core.info('📧 Email notification skipped (EmailNotifier not enabled)');
          }
        } catch (error) {
          emailError = error.message;
          core.error(`❌ Email notification failed with exception: ${error.message}`);
        }
      } else {
        core.info('📧 Email notification skipped (SMTP not configured)');
      }
      
      // Actually send Slack notifications if configured
      if (process.env.SLACK_WEBHOOK_URL) {
        try {
          core.info('💬 Sending Slack notification...');
          // TODO: Implement actual Slack webhook call
          core.info('💬 Slack notification would be sent (webhook configured)');
        } catch (error) {
          core.warning(`Failed to send Slack notification: ${error.message}`);
        }
      } else {
        core.info('💬 Slack notification skipped (webhook not configured)');
      }
      
      // Final notification summary
      if (emailSent) {
        core.info('✅ Notifications processed - Email sent successfully');
      } else if (emailError) {
        core.warning(`⚠️ Notifications processed - Email failed: ${emailError}`);
      } else {
        core.info('✅ Notifications processed - No email attempted');
      }
    } catch (error) {
      core.warning(`Failed to send notifications: ${error.message}`);
    }
  }
}

// Export for use in GitHub Actions
module.exports = AIReviewAction;

// Main execution if run directly
if (require.main === module) {
  const action = new AIReviewAction();
  action.run().catch(error => {
    core.setFailed(`AI Review Action failed: ${error.message}`);
    process.exit(1);
  });
}
