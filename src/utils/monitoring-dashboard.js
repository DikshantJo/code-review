const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Monitoring Dashboard for AI Code Review System
 * Provides real-time metrics visualization, alerting, and performance monitoring
 */
class MonitoringDashboard {
  constructor(config = {}) {
    this.config = config;
    this.logDir = config.logging?.audit_log_dir || './logs/audit';
    this.dashboardDir = config.monitoring?.dashboard_dir || './logs/dashboard';
    this.alertConfig = config.monitoring?.alerts || {};
    this.metricsCache = new Map();
    this.alertHistory = [];
    this.dashboardData = {
      lastUpdated: new Date().toISOString(),
      metrics: {},
      alerts: [],
      health: {},
      trends: {}
    };
    
    // Initialize alert thresholds
    this.alertThresholds = {
      responseTime: this.alertConfig.response_time_threshold || 60000, // 60 seconds
      errorRate: this.alertConfig.error_rate_threshold || 0.1, // 10%
      qualityScore: this.alertConfig.quality_score_threshold || 0.6, // 60%
      costPerReview: this.alertConfig.cost_threshold || 5.0, // $5 per review
      failureRate: this.alertConfig.failure_rate_threshold || 0.05, // 5%
      reviewVolume: this.alertConfig.volume_threshold || 100 // 100 reviews per hour
    };
    
    // Initialize alert channels
    this.alertChannels = {
      email: this.alertConfig.email?.enabled || false,
      slack: this.alertConfig.slack?.enabled || false,
      github: this.alertConfig.github?.enabled || false,
      webhook: this.alertConfig.webhook?.enabled || false
    };
  }

  /**
   * Initialize dashboard directory and files
   */
  async initialize() {
    try {
      await fs.mkdir(this.dashboardDir, { recursive: true });
      await this.createDashboardFiles();
      console.log('Monitoring dashboard initialized successfully');
    } catch (error) {
      console.error('Failed to initialize monitoring dashboard:', error);
    }
  }

  /**
   * Create dashboard HTML and data files
   */
  async createDashboardFiles() {
    const dashboardHtml = this.generateDashboardHTML();
    const dashboardData = JSON.stringify(this.dashboardData, null, 2);
    
    await fs.writeFile(path.join(this.dashboardDir, 'index.html'), dashboardHtml);
    await fs.writeFile(path.join(this.dashboardDir, 'dashboard-data.json'), dashboardData);
  }

  /**
   * Generate dashboard HTML with real-time metrics
   */
  generateDashboardHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Code Review Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .dashboard {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .metric-card {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .metric-value {
            font-size: 2em;
            font-weight: bold;
            color: #333;
        }
        .metric-label {
            color: #666;
            margin-top: 5px;
        }
        .chart-container {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        .alerts-panel {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .alert-item {
            padding: 10px;
            margin: 5px 0;
            border-radius: 5px;
            border-left: 4px solid;
        }
        .alert-critical { background-color: #fee; border-left-color: #e53e3e; }
        .alert-warning { background-color: #fef5e7; border-left-color: #d69e2e; }
        .alert-info { background-color: #e6f3ff; border-left-color: #3182ce; }
        .status-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 8px;
        }
        .status-healthy { background-color: #48bb78; }
        .status-degraded { background-color: #ed8936; }
        .status-critical { background-color: #e53e3e; }
        .refresh-button {
            background: #667eea;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            margin-bottom: 20px;
        }
        .refresh-button:hover {
            background: #5a67d8;
        }
    </style>
</head>
<body>
    <div class="dashboard">
        <div class="header">
            <h1>🤖 AI Code Review Dashboard</h1>
            <p>Real-time monitoring and metrics for AI-powered code review system</p>
            <button class="refresh-button" onclick="refreshDashboard()">🔄 Refresh Data</button>
        </div>
        
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-value" id="total-reviews">-</div>
                <div class="metric-label">Total Reviews</div>
            </div>
            <div class="metric-card">
                <div class="metric-value" id="success-rate">-</div>
                <div class="metric-label">Success Rate</div>
            </div>
            <div class="metric-card">
                <div class="metric-value" id="avg-response-time">-</div>
                <div class="metric-label">Avg Response Time</div>
            </div>
            <div class="metric-card">
                <div class="metric-value" id="avg-quality-score">-</div>
                <div class="metric-label">Avg Quality Score</div>
            </div>
            <div class="metric-card">
                <div class="metric-value" id="total-cost">-</div>
                <div class="metric-label">Total Cost (USD)</div>
            </div>
            <div class="metric-card">
                <div class="metric-value" id="active-alerts">-</div>
                <div class="metric-label">Active Alerts</div>
            </div>
        </div>
        
        <div class="chart-container">
            <h3>Review Performance Trends</h3>
            <canvas id="performanceChart" width="400" height="200"></canvas>
        </div>
        
        <div class="chart-container">
            <h3>Quality Score Distribution</h3>
            <canvas id="qualityChart" width="400" height="200"></canvas>
        </div>
        
        <div class="alerts-panel">
            <h3>🚨 Active Alerts</h3>
            <div id="alerts-list"></div>
        </div>
    </div>

    <script>
        let performanceChart, qualityChart;
        
        async function refreshDashboard() {
            try {
                const response = await fetch('dashboard-data.json?t=' + Date.now());
                const data = await response.json();
                updateDashboard(data);
            } catch (error) {
                console.error('Failed to refresh dashboard:', error);
            }
        }
        
        function updateDashboard(data) {
            // Update metrics
            document.getElementById('total-reviews').textContent = data.metrics.totalReviews || 0;
            document.getElementById('success-rate').textContent = (data.metrics.successRate || 0).toFixed(1) + '%';
            document.getElementById('avg-response-time').textContent = (data.metrics.avgResponseTime || 0).toFixed(0) + 'ms';
            document.getElementById('avg-quality-score').textContent = (data.metrics.avgQualityScore || 0).toFixed(2);
            document.getElementById('total-cost').textContent = '$' + (data.metrics.totalCost || 0).toFixed(2);
            document.getElementById('active-alerts').textContent = data.alerts.length;
            
            // Update charts
            updatePerformanceChart(data.trends.performance || []);
            updateQualityChart(data.trends.quality || []);
            
            // Update alerts
            updateAlerts(data.alerts || []);
        }
        
        function updatePerformanceChart(data) {
            const ctx = document.getElementById('performanceChart').getContext('2d');
            
            if (performanceChart) {
                performanceChart.destroy();
            }
            
            performanceChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.map(d => d.timestamp),
                    datasets: [{
                        label: 'Response Time (ms)',
                        data: data.map(d => d.responseTime),
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
        
        function updateQualityChart(data) {
            const ctx = document.getElementById('qualityChart').getContext('2d');
            
            if (qualityChart) {
                qualityChart.destroy();
            }
            
            performanceChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['0.0-0.2', '0.2-0.4', '0.4-0.6', '0.6-0.8', '0.8-1.0'],
                    datasets: [{
                        label: 'Reviews',
                        data: data,
                        backgroundColor: '#48bb78'
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
        
        function updateAlerts(alerts) {
            const alertsList = document.getElementById('alerts-list');
            alertsList.innerHTML = '';
            
            if (alerts.length === 0) {
                alertsList.innerHTML = '<p>No active alerts</p>';
                return;
            }
            
            alerts.forEach(alert => {
                const alertDiv = document.createElement('div');
                alertDiv.className = \`alert-item alert-\${alert.severity}\`;
                alertDiv.innerHTML = \`
                    <strong>\${alert.title}</strong><br>
                    <small>\${alert.timestamp}</small><br>
                    \${alert.message}
                \`;
                alertsList.appendChild(alertDiv);
            });
        }
        
        // Initial load
        refreshDashboard();
        
        // Auto-refresh every 30 seconds
        setInterval(refreshDashboard, 30000);
    </script>
</body>
</html>`;
  }

  /**
   * Update dashboard with latest metrics
   */
  async updateDashboard(metrics) {
    try {
      this.dashboardData.lastUpdated = new Date().toISOString();
      this.dashboardData.metrics = metrics;
      
      // Calculate trends
      this.dashboardData.trends = await this.calculateTrends();
      
      // Check for alerts
      const alerts = await this.checkAlerts(metrics);
      this.dashboardData.alerts = alerts;
      
      // Update health status
      this.dashboardData.health = await this.getHealthStatus();
      
      // Write updated data
      await fs.writeFile(
        path.join(this.dashboardDir, 'dashboard-data.json'),
        JSON.stringify(this.dashboardData, null, 2)
      );
      
      // Send alerts if needed
      await this.sendAlerts(alerts);
      
    } catch (error) {
      console.error('Failed to update dashboard:', error);
    }
  }

  /**
   * Calculate performance trends from historical data
   */
  async calculateTrends() {
    try {
      const files = await fs.readdir(this.logDir);
      const auditFiles = files.filter(f => f.startsWith('audit-') && f.endsWith('.jsonl'));
      
      const performanceData = [];
      const qualityData = [0, 0, 0, 0, 0]; // 5 buckets for quality scores
      
      for (const file of auditFiles.slice(-10)) { // Last 10 files
        const content = await fs.readFile(path.join(this.logDir, file), 'utf8');
        const lines = content.trim().split('\n');
        
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            if (entry.event_type === 'ai_response_metrics') {
              performanceData.push({
                timestamp: entry.timestamp,
                responseTime: entry.data.response_time_ms || 0
              });
              
              const qualityScore = entry.data.quality_score || 0;
              const bucket = Math.floor(qualityScore * 5);
              if (bucket >= 0 && bucket < 5) {
                qualityData[bucket]++;
              }
            }
          } catch (e) {
            // Skip malformed entries
          }
        }
      }
      
      return {
        performance: performanceData.slice(-50), // Last 50 data points
        quality: qualityData
      };
    } catch (error) {
      console.error('Failed to calculate trends:', error);
      return { performance: [], quality: [0, 0, 0, 0, 0] };
    }
  }

  /**
   * Check metrics against alert thresholds
   */
  async checkAlerts(metrics) {
    const alerts = [];
    const now = new Date().toISOString();
    
    // Response time alert
    if (metrics.avgResponseTime > this.alertThresholds.responseTime) {
      alerts.push({
        id: crypto.randomBytes(16).toString('hex'),
        severity: 'warning',
        title: 'High Response Time',
        message: `Average response time (${metrics.avgResponseTime}ms) exceeds threshold (${this.alertThresholds.responseTime}ms)`,
        timestamp: now,
        metric: 'response_time',
        value: metrics.avgResponseTime,
        threshold: this.alertThresholds.responseTime
      });
    }
    
    // Error rate alert
    if (metrics.errorRate > this.alertThresholds.errorRate) {
      alerts.push({
        id: crypto.randomBytes(16).toString('hex'),
        severity: 'critical',
        title: 'High Error Rate',
        message: `Error rate (${(metrics.errorRate * 100).toFixed(1)}%) exceeds threshold (${(this.alertThresholds.errorRate * 100).toFixed(1)}%)`,
        timestamp: now,
        metric: 'error_rate',
        value: metrics.errorRate,
        threshold: this.alertThresholds.errorRate
      });
    }
    
    // Quality score alert
    if (metrics.avgQualityScore < this.alertThresholds.qualityScore) {
      alerts.push({
        id: crypto.randomBytes(16).toString('hex'),
        severity: 'warning',
        title: 'Low Quality Score',
        message: `Average quality score (${metrics.avgQualityScore.toFixed(2)}) below threshold (${this.alertThresholds.qualityScore})`,
        timestamp: now,
        metric: 'quality_score',
        value: metrics.avgQualityScore,
        threshold: this.alertThresholds.qualityScore
      });
    }
    
    // Cost alert
    if (metrics.totalCost > this.alertThresholds.costPerReview * metrics.totalReviews) {
      alerts.push({
        id: crypto.randomBytes(16).toString('hex'),
        severity: 'warning',
        title: 'High Cost Per Review',
        message: `Cost per review ($${(metrics.totalCost / metrics.totalReviews).toFixed(2)}) exceeds threshold ($${this.alertThresholds.costPerReview})`,
        timestamp: now,
        metric: 'cost_per_review',
        value: metrics.totalCost / metrics.totalReviews,
        threshold: this.alertThresholds.costPerReview
      });
    }
    
    // Store alert history
    this.alertHistory.push(...alerts);
    
    // Keep only last 100 alerts
    if (this.alertHistory.length > 100) {
      this.alertHistory = this.alertHistory.slice(-100);
    }
    
    return alerts;
  }

  /**
   * Get system health status
   */
  async getHealthStatus() {
    try {
      const healthChecker = require('./health-checker');
      const checker = new healthChecker(this.config);
      return await checker.getSystemHealth();
    } catch (error) {
      return {
        status: 'unknown',
        timestamp: new Date().toISOString(),
        services: {},
        summary: {
          total: 0,
          healthy: 0,
          unhealthy: 0,
          critical: 0,
          healthyCritical: 0
        }
      };
    }
  }

  /**
   * Send alerts through configured channels
   */
  async sendAlerts(alerts) {
    const newAlerts = alerts.filter(alert => 
      !this.alertHistory.slice(0, -alerts.length).some(h => h.id === alert.id)
    );
    
    if (newAlerts.length === 0) return;
    
    for (const alert of newAlerts) {
      await this.sendAlert(alert);
    }
  }

  /**
   * Send individual alert through all configured channels
   */
  async sendAlert(alert) {
    try {
      if (this.alertChannels.email) {
        await this.sendEmailAlert(alert);
      }
      
      if (this.alertChannels.slack) {
        await this.sendSlackAlert(alert);
      }
      
      if (this.alertChannels.github) {
        await this.sendGitHubAlert(alert);
      }
      
      if (this.alertChannels.webhook) {
        await this.sendWebhookAlert(alert);
      }
      
      console.log(`Alert sent: ${alert.title}`);
    } catch (error) {
      console.error('Failed to send alert:', error);
    }
  }

  /**
   * Send email alert
   */
  async sendEmailAlert(alert) {
    try {
      const emailNotifier = require('./email-notifier');
      const notifier = new emailNotifier(this.config);
      
      await notifier.sendAlert({
        subject: `[AI Review Alert] ${alert.title}`,
        body: this.formatAlertMessage(alert),
        severity: alert.severity
      });
    } catch (error) {
      console.error('Failed to send email alert:', error);
    }
  }

  /**
   * Send Slack alert
   */
  async sendSlackAlert(alert) {
    try {
      const webhookUrl = this.alertConfig.slack?.webhook_url;
      if (!webhookUrl) return;
      
      const https = require('https');
      const data = JSON.stringify({
        text: `🚨 *AI Review Alert: ${alert.title}*\n${alert.message}\n\n*Severity:* ${alert.severity.toUpperCase()}\n*Time:* ${alert.timestamp}`,
        color: alert.severity === 'critical' ? '#e53e3e' : '#ed8936'
      });
      
      const options = {
        hostname: new URL(webhookUrl).hostname,
        port: 443,
        path: new URL(webhookUrl).pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      };
      
      const req = https.request(options, (res) => {
        if (res.statusCode !== 200) {
          console.error('Slack webhook failed:', res.statusCode);
        }
      });
      
      req.on('error', (error) => {
        console.error('Slack webhook error:', error);
      });
      
      req.write(data);
      req.end();
    } catch (error) {
      console.error('Failed to send Slack alert:', error);
    }
  }

  /**
   * Send GitHub alert (create issue)
   */
  async sendGitHubAlert(alert) {
    try {
      const githubClient = require('./github-client');
      const client = new githubClient(this.config);
      
      await client.createIssue({
        title: `[Monitoring Alert] ${alert.title}`,
        body: this.formatAlertMessage(alert),
        labels: ['monitoring', 'alert', alert.severity]
      });
    } catch (error) {
      console.error('Failed to send GitHub alert:', error);
    }
  }

  /**
   * Send webhook alert
   */
  async sendWebhookAlert(alert) {
    try {
      const webhookUrl = this.alertConfig.webhook?.url;
      if (!webhookUrl) return;
      
      const https = require('https');
      const data = JSON.stringify({
        alert: alert,
        dashboard_url: `${this.config.monitoring?.dashboard_url || 'http://localhost:3000'}/dashboard`,
        timestamp: new Date().toISOString()
      });
      
      const options = {
        hostname: new URL(webhookUrl).hostname,
        port: 443,
        path: new URL(webhookUrl).pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      };
      
      const req = https.request(options, (res) => {
        if (res.statusCode !== 200) {
          console.error('Webhook failed:', res.statusCode);
        }
      });
      
      req.on('error', (error) => {
        console.error('Webhook error:', error);
      });
      
      req.write(data);
      req.end();
    } catch (error) {
      console.error('Failed to send webhook alert:', error);
    }
  }

  /**
   * Format alert message for different channels
   */
  formatAlertMessage(alert) {
    return `
🚨 AI Code Review Alert

**Title:** ${alert.title}
**Severity:** ${alert.severity.toUpperCase()}
**Time:** ${alert.timestamp}

**Message:** ${alert.message}

**Details:**
- Metric: ${alert.metric}
- Current Value: ${alert.value}
- Threshold: ${alert.threshold}

**Dashboard:** ${this.config.monitoring?.dashboard_url || 'http://localhost:3000'}/dashboard

---
This alert was generated by the AI Code Review monitoring system.
    `.trim();
  }

  /**
   * Generate monitoring report
   */
  async generateReport(startDate = null, endDate = null) {
    try {
      const metricsAggregator = require('./metrics-aggregator');
      const aggregator = new metricsAggregator(this.config);
      
      const report = {
        generated_at: new Date().toISOString(),
        period: {
          start: startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          end: endDate || new Date().toISOString()
        },
        summary: await aggregator.generatePerformanceReport(),
        alerts: this.alertHistory.filter(alert => 
          (!startDate || alert.timestamp >= startDate) &&
          (!endDate || alert.timestamp <= endDate)
        ),
        recommendations: await aggregator.generateRecommendations()
      };
      
      return report;
    } catch (error) {
      console.error('Failed to generate monitoring report:', error);
      return {
        generated_at: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Get dashboard URL
   */
  getDashboardUrl() {
    return `${this.config.monitoring?.dashboard_url || 'http://localhost:3000'}/dashboard`;
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit = 50) {
    return this.alertHistory.slice(-limit);
  }

  /**
   * Clear alert history
   */
  clearAlertHistory() {
    this.alertHistory = [];
  }

  /**
   * Update alert thresholds
   */
  updateAlertThresholds(newThresholds) {
    this.alertThresholds = { ...this.alertThresholds, ...newThresholds };
  }

  /**
   * Update alert channels
   */
  updateAlertChannels(newChannels) {
    this.alertChannels = { ...this.alertChannels, ...newChannels };
  }
}

module.exports = MonitoringDashboard;



