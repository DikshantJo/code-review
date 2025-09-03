/**
 * Quality Metrics Dashboard
 * Provides real-time visibility into code quality metrics and quality gate results
 */

const fs = require('fs');
const path = require('path');

class QualityMetricsDashboard {
  constructor(config = {}) {
    this.config = {
      // Dashboard configuration
      refreshInterval: config.refreshInterval || 30000, // 30 seconds
      maxHistorySize: config.maxHistorySize || 100,
      exportFormats: config.exportFormats || ['json', 'csv', 'html'],
      
      // Metrics configuration
      enableTrends: config.enableTrends !== false,
      enableAlerts: config.enableAlerts !== false,
      alertThresholds: {
        coverage: config.alertThresholds?.coverage || 75,
        performance: config.alertThresholds?.performance || 70,
        security: config.alertThresholds?.security || 90
      },
      
      // Display configuration
      showTrends: config.showTrends !== false,
      showComparisons: config.showComparisons !== false,
      showRecommendations: config.showRecommendations !== false,
      
      ...config
    };
    
    this.metricsHistory = [];
    this.currentMetrics = null;
    this.alerts = [];
    this.dashboardData = {
      lastUpdated: null,
      summary: {},
      trends: {},
      comparisons: {},
      recommendations: []
    };
    
    this.refreshTimer = null;
    this.startAutoRefresh();
  }

  /**
   * Start automatic refresh of dashboard data
   */
  startAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    
    this.refreshTimer = setInterval(() => {
      this.refreshDashboard();
    }, this.config.refreshInterval);
    
    console.log(`🔄 Quality metrics dashboard auto-refresh started (${this.config.refreshInterval}ms)`);
  }

  /**
   * Stop automatic refresh
   */
  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
      console.log('⏹️ Quality metrics dashboard auto-refresh stopped');
    }
  }

  /**
   * Update dashboard with new quality gate results
   */
  async updateDashboard(qualityGateResults) {
    try {
      const timestamp = new Date();
      
      // Store in history
      this.metricsHistory.push({
        timestamp,
        results: qualityGateResults,
        summary: this.calculateSummary(qualityGateResults)
      });
      
      // Limit history size
      if (this.metricsHistory.length > this.config.maxHistorySize) {
        this.metricsHistory.shift();
      }
      
      // Update current metrics
      this.currentMetrics = qualityGateResults;
      
      // Update dashboard data
      await this.refreshDashboard();
      
      // Check for alerts
      if (this.config.enableAlerts) {
        await this.checkAlerts(qualityGateResults);
      }
      
      console.log(`📊 Dashboard updated with new quality gate results for session: ${qualityGateResults.sessionId}`);
      
      return true;
      
    } catch (error) {
      console.error(`❌ Dashboard update failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Refresh dashboard data
   */
  async refreshDashboard() {
    try {
      const timestamp = new Date();
      
      // Update summary
      this.dashboardData.summary = this.calculateOverallSummary();
      
      // Update trends if enabled
      if (this.config.enableTrends) {
        this.dashboardData.trends = this.calculateTrends();
      }
      
      // Update comparisons if enabled
      if (this.config.showComparisons) {
        this.dashboardData.comparisons = this.calculateComparisons();
      }
      
      // Update recommendations
      this.dashboardData.recommendations = this.generateRecommendations();
      
      // Update last updated timestamp
      this.dashboardData.lastUpdated = timestamp;
      
      console.log(`🔄 Dashboard refreshed at ${timestamp.toISOString()}`);
      
    } catch (error) {
      console.error(`❌ Dashboard refresh failed: ${error.message}`);
    }
  }

  /**
   * Calculate summary from quality gate results
   */
  calculateSummary(qualityGateResults) {
    const { gates, overall } = qualityGateResults;
    
    return {
      sessionId: qualityGateResults.sessionId,
      timestamp: qualityGateResults.timestamp,
      overallScore: overall.score,
      overallPassed: overall.passed,
      gateResults: {
        coverage: {
          passed: gates.coverage.passed,
          score: gates.coverage.score,
          details: gates.coverage.details
        },
        testResults: {
          passed: gates.testResults.passed,
          score: gates.testResults.score,
          details: gates.testResults.details
        },
        performance: {
          passed: gates.performance.passed,
          score: gates.performance.score,
          details: gates.performance.details
        },
        security: {
          passed: gates.security.passed,
          score: gates.security.score,
          details: gates.security.details
        },
        codeQuality: {
          passed: gates.codeQuality.passed,
          score: gates.codeQuality.score,
          details: gates.codeQuality.details
        }
      },
      metrics: {
        totalGates: Object.keys(gates).length,
        passedGates: Object.values(gates).filter(gate => gate.passed).length,
        failedGates: Object.values(gates).filter(gate => !gate.passed).length,
        averageScore: Math.round(
          Object.values(gates).reduce((sum, gate) => sum + gate.score, 0) / Object.keys(gates).length
        )
      }
    };
  }

  /**
   * Calculate overall summary across all sessions
   */
  calculateOverallSummary() {
    if (this.metricsHistory.length === 0) {
      return {
        totalSessions: 0,
        averageScore: 0,
        successRate: 0,
        trend: 'stable'
      };
    }
    
    const totalSessions = this.metricsHistory.length;
    const successfulSessions = this.metricsHistory.filter(m => m.summary.overallPassed).length;
    const averageScore = Math.round(
      this.metricsHistory.reduce((sum, m) => sum + m.summary.overallScore, 0) / totalSessions
    );
    
    // Calculate trend
    let trend = 'stable';
    if (this.metricsHistory.length >= 2) {
      const recentScores = this.metricsHistory.slice(-5).map(m => m.summary.overallScore);
      const firstHalf = recentScores.slice(0, Math.ceil(recentScores.length / 2));
      const secondHalf = recentScores.slice(Math.ceil(recentScores.length / 2));
      
      const firstAvg = firstHalf.reduce((sum, score) => sum + score, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, score) => sum + score, 0) / secondHalf.length;
      
      if (secondAvg > firstAvg + 5) trend = 'improving';
      else if (secondAvg < firstAvg - 5) trend = 'declining';
    }
    
    return {
      totalSessions,
      successfulSessions,
      failedSessions: totalSessions - successfulSessions,
      successRate: Math.round((successfulSessions / totalSessions) * 100),
      averageScore,
      trend,
      lastSession: this.metricsHistory[this.metricsHistory.length - 1]?.summary.sessionId || null
    };
  }

  /**
   * Calculate trends over time
   */
  calculateTrends() {
    if (this.metricsHistory.length < 2) {
      return {
        scoreTrend: 'insufficient_data',
        coverageTrend: 'insufficient_data',
        performanceTrend: 'insufficient_data',
        securityTrend: 'insufficient_data'
      };
    }
    
    const trends = {};
    const metrics = ['overallScore', 'coverage', 'performance', 'security'];
    
    metrics.forEach(metric => {
      const values = this.metricsHistory.map(m => {
        if (metric === 'overallScore') return m.summary.overallScore;
        return m.summary.gateResults[metric]?.score || 0;
      });
      
      trends[`${metric}Trend`] = this.calculateTrend(values);
    });
    
    return trends;
  }

  /**
   * Calculate trend for a series of values
   */
  calculateTrend(values) {
    if (values.length < 2) return 'insufficient_data';
    
    const firstHalf = values.slice(0, Math.ceil(values.length / 2));
    const secondHalf = values.slice(Math.ceil(values.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    
    if (secondAvg > firstAvg + 3) return 'improving';
    if (secondAvg < firstAvg - 3) return 'declining';
    return 'stable';
  }

  /**
   * Calculate comparisons between different metrics
   */
  calculateComparisons() {
    if (this.metricsHistory.length === 0) return {};
    
    const latest = this.metricsHistory[this.metricsHistory.length - 1];
    const { gateResults } = latest.summary;
    
    return {
      coverageVsPerformance: {
        coverage: gateResults.coverage.score,
        performance: gateResults.performance.score,
        difference: gateResults.coverage.score - gateResults.performance.score,
        status: gateResults.coverage.score > gateResults.performance.score ? 'coverage_higher' : 'performance_higher'
      },
      securityVsQuality: {
        security: gateResults.security.score,
        quality: gateResults.codeQuality.score,
        difference: gateResults.security.score - gateResults.codeQuality.score,
        status: gateResults.security.score > gateResults.codeQuality.score ? 'security_higher' : 'quality_higher'
      },
      testResultsVsOverall: {
        testResults: gateResults.testResults.score,
        overall: latest.summary.overallScore,
        difference: gateResults.testResults.score - latest.summary.overallScore,
        status: gateResults.testResults.score > latest.summary.overallScore ? 'tests_higher' : 'overall_higher'
      }
    };
  }

  /**
   * Generate recommendations based on current metrics
   */
  generateRecommendations() {
    if (!this.currentMetrics) return [];
    
    const recommendations = [];
    const { gates } = this.currentMetrics;
    
    // Coverage recommendations
    if (gates.coverage.score < 80) {
      recommendations.push({
        category: 'coverage',
        priority: 'high',
        message: 'Increase test coverage to meet quality standards',
        action: 'Add more unit and integration tests',
        impact: 'Improves code reliability and reduces bugs'
      });
    }
    
    // Performance recommendations
    if (gates.performance.score < 80) {
      recommendations.push({
        category: 'performance',
        priority: 'medium',
        message: 'Optimize code performance',
        action: 'Review and optimize slow operations',
        impact: 'Improves user experience and system efficiency'
      });
    }
    
    // Security recommendations
    if (gates.security.score < 90) {
      recommendations.push({
        category: 'security',
        priority: 'critical',
        message: 'Address security vulnerabilities immediately',
        action: 'Run security audit and fix identified issues',
        impact: 'Protects against security breaches'
      });
    }
    
    // Code quality recommendations
    if (gates.codeQuality.score < 85) {
      recommendations.push({
        category: 'code_quality',
        priority: 'medium',
        message: 'Improve code quality standards',
        action: 'Fix linting errors and improve code formatting',
        impact: 'Enhances maintainability and readability'
      });
    }
    
    // Overall improvement recommendations
    if (this.currentMetrics.overall.score < 80) {
      recommendations.push({
        category: 'overall',
        priority: 'high',
        message: 'Overall quality needs improvement',
        action: 'Focus on failing quality gates first',
        impact: 'Ensures code meets deployment standards'
      });
    }
    
    return recommendations;
  }

  /**
   * Check for alerts based on thresholds
   */
  async checkAlerts(qualityGateResults) {
    const alerts = [];
    const { gates, overall } = qualityGateResults;
    
    // Coverage alerts
    if (gates.coverage.score < this.config.alertThresholds.coverage) {
      alerts.push({
        type: 'coverage',
        severity: 'warning',
        message: `Coverage (${gates.coverage.score}%) below threshold (${this.config.alertThresholds.coverage}%)`,
        sessionId: qualityGateResults.sessionId,
        timestamp: new Date().toISOString()
      });
    }
    
    // Performance alerts
    if (gates.performance.score < this.config.alertThresholds.performance) {
      alerts.push({
        type: 'performance',
        severity: 'warning',
        message: `Performance score (${gates.performance.score}) below threshold (${this.config.alertThresholds.performance})`,
        sessionId: qualityGateResults.sessionId,
        timestamp: new Date().toISOString()
      });
    }
    
    // Security alerts
    if (gates.security.score < this.config.alertThresholds.security) {
      alerts.push({
        type: 'security',
        severity: 'critical',
        message: `Security score (${gates.security.score}) below threshold (${this.config.alertThresholds.security})`,
        sessionId: qualityGateResults.sessionId,
        timestamp: new Date().toISOString()
      });
    }
    
    // Overall failure alerts
    if (!overall.passed) {
      alerts.push({
        type: 'overall',
        severity: 'critical',
        message: 'Quality gates failed - deployment blocked',
        sessionId: qualityGateResults.sessionId,
        timestamp: new Date().toISOString()
      });
    }
    
    // Add new alerts
    this.alerts.push(...alerts);
    
    // Limit alert history
    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(-50);
    }
    
    // Log alerts
    alerts.forEach(alert => {
      const emoji = alert.severity === 'critical' ? '🚨' : '⚠️';
      console.log(`${emoji} ALERT: ${alert.message}`);
    });
    
    return alerts;
  }

  /**
   * Get current dashboard data
   */
  getDashboardData() {
    return {
      ...this.dashboardData,
      currentMetrics: this.currentMetrics,
      alerts: this.alerts.slice(-10), // Last 10 alerts
      metricsHistory: this.metricsHistory.slice(-20) // Last 20 metrics
    };
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(limit = null) {
    if (!limit) return this.metricsHistory;
    return this.metricsHistory.slice(-limit);
  }

  /**
   * Get alerts
   */
  getAlerts(severity = null, limit = null) {
    let filteredAlerts = this.alerts;
    
    if (severity) {
      filteredAlerts = filteredAlerts.filter(alert => alert.severity === severity);
    }
    
    if (limit) {
      filteredAlerts = filteredAlerts.slice(-limit);
    }
    
    return filteredAlerts;
  }

  /**
   * Export dashboard data
   */
  async exportDashboard(format = 'json', filePath = null) {
    try {
      const data = this.getDashboardData();
      let exportData;
      
      switch (format.toLowerCase()) {
        case 'json':
          exportData = JSON.stringify(data, null, 2);
          break;
          
        case 'csv':
          exportData = this.convertToCSV(data);
          break;
          
        case 'html':
          exportData = this.convertToHTML(data);
          break;
          
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
      
      if (filePath) {
        await fs.promises.writeFile(filePath, exportData);
        console.log(`📁 Dashboard exported to: ${filePath}`);
        return filePath;
      }
      
      return exportData;
      
    } catch (error) {
      console.error(`Export failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Convert dashboard data to CSV
   */
  convertToCSV(data) {
    const csvRows = [];
    
    // Summary row
    csvRows.push('Metric,Value');
    csvRows.push(`Total Sessions,${data.summary.totalSessions}`);
    csvRows.push(`Success Rate,${data.summary.successRate}%`);
    csvRows.push(`Average Score,${data.summary.averageScore}`);
    csvRows.push(`Trend,${data.summary.trend}`);
    
    // Current metrics
    if (data.currentMetrics) {
      csvRows.push('');
      csvRows.push('Gate,Score,Passed,Details');
      Object.entries(data.currentMetrics.gates).forEach(([gateName, gate]) => {
        csvRows.push(`${gateName},${gate.score},${gate.passed},${gate.details.join('; ')}`);
      });
    }
    
    return csvRows.join('\n');
  }

  /**
   * Convert dashboard data to HTML
   */
  convertToHTML(data) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Quality Metrics Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .metric { margin: 10px 0; padding: 10px; border: 1px solid #ddd; }
        .success { background-color: #d4edda; }
        .warning { background-color: #fff3cd; }
        .danger { background-color: #f8d7da; }
        .trend { font-weight: bold; }
    </style>
</head>
<body>
    <h1>Quality Metrics Dashboard</h1>
    <p>Last Updated: ${data.lastUpdated || 'Never'}</p>
    
    <h2>Summary</h2>
    <div class="metric">
        <strong>Total Sessions:</strong> ${data.summary.totalSessions}<br>
        <strong>Success Rate:</strong> ${data.summary.successRate}%<br>
        <strong>Average Score:</strong> ${data.summary.averageScore}<br>
        <strong>Trend:</strong> <span class="trend">${data.summary.trend}</span>
    </div>
    
    <h2>Current Metrics</h2>
    ${data.currentMetrics ? Object.entries(data.currentMetrics.gates).map(([gateName, gate]) => `
        <div class="metric ${gate.passed ? 'success' : 'danger'}">
            <strong>${gateName}:</strong> ${gate.score}/100 (${gate.passed ? 'PASSED' : 'FAILED'})<br>
            <strong>Details:</strong> ${gate.details.join(', ')}
        </div>
    `).join('') : '<p>No current metrics available</p>'}
    
    <h2>Recommendations</h2>
    ${data.recommendations.map(rec => `
        <div class="metric warning">
            <strong>${rec.category.toUpperCase()}:</strong> ${rec.message}<br>
            <strong>Action:</strong> ${rec.action}<br>
            <strong>Impact:</strong> ${rec.impact}
        </div>
    `).join('')}
</body>
</html>`;
  }

  /**
   * Clear dashboard data
   */
  clearDashboard() {
    this.metricsHistory = [];
    this.currentMetrics = null;
    this.alerts = [];
    this.dashboardData = {
      lastUpdated: null,
      summary: {},
      trends: {},
      comparisons: {},
      recommendations: []
    };
    
    console.log('🧹 Dashboard data cleared');
  }

  /**
   * Get dashboard configuration
   */
  getConfiguration() {
    return {
      ...this.config,
      metricsHistorySize: this.metricsHistory.length,
      alertsCount: this.alerts.length,
      autoRefreshEnabled: !!this.refreshTimer
    };
  }

  /**
   * Update dashboard configuration
   */
  updateConfiguration(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // Restart auto-refresh if interval changed
    if (newConfig.refreshInterval) {
      this.startAutoRefresh();
    }
    
    console.log('⚙️ Dashboard configuration updated');
  }
}

module.exports = QualityMetricsDashboard;
