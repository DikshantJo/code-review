const fs = require('fs').promises;
const path = require('path');

/**
 * Metrics aggregator for AI Code Review system
 * Provides performance trend analysis, percentile calculations, and insights
 */
class MetricsAggregator {
  constructor(config = {}) {
    this.config = config;
    this.logDir = config.logging?.audit_log_dir || './logs/audit';
    this.cache = new Map();
    this.cacheTimeout = config.metrics?.cache_timeout || 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Calculate performance percentiles from metrics data
   * @param {Array} metricsData - Array of metrics objects
   * @param {string} metricKey - Key to calculate percentiles for
   * @returns {Object} Percentile data
   */
  calculatePercentiles(metricsData, metricKey) {
    if (!metricsData || metricsData.length === 0) {
      return {
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
      };
    }

    const values = metricsData
      .map(item => item.data[metricKey])
      .filter(value => typeof value === 'number' && !isNaN(value))
      .sort((a, b) => a - b);

    if (values.length === 0) {
      return {
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
      };
    }

    const count = values.length;
    const min = values[0];
    const max = values[count - 1];
    const mean = values.reduce((sum, val) => sum + val, 0) / count;
    const median = this.calculatePercentile(values, 50);
    const p50 = this.calculatePercentile(values, 50);
    const p75 = this.calculatePercentile(values, 75);
    const p90 = this.calculatePercentile(values, 90);
    const p95 = this.calculatePercentile(values, 95);
    const p99 = this.calculatePercentile(values, 99);

    return {
      count,
      min,
      max,
      mean: Math.round(mean * 100) / 100,
      median: Math.round(median * 100) / 100,
      p50: Math.round(p50 * 100) / 100,
      p75: Math.round(p75 * 100) / 100,
      p90: Math.round(p90 * 100) / 100,
      p95: Math.round(p95 * 100) / 100,
      p99: Math.round(p99 * 100) / 100
    };
  }

  /**
   * Calculate percentile value
   * @param {Array} sortedValues - Sorted array of values
   * @param {number} percentile - Percentile to calculate (0-100)
   * @returns {number} Percentile value
   */
  calculatePercentile(sortedValues, percentile) {
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lowerIndex = Math.floor(index);
    const upperIndex = Math.ceil(index);
    
    if (lowerIndex === upperIndex) {
      return sortedValues[lowerIndex];
    }
    
    const weight = index - lowerIndex;
    return sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight;
  }

  /**
   * Generate comprehensive performance report
   * @param {Object} options - Report options
   * @returns {Promise<Object>} Performance report
   */
  async generatePerformanceReport(options = {}) {
    const {
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      endDate = new Date(),
      model = null,
      environment = null
    } = options;

    const cacheKey = `performance_${startDate.getTime()}_${endDate.getTime()}_${model}_${environment}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      const metricsData = await this.loadMetricsData(startDate, endDate, model, environment);
      
      const report = {
        generatedAt: new Date().toISOString(),
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        summary: {
          totalReviews: metricsData.length,
          successfulReviews: metricsData.filter(m => !m.data.fallback_used).length,
          failedReviews: metricsData.filter(m => m.data.fallback_used).length,
          successRate: 0
        },
        performance: {
          responseTime: this.calculatePercentiles(metricsData, 'response_time_ms'),
          tokensUsed: this.calculatePercentiles(metricsData, 'tokens_used'),
          qualityScore: this.calculatePercentiles(metricsData, 'quality_score'),
          efficiencyScore: this.calculatePercentiles(metricsData, 'efficiency_score'),
          costEstimate: this.calculatePercentiles(metricsData, 'cost_estimate_usd')
        },
        trends: await this.calculateTrends(metricsData),
        insights: this.generateInsights(metricsData),
        recommendations: this.generateRecommendations(metricsData)
      };

      // Calculate success rate
      if (report.summary.totalReviews > 0) {
        report.summary.successRate = Math.round(
          (report.summary.successfulReviews / report.summary.totalReviews) * 100
        );
      }

      // Cache the result
      this.cache.set(cacheKey, {
        timestamp: Date.now(),
        data: report
      });

      return report;
    } catch (error) {
      console.error('Failed to generate performance report:', error);
      throw error;
    }
  }

  /**
   * Load metrics data from audit logs
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {string} model - Model filter
   * @param {string} environment - Environment filter
   * @returns {Promise<Array>} Metrics data
   */
  async loadMetricsData(startDate, endDate, model, environment) {
    const metricsData = [];
    
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
            
            // Filter for AI response metrics
            if (logEntry.event_type !== 'ai_response_metrics') continue;
            
            const entryDate = new Date(logEntry.timestamp);
            if (entryDate < startDate || entryDate > endDate) continue;
            
            // Apply filters
            if (model && logEntry.data.model_used !== model) continue;
            if (environment && logEntry.context.environment !== environment) continue;
            
            metricsData.push(logEntry);
          } catch (parseError) {
            console.error('Failed to parse metrics log entry:', parseError);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load metrics data:', error);
    }
    
    return metricsData;
  }

  /**
   * Calculate performance trends over time
   * @param {Array} metricsData - Metrics data
   * @returns {Promise<Object>} Trend analysis
   */
  async calculateTrends(metricsData) {
    if (metricsData.length < 2) {
      return {
        responseTime: { trend: 'insufficient_data', change: 0 },
        qualityScore: { trend: 'insufficient_data', change: 0 },
        efficiencyScore: { trend: 'insufficient_data', change: 0 },
        costEstimate: { trend: 'insufficient_data', change: 0 }
      };
    }

    // Group by day
    const dailyGroups = {};
    metricsData.forEach(metric => {
      const date = new Date(metric.timestamp).toISOString().split('T')[0];
      if (!dailyGroups[date]) {
        dailyGroups[date] = [];
      }
      dailyGroups[date].push(metric);
    });

    const dates = Object.keys(dailyGroups).sort();
    if (dates.length < 2) {
      return {
        responseTime: { trend: 'insufficient_data', change: 0 },
        qualityScore: { trend: 'insufficient_data', change: 0 },
        efficiencyScore: { trend: 'insufficient_data', change: 0 },
        costEstimate: { trend: 'insufficient_data', change: 0 }
      };
    }

    // Calculate daily averages
    const dailyAverages = {};
    dates.forEach(date => {
      const dayMetrics = dailyGroups[date];
      dailyAverages[date] = {
        responseTime: dayMetrics.reduce((sum, m) => sum + (m.data.response_time_ms || 0), 0) / dayMetrics.length,
        qualityScore: dayMetrics.reduce((sum, m) => sum + (m.data.quality_score || 0), 0) / dayMetrics.length,
        efficiencyScore: dayMetrics.reduce((sum, m) => sum + (m.data.efficiency_score || 0), 0) / dayMetrics.length,
        costEstimate: dayMetrics.reduce((sum, m) => sum + (m.data.cost_estimate_usd || 0), 0) / dayMetrics.length
      };
    });

    // Calculate trends
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    const firstAvg = dailyAverages[firstDate];
    const lastAvg = dailyAverages[lastDate];

    const calculateTrend = (first, last) => {
      if (first === 0) return { trend: 'insufficient_data', change: 0 };
      const change = ((last - first) / first) * 100;
      return {
        trend: change > 5 ? 'increasing' : change < -5 ? 'decreasing' : 'stable',
        change: Math.round(change * 100) / 100
      };
    };

    return {
      responseTime: calculateTrend(firstAvg.responseTime, lastAvg.responseTime),
      qualityScore: calculateTrend(firstAvg.qualityScore, lastAvg.qualityScore),
      efficiencyScore: calculateTrend(firstAvg.efficiencyScore, lastAvg.efficiencyScore),
      costEstimate: calculateTrend(firstAvg.costEstimate, lastAvg.costEstimate)
    };
  }

  /**
   * Generate insights from metrics data
   * @param {Array} metricsData - Metrics data
   * @returns {Array} Insights
   */
  generateInsights(metricsData) {
    const insights = [];
    
    if (metricsData.length === 0) {
      insights.push('No metrics data available for analysis');
      return insights;
    }

    // Performance insights
    const responseTimes = metricsData.map(m => m.data.response_time_ms).filter(t => t > 0);
    const avgResponseTime = responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length;
    
    if (avgResponseTime > 30000) {
      insights.push('Average response time is high (>30s). Consider optimizing review content or using faster models.');
    }

    // Quality insights
    const qualityScores = metricsData.map(m => m.data.quality_score).filter(q => q > 0);
    const avgQualityScore = qualityScores.reduce((sum, q) => sum + q, 0) / qualityScores.length;
    
    if (avgQualityScore < 0.7) {
      insights.push('Average quality score is low (<0.7). Review code quality standards and AI prompt effectiveness.');
    }

    // Cost insights
    const costs = metricsData.map(m => m.data.cost_estimate_usd).filter(c => c > 0);
    const totalCost = costs.reduce((sum, c) => sum + c, 0);
    const avgCost = costs.reduce((sum, c) => sum + c, 0) / costs.length;
    
    if (totalCost > 100) {
      insights.push(`Total cost is high ($${totalCost.toFixed(2)}). Consider optimizing token usage or using cost-effective models.`);
    }

    // Efficiency insights
    const efficiencyScores = metricsData.map(m => m.data.efficiency_score).filter(e => e > 0);
    const avgEfficiency = efficiencyScores.reduce((sum, e) => sum + e, 0) / efficiencyScores.length;
    
    if (avgEfficiency < 0.6) {
      insights.push('Average efficiency score is low (<0.6). Review AI configuration and response processing.');
    }

    // Error insights
    const failedReviews = metricsData.filter(m => m.data.fallback_used);
    const failureRate = (failedReviews.length / metricsData.length) * 100;
    
    if (failureRate > 10) {
      insights.push(`High failure rate (${failureRate.toFixed(1)}%). Review AI service reliability and fallback strategies.`);
    }

    return insights;
  }

  /**
   * Generate recommendations based on metrics
   * @param {Array} metricsData - Metrics data
   * @returns {Array} Recommendations
   */
  generateRecommendations(metricsData) {
    const recommendations = [];
    
    if (metricsData.length === 0) {
      recommendations.push('Collect more metrics data to generate meaningful recommendations');
      return recommendations;
    }

    // Performance recommendations
    const slowReviews = metricsData.filter(m => m.data.response_time_ms > 30000);
    if (slowReviews.length > metricsData.length * 0.2) {
      recommendations.push('Consider implementing commit size limits to reduce review time');
      recommendations.push('Evaluate using faster AI models for large code reviews');
    }

    // Quality recommendations
    const lowQualityReviews = metricsData.filter(m => m.data.quality_score < 0.7);
    if (lowQualityReviews.length > metricsData.length * 0.3) {
      recommendations.push('Review and improve AI prompt engineering for better code analysis');
      recommendations.push('Consider implementing stricter code quality gates');
    }

    // Cost recommendations
    const expensiveReviews = metricsData.filter(m => m.data.cost_estimate_usd > 1);
    if (expensiveReviews.length > metricsData.length * 0.1) {
      recommendations.push('Implement token usage limits to control costs');
      recommendations.push('Consider using more cost-effective AI models for initial reviews');
    }

    // Model recommendations
    const models = [...new Set(metricsData.map(m => m.data.model_used))];
    if (models.length > 1) {
      recommendations.push('Standardize on a single AI model for consistent results');
    }

    return recommendations;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      timeout: this.cacheTimeout,
      entries: Array.from(this.cache.keys())
    };
  }
}

module.exports = MetricsAggregator;



