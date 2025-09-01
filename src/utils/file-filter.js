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
}

module.exports = FileFilter;



