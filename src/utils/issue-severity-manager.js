/**
 * Issue Severity Manager for AI Code Review System
 * Automatically determines issue severity and applies creation rules
 */
class IssueSeverityManager {
  constructor(config = {}) {
    this.config = {
      severityLevels: {
        critical: { score: 1.0, priority: 'highest', autoCreate: true, requireImmediate: true },
        high: { score: 0.8, priority: 'high', autoCreate: true, requireImmediate: false },
        medium: { score: 0.6, priority: 'medium', autoCreate: true, requireImmediate: false },
        low: { score: 0.4, priority: 'low', autoCreate: false, requireImmediate: false },
        info: { score: 0.2, priority: 'lowest', autoCreate: false, requireImmediate: false }
      },
      severityRules: {
        security: { baseSeverity: 'high', autoEscalate: true },
        performance: { baseSeverity: 'medium', autoEscalate: false },
        bug: { baseSeverity: 'high', autoEscalate: true },
        architecture: { baseSeverity: 'medium', autoEscalate: false },
        quality: { baseSeverity: 'medium', autoEscalate: false },
        style: { baseSeverity: 'low', autoEscalate: false },
        documentation: { baseSeverity: 'low', autoEscalate: false },
        testing: { baseSeverity: 'medium', autoEscalate: false }
      },
      autoEscalation: {
        enabled: true,
        thresholds: {
          multipleIssues: 3,
          repeatedIssues: 2,
          criticalPatterns: 1
        }
      },
      ...config
    };
    
    this.issueHistory = new Map();
    this.patternDetector = new IssuePatternDetector();
  }

  /**
   * Determine issue severity based on multiple factors
   * @param {Object} issue - Issue data
   * @param {Object} context - Review context
   * @returns {Object} Severity assessment
   */
  determineSeverity(issue, context = {}) {
    const baseSeverity = this.getBaseSeverity(issue.type);
    let finalSeverity = baseSeverity;
    let confidence = 0.8;
    let factors = [];

    // Factor 1: Issue type and category
    const typeSeverity = this.assessTypeSeverity(issue.type, issue.category);
    factors.push({ name: 'Type/Category', impact: typeSeverity.impact, details: typeSeverity.reason });

    // Factor 2: Code complexity and impact
    const complexitySeverity = this.assessComplexityImpact(issue, context);
    factors.push({ name: 'Complexity/Impact', impact: complexitySeverity.impact, details: complexitySeverity.reason });

    // Factor 3: Historical patterns
    const patternSeverity = this.assessHistoricalPatterns(issue, context);
    factors.push({ name: 'Historical Patterns', impact: patternSeverity.impact, details: patternSeverity.reason });

    // Factor 4: File importance and scope
    const scopeSeverity = this.assessScopeImpact(issue, context);
    factors.push({ name: 'Scope/Importance', impact: scopeSeverity.impact, details: scopeSeverity.reason });

    // Factor 5: Security implications
    const securitySeverity = this.assessSecurityImplications(issue, context);
    if (securitySeverity.impact > 0) {
      factors.push({ name: 'Security', impact: securitySeverity.impact, details: securitySeverity.reason });
    }

    // Calculate final severity score
    const totalImpact = factors.reduce((sum, factor) => sum + factor.impact, 0);
    const averageImpact = totalImpact / factors.length;
    
    // Apply auto-escalation if enabled
    if (this.config.autoEscalation.enabled) {
      const escalationResult = this.checkAutoEscalation(issue, context, averageImpact);
      if (escalationResult.shouldEscalate) {
        finalSeverity = escalationResult.newSeverity;
        factors.push({ name: 'Auto-Escalation', impact: 0.3, details: escalationResult.reason });
      }
    }

    // Map score to severity level
    const severityLevel = this.scoreToSeverityLevel(averageImpact);
    
    // Update confidence based on factor consistency
    confidence = this.calculateConfidence(factors, averageImpact);

    return {
      level: severityLevel,
      score: averageImpact,
      confidence: confidence,
      factors: factors,
      autoEscalated: finalSeverity !== baseSeverity,
      recommendations: this.generateSeverityRecommendations(severityLevel, factors),
      metadata: {
        baseSeverity: baseSeverity,
        finalSeverity: finalSeverity,
        escalationReason: finalSeverity !== baseSeverity ? 'Auto-escalation applied' : null
      }
    };
  }

  /**
   * Get base severity for issue type
   * @param {string} issueType - Type of issue
   * @returns {string} Base severity level
   */
  getBaseSeverity(issueType) {
    const rule = this.config.severityRules[issueType];
    return rule ? rule.baseSeverity : 'medium';
  }

  /**
   * Assess severity based on issue type and category
   * @param {string} type - Issue type
   * @param {string} category - Issue category
   * @returns {Object} Type severity assessment
   */
  assessTypeSeverity(type, category) {
    let impact = 0.5; // Default medium impact
    let reason = 'Standard issue type';

    switch (type) {
      case 'security':
        impact = 0.9;
        reason = 'Security issues have high impact on system safety';
        break;
      case 'bug':
        impact = 0.8;
        reason = 'Bugs can cause system failures and unexpected behavior';
        break;
      case 'performance':
        impact = 0.7;
        reason = 'Performance issues affect user experience and system efficiency';
        break;
      case 'architecture':
        impact = 0.6;
        reason = 'Architectural issues affect long-term maintainability';
        break;
      case 'quality':
        impact = 0.5;
        reason = 'Quality issues affect code maintainability';
        break;
      case 'style':
        impact = 0.3;
        reason = 'Style issues are primarily cosmetic';
        break;
      case 'documentation':
        impact = 0.2;
        reason = 'Documentation issues have minimal functional impact';
        break;
      case 'testing':
        impact = 0.6;
        reason = 'Testing issues affect code reliability';
        break;
    }

    // Adjust based on category
    if (category === 'critical' || category === 'blocker') {
      impact = Math.min(1.0, impact + 0.2);
      reason += ' - Critical category detected';
    } else if (category === 'minor' || category === 'trivial') {
      impact = Math.max(0.1, impact - 0.2);
      reason += ' - Minor category detected';
    }

    return { impact, reason };
  }

  /**
   * Assess severity based on code complexity and impact
   * @param {Object} issue - Issue data
   * @param {Object} context - Review context
   * @returns {Object} Complexity severity assessment
   */
  assessComplexityImpact(issue, context) {
    let impact = 0.5;
    let reason = 'Standard complexity';

    // Check if issue affects complex code
    if (issue.complexity && issue.complexity.cyclomatic > 10) {
      impact += 0.2;
      reason = 'High cyclomatic complexity detected';
    }

    // Check if issue affects performance-critical paths
    if (context.performanceCritical && issue.type === 'performance') {
      impact += 0.3;
      reason = 'Performance issue in critical path';
    }

    // Check if issue affects frequently executed code
    if (context.executionFrequency === 'high') {
      impact += 0.1;
      reason = 'Issue in frequently executed code';
    }

    // Check if issue affects error handling
    if (issue.type === 'bug' && issue.category === 'error-handling') {
      impact += 0.2;
      reason = 'Error handling issue detected';
    }

    return { impact: Math.min(1.0, impact), reason };
  }

  /**
   * Assess severity based on historical patterns
   * @param {Object} issue - Issue data
   * @param {Object} context - Review context
   * @returns {Object} Pattern severity assessment
   */
  assessHistoricalPatterns(issue, context) {
    let impact = 0.5;
    let reason = 'No significant historical patterns';

    const fileKey = `${context.repository}/${issue.file}`;
    const issueHistory = this.issueHistory.get(fileKey) || [];

    // Check for repeated similar issues
    const similarIssues = issueHistory.filter(hist => 
      hist.type === issue.type && 
      hist.category === issue.category &&
      hist.line === issue.line
    );

    if (similarIssues.length >= this.config.autoEscalation.thresholds.repeatedIssues) {
      impact += 0.3;
      reason = `Repeated issue detected ${similarIssues.length} times`;
    }

    // Check for multiple issues in same file
    if (issueHistory.length >= this.config.autoEscalation.thresholds.multipleIssues) {
      impact += 0.2;
      reason = `Multiple issues in same file (${issueHistory.length})`;
    }

    // Check for critical patterns
    const criticalPatterns = this.patternDetector.detectCriticalPatterns(issue, issueHistory);
    if (criticalPatterns.length > 0) {
      impact += 0.4;
      reason = `Critical patterns detected: ${criticalPatterns.join(', ')}`;
    }

    return { impact: Math.min(1.0, impact), reason };
  }

  /**
   * Assess severity based on scope and file importance
   * @param {Object} issue - Issue data
   * @param {Object} context - Review context
   * @returns {Object} Scope severity assessment
   */
  assessScopeImpact(issue, context) {
    let impact = 0.5;
    let reason = 'Standard scope impact';

    // Check file importance
    if (context.fileImportance === 'critical') {
      impact += 0.3;
      reason = 'Issue in critical system file';
    } else if (context.fileImportance === 'core') {
      impact += 0.2;
      reason = 'Issue in core system file';
    }

    // Check if issue affects multiple components
    if (issue.affectedComponents && issue.affectedComponents.length > 1) {
      impact += 0.2;
      reason = `Issue affects ${issue.affectedComponents.length} components`;
    }

    // Check if issue affects public APIs
    if (context.isPublicAPI) {
      impact += 0.2;
      reason = 'Issue affects public API';
    }

    // Check if issue affects configuration
    if (context.isConfiguration) {
      impact += 0.1;
      reason = 'Issue affects configuration';
    }

    return { impact: Math.min(1.0, impact), reason };
  }

  /**
   * Assess security implications
   * @param {Object} issue - Issue data
   * @param {Object} context - Review context
   * @returns {Object} Security severity assessment
   */
  assessSecurityImplications(issue, context) {
    let impact = 0;
    let reason = 'No security implications detected';

    if (issue.type === 'security') {
      impact = 0.9;
      reason = 'Direct security vulnerability';
    } else if (issue.securityImplications) {
      impact = issue.securityImplications.severity || 0.7;
      reason = issue.securityImplications.description || 'Security implications detected';
    }

    // Check for security-related patterns
    const securityPatterns = this.patternDetector.detectSecurityPatterns(issue);
    if (securityPatterns.length > 0) {
      impact = Math.max(impact, 0.8);
      reason = `Security patterns detected: ${securityPatterns.join(', ')}`;
    }

    return { impact, reason };
  }

  /**
   * Check if issue should be auto-escalated
   * @param {Object} issue - Issue data
   * @param {Object} context - Review context
   * @param {number} currentScore - Current severity score
   * @returns {Object} Escalation result
   */
  checkAutoEscalation(issue, context, currentScore) {
    let shouldEscalate = false;
    let newSeverity = issue.severity;
    let reason = '';

    // Check for critical patterns
    const criticalPatterns = this.patternDetector.detectCriticalPatterns(issue, []);
    if (criticalPatterns.length >= this.config.autoEscalation.thresholds.criticalPatterns) {
      shouldEscalate = true;
      newSeverity = 'critical';
      reason = `Critical patterns detected: ${criticalPatterns.join(', ')}`;
    }

    // Check for security issues in critical files
    if (issue.type === 'security' && context.fileImportance === 'critical') {
      shouldEscalate = true;
      newSeverity = 'critical';
      reason = 'Security issue in critical file';
    }

    // Check for repeated issues
    const fileKey = `${context.repository}/${issue.file}`;
    const issueHistory = this.issueHistory.get(fileKey) || [];
    const similarIssues = issueHistory.filter(hist => 
      hist.type === issue.type && hist.category === issue.category
    );

    if (similarIssues.length >= this.config.autoEscalation.thresholds.repeatedIssues) {
      shouldEscalate = true;
      newSeverity = this.escalateSeverity(issue.severity);
      reason = `Repeated issue pattern (${similarIssues.length} occurrences)`;
    }

    return {
      shouldEscalate,
      newSeverity,
      reason
    };
  }

  /**
   * Escalate severity level
   * @param {string} currentSeverity - Current severity level
   * @returns {string} Escalated severity level
   */
  escalateSeverity(currentSeverity) {
    const severityOrder = ['info', 'low', 'medium', 'high', 'critical'];
    const currentIndex = severityOrder.indexOf(currentSeverity);
    
    if (currentIndex < severityOrder.length - 1) {
      return severityOrder[currentIndex + 1];
    }
    
    return currentSeverity;
  }

  /**
   * Convert score to severity level
   * @param {number} score - Severity score (0-1)
   * @returns {string} Severity level
   */
  scoreToSeverityLevel(score) {
    if (score >= 0.9) return 'critical';
    if (score >= 0.7) return 'high';
    if (score >= 0.5) return 'medium';
    if (score >= 0.3) return 'low';
    return 'info';
  }

  /**
   * Calculate confidence in severity assessment
   * @param {Array} factors - Severity factors
   * @param {number} averageImpact - Average impact score
   * @returns {number} Confidence score (0-1)
   */
  calculateConfidence(factors, averageImpact) {
    if (factors.length === 0) return 0.5;

    // Higher confidence with more factors
    let confidence = Math.min(0.9, 0.5 + (factors.length * 0.1));

    // Check factor consistency
    const impacts = factors.map(f => f.impact);
    const variance = this.calculateVariance(impacts);
    
    // Lower variance = higher confidence
    if (variance < 0.1) confidence += 0.1;
    else if (variance > 0.3) confidence -= 0.1;

    // Check for extreme values
    if (averageImpact > 0.9 || averageImpact < 0.1) {
      confidence += 0.1; // More confident in extreme cases
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Calculate variance of values
   * @param {Array} values - Array of numeric values
   * @returns {number} Variance
   */
  calculateVariance(values) {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    
    return variance;
  }

  /**
   * Generate severity recommendations
   * @param {string} severityLevel - Severity level
   * @param {Array} factors - Severity factors
   * @returns {Array} Recommendations
   */
  generateSeverityRecommendations(severityLevel, factors) {
    const recommendations = [];

    // Base recommendations by severity
    switch (severityLevel) {
      case 'critical':
        recommendations.push('Immediate action required');
        recommendations.push('Block deployment until resolved');
        recommendations.push('Notify stakeholders immediately');
        break;
      case 'high':
        recommendations.push('High priority - resolve before next release');
        recommendations.push('Consider blocking deployment');
        break;
      case 'medium':
        recommendations.push('Address in current development cycle');
        recommendations.push('Monitor for escalation');
        break;
      case 'low':
        recommendations.push('Address when convenient');
        recommendations.push('Consider for technical debt cleanup');
        break;
      case 'info':
        recommendations.push('Document for future reference');
        recommendations.push('No immediate action required');
        break;
    }

    // Factor-specific recommendations
    factors.forEach(factor => {
      if (factor.impact > 0.7) {
        recommendations.push(`High impact factor: ${factor.name} - ${factor.details}`);
      }
    });

    return recommendations;
  }

  /**
   * Record issue for historical analysis
   * @param {Object} issue - Issue data
   * @param {Object} context - Review context
   */
  recordIssue(issue, context) {
    const fileKey = `${context.repository}/${issue.file}`;
    
    if (!this.issueHistory.has(fileKey)) {
      this.issueHistory.set(fileKey, []);
    }

    this.issueHistory.get(fileKey).push({
      ...issue,
      timestamp: new Date(),
      context: {
        repository: context.repository,
        branch: context.branch,
        commit: context.commit
      }
    });

    // Keep only last 100 issues per file
    const history = this.issueHistory.get(fileKey);
    if (history.length > 100) {
      this.issueHistory.set(fileKey, history.slice(-100));
    }
  }

  /**
   * Get issue history for a file
   * @param {string} repository - Repository name
   * @param {string} file - File path
   * @returns {Array} Issue history
   */
  getIssueHistory(repository, file) {
    const fileKey = `${repository}/${file}`;
    return this.issueHistory.get(fileKey) || [];
  }

  /**
   * Get severity statistics
   * @returns {Object} Severity statistics
   */
  getSeverityStats() {
    const stats = {
      totalIssues: 0,
      bySeverity: {},
      byType: {},
      escalationCount: 0,
      criticalPatterns: 0
    };

    this.issueHistory.forEach(history => {
      history.forEach(issue => {
        stats.totalIssues++;
        
        // Count by severity
        stats.bySeverity[issue.severity] = (stats.bySeverity[issue.severity] || 0) + 1;
        
        // Count by type
        stats.byType[issue.type] = (stats.byType[issue.type] || 0) + 1;
        
        // Count escalations
        if (issue.metadata?.escalationReason) {
          stats.escalationCount++;
        }
      });
    });

    return stats;
  }

  /**
   * Clear issue history
   */
  clearHistory() {
    this.issueHistory.clear();
  }
}

/**
 * Issue Pattern Detector
 * Identifies critical patterns and security issues
 */
class IssuePatternDetector {
  constructor() {
    this.criticalPatterns = [
      'sql-injection',
      'xss',
      'buffer-overflow',
      'race-condition',
      'memory-leak',
      'deadlock',
      'infinite-loop',
      'null-pointer-dereference'
    ];

    this.securityPatterns = [
      'hardcoded-credentials',
      'weak-encryption',
      'insecure-random',
      'path-traversal',
      'command-injection',
      'privilege-escalation'
    ];
  }

  /**
   * Detect critical patterns in issue
   * @param {Object} issue - Issue data
   * @param {Array} history - Issue history
   * @returns {Array} Detected critical patterns
   */
  detectCriticalPatterns(issue, history) {
    const patterns = [];

    // Check issue description for critical patterns
    if (issue.description) {
      this.criticalPatterns.forEach(pattern => {
        if (issue.description.toLowerCase().includes(pattern.replace('-', ' '))) {
          patterns.push(pattern);
        }
      });
    }

    // Check for repeated critical issues
    if (history.length > 0) {
      const criticalHistory = history.filter(h => 
        this.criticalPatterns.some(pattern => 
          h.description && h.description.toLowerCase().includes(pattern.replace('-', ' '))
        )
      );

      if (criticalHistory.length > 0) {
        patterns.push('repeated-critical-issues');
      }
    }

    return patterns;
  }

  /**
   * Detect security patterns in issue
   * @param {Object} issue - Issue data
   * @returns {Array} Detected security patterns
   */
  detectSecurityPatterns(issue) {
    const patterns = [];

    if (issue.description) {
      this.securityPatterns.forEach(pattern => {
        if (issue.description.toLowerCase().includes(pattern.replace('-', ' '))) {
          patterns.push(pattern);
        }
      });
    }

    // Check for security-related keywords
    const securityKeywords = ['password', 'token', 'secret', 'key', 'auth', 'permission'];
    securityKeywords.forEach(keyword => {
      if (issue.description && issue.description.toLowerCase().includes(keyword)) {
        patterns.push(`security-${keyword}`);
      }
    });

    return patterns;
  }
}

module.exports = IssueSeverityManager;

