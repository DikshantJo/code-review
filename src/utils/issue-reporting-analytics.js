/**
 * Issue Reporting and Analytics Manager
 * 
 * Comprehensive reporting and analytics system for GitHub issues,
 * providing insights into workflow performance, team productivity,
 * issue trends, and operational metrics.
 * 
 * @author AI Code Review System
 * @version 1.0.0
 * @last_updated 2024-12-19
 */

const { Octokit } = require('@octokit/rest');
const EventEmitter = require('events');

class IssueReportingAnalytics extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = config;
    this.octokit = new Octokit({
      auth: config.github?.token || process.env.GITHUB_TOKEN,
      baseUrl: config.github?.api_url || 'https://api.github.com'
    });
    
    this.repository = config.github?.repository || process.env.GITHUB_REPOSITORY;
    
    // Analytics configuration
    this.analyticsConfig = {
      enabled: config.issue_analytics?.enabled ?? true,
      auto_collect: config.issue_analytics?.auto_collect ?? true,
      retention_days: config.issue_analytics?.retention_days ?? 365,
      update_interval_ms: config.issue_analytics?.update_interval_ms ?? 3600000, // 1 hour
      metrics: config.issue_analytics?.metrics ?? {
        workflow_performance: true,
        team_productivity: true,
        issue_trends: true,
        quality_metrics: true,
        cost_analysis: true
      }
    };
    
    // Data storage
    this.issueData = new Map();
    this.workflowData = new Map();
    this.teamData = new Map();
    this.performanceMetrics = new Map();
    this.trendData = new Map();
    
    // Analytics state
    this.isCollecting = false;
    this.collectionInterval = null;
    this.lastCollection = null;
    
    // Bind methods
    this.startDataCollection = this.startDataCollection.bind(this);
    this.stopDataCollection = this.stopDataCollection.bind(this);
    this.collectIssueData = this.collectIssueData.bind(this);
    this.generateReport = this.generateReport.bind(this);
  }

  /**
   * Start automatic data collection
   */
  async startDataCollection() {
    if (this.isCollecting) {
      console.log('⚠️  Issue analytics data collection is already running');
      return;
    }
    
    console.log('🚀 Starting issue analytics data collection...');
    this.isCollecting = true;
    
    // Initial data collection
    await this.collectAllData();
    
    // Set up periodic collection
    this.collectionInterval = setInterval(async () => {
      try {
        await this.collectAllData();
      } catch (error) {
        console.error('❌ Error during data collection cycle:', error.message);
        this.emit('collection_error', error);
      }
    }, this.analyticsConfig.update_interval_ms);
    
    this.emit('collection_started');
    console.log('✅ Issue analytics data collection started successfully');
  }

  /**
   * Stop automatic data collection
   */
  stopDataCollection() {
    if (!this.isCollecting) {
      console.log('⚠️  Issue analytics data collection is not running');
      return;
    }
    
    console.log('🛑 Stopping issue analytics data collection...');
    this.isCollecting = false;
    
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
    
    this.emit('collection_stopped');
    console.log('✅ Issue analytics data collection stopped');
  }

  /**
   * Collect all analytics data
   */
  async collectAllData() {
    try {
      console.log('📊 Collecting issue analytics data...');
      
      // Collect issue data
      await this.collectIssueData();
      
      // Collect workflow data
      await this.collectWorkflowData();
      
      // Collect team data
      await this.collectTeamData();
      
      // Calculate performance metrics
      this.calculatePerformanceMetrics();
      
      // Update trend data
      this.updateTrendData();
      
      this.lastCollection = new Date();
      this.emit('data_collection_completed', { timestamp: this.lastCollection });
      
      console.log('✅ Issue analytics data collection completed');
      
    } catch (error) {
      console.error('❌ Error collecting analytics data:', error.message);
      this.emit('data_collection_error', error);
      throw error;
    }
  }

  /**
   * Collect issue data from GitHub
   */
  async collectIssueData() {
    try {
      const [owner, repo] = this.repository.split('/');
      let page = 1;
      let allIssues = [];
      
      while (true) {
        const response = await this.octokit.issues.listForRepo({
          owner,
          repo,
          state: 'all',
          per_page: 100,
          page: page
        });
        
        if (response.data.length === 0) break;
        
        allIssues = allIssues.concat(response.data);
        page++;
        
        // Rate limiting
        await this.delay(1000);
      }
      
      // Process and store issue data
      for (const issue of allIssues) {
        const issueData = this.processIssueData(issue);
        this.issueData.set(issue.number, issueData);
      }
      
      console.log(`📋 Collected data for ${allIssues.length} issues`);
      
    } catch (error) {
      console.error('❌ Error collecting issue data:', error.message);
      throw error;
    }
  }

  /**
   * Collect workflow data
   */
  async collectWorkflowData() {
    try {
      // This would integrate with the IssueResolutionWorkflow class
      // For now, we'll create sample workflow data structure
      const workflowData = {
        total_workflows: 0,
        active_workflows: 0,
        completed_workflows: 0,
        workflows_by_type: {},
        average_completion_time: 0,
        stage_performance: {}
      };
      
      this.workflowData.set('summary', workflowData);
      
    } catch (error) {
      console.error('❌ Error collecting workflow data:', error.message);
      throw error;
    }
  }

  /**
   * Collect team data
   */
  async collectTeamData() {
    try {
      const [owner, repo] = this.repository.split('/');
      
      // Get repository contributors
      const contributorsResponse = await this.octokit.repos.listContributors({
        owner,
        repo
      });
      
      const teamData = {
        contributors: contributorsResponse.data.map(c => ({
          username: c.login,
          contributions: c.contributions,
          avatar_url: c.avatar_url
        })),
        total_contributors: contributorsResponse.data.length,
        top_contributors: contributorsResponse.data
          .sort((a, b) => b.contributions - a.contributions)
          .slice(0, 10)
      };
      
      this.teamData.set('summary', teamData);
      
    } catch (error) {
      console.error('❌ Error collecting team data:', error.message);
      throw error;
    }
  }

  /**
   * Process individual issue data
   */
  processIssueData(issue) {
    const created = new Date(issue.created_at);
    const updated = new Date(issue.updated_at);
    const closed = issue.closed_at ? new Date(issue.closed_at) : null;
    
    return {
      issue_number: issue.number,
      title: issue.title,
      state: issue.state,
      labels: issue.labels?.map(l => l.name) || [],
      assignees: issue.assignees?.map(a => a.login) || [],
      milestone: issue.milestone?.title || null,
      created_at: issue.created_at,
      updated_at: issue.updated_at,
      closed_at: issue.closed_at,
      comments: issue.comments,
      reactions: issue.reactions?.total_count || 0,
      
      // Calculated metrics
      age_days: Math.floor((new Date() - created) / (1000 * 60 * 60 * 24)),
      time_to_close: closed ? Math.floor((closed - created) / (1000 * 60 * 60 * 24)) : null,
      time_since_update: Math.floor((new Date() - updated) / (1000 * 60 * 60 * 24)),
      
      // Categorization
      type: this.categorizeIssue(issue),
      priority: this.determinePriority(issue),
      complexity: this.assessComplexity(issue),
      
      // Performance indicators
      response_time: this.calculateResponseTime(issue),
      resolution_efficiency: this.calculateResolutionEfficiency(issue),
      engagement_score: this.calculateEngagementScore(issue)
    };
  }

  /**
   * Categorize issue type
   */
  categorizeIssue(issue) {
    const title = issue.title.toLowerCase();
    const labels = issue.labels?.map(l => l.name.toLowerCase()) || [];
    
    if (labels.includes('bug') || title.includes('bug') || title.includes('fix')) {
      return 'bug';
    } else if (labels.includes('feature') || title.includes('feature') || title.includes('enhancement')) {
      return 'feature';
    } else if (labels.includes('security') || title.includes('security') || title.includes('vulnerability')) {
      return 'security';
    } else if (labels.includes('documentation') || title.includes('doc') || title.includes('readme')) {
      return 'documentation';
    } else if (labels.includes('refactor') || title.includes('refactor')) {
      return 'refactor';
    } else {
      return 'other';
    }
  }

  /**
   * Determine issue priority
   */
  determinePriority(issue) {
    const labels = issue.labels?.map(l => l.name.toLowerCase()) || [];
    
    if (labels.includes('critical') || labels.includes('p0')) return 'critical';
    if (labels.includes('high') || labels.includes('p1')) return 'high';
    if (labels.includes('medium') || labels.includes('p2')) return 'medium';
    if (labels.includes('low') || labels.includes('p3')) return 'low';
    
    // Default priority based on issue type
    const type = this.categorizeIssue(issue);
    if (type === 'security') return 'high';
    if (type === 'bug') return 'medium';
    if (type === 'feature') return 'medium';
    
    return 'medium';
  }

  /**
   * Assess issue complexity
   */
  assessComplexity(issue) {
    let complexity = 1; // Base complexity
    
    // Factor in title length and description
    if (issue.title.length > 100) complexity += 1;
    if (issue.body && issue.body.length > 500) complexity += 1;
    
    // Factor in labels
    const labels = issue.labels?.map(l => l.name.toLowerCase()) || [];
    if (labels.includes('complex')) complexity += 2;
    if (labels.includes('simple')) complexity -= 1;
    
    // Factor in assignees
    if (issue.assignees && issue.assignees.length > 1) complexity += 1;
    
    // Factor in milestone
    if (issue.milestone) complexity += 1;
    
    return Math.max(1, Math.min(5, complexity)); // Scale 1-5
  }

  /**
   * Calculate response time
   */
  calculateResponseTime(issue) {
    if (!issue.assignees || issue.assignees.length === 0) {
      return null; // No assignee means no response time
    }
    
    // This would need to be enhanced with actual response data
    // For now, return a placeholder
    return {
      first_response_hours: null,
      average_response_hours: null,
      response_count: issue.comments || 0
    };
  }

  /**
   * Calculate resolution efficiency
   */
  calculateResolutionEfficiency(issue) {
    if (issue.state === 'open') {
      return null; // Not resolved yet
    }
    
    const created = new Date(issue.created_at);
    const closed = new Date(issue.closed_at);
    const resolutionTime = Math.floor((closed - created) / (1000 * 60 * 60 * 24));
    
    // Simple efficiency scoring based on resolution time
    let efficiency = 100;
    if (resolutionTime > 30) efficiency -= 30;
    if (resolutionTime > 14) efficiency -= 20;
    if (resolutionTime > 7) efficiency -= 15;
    if (resolutionTime > 3) efficiency -= 10;
    
    return Math.max(0, efficiency);
  }

  /**
   * Calculate engagement score
   */
  calculateEngagementScore(issue) {
    let score = 0;
    
    // Base score for creation
    score += 10;
    
    // Points for comments
    score += (issue.comments || 0) * 2;
    
    // Points for reactions
    score += (issue.reactions?.total_count || 0) * 1;
    
    // Points for assignees
    score += (issue.assignees?.length || 0) * 5;
    
    // Points for milestone
    if (issue.milestone) score += 10;
    
    // Points for labels
    score += (issue.labels?.length || 0) * 2;
    
    return Math.min(100, score);
  }

  /**
   * Calculate performance metrics
   */
  calculatePerformanceMetrics() {
    const metrics = {
      overall: this.calculateOverallMetrics(),
      by_type: this.calculateMetricsByType(),
      by_priority: this.calculateMetricsByPriority(),
      by_team: this.calculateMetricsByTeam(),
      trends: this.calculateTrendMetrics()
    };
    
    this.performanceMetrics.set('summary', metrics);
    return metrics;
  }

  /**
   * Calculate overall metrics
   */
  calculateOverallMetrics() {
    const issues = Array.from(this.issueData.values());
    const openIssues = issues.filter(i => i.state === 'open');
    const closedIssues = issues.filter(i => i.state === 'closed');
    
    return {
      total_issues: issues.length,
      open_issues: openIssues.length,
      closed_issues: closedIssues.length,
      closure_rate: issues.length > 0 ? (closedIssues.length / issues.length) * 100 : 0,
      average_age_days: this.calculateAverage(issues.map(i => i.age_days)),
      average_time_to_close: this.calculateAverage(closedIssues.map(i => i.time_to_close).filter(t => t !== null)),
      average_complexity: this.calculateAverage(issues.map(i => i.complexity)),
      average_engagement: this.calculateAverage(issues.map(i => i.engagement_score))
    };
  }

  /**
   * Calculate metrics by issue type
   */
  calculateMetricsByType() {
    const issues = Array.from(this.issueData.values());
    const types = ['bug', 'feature', 'security', 'documentation', 'refactor', 'other'];
    const metrics = {};
    
    for (const type of types) {
      const typeIssues = issues.filter(i => i.type === type);
      if (typeIssues.length === 0) continue;
      
      metrics[type] = {
        count: typeIssues.length,
        percentage: (typeIssues.length / issues.length) * 100,
        average_age_days: this.calculateAverage(typeIssues.map(i => i.age_days)),
        average_time_to_close: this.calculateAverage(typeIssues.filter(i => i.state === 'closed').map(i => i.time_to_close).filter(t => t !== null)),
        average_complexity: this.calculateAverage(typeIssues.map(i => i.complexity)),
        closure_rate: typeIssues.length > 0 ? (typeIssues.filter(i => i.state === 'closed').length / typeIssues.length) * 100 : 0
      };
    }
    
    return metrics;
  }

  /**
   * Calculate metrics by priority
   */
  calculateMetricsByPriority() {
    const issues = Array.from(this.issueData.values());
    const priorities = ['critical', 'high', 'medium', 'low'];
    const metrics = {};
    
    for (const priority of priorities) {
      const priorityIssues = issues.filter(i => i.priority === priority);
      if (priorityIssues.length === 0) continue;
      
      metrics[priority] = {
        count: priorityIssues.length,
        percentage: (priorityIssues.length / issues.length) * 100,
        average_age_days: this.calculateAverage(priorityIssues.map(i => i.age_days)),
        average_time_to_close: this.calculateAverage(priorityIssues.filter(i => i.state === 'closed').map(i => i.time_to_close).filter(t => t !== null)),
        open_count: priorityIssues.filter(i => i.state === 'open').length,
        overdue_count: priorityIssues.filter(i => i.state === 'open' && i.age_days > 14).length
      };
    }
    
    return metrics;
  }

  /**
   * Calculate metrics by team member
   */
  calculateMetricsByTeam() {
    const issues = Array.from(this.issueData.values());
    const teamMembers = new Set();
    
    // Collect all team members
    issues.forEach(issue => {
      issue.assignees.forEach(assignee => teamMembers.add(assignee));
    });
    
    const metrics = {};
    
    for (const member of teamMembers) {
      const memberIssues = issues.filter(i => i.assignees.includes(member));
      const openIssues = memberIssues.filter(i => i.state === 'open');
      const closedIssues = memberIssues.filter(i => i.state === 'closed');
      
      metrics[member] = {
        total_assigned: memberIssues.length,
        open_issues: openIssues.length,
        closed_issues: closedIssues.length,
        closure_rate: memberIssues.length > 0 ? (closedIssues.length / memberIssues.length) * 100 : 0,
        average_time_to_close: this.calculateAverage(closedIssues.map(i => i.time_to_close).filter(t => t !== null)),
        average_complexity: this.calculateAverage(memberIssues.map(i => i.complexity)),
        workload_score: this.calculateWorkloadScore(member, memberIssues)
      };
    }
    
    return metrics;
  }

  /**
   * Calculate trend metrics
   */
  calculateTrendMetrics() {
    const issues = Array.from(this.issueData.values());
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const sixtyDaysAgo = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000));
    
    const recentIssues = issues.filter(i => new Date(i.created_at) >= thirtyDaysAgo);
    const olderIssues = issues.filter(i => {
      const created = new Date(i.created_at);
      return created >= sixtyDaysAgo && created < thirtyDaysAgo;
    });
    
    return {
      recent_30_days: {
        total_created: recentIssues.length,
        total_closed: recentIssues.filter(i => i.state === 'closed').length,
        average_age_days: this.calculateAverage(recentIssues.map(i => i.age_days))
      },
      previous_30_days: {
        total_created: olderIssues.length,
        total_closed: olderIssues.filter(i => i.state === 'closed').length,
        average_age_days: this.calculateAverage(olderIssues.map(i => i.age_days))
      },
      trend_analysis: this.analyzeTrends(recentIssues, olderIssues)
    };
  }

  /**
   * Analyze trends between two time periods
   */
  analyzeTrends(recent, older) {
    const recentRate = recent.length / 30; // per day
    const olderRate = older.length / 30; // per day
    
    const changeRate = ((recentRate - olderRate) / olderRate) * 100;
    
    return {
      creation_rate_change: changeRate,
      trend_direction: changeRate > 0 ? 'increasing' : changeRate < 0 ? 'decreasing' : 'stable',
      velocity_change: Math.abs(changeRate)
    };
  }

  /**
   * Update trend data
   */
  updateTrendData() {
    const now = new Date();
    const dateKey = now.toISOString().split('T')[0];
    
    const dailyMetrics = {
      date: dateKey,
      total_issues: this.issueData.size,
      open_issues: Array.from(this.issueData.values()).filter(i => i.state === 'open').length,
      closed_issues: Array.from(this.issueData.values()).filter(i => i.state === 'closed').length,
      new_issues: Array.from(this.issueData.values()).filter(i => {
        const created = new Date(i.created_at);
        return created.toISOString().split('T')[0] === dateKey;
      }).length
    };
    
    this.trendData.set(dateKey, dailyMetrics);
    
    // Keep only last 90 days of trend data
    const cutoffDate = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
    for (const [key, value] of this.trendData.entries()) {
      if (new Date(key) < cutoffDate) {
        this.trendData.delete(key);
      }
    }
  }

  /**
   * Generate comprehensive report
   */
  generateReport(reportType = 'comprehensive', options = {}) {
    try {
      const report = {
        metadata: {
          generated_at: new Date().toISOString(),
          repository: this.repository,
          data_collection_timestamp: this.lastCollection,
          report_type: reportType,
          options: options
        },
        summary: this.performanceMetrics.get('summary') || {},
        details: {}
      };
      
      // Add detailed sections based on report type
      if (reportType === 'comprehensive' || reportType === 'performance') {
        report.details.performance = this.performanceMetrics.get('summary');
      }
      
      if (reportType === 'comprehensive' || reportType === 'team') {
        report.details.team = this.teamData.get('summary');
        report.details.team_metrics = this.performanceMetrics.get('summary')?.by_team || {};
      }
      
      if (reportType === 'comprehensive' || reportType === 'trends') {
        report.details.trends = this.performanceMetrics.get('summary')?.trends || {};
        report.details.trend_data = Array.from(this.trendData.values());
      }
      
      if (reportType === 'comprehensive' || reportType === 'workflows') {
        report.details.workflows = this.workflowData.get('summary');
      }
      
      return report;
      
    } catch (error) {
      console.error('❌ Error generating report:', error.message);
      throw error;
    }
  }

  /**
   * Export analytics data
   */
  exportAnalyticsData(format = 'json', reportType = 'comprehensive') {
    try {
      const report = this.generateReport(reportType);
      
      switch (format.toLowerCase()) {
        case 'json':
          return JSON.stringify(report, null, 2);
        case 'csv':
          return this.convertToCSV(report);
        case 'html':
          return this.convertToHTML(report);
        default:
          return JSON.stringify(report, null, 2);
      }
      
    } catch (error) {
      console.error('❌ Error exporting analytics data:', error.message);
      throw error;
    }
  }

  /**
   * Convert report to CSV format
   */
  convertToCSV(report) {
    const csvRows = [];
    
    // Add metadata
    csvRows.push(['Metadata', 'Value']);
    csvRows.push(['Generated At', report.metadata.generated_at]);
    csvRows.push(['Repository', report.metadata.repository]);
    csvRows.push(['Report Type', report.metadata.report_type]);
    
    // Add summary metrics
    if (report.summary.overall) {
      csvRows.push([]);
      csvRows.push(['Overall Metrics']);
      csvRows.push(['Metric', 'Value']);
      
      const overall = report.summary.overall;
      csvRows.push(['Total Issues', overall.total_issues]);
      csvRows.push(['Open Issues', overall.open_issues]);
      csvRows.push(['Closed Issues', overall.closed_issues]);
      csvRows.push(['Closure Rate', `${overall.closure_rate.toFixed(2)}%`]);
      csvRows.push(['Average Age (Days)', overall.average_age_days.toFixed(2)]);
    }
    
    return csvRows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  }

  /**
   * Convert report to HTML format
   */
  convertToHTML(report) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Issue Analytics Report - ${report.metadata.repository}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .metric { display: inline-block; margin: 10px; padding: 10px; background: #f9f9f9; border-radius: 3px; }
        .metric-value { font-size: 24px; font-weight: bold; color: #007cba; }
        .metric-label { font-size: 12px; color: #666; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Issue Analytics Report</h1>
        <p><strong>Repository:</strong> ${report.metadata.repository}</p>
        <p><strong>Generated:</strong> ${new Date(report.metadata.generated_at).toLocaleString()}</p>
        <p><strong>Report Type:</strong> ${report.metadata.report_type}</p>
    </div>
    
    ${this.generateHTMLSections(report)}
</body>
</html>`;
  }

  /**
   * Generate HTML sections for report
   */
  generateHTMLSections(report) {
    let html = '';
    
    // Overall metrics section
    if (report.summary.overall) {
      const overall = report.summary.overall;
      html += `
    <div class="section">
        <h2>Overall Metrics</h2>
        <div class="metric">
            <div class="metric-value">${overall.total_issues}</div>
            <div class="metric-label">Total Issues</div>
        </div>
        <div class="metric">
            <div class="metric-value">${overall.open_issues}</div>
            <div class="metric-label">Open Issues</div>
        </div>
        <div class="metric">
            <div class="metric-value">${overall.closed_issues}</div>
            <div class="metric-label">Closed Issues</div>
        </div>
        <div class="metric">
            <div class="metric-value">${overall.closure_rate.toFixed(1)}%</div>
            <div class="metric-label">Closure Rate</div>
        </div>
    </div>`;
    }
    
    return html;
  }

  // Helper methods

  /**
   * Calculate average of array values
   */
  calculateAverage(values) {
    const validValues = values.filter(v => v !== null && v !== undefined);
    if (validValues.length === 0) return 0;
    
    const sum = validValues.reduce((acc, val) => acc + val, 0);
    return sum / validValues.length;
  }

  /**
   * Calculate workload score for team member
   */
  calculateWorkloadScore(member, issues) {
    const openIssues = issues.filter(i => i.state === 'open');
    const totalComplexity = openIssues.reduce((sum, i) => sum + i.complexity, 0);
    
    // Simple workload scoring: higher score = higher workload
    let score = openIssues.length * 10 + totalComplexity * 5;
    
    // Normalize to 0-100 scale
    return Math.min(100, Math.max(0, score));
  }

  /**
   * Delay execution
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = IssueReportingAnalytics;


