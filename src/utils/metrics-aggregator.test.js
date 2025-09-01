const MetricsAggregator = require('./metrics-aggregator');

// Mock fs.promises
jest.mock('fs', () => ({
  promises: {
    readdir: jest.fn(),
    readFile: jest.fn()
  }
}));

const fs = require('fs').promises;

describe('MetricsAggregator', () => {
  let metricsAggregator;
  let mockConfig;

  beforeEach(() => {
    mockConfig = {
      logging: {
        audit_log_dir: './logs/audit'
      },
      metrics: {
        cache_timeout: 300000
      }
    };
    
    metricsAggregator = new MetricsAggregator(mockConfig);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const aggregator = new MetricsAggregator();
      expect(aggregator.logDir).toBe('./logs/audit');
      expect(aggregator.cacheTimeout).toBe(300000);
      expect(aggregator.cache).toBeInstanceOf(Map);
    });

    it('should initialize with custom config', () => {
      const customConfig = {
        logging: { audit_log_dir: '/custom/logs' },
        metrics: { cache_timeout: 600000 }
      };
      const aggregator = new MetricsAggregator(customConfig);
      expect(aggregator.logDir).toBe('/custom/logs');
      expect(aggregator.cacheTimeout).toBe(600000);
    });
  });

  describe('calculatePercentiles', () => {
    it('should return default values for empty data', () => {
      const result = metricsAggregator.calculatePercentiles([], 'response_time_ms');
      
      expect(result).toEqual({
        count: 0,
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        p50: 0,
        p75: 0,
        p90: 0,
        p95: 0,
        p99: 0
      });
    });

    it('should calculate percentiles for response time data', () => {
      const metricsData = [
        { data: { response_time_ms: 1000 } },
        { data: { response_time_ms: 2000 } },
        { data: { response_time_ms: 3000 } },
        { data: { response_time_ms: 4000 } },
        { data: { response_time_ms: 5000 } }
      ];

      const result = metricsAggregator.calculatePercentiles(metricsData, 'response_time_ms');
      
      expect(result.count).toBe(5);
      expect(result.min).toBe(1000);
      expect(result.max).toBe(5000);
      expect(result.mean).toBe(3000);
      expect(result.median).toBe(3000);
      expect(result.p50).toBe(3000);
      expect(result.p75).toBe(4000);
      expect(result.p90).toBe(4600);
      expect(result.p95).toBe(4800);
      expect(result.p99).toBe(4950);
    });

    it('should filter out invalid values', () => {
      const metricsData = [
        { data: { response_time_ms: 1000 } },
        { data: { response_time_ms: null } },
        { data: { response_time_ms: undefined } },
        { data: { response_time_ms: 'invalid' } },
        { data: { response_time_ms: 2000 } }
      ];

      const result = metricsAggregator.calculatePercentiles(metricsData, 'response_time_ms');
      
      expect(result.count).toBe(2);
      expect(result.min).toBe(1000);
      expect(result.max).toBe(2000);
    });

    it('should handle single value', () => {
      const metricsData = [
        { data: { response_time_ms: 1500 } }
      ];

      const result = metricsAggregator.calculatePercentiles(metricsData, 'response_time_ms');
      
      expect(result.count).toBe(1);
      expect(result.min).toBe(1500);
      expect(result.max).toBe(1500);
      expect(result.mean).toBe(1500);
      expect(result.median).toBe(1500);
    });
  });

  describe('calculatePercentile', () => {
    it('should calculate exact percentile for single value', () => {
      const values = [100];
      const result = metricsAggregator.calculatePercentile(values, 50);
      expect(result).toBe(100);
    });

    it('should calculate interpolated percentile', () => {
      const values = [100, 200, 300, 400, 500];
      const result = metricsAggregator.calculatePercentile(values, 75);
      expect(result).toBe(400);
    });

    it('should handle edge cases', () => {
      const values = [100, 200, 300];
      expect(metricsAggregator.calculatePercentile(values, 0)).toBe(100);
      expect(metricsAggregator.calculatePercentile(values, 100)).toBe(300);
    });
  });

  describe('generatePerformanceReport', () => {
    beforeEach(() => {
      // Mock log files
      fs.readdir.mockResolvedValue(['audit-2024-01-01.jsonl', 'audit-2024-01-02.jsonl']);
      
      // Mock log content
      const mockLogContent = JSON.stringify({
        event_type: 'ai_response_metrics',
        timestamp: '2024-01-01T10:00:00.000Z',
        data: {
          response_time_ms: 5000,
          tokens_used: 1000,
          quality_score: 0.8,
          efficiency_score: 0.7,
          cost_estimate_usd: 0.03,
          fallback_used: false
        },
        context: {
          environment: 'dev',
          repository: 'test-repo'
        }
      }) + '\n';

      fs.readFile.mockResolvedValue(mockLogContent);
    });

    it('should generate performance report with default options', async () => {
      const report = await metricsAggregator.generatePerformanceReport();
      
      expect(report).toHaveProperty('generatedAt');
      expect(report).toHaveProperty('period');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('performance');
      expect(report).toHaveProperty('trends');
      expect(report).toHaveProperty('insights');
      expect(report).toHaveProperty('recommendations');
      
      expect(report.summary.totalReviews).toBeGreaterThanOrEqual(0);
      expect(report.summary.successRate).toBeGreaterThanOrEqual(0);
      expect(report.summary.successRate).toBeLessThanOrEqual(100);
    });

    it('should use cache for repeated requests', async () => {
      const options = { startDate: new Date('2024-01-01'), endDate: new Date('2024-01-02') };
      
      // First call
      const report1 = await metricsAggregator.generatePerformanceReport(options);
      
      // Second call should use cache
      const report2 = await metricsAggregator.generatePerformanceReport(options);
      
      expect(report1).toEqual(report2);
      expect(fs.readdir).toHaveBeenCalledTimes(1);
    });

    it('should filter by model', async () => {
      const options = { model: 'gpt-4' };
      
      await metricsAggregator.generatePerformanceReport(options);
      
      expect(fs.readdir).toHaveBeenCalled();
      expect(fs.readFile).toHaveBeenCalled();
    });

    it('should filter by environment', async () => {
      const options = { environment: 'production' };
      
      await metricsAggregator.generatePerformanceReport(options);
      
      expect(fs.readdir).toHaveBeenCalled();
      expect(fs.readFile).toHaveBeenCalled();
    });

    it('should handle file read errors gracefully', async () => {
      fs.readFile.mockRejectedValue(new Error('File read error'));
      
      const report = await metricsAggregator.generatePerformanceReport();
      
      expect(report.summary.totalReviews).toBe(0);
      expect(report.insights).toContain('No metrics data available for analysis');
    });
  });

  describe('calculateTrends', () => {
    it('should return insufficient data for single metric', async () => {
      const metricsData = [
        {
          timestamp: '2024-01-01T10:00:00.000Z',
          data: { response_time_ms: 5000, quality_score: 0.8, efficiency_score: 0.7, cost_estimate_usd: 0.03 }
        }
      ];

      const trends = await metricsAggregator.calculateTrends(metricsData);
      
      expect(trends.responseTime.trend).toBe('insufficient_data');
      expect(trends.qualityScore.trend).toBe('insufficient_data');
      expect(trends.efficiencyScore.trend).toBe('insufficient_data');
      expect(trends.costEstimate.trend).toBe('insufficient_data');
    });

    it('should calculate trends for multiple days', async () => {
      const metricsData = [
        {
          timestamp: '2024-01-01T10:00:00.000Z',
          data: { response_time_ms: 5000, quality_score: 0.8, efficiency_score: 0.7, cost_estimate_usd: 0.03 }
        },
        {
          timestamp: '2024-01-02T10:00:00.000Z',
          data: { response_time_ms: 6000, quality_score: 0.9, efficiency_score: 0.8, cost_estimate_usd: 0.04 }
        }
      ];

      const trends = await metricsAggregator.calculateTrends(metricsData);
      
      expect(trends.responseTime.trend).toBe('increasing');
      expect(trends.qualityScore.trend).toBe('increasing');
      expect(trends.efficiencyScore.trend).toBe('increasing');
      expect(trends.costEstimate.trend).toBe('increasing');
    });

    it('should identify stable trends', async () => {
      const metricsData = [
        {
          timestamp: '2024-01-01T10:00:00.000Z',
          data: { response_time_ms: 5000, quality_score: 0.8, efficiency_score: 0.7, cost_estimate_usd: 0.03 }
        },
        {
          timestamp: '2024-01-02T10:00:00.000Z',
          data: { response_time_ms: 5100, quality_score: 0.81, efficiency_score: 0.71, cost_estimate_usd: 0.031 }
        }
      ];

      const trends = await metricsAggregator.calculateTrends(metricsData);
      
      expect(trends.responseTime.trend).toBe('stable');
      expect(trends.qualityScore.trend).toBe('stable');
      expect(trends.efficiencyScore.trend).toBe('stable');
      expect(trends.costEstimate.trend).toBe('stable');
    });
  });

  describe('generateInsights', () => {
    it('should return default insight for empty data', () => {
      const insights = metricsAggregator.generateInsights([]);
      expect(insights).toContain('No metrics data available for analysis');
    });

    it('should generate performance insights for slow response times', () => {
      const metricsData = [
        { data: { response_time_ms: 35000 } },
        { data: { response_time_ms: 40000 } }
      ];

      const insights = metricsAggregator.generateInsights(metricsData);
      
      expect(insights.some(insight => insight.includes('response time is high'))).toBe(true);
    });

    it('should generate quality insights for low quality scores', () => {
      const metricsData = [
        { data: { quality_score: 0.6 } },
        { data: { quality_score: 0.5 } }
      ];

      const insights = metricsAggregator.generateInsights(metricsData);
      
      expect(insights.some(insight => insight.includes('quality score is low'))).toBe(true);
    });

    it('should generate cost insights for high costs', () => {
      const metricsData = [
        { data: { cost_estimate_usd: 50 } },
        { data: { cost_estimate_usd: 60 } }
      ];

      const insights = metricsAggregator.generateInsights(metricsData);
      
      expect(insights.some(insight => insight.includes('cost is high'))).toBe(true);
    });

    it('should generate efficiency insights for low efficiency scores', () => {
      const metricsData = [
        { data: { efficiency_score: 0.5 } },
        { data: { efficiency_score: 0.4 } }
      ];

      const insights = metricsAggregator.generateInsights(metricsData);
      
      expect(insights.some(insight => insight.includes('efficiency score is low'))).toBe(true);
    });

    it('should generate failure rate insights', () => {
      const metricsData = [
        { data: { fallback_used: false } },
        { data: { fallback_used: true } },
        { data: { fallback_used: true } },
        { data: { fallback_used: true } }
      ];

      const insights = metricsAggregator.generateInsights(metricsData);
      
      expect(insights.some(insight => insight.includes('failure rate'))).toBe(true);
    });
  });

  describe('generateRecommendations', () => {
    it('should return default recommendation for empty data', () => {
      const recommendations = metricsAggregator.generateRecommendations([]);
      expect(recommendations).toContain('Collect more metrics data to generate meaningful recommendations');
    });

    it('should generate performance recommendations for slow reviews', () => {
      const metricsData = [
        { data: { response_time_ms: 35000 } },
        { data: { response_time_ms: 40000 } },
        { data: { response_time_ms: 45000 } },
        { data: { response_time_ms: 50000 } },
        { data: { response_time_ms: 55000 } }
      ];

      const recommendations = metricsAggregator.generateRecommendations(metricsData);
      
      expect(recommendations.some(rec => rec.includes('commit size limits'))).toBe(true);
      expect(recommendations.some(rec => rec.includes('faster AI models'))).toBe(true);
    });

    it('should generate quality recommendations for low quality reviews', () => {
      const metricsData = [
        { data: { quality_score: 0.6 } },
        { data: { quality_score: 0.5 } },
        { data: { quality_score: 0.4 } },
        { data: { quality_score: 0.3 } }
      ];

      const recommendations = metricsAggregator.generateRecommendations(metricsData);
      
      expect(recommendations.some(rec => rec.includes('prompt engineering'))).toBe(true);
      expect(recommendations.some(rec => rec.includes('quality gates'))).toBe(true);
    });

    it('should generate cost recommendations for expensive reviews', () => {
      const metricsData = [
        { data: { cost_estimate_usd: 1.5 } },
        { data: { cost_estimate_usd: 2.0 } },
        { data: { cost_estimate_usd: 1.8 } }
      ];

      const recommendations = metricsAggregator.generateRecommendations(metricsData);
      
      expect(recommendations.some(rec => rec.includes('token usage limits'))).toBe(true);
      expect(recommendations.some(rec => rec.includes('cost-effective models') || rec.includes('token usage limits'))).toBe(true);
    });

    it('should generate model standardization recommendations', () => {
      const metricsData = [
        { data: { model_used: 'gpt-4' } },
        { data: { model_used: 'gpt-3.5-turbo' } },
        { data: { model_used: 'claude-3' } }
      ];

      const recommendations = metricsAggregator.generateRecommendations(metricsData);
      
      expect(recommendations.some(rec => rec.includes('Standardize on a single AI model'))).toBe(true);
    });
  });

  describe('cache management', () => {
    it('should clear cache', () => {
      metricsAggregator.cache.set('test', { timestamp: Date.now(), data: {} });
      expect(metricsAggregator.cache.size).toBe(1);
      
      metricsAggregator.clearCache();
      expect(metricsAggregator.cache.size).toBe(0);
    });

    it('should get cache statistics', () => {
      metricsAggregator.cache.set('test1', { timestamp: Date.now(), data: {} });
      metricsAggregator.cache.set('test2', { timestamp: Date.now(), data: {} });
      
      const stats = metricsAggregator.getCacheStats();
      
      expect(stats.size).toBe(2);
      expect(stats.timeout).toBe(300000);
      expect(stats.entries).toContain('test1');
      expect(stats.entries).toContain('test2');
    });
  });
});
