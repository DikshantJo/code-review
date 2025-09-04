/**
 * System Health Checker for AI Code Review System
 * Validates all components and their methods before system startup
 * Prevents runtime errors by ensuring all required functionality is available
 */
const methodCompatibilityLayer = require('./method-compatibility-layer');
const { createDynamicProxy } = require('./dynamic-method-proxy');

class SystemHealthChecker {
  constructor() {
    this.healthStatus = {
      overall: 'unknown',
      components: {},
      issues: [],
      recommendations: []
    };
    this.requiredComponents = [
      'QualityGates',
      'FileFilter', 
      'AuditLogger',
      'LargeCommitHandler',
      'FallbackHandler'
    ];
  }

  /**
   * Perform comprehensive health check on all system components
   * @param {Object} config - System configuration
   * @returns {Object} Health check results
   */
  async performHealthCheck(config) {
    console.log('🔍 Performing system health check...');
    
    try {
      // Initialize compatibility layer
      methodCompatibilityLayer.initialize();
      
      // Check each component
      await this.checkQualityGates(config);
      await this.checkFileFilter(config);
      await this.checkAuditLogger(config);
      await this.checkLargeCommitHandler(config);
      await this.checkFallbackHandler(config);
      
      // Determine overall health
      this.determineOverallHealth();
      
      // Generate recommendations
      this.generateRecommendations();
      
      // Log health status
      this.logHealthStatus();
      
      return this.healthStatus;
      
    } catch (error) {
      console.error('❌ Health check failed:', error);
      this.healthStatus.overall = 'critical';
      this.healthStatus.issues.push({
        component: 'SystemHealthChecker',
        error: error.message,
        severity: 'critical'
      });
      return this.healthStatus;
    }
  }

  /**
   * Check QualityGates component health
   * @param {Object} config - System configuration
   */
  async checkQualityGates(config) {
    const component = 'QualityGates';
    console.log(`  🔍 Checking ${component}...`);
    
    try {
      const QualityGates = require('./quality-gates');
      const qualityGates = new QualityGates(config);
      
      // Create dynamic proxy for enhanced compatibility
      const proxyQualityGates = createDynamicProxy(qualityGates, component);
      
      // Test required methods
      const requiredMethods = [
        'setAuditLogger',
        'evaluateQualityGate',
        'evaluateQualityGates'
      ];
      
      const validation = methodCompatibilityLayer.validateClass(proxyQualityGates, requiredMethods);
      
      this.healthStatus.components[component] = {
        status: validation.valid ? 'healthy' : 'degraded',
        methods: validation.available,
        missing: validation.missing,
        total: validation.total,
        proxy: true
      };
      
      if (!validation.valid) {
        this.healthStatus.issues.push({
          component,
          missing: validation.missing,
          severity: 'medium'
        });
      }
      
    } catch (error) {
      this.healthStatus.components[component] = {
        status: 'critical',
        error: error.message
      };
      this.healthStatus.issues.push({
        component,
        error: error.message,
        severity: 'critical'
      });
    }
  }

  /**
   * Check FileFilter component health
   * @param {Object} config - System configuration
   */
  async checkFileFilter(config) {
    const component = 'FileFilter';
    console.log(`  🔍 Checking ${component}...`);
    
    try {
      const FileFilter = require('./file-filter');
      const fileFilter = new FileFilter(config);
      
      // Create dynamic proxy
      const proxyFileFilter = createDynamicProxy(fileFilter, component);
      
      const requiredMethods = [
        'shouldReviewFile',
        'shouldExcludeFile'
      ];
      
      const validation = methodCompatibilityLayer.validateClass(proxyFileFilter, requiredMethods);
      
      this.healthStatus.components[component] = {
        status: validation.valid ? 'healthy' : 'degraded',
        methods: validation.available,
        missing: validation.missing,
        total: validation.total,
        proxy: true
      };
      
      if (!validation.valid) {
        this.healthStatus.issues.push({
          component,
          missing: validation.missing,
          severity: 'medium'
        });
      }
      
    } catch (error) {
      this.healthStatus.components[component] = {
        status: 'critical',
        error: error.message
      };
      this.healthStatus.issues.push({
        component,
        error: error.message,
        severity: 'critical'
      });
    }
  }

  /**
   * Check AuditLogger component health
   * @param {Object} config - System configuration
   */
  async checkAuditLogger(config) {
    const component = 'AuditLogger';
    console.log(`  🔍 Checking ${component}...`);
    
    try {
      // Create dynamic proxy for console logging
      const consoleLogger = {
        log: (level, message, data) => {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [${component}] [${level.toUpperCase()}] ${message}`, data);
        }
      };
      const proxyAuditLogger = createDynamicProxy(consoleLogger, component);
      
      const requiredMethods = [
        'logEvent',
        'logReviewAttempt',
        'logReviewOutcome',
        'logAIResponseMetrics',
        'logWarn',
        'logError',
        'logInfo',
        'logAIResponse'
      ];
      
      const validation = methodCompatibilityLayer.validateClass(proxyAuditLogger, requiredMethods);
      
      this.healthStatus.components[component] = {
        status: validation.valid ? 'healthy' : 'degraded',
        methods: validation.available,
        missing: validation.missing,
        total: validation.total,
        proxy: true
      };
      
      if (!validation.valid) {
        this.healthStatus.issues.push({
          component,
          missing: validation.missing,
          severity: 'medium'
        });
      }
      
    } catch (error) {
      this.healthStatus.components[component] = {
        status: 'critical',
        error: error.message
      };
      this.healthStatus.issues.push({
        component,
        error: error.message,
        severity: 'critical'
      });
    }
  }

  /**
   * Check LargeCommitHandler component health
   * @param {Object} config - System configuration
   */
  async checkLargeCommitHandler(config) {
    const component = 'LargeCommitHandler';
    console.log(`  🔍 Checking ${component}...`);
    
    try {
      const LargeCommitHandler = require('./large-commit-handler');
      const largeCommitHandler = new LargeCommitHandler(config);
      
      // Create dynamic proxy
      const proxyLargeCommitHandler = createDynamicProxy(largeCommitHandler, component);
      
      const requiredMethods = [
        'analyzeCommit',
        'analyzeCommitSize'
      ];
      
      const validation = methodCompatibilityLayer.validateClass(proxyLargeCommitHandler, requiredMethods);
      
      this.healthStatus.components[component] = {
        status: validation.valid ? 'healthy' : 'degraded',
        methods: validation.available,
        missing: validation.missing,
        total: validation.total,
        proxy: true
      };
      
      if (!validation.valid) {
        this.healthStatus.issues.push({
          component,
          missing: validation.missing,
          severity: 'medium'
        });
      }
      
    } catch (error) {
      this.healthStatus.components[component] = {
        status: 'critical',
        error: error.message
      };
      this.healthStatus.issues.push({
        component,
        error: error.message,
        severity: 'critical'
      });
    }
  }

  /**
   * Check FallbackHandler component health
   * @param {Object} config - System configuration
   */
  async checkFallbackHandler(config) {
    const component = 'FallbackHandler';
    console.log(`  🔍 Checking ${component}...`);
    
    try {
      const FallbackHandler = require('./fallback-handler');
      const fallbackHandler = new FallbackHandler(config);
      
      // Create dynamic proxy
      const proxyFallbackHandler = createDynamicProxy(fallbackHandler, component);
      
      const requiredMethods = [
        'determineStrategy',
        'executeStrategy',
        'determineFallbackStrategy',
        'executeFallbackStrategy'
      ];
      
      const validation = methodCompatibilityLayer.validateClass(proxyFallbackHandler, requiredMethods);
      
      this.healthStatus.components[component] = {
        status: validation.valid ? 'healthy' : 'degraded',
        methods: validation.available,
        missing: validation.missing,
        total: validation.total,
        proxy: true
      };
      
      if (!validation.valid) {
        this.healthStatus.issues.push({
          component,
          missing: validation.missing,
          severity: 'medium'
        });
      }
      
    } catch (error) {
      this.healthStatus.components[component] = {
        status: 'critical',
        error: error.message
      };
      this.healthStatus.issues.push({
        component,
        error: error.message,
        severity: 'critical'
      });
    }
  }

  /**
   * Determine overall system health based on component statuses
   */
  determineOverallHealth() {
    const componentStatuses = Object.values(this.healthStatus.components);
    const criticalCount = componentStatuses.filter(c => c.status === 'critical').length;
    const degradedCount = componentStatuses.filter(c => c.status === 'degraded').length;
    
    if (criticalCount > 0) {
      this.healthStatus.overall = 'critical';
    } else if (degradedCount > 0) {
      this.healthStatus.overall = 'degraded';
    } else {
      this.healthStatus.overall = 'healthy';
    }
  }

  /**
   * Generate recommendations based on health check results
   */
  generateRecommendations() {
    this.healthStatus.recommendations = [];
    
    if (this.healthStatus.overall === 'critical') {
      this.healthStatus.recommendations.push(
        'System has critical issues that must be resolved before startup',
        'Check component initialization and configuration',
        'Review error logs for specific failure reasons'
      );
    }
    
    if (this.healthStatus.overall === 'degraded') {
      this.healthStatus.recommendations.push(
        'System will operate with reduced functionality',
        'Some features may not work as expected',
        'Consider addressing missing methods for full functionality'
      );
    }
    
    // Add specific recommendations for missing methods
    for (const issue of this.healthStatus.issues) {
      if (issue.missing && issue.missing.length > 0) {
        this.healthStatus.recommendations.push(
          `Add missing methods to ${issue.component}: ${issue.missing.join(', ')}`
        );
      }
    }
  }

  /**
   * Log the health status to console
   */
  logHealthStatus() {
    console.log('\n📊 System Health Check Results:');
    console.log(`Overall Status: ${this.healthStatus.overall.toUpperCase()}`);
    
    for (const [component, status] of Object.entries(this.healthStatus.components)) {
      const emoji = status.status === 'healthy' ? '✅' : 
                   status.status === 'degraded' ? '⚠️' : '❌';
      console.log(`  ${emoji} ${component}: ${status.status}`);
      
      if (status.methods) {
        console.log(`    Methods: ${status.total} available`);
      }
      
      if (status.missing && status.missing.length > 0) {
        console.log(`    Missing: ${status.missing.join(', ')}`);
      }
    }
    
    if (this.healthStatus.issues.length > 0) {
      console.log('\n🚨 Issues Found:');
      for (const issue of this.healthStatus.issues) {
        console.log(`  - ${issue.component}: ${issue.error || issue.missing?.join(', ')}`);
      }
    }
    
    if (this.healthStatus.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      for (const rec of this.healthStatus.recommendations) {
        console.log(`  - ${rec}`);
      }
    }
    
    console.log('\n');
  }

  /**
   * Get health status summary
   * @returns {Object} Health status summary
   */
  getHealthSummary() {
    return {
      overall: this.healthStatus.overall,
      componentCount: Object.keys(this.healthStatus.components).length,
      healthyComponents: Object.values(this.healthStatus.components).filter(c => c.status === 'healthy').length,
      degradedComponents: Object.values(this.healthStatus.components).filter(c => c.status === 'degraded').length,
      criticalComponents: Object.values(this.healthStatus.components).filter(c => c.status === 'critical').length,
      issueCount: this.healthStatus.issues.length,
      recommendationCount: this.healthStatus.recommendations.length
    };
  }

  /**
   * Check if system is ready for operation
   * @returns {boolean} Whether system is ready
   */
  isSystemReady() {
    return this.healthStatus.overall !== 'critical';
  }

  /**
   * Get components that need attention
   * @returns {Array} Components with issues
   */
  getComponentsNeedingAttention() {
    return Object.entries(this.healthStatus.components)
      .filter(([_, status]) => status.status !== 'healthy')
      .map(([name, status]) => ({ name, ...status }));
  }
}

module.exports = SystemHealthChecker;
