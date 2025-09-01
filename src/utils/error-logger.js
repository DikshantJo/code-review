const fs = require('fs').promises;
const path = require('path');

/**
 * Comprehensive error logging and reporting utility for AI Code Review system
 * Handles structured error logging, categorization, and reporting
 */
class ErrorLogger {
  constructor(config = {}) {
    this.config = config;
    this.logDir = config.logging?.error_log_dir || './logs/errors';
    this.maxLogFiles = config.logging?.max_error_log_files || 10;
    this.maxLogSize = config.logging?.max_error_log_size || 10 * 1024 * 1024; // 10MB
    this.retentionDays = config.logging?.error_retention_days || 30;
    this.errorCounts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      unknown: 0
    };
    this.errorCategories = {
      ai_service: 0,
      github_api: 0,
      configuration: 0,
      file_processing: 0,
      network: 0,
      validation: 0,
      other: 0
    };
    this.initializeLogDirectory();
  }

  /**
   * Initialize log directory
   */
  async initializeLogDirectory() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create error log directory:', error);
    }
  }

  /**
   * Log an error with structured information
   * @param {Error|string} error - Error object or error message
   * @param {Object} context - Additional context information
   * @param {string} severity - Error severity (critical, high, medium, low)
   * @param {string} category - Error category
   * @returns {Promise<Object>} Log entry information
   */
  async logError(error, context = {}, severity = 'medium', category = 'other') {
    const timestamp = new Date().toISOString();
    const errorId = this.generateErrorId();
    
    const logEntry = {
      id: errorId,
      timestamp,
      severity: severity.toLowerCase(),
      category: category.toLowerCase(),
      message: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      context: {
        ...context,
        userAgent: context.userAgent || 'AI-Code-Review-System',
        version: context.version || '1.0.0'
      }
    };

    // Update error counts
    this.errorCounts[severity.toLowerCase()] = (this.errorCounts[severity.toLowerCase()] || 0) + 1;
    this.errorCategories[category.toLowerCase()] = (this.errorCategories[category.toLowerCase()] || 0) + 1;

    // Write to log file
    await this.writeToLogFile(logEntry);
    
    // Console output for immediate visibility
    this.logToConsole(logEntry);

    return {
      errorId,
      logged: true,
      timestamp,
      severity,
      category
    };
  }

  /**
   * Write error entry to log file
   * @param {Object} logEntry - Error log entry
   */
  async writeToLogFile(logEntry) {
    try {
      const logFile = path.join(this.logDir, `errors-${new Date().toISOString().split('T')[0]}.jsonl`);
      const logLine = JSON.stringify(logEntry) + '\n';
      
      await fs.appendFile(logFile, logLine);
      
      // Check file size and rotate if needed
      await this.rotateLogFileIfNeeded(logFile);
    } catch (error) {
      console.error('Failed to write error to log file:', error);
    }
  }

  /**
   * Log to console for immediate visibility
   * @param {Object} logEntry - Error log entry
   */
  logToConsole(logEntry) {
    const severityColors = {
      critical: '\x1b[31m', // Red
      high: '\x1b[35m',     // Magenta
      medium: '\x1b[33m',   // Yellow
      low: '\x1b[36m',      // Cyan
      unknown: '\x1b[37m'   // White
    };
    
    const resetColor = '\x1b[0m';
    const color = severityColors[logEntry.severity] || severityColors.unknown;
    
    console.error(`${color}[ERROR-${logEntry.severity.toUpperCase()}] ${logEntry.timestamp} [${logEntry.category}] ${logEntry.message}${resetColor}`);
    
    if (logEntry.context.repository) {
      console.error(`  Repository: ${logEntry.context.repository}`);
    }
    if (logEntry.context.branch) {
      console.error(`  Branch: ${logEntry.context.branch}`);
    }
    if (logEntry.context.commitSha) {
      console.error(`  Commit: ${logEntry.context.commitSha}`);
    }
  }

  /**
   * Generate unique error ID
   * @returns {string} Unique error identifier
   */
  generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Rotate log file if it exceeds size limit
   * @param {string} logFile - Path to log file
   */
  async rotateLogFileIfNeeded(logFile) {
    try {
      const stats = await fs.stat(logFile);
      if (stats.size > this.maxLogSize) {
        const backupFile = `${logFile}.${Date.now()}`;
        await fs.rename(logFile, backupFile);
        await this.cleanupOldLogFiles();
      }
    } catch (error) {
      // File doesn't exist or other error, ignore
    }
  }

  /**
   * Clean up old log files
   */
  async cleanupOldLogFiles() {
    try {
      const files = await fs.readdir(this.logDir);
      const logFiles = files.filter(file => file.startsWith('errors-') && file.endsWith('.jsonl'));
      
      // Sort by modification time (oldest first)
      const fileStats = await Promise.all(
        logFiles.map(async (file) => {
          const filePath = path.join(this.logDir, file);
          const stats = await fs.stat(filePath);
          return { file, filePath, mtime: stats.mtime };
        })
      );
      
      fileStats.sort((a, b) => a.mtime - b.mtime);
      
      // Remove old files beyond maxLogFiles limit
      if (fileStats.length > this.maxLogFiles) {
        const filesToRemove = fileStats.slice(0, fileStats.length - this.maxLogFiles);
        for (const fileInfo of filesToRemove) {
          await fs.unlink(fileInfo.filePath);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old log files:', error);
    }
  }

  /**
   * Generate error report
   * @param {Object} options - Report options
   * @returns {Promise<Object>} Error report
   */
  async generateErrorReport(options = {}) {
    const {
      startDate = new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      endDate = new Date(),
      severity = null,
      category = null
    } = options;

    try {
      const report = {
        generatedAt: new Date().toISOString(),
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        summary: {
          totalErrors: 0,
          bySeverity: { ...this.errorCounts },
          byCategory: { ...this.errorCategories }
        },
        errors: [],
        recommendations: []
      };

      // Read and parse log files
      const files = await fs.readdir(this.logDir);
      const logFiles = files.filter(file => file.startsWith('errors-') && file.endsWith('.jsonl'));
      
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
            if (severity && logEntry.severity !== severity) continue;
            if (category && logEntry.category !== category) continue;
            
            report.errors.push(logEntry);
            report.summary.totalErrors++;
          } catch (parseError) {
            console.error('Failed to parse log entry:', parseError);
          }
        }
      }

      // Generate recommendations
      report.recommendations = this.generateRecommendations(report);

      return report;
    } catch (error) {
      console.error('Failed to generate error report:', error);
      throw error;
    }
  }

  /**
   * Generate recommendations based on error patterns
   * @param {Object} report - Error report
   * @returns {Array} List of recommendations
   */
  generateRecommendations(report) {
    const recommendations = [];
    
    // Analyze error patterns
    const criticalErrors = report.errors.filter(e => e.severity === 'critical');
    const aiServiceErrors = report.errors.filter(e => e.category === 'ai_service');
    const githubApiErrors = report.errors.filter(e => e.category === 'github_api');
    
    if (criticalErrors.length > 0) {
      recommendations.push({
        priority: 'high',
        type: 'critical_errors',
        message: `${criticalErrors.length} critical errors detected. Immediate attention required.`,
        action: 'Review critical errors and implement fixes immediately.'
      });
    }
    
    if (aiServiceErrors.length > 5) {
      recommendations.push({
        priority: 'medium',
        type: 'ai_service_issues',
        message: `${aiServiceErrors.length} AI service errors detected.`,
        action: 'Check OpenAI API status and review API key configuration.'
      });
    }
    
    if (githubApiErrors.length > 3) {
      recommendations.push({
        priority: 'medium',
        type: 'github_api_issues',
        message: `${githubApiErrors.length} GitHub API errors detected.`,
        action: 'Verify GitHub token permissions and API rate limits.'
      });
    }
    
    if (report.summary.totalErrors > 20) {
      recommendations.push({
        priority: 'low',
        type: 'high_error_volume',
        message: `High error volume (${report.summary.totalErrors} errors) detected.`,
        action: 'Consider implementing additional error handling and monitoring.'
      });
    }
    
    return recommendations;
  }

  /**
   * Get error statistics
   * @returns {Object} Error statistics
   */
  getErrorStats() {
    return {
      counts: { ...this.errorCounts },
      categories: { ...this.errorCategories },
      totalErrors: Object.values(this.errorCounts).reduce((sum, count) => sum + count, 0)
    };
  }

  /**
   * Clear error statistics (useful for testing)
   */
  clearStats() {
    this.errorCounts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      unknown: 0
    };
    this.errorCategories = {
      ai_service: 0,
      github_api: 0,
      configuration: 0,
      file_processing: 0,
      network: 0,
      validation: 0,
      other: 0
    };
  }

  /**
   * Log a critical error (convenience method)
   * @param {Error|string} error - Error object or message
   * @param {Object} context - Additional context
   * @param {string} category - Error category
   */
  async logCriticalError(error, context = {}, category = 'other') {
    return this.logError(error, context, 'critical', category);
  }

  /**
   * Log a high severity error (convenience method)
   * @param {Error|string} error - Error object or message
   * @param {Object} context - Additional context
   * @param {string} category - Error category
   */
  async logHighError(error, context = {}, category = 'other') {
    return this.logError(error, context, 'high', category);
  }

  /**
   * Log a medium severity error (convenience method)
   * @param {Error|string} error - Error object or message
   * @param {Object} context - Additional context
   * @param {string} category - Error category
   */
  async logMediumError(error, context = {}, category = 'other') {
    return this.logError(error, context, 'medium', category);
  }

  /**
   * Log a low severity error (convenience method)
   * @param {Error|string} error - Error object or message
   * @param {Object} context - Additional context
   * @param {string} category - Error category
   */
  async logLowError(error, context = {}, category = 'other') {
    return this.logError(error, context, 'low', category);
  }
}

module.exports = ErrorLogger;



