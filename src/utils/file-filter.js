/**
 * File Filtering Utility
 * Excludes sensitive and irrelevant files from AI code review
 */

const core = require('@actions/core');
const fs = require('fs');
const path = require('path');

class FileFilter {
  constructor(config = {}) {
    this.config = {
      // File size limits (in bytes)
      maxFileSize: config.maxFileSize || 1000000, // 1MB default
      
      // File count limits
      maxFiles: config.maxFiles || 50,
      
      // Exclusion patterns
      excludePatterns: config.excludePatterns || this.getDefaultExcludePatterns(),
      
      // Include patterns (if specified, only these files will be included)
      includePatterns: config.includePatterns || [],
      
      // Directory exclusions
      excludeDirectories: config.excludeDirectories || [
        'node_modules',
        '.git',
        'dist',
        'build',
        'coverage',
        'logs',
        'tmp',
        'temp',
        '.cache',
        '.next',
        '.nuxt',
        '.output'
      ],
      
      // File extensions to exclude
      excludeExtensions: config.excludeExtensions || [
        // Database files
        '.sql', '.db', '.sqlite', '.sqlite3',
        
        // Environment files
        '.env', '.env.local', '.env.development', '.env.test', '.env.production',
        
        // Configuration files
        '.conf', '.ini', '.yaml', '.yml', '.toml',
        
        // Log files
        '.log', '.logs',
        
        // Confidential formats
        '.key', '.pem', '.p12', '.pfx', '.crt', '.cer', '.der',
        
        // Image files
        '.jpg', '.jpeg', '.png', '.gif', '.svg', '.ico', '.bmp', '.tiff', '.webp',
        
        // Binary files
        '.exe', '.dll', '.so', '.dylib', '.jar', '.war', '.ear', '.class',
        '.o', '.obj', '.a', '.lib', '.dmg', '.pkg', '.deb', '.rpm',
        
        // Archive files
        '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
        
        // Generated files
        '.min.js', '.min.css', '.map', '.bundle.js',
        
        // IDE and editor files
        '.vscode', '.idea', '.swp', '.swo', '.sublime-*',
        
        // OS generated files
        '.DS_Store', 'Thumbs.db', '.Trash', '.Spotlight-V100'
      ],
      
      // File name patterns to exclude
      excludeFileNames: config.excludeFileNames || [
        'config.js', 'config.ts', 'config.json',
        'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
        '.gitignore', '.gitattributes', '.editorconfig',
        'README.md', 'CHANGELOG.md', 'LICENSE', 'LICENSE.txt',
        'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
        '.dockerignore', '.env.example', '.env.sample'
      ]
    };
  }

  /**
   * Get default exclusion patterns
   * @returns {Object} Default exclusion patterns
   */
  getDefaultExcludePatterns() {
    return {
      // Database files
      database: /\.(sql|db|sqlite|sqlite3)$/i,
      
      // Environment files
      environment: /\.env(\.|$)/i,
      
      // Configuration files
      config: /^(config\.|.*\.conf|.*\.ini|.*\.yaml|.*\.yml|.*\.toml)$/i,
      
      // Log files
      logs: /\.(log|logs)$/i,
      
      // Confidential formats
      confidential: /\.(key|pem|p12|pfx|crt|cer|der)$/i,
      
      // Image files
      images: /\.(jpg|jpeg|png|gif|svg|ico|bmp|tiff|webp)$/i,
      
      // Binary files
      binary: /\.(exe|dll|so|dylib|jar|war|ear|class|o|obj|a|lib|dmg|pkg|deb|rpm)$/i,
      
      // Archive files
      archives: /\.(zip|tar|gz|bz2|7z|rar)$/i,
      
      // Generated files
      generated: /\.(min\.js|min\.css|map|bundle\.js)$/i,
      
      // IDE and editor files
      ide: /\.(vscode|idea|swp|swo|sublime-.*)$/i,
      
      // OS generated files
      os: /\.(DS_Store|Thumbs\.db|Trash|Spotlight-V100)$/i
    };
  }

  /**
   * Check if a file should be excluded from review
   * @param {string} filePath - Path to the file
   * @param {Object} options - Additional options
   * @returns {Object} Filter result with shouldExclude boolean and reason
   */
  shouldExcludeFile(filePath, options = {}) {
    const normalizedPath = path.normalize(filePath);
    const fileName = path.basename(normalizedPath);
    const extension = path.extname(normalizedPath).toLowerCase();
    const directory = path.dirname(normalizedPath);

    // Check if file exists and get its stats
    let fileStats;
    try {
      fileStats = fs.statSync(normalizedPath);
    } catch (error) {
      return {
        shouldExclude: true,
        reason: 'File not found or not accessible',
        category: 'accessibility'
      };
    }

    // Check if it's a directory
    if (fileStats.isDirectory()) {
      return {
        shouldExclude: true,
        reason: 'Directory',
        category: 'type'
      };
    }

    // Check file size
    if (fileStats.size > this.config.maxFileSize) {
      return {
        shouldExclude: true,
        reason: `File size exceeds limit (${this.formatFileSize(fileStats.size)} > ${this.formatFileSize(this.config.maxFileSize)})`,
        category: 'size'
      };
    }

    // Check excluded directories
    for (const excludeDir of this.config.excludeDirectories) {
      if (normalizedPath.includes(`/${excludeDir}/`) || normalizedPath.startsWith(`${excludeDir}/`)) {
        return {
          shouldExclude: true,
          reason: `Directory excluded: ${excludeDir}`,
          category: 'directory'
        };
      }
    }

    // Check excluded file names
    for (const excludeFileName of this.config.excludeFileNames) {
      if (fileName === excludeFileName || fileName.match(excludeFileName)) {
        return {
          shouldExclude: true,
          reason: `File name excluded: ${excludeFileName}`,
          category: 'filename'
        };
      }
    }

    // Check excluded extensions
    for (const excludeExt of this.config.excludeExtensions) {
      if (extension === excludeExt || fileName.endsWith(excludeExt)) {
        return {
          shouldExclude: true,
          reason: `Extension excluded: ${excludeExt}`,
          category: 'extension'
        };
      }
    }

    // Check exclusion patterns
    for (const [category, pattern] of Object.entries(this.config.excludePatterns)) {
      if (normalizedPath.match(pattern)) {
        return {
          shouldExclude: true,
          reason: `Pattern excluded: ${category}`,
          category: category
        };
      }
    }

    // Check include patterns (if specified)
    if (this.config.includePatterns.length > 0) {
      let isIncluded = false;
      for (const includePattern of this.config.includePatterns) {
        if (normalizedPath.match(includePattern)) {
          isIncluded = true;
          break;
        }
      }
      if (!isIncluded) {
        return {
          shouldExclude: true,
          reason: 'File not in include patterns',
          category: 'include_pattern'
        };
      }
    }

    return {
      shouldExclude: false,
      reason: 'File included for review',
      category: 'included'
    };
  }

  /**
   * Filter a list of files
   * @param {Array<string>} files - Array of file paths
   * @param {Object} options - Additional options
   * @returns {Object} Filter results with included and excluded files
   */
  filterFiles(files, options = {}) {
    const results = {
      included: [],
      excluded: [],
      summary: {
        total: files.length,
        included: 0,
        excluded: 0,
        categories: {}
      }
    };

    for (const file of files) {
      const filterResult = this.shouldExcludeFile(file, options);
      
      if (filterResult.shouldExclude) {
        results.excluded.push({
          path: file,
          reason: filterResult.reason,
          category: filterResult.category
        });
        
        // Update summary
        results.summary.excluded++;
        results.summary.categories[filterResult.category] = 
          (results.summary.categories[filterResult.category] || 0) + 1;
      } else {
        results.included.push(file);
        results.summary.included++;
      }
    }

    // Apply file count limit
    if (results.included.length > this.config.maxFiles) {
      const excessFiles = results.included.splice(this.config.maxFiles);
      results.excluded.push(...excessFiles.map(file => ({
        path: file,
        reason: `Exceeds maximum file count limit (${this.config.maxFiles})`,
        category: 'limit'
      })));
      results.summary.excluded += excessFiles.length;
      results.summary.included = this.config.maxFiles;
    }

    return results;
  }

  /**
   * Get file statistics for a list of files
   * @param {Array<string>} files - Array of file paths
   * @returns {Object} File statistics
   */
  getFileStats(files) {
    const stats = {
      totalFiles: files.length,
      totalSize: 0,
      sizeByExtension: {},
      sizeByCategory: {},
      averageSize: 0,
      largestFile: null,
      smallestFile: null
    };

    for (const file of files) {
      try {
        const fileStats = fs.statSync(file);
        const extension = path.extname(file).toLowerCase() || 'no-extension';
        const category = this.getFileCategory(file);

        stats.totalSize += fileStats.size;
        
        // Size by extension
        stats.sizeByExtension[extension] = (stats.sizeByExtension[extension] || 0) + fileStats.size;
        
        // Size by category
        stats.sizeByCategory[category] = (stats.sizeByCategory[category] || 0) + fileStats.size;

        // Track largest and smallest files
        if (!stats.largestFile || fileStats.size > stats.largestFile.size) {
          stats.largestFile = { path: file, size: fileStats.size };
        }
        if (!stats.smallestFile || fileStats.size < stats.smallestFile.size) {
          stats.smallestFile = { path: file, size: fileStats.size };
        }
      } catch (error) {
        core.warning(`Could not get stats for file: ${file}`);
      }
    }

    stats.averageSize = stats.totalFiles > 0 ? stats.totalSize / stats.totalFiles : 0;

    return stats;
  }

  /**
   * Get file category based on extension and path
   * @param {string} filePath - Path to the file
   * @returns {string} File category
   */
  getFileCategory(filePath) {
    const extension = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);

    // Check for test files first (by filename or path)
    if (fileName.includes('test') || fileName.includes('spec') || filePath.includes('/test/') || filePath.includes('/tests/')) {
      if (extension === '.js' || extension === '.jsx') return 'test-javascript';
      if (extension === '.ts' || extension === '.tsx') return 'test-typescript';
      if (extension === '.py') return 'test-python';
      if (extension === '.java') return 'test-java';
      return 'test';
    }

    // Check for config files by filename pattern
    if (fileName.includes('config') || fileName.includes('webpack') || fileName.includes('jest') || 
        fileName.includes('babel') || fileName.includes('eslint') || fileName.includes('prettier') ||
        fileName.includes('rollup') || fileName.includes('vite') || fileName.includes('parcel')) {
      if (extension === '.js' || extension === '.ts') return 'config-javascript';
      if (extension === '.json') return 'config-json';
      if (extension === '.yaml' || extension === '.yml') return 'config-yaml';
      return 'config';
    }

    // Check for generated files
    if (fileName.includes('.min.') || fileName.includes('.bundle.') || fileName.includes('.map')) {
      if (extension === '.js' || extension === '.jsx') return 'generated-javascript';
      if (extension === '.css') return 'generated-css';
      return 'generated';
    }

    // Check for specific categories
    if (extension === '.js' || extension === '.jsx') return 'javascript';
    if (extension === '.ts' || extension === '.tsx') return 'typescript';
    if (extension === '.py') return 'python';
    if (extension === '.java') return 'java';
    if (extension === '.cs') return 'csharp';
    if (extension === '.php') return 'php';
    if (extension === '.rb') return 'ruby';
    if (extension === '.go') return 'golang';
    if (extension === '.rs') return 'rust';
    if (extension === '.cpp' || extension === '.cc' || extension === '.cxx') return 'cpp';
    if (extension === '.c') return 'c';
    if (extension === '.h' || extension === '.hpp') return 'header';
    if (extension === '.css' || extension === '.scss' || extension === '.sass') return 'styles';
    if (extension === '.html' || extension === '.htm') return 'html';
    if (extension === '.json') return 'json';
    if (extension === '.xml') return 'xml';
    if (extension === '.md') return 'markdown';
    if (extension === '.txt') return 'text';
    if (extension === '.sh' || extension === '.bash' || extension === '.zsh') return 'shell';
    if (extension === '.sql') return 'sql';
    if (extension === '.yaml' || extension === '.yml') return 'yaml';
    if (extension === '.toml') return 'toml';
    if (extension === '.ini') return 'ini';
    if (extension === '.conf') return 'config';
    if (extension === '.log') return 'log';
    if (extension === '.env') return 'environment';
    if (extension === '.key' || extension === '.pem' || extension === '.p12' || extension === '.pfx') return 'security';
    if (extension === '.jpg' || extension === '.jpeg' || extension === '.png' || extension === '.gif' || extension === '.svg') return 'image';
    if (extension === '.exe' || extension === '.dll' || extension === '.so' || extension === '.jar') return 'binary';
    if (extension === '.zip' || extension === '.tar' || extension === '.gz') return 'archive';
    if (extension === '.db' || extension === '.sqlite') return 'database';

    return 'other';
  }

  /**
   * Map detailed file type to simplified category for enhanced file counting
   * @param {string} fileType - Detailed file type from getFileCategory
   * @returns {string} Simplified category
   */
  mapFileTypeToCategory(fileType) {
    // Code files
    if (['javascript', 'typescript', 'python', 'java', 'csharp', 'php', 'ruby', 'golang', 'rust', 'cpp', 'c', 'header'].includes(fileType)) {
      return 'code';
    }
    
    // Configuration files
    if (['json', 'xml', 'yaml', 'toml', 'ini', 'config', 'environment', 'config-javascript', 'config-json', 'config-yaml'].includes(fileType)) {
      return 'config';
    }
    
    // Test files
    if (fileType.includes('test') || fileType.includes('spec') || fileType.startsWith('test-')) {
      return 'test';
    }
    
    // Documentation files
    if (['markdown', 'text', 'html'].includes(fileType)) {
      return 'documentation';
    }
    
    // Build files
    if (['binary', 'archive', 'database', 'log', 'generated', 'generated-javascript', 'generated-css'].includes(fileType)) {
      return 'build';
    }
    
    // Styles
    if (fileType === 'styles') {
      return 'styles';
    }
    
    return 'other';
  }

  /**
   * Format file size in human readable format
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted file size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Validate filter configuration
   * @returns {Object} Validation result
   */
  validateConfig() {
    const errors = [];
    const warnings = [];

    // Check required fields
    if (this.config.maxFileSize <= 0) {
      errors.push('maxFileSize must be greater than 0');
    }

    if (this.config.maxFiles <= 0) {
      errors.push('maxFiles must be greater than 0');
    }

    // Check for reasonable limits
    if (this.config.maxFileSize > 100 * 1024 * 1024) { // 100MB
      warnings.push('maxFileSize is very large (>100MB), consider reducing for performance');
    }

    if (this.config.maxFiles > 1000) {
      warnings.push('maxFiles is very large (>1000), consider reducing for performance');
    }

    // Validate patterns
    for (const [category, pattern] of Object.entries(this.config.excludePatterns)) {
      try {
        new RegExp(pattern);
      } catch (error) {
        errors.push(`Invalid regex pattern for ${category}: ${pattern}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get filter configuration summary
   * @returns {Object} Configuration summary
   */
  getConfigSummary() {
    return {
      maxFileSize: this.config.maxFileSize,
      maxFiles: this.config.maxFiles,
      excludePatterns: Object.keys(this.config.excludePatterns),
      excludeExtensions: this.config.excludeExtensions,
      excludeDirectories: this.config.excludeDirectories,
      excludeFileNames: this.config.excludeFileNames,
      includePatterns: this.config.includePatterns
    };
  }

  /**
   * Enhanced file counting with detailed statistics and validation
   * @param {Array<Object>} files - Array of file objects with metadata
   * @param {Object} options - Counting options
   * @returns {Object} Comprehensive file count analysis
   */
  getEnhancedFileCount(files, options = {}) {
    const analysis = {
      // Basic counts
      totalFiles: files.length,
      includedFiles: 0,
      excludedFiles: 0,
      
      // File type breakdown
      byType: {
        code: 0,
        config: 0,
        test: 0,
        documentation: 0,
        styles: 0,
        build: 0,
        other: 0
      },
      
      // Size analysis
      bySize: {
        small: 0,      // < 1KB
        medium: 0,     // 1KB - 10KB
        large: 0,      // 10KB - 100KB
        xlarge: 0      // > 100KB
      },
      
      // Line count analysis
      byLines: {
        short: 0,      // < 50 lines
        medium: 0,     // 50-200 lines
        long: 0,       // 200-500 lines
        xlong: 0       // > 500 lines
      },
      
      // Status analysis
      byStatus: {
        added: 0,
        modified: 0,
        deleted: 0,
        renamed: 0
      },
      
      // Priority analysis
      byPriority: {
        high: 0,       // Priority > 100
        medium: 0,     // Priority 50-100
        low: 0         // Priority < 50
      },
      
      // Validation results
      validation: {
        valid: 0,
        invalid: 0,
        errors: []
      },
      
      // Summary statistics
      summary: {
        totalSize: 0,
        totalLines: 0,
        averageSize: 0,
        averageLines: 0,
        largestFile: null,
        smallestFile: null,
        mostComplexFile: null
      }
    };

    let totalSize = 0;
    let totalLines = 0;
    let largestFile = null;
    let smallestFile = null;
    let mostComplexFile = null;

    for (const file of files) {
      const filePath = file.filename || file.path || '';
      const fileSize = file.size || 0;
      const fileLines = file.lines || 0;
      const fileStatus = file.status || 'unknown';
      const filePriority = file.priority || 0;

      // Validate file data integrity
      const validation = this.validateFileData(file);
      if (validation.isValid) {
        analysis.validation.valid++;
      } else {
        analysis.validation.invalid++;
        analysis.validation.errors.push({
          file: filePath,
          error: validation.error,
          field: validation.field
        });
      }

      // Count included/excluded files (simplified for testing)
      try {
        const excludeResult = this.shouldExcludeFile(filePath);
        if (excludeResult.shouldExclude) {
          analysis.excludedFiles++;
        } else {
          analysis.includedFiles++;
        }
      } catch (error) {
        // If path operations fail (e.g., in tests), assume all files are included
        analysis.includedFiles++;
      }

      // Count by file type
      const fileType = this.getFileCategory(filePath);
      const mappedType = this.mapFileTypeToCategory(fileType);
      if (analysis.byType.hasOwnProperty(mappedType)) {
        analysis.byType[mappedType]++;
      } else {
        analysis.byType.other++;
      }

      // Count by size
      if (fileSize < 1024) {
        analysis.bySize.small++;
      } else if (fileSize < 10240) {
        analysis.bySize.medium++;
      } else if (fileSize < 102400) {
        analysis.bySize.large++;
      } else {
        analysis.bySize.xlarge++;
      }

      // Count by lines
      if (fileLines < 50) {
        analysis.byLines.short++;
      } else if (fileLines < 200) {
        analysis.byLines.medium++;
      } else if (fileLines < 500) {
        analysis.byLines.long++;
      } else {
        analysis.byLines.xlong++;
      }

      // Count by status
      if (analysis.byStatus.hasOwnProperty(fileStatus)) {
        analysis.byStatus[fileStatus]++;
      }

      // Count by priority
      if (filePriority > 100) {
        analysis.byPriority.high++;
      } else if (filePriority > 50) {
        analysis.byPriority.medium++;
      } else {
        analysis.byPriority.low++;
      }

      // Track summary statistics
      totalSize += fileSize;
      totalLines += fileLines;

      if (!largestFile || fileSize > largestFile.size) {
        largestFile = { path: filePath, size: fileSize, lines: fileLines };
      }

      if (!smallestFile || fileSize < smallestFile.size) {
        smallestFile = { path: filePath, size: fileSize, lines: fileLines };
      }

      // Calculate complexity score (size + lines + priority)
      const complexity = fileSize + (fileLines * 100) + filePriority;
      if (!mostComplexFile || complexity > mostComplexFile.complexity) {
        mostComplexFile = { 
          path: filePath, 
          size: fileSize, 
          lines: fileLines, 
          priority: filePriority,
          complexity: complexity
        };
      }
    }

    // Calculate averages
    analysis.summary.totalSize = totalSize;
    analysis.summary.totalLines = totalLines;
    analysis.summary.averageSize = files.length > 0 ? Math.round(totalSize / files.length) : 0;
    analysis.summary.averageLines = files.length > 0 ? Math.round(totalLines / files.length) : 0;
    analysis.summary.largestFile = largestFile ? largestFile.path : null;
    analysis.summary.smallestFile = smallestFile ? smallestFile.path : null;
    analysis.summary.mostComplexFile = mostComplexFile ? mostComplexFile.path : null;

    return analysis;
  }

  /**
   * Validate file data integrity
   * @param {Object} file - File object to validate
   * @returns {Object} Validation result
   */
  validateFileData(file) {
    const errors = [];
    
    // Check required fields
    if (!file.filename && !file.path) {
      errors.push('Missing filename or path');
    }
    
    // Validate size
    if (typeof file.size !== 'number' || file.size < 0) {
      errors.push('Invalid file size');
    }
    
    // Validate lines
    if (typeof file.lines !== 'number' || file.lines < 0) {
      errors.push('Invalid line count');
    }
    
    // Validate status
    if (file.status && !['added', 'modified', 'deleted', 'renamed'].includes(file.status)) {
      errors.push('Invalid file status');
    }

    return {
      isValid: errors.length === 0,
      error: errors.join(', '),
      field: errors.length > 0 ? errors[0] : null
    };
  }

  /**
   * Get file count summary for reporting
   * @param {Array<Object>} files - Array of file objects
   * @returns {Object} File count summary
   */
  getFileCountSummary(files) {
    const analysis = this.getEnhancedFileCount(files);
    
    return {
      // Primary counts
      totalFiles: analysis.totalFiles,
      includedFiles: analysis.includedFiles,
      excludedFiles: analysis.excludedFiles,
      
      // Key metrics
      codeFiles: analysis.byType.code,
      testFiles: analysis.byType.test,
      configFiles: analysis.byType.config,
      
      // Size metrics
      totalSize: this.formatFileSize(analysis.summary.totalSize),
      averageSize: this.formatFileSize(analysis.summary.averageSize),
      
      // Line metrics
      totalLines: analysis.summary.totalLines,
      averageLines: analysis.summary.averageLines,
      
      // Quality indicators
      dataIntegrity: `${analysis.validation.valid}/${analysis.totalFiles} files have valid data`,
      complexity: this.assessComplexity(analysis),
      reviewEfficiency: this.calculateReviewEfficiency(analysis)
    };
  }

  /**
   * Assess overall complexity of the file set
   * @param {Object} analysis - File count analysis
   * @returns {string} Complexity assessment
   */
  assessComplexity(analysis) {
    const largeFiles = analysis.bySize.large + analysis.bySize.xlarge;
    const longFiles = analysis.byLines.long + analysis.byLines.xlong;
    const highPriorityFiles = analysis.byPriority.high;
    
    if (largeFiles > 5 || longFiles > 10 || highPriorityFiles > 8) {
      return 'HIGH - Complex review required';
    } else if (largeFiles > 2 || longFiles > 5 || highPriorityFiles > 4) {
      return 'MEDIUM - Moderate complexity';
    } else {
      return 'LOW - Simple review';
    }
  }

  /**
   * Calculate review efficiency score
   * @param {Object} analysis - File count analysis
   * @returns {string} Efficiency assessment
   */
  calculateReviewEfficiency(analysis) {
    const totalFiles = analysis.totalFiles;
    const codeFiles = analysis.byType.code;
    const testFiles = analysis.byType.test;
    const smallFiles = analysis.bySize.small + analysis.bySize.medium;
    
    if (totalFiles === 0) return 'N/A';
    
    // Efficiency factors: more code files, smaller files, fewer total files
    const codeRatio = codeFiles / totalFiles;
    const sizeEfficiency = smallFiles / totalFiles;
    const fileCountEfficiency = Math.max(0, 1 - (totalFiles / 100)); // Fewer files = better
    
    const efficiency = (codeRatio * 0.4) + (sizeEfficiency * 0.3) + (fileCountEfficiency * 0.3);
    
    if (efficiency > 0.7) return 'HIGH - Optimal for review';
    else if (efficiency > 0.5) return 'MEDIUM - Good for review';
    else return 'LOW - May need optimization';
  }

  /**
   * Generate file count report
   * @param {Array<Object>} files - Array of file objects
   * @returns {string} Formatted report
   */
  generateFileCountReport(files) {
    const analysis = this.getEnhancedFileCount(files);
    const summary = this.getFileCountSummary(files);
    
    const report = [
      '📊 FILE COUNT ANALYSIS REPORT',
      '='.repeat(50),
      '',
      `📁 Total Files: ${summary.totalFiles}`,
      `✅ Included: ${summary.includedFiles}`,
      `❌ Excluded: ${summary.excludedFiles}`,
      '',
      '📋 BY TYPE:',
      `   Code: ${analysis.byType.code}`,
      `   Test: ${analysis.byType.test}`,
      `   Config: ${analysis.byType.config}`,
      `   Documentation: ${analysis.byType.documentation}`,
      `   Build: ${analysis.byType.build}`,
      `   Other: ${analysis.byType.other}`,
      '',
      '📏 BY SIZE:',
      `   Small (<1KB): ${analysis.bySize.small}`,
      `   Medium (1-10KB): ${analysis.bySize.medium}`,
      `   Large (10-100KB): ${analysis.bySize.large}`,
      `   XLarge (>100KB): ${analysis.bySize.xlarge}`,
      '',
      '📝 BY LINES:',
      `   Short (<50): ${analysis.byLines.short}`,
      `   Medium (50-200): ${analysis.byLines.medium}`,
      `   Long (200-500): ${analysis.byLines.long}`,
      `   XLong (>500): ${analysis.byLines.xlong}`,
      '',
      '🎯 QUALITY INDICATORS:',
      `   Data Integrity: ${summary.dataIntegrity}`,
      `   Complexity: ${summary.complexity}`,
      `   Review Efficiency: ${summary.reviewEfficiency}`,
      '',
      '📈 SUMMARY:',
      `   Total Size: ${summary.totalSize}`,
      `   Total Lines: ${summary.totalLines}`,
      `   Average Size: ${summary.averageSize}`,
      `   Average Lines: ${summary.averageLines}`
    ].join('\n');
    
    return report;
  }
}

module.exports = FileFilter;



