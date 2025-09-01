const https = require('https');
const http = require('http');
const net = require('net'); // Added missing import for net

/**
 * Health checker utility for external service dependencies
 * Monitors OpenAI API, GitHub API, and email services
 */
class HealthChecker {
  constructor(config = {}) {
    this.config = config;
    this.services = {
      openai: {
        name: 'OpenAI API',
        url: 'https://api.openai.com/v1/models',
        method: 'GET',
        timeout: 10000,
        headers: {
          'Authorization': `Bearer ${config.openai?.api_key || 'test-key'}`,
          'Content-Type': 'application/json'
        },
        critical: true
      },
      github: {
        name: 'GitHub API',
        url: 'https://api.github.com/rate_limit',
        method: 'GET',
        timeout: 8000,
        headers: {
          'Authorization': `token ${config.github?.token || 'test-token'}`,
          'User-Agent': 'AI-Code-Review-System'
        },
        critical: true
      },
      email: {
        name: 'Email Service',
        url: config.notifications?.email?.smtp_host || 'smtp.gmail.com',
        port: config.notifications?.email?.smtp_port || 587,
        timeout: 5000,
        critical: false
      }
    };
    
    this.healthCache = new Map();
    this.cacheTimeout = config.health?.cache_timeout || 30000; // 30 seconds
  }

  /**
   * Check health of all services
   * @returns {Promise<Object>} Health status for all services
   */
  async checkAllServices() {
    const results = {};
    const promises = [];

    for (const [serviceKey, service] of Object.entries(this.services)) {
      promises.push(
        this.checkService(serviceKey, service)
          .then(result => { results[serviceKey] = result; })
          .catch(error => {
            results[serviceKey] = {
              name: service.name,
              status: 'error',
              error: error.message,
              responseTime: null,
              timestamp: new Date().toISOString(),
              critical: service.critical
            };
          })
      );
    }

    await Promise.allSettled(promises);
    return results;
  }

  /**
   * Check health of a specific service
   * @param {string} serviceKey - Service identifier
   * @param {Object} service - Service configuration
   * @returns {Promise<Object>} Health status
   */
  async checkService(serviceKey, service) {
    // Check cache first
    const cached = this.getCachedHealth(serviceKey);
    if (cached) {
      return cached;
    }

    const startTime = Date.now();
    let responseTime = null;
    let status = 'unknown';
    let error = null;
    let details = {};

    try {
      if (serviceKey === 'email') {
        const result = await this.checkEmailService(service);
        status = result.status;
        details = result.details;
      } else {
        const result = await this.checkHttpService(service);
        status = result.status;
        details = result.details;
      }
      
      responseTime = Date.now() - startTime;
    } catch (err) {
      status = 'error';
      error = err.message;
      responseTime = Date.now() - startTime;
    }

    const healthResult = {
      name: service.name,
      status,
      responseTime,
      error,
      details,
      timestamp: new Date().toISOString(),
      critical: service.critical
    };

    // Cache the result
    this.cacheHealthResult(serviceKey, healthResult);
    
    return healthResult;
  }

  /**
   * Check HTTP-based services (OpenAI, GitHub)
   * @param {Object} service - Service configuration
   * @returns {Promise<Object>} Health check result
   */
  async checkHttpService(service) {
    return new Promise((resolve, reject) => {
      const url = new URL(service.url);
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: service.method,
        headers: service.headers,
        timeout: service.timeout
      };

      const protocol = url.protocol === 'https:' ? https : http;
      const req = protocol.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const responseData = JSON.parse(data);
            
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({
                status: 'healthy',
                details: {
                  statusCode: res.statusCode,
                  response: responseData
                }
              });
            } else if (res.statusCode === 401 || res.statusCode === 403) {
              resolve({
                status: 'auth_error',
                details: {
                  statusCode: res.statusCode,
                  message: 'Authentication failed'
                }
              });
            } else if (res.statusCode === 429) {
              resolve({
                status: 'rate_limited',
                details: {
                  statusCode: res.statusCode,
                  message: 'Rate limit exceeded'
                }
              });
            } else {
              resolve({
                status: 'unhealthy',
                details: {
                  statusCode: res.statusCode,
                  response: responseData
                }
              });
            }
          } catch (parseError) {
            resolve({
              status: 'unhealthy',
              details: {
                statusCode: res.statusCode,
                message: 'Invalid JSON response'
              }
            });
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * Check email service connectivity
   * @param {Object} service - Email service configuration
   * @returns {Promise<Object>} Health check result
   */
  async checkEmailService(service) {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let connected = false;
      
      const timeout = setTimeout(() => {
        if (!connected) {
          socket.destroy();
          reject(new Error('Connection timeout'));
        }
      }, service.timeout);

      socket.connect(service.port, service.url, () => {
        connected = true;
        clearTimeout(timeout);
        socket.destroy();
        resolve({
          status: 'healthy',
          details: {
            host: service.url,
            port: service.port,
            message: 'SMTP connection successful'
          }
        });
      });

      socket.on('error', (error) => {
        clearTimeout(timeout);
        socket.destroy();
        reject(error);
      });
    });
  }

  /**
   * Get cached health result
   * @param {string} serviceKey - Service identifier
   * @returns {Object|null} Cached health result or null
   */
  getCachedHealth(serviceKey) {
    const cached = this.healthCache.get(serviceKey);
    if (cached && Date.now() - cached.cacheTime < this.cacheTimeout) {
      return cached.result;
    }
    return null;
  }

  /**
   * Cache health result
   * @param {string} serviceKey - Service identifier
   * @param {Object} result - Health check result
   */
  cacheHealthResult(serviceKey, result) {
    this.healthCache.set(serviceKey, {
      result,
      cacheTime: Date.now()
    });
  }

  /**
   * Get overall system health status
   * @returns {Promise<Object>} Overall health status
   */
  async getSystemHealth() {
    const services = await this.checkAllServices();
    
    const criticalServices = Object.values(services).filter(s => s.critical);
    const healthyCritical = criticalServices.filter(s => s.status === 'healthy').length;
    const totalCritical = criticalServices.length;
    
    let overallStatus = 'healthy';
    if (healthyCritical === 0) {
      overallStatus = 'critical';
    } else if (healthyCritical < totalCritical) {
      overallStatus = 'degraded';
    }

    const responseTimes = Object.values(services)
      .filter(s => s.responseTime !== null)
      .map(s => s.responseTime);

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services,
      summary: {
        total: Object.keys(services).length,
        healthy: Object.values(services).filter(s => s.status === 'healthy').length,
        unhealthy: Object.values(services).filter(s => s.status !== 'healthy').length,
        critical: totalCritical,
        healthyCritical,
        averageResponseTime: responseTimes.length > 0 
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
          : null
      }
    };
  }

  /**
   * Get health status for specific service
   * @param {string} serviceKey - Service identifier
   * @returns {Promise<Object>} Service health status
   */
  async getServiceHealth(serviceKey) {
    const service = this.services[serviceKey];
    if (!service) {
      throw new Error(`Unknown service: ${serviceKey}`);
    }
    
    return this.checkService(serviceKey, service);
  }

  /**
   * Clear health cache
   * @param {string} [serviceKey] - Optional service key to clear specific cache
   */
  clearCache(serviceKey = null) {
    if (serviceKey) {
      this.healthCache.delete(serviceKey);
    } else {
      this.healthCache.clear();
    }
  }

  /**
   * Get health recommendations based on current status
   * @param {Object} systemHealth - System health status
   * @returns {Array} List of recommendations
   */
  getHealthRecommendations(systemHealth) {
    const recommendations = [];
    
    if (systemHealth.status === 'critical') {
      recommendations.push({
        priority: 'critical',
        message: 'All critical services are down. Immediate action required.',
        action: 'Check network connectivity and service configurations.'
      });
    }
    
    if (systemHealth.status === 'degraded') {
      recommendations.push({
        priority: 'high',
        message: 'Some critical services are unhealthy.',
        action: 'Review service logs and check for configuration issues.'
      });
    }

    // Check for specific service issues
    for (const [serviceKey, service] of Object.entries(systemHealth.services)) {
      if (service.status === 'auth_error') {
        recommendations.push({
          priority: 'high',
          message: `${service.name} authentication failed.`,
          action: 'Verify API keys and authentication credentials.'
        });
      }
      
      if (service.status === 'rate_limited') {
        recommendations.push({
          priority: 'medium',
          message: `${service.name} is rate limited.`,
          action: 'Review API usage and implement rate limiting strategies.'
        });
      }
      
      if (service.responseTime && service.responseTime > 5000) {
        recommendations.push({
          priority: 'medium',
          message: `${service.name} response time is slow (${service.responseTime}ms).`,
          action: 'Monitor service performance and consider optimization.'
        });
      }
    }

    return recommendations;
  }

  /**
   * Generate health report
   * @returns {Promise<Object>} Comprehensive health report
   */
  async generateHealthReport() {
    const systemHealth = await this.getSystemHealth();
    const recommendations = this.getHealthRecommendations(systemHealth);
    
    return {
      ...systemHealth,
      recommendations,
      generatedAt: new Date().toISOString(),
      cacheInfo: {
        cacheTimeout: this.cacheTimeout,
        cachedServices: Array.from(this.healthCache.keys())
      }
    };
  }

  /**
   * Add custom service to monitor
   * @param {string} serviceKey - Service identifier
   * @param {Object} serviceConfig - Service configuration
   */
  addService(serviceKey, serviceConfig) {
    this.services[serviceKey] = {
      ...serviceConfig,
      critical: serviceConfig.critical || false
    };
  }

  /**
   * Remove service from monitoring
   * @param {string} serviceKey - Service identifier
   */
  removeService(serviceKey) {
    delete this.services[serviceKey];
    this.healthCache.delete(serviceKey);
  }
}

module.exports = HealthChecker;



