const HealthChecker = require('./health-checker');

// Mock Node.js modules
jest.mock('https');
jest.mock('http');
jest.mock('net');

const https = require('https');
const http = require('http');
const net = require('net');

describe('HealthChecker', () => {
  let healthChecker;
  let mockConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig = {
      openai: { api_key: 'test-openai-key' },
      github: { token: 'test-github-token' },
      notifications: {
        email: {
          smtp_host: 'smtp.test.com',
          smtp_port: 587
        }
      },
      health: {
        cache_timeout: 30000
      }
    };
    healthChecker = new HealthChecker(mockConfig);
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const checker = new HealthChecker();
      expect(checker.services.openai).toBeDefined();
      expect(checker.services.github).toBeDefined();
      expect(checker.services.email).toBeDefined();
      expect(checker.cacheTimeout).toBe(30000);
    });

    it('should initialize with custom config', () => {
      expect(healthChecker.services.openai.headers.Authorization).toBe('Bearer test-openai-key');
      expect(healthChecker.services.github.headers.Authorization).toBe('token test-github-token');
      expect(healthChecker.services.email.url).toBe('smtp.test.com');
      expect(healthChecker.services.email.port).toBe(587);
    });

    it('should set critical services correctly', () => {
      expect(healthChecker.services.openai.critical).toBe(true);
      expect(healthChecker.services.github.critical).toBe(true);
      expect(healthChecker.services.email.critical).toBe(false);
    });
  });

  describe('checkHttpService', () => {
    it('should return healthy status for successful response', async () => {
      const mockResponse = {
        statusCode: 200,
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'data') {
            callback('{"data": "test"}');
          }
          if (event === 'end') {
            callback();
          }
        })
      };

      const mockRequest = {
        on: jest.fn(),
        end: jest.fn()
      };

      https.request.mockReturnValue(mockRequest);
      https.request.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const result = await healthChecker.checkHttpService(healthChecker.services.openai);
      
      expect(result.status).toBe('healthy');
      expect(result.details.statusCode).toBe(200);
      expect(result.details.response).toEqual({ data: 'test' });
    });

    it('should return auth_error for 401 status', async () => {
      const mockResponse = {
        statusCode: 401,
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'data') {
            callback('{"error": "unauthorized"}');
          }
          if (event === 'end') {
            callback();
          }
        })
      };

      const mockRequest = {
        on: jest.fn(),
        end: jest.fn()
      };

      https.request.mockReturnValue(mockRequest);
      https.request.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const result = await healthChecker.checkHttpService(healthChecker.services.openai);
      
      expect(result.status).toBe('auth_error');
      expect(result.details.statusCode).toBe(401);
    });

    it('should return rate_limited for 429 status', async () => {
      const mockResponse = {
        statusCode: 429,
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'data') {
            callback('{"error": "rate limited"}');
          }
          if (event === 'end') {
            callback();
          }
        })
      };

      const mockRequest = {
        on: jest.fn(),
        end: jest.fn()
      };

      https.request.mockReturnValue(mockRequest);
      https.request.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const result = await healthChecker.checkHttpService(healthChecker.services.openai);
      
      expect(result.status).toBe('rate_limited');
      expect(result.details.statusCode).toBe(429);
    });

    it('should return unhealthy for other error status codes', async () => {
      const mockResponse = {
        statusCode: 500,
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'data') {
            callback('{"error": "server error"}');
          }
          if (event === 'end') {
            callback();
          }
        })
      };

      const mockRequest = {
        on: jest.fn(),
        end: jest.fn()
      };

      https.request.mockReturnValue(mockRequest);
      https.request.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const result = await healthChecker.checkHttpService(healthChecker.services.openai);
      
      expect(result.status).toBe('unhealthy');
      expect(result.details.statusCode).toBe(500);
    });

    it('should handle request errors', async () => {
      const mockRequest = {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'error') {
            callback(new Error('Network error'));
          }
        }),
        end: jest.fn()
      };

      https.request.mockReturnValue(mockRequest);

      await expect(healthChecker.checkHttpService(healthChecker.services.openai))
        .rejects.toThrow('Network error');
    });

    it('should handle request timeout', async () => {
      const mockRequest = {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'timeout') {
            callback();
          }
        }),
        destroy: jest.fn(),
        end: jest.fn()
      };

      https.request.mockReturnValue(mockRequest);

      await expect(healthChecker.checkHttpService(healthChecker.services.openai))
        .rejects.toThrow('Request timeout');
    });
  });

  describe('checkEmailService', () => {
    it('should return healthy status for successful connection', async () => {
      const mockSocket = {
        connect: jest.fn(),
        destroy: jest.fn(),
        on: jest.fn()
      };

      net.Socket.mockImplementation(() => mockSocket);
      mockSocket.connect.mockImplementation((port, host, callback) => {
        callback();
      });

      const result = await healthChecker.checkEmailService(healthChecker.services.email);
      
      expect(result.status).toBe('healthy');
      expect(result.details.host).toBe('smtp.test.com');
      expect(result.details.port).toBe(587);
    });

    it('should handle connection errors', async () => {
      const mockSocket = {
        connect: jest.fn(),
        destroy: jest.fn(),
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'error') {
            callback(new Error('Connection refused'));
          }
        })
      };

      net.Socket.mockImplementation(() => mockSocket);

      await expect(healthChecker.checkEmailService(healthChecker.services.email))
        .rejects.toThrow('Connection refused');
    });

    it('should handle connection timeout', async () => {
      const mockSocket = {
        connect: jest.fn(),
        destroy: jest.fn(),
        on: jest.fn()
      };

      net.Socket.mockImplementation(() => mockSocket);

      // Mock setTimeout to trigger timeout immediately
      jest.spyOn(global, 'setTimeout').mockImplementation((callback) => {
        callback();
        return { clearTimeout: jest.fn() };
      });

      await expect(healthChecker.checkEmailService(healthChecker.services.email))
        .rejects.toThrow('Connection timeout');
    });
  });

  describe('caching', () => {
    it('should cache health results', async () => {
      const mockResponse = {
        statusCode: 200,
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'data') {
            callback('{"data": "test"}');
          }
          if (event === 'end') {
            callback();
          }
        })
      };

      const mockRequest = {
        on: jest.fn(),
        end: jest.fn()
      };

      https.request.mockReturnValue(mockRequest);
      https.request.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      // First call should make actual request
      await healthChecker.checkService('openai', healthChecker.services.openai);
      
      // Second call should use cache
      const cachedResult = await healthChecker.checkService('openai', healthChecker.services.openai);
      
      expect(cachedResult.status).toBe('healthy');
      expect(https.request).toHaveBeenCalledTimes(1); // Only called once due to caching
    });

    it('should clear cache when timeout expires', async () => {
      // Set a very short cache timeout
      healthChecker.cacheTimeout = 1;
      
      const mockResponse = {
        statusCode: 200,
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'data') {
            callback('{"data": "test"}');
          }
          if (event === 'end') {
            callback();
          }
        })
      };

      const mockRequest = {
        on: jest.fn(),
        end: jest.fn()
      };

      https.request.mockReturnValue(mockRequest);
      https.request.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      // First call
      await healthChecker.checkService('openai', healthChecker.services.openai);
      
      // Manually expire the cache by setting old timestamp
      const cached = healthChecker.healthCache.get('openai');
      cached.cacheTime = Date.now() - 1000; // Set to 1 second ago
      healthChecker.healthCache.set('openai', cached);
      
      // Second call should make new request
      await healthChecker.checkService('openai', healthChecker.services.openai);
      
      expect(https.request).toHaveBeenCalledTimes(2); // Called twice due to cache expiration
    });

    it('should clear specific service cache', () => {
      healthChecker.healthCache.set('openai', { result: { status: 'healthy' }, cacheTime: Date.now() });
      healthChecker.healthCache.set('github', { result: { status: 'healthy' }, cacheTime: Date.now() });
      
      healthChecker.clearCache('openai');
      
      expect(healthChecker.healthCache.has('openai')).toBe(false);
      expect(healthChecker.healthCache.has('github')).toBe(true);
    });

    it('should clear all cache', () => {
      healthChecker.healthCache.set('openai', { result: { status: 'healthy' }, cacheTime: Date.now() });
      healthChecker.healthCache.set('github', { result: { status: 'healthy' }, cacheTime: Date.now() });
      
      healthChecker.clearCache();
      
      expect(healthChecker.healthCache.size).toBe(0);
    });
  });

  describe('getSystemHealth', () => {
    it('should return healthy status when all critical services are healthy', async () => {
      jest.spyOn(healthChecker, 'checkAllServices').mockResolvedValue({
        openai: { status: 'healthy', critical: true },
        github: { status: 'healthy', critical: true },
        email: { status: 'healthy', critical: false }
      });

      const result = await healthChecker.getSystemHealth();
      
      expect(result.status).toBe('healthy');
      expect(result.summary.healthy).toBe(3);
      expect(result.summary.unhealthy).toBe(0);
      expect(result.summary.critical).toBe(2);
      expect(result.summary.healthyCritical).toBe(2);
    });

    it('should return degraded status when some critical services are unhealthy', async () => {
      jest.spyOn(healthChecker, 'checkAllServices').mockResolvedValue({
        openai: { status: 'healthy', critical: true, responseTime: 1000 },
        github: { status: 'error', critical: true, responseTime: null },
        email: { status: 'healthy', critical: false, responseTime: 500 }
      });

      const result = await healthChecker.getSystemHealth();
      
      expect(result.status).toBe('degraded');
      expect(result.summary.healthy).toBe(2);
      expect(result.summary.unhealthy).toBe(1);
      expect(result.summary.critical).toBe(2);
      expect(result.summary.healthyCritical).toBe(1);
      expect(result.summary.averageResponseTime).toBe(750);
    });

    it('should return critical status when all critical services are unhealthy', async () => {
      jest.spyOn(healthChecker, 'checkAllServices').mockResolvedValue({
        openai: { status: 'error', critical: true },
        github: { status: 'error', critical: true },
        email: { status: 'healthy', critical: false }
      });

      const result = await healthChecker.getSystemHealth();
      
      expect(result.status).toBe('critical');
      expect(result.summary.healthy).toBe(1);
      expect(result.summary.unhealthy).toBe(2);
      expect(result.summary.critical).toBe(2);
      expect(result.summary.healthyCritical).toBe(0);
    });
  });

  describe('getHealthRecommendations', () => {
    it('should return critical recommendation when system is critical', () => {
      const systemHealth = {
        status: 'critical',
        services: {
          openai: { status: 'error', name: 'OpenAI API' },
          github: { status: 'error', name: 'GitHub API' }
        }
      };

      const recommendations = healthChecker.getHealthRecommendations(systemHealth);
      
      expect(recommendations).toContainEqual(
        expect.objectContaining({
          priority: 'critical',
          message: 'All critical services are down. Immediate action required.'
        })
      );
    });

    it('should return high priority recommendation when system is degraded', () => {
      const systemHealth = {
        status: 'degraded',
        services: {
          openai: { status: 'healthy', name: 'OpenAI API' },
          github: { status: 'error', name: 'GitHub API' }
        }
      };

      const recommendations = healthChecker.getHealthRecommendations(systemHealth);
      
      expect(recommendations).toContainEqual(
        expect.objectContaining({
          priority: 'high',
          message: 'Some critical services are unhealthy.'
        })
      );
    });

    it('should return auth error recommendation', () => {
      const systemHealth = {
        status: 'healthy',
        services: {
          openai: { status: 'auth_error', name: 'OpenAI API' }
        }
      };

      const recommendations = healthChecker.getHealthRecommendations(systemHealth);
      
      expect(recommendations).toContainEqual(
        expect.objectContaining({
          priority: 'high',
          message: 'OpenAI API authentication failed.'
        })
      );
    });

    it('should return rate limit recommendation', () => {
      const systemHealth = {
        status: 'healthy',
        services: {
          github: { status: 'rate_limited', name: 'GitHub API' }
        }
      };

      const recommendations = healthChecker.getHealthRecommendations(systemHealth);
      
      expect(recommendations).toContainEqual(
        expect.objectContaining({
          priority: 'medium',
          message: 'GitHub API is rate limited.'
        })
      );
    });

    it('should return slow response recommendation', () => {
      const systemHealth = {
        status: 'healthy',
        services: {
          openai: { status: 'healthy', name: 'OpenAI API', responseTime: 6000 }
        }
      };

      const recommendations = healthChecker.getHealthRecommendations(systemHealth);
      
      expect(recommendations).toContainEqual(
        expect.objectContaining({
          priority: 'medium',
          message: 'OpenAI API response time is slow (6000ms).'
        })
      );
    });
  });

  describe('service management', () => {
    it('should add custom service', () => {
      const customService = {
        name: 'Custom API',
        url: 'https://api.custom.com/health',
        method: 'GET',
        timeout: 5000,
        critical: true
      };

      healthChecker.addService('custom', customService);
      
      expect(healthChecker.services.custom).toEqual(customService);
    });

    it('should remove service', () => {
      healthChecker.healthCache.set('openai', { result: { status: 'healthy' }, cacheTime: Date.now() });
      
      healthChecker.removeService('openai');
      
      expect(healthChecker.services.openai).toBeUndefined();
      expect(healthChecker.healthCache.has('openai')).toBe(false);
    });

    it('should throw error for unknown service', async () => {
      await expect(healthChecker.getServiceHealth('unknown'))
        .rejects.toThrow('Unknown service: unknown');
    });
  });

  describe('generateHealthReport', () => {
    it('should generate comprehensive health report', async () => {
      jest.spyOn(healthChecker, 'getSystemHealth').mockResolvedValue({
        status: 'healthy',
        timestamp: '2024-01-01T10:00:00.000Z',
        services: {
          openai: { status: 'healthy', name: 'OpenAI API' }
        },
        summary: {
          total: 1,
          healthy: 1,
          unhealthy: 0,
          critical: 1,
          healthyCritical: 1,
          averageResponseTime: 1000
        }
      });

      const report = await healthChecker.generateHealthReport();
      
      expect(report.status).toBe('healthy');
      expect(report.recommendations).toBeDefined();
      expect(report.generatedAt).toBeDefined();
      expect(report.cacheInfo).toBeDefined();
      expect(report.cacheInfo.cacheTimeout).toBe(30000);
    });
  });
});
