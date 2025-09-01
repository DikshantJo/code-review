/**
 * Service Availability Handler for AI Code Review system
 * Manages graceful degradation when services are unavailable
 */
class ServiceAvailabilityHandler {
  constructor(config) {
    this.config = config;
    this.services = {
      openai: { name: 'OpenAI API', critical: true, fallback: 'manual' },
      github: { name: 'GitHub API', critical: true, fallback: 'manual' },
      email: { name: 'Email Service', critical: false, fallback: 'github_issue' },
      storage: { name: 'Storage Service', critical: false, fallback: 'memory' }
    };
    this.degradationModes = config?.degradation?.modes || ['full', 'partial', 'minimal', 'offline'];
    this.currentMode = 'full';
    this.serviceStatus = new Map();
    this.lastCheck = new Map();
    this.checkInterval = config?.degradation?.check_interval_ms || 30000; // 30 seconds
  }

  /**
   * Check service availability
   * @param {string} serviceName - Name of the service to check
   * @param {Function} checkFunction - Function to check service health
   * @returns {Promise<boolean>} Whether service is available
   */
  async checkServiceAvailability(serviceName, checkFunction) {
    try {
      const startTime = Date.now();
      const isAvailable = await checkFunction();
      const responseTime = Date.now() - startTime;

      this.serviceStatus.set(serviceName, {
        available: isAvailable,
        responseTime: responseTime,
        lastCheck: new Date(),
        error: null
      });

      this.lastCheck.set(serviceName, Date.now());

      return isAvailable;
    } catch (error) {
      this.serviceStatus.set(serviceName, {
        available: false,
        responseTime: null,
        lastCheck: new Date(),
        error: error.message
      });

      this.lastCheck.set(serviceName, Date.now());
      return false;
    }
  }

  /**
   * Check OpenAI service availability
   * @returns {Promise<boolean>} Whether OpenAI is available
   */
  async checkOpenAIAvailability() {
    // This would typically make a lightweight API call
    // For now, we'll simulate a check
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulate 95% availability
        resolve(Math.random() > 0.05);
      }, 100);
    });
  }

  /**
   * Check GitHub API availability
   * @returns {Promise<boolean>} Whether GitHub API is available
   */
  async checkGitHubAvailability() {
    // This would typically make a lightweight API call
    // For now, we'll simulate a check
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulate 99% availability
        resolve(Math.random() > 0.01);
      }, 50);
    });
  }

  /**
   * Check email service availability
   * @returns {Promise<boolean>} Whether email service is available
   */
  async checkEmailAvailability() {
    // This would typically test SMTP connection
    // For now, we'll simulate a check
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulate 90% availability
        resolve(Math.random() > 0.1);
      }, 200);
    });
  }

  /**
   * Determine current degradation mode based on service status
   * @returns {string} Current degradation mode
   */
  determineDegradationMode() {
    const criticalServices = Object.entries(this.services)
      .filter(([_, service]) => service.critical)
      .map(([name, _]) => name);

    const availableCriticalServices = criticalServices.filter(service => {
      const status = this.serviceStatus.get(service);
      return status && status.available;
    });

    if (availableCriticalServices.length === criticalServices.length) {
      this.currentMode = 'full';
    } else if (availableCriticalServices.length >= criticalServices.length * 0.5) {
      this.currentMode = 'partial';
    } else if (availableCriticalServices.length > 0) {
      this.currentMode = 'minimal';
    } else {
      this.currentMode = 'offline';
    }

    return this.currentMode;
  }

  /**
   * Get fallback strategy for a service
   * @param {string} serviceName - Name of the service
   * @returns {string} Fallback strategy
   */
  getFallbackStrategy(serviceName) {
    const service = this.services[serviceName];
    return service ? service.fallback : 'manual';
  }

  /**
   * Check if service is available
   * @param {string} serviceName - Name of the service
   * @returns {boolean} Whether service is available
   */
  isServiceAvailable(serviceName) {
    const status = this.serviceStatus.get(serviceName);
    return status ? status.available : false;
  }

  /**
   * Get service status information
   * @param {string} serviceName - Name of the service
   * @returns {Object|null} Service status
   */
  getServiceStatus(serviceName) {
    return this.serviceStatus.get(serviceName) || null;
  }

  /**
   * Get all service statuses
   * @returns {Object} All service statuses
   */
  getAllServiceStatuses() {
    const statuses = {};
    for (const [serviceName, service] of Object.entries(this.services)) {
      statuses[serviceName] = {
        ...service,
        ...this.serviceStatus.get(serviceName)
      };
    }
    return statuses;
  }

  /**
   * Create degraded review strategy based on available services
   * @param {Object} context - Review context
   * @returns {Object} Degraded review strategy
   */
  createDegradedReviewStrategy(context = {}) {
    const mode = this.determineDegradationMode();
    const strategy = {
      mode: mode,
      availableServices: [],
      unavailableServices: [],
      fallbackStrategies: {},
      recommendations: []
    };

    // Analyze service availability
    for (const [serviceName, service] of Object.entries(this.services)) {
      if (this.isServiceAvailable(serviceName)) {
        strategy.availableServices.push(serviceName);
      } else {
        strategy.unavailableServices.push(serviceName);
        strategy.fallbackStrategies[serviceName] = this.getFallbackStrategy(serviceName);
      }
    }

    // Generate recommendations based on mode
    switch (mode) {
      case 'full':
        strategy.recommendations.push('All services available - full functionality');
        break;

      case 'partial':
        strategy.recommendations.push('Some services unavailable - using fallback strategies');
        if (!this.isServiceAvailable('openai')) {
          strategy.recommendations.push('AI review unavailable - using manual review fallback');
        }
        if (!this.isServiceAvailable('email')) {
          strategy.recommendations.push('Email notifications unavailable - using GitHub issues');
        }
        break;

      case 'minimal':
        strategy.recommendations.push('Limited services available - minimal functionality');
        strategy.recommendations.push('Manual review required for all changes');
        strategy.recommendations.push('Notifications via GitHub issues only');
        break;

      case 'offline':
        strategy.recommendations.push('Critical services unavailable - offline mode');
        strategy.recommendations.push('All reviews must be performed manually');
        strategy.recommendations.push('No automated notifications available');
        break;
    }

    return strategy;
  }

  /**
   * Create offline review response
   * @param {Object} context - Review context
   * @returns {Object} Offline review response
   */
  createOfflineReviewResponse(context = {}) {
    return {
      issues: [
        {
          severity: 'MEDIUM',
          category: 'Standards',
          description: 'Automated code review unavailable due to service outage',
          file: 'all',
          recommendation: 'Please perform manual code review before merging'
        }
      ],
      summary: {
        totalIssues: 1,
        highSeverityCount: 0,
        mediumSeverityCount: 1,
        lowSeverityCount: 0,
        offlineMode: true,
        serviceOutage: true
      },
      metadata: {
        mode: 'offline',
        timestamp: new Date().toISOString(),
        context: {
          repository: context.repository,
          branch: context.targetBranch,
          commit: context.commitSha,
          author: context.author
        },
        unavailableServices: Array.from(this.serviceStatus.entries())
          .filter(([_, status]) => !status.available)
          .map(([service, _]) => service),
        instructions: [
          'Perform manual code review for security issues',
          'Check for coding standards compliance',
          'Verify performance implications',
          'Review error handling and edge cases',
          'Ensure proper testing coverage'
        ]
      }
    };
  }

  /**
   * Create partial review response (some services available)
   * @param {Object} context - Review context
   * @param {Object} aiResponse - AI response if available
   * @returns {Object} Partial review response
   */
  createPartialReviewResponse(context = {}, aiResponse = null) {
    const response = {
      issues: [],
      summary: {
        totalIssues: 0,
        highSeverityCount: 0,
        mediumSeverityCount: 0,
        lowSeverityCount: 0,
        partialMode: true
      },
      metadata: {
        mode: 'partial',
        timestamp: new Date().toISOString(),
        context: {
          repository: context.repository,
          branch: context.targetBranch,
          commit: context.commitSha,
          author: context.author
        },
        availableServices: [],
        unavailableServices: [],
        fallbackStrategies: {}
      }
    };

    // Add AI review results if available
    if (aiResponse && aiResponse.issues) {
      response.issues.push(...aiResponse.issues);
      response.summary.totalIssues += aiResponse.issues.length;
      response.summary.highSeverityCount += aiResponse.issues.filter(i => i.severity === 'HIGH').length;
      response.summary.mediumSeverityCount += aiResponse.issues.filter(i => i.severity === 'MEDIUM').length;
      response.summary.lowSeverityCount += aiResponse.issues.filter(i => i.severity === 'LOW').length;
    }

    // Add service availability notice
    if (!this.isServiceAvailable('openai')) {
      response.issues.push({
        severity: 'MEDIUM',
        category: 'Standards',
        description: 'AI review service unavailable - partial review performed',
        file: 'all',
        recommendation: 'Consider manual review for comprehensive analysis'
      });
      response.summary.totalIssues += 1;
      response.summary.mediumSeverityCount += 1;
    }

    // Update metadata
    for (const [serviceName, service] of Object.entries(this.services)) {
      if (this.isServiceAvailable(serviceName)) {
        response.metadata.availableServices.push(serviceName);
      } else {
        response.metadata.unavailableServices.push(serviceName);
        response.metadata.fallbackStrategies[serviceName] = this.getFallbackStrategy(serviceName);
      }
    }

    return response;
  }

  /**
   * Get degradation mode configuration
   * @param {string} mode - Degradation mode
   * @returns {Object} Mode configuration
   */
  getModeConfiguration(mode) {
    const configurations = {
      full: {
        aiReview: true,
        emailNotifications: true,
        githubIssues: true,
        storage: true,
        timeout: 30000
      },
      partial: {
        aiReview: this.isServiceAvailable('openai'),
        emailNotifications: this.isServiceAvailable('email'),
        githubIssues: this.isServiceAvailable('github'),
        storage: this.isServiceAvailable('storage'),
        timeout: 45000
      },
      minimal: {
        aiReview: false,
        emailNotifications: false,
        githubIssues: this.isServiceAvailable('github'),
        storage: false,
        timeout: 60000
      },
      offline: {
        aiReview: false,
        emailNotifications: false,
        githubIssues: false,
        storage: false,
        timeout: 0
      }
    };

    return configurations[mode] || configurations.offline;
  }

  /**
   * Check if operation should proceed in current mode
   * @param {string} operation - Operation type
   * @returns {boolean} Whether operation should proceed
   */
  shouldProceed(operation) {
    const mode = this.determineDegradationMode();
    const config = this.getModeConfiguration(mode);

    switch (operation) {
      case 'ai_review':
        return config.aiReview;
      case 'email_notification':
        return config.emailNotifications;
      case 'github_issue':
        return config.githubIssues;
      case 'storage':
        return config.storage;
      default:
        return true;
    }
  }

  /**
   * Get service health report
   * @returns {Object} Health report
   */
  getHealthReport() {
    const report = {
      timestamp: new Date().toISOString(),
      currentMode: this.currentMode,
      services: {},
      recommendations: []
    };

    for (const [serviceName, service] of Object.entries(this.services)) {
      const status = this.serviceStatus.get(serviceName);
      report.services[serviceName] = {
        name: service.name,
        critical: service.critical,
        available: status ? status.available : false,
        responseTime: status ? status.responseTime : null,
        lastCheck: status ? status.lastCheck : null,
        error: status ? status.error : null,
        fallback: service.fallback
      };

      if (!status || !status.available) {
        if (service.critical) {
          report.recommendations.push(`Critical service ${service.name} is unavailable`);
        } else {
          report.recommendations.push(`Service ${service.name} is unavailable - using fallback`);
        }
      }
    }

    return report;
  }

  /**
   * Reset service status (for testing or recovery)
   */
  resetServiceStatus() {
    this.serviceStatus.clear();
    this.lastCheck.clear();
    this.currentMode = 'full';
  }

  /**
   * Get configuration
   * @returns {Object} Configuration
   */
  getConfiguration() {
    return {
      services: this.services,
      degradationModes: this.degradationModes,
      currentMode: this.currentMode,
      checkInterval: this.checkInterval
    };
  }
}

module.exports = ServiceAvailabilityHandler;



