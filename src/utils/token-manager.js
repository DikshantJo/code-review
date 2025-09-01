/**
 * Token Manager utility for AI Code Review system
 * Handles token limits, file size validation, and content optimization
 */
class TokenManager {
  constructor(config) {
    this.config = config;
    this.maxTokens = config?.ai?.max_tokens || 4000;
    this.maxFileSizeBytes = config?.ai?.max_file_size_bytes || 1024 * 1024; // 1MB
    this.maxTotalSizeBytes = config?.ai?.max_total_size_bytes || 5 * 1024 * 1024; // 5MB
    this.estimatedTokensPerChar = config?.ai?.estimated_tokens_per_char || 0.25;
    this.reservedTokens = config?.ai?.reserved_tokens || 500; // For prompt overhead
  }

  /**
   * Calculate estimated tokens for content
   * @param {string} content - Content to analyze
   * @returns {number} Estimated token count
   */
  calculateTokens(content) {
    if (!content || typeof content !== 'string') {
      return 0;
    }

    // Basic token estimation (rough approximation)
    const charCount = content.length;
    return Math.ceil(charCount * this.estimatedTokensPerChar);
  }

  /**
   * Calculate tokens for multiple files
   * @param {Array} files - Array of file objects
   * @returns {Object} Token analysis result
   */
  calculateTokensForFiles(files) {
    const analysis = {
      totalTokens: 0,
      fileTokens: [],
      oversizedFiles: [],
      totalSizeBytes: 0,
      estimatedCost: 0
    };

    for (const file of files) {
      const content = file.content || '';
      const size = file.size || 0;
      const tokens = this.calculateTokens(content);

      analysis.totalTokens += tokens;
      analysis.totalSizeBytes += size;

      analysis.fileTokens.push({
        path: file.path,
        tokens: tokens,
        size: size,
        contentLength: content.length
      });

      // Check for oversized files
      if (size > this.maxFileSizeBytes) {
        analysis.oversizedFiles.push({
          path: file.path,
          size: size,
          maxSize: this.maxFileSizeBytes,
          tokens: tokens
        });
      }
    }

    // Estimate cost (rough calculation)
    analysis.estimatedCost = this.estimateCost(analysis.totalTokens);

    return analysis;
  }

  /**
   * Estimate API cost based on token count
   * @param {number} tokens - Number of tokens
   * @returns {number} Estimated cost in USD
   */
  estimateCost(tokens) {
    // Rough cost estimation for GPT-4 (input tokens)
    const costPer1kTokens = 0.03; // Approximate GPT-4 input cost
    return (tokens / 1000) * costPer1kTokens;
  }

  /**
   * Check if content exceeds token limits
   * @param {Array} files - Array of file objects
   * @returns {Object} Limit check result
   */
  checkTokenLimits(files) {
    const analysis = this.calculateTokensForFiles(files);
    const availableTokens = this.maxTokens - this.reservedTokens;
    const effectiveTokens = analysis.totalTokens + this.reservedTokens;

    const result = {
      withinLimits: true,
      exceeded: false,
      reason: null,
      analysis: analysis,
      recommendations: [],
      availableTokens: availableTokens,
      usedTokens: analysis.totalTokens,
      effectiveTokens: effectiveTokens,
      utilization: (effectiveTokens / this.maxTokens) * 100
    };

    // Check token limit
    if (effectiveTokens > this.maxTokens) {
      result.withinLimits = false;
      result.exceeded = true;
      result.reason = 'token_limit_exceeded';
      result.recommendations.push(
        `Token limit exceeded: ${effectiveTokens} tokens used, ${this.maxTokens} available`
      );
    }

    // Check total size limit
    if (analysis.totalSizeBytes > this.maxTotalSizeBytes) {
      result.withinLimits = false;
      result.exceeded = true;
      result.reason = result.reason || 'size_limit_exceeded';
      result.recommendations.push(
        `Total size exceeded: ${this.formatBytes(analysis.totalSizeBytes)} used, ${this.formatBytes(this.maxTotalSizeBytes)} available`
      );
    }

    // Check for oversized files
    if (analysis.oversizedFiles.length > 0) {
      result.withinLimits = false;
      result.exceeded = true;
      result.reason = result.reason || 'oversized_files';
      result.recommendations.push(
        `${analysis.oversizedFiles.length} file(s) exceed individual size limit`
      );
    }

    // Add optimization recommendations
    if (result.utilization > 80) {
      result.recommendations.push('High token utilization - consider splitting review');
    }

    return result;
  }

  /**
   * Optimize content for token limits
   * @param {Array} files - Array of file objects
   * @param {Object} options - Optimization options
   * @returns {Object} Optimization result
   */
  optimizeForTokens(files, options = {}) {
    const {
      preserveImportantFiles = true,
      maxTokensPerFile = this.maxTokens / 2,
      excludePatterns = [],
      includePatterns = []
    } = options;

    const result = {
      optimized: [],
      excluded: [],
      totalTokens: 0,
      optimizationApplied: false
    };

    // Sort files by importance (size, type, etc.)
    const sortedFiles = this.sortFilesByImportance(files, preserveImportantFiles);

    for (const file of sortedFiles) {
      // Check exclusion patterns
      if (this.shouldExcludeFile(file.path, excludePatterns, includePatterns)) {
        result.excluded.push({
          path: file.path,
          reason: 'excluded_by_pattern',
          tokens: this.calculateTokens(file.content || ''),
          size: file.size || 0
        });
        continue;
      }

      const fileTokens = this.calculateTokens(file.content || '');
      const remainingTokens = this.maxTokens - this.reservedTokens - result.totalTokens;

      // Check if adding this file would exceed limits
      if (fileTokens > remainingTokens || fileTokens > maxTokensPerFile) {
        // Try to truncate the file
        const truncated = this.truncateFile(file, remainingTokens);
        if (truncated) {
          result.optimized.push(truncated);
          result.totalTokens += this.calculateTokens(truncated.content);
          result.optimizationApplied = true;
        } else {
          result.excluded.push({
            path: file.path,
            reason: 'token_limit',
            tokens: fileTokens,
            size: file.size || 0
          });
        }
      } else {
        // File fits within limits
        result.optimized.push(file);
        result.totalTokens += fileTokens;
      }
    }

    return result;
  }

  /**
   * Sort files by importance for optimization
   * @param {Array} files - Array of file objects
   * @param {boolean} preserveImportantFiles - Whether to preserve important files
   * @returns {Array} Sorted files
   */
  sortFilesByImportance(files, preserveImportantFiles = true) {
    return [...files].sort((a, b) => {
      const aScore = this.calculateFileImportance(a, preserveImportantFiles);
      const bScore = this.calculateFileImportance(b, preserveImportantFiles);
      return bScore - aScore; // Higher score first
    });
  }

  /**
   * Calculate file importance score
   * @param {Object} file - File object
   * @param {boolean} preserveImportantFiles - Whether to preserve important files
   * @returns {number} Importance score
   */
  calculateFileImportance(file, preserveImportantFiles = true) {
    let score = 0;
    const path = file.path || '';
    const content = file.content || '';

    // Higher score for smaller files (more likely to be important)
    score += Math.max(0, 1000 - (content.length / 100));

    // Higher score for source files
    if (path.includes('src/') || path.includes('app/') || path.includes('lib/')) {
      score += 500;
    }

    // Lower score for test files
    if (path.includes('test/') || path.includes('spec/') || path.endsWith('.test.js')) {
      score -= 200;
    }

    // Lower score for generated files
    if (path.includes('node_modules/') || path.includes('dist/') || path.includes('build/')) {
      score -= 1000;
    }

    // Higher score for configuration files
    if (path.includes('config/') || path.endsWith('.config.js') || path.endsWith('.json')) {
      score += 300;
    }

    return score;
  }

  /**
   * Check if file should be excluded based on patterns
   * @param {string} filePath - File path
   * @param {Array} excludePatterns - Patterns to exclude
   * @param {Array} includePatterns - Patterns to include
   * @returns {boolean} Whether file should be excluded
   */
  shouldExcludeFile(filePath, excludePatterns = [], includePatterns = []) {
    // If include patterns are specified, file must match at least one
    if (includePatterns.length > 0) {
      const matchesInclude = includePatterns.some(pattern => 
        filePath.includes(pattern) || new RegExp(pattern).test(filePath)
      );
      if (!matchesInclude) {
        return true;
      }
    }

    // Check exclude patterns
    return excludePatterns.some(pattern => 
      filePath.includes(pattern) || new RegExp(pattern).test(filePath)
    );
  }

  /**
   * Truncate file content to fit within token limit
   * @param {Object} file - File object
   * @param {number} maxTokens - Maximum tokens allowed
   * @returns {Object|null} Truncated file or null if not possible
   */
  truncateFile(file, maxTokens) {
    const content = file.content || '';
    const maxChars = Math.floor(maxTokens / this.estimatedTokensPerChar);

    if (content.length <= maxChars) {
      return file; // No truncation needed
    }

    // Try to truncate intelligently
    const truncated = this.intelligentTruncate(content, maxChars);
    
    if (truncated) {
      return {
        ...file,
        content: truncated,
        originalLength: content.length,
        truncated: true
      };
    }

    return null; // Cannot truncate intelligently
  }

  /**
   * Intelligently truncate content
   * @param {string} content - Content to truncate
   * @param {number} maxChars - Maximum characters allowed
   * @returns {string|null} Truncated content or null
   */
  intelligentTruncate(content, maxChars) {
    if (content.length <= maxChars) {
      return content;
    }

    // Try to truncate at line boundaries
    const lines = content.split('\n');
    let truncated = '';
    let currentLength = 0;

    for (const line of lines) {
      if (currentLength + line.length + 1 <= maxChars) {
        truncated += line + '\n';
        currentLength += line.length + 1;
      } else {
        break;
      }
    }

    // If we have some content, return it with a note
    if (truncated.length > 0) {
      return truncated.trim() + '\n\n// ... (content truncated due to token limits)';
    }

    // If we can't truncate intelligently, try simple truncation
    if (maxChars > 100) {
      return content.substring(0, maxChars - 50) + '\n\n// ... (content truncated due to token limits)';
    }

    return null;
  }

  /**
   * Create token usage report
   * @param {Object} analysis - Token analysis result
   * @returns {Object} Usage report
   */
  createTokenUsageReport(analysis) {
    const report = {
      summary: {
        totalFiles: analysis.fileTokens.length,
        totalTokens: analysis.totalTokens,
        totalSize: this.formatBytes(analysis.totalSizeBytes),
        estimatedCost: analysis.estimatedCost,
        utilization: (analysis.totalTokens / this.maxTokens) * 100
      },
      files: analysis.fileTokens.map(file => ({
        path: file.path,
        tokens: file.tokens,
        size: this.formatBytes(file.size),
        contentLength: file.contentLength,
        tokenDensity: file.contentLength > 0 ? (file.tokens / file.contentLength) : 0
      })),
      oversizedFiles: analysis.oversizedFiles.map(file => ({
        path: file.path,
        size: this.formatBytes(file.size),
        maxSize: this.formatBytes(file.maxSize),
        tokens: file.tokens
      })),
      recommendations: this.generateTokenRecommendations(analysis)
    };

    return report;
  }

  /**
   * Generate recommendations based on token analysis
   * @param {Object} analysis - Token analysis result
   * @returns {Array} Array of recommendations
   */
  generateTokenRecommendations(analysis) {
    const recommendations = [];

    if (analysis.totalTokens > this.maxTokens * 0.8) {
      recommendations.push('High token usage - consider splitting the review into smaller chunks');
    }

    if (analysis.oversizedFiles.length > 0) {
      recommendations.push(`Exclude ${analysis.oversizedFiles.length} oversized file(s) from review`);
    }

    if (analysis.estimatedCost > 0.10) {
      recommendations.push(`Estimated cost: $${analysis.estimatedCost.toFixed(2)} - consider optimizing for cost`);
    }

    // Find files with high token density
    const highDensityFiles = analysis.fileTokens.filter(file => 
      file.contentLength > 0 && (file.tokens / file.contentLength) > 0.5
    );

    if (highDensityFiles.length > 0) {
      recommendations.push(`${highDensityFiles.length} file(s) have high token density - consider excluding from AI review`);
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
   * Get token manager configuration
   * @returns {Object} Configuration
   */
  getConfiguration() {
    return {
      maxTokens: this.maxTokens,
      maxFileSizeBytes: this.maxFileSizeBytes,
      maxTotalSizeBytes: this.maxTotalSizeBytes,
      estimatedTokensPerChar: this.estimatedTokensPerChar,
      reservedTokens: this.reservedTokens
    };
  }
}

module.exports = TokenManager;



