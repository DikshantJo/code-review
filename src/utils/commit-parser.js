/**
 * Commit Parser Utility
 * Handles commit message parsing, metadata extraction, and override detection
 */

const core = require('@actions/core');

class CommitParser {
  constructor(options = {}) {
    this.options = {
      // Override keywords
      urgentKeywords: options.urgentKeywords || ['URGENT', 'EMERGENCY', 'CRITICAL'],
      overrideKeywords: options.overrideKeywords || ['OVERRIDE', 'BYPASS'],
      
      // Commit message patterns
      conventionalCommitPattern: options.conventionalCommitPattern || /^(\w+)(?:\(([\w\-]+)\))?:\s*(.+)$/,
      ticketPattern: options.ticketPattern || /(?:^|\s)(?:ticket|issue|bug|fix|feature|story|task)[\s#:]*([A-Z]+-\d+)/gi,
      
      // Metadata extraction
      extractMetadata: options.extractMetadata !== false,
      extractTickets: options.extractTickets !== false,
      extractConventionalType: options.extractConventionalType !== false,
      
      // Logging
      enableLogging: options.enableLogging !== false,
      logLevel: options.logLevel || 'INFO'
    };
  }

  /**
   * Parse commit message and extract metadata
   * @param {string} commitMessage - Raw commit message
   * @param {Object} commitData - Additional commit data
   * @returns {Object} Parsed commit information
   */
  parseCommit(commitMessage, commitData = {}) {
    if (!commitMessage) {
      return this.createEmptyCommit();
    }

    const parsed = {
      raw: commitMessage,
      clean: this.cleanCommitMessage(commitMessage),
      type: this.extractCommitType(commitMessage),
      scope: this.extractCommitScope(commitMessage),
      subject: this.extractCommitSubject(commitMessage),
      body: this.extractCommitBody(commitMessage),
      tickets: this.extractTickets(commitMessage),
      metadata: this.extractMetadata(commitMessage),
      overrides: this.detectOverrides(commitMessage),
      urgency: this.detectUrgency(commitMessage),
      ...commitData
    };

    this.logInfo('Parsed commit message', {
      type: parsed.type,
      scope: parsed.scope,
      tickets: parsed.tickets.length,
      overrides: parsed.overrides.length,
      urgency: parsed.urgency
    });

    return parsed;
  }

  /**
   * Clean commit message by removing extra whitespace and normalizing
   * @param {string} commitMessage - Raw commit message
   * @returns {string} Cleaned commit message
   */
  cleanCommitMessage(commitMessage) {
    if (!commitMessage) return '';
    
    let cleaned = commitMessage
      .trim()
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\n\s+/g, '\n')
      .replace(/\s+\n/g, '\n');
    
    // Normalize multiple newlines to double newlines
    while (cleaned.includes('\n\n\n')) {
      cleaned = cleaned.replace(/\n\n\n/g, '\n\n');
    }
    
    return cleaned;
  }

  /**
   * Extract commit type from conventional commit format
   * @param {string} commitMessage - Commit message
   * @returns {string} Commit type
   */
  extractCommitType(commitMessage) {
    if (!this.options.extractConventionalType) {
      return 'unknown';
    }

    // Get the first line for conventional commit parsing
    const firstLine = commitMessage.split('\n')[0];
    const match = firstLine.match(this.options.conventionalCommitPattern);
    if (match) {
      return match[1].toLowerCase();
    }
    
    // Check if it's an urgency keyword
    const urgency = this.detectUrgency(commitMessage);
    if (urgency.length > 0) {
      return urgency[0].keyword.toLowerCase();
    }
    
    return 'unknown';
  }

  /**
   * Extract commit scope from conventional commit format
   * @param {string} commitMessage - Commit message
   * @returns {string} Commit scope
   */
  extractCommitScope(commitMessage) {
    if (!this.options.extractConventionalType) {
      return null;
    }

    // Get the first line for conventional commit parsing
    const firstLine = commitMessage.split('\n')[0];
    const match = firstLine.match(this.options.conventionalCommitPattern);
    return match && match[2] ? match[2].toLowerCase() : null;
  }

  /**
   * Extract commit subject (first line)
   * @param {string} commitMessage - Commit message
   * @returns {string} Commit subject
   */
  extractCommitSubject(commitMessage) {
    if (!commitMessage) return '';
    
    const lines = commitMessage.split('\n');
    return lines[0].trim();
  }

  /**
   * Extract commit body (lines after first line)
   * @param {string} commitMessage - Commit message
   * @returns {string} Commit body
   */
  extractCommitBody(commitMessage) {
    if (!commitMessage) return '';
    
    const lines = commitMessage.split('\n');
    if (lines.length <= 1) return '';
    
    return lines.slice(1).join('\n').trim();
  }

  /**
   * Extract ticket/issue references from commit message
   * @param {string} commitMessage - Commit message
   * @returns {Array} Array of ticket references
   */
  extractTickets(commitMessage) {
    if (!this.options.extractTickets || !commitMessage) {
      return [];
    }

    const tickets = [];
    const matches = commitMessage.matchAll(this.options.ticketPattern);
    
    for (const match of matches) {
      const ticket = match[1];
      if (ticket && !tickets.includes(ticket)) {
        tickets.push(ticket);
      }
    }

    return tickets;
  }

  /**
   * Extract metadata from commit message
   * @param {string} commitMessage - Commit message
   * @returns {Object} Extracted metadata
   */
  extractMetadata(commitMessage) {
    if (!this.options.extractMetadata || !commitMessage) {
      return {};
    }

    const metadata = {
      hasBreakingChange: this.hasBreakingChange(commitMessage),
      isRevert: this.isRevert(commitMessage),
      isMerge: this.isMerge(commitMessage),
      isSquash: this.isSquash(commitMessage),
      wordCount: this.getWordCount(commitMessage),
      lineCount: this.getLineCount(commitMessage),
      containsUrls: this.containsUrls(commitMessage),
      containsEmails: this.containsEmails(commitMessage)
    };

    return metadata;
  }

  /**
   * Detect override keywords in commit message
   * @param {string} commitMessage - Commit message
   * @returns {Array} Array of detected overrides
   */
  detectOverrides(commitMessage) {
    if (!commitMessage) return [];

    const overrides = [];
    const message = commitMessage.toUpperCase();

    for (const keyword of this.options.overrideKeywords) {
      const keywordUpper = keyword.toUpperCase();
      const regex = new RegExp(`\\b${keywordUpper}\\b`, 'g');
      let match;
      
      while ((match = regex.exec(message)) !== null) {
        overrides.push({
          keyword: keyword,
          type: 'override',
          position: match.index
        });
      }
    }

    return overrides;
  }

  /**
   * Detect urgency keywords in commit message
   * @param {string} commitMessage - Commit message
   * @returns {Array} Array of detected urgency indicators
   */
  detectUrgency(commitMessage) {
    if (!commitMessage) return [];

    const urgency = [];
    const message = commitMessage.toUpperCase();

    for (const keyword of this.options.urgentKeywords) {
      const keywordUpper = keyword.toUpperCase();
      const regex = new RegExp(`\\b${keywordUpper}\\b`, 'g');
      let match;
      
      while ((match = regex.exec(message)) !== null) {
        urgency.push({
          keyword: keyword,
          type: 'urgency',
          level: this.getUrgencyLevel(keyword),
          position: match.index
        });
      }
    }

    return urgency;
  }

  /**
   * Get urgency level for a keyword
   * @param {string} keyword - Urgency keyword
   * @returns {string} Urgency level
   */
  getUrgencyLevel(keyword) {
    const levels = {
      'CRITICAL': 'critical',
      'EMERGENCY': 'emergency',
      'URGENT': 'high',
      'ASAP': 'medium',
      'PRIORITY': 'medium'
    };

    return levels[keyword.toUpperCase()] || 'low';
  }

  /**
   * Check if commit message has breaking change indicator
   * @param {string} commitMessage - Commit message
   * @returns {boolean} Has breaking change
   */
  hasBreakingChange(commitMessage) {
    if (!commitMessage) return false;
    
    const breakingPatterns = [
      /^.*!:/,
      /BREAKING CHANGE:/i,
      /BREAKING CHANGES:/i
    ];

    return breakingPatterns.some(pattern => pattern.test(commitMessage));
  }

  /**
   * Check if commit is a revert
   * @param {string} commitMessage - Commit message
   * @returns {boolean} Is revert commit
   */
  isRevert(commitMessage) {
    if (!commitMessage) return false;
    
    return /^revert:/i.test(commitMessage.trim()) || /^revert\s+"/i.test(commitMessage.trim());
  }

  /**
   * Check if commit is a merge
   * @param {string} commitMessage - Commit message
   * @returns {boolean} Is merge commit
   */
  isMerge(commitMessage) {
    if (!commitMessage) return false;
    
    const mergePatterns = [
      /^merge/i,
      /^merging/i,
      /merge branch/i,
      /merge pull request/i
    ];

    return mergePatterns.some(pattern => pattern.test(commitMessage));
  }

  /**
   * Check if commit is a squash
   * @param {string} commitMessage - Commit message
   * @returns {boolean} Is squash commit
   */
  isSquash(commitMessage) {
    if (!commitMessage) return false;
    
    return /squash/i.test(commitMessage);
  }

  /**
   * Get word count of commit message
   * @param {string} commitMessage - Commit message
   * @returns {number} Word count
   */
  getWordCount(commitMessage) {
    if (!commitMessage) return 0;
    
    return commitMessage.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Get line count of commit message
   * @param {string} commitMessage - Commit message
   * @returns {number} Line count
   */
  getLineCount(commitMessage) {
    if (!commitMessage) return 0;
    
    return commitMessage.split('\n').length;
  }

  /**
   * Check if commit message contains URLs
   * @param {string} commitMessage - Commit message
   * @returns {boolean} Contains URLs
   */
  containsUrls(commitMessage) {
    if (!commitMessage) return false;
    
    const urlPattern = /https?:\/\/[^\s]+/i;
    return urlPattern.test(commitMessage);
  }

  /**
   * Check if commit message contains email addresses
   * @param {string} commitMessage - Commit message
   * @returns {boolean} Contains emails
   */
  containsEmails(commitMessage) {
    if (!commitMessage) return false;
    
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    return emailPattern.test(commitMessage);
  }

  /**
   * Check if commit message contains urgent override
   * @param {string} commitMessage - Commit message
   * @returns {boolean} Has urgent override
   */
  hasUrgentOverride(commitMessage) {
    if (!commitMessage) return false;
    
    const urgency = this.detectUrgency(commitMessage);
    return urgency.length > 0;
  }

  /**
   * Get urgent override information
   * @param {string} commitMessage - Commit message
   * @returns {Object|null} Urgent override info
   */
  getUrgentOverride(commitMessage) {
    if (!commitMessage) return null;
    
    const urgency = this.detectUrgency(commitMessage);
    if (urgency.length === 0) return null;

    // Return the highest priority urgency
    const sortedUrgency = urgency.sort((a, b) => {
      const levels = { 'critical': 3, 'emergency': 3, 'high': 2, 'medium': 1, 'low': 0 };
      return levels[b.level] - levels[a.level];
    });

    return sortedUrgency[0];
  }

  /**
   * Validate commit message format
   * @param {string} commitMessage - Commit message
   * @returns {Object} Validation result
   */
  validateCommitMessage(commitMessage) {
    if (!commitMessage) {
      return {
        valid: false,
        errors: ['Commit message cannot be empty']
      };
    }

    const errors = [];
    const warnings = [];

    // Check minimum length
    if (commitMessage.trim().length < 10) {
      errors.push('Commit message too short (minimum 10 characters)');
    }

    // Check maximum length
    if (commitMessage.length > 500) {
      warnings.push('Commit message very long (over 500 characters)');
    }

    // Check for conventional commit format
    if (this.options.extractConventionalType) {
      const match = commitMessage.match(this.options.conventionalCommitPattern);
      if (!match) {
        warnings.push('Commit message does not follow conventional commit format');
      }
    }

    // Check for common issues
    if (commitMessage.includes('WIP') || commitMessage.includes('TODO')) {
      warnings.push('Commit message contains WIP or TODO indicators');
    }

    if (this.containsUrls(commitMessage)) {
      warnings.push('Commit message contains URLs');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Create empty commit object
   * @returns {Object} Empty commit object
   */
  createEmptyCommit() {
    return {
      raw: '',
      clean: '',
      type: 'unknown',
      scope: null,
      subject: '',
      body: '',
      tickets: [],
      metadata: {
        hasBreakingChange: false,
        isRevert: false,
        isMerge: false,
        isSquash: false,
        wordCount: 0,
        lineCount: 0,
        containsUrls: false,
        containsEmails: false
      },
      overrides: [],
      urgency: []
    };
  }

  /**
   * Get commit summary for logging
   * @param {Object} parsedCommit - Parsed commit object
   * @returns {Object} Commit summary
   */
  getCommitSummary(parsedCommit) {
    return {
      type: parsedCommit.type,
      scope: parsedCommit.scope,
      subject: parsedCommit.subject.substring(0, 50) + (parsedCommit.subject.length > 50 ? '...' : ''),
      tickets: parsedCommit.tickets,
      urgency: parsedCommit.urgency.map(u => u.keyword),
      overrides: parsedCommit.overrides.map(o => o.keyword),
      wordCount: parsedCommit.metadata.wordCount,
      lineCount: parsedCommit.metadata.lineCount
    };
  }

  /**
   * Log information message
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   */
  logInfo(message, ...args) {
    if (this.options.enableLogging && this.options.logLevel === 'INFO') {
      core.info(`[Commit Parser] ${message}`, ...args);
    }
  }

  /**
   * Log warning message
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   */
  logWarning(message, ...args) {
    if (this.options.enableLogging) {
      core.warning(`[Commit Parser] ${message}`, ...args);
    }
  }

  /**
   * Log error message
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   */
  logError(message, ...args) {
    if (this.options.enableLogging) {
      core.error(`[Commit Parser] ${message}`, ...args);
    }
  }
}

module.exports = CommitParser;
