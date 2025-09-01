/**
 * Unit tests for OpenAI Client utility
 */

const OpenAIClient = require('./openai-client');

// Mock https module
jest.mock('https');
const https = require('https');

// Mock @actions/core
jest.mock('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn()
}));

describe('OpenAIClient', () => {
  let client;
  let mockHttps;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock environment variable
    process.env.OPENAI_API_KEY = 'sk-test-api-key-12345';
    
    // Create client instance
    client = new OpenAIClient();
    mockHttps = https;
  });

  describe('constructor', () => {
    it('should create instance with default configuration', () => {
      expect(client.config.model).toBe('gpt-4');
      expect(client.config.timeout).toBe(300000);
      expect(client.config.maxTokens).toBe(8000);
      expect(client.config.temperature).toBe(0.1);
      expect(client.config.maxRetries).toBe(3);
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        model: 'gpt-3.5-turbo',
        timeout: 60000,
        maxTokens: 4000,
        temperature: 0.5
      };
      
      const customClient = new OpenAIClient(customConfig);
      
      expect(customClient.config.model).toBe('gpt-3.5-turbo');
      expect(customClient.config.timeout).toBe(60000);
      expect(customClient.config.maxTokens).toBe(4000);
      expect(customClient.config.temperature).toBe(0.5);
    });

    it('should validate API key format', () => {
      process.env.OPENAI_API_KEY = 'invalid-key';
      
      expect(() => new OpenAIClient()).toThrow('Invalid OpenAI API key format');
    });

    it('should validate timeout', () => {
      expect(() => new OpenAIClient({ timeout: 500 })).toThrow('Timeout must be at least 1000ms');
    });

    it('should validate max retries', () => {
      expect(() => new OpenAIClient({ maxRetries: -1 })).toThrow('Max retries must be non-negative');
    });

    it('should validate temperature', () => {
      expect(() => new OpenAIClient({ temperature: 3 })).toThrow('Temperature must be between 0 and 2');
      expect(() => new OpenAIClient({ temperature: -1 })).toThrow('Temperature must be between 0 and 2');
    });
  });

  describe('makeRequest', () => {
    beforeEach(() => {
      // Mock successful response
      mockHttps.request.mockImplementation((options, callback) => {
        const mockResponse = {
          statusCode: 200,
          on: jest.fn((event, handler) => {
            if (event === 'data') {
              handler(JSON.stringify({
                choices: [{ message: { content: '{"summary": {"overall_status": "PASS"}}' } }],
                usage: { total_tokens: 100 }
              }));
            }
            if (event === 'end') {
              handler();
            }
          })
        };
        
        callback(mockResponse);
        
        const mockRequest = {
          on: jest.fn(),
          write: jest.fn(),
          end: jest.fn()
        };
        
        return mockRequest;
      });
    });

    it('should make successful API request', async () => {
      const options = {
        messages: [{ role: 'user', content: 'Test message' }],
        systemPrompt: 'You are a helpful assistant'
      };

      const response = await client.makeRequest(options);

      expect(response).toBeDefined();
      expect(response.choices).toBeDefined();
      expect(mockHttps.request).toHaveBeenCalled();
    });

    it('should handle API errors', async () => {
      mockHttps.request.mockImplementation((options, callback) => {
        const mockResponse = {
          statusCode: 400,
          on: jest.fn((event, handler) => {
            if (event === 'data') {
              handler(JSON.stringify({
                error: { message: 'Invalid request' }
              }));
            }
            if (event === 'end') {
              handler();
            }
          })
        };
        
        callback(mockResponse);
        
        const mockRequest = {
          on: jest.fn(),
          write: jest.fn(),
          end: jest.fn()
        };
        
        return mockRequest;
      });

      const options = {
        messages: [{ role: 'user', content: 'Test message' }]
      };

      await expect(client.makeRequest(options)).rejects.toThrow('OpenAI API error: Invalid request');
    });

    it('should handle network errors', async () => {
      mockHttps.request.mockImplementation((options, callback) => {
        const mockRequest = {
          on: jest.fn((event, handler) => {
            if (event === 'error') {
              handler(new Error('Network error'));
            }
          }),
          write: jest.fn(),
          end: jest.fn()
        };
        
        return mockRequest;
      });

      const options = {
        messages: [{ role: 'user', content: 'Test message' }]
      };

      await expect(client.makeRequest(options)).rejects.toThrow('Request failed: Network error');
    });

    it('should handle timeouts', async () => {
      mockHttps.request.mockImplementation((options, callback) => {
        const mockRequest = {
          on: jest.fn((event, handler) => {
            if (event === 'timeout') {
              handler();
            }
          }),
          write: jest.fn(),
          end: jest.fn(),
          destroy: jest.fn()
        };
        
        return mockRequest;
      });

      const options = {
        messages: [{ role: 'user', content: 'Test message' }]
      };

      await expect(client.makeRequest(options)).rejects.toThrow('Request timeout');
    });
  });

  describe('retry logic', () => {
    it('should retry on transient errors', async () => {
      let callCount = 0;
      
      mockHttps.request.mockImplementation((options, callback) => {
        callCount++;
        
        if (callCount < 3) {
          // Simulate transient error
          const mockRequest = {
            on: jest.fn((event, handler) => {
              if (event === 'error') {
                handler(new Error('Connection reset'));
              }
            }),
            write: jest.fn(),
            end: jest.fn()
          };
          return mockRequest;
        } else {
          // Success on third attempt
          const mockResponse = {
            statusCode: 200,
            on: jest.fn((event, handler) => {
              if (event === 'data') {
                handler(JSON.stringify({
                  choices: [{ message: { content: '{"summary": {"overall_status": "PASS"}}' } }],
                  usage: { total_tokens: 100 }
                }));
              }
              if (event === 'end') {
                handler();
              }
            })
          };
          
          callback(mockResponse);
          
          const mockRequest = {
            on: jest.fn(),
            write: jest.fn(),
            end: jest.fn()
          };
          
          return mockRequest;
        }
      });

      const options = {
        messages: [{ role: 'user', content: 'Test message' }]
      };

      const response = await client.makeRequest(options);
      expect(response).toBeDefined();
      expect(callCount).toBe(3);
    });

    it('should not retry on authentication errors', async () => {
      mockHttps.request.mockImplementation((options, callback) => {
        const mockResponse = {
          statusCode: 401,
          on: jest.fn((event, handler) => {
            if (event === 'data') {
              handler(JSON.stringify({
                error: { message: 'Invalid API key' }
              }));
            }
            if (event === 'end') {
              handler();
            }
          })
        };
        
        callback(mockResponse);
        
        const mockRequest = {
          on: jest.fn(),
          write: jest.fn(),
          end: jest.fn()
        };
        
        return mockRequest;
      });

      const options = {
        messages: [{ role: 'user', content: 'Test message' }]
      };

      await expect(client.makeRequest(options)).rejects.toThrow('OpenAI API error: Invalid API key');
      expect(mockHttps.request).toHaveBeenCalledTimes(1);
    });
  });

  describe('rate limiting', () => {
    it('should track request count', () => {
      expect(client.requestCount).toBe(0);
      
      // Simulate successful request
      client.updateRateLimits({ usage: { total_tokens: 100 } });
      
      expect(client.requestCount).toBe(1);
    });

    it('should track token count', () => {
      expect(client.tokenCount).toBe(0);
      
      // Simulate successful request
      client.updateRateLimits({ usage: { total_tokens: 150 } });
      
      expect(client.tokenCount).toBe(150);
    });

    it('should reset counters after time window', () => {
      // Set initial state
      client.requestCount = 50;
      client.tokenCount = 50000;
      client.lastResetTime = Date.now() - 70000; // 70 seconds ago
      
      // Check rate limits (should reset)
      client.checkRateLimits();
      
      expect(client.requestCount).toBe(0);
      expect(client.tokenCount).toBe(0);
    });

    it('should throw error when rate limit exceeded', () => {
      // Set state to exceed limits
      client.requestCount = 60;
      client.lastResetTime = Date.now();
      
      expect(() => client.checkRateLimits()).toThrow('Rate limit exceeded');
    });
  });

  describe('performCodeReview', () => {
    beforeEach(() => {
      // Mock successful API response
      mockHttps.request.mockImplementation((options, callback) => {
        const mockResponse = {
          statusCode: 200,
          on: jest.fn((event, handler) => {
            if (event === 'data') {
              handler(JSON.stringify({
                choices: [{ 
                  message: { 
                    content: JSON.stringify({
                      summary: {
                        overall_status: 'FAIL',
                        total_issues: 2,
                        high_severity: 1,
                        medium_severity: 1,
                        low_severity: 0
                      },
                      issues: [
                        {
                          file: 'test.js',
                          line: 10,
                          severity: 'HIGH',
                          category: 'SECURITY',
                          title: 'SQL Injection vulnerability',
                          description: 'User input not properly sanitized',
                          recommendation: 'Use parameterized queries'
                        }
                      ],
                      recommendations: {
                        immediate_actions: ['Fix SQL injection'],
                        long_term_improvements: ['Implement input validation']
                      }
                    })
                  } 
                }],
                usage: { total_tokens: 200 },
                model: 'gpt-4'
              }));
            }
            if (event === 'end') {
              handler();
            }
          })
        };
        
        callback(mockResponse);
        
        const mockRequest = {
          on: jest.fn(),
          write: jest.fn(),
          end: jest.fn()
        };
        
        return mockRequest;
      });
    });

    it('should perform code review successfully', async () => {
      const reviewData = {
        files: [
          {
            path: 'test.js',
            content: 'const query = "SELECT * FROM users WHERE id = " + userId;'
          }
        ],
        targetBranch: 'main',
        severityThreshold: 'HIGH',
        reviewCriteria: {
          security: { enabled: true, priority: 'HIGH' }
        }
      };

      const result = await client.performCodeReview(reviewData);

      expect(result.success).toBe(true);
      expect(result.results.summary.overall_status).toBe('FAIL');
      expect(result.results.issues).toHaveLength(1);
      expect(result.results.issues[0].severity).toBe('HIGH');
      expect(result.results.issues[0].category).toBe('SECURITY');
    });

    it('should handle review failure', async () => {
      mockHttps.request.mockImplementation((options, callback) => {
        const mockRequest = {
          on: jest.fn((event, handler) => {
            if (event === 'error') {
              handler(new Error('API unavailable'));
            }
          }),
          write: jest.fn(),
          end: jest.fn()
        };
        
        return mockRequest;
      });

      const reviewData = {
        files: [{ path: 'test.js', content: 'console.log("test");' }],
        targetBranch: 'main',
        severityThreshold: 'MEDIUM'
      };

      const result = await client.performCodeReview(reviewData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('API unavailable');
    });
  });

  describe('response parsing', () => {
    it('should parse valid JSON response', () => {
      const response = {
        choices: [{ 
          message: { 
            content: JSON.stringify({
              summary: { overall_status: 'PASS' },
              issues: [],
              recommendations: { immediate_actions: [] }
            })
          } 
        }]
      };

      const result = client.parseReviewResponse(response, {});
      
      expect(result.summary.overall_status).toBe('PASS');
      expect(result.issues).toEqual([]);
    });

    it('should handle malformed JSON response', () => {
      const response = {
        choices: [{ 
          message: { 
            content: 'Invalid JSON response'
          } 
        }]
      };

      const result = client.parseReviewResponse(response, {});
      
      expect(result.summary.overall_status).toBe('ERROR');
      expect(result.parse_error).toBeDefined();
    });

    it('should validate response structure', () => {
      const response = {
        choices: [{ 
          message: { 
            content: JSON.stringify({
              summary: { overall_status: 'INVALID_STATUS' },
              issues: [],
              recommendations: { immediate_actions: [] }
            })
          } 
        }]
      };

      const result = client.parseReviewResponse(response, {});
      
      expect(result.summary.overall_status).toBe('ERROR');
      expect(result.parse_error).toBeDefined();
    });

    it('should validate issue structure', () => {
      const response = {
        choices: [{ 
          message: { 
            content: JSON.stringify({
              summary: { overall_status: 'FAIL' },
              issues: [
                {
                  file: 'test.js',
                  line: 10,
                  severity: 'INVALID_SEVERITY',
                  category: 'SECURITY',
                  title: 'Test issue'
                }
              ],
              recommendations: { immediate_actions: [] }
            })
          } 
        }]
      };

      const result = client.parseReviewResponse(response, {});
      
      expect(result.summary.overall_status).toBe('ERROR');
      expect(result.parse_error).toBeDefined();
    });
  });

  describe('token calculation', () => {
    it('should calculate max tokens based on file content', () => {
      const files = [
        { content: 'console.log("test");' },
        { content: 'function test() { return true; }' }
      ];

      const maxTokens = client.calculateMaxTokens(files);
      
      expect(maxTokens).toBeGreaterThan(0);
      expect(maxTokens).toBeLessThanOrEqual(client.config.maxTokens);
    });

    it('should handle empty files', () => {
      const files = [];
      const maxTokens = client.calculateMaxTokens(files);
      
      expect(maxTokens).toBe(2000); // Minimum response tokens
    });

    it('should respect max token limit', () => {
      const largeContent = 'x'.repeat(100000); // Large content
      const files = [{ content: largeContent }];

      const maxTokens = client.calculateMaxTokens(files);
      
      expect(maxTokens).toBeLessThanOrEqual(client.config.maxTokens);
    });
  });

  describe('utility methods', () => {
    it('should format file size correctly', () => {
      expect(client.formatFileSize(0)).toBe('0 Bytes');
      expect(client.formatFileSize(1024)).toBe('1 KB');
      expect(client.formatFileSize(1024 * 1024)).toBe('1 MB');
    });

    it('should sleep for specified time', async () => {
      const start = Date.now();
      await client.sleep(100);
      const end = Date.now();
      
      expect(end - start).toBeGreaterThanOrEqual(100);
    });

    it('should get configuration summary', () => {
      const summary = client.getConfigSummary();
      
      expect(summary.model).toBe('gpt-4');
      expect(summary.timeout).toBe(300000);
      expect(summary.maxTokens).toBe(8000);
      expect(summary.temperature).toBe(0.1);
    });

    it('should get rate limit state', () => {
      const state = client.getRateLimitState();
      
      expect(state.requestCount).toBe(0);
      expect(state.tokenCount).toBe(0);
      expect(state.requestsPerMinute).toBe(60);
      expect(state.tokensPerMinute).toBe(150000);
    });
  });

  describe('logging', () => {
    it('should log info messages when enabled', () => {
      const core = require('@actions/core');
      
      client.logInfo('Test info message');
      
      expect(core.info).toHaveBeenCalledWith('[OpenAI Client] Test info message');
    });

    it('should log warning messages', () => {
      const core = require('@actions/core');
      
      client.logWarning('Test warning message');
      
      expect(core.warning).toHaveBeenCalledWith('[OpenAI Client] Test warning message');
    });

    it('should log error messages', () => {
      const core = require('@actions/core');
      
      client.logError('Test error message');
      
      expect(core.error).toHaveBeenCalledWith('[OpenAI Client] Test error message');
    });

    it('should not log info when disabled', () => {
      const disabledClient = new OpenAIClient({ enableLogging: false });
      const core = require('@actions/core');
      
      disabledClient.logInfo('Test message');
      
      expect(core.info).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle missing API key', () => {
      delete process.env.OPENAI_API_KEY;
      
      expect(() => new OpenAIClient()).toThrow('OpenAI API key is required');
    });

    it('should handle invalid API key format', () => {
      expect(() => new OpenAIClient({ apiKey: 'invalid-key' })).toThrow('Invalid OpenAI API key format');
    });

    it('should handle response parsing errors', () => {
      const response = {
        choices: [{ 
          message: { 
            content: null
          } 
        }]
      };

      const result = client.parseReviewResponse(response, {});
      
      expect(result.summary.overall_status).toBe('ERROR');
      expect(result.parse_error).toBe('No content in response');
    });
  });
});



