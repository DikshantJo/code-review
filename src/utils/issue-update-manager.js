/**
 * Issue Update Manager
 * 
 * Manages updates to existing GitHub issues including status changes,
 * content updates, label modifications, and assignment changes.
 * 
 * @author AI Code Review System
 * @version 1.0.0
 * @last_updated 2024-12-19
 */

const { Octokit } = require('@octokit/rest');

class IssueUpdateManager {
  constructor(config = {}) {
    this.config = config;
    this.octokit = new Octokit({
      auth: config.github?.token || process.env.GITHUB_TOKEN,
      baseUrl: config.github?.api_url || 'https://api.github.com'
    });
    
    this.repository = config.github?.repository || process.env.GITHUB_REPOSITORY;
    this.updateHistory = new Map();
    this.updateQueue = [];
    this.isProcessing = false;
    
    // Update configuration
    this.updateConfig = {
      enabled: config.issue_updates?.enabled ?? true,
      auto_update: config.issue_updates?.auto_update ?? false,
      batch_updates: config.issue_updates?.batch_updates ?? true,
      max_batch_size: config.issue_updates?.max_batch_size ?? 10,
      update_interval_ms: config.issue_updates?.update_interval_ms ?? 5000,
      retry_attempts: config.issue_updates?.retry_attempts ?? 3,
      retry_delay_ms: config.issue_updates?.retry_delay_ms ?? 1000,
      conflict_resolution: config.issue_updates?.conflict_resolution ?? 'merge'
    };
  }

  /**
   * Update an existing GitHub issue
   */
  async updateIssue(issueNumber, updates, options = {}) {
    try {
      console.log(`🔄 Updating issue #${issueNumber} with ${Object.keys(updates).length} updates`);
      
      // Validate issue number
      if (!issueNumber || typeof issueNumber !== 'number') {
        throw new Error('Invalid issue number provided');
      }

      // Get current issue state
      const currentIssue = await this.getIssue(issueNumber);
      if (!currentIssue) {
        throw new Error(`Issue #${issueNumber} not found`);
      }

      // Prepare update payload
      const updatePayload = this.prepareUpdatePayload(currentIssue, updates, options);
      
      // Apply updates
      const updatedIssue = await this.applyUpdates(issueNumber, updatePayload, options);
      
      // Record update history
      this.recordUpdate(issueNumber, updates, updatedIssue);
      
      // Log update success
      console.log(`✅ Successfully updated issue #${issueNumber}`);
      
      return {
        success: true,
        issue_number: issueNumber,
        updated_at: new Date().toISOString(),
        changes: this.getChangeSummary(currentIssue, updatedIssue),
        update_id: this.generateUpdateId(issueNumber)
      };
      
    } catch (error) {
      console.error(`❌ Failed to update issue #${issueNumber}:`, error.message);
      
      // Add to retry queue if retryable
      if (this.isRetryableError(error) && options.retry !== false) {
        await this.queueForRetry(issueNumber, updates, options);
      }
      
      return {
        success: false,
        issue_number: issueNumber,
        error: error.message,
        error_type: error.name,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Batch update multiple issues
   */
  async batchUpdateIssues(updates, options = {}) {
    if (!this.updateConfig.batch_updates) {
      console.log('⚠️  Batch updates disabled, processing individually');
      const results = [];
      for (const update of updates) {
        const result = await this.updateIssue(update.issue_number, update.updates, update.options);
        results.push(result);
      }
      return results;
    }

    console.log(`🔄 Processing batch update of ${updates.length} issues`);
    
    const batches = this.createBatches(updates, this.updateConfig.max_batch_size);
    const results = [];
    
    for (const batch of batches) {
      const batchResults = await Promise.allSettled(
        batch.map(update => 
          this.updateIssue(update.issue_number, update.updates, update.options)
        )
      );
      
      // Process batch results
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            success: false,
            issue_number: batch[index].issue_number,
            error: result.reason.message,
            error_type: 'BatchProcessingError',
            timestamp: new Date().toISOString()
          });
        }
      });
      
      // Rate limiting between batches
      if (batches.length > 1) {
        await this.delay(this.updateConfig.update_interval_ms);
      }
    }
    
    console.log(`✅ Batch update completed: ${results.filter(r => r.success).length}/${results.length} successful`);
    return results;
  }

  /**
   * Update issue status and workflow
   */
  async updateIssueStatus(issueNumber, newStatus, options = {}) {
    const statusUpdates = {
      state: this.mapStatusToState(newStatus),
      labels: this.getStatusLabels(newStatus),
      milestone: options.milestone || null,
      assignees: options.assignees || []
    };

    // Add status-specific updates
    if (newStatus === 'in_progress') {
      statusUpdates.labels.push('in-progress');
      if (options.assignee) {
        statusUpdates.assignees = [options.assignee];
      }
    } else if (newStatus === 'resolved') {
      statusUpdates.labels.push('resolved');
      statusUpdates.state = 'closed';
    } else if (newStatus === 'blocked') {
      statusUpdates.labels.push('blocked');
      statusUpdates.state = 'open';
    }

    return await this.updateIssue(issueNumber, statusUpdates, options);
  }

  /**
   * Update issue with review results
   */
  async updateWithReviewResults(issueNumber, reviewResults, options = {}) {
    const updates = {
      body: this.appendReviewResults(reviewResults),
      labels: this.getReviewLabels(reviewResults)
    };

    // Add severity updates
    if (reviewResults.severity) {
      updates.labels.push(`severity-${reviewResults.severity}`);
    }

    // Add file-specific updates
    if (reviewResults.files) {
      updates.body += this.formatFileUpdates(reviewResults.files);
    }

    // Add performance metrics
    if (reviewResults.metrics) {
      updates.body += this.formatMetrics(reviewResults.metrics);
    }

    return await this.updateIssue(issueNumber, updates, options);
  }

  /**
   * Update issue with additional context
   */
  async updateWithContext(issueNumber, context, options = {}) {
    const updates = {
      body: this.appendContext(context),
      labels: this.getContextLabels(context)
    };

    // Add related issues
    if (context.related_issues) {
      updates.body += this.formatRelatedIssues(context.related_issues);
    }

    // Add external references
    if (context.external_references) {
      updates.body += this.formatExternalReferences(context.external_references);
    }

    // Add timeline updates
    if (context.timeline) {
      updates.body += this.formatTimeline(context.timeline);
    }

    return await this.updateIssue(issueNumber, updates, options);
  }

  /**
   * Merge updates from multiple sources
   */
  async mergeUpdates(issueNumber, updateSources, options = {}) {
    console.log(`🔄 Merging updates from ${updateSources.length} sources for issue #${issueNumber}`);
    
    // Get current issue
    const currentIssue = await this.getIssue(issueNumber);
    if (!currentIssue) {
      throw new Error(`Issue #${issueNumber} not found`);
    }

    // Merge all updates
    const mergedUpdates = this.mergeUpdateSources(currentIssue, updateSources);
    
    // Apply merged updates
    return await this.updateIssue(issueNumber, mergedUpdates, options);
  }

  /**
   * Sync issue with external systems
   */
  async syncWithExternalSystem(issueNumber, externalSystem, options = {}) {
    console.log(`🔄 Syncing issue #${issueNumber} with ${externalSystem.name}`);
    
    try {
      // Get external system data
      const externalData = await this.fetchExternalData(externalSystem, issueNumber);
      
      // Map external data to issue updates
      const updates = this.mapExternalDataToUpdates(externalData, externalSystem);
      
      // Apply updates
      const result = await this.updateIssue(issueNumber, updates, options);
      
      // Update sync status
      await this.updateSyncStatus(issueNumber, externalSystem, 'success');
      
      return result;
      
    } catch (error) {
      console.error(`❌ Failed to sync issue #${issueNumber} with ${externalSystem.name}:`, error.message);
      
      // Update sync status
      await this.updateSyncStatus(issueNumber, externalSystem, 'failed', error.message);
      
      throw error;
    }
  }

  /**
   * Get issue update history
   */
  getUpdateHistory(issueNumber) {
    return this.updateHistory.get(issueNumber) || [];
  }

  /**
   * Get update statistics
   */
  getUpdateStats() {
    const stats = {
      total_updates: 0,
      successful_updates: 0,
      failed_updates: 0,
      pending_updates: this.updateQueue.length,
      last_update: null,
      update_frequency: 0
    };

    for (const [issueNumber, history] of this.updateHistory) {
      stats.total_updates += history.length;
      stats.successful_updates += history.filter(u => u.success).length;
      stats.failed_updates += history.filter(u => !u.success).length;
      
      if (history.length > 0) {
        const lastUpdate = history[history.length - 1];
        if (!stats.last_update || new Date(lastUpdate.timestamp) > new Date(stats.last_update)) {
          stats.last_update = lastUpdate.timestamp;
        }
      }
    }

    // Calculate update frequency (updates per hour)
    if (stats.last_update) {
      const hoursSinceLastUpdate = (Date.now() - new Date(stats.last_update).getTime()) / (1000 * 60 * 60);
      stats.update_frequency = hoursSinceLastUpdate > 0 ? stats.total_updates / hoursSinceLastUpdate : 0;
    }

    return stats;
  }

  /**
   * Clear update history
   */
  clearUpdateHistory(issueNumber = null) {
    if (issueNumber) {
      this.updateHistory.delete(issueNumber);
    } else {
      this.updateHistory.clear();
    }
  }

  // Private helper methods

  /**
   * Get issue from GitHub
   */
  async getIssue(issueNumber) {
    try {
      const [owner, repo] = this.repository.split('/');
      const response = await this.octokit.issues.get({
        owner,
        repo,
        issue_number: issueNumber
      });
      return response.data;
    } catch (error) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Prepare update payload
   */
  prepareUpdatePayload(currentIssue, updates, options) {
    const payload = {};
    
    // Handle title updates
    if (updates.title && updates.title !== currentIssue.title) {
      payload.title = updates.title;
    }
    
    // Handle body updates
    if (updates.body) {
      if (options.append_body) {
        payload.body = currentIssue.body + '\n\n' + updates.body;
      } else if (options.prepend_body) {
        payload.body = updates.body + '\n\n' + currentIssue.body;
      } else {
        payload.body = updates.body;
      }
    }
    
    // Handle state updates
    if (updates.state && updates.state !== currentIssue.state) {
      payload.state = updates.state;
    }
    
    // Handle label updates
    if (updates.labels) {
      payload.labels = this.mergeLabels(currentIssue.labels, updates.labels, options.label_strategy);
    }
    
    // Handle assignee updates
    if (updates.assignees) {
      payload.assignees = updates.assignees;
    }
    
    // Handle milestone updates
    if (updates.milestone !== undefined) {
      payload.milestone = updates.milestone;
    }
    
    return payload;
  }

  /**
   * Apply updates to GitHub issue
   */
  async applyUpdates(issueNumber, payload, options) {
    const [owner, repo] = this.repository.split('/');
    
    const response = await this.octokit.issues.update({
      owner,
      repo,
      issue_number: issueNumber,
      ...payload
    });
    
    return response.data;
  }

  /**
   * Record update in history
   */
  recordUpdate(issueNumber, updates, result) {
    if (!this.updateHistory.has(issueNumber)) {
      this.updateHistory.set(issueNumber, []);
    }
    
    const history = this.updateHistory.get(issueNumber);
    history.push({
      timestamp: new Date().toISOString(),
      updates: updates,
      result: result,
      success: true
    });
    
    // Keep only last 100 updates per issue
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
  }

  /**
   * Generate unique update ID
   */
  generateUpdateId(issueNumber) {
    return `update_${issueNumber}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get change summary
   */
  getChangeSummary(before, after) {
    const changes = [];
    
    if (before.title !== after.title) {
      changes.push(`Title: "${before.title}" → "${after.title}"`);
    }
    
    if (before.state !== after.state) {
      changes.push(`State: ${before.state} → ${after.state}`);
    }
    
    if (before.labels.length !== after.labels.length) {
      changes.push(`Labels: ${before.labels.length} → ${after.labels.length}`);
    }
    
    if (before.assignees.length !== after.assignees.length) {
      changes.push(`Assignees: ${before.assignees.length} → ${after.assignees.length}`);
    }
    
    if (before.milestone?.id !== after.milestone?.id) {
      changes.push(`Milestone: ${before.milestone?.title || 'None'} → ${after.milestone?.title || 'None'}`);
    }
    
    return changes;
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error) {
    const retryableStatuses = [408, 429, 500, 502, 503, 504];
    return retryableStatuses.includes(error.status) || 
           error.message.includes('rate limit') ||
           error.message.includes('timeout');
  }

  /**
   * Queue update for retry
   */
  async queueForRetry(issueNumber, updates, options) {
    const retryEntry = {
      issue_number: issueNumber,
      updates: updates,
      options: options,
      attempts: 0,
      max_attempts: options.max_retries || this.updateConfig.retry_attempts,
      next_retry: Date.now() + this.updateConfig.retry_delay_ms
    };
    
    this.updateQueue.push(retryEntry);
    console.log(`⏳ Queued issue #${issueNumber} for retry`);
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.processRetryQueue();
    }
  }

  /**
   * Process retry queue
   */
  async processRetryQueue() {
    if (this.isProcessing || this.updateQueue.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    console.log(`🔄 Processing retry queue with ${this.updateQueue.length} items`);
    
    while (this.updateQueue.length > 0) {
      const entry = this.updateQueue.shift();
      
      // Check if ready for retry
      if (Date.now() < entry.next_retry) {
        // Put back in queue
        this.updateQueue.push(entry);
        continue;
      }
      
      // Attempt retry
      try {
        entry.attempts++;
        const result = await this.updateIssue(entry.issue_number, entry.updates, entry.options);
        
        if (result.success) {
          console.log(`✅ Retry successful for issue #${entry.issue_number}`);
        } else {
          // Check if should retry again
          if (entry.attempts < entry.max_attempts) {
            entry.next_retry = Date.now() + (this.updateConfig.retry_delay_ms * entry.attempts);
            this.updateQueue.push(entry);
          } else {
            console.error(`❌ Max retries exceeded for issue #${entry.issue_number}`);
          }
        }
        
      } catch (error) {
        console.error(`❌ Retry failed for issue #${entry.issue_number}:`, error.message);
        
        // Check if should retry again
        if (entry.attempts < entry.max_attempts) {
          entry.next_retry = Date.now() + (this.updateConfig.retry_delay_ms * entry.attempts);
          this.updateQueue.push(entry);
        }
      }
      
      // Rate limiting between retries
      await this.delay(1000);
    }
    
    this.isProcessing = false;
    console.log('✅ Retry queue processing completed');
  }

  /**
   * Create batches for processing
   */
  createBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Delay execution
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Map status to GitHub state
   */
  mapStatusToState(status) {
    const statusMap = {
      'open': 'open',
      'closed': 'closed',
      'in_progress': 'open',
      'resolved': 'closed',
      'blocked': 'open',
      'pending': 'open',
      'cancelled': 'closed'
    };
    return statusMap[status] || 'open';
  }

  /**
   * Get status-specific labels
   */
  getStatusLabels(status) {
    const labelMap = {
      'in_progress': ['in-progress', 'active'],
      'resolved': ['resolved', 'completed'],
      'blocked': ['blocked', 'waiting'],
      'pending': ['pending', 'waiting'],
      'cancelled': ['cancelled', 'closed']
    };
    return labelMap[status] || [];
  }

  /**
   * Get review-specific labels
   */
  getReviewLabels(reviewResults) {
    const labels = [];
    
    if (reviewResults.score < 0.5) {
      labels.push('critical-review');
    } else if (reviewResults.score < 0.7) {
      labels.push('review-needed');
    }
    
    if (reviewResults.issues_count > 10) {
      labels.push('high-issues');
    }
    
    return labels;
  }

  /**
   * Get context-specific labels
   */
  getContextLabels(context) {
    const labels = [];
    
    if (context.priority) {
      labels.push(`priority-${context.priority}`);
    }
    
    if (context.category) {
      labels.push(`category-${context.category}`);
    }
    
    if (context.urgency) {
      labels.push(`urgency-${context.urgency}`);
    }
    
    return labels;
  }

  /**
   * Merge labels based on strategy
   */
  mergeLabels(currentLabels, newLabels, strategy = 'append') {
    const current = currentLabels.map(l => l.name);
    
    switch (strategy) {
      case 'replace':
        return newLabels;
      case 'append':
        return [...current, ...newLabels];
      case 'merge':
        return [...new Set([...current, ...newLabels])];
      case 'intersect':
        return newLabels.filter(l => current.includes(l));
      default:
        return [...current, ...newLabels];
    }
  }

  /**
   * Append review results to issue body
   */
  appendReviewResults(reviewResults) {
    return `
## 📊 Review Results Update

**Review Score:** ${reviewResults.score || 'N/A'}
**Issues Found:** ${reviewResults.issues_count || 0}
**Critical Issues:** ${reviewResults.critical_issues || 0}
**High Issues:** ${reviewResults.high_issues || 0}
**Medium Issues:** ${reviewResults.medium_issues || 0}
**Low Issues:** ${reviewResults.low_issues || 0}

**Last Updated:** ${new Date().toISOString()}
`;
  }

  /**
   * Append context to issue body
   */
  appendContext(context) {
    return `
## 🔍 Additional Context

**Priority:** ${context.priority || 'Not specified'}
**Category:** ${context.category || 'Not specified'}
**Urgency:** ${context.urgency || 'Not specified'}

**Description:** ${context.description || 'No additional description provided'}

**Last Updated:** ${new Date().toISOString()}
`;
  }

  /**
   * Format file updates
   */
  formatFileUpdates(files) {
    if (!files || files.length === 0) return '';
    
    return `
## 📁 Files Updated

${files.map(file => `- \`${file.path}\` (${file.status || 'modified'})`).join('\n')}

**Total Files:** ${files.length}
`;
  }

  /**
   * Format metrics
   */
  formatMetrics(metrics) {
    if (!metrics) return '';
    
    return `
## 📈 Performance Metrics

${Object.entries(metrics).map(([key, value]) => `- **${key}:** ${value}`).join('\n')}
`;
  }

  /**
   * Format related issues
   */
  formatRelatedIssues(relatedIssues) {
    if (!relatedIssues || relatedIssues.length === 0) return '';
    
    return `
## 🔗 Related Issues

${relatedIssues.map(issue => `- #${issue.number}: ${issue.title}`).join('\n')}
`;
  }

  /**
   * Format external references
   */
  formatExternalReferences(references) {
    if (!references || references.length === 0) return '';
    
    return `
## 🌐 External References

${references.map(ref => `- [${ref.title}](${ref.url})`).join('\n')}
`;
  }

  /**
   * Format timeline
   */
  formatTimeline(timeline) {
    if (!timeline || timeline.length === 0) return '';
    
    return `
## ⏰ Timeline Updates

${timeline.map(event => `- **${event.timestamp}:** ${event.description}`).join('\n')}
`;
  }

  /**
   * Merge update sources
   */
  mergeUpdateSources(currentIssue, updateSources) {
    const merged = {};
    
    for (const source of updateSources) {
      for (const [key, value] of Object.entries(source)) {
        if (key === 'labels') {
          merged[key] = merged[key] || [];
          merged[key] = [...merged[key], ...value];
        } else if (key === 'body') {
          merged[key] = merged[key] || currentIssue.body;
          merged[key] += '\n\n' + value;
        } else {
          merged[key] = value;
        }
      }
    }
    
    return merged;
  }

  /**
   * Fetch external data
   */
  async fetchExternalData(externalSystem, issueNumber) {
    // This would be implemented based on the external system
    // For now, return mock data
    return {
      status: 'fetched',
      data: { external_id: `ext_${issueNumber}` }
    };
  }

  /**
   * Map external data to updates
   */
  mapExternalDataToUpdates(externalData, externalSystem) {
    // This would be implemented based on the external system mapping
    return {
      labels: [`external-${externalSystem.name}`],
      body: `Synced with ${externalSystem.name} at ${new Date().toISOString()}`
    };
  }

  /**
   * Update sync status
   */
  async updateSyncStatus(issueNumber, externalSystem, status, error = null) {
    // This would update a sync tracking system
    console.log(`📊 Sync status for issue #${issueNumber} with ${externalSystem.name}: ${status}`);
  }
}

module.exports = IssueUpdateManager;


