/**
 * Large commit handling utility for AI Code Review system
 * Handles commits that exceed token limits or file count thresholds
 */
class LargeCommitHandler {
  constructor(config) {
    this.config = config;
    this.maxFilesPerReview = config?.ai?.max_files_per_review || 50;
    this.maxFileSizeBytes = config?.ai?.max_file_size_bytes || 1024 * 1024; // 1MB
    this.maxTotalSizeBytes = config?.ai?.max_total_size_bytes || 5 * 1024 * 1024; // 5MB
    this.maxTokens = config?.ai?.max_tokens || 4000;
    this.estimatedTokensPerChar = 0.25; // Rough estimate
  }

  /**
   * Analyze commit size and determine if it needs special handling
   * @param {Array} files - Array of file objects with path, size, content
   * @param {Object} context - Review context information
   * @returns {Object} Analysis result with recommendations
   */
  analyzeCommitSize(files, context = {}) {
    const analysis = {
      totalFiles: files.length,
      totalSizeBytes: 0,
      estimatedTokens: 0,
      oversizedFiles: [],
      needsHandling: false,
      handlingStrategy: null,
      reason: null,
      recommendations: []
    };

    // Calculate totals and identify oversized files
    for (const file of files) {
      const fileSize = file.size || 0;
      const fileContent = file.content || '';
      
      analysis.totalSizeBytes += fileSize;
      analysis.estimatedTokens += fileContent.length * this.estimatedTokensPerChar;

      if (fileSize > this.maxFileSizeBytes) {
        analysis.oversizedFiles.push({
          path: file.path,
          size: fileSize,
          maxSize: this.maxFileSizeBytes
        });
      }
    }

    // Determine if special handling is needed
    const sizeExceeded = analysis.totalSizeBytes > this.maxTotalSizeBytes;
    const fileCountExceeded = analysis.totalFiles > this.maxFilesPerReview;
    const tokenLimitExceeded = analysis.estimatedTokens > this.maxTokens;
    const hasOversizedFiles = analysis.oversizedFiles.length > 0;

    if (sizeExceeded || fileCountExceeded || tokenLimitExceeded || hasOversizedFiles) {
      analysis.needsHandling = true;
      
      if (sizeExceeded) {
        analysis.handlingStrategy = 'skip';
        analysis.reason = 'total_size_exceeded';
        analysis.recommendations.push(
          `Total commit size (${this.formatBytes(analysis.totalSizeBytes)}) exceeds limit (${this.formatBytes(this.maxTotalSizeBytes)})`
        );
      } else if (fileCountExceeded) {
        analysis.handlingStrategy = 'split';
        analysis.reason = 'file_count_exceeded';
        analysis.recommendations.push(
          `File count (${analysis.totalFiles}) exceeds limit (${this.maxFilesPerReview}). Consider splitting into smaller commits.`
        );
      } else if (tokenLimitExceeded) {
        analysis.handlingStrategy = 'split';
        analysis.reason = 'token_limit_exceeded';
        analysis.recommendations.push(
          `Estimated tokens (${Math.round(analysis.estimatedTokens)}) exceeds limit (${this.maxTokens}). Consider splitting into smaller commits.`
        );
      } else if (hasOversizedFiles) {
        analysis.handlingStrategy = 'skip';
        analysis.reason = 'oversized_files';
        analysis.recommendations.push(
          `${analysis.oversizedFiles.length} file(s) exceed size limit. Consider excluding large files from review.`
        );
      }
    }

    return analysis;
  }

  /**
   * Alias method for analyzeCommitSize (compatibility)
   * @param {Array} files - Array of file objects
   * @param {Object} context - Additional context information
   * @returns {Object} Analysis results
   */
  analyzeCommit(files, context = {}) {
    return this.analyzeCommitSize(files, context);
  }

  /**
   * Split files into reviewable chunks
   * @param {Array} files - Array of file objects
   * @param {Object} analysis - Size analysis result
   * @returns {Array} Array of file chunks for review
   */
  splitFilesIntoChunks(files, analysis) {
    const chunks = [];
    let currentChunk = [];
    let currentSize = 0;
    let currentTokens = 0;

    // Sort files by size (smallest first) to optimize chunking
    const sortedFiles = [...files].sort((a, b) => (a.size || 0) - (b.size || 0));

    for (const file of sortedFiles) {
      const fileSize = file.size || 0;
      const fileContent = file.content || '';
      const fileTokens = fileContent.length * this.estimatedTokensPerChar;

      // Check if adding this file would exceed limits
      const wouldExceedSize = currentSize + fileSize > this.maxTotalSizeBytes;
      const wouldExceedTokens = currentTokens + fileTokens > this.maxTokens;
      const wouldExceedFileCount = currentChunk.length >= this.maxFilesPerReview;

      if (wouldExceedSize || wouldExceedTokens || wouldExceedFileCount) {
        // Start a new chunk
        if (currentChunk.length > 0) {
          chunks.push({
            files: currentChunk,
            totalSize: currentSize,
            estimatedTokens: currentTokens,
            fileCount: currentChunk.length
          });
        }
        
        currentChunk = [file];
        currentSize = fileSize;
        currentTokens = fileTokens;
      } else {
        // Add to current chunk
        currentChunk.push(file);
        currentSize += fileSize;
        currentTokens += fileTokens;
      }
    }

    // Add the last chunk if it has files
    if (currentChunk.length > 0) {
      chunks.push({
        files: currentChunk,
        totalSize: currentSize,
        estimatedTokens: currentTokens,
        fileCount: currentChunk.length
      });
    }

    return chunks;
  }

  /**
   * Generate skip notification message
   * @param {Object} analysis - Size analysis result
   * @param {Object} context - Review context
   * @returns {Object} Notification details
   */
  generateSkipNotification(analysis, context) {
    const notification = {
      type: 'large_commit_skipped',
      title: `Large Commit Skipped - ${context.repository} (${context.targetBranch})`,
      message: `AI code review was skipped due to commit size limitations.`,
      details: {
        totalFiles: analysis.totalFiles,
        totalSize: this.formatBytes(analysis.totalSizeBytes),
        reason: analysis.reason,
        recommendations: analysis.recommendations
      },
      severity: 'warning'
    };

    // Add specific details based on reason
    switch (analysis.reason) {
      case 'total_size_exceeded':
        notification.message += ` Total commit size (${this.formatBytes(analysis.totalSizeBytes)}) exceeds the ${this.formatBytes(this.maxTotalSizeBytes)} limit.`;
        break;
      
      case 'oversized_files':
        notification.message += ` ${analysis.oversizedFiles.length} file(s) exceed the ${this.formatBytes(this.maxFileSizeBytes)} individual file size limit.`;
        break;
      
      default:
        notification.message += ` Commit exceeds configured size limits.`;
    }

    return notification;
  }

  /**
   * Generate split notification message
   * @param {Array} chunks - File chunks for review
   * @param {Object} analysis - Size analysis result
   * @param {Object} context - Review context
   * @returns {Object} Notification details
   */
  generateSplitNotification(chunks, analysis, context) {
    const notification = {
      type: 'large_commit_split',
      title: `Large Commit Split for Review - ${context.repository} (${context.targetBranch})`,
      message: `Large commit has been split into ${chunks.length} review chunks due to size limitations.`,
      details: {
        originalFiles: analysis.totalFiles,
        originalSize: this.formatBytes(analysis.totalSizeBytes),
        chunks: chunks.map((chunk, index) => ({
          chunkNumber: index + 1,
          fileCount: chunk.fileCount,
          totalSize: this.formatBytes(chunk.totalSize),
          estimatedTokens: Math.round(chunk.estimatedTokens)
        })),
        reason: analysis.reason,
        recommendations: analysis.recommendations
      },
      severity: 'info'
    };

    return notification;
  }

  /**
   * Filter out oversized files from review
   * @param {Array} files - Array of file objects
   * @returns {Object} Filtered files and excluded files
   */
  filterOversizedFiles(files) {
    const filteredFiles = [];
    const excludedFiles = [];

    for (const file of files) {
      const fileSize = file.size || 0;
      
      if (fileSize > this.maxFileSizeBytes) {
        excludedFiles.push({
          path: file.path,
          size: fileSize,
          reason: 'file_too_large',
          maxSize: this.maxFileSizeBytes
        });
      } else {
        filteredFiles.push(file);
      }
    }

    return {
      included: filteredFiles,
      excluded: excludedFiles
    };
  }

  /**
   * Get handling recommendations based on analysis
   * @param {Object} analysis - Size analysis result
   * @returns {Array} Array of recommendations
   */
  getRecommendations(analysis) {
    const recommendations = [...analysis.recommendations];

    if (analysis.reason === 'total_size_exceeded') {
      recommendations.push('Consider splitting the commit into smaller, focused changes');
      recommendations.push('Review if all files in the commit are necessary for this change');
      recommendations.push('Consider excluding large binary files or generated files from review');
    }

    if (analysis.reason === 'file_count_exceeded') {
      recommendations.push('Break down the commit into logical units (e.g., feature + tests)');
      recommendations.push('Consider reviewing related files in separate commits');
      recommendations.push('Use smaller, incremental commits for better reviewability');
    }

    if (analysis.reason === 'token_limit_exceeded') {
      recommendations.push('Split the commit to reduce the amount of code being reviewed at once');
      recommendations.push('Focus on the most critical files first');
      recommendations.push('Consider manual review for very large changes');
    }

    if (analysis.oversizedFiles.length > 0) {
      recommendations.push('Exclude large files (binaries, generated files) from AI review');
      recommendations.push('Consider manual review for large files');
      recommendations.push('Add large files to .gitignore or review exclusion patterns');
    }

    return recommendations;
  }

  /**
   * Format bytes to human readable format
   * @param {number} bytes - Number of bytes
   * @returns {string} Formatted string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get configuration summary
   * @returns {Object} Configuration details
   */
  getConfiguration() {
    return {
      maxFilesPerReview: this.maxFilesPerReview,
      maxFileSizeBytes: this.maxFileSizeBytes,
      maxTotalSizeBytes: this.maxTotalSizeBytes,
      maxTokens: this.maxTokens,
      estimatedTokensPerChar: this.estimatedTokensPerChar
    };
  }
}

module.exports = LargeCommitHandler;



