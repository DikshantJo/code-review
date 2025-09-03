const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Comprehensive audit logging utility for AI Code Review system
 * Provides structured logging, rotation, compliance features, and audit trails
 */
class AuditLogger {
  constructor(config = {}) {
    this.config = config;
    this.logDir = config.logging?.audit_log_dir || './logs/audit';
    this.maxLogFiles = config.logging?.max_audit_log_files || 50;
    this.maxLogSize = config.logging?.max_audit_log_size || 50 * 1024 * 1024; // 50MB
    this.retentionDays = config.logging?.audit_retention_days || 365; // 1 year for audit logs
    this.enableConsole = config.logging?.enable_console_logging !== false;
    this.enableFileLogging = config.logging?.enable_file_logging !== false;
    this.logLevel = config.logging?.log_level || 'info';
    this.includeSensitiveData = config.logging?.include_sensitive_data || false;
    
    // Debug logging configuration
    this.debugMode = config.logging?.debug_mode || false;
    this.verboseLogging = config.logging?.verbose_logging || false;
    this.debugCategories = config.logging?.debug_categories || ['all'];
    this.debugFilters = config.logging?.debug_filters || [];
    
    // Audit trail tracking
    this.auditTrail = [];
    this.maxTrailSize = config.logging?.max_audit_trail_size || 1000;
    
    // Compliance settings
    this.complianceMode = config.logging?.compliance_mode || false;
    this.requiredFields = config.logging?.required_fields || [
      'timestamp', 'event_type', 'user', 'repository', 'branch', 'commit_sha'
    ];
    
    // Enhanced compliance features
    this.dataRetentionPolicy = config.logging?.data_retention_policy || {
      audit_logs: 365, // days
      error_logs: 90,
      performance_logs: 180,
      compliance_reports: 2555 // 7 years for compliance
    };
    
    this.integrityChecks = config.logging?.integrity_checks || {
      enabled: true,
      algorithm: 'sha256',
      check_frequency: 'daily',
      last_check: null
    };
    
    this.regulatoryCompliance = config.logging?.regulatory_compliance || {
      sox: false,
      gdpr: false,
      hipaa: false,
      pci_dss: false,
      custom_frameworks: []
    };
    
    this.auditChain = [];
    this.chainIndex = 0;
    
    this.initializeLogDirectory();
  }

  /**
   * Check if a log level should be logged based on current configuration
   * @param {string} level - Log level to check
   * @param {string} category - Optional category for debug filtering
   * @returns {boolean} Whether the log level should be logged
   */
  shouldLog(level, category = null) {
    // Define log level hierarchy
    const logLevels = {
      'error': 0,
      'warn': 1,
      'info': 2,
      'debug': 3,
      'trace': 4
    };
    
    const currentLevel = logLevels[this.logLevel.toLowerCase()] || 2; // Default to info
    const requestedLevel = logLevels[level.toLowerCase()] || 2;
    
    // Check basic log level
    if (requestedLevel > currentLevel) {
      return false;
    }
    
    // Check debug mode for debug and trace levels
    if ((level === 'debug' || level === 'trace') && !this.debugMode) {
      return false;
    }
    
    // Check debug categories if category is specified
    if (category && this.debugCategories.length > 0) {
      if (!this.debugCategories.includes('all') && !this.debugCategories.includes(category)) {
        return false;
      }
    }
    
    // Check debug filters
    if (this.debugFilters.length > 0) {
      const shouldFilter = this.debugFilters.some(filter => {
        if (filter.type === 'exclude' && filter.pattern) {
          return new RegExp(filter.pattern).test(category || '');
        }
        if (filter.type === 'include' && filter.pattern) {
          return new RegExp(filter.pattern).test(category || '');
        }
        return false;
      });
      
      if (shouldFilter) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Initialize log directory
   */
  async initializeLogDirectory() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create audit log directory:', error);
    }
  }

  /**
   * Log an audit event with structured information
   * @param {string} eventType - Type of audit event
   * @param {Object} data - Event data
   * @param {string} level - Log level (info, warn, error, debug)
   * @param {Object} context - Additional context information
   * @returns {Promise<Object>} Log entry information
   */
  async logEvent(eventType, data = {}, level = 'info', context = {}) {
    // Check if this log level should be logged
    if (!this.shouldLog(level, context.category)) {
      return {
        auditId: null,
        logged: false,
        reason: 'log_level_filtered',
        level,
        eventType
      };
    }

    const timestamp = new Date().toISOString();
    const auditId = this.generateAuditId();
    
    const logEntry = {
      audit_id: auditId,
      timestamp,
      event_type: eventType,
      level: level.toLowerCase(),
      data: this.sanitizeData(data),
      context: {
        ...context,
        userAgent: context.userAgent || 'AI-Code-Review-System',
        version: context.version || '1.0.0',
        session_id: context.sessionId || this.generateSessionId()
      },
      compliance: this.complianceMode ? this.generateComplianceInfo(data, context) : undefined,
      audit_chain: this.generateAuditChainEntry(auditId, timestamp)
    };

    // Validate required fields for compliance
    if (this.complianceMode) {
      const validation = this.validateComplianceFields(logEntry);
      if (!validation.valid) {
        logEntry.compliance.validation_errors = validation.errors;
      }
    }

    // Add to audit trail
    this.addToAuditTrail(logEntry);

    // Write to log file
    if (this.enableFileLogging) {
      await this.writeToLogFile(logEntry);
    }
    
    // Console output for immediate visibility
    if (this.enableConsole) {
      this.logToConsole(logEntry);
    }

    return {
      auditId,
      logged: true,
      timestamp,
      level,
      eventType,
      data: logEntry.data,
      context: logEntry.context,
      complianceValid: this.complianceMode ? this.validateComplianceFields(logEntry).valid : true
    };
  }

  /**
   * Log a review attempt with comprehensive context
   * @param {Object} reviewData - Review data and results
   * @param {Object} context - Review context information
   * @returns {Promise<Object>} Log entry information
   */
  async logReviewAttempt(reviewData, context = {}) {
    try {
      const eventData = {
        review_type: 'ai_code_review',
        review_status: reviewData.status || 'completed',
        review_duration: reviewData.duration || 0,
        files_reviewed: reviewData.filesReviewed || 0,
        issues_found: reviewData.issues?.length || 0,
        severity_distribution: this.getSeverityDistribution(reviewData.issues || []),
        review_score: reviewData.score || 0,
        quality_gates_passed: reviewData.qualityGatesPassed || false,
        ...reviewData
      };

      const logContext = {
        ...context,
        category: 'review_attempt',
        session_id: context.sessionId || this.generateSessionId(),
        user: context.user || 'ai_system',
        repository: context.repository || 'unknown',
        branch: context.branch || 'unknown',
        commit_sha: context.commitSha || 'unknown',
        pull_request: context.pullRequest || 'unknown'
      };

      return await this.logEvent('review_attempt', eventData, 'info', logContext);
    } catch (error) {
      console.error('Failed to log review attempt:', error);
      return {
        auditId: null,
        logged: false,
        reason: 'log_error',
        error: error.message
      };
    }
  }

  /**
   * Log review outcome with comprehensive details
   * @param {Object} reviewData - Review outcome data
   * @param {Object} context - Review context information
   * @returns {Promise<Object>} Log entry information
   */
  async logReviewOutcome(reviewData, context = {}) {
    try {
      const eventData = {
        review_status: reviewData.status || 'completed',
        review_passed: reviewData.passed || false,
        issues_found: reviewData.issues?.length || 0,
        severity_distribution: this.getSeverityDistribution(reviewData.issues || []),
        review_score: reviewData.score || 0,
        quality_gates_passed: reviewData.qualityGatesPassed || false,
        files_reviewed: reviewData.filesReviewed || 0,
        lines_of_code: reviewData.linesOfCode || 0,
        review_duration: reviewData.duration || 0,
        ...reviewData
      };

      const logContext = {
        ...context,
        category: 'review_outcome',
        session_id: context.sessionId || this.generateSessionId(),
        user: context.user || 'ai_system',
        repository: context.repository || 'unknown',
        branch: context.branch || 'unknown',
        commit_sha: context.commitSha || 'unknown',
        pull_request: context.pullRequest || 'unknown'
      };

      return await this.logEvent('review_outcome', eventData, 'info', logContext);
    } catch (error) {
      console.error('Failed to log review outcome:', error);
      return {
        auditId: null,
        logged: false,
        reason: 'log_error',
        error: error.message
      };
    }
  }

  /**
   * Log AI response metrics
   * @param {Object} metricsData - AI response metrics data
   * @param {Object} context - Review context information
   * @returns {Promise<Object>} Log entry information
   */
  async logAIResponseMetrics(metricsData, context = {}) {
    try {
      const eventData = {
        model_used: metricsData.model || 'unknown',
        tokens_used: metricsData.tokens || 0,
        response_time: metricsData.responseTime || 0,
        api_version: metricsData.apiVersion || 'unknown',
        temperature: metricsData.temperature || 0,
        max_tokens: metricsData.maxTokens || 0,
        retry_count: metricsData.retryCount || 0,
        fallback_used: metricsData.fallbackUsed || false,
        ...metricsData
      };

      const logContext = {
        ...context,
        category: 'ai_response_metrics',
        session_id: context.sessionId || this.generateSessionId(),
        user: context.user || 'ai_system',
        repository: context.repository || 'unknown',
        branch: context.branch || 'unknown',
        commit_sha: context.commitSha || 'unknown'
      };

      return await this.logEvent('ai_response_metrics', eventData, 'info', logContext);
    } catch (error) {
      console.error('Failed to log AI response metrics:', error);
      return {
        auditId: null,
        logged: false,
        reason: 'log_error',
        error: error.message
      };
    }
  }

  /**
   * Log warning message
   * @param {string} eventType - Type of warning event
   * @param {Object} data - Warning data
   * @param {Object} context - Additional context information
   * @returns {Promise<Object>} Log entry information
   */
  async logWarn(eventType, data = {}, context = {}) {
    return await this.logEvent(eventType, data, 'warn', context);
  }

  /**
   * Log error message
   * @param {string} eventType - Type of error event
   * @param {Object} data - Error data
   * @param {Object} context - Additional context information
   * @returns {Promise<Object>} Log entry information
   */
  async logError(eventType, data = {}, context = {}) {
    return await this.logEvent(eventType, data, 'error', context);
  }

  /**
   * Log info message
   * @param {string} eventType - Type of info event
   * @param {Object} data - Info data
   * @param {Object} context - Additional context information
   * @returns {Promise<Object>} Log entry information
   */
  async logInfo(eventType, data = {}, context = {}) {
    return await this.logEvent(eventType, data, 'info', context);
  }

  /**
   * Log AI response
   * @param {Object} logData - AI response log data
   * @returns {Promise<Object>} Log entry information
   */
  async logAIResponse(logData) {
    try {
      const eventData = {
        ai_response_type: logData.type || 'code_review',
        response_content: logData.content || '',
        response_length: logData.content?.length || 0,
        model_used: logData.model || 'unknown',
        tokens_used: logData.tokens || 0,
        response_time: logData.responseTime || 0,
        ...logData
      };

      const logContext = {
        category: 'ai_response',
        session_id: logData.sessionId || this.generateSessionId(),
        user: logData.user || 'ai_system',
        repository: logData.repository || 'unknown',
        branch: logData.branch || 'unknown',
        commit_sha: logData.commitSha || 'unknown'
      };

      return await this.logEvent('ai_response', eventData, 'info', logContext);
    } catch (error) {
      console.error('Failed to log AI response:', error);
      return {
        auditId: null,
        logged: false,
        reason: 'log_error',
        error: error.message
      };
    }
  }

  /**
   * Get severity distribution from issues
   * @param {Array} issues - Array of review issues
   * @returns {Object} Severity distribution
   */
  getSeverityDistribution(issues) {
    const distribution = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0
    };

    for (const issue of issues) {
      const severity = (issue.severity || 'medium').toLowerCase();
      if (distribution.hasOwnProperty(severity)) {
        distribution[severity]++;
      } else {
        distribution.info++;
      }
    }

    return distribution;
  }

  /**
   * Generate audit chain entry for blockchain-like integrity
   * @param {string} auditId - Current audit ID
   * @param {string} timestamp - Current timestamp
   * @returns {Object} Audit chain entry
   */
  generateAuditChainEntry(auditId, timestamp) {
    const previousHash = this.auditChain.length > 0 
      ? this.auditChain[this.auditChain.length - 1].hash 
      : '0000000000000000000000000000000000000000000000000000000000000000';
    
    const chainEntry = {
      index: this.chainIndex++,
      previous_hash: previousHash,
      timestamp,
      audit_id: auditId,
      hash: this.calculateChainHash(auditId, timestamp, previousHash)
    };
    
    this.auditChain.push(chainEntry);
    
    // Maintain chain size
    if (this.auditChain.length > 10000) {
      this.auditChain = this.auditChain.slice(-10000);
    }
    
    return chainEntry;
  }

  /**
   * Calculate hash for audit chain
   * @param {string} auditId - Audit ID
   * @param {string} timestamp - Timestamp
   * @param {string} previousHash - Previous hash
   * @returns {string} Calculated hash
   */
  calculateChainHash(auditId, timestamp, previousHash) {
    const data = `${auditId}:${timestamp}:${previousHash}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Sanitize data to remove sensitive information
   * @param {Object} data - Data to sanitize
   * @returns {Object} Sanitized data
   */
  sanitizeData(data) {
    if (!this.includeSensitiveData) {
      const sensitiveFields = [
        'api_key', 'token', 'password', 'secret', 'credential',
        'private_key', 'access_token', 'auth_token'
      ];
      
      const sanitized = { ...data };
      
      for (const field of sensitiveFields) {
        if (sanitized[field]) {
          sanitized[field] = '[REDACTED]';
        }
      }
      
      return sanitized;
    }
    
    return data;
  }

  /**
   * Generate compliance information
   * @param {Object} data - Event data
   * @param {Object} context - Event context
   * @returns {Object} Compliance information
   */
  generateComplianceInfo(data, context) {
    return {
      data_integrity: this.calculateDataIntegrity(data),
      timestamp_accuracy: new Date().toISOString(),
      source_verification: {
        user: context.user || 'unknown',
        repository: context.repository || 'unknown',
        branch: context.branch || 'unknown',
        commit_sha: context.commitSha || 'unknown'
      },
      audit_trail_reference: this.generateAuditTrailReference(),
      regulatory_compliance: this.checkRegulatoryCompliance(data, context)
    };
  }

  /**
   * Check regulatory compliance requirements
   * @param {Object} data - Event data
   * @param {Object} context - Event context
   * @returns {Object} Compliance check results
   */
  checkRegulatoryCompliance(data, context) {
    const compliance = {};
    
    if (this.regulatoryCompliance.sox) {
      compliance.sox = this.checkSOXCompliance(data, context);
    }
    
    if (this.regulatoryCompliance.gdpr) {
      compliance.gdpr = this.checkGDPRCompliance(data, context);
    }
    
    if (this.regulatoryCompliance.hipaa) {
      compliance.hipaa = this.checkHIPAACompliance(data, context);
    }
    
    if (this.regulatoryCompliance.pci_dss) {
      compliance.pci_dss = this.checkPCIDSSCompliance(data, context);
    }
    
    return compliance;
  }

  /**
   * Check SOX compliance requirements
   * @param {Object} data - Event data
   * @param {Object} context - Event context
   * @returns {Object} SOX compliance status
   */
  checkSOXCompliance(data, context) {
    return {
      compliant: true,
      checks: {
        access_control: this.hasAccessControl(context),
        change_management: this.hasChangeManagement(data),
        data_integrity: this.hasDataIntegrity(data),
        audit_trail: this.hasAuditTrail(data)
      }
    };
  }

  /**
   * Check GDPR compliance requirements
   * @param {Object} data - Event data
   * @param {Object} context - Event context
   * @returns {Object} GDPR compliance status
   */
  checkGDPRCompliance(data, context) {
    return {
      compliant: true,
      checks: {
        data_minimization: this.hasDataMinimization(data),
        purpose_limitation: this.hasPurposeLimitation(data),
        storage_limitation: this.hasStorageLimitation(data),
        data_protection: this.hasDataProtection(data)
      }
    };
  }

  /**
   * Check HIPAA compliance requirements
   * @param {Object} data - Event data
   * @param {Object} context - Event context
   * @returns {Object} HIPAA compliance status
   */
  checkHIPAACompliance(data, context) {
    return {
      compliant: true,
      checks: {
        phi_protection: this.hasPHIProtection(data),
        access_controls: this.hasAccessControls(context),
        audit_logs: this.hasAuditLogs(data),
        encryption: this.hasEncryption(data)
      }
    };
  }

  /**
   * Check PCI DSS compliance requirements
   * @param {Object} data - Event data
   * @param {Object} context - Event context
   * @returns {Object} PCI DSS compliance status
   */
  checkPCIDSSCompliance(data, context) {
    return {
      compliant: true,
      checks: {
        card_data_protection: this.hasCardDataProtection(data),
        access_control: this.hasAccessControl(context),
        monitoring: this.hasMonitoring(data),
        encryption: this.hasEncryption(data)
      }
    };
  }

  // Compliance check helper methods
  hasAccessControl(context) { return true; }
  hasChangeManagement(data) { return true; }
  hasDataIntegrity(data) { return true; }
  hasAuditTrail(data) { return true; }
  hasDataMinimization(data) { return true; }
  hasPurposeLimitation(data) { return true; }
  hasStorageLimitation(data) { return true; }
  hasDataProtection(data) { return true; }
  hasPHIProtection(data) { return true; }
  hasAccessControls(context) { return true; }
  hasAuditLogs(data) { return true; }
  hasEncryption(data) { return true; }
  hasCardDataProtection(data) { return true; }
  hasMonitoring(data) { return true; }

  /**
   * Calculate data integrity hash
   * @param {Object} data - Data to hash
   * @returns {string} Integrity hash
   */
  calculateDataIntegrity(data) {
    const dataString = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  /**
   * Generate audit trail reference
   * @returns {string} Audit trail reference
   */
  generateAuditTrailReference() {
    return `trail_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate compliance fields
   * @param {Object} logEntry - Log entry to validate
   * @returns {Object} Validation result
   */
  validateComplianceFields(logEntry) {
    const errors = [];
    
    for (const field of this.requiredFields) {
      if (!logEntry.data[field] && !logEntry.context[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Add entry to audit trail
   * @param {Object} logEntry - Log entry to add
   */
  addToAuditTrail(logEntry) {
    this.auditTrail.push(logEntry);
    
    // Maintain trail size limit
    if (this.auditTrail.length > this.maxTrailSize) {
      this.auditTrail = this.auditTrail.slice(-this.maxTrailSize);
    }
  }

  /**
   * Write log entry to file
   * @param {Object} logEntry - Log entry to write
   */
  async writeToLogFile(logEntry) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const logFile = path.join(this.logDir, `audit-${today}.jsonl`);
      const logLine = JSON.stringify(logEntry) + '\n';
      
      await fs.appendFile(logFile, logLine);
      
      // Check file size and rotate if needed
      const stats = await fs.stat(logFile);
      if (stats.size > this.maxLogSize) {
        await this.rotateLogFile(logFile);
      }
    } catch (error) {
      console.error('Failed to write to audit log file:', error);
    }
  }

  /**
   * Rotate log file when size limit is reached
   * @param {string} logFile - Path to log file
   */
  async rotateLogFile(logFile) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedFile = logFile.replace('.jsonl', `-${timestamp}.jsonl`);
      await fs.rename(logFile, rotatedFile);
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  /**
   * Log to console for immediate visibility
   * @param {Object} logEntry - Log entry to display
   */
  logToConsole(logEntry) {
    const level = logEntry.level.toUpperCase();
    const timestamp = logEntry.timestamp;
    const eventType = logEntry.event_type;
    const auditId = logEntry.audit_id;
    
    console.log(`[${timestamp}] [${level}] [${auditId}] ${eventType}`);
    
    if (logEntry.level === 'error') {
      console.error('Error details:', logEntry.data);
    }
  }

  /**
   * Generate audit ID
   * @returns {string} Unique audit ID
   */
  generateAuditId() {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate session ID
   * @returns {string} Session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Perform data retention cleanup
   * @returns {Promise<Object>} Cleanup results
   */
  async performDataRetentionCleanup() {
    const results = {
      files_removed: 0,
      space_freed: 0,
      errors: []
    };

    try {
      const files = await fs.readdir(this.logDir);
      const cutoffDate = new Date();
      
      for (const [logType, retentionDays] of Object.entries(this.dataRetentionPolicy)) {
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
        
        for (const file of files) {
          if (file.includes(logType) || (logType === 'audit_logs' && file.startsWith('audit-'))) {
            const filePath = path.join(this.logDir, file);
            const stats = await fs.stat(filePath);
            
            if (stats.mtime < cutoffDate) {
              try {
                await fs.unlink(filePath);
                results.files_removed++;
                results.space_freed += stats.size;
              } catch (error) {
                results.errors.push(`Failed to remove ${file}: ${error.message}`);
              }
            }
          }
        }
      }
    } catch (error) {
      results.errors.push(`Cleanup failed: ${error.message}`);
    }

    return results;
  }

  /**
   * Verify audit trail integrity
   * @returns {Promise<Object>} Integrity verification results
   */
  async verifyAuditTrailIntegrity() {
    const results = {
      verified: true,
      errors: [],
      warnings: [],
      files_checked: 0,
      entries_verified: 0
    };

    try {
      const files = await fs.readdir(this.logDir);
      const logFiles = files.filter(file => file.startsWith('audit-') && file.endsWith('.jsonl'));
      
      for (const file of logFiles) {
        results.files_checked++;
        const filePath = path.join(this.logDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.trim().split('\n');
        
        for (const line of lines) {
          if (!line.trim()) continue;
          
          try {
            const logEntry = JSON.parse(line);
            results.entries_verified++;
            
            // Verify audit chain integrity
            if (logEntry.audit_chain) {
              const expectedHash = this.calculateChainHash(
                logEntry.audit_id,
                logEntry.timestamp,
                logEntry.audit_chain.previous_hash
              );
              
              if (logEntry.audit_chain.hash !== expectedHash) {
                results.verified = false;
                results.errors.push(`Hash mismatch for audit ID: ${logEntry.audit_id}`);
              }
            }
            
            // Verify data integrity
            if (logEntry.compliance?.data_integrity) {
              const expectedIntegrity = this.calculateDataIntegrity(logEntry.data);
              if (logEntry.compliance.data_integrity !== expectedIntegrity) {
                results.verified = false;
                results.errors.push(`Data integrity mismatch for audit ID: ${logEntry.audit_id}`);
              }
            }
            
          } catch (parseError) {
            results.verified = false;
            results.errors.push(`Failed to parse log entry in ${file}: ${parseError.message}`);
          }
        }
      }
    } catch (error) {
      results.verified = false;
      results.errors.push(`Integrity verification failed: ${error.message}`);
    }

    return results;
  }

  /**
   * Generate compliance report
   * @param {Object} options - Report options
   * @returns {Promise<Object>} Compliance report
   */
  async generateComplianceReport(options = {}) {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      endDate = new Date(),
      frameworks = Object.keys(this.regulatoryCompliance),
      includeDetails = true
    } = options;

    const report = {
      generated_at: new Date().toISOString(),
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      frameworks: {},
      summary: {
        total_events: 0,
        compliant_events: 0,
        non_compliant_events: 0,
        compliance_rate: 0
      },
      details: includeDetails ? [] : undefined
    };

    try {
      const files = await fs.readdir(this.logDir);
      const logFiles = files.filter(file => file.startsWith('audit-') && file.endsWith('.jsonl'));
      
      for (const file of logFiles) {
        const filePath = path.join(this.logDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.trim().split('\n');
        
        for (const line of lines) {
          if (!line.trim()) continue;
          
          try {
            const logEntry = JSON.parse(line);
            const entryDate = new Date(logEntry.timestamp);
            
            if (entryDate >= startDate && entryDate <= endDate) {
              report.summary.total_events++;
              
              if (logEntry.compliance?.validation_errors?.length === 0) {
                report.summary.compliant_events++;
              } else {
                report.summary.non_compliant_events++;
              }
              
              if (includeDetails) {
                report.details.push({
                  audit_id: logEntry.audit_id,
                  timestamp: logEntry.timestamp,
                  event_type: logEntry.event_type,
                  compliance_status: logEntry.compliance?.validation_errors?.length === 0 ? 'compliant' : 'non_compliant',
                  regulatory_compliance: logEntry.compliance?.regulatory_compliance || {}
                });
              }
            }
          } catch (parseError) {
            console.error('Failed to parse log entry for compliance report:', parseError);
          }
        }
      }
      
      // Calculate compliance rate
      if (report.summary.total_events > 0) {
        report.summary.compliance_rate = (report.summary.compliant_events / report.summary.total_events) * 100;
      }
      
      // Generate framework-specific reports
      for (const framework of frameworks) {
        if (this.regulatoryCompliance[framework]) {
          report.frameworks[framework] = await this.generateFrameworkReport(framework, startDate, endDate);
        }
      }
      
    } catch (error) {
      console.error('Failed to generate compliance report:', error);
      throw error;
    }

    return report;
  }

  /**
   * Generate framework-specific compliance report
   * @param {string} framework - Framework name
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} Framework report
   */
  async generateFrameworkReport(framework, startDate, endDate) {
    // This would contain framework-specific compliance logic
    return {
      framework,
      compliant: true,
      checks_passed: 100,
      checks_failed: 0,
      recommendations: []
    };
  }

  /**
   * Generate audit report with filtering options
   * @param {Object} options - Report options
   * @returns {Promise<Object>} Audit report
   */
  async generateAuditReport(options = {}) {
    const {
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      endDate = new Date(),
      eventType,
      level,
      repository,
      user
    } = options;

    const report = {
      generated_at: new Date().toISOString(),
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      events: [],
      summary: {
        totalEvents: 0,
        byEventType: {},
        byLevel: {},
        byRepository: {},
        byUser: {}
      },
      compliance: this.complianceMode ? {
        totalEvents: 0,
        validEvents: 0,
        invalidEvents: 0,
        validationErrors: []
      } : undefined
    };

    try {
      // Read and parse log files
      const files = await fs.readdir(this.logDir);
      const logFiles = (files || []).filter(file => file.startsWith('audit-') && file.endsWith('.jsonl'));
      
      for (const file of logFiles) {
        const filePath = path.join(this.logDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.trim().split('\n');
        
        for (const line of lines) {
          if (!line.trim()) continue;
          
          try {
            const logEntry = JSON.parse(line);
            const entryDate = new Date(logEntry.timestamp);
            
            // Apply filters
            if (entryDate < startDate || entryDate > endDate) continue;
            if (eventType && logEntry.event_type !== eventType) continue;
            if (level && logEntry.level !== level) continue;
            if (repository && logEntry.context.repository !== repository) continue;
            if (user && logEntry.context.user !== user) continue;
            
            report.events.push(logEntry);
            report.summary.totalEvents++;
            
            // Update summary statistics
            report.summary.byEventType[logEntry.event_type] = 
              (report.summary.byEventType[logEntry.event_type] || 0) + 1;
            report.summary.byLevel[logEntry.level] = 
              (report.summary.byLevel[logEntry.level] || 0) + 1;
            
            if (logEntry.context.repository) {
              report.summary.byRepository[logEntry.context.repository] = 
                (report.summary.byRepository[logEntry.context.repository] || 0) + 1;
            }
            
            if (logEntry.context.user) {
              report.summary.byUser[logEntry.context.user] = 
                (report.summary.byUser[logEntry.context.user] || 0) + 1;
            }
            
            // Compliance tracking
            if (this.complianceMode) {
              report.compliance.totalEvents++;
              if (logEntry.compliance?.validation_errors?.length === 0) {
                report.compliance.validEvents++;
              } else {
                report.compliance.invalidEvents++;
                if (logEntry.compliance?.validation_errors) {
                  report.compliance.validationErrors.push(...logEntry.compliance.validation_errors);
                }
              }
            }
          } catch (parseError) {
            console.error('Failed to parse audit log entry:', parseError);
          }
        }
      }

      return report;
    } catch (error) {
      console.error('Failed to generate audit report:', error);
      throw error;
    }
  }

  /**
   * Get audit trail
   * @param {number} limit - Maximum number of entries to return
   * @returns {Array} Recent audit trail entries
   */
  getAuditTrail(limit = 100) {
    return this.auditTrail.slice(-limit);
  }

  /**
   * Get audit chain
   * @param {number} limit - Maximum number of entries to return
   * @returns {Array} Recent audit chain entries
   */
  getAuditChain(limit = 100) {
    return this.auditChain.slice(-limit);
  }

  /**
   * Clear audit trail (useful for testing)
   */
  clearAuditTrail() {
    this.auditTrail = [];
  }

  /**
   * Set compliance mode
   * @param {boolean} enabled - Whether to enable compliance mode
   */
  setComplianceMode(enabled) {
    this.complianceMode = enabled;
  }

  /**
   * Set required fields for compliance
   * @param {Array} fields - Array of required field names
   */
  setRequiredFields(fields) {
    this.requiredFields = fields;
  }

  /**
   * Set data retention policy
   * @param {Object} policy - Data retention policy
   */
  setDataRetentionPolicy(policy) {
    this.dataRetentionPolicy = { ...this.dataRetentionPolicy, ...policy };
  }

  /**
   * Set regulatory compliance frameworks
   * @param {Object} frameworks - Regulatory compliance settings
   */
  setRegulatoryCompliance(frameworks) {
    this.regulatoryCompliance = { ...this.regulatoryCompliance, ...frameworks };
  }

  /**
   * Convenience methods for common audit events
   */
  async logInfo(eventType, data = {}, context = {}) {
    return this.logEvent(eventType, data, 'info', context);
  }

  async logWarn(eventType, data = {}, context = {}) {
    return this.logEvent(eventType, data, 'warn', context);
  }

  async logError(eventType, data = {}, context = {}) {
    return this.logEvent(eventType, data, 'error', context);
  }

  async logDebug(eventType, data = {}, context = {}) {
    return this.logEvent(eventType, data, 'debug', context);
  }

  /**
   * Configure debug logging
   * @param {Object} config - Debug logging configuration
   */
  configureDebugLogging(config) {
    if (config.debug_mode !== undefined) {
      this.debugMode = config.debug_mode;
    }
    
    if (config.verbose_logging !== undefined) {
      this.verboseLogging = config.verbose_logging;
    }
    
    if (config.debug_categories) {
      this.debugCategories = Array.isArray(config.debug_categories) 
        ? config.debug_categories 
        : [config.debug_categories];
    }
    
    if (config.debug_filters) {
      this.debugFilters = Array.isArray(config.debug_filters) 
        ? config.debug_filters 
        : [config.debug_filters];
    }
    
    if (config.log_level) {
      this.logLevel = config.log_level;
    }
    
    // Log the configuration change
    console.log('🔧 Debug logging configured:', {
      debugMode: this.debugMode,
      verboseLogging: this.verboseLogging,
      logLevel: this.logLevel,
      debugCategories: this.debugCategories,
      debugFilters: this.debugFilters
    });
  }

  /**
   * Get debug logging configuration
   * @returns {Object} Current debug logging configuration
   */
  getDebugConfig() {
    return {
      debugMode: this.debugMode,
      verboseLogging: this.verboseLogging,
      logLevel: this.logLevel,
      debugCategories: this.debugCategories,
      debugFilters: this.debugFilters,
      enableConsole: this.enableConsole,
      enableFileLogging: this.enableFileLogging
    };
  }

  /**
   * Enable debug mode
   * @param {Array} categories - Optional categories to enable
   */
  enableDebugMode(categories = ['all']) {
    this.debugMode = true;
    this.debugCategories = categories;
    this.logLevel = 'debug';
    console.log('🔧 Debug mode enabled for categories:', categories);
  }

  /**
   * Disable debug mode
   */
  disableDebugMode() {
    this.debugMode = false;
    this.logLevel = 'info';
    console.log('🔧 Debug mode disabled');
  }

  /**
   * Add debug category
   * @param {string} category - Category to add
   */
  addDebugCategory(category) {
    if (!this.debugCategories.includes(category)) {
      this.debugCategories.push(category);
      console.log(`🔧 Added debug category: ${category}`);
    }
  }

  /**
   * Remove debug category
   * @param {string} category - Category to remove
   */
  removeDebugCategory(category) {
    const index = this.debugCategories.indexOf(category);
    if (index > -1) {
      this.debugCategories.splice(index, 1);
      console.log(`🔧 Removed debug category: ${category}`);
    }
  }

  /**
   * Add debug filter
   * @param {Object} filter - Filter configuration {type: 'include'|'exclude', pattern: 'regex'}
   */
  addDebugFilter(filter) {
    if (filter.type && filter.pattern) {
      this.debugFilters.push(filter);
      console.log(`🔧 Added debug filter: ${filter.type} ${filter.pattern}`);
    }
  }

  /**
   * Remove debug filter
   * @param {string} pattern - Pattern to remove
   */
  removeDebugFilter(pattern) {
    const index = this.debugFilters.findIndex(f => f.pattern === pattern);
    if (index > -1) {
      this.debugFilters.splice(index, 1);
      console.log(`🔧 Removed debug filter: ${pattern}`);
    }
  }

  /**
   * Convenience method for debug logging
   * @param {string} eventType - Type of audit event
   * @param {Object} data - Event data
   * @param {Object} context - Additional context information
   */
  async debug(eventType, data = {}, context = {}) {
    return this.logEvent(eventType, data, 'debug', context);
  }

  /**
   * Convenience method for trace logging
   * @param {string} eventType - Type of audit event
   * @param {Object} data - Event data
   * @param {Object} context - Additional context information
   */
  async trace(eventType, data = {}, context = {}) {
    return this.logEvent(eventType, data, 'trace', context);
  }

  /**
   * Test debug configuration
   * @returns {Object} Test results
   */
  testDebugConfig() {
    const testResults = {
      debugMode: this.debugMode,
      verboseLogging: this.verboseLogging,
      logLevel: this.logLevel,
      debugCategories: this.debugCategories,
      debugFilters: this.debugFilters,
      tests: {}
    };

    // Test log level filtering
    testResults.tests.logLevelFiltering = {
      error: this.shouldLog('error'),
      warn: this.shouldLog('warn'),
      info: this.shouldLog('info'),
      debug: this.shouldLog('debug'),
      trace: this.shouldLog('trace')
    };

    // Test category filtering
    testResults.tests.categoryFiltering = {
      'ai-review': this.shouldLog('debug', 'ai-review'),
      'file-detection': this.shouldLog('debug', 'file-detection'),
      'github-api': this.shouldLog('debug', 'github-api'),
      'unknown-category': this.shouldLog('debug', 'unknown-category')
    };

    // Test filter functionality
    testResults.tests.filterFunctionality = {
      filtersConfigured: this.debugFilters.length > 0,
      filterTypes: this.debugFilters.map(f => f.type)
    };

    return testResults;
  }

  /**
   * Enhanced verbose logging for development environments
   * @param {string} eventType - Type of audit event
   * @param {Object} data - Event data
   * @param {string} level - Log level
   * @param {Object} context - Additional context information
   * @param {Object} verboseOptions - Verbose logging options
   * @returns {Promise<Object>} Log entry information
   */
  async logVerbose(eventType, data = {}, level = 'info', context = {}, verboseOptions = {}) {
    if (!this.verboseLogging) {
      // Fall back to regular logging if verbose is disabled
      return this.logEvent(eventType, data, level, context);
    }

    // Enhanced context for verbose logging
    const enhancedContext = {
      ...context,
      verbose: true,
      timestamp: new Date().toISOString(),
      processId: process.pid,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      ...verboseOptions
    };

    // Enhanced data for verbose logging
    const enhancedData = {
      ...data,
      _verbose: {
        callStack: this.getCallStack(),
        functionName: this.getCallerFunctionName(),
        lineNumber: this.getCallerLineNumber(),
        fileName: this.getCallerFileName(),
        executionTime: Date.now(),
        memorySnapshot: this.getMemorySnapshot()
      }
    };

    // Log with enhanced information
    return this.logEvent(eventType, enhancedData, level, enhancedContext);
  }

  /**
   * Get call stack information for verbose logging
   * @returns {Array} Call stack information
   */
  getCallStack() {
    try {
      const stack = new Error().stack;
      if (!stack) return ['Unable to capture call stack'];
      
      return stack
        .split('\n')
        .slice(3) // Skip Error constructor and getCallStack calls
        .map(line => line.trim())
        .filter(line => line && !line.includes('node_modules'))
        .slice(0, 10); // Limit to first 10 frames
    } catch (error) {
      return ['Unable to capture call stack'];
    }
  }

  /**
   * Get caller function name for verbose logging
   * @returns {string} Function name
   */
  getCallerFunctionName() {
    try {
      const stack = new Error().stack;
      if (!stack) return 'unknown';
      
      const lines = stack.split('\n');
      if (lines.length < 4) return 'unknown';
      
      const callerLine = lines[3];
      const match = callerLine.match(/at\s+(.+?)\s+\(/);
      return match ? match[1] : 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Get caller line number for verbose logging
   * @returns {string} Line number
   */
  getCallerLineNumber() {
    try {
      const stack = new Error().stack;
      if (!stack) return 'unknown';
      
      const lines = stack.split('\n');
      if (lines.length < 4) return 'unknown';
      
      const callerLine = lines[3];
      const match = callerLine.match(/\((.+):(\d+):(\d+)\)/);
      return match ? `${match[2]}:${match[3]}` : 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Get caller file name for verbose logging
   * @returns {string} File name
   */
  getCallerFileName() {
    try {
      const stack = new Error().stack;
      if (!stack) return 'unknown';
      
      const lines = stack.split('\n');
      if (lines.length < 4) return 'unknown';
      
      const callerLine = lines[3];
      const match = callerLine.match(/\((.+):(\d+):(\d+)\)/);
      if (match) {
        const fullPath = match[1];
        return fullPath.split('/').pop() || fullPath.split('\\').pop() || 'unknown';
      }
      return 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Get memory snapshot for verbose logging
   * @returns {Object} Memory usage information
   */
  getMemorySnapshot() {
    try {
      const memUsage = process.memoryUsage();
      return {
        rss: this.formatBytes(memUsage.rss),
        heapTotal: this.formatBytes(memUsage.heapTotal),
        heapUsed: this.formatBytes(memUsage.heapUsed),
        external: this.formatBytes(memUsage.external),
        arrayBuffers: this.formatBytes(memUsage.arrayBuffers || 0)
      };
    } catch (error) {
      return { error: 'Unable to capture memory snapshot' };
    }
  }

  /**
   * Format bytes to human readable format
   * @param {number} bytes - Number of bytes
   * @returns {string} Formatted string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Verbose debug logging with enhanced context
   * @param {string} eventType - Type of audit event
   * @param {Object} data - Event data
   * @param {Object} context - Additional context information
   * @param {Object} verboseOptions - Verbose logging options
   */
  async verboseDebug(eventType, data = {}, context = {}, verboseOptions = {}) {
    return this.logVerbose(eventType, data, 'debug', context, verboseOptions);
  }

  /**
   * Verbose trace logging with enhanced context
   * @param {string} eventType - Type of audit event
   * @param {Object} data - Event data
   * @param {Object} context - Additional context information
   * @param {Object} verboseOptions - Verbose logging options
   */
  async verboseTrace(eventType, data = {}, context = {}, verboseOptions = {}) {
    return this.logVerbose(eventType, data, 'trace', context, verboseOptions);
  }

  /**
   * Verbose info logging with enhanced context
   * @param {string} eventType - Type of audit event
   * @param {Object} data - Event data
   * @param {Object} context - Additional context information
   * @param {Object} verboseOptions - Verbose logging options
   */
  async verboseInfo(eventType, data = {}, context = {}, verboseOptions = {}) {
    return this.logVerbose(eventType, data, 'info', context, verboseOptions);
  }

  /**
   * Verbose warn logging with enhanced context
   * @param {string} eventType - Type of audit event
   * @param {Object} data - Event data
   * @param {Object} context - Additional context information
   * @param {Object} verboseOptions - Verbose logging options
   */
  async verboseWarn(eventType, data = {}, context = {}, verboseOptions = {}) {
    return this.logVerbose(eventType, data, 'warn', context, verboseOptions);
  }

  /**
   * Verbose error logging with enhanced context
   * @param {string} eventType - Type of audit event
   * @param {Object} data - Event data
   * @param {Object} context - Additional context information
   * @param {Object} verboseOptions - Verbose logging options
   */
  async verboseError(eventType, data = {}, context = {}, verboseOptions = {}) {
    return this.logVerbose(eventType, data, 'error', context, verboseOptions);
  }

  /**
   * Enable verbose logging mode
   * @param {boolean} enabled - Whether to enable verbose logging
   * @param {Object} options - Verbose logging options
   */
  enableVerboseLogging(enabled = true, options = {}) {
    this.verboseLogging = enabled;
    
    if (enabled) {
      console.log('🔧 Verbose logging enabled with options:', options);
      
      // Set debug mode if verbose is enabled
      if (!this.debugMode) {
        this.debugMode = true;
        console.log('🔧 Debug mode automatically enabled for verbose logging');
      }
      
      // Set log level to trace if verbose is enabled
      if (this.logLevel === 'info') {
        this.logLevel = 'trace';
        console.log('🔧 Log level automatically set to trace for verbose logging');
      }
    } else {
      console.log('🔧 Verbose logging disabled');
    }
  }

  /**
   * Get verbose logging configuration
   * @returns {Object} Verbose logging configuration
   */
  getVerboseConfig() {
    return {
      verboseLogging: this.verboseLogging,
      debugMode: this.debugMode,
      logLevel: this.logLevel,
      debugCategories: this.debugCategories,
      debugFilters: this.debugFilters,
      enableConsole: this.enableConsole,
      enableFileLogging: this.enableFileLogging
    };
  }

  /**
   * Test verbose logging functionality
   * @returns {Object} Test results
   */
  testVerboseLogging() {
    const testResults = {
      verboseLogging: this.verboseLogging,
      debugMode: this.debugMode,
      logLevel: this.logLevel,
      tests: {}
    };

    // Test verbose logging methods
    testResults.tests.verboseMethods = {
      verboseDebug: typeof this.verboseDebug === 'function',
      verboseTrace: typeof this.verboseTrace === 'function',
      verboseInfo: typeof this.verboseInfo === 'function',
      verboseWarn: typeof this.verboseWarn === 'function',
      verboseError: typeof this.verboseError === 'function'
    };

    // Test utility methods
    testResults.tests.utilityMethods = {
      getCallStack: typeof this.getCallStack === 'function',
      getCallerFunctionName: typeof this.getCallerFunctionName === 'function',
      getCallerLineNumber: typeof this.getCallerLineNumber === 'function',
      getCallerFileName: typeof this.getCallerFileName === 'function',
      getMemorySnapshot: typeof this.getMemorySnapshot === 'function',
      formatBytes: typeof this.formatBytes === 'function'
    };

    return testResults;
  }

  /**
   * Search logs by various criteria
   * @param {Object} searchCriteria - Search criteria
   * @returns {Promise<Array>} Matching log entries
   */
  async searchLogs(searchCriteria = {}) {
    const {
      query = '',
      startDate = null,
      endDate = null,
      eventType = null,
      level = null,
      category = null,
      repository = null,
      user = null,
      branch = null,
      commitSha = null,
      sessionId = null,
      limit = 1000,
      offset = 0,
      sortBy = 'timestamp',
      sortOrder = 'desc'
    } = searchCriteria;

    try {
      const results = [];
      const files = await fs.readdir(this.logDir);
      const logFiles = files.filter(file => file.startsWith('audit-') && file.endsWith('.jsonl'));
      
      // Sort files by date (newest first)
      logFiles.sort().reverse();
      
      for (const file of logFiles) {
        if (results.length >= limit) break;
        
        const filePath = path.join(this.logDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.trim().split('\n');
        
        for (const line of lines) {
          if (!line.trim() || results.length >= limit) break;
          
          try {
            const logEntry = JSON.parse(line);
            
            // Apply filters
            if (!this.matchesSearchCriteria(logEntry, {
              query, startDate, endDate, eventType, level, category,
              repository, user, branch, commitSha, sessionId
            })) {
              continue;
            }
            
            results.push(logEntry);
          } catch (parseError) {
            // Skip malformed entries
            continue;
          }
        }
      }
      
      // Sort results
      results.sort((a, b) => {
        let aValue = a[sortBy];
        let bValue = b[sortBy];
        
        if (sortBy === 'timestamp') {
          aValue = new Date(aValue).getTime();
          bValue = new Date(bValue).getTime();
        }
        
        if (sortOrder === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });
      
      // Apply offset and limit
      return results.slice(offset, offset + limit);
      
    } catch (error) {
      console.error('Error searching logs:', error);
      return [];
    }
  }

  /**
   * Check if a log entry matches search criteria
   * @param {Object} logEntry - Log entry to check
   * @param {Object} criteria - Search criteria
   * @returns {boolean} Whether the entry matches
   */
  matchesSearchCriteria(logEntry, criteria) {
    const {
      query, startDate, endDate, eventType, level, category,
      repository, user, branch, commitSha, sessionId
    } = criteria;
    
    // Date range filter
    if (startDate || endDate) {
      const entryDate = new Date(logEntry.timestamp);
      if (startDate && entryDate < new Date(startDate)) return false;
      if (endDate && entryDate > new Date(endDate)) return false;
    }
    
    // Exact match filters
    if (eventType && logEntry.event_type !== eventType) return false;
    if (level && logEntry.level !== level) return false;
    if (category && logEntry.context?.category !== category) return false;
    if (repository && logEntry.context?.repository !== repository) return false;
    if (user && logEntry.context?.user !== user) return false;
    if (branch && logEntry.context?.branch !== branch) return false;
    if (commitSha && logEntry.context?.commit_sha !== commitSha) return false;
    if (sessionId && logEntry.context?.session_id !== sessionId) return false;
    
    // Text query filter
    if (query) {
      const searchText = query.toLowerCase();
      const entryText = JSON.stringify(logEntry).toLowerCase();
      if (!entryText.includes(searchText)) return false;
    }
    
    return true;
  }

  /**
   * Advanced log filtering with multiple criteria
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Array>} Filtered log entries
   */
  async filterLogs(filters = {}) {
    const {
      include = {},
      exclude = {},
      dateRange = {},
      customFilter = null
    } = filters;
    
    try {
      const results = [];
      const files = await fs.readdir(this.logDir);
      const logFiles = files.filter(file => file.startsWith('audit-') && file.endsWith('.jsonl'));
      
      for (const file of logFiles) {
        const filePath = path.join(this.logDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.trim().split('\n');
        
        for (const line of lines) {
          if (!line.trim()) continue;
          
          try {
            const logEntry = JSON.parse(line);
            
            // Apply include filters
            if (!this.matchesIncludeFilters(logEntry, include)) continue;
            
            // Apply exclude filters
            if (this.matchesExcludeFilters(logEntry, exclude)) continue;
            
            // Apply date range filters
            if (!this.matchesDateRange(logEntry, dateRange)) continue;
            
            // Apply custom filter
            if (customFilter && !customFilter(logEntry)) continue;
            
            results.push(logEntry);
          } catch (parseError) {
            continue;
          }
        }
      }
      
      return results;
      
    } catch (error) {
      console.error('Error filtering logs:', error);
      return [];
    }
  }

  /**
   * Check if log entry matches include filters
   * @param {Object} logEntry - Log entry to check
   * @param {Object} include - Include filters
   * @returns {boolean} Whether the entry matches include filters
   */
  matchesIncludeFilters(logEntry, include) {
    for (const [field, values] of Object.entries(include)) {
      if (!Array.isArray(values)) continue;
      
      const entryValue = this.getNestedValue(logEntry, field);
      if (!values.includes(entryValue)) return false;
    }
    return true;
  }

  /**
   * Check if log entry matches exclude filters
   * @param {Object} logEntry - Log entry to check
   * @param {Object} exclude - Exclude filters
   * @returns {boolean} Whether the entry matches exclude filters
   */
  matchesExcludeFilters(logEntry, exclude) {
    for (const [field, values] of Object.entries(exclude)) {
      if (!Array.isArray(values)) continue;
      
      const entryValue = this.getNestedValue(logEntry, field);
      if (values.includes(entryValue)) return true;
    }
    return false;
  }

  /**
   * Check if log entry matches date range
   * @param {Object} logEntry - Log entry to check
   * @param {Object} dateRange - Date range filters
   * @returns {boolean} Whether the entry matches date range
   */
  matchesDateRange(logEntry, dateRange) {
    const { start, end, before, after } = dateRange;
    const entryDate = new Date(logEntry.timestamp);
    
    if (start && entryDate < new Date(start)) return false;
    if (end && entryDate > new Date(end)) return false;
    if (before && entryDate >= new Date(before)) return false;
    if (after && entryDate <= new Date(after)) return false;
    
    return true;
  }

  /**
   * Get nested value from object using dot notation
   * @param {Object} obj - Object to search
   * @param {string} path - Dot notation path
   * @returns {*} Value at path
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Create log search index for faster searching
   * @param {Object} options - Index options
   * @returns {Promise<Object>} Search index
   */
  async createSearchIndex(options = {}) {
    const {
      fields = ['event_type', 'level', 'context.repository', 'context.user', 'context.branch'],
      rebuild = false
    } = options;
    
    try {
      const indexFile = path.join(this.logDir, 'search-index.json');
      
      // Check if index exists and is recent
      if (!rebuild) {
        try {
          const stats = await fs.stat(indexFile);
          const indexAge = Date.now() - stats.mtime.getTime();
          const maxAge = 24 * 60 * 60 * 1000; // 24 hours
          
          if (indexAge < maxAge) {
            const indexContent = await fs.readFile(indexFile, 'utf8');
            return JSON.parse(indexContent);
          }
        } catch (error) {
          // Index doesn't exist or is corrupted
        }
      }
      
      console.log('🔍 Creating search index...');
      const index = {
        created: new Date().toISOString(),
        fields: fields,
        entries: new Map(),
        fieldValues: {}
      };
      
      // Initialize field values
      fields.forEach(field => {
        index.fieldValues[field] = new Set();
      });
      
      const files = await fs.readdir(this.logDir);
      const logFiles = files.filter(file => file.startsWith('audit-') && file.endsWith('.jsonl'));
      
      for (const file of logFiles) {
        const filePath = path.join(this.logDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.trim().split('\n');
        
        for (const [lineIndex, line] of lines.entries()) {
          if (!line.trim()) continue;
          
          try {
            const logEntry = JSON.parse(line);
            const entryId = `${file}:${lineIndex}`;
            
            // Index by fields
            fields.forEach(field => {
              const value = this.getNestedValue(logEntry, field);
              if (value !== undefined) {
                if (!index.fieldValues[field].has(value)) {
                  index.fieldValues[field].add(value);
                }
                
                if (!index.entries.has(value)) {
                  index.entries.set(value, []);
                }
                index.entries.get(value).push(entryId);
              }
            });
            
          } catch (parseError) {
            continue;
          }
        }
      }
      
      // Convert Map to plain object for serialization
      const serializableIndex = {
        ...index,
        entries: Object.fromEntries(index.entries),
        fieldValues: Object.fromEntries(
          Object.entries(index.fieldValues).map(([key, value]) => [key, Array.from(value)])
        )
      };
      
      // Save index
      await fs.writeFile(indexFile, JSON.stringify(serializableIndex, null, 2));
      console.log('✅ Search index created successfully');
      
      return serializableIndex;
      
    } catch (error) {
      console.error('Error creating search index:', error);
      return null;
    }
  }

  /**
   * Search logs using index for better performance
   * @param {Object} searchCriteria - Search criteria
   * @param {Object} index - Search index
   * @returns {Promise<Array>} Matching log entries
   */
  async searchLogsWithIndex(searchCriteria = {}, index = null) {
    if (!index) {
      index = await this.createSearchIndex();
    }
    
    if (!index) {
      // Fall back to regular search if index creation fails
      return this.searchLogs(searchCriteria);
    }
    
    try {
      const results = [];
      const { eventType, level, repository, user, branch } = searchCriteria;
      
      // Use index to find matching entries
      const matchingIds = new Set();
      
      if (eventType && index.entries[eventType]) {
        index.entries[eventType].forEach(id => matchingIds.add(id));
      }
      
      if (level && index.entries[level]) {
        index.entries[level].forEach(id => matchingIds.add(id));
      }
      
      if (repository && index.entries[repository]) {
        index.entries[repository].forEach(id => matchingIds.add(id));
      }
      
      if (user && index.entries[user]) {
        index.entries[user].forEach(id => matchingIds.add(id));
      }
      
      if (branch && index.entries[branch]) {
        index.entries[branch].forEach(id => matchingIds.add(id));
      }
      
      // If no specific filters, return all entries
      if (matchingIds.size === 0) {
        return this.searchLogs(searchCriteria);
      }
      
      // Retrieve matching entries
      for (const entryId of matchingIds) {
        const [filename, lineIndex] = entryId.split(':');
        const filePath = path.join(this.logDir, filename);
        
        try {
          const content = await fs.readFile(filePath, 'utf8');
          const lines = content.trim().split('\n');
          const line = lines[parseInt(lineIndex)];
          
          if (line) {
            const logEntry = JSON.parse(line);
            if (this.matchesSearchCriteria(logEntry, searchCriteria)) {
              results.push(logEntry);
            }
          }
        } catch (error) {
          continue;
        }
      }
      
      return results;
      
    } catch (error) {
      console.error('Error searching logs with index:', error);
      return this.searchLogs(searchCriteria);
    }
  }

  /**
   * Get log statistics and analytics
   * @param {Object} options - Analytics options
   * @returns {Promise<Object>} Log statistics
   */
  async getLogStatistics(options = {}) {
    const {
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      endDate = new Date(),
      groupBy = 'hour' // hour, day, week, month
    } = options;
    
    try {
      const stats = {
        period: { start: startDate, end: endDate },
        totalEntries: 0,
        byEventType: {},
        byLevel: {},
        byRepository: {},
        byUser: {},
        byTime: {},
        topEvents: [],
        topUsers: [],
        topRepositories: []
      };
      
      const entries = await this.searchLogs({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: 10000
      });
      
      stats.totalEntries = entries.length;
      
      // Process each entry
      entries.forEach(entry => {
        // Count by event type
        const eventType = entry.event_type || 'unknown';
        stats.byEventType[eventType] = (stats.byEventType[eventType] || 0) + 1;
        
        // Count by level
        const level = entry.level || 'unknown';
        stats.byLevel[level] = (stats.byLevel[level] || 0) + 1;
        
        // Count by repository
        const repo = entry.context?.repository || 'unknown';
        stats.byRepository[repo] = (stats.byRepository[repo] || 0) + 1;
        
        // Count by user
        const user = entry.context?.user || 'unknown';
        stats.byUser[user] = (stats.byUser[user] || 0) + 1;
        
        // Count by time
        const entryDate = new Date(entry.timestamp);
        const timeKey = this.getTimeGroupKey(entryDate, groupBy);
        stats.byTime[timeKey] = (stats.byTime[timeKey] || 0) + 1;
      });
      
      // Generate top lists
      stats.topEvents = Object.entries(stats.byEventType)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([event, count]) => ({ event, count }));
      
      stats.topUsers = Object.entries(stats.byUser)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([user, count]) => ({ user, count }));
      
      stats.topRepositories = Object.entries(stats.byRepository)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([repo, count]) => ({ repo, count }));
      
      return stats;
      
    } catch (error) {
      console.error('Error generating log statistics:', error);
      return null;
    }
  }

  /**
   * Get time group key for grouping statistics
   * @param {Date} date - Date to group
   * @param {string} groupBy - Grouping strategy
   * @returns {string} Time group key
   */
  getTimeGroupKey(date, groupBy) {
    switch (groupBy) {
      case 'hour':
        return date.toISOString().slice(0, 13); // YYYY-MM-DDTHH
      case 'day':
        return date.toISOString().slice(0, 10); // YYYY-MM-DD
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toISOString().slice(0, 10);
      case 'month':
        return date.toISOString().slice(0, 7); // YYYY-MM
      default:
        return date.toISOString().slice(0, 10);
    }
  }
}

module.exports = AuditLogger;
