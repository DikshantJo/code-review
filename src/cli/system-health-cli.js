#!/usr/bin/env node

/**
 * System Health CLI for AI Code Review System
 * Tests system health and validates all components before deployment
 * Usage: node src/cli/system-health-cli.js [options]
 */

const SystemHealthChecker = require('../utils/system-health-checker');
const path = require('path');
const fs = require('fs');

class SystemHealthCLI {
  constructor() {
    this.healthChecker = new SystemHealthChecker();
    this.config = this.loadConfig();
  }

  /**
   * Load system configuration
   * @returns {Object} Configuration object
   */
  loadConfig() {
    try {
      // Try to load from various possible locations
      const configPaths = [
        '.codequalityrc.js',
        'config/default.js',
        'config/config.js'
      ];

      for (const configPath of configPaths) {
        if (fs.existsSync(configPath)) {
          const config = require(path.resolve(configPath));
          console.log(`📁 Loaded configuration from: ${configPath}`);
          return config;
        }
      }

      // Return default configuration if none found
      console.log('⚠️  No configuration file found, using defaults');
      return this.getDefaultConfig();
      
    } catch (error) {
      console.log('⚠️  Failed to load configuration, using defaults');
      return this.getDefaultConfig();
    }
  }

  /**
   * Get default configuration
   * @returns {Object} Default configuration
   */
  getDefaultConfig() {
    return {
      ai: {
        max_files_per_review: 50,
        max_file_size_bytes: 1024 * 1024,
        max_total_size_bytes: 5 * 1024 * 1024,
        max_tokens: 4000
      },
      fallbacks: {
        enabled: true,
        max_attempts: 3,
        strategies: ['retry', 'simplified', 'manual']
      },
      logging: {
        level: 'info',
        enabled: true
      }
    };
  }

  /**
   * Parse command line arguments
   * @returns {Object} Parsed arguments
   */
  parseArguments() {
    const args = process.argv.slice(2);
    const options = {
      verbose: false,
      output: null,
      fix: false,
      component: null
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      switch (arg) {
        case '--verbose':
        case '-v':
          options.verbose = true;
          break;
          
        case '--output':
        case '-o':
          options.output = args[++i];
          break;
          
        case '--fix':
        case '-f':
          options.fix = true;
          break;
          
        case '--component':
        case '-c':
          options.component = args[++i];
          break;
          
        case '--help':
        case '-h':
          this.showHelp();
          process.exit(0);
          break;
          
        default:
          if (!arg.startsWith('-')) {
            options.component = arg;
          }
          break;
      }
    }

    return options;
  }

  /**
   * Show help information
   */
  showHelp() {
    console.log(`
🔍 System Health CLI - AI Code Review System

Usage: node src/cli/system-health-cli.js [options]

Options:
  -v, --verbose           Enable verbose output
  -o, --output <file>     Save health report to file
  -f, --fix               Attempt to fix issues automatically
  -c, --component <name>  Check specific component only
  -h, --help              Show this help message

Examples:
  node src/cli/system-health-cli.js                    # Full system check
  node src/cli/system-health-cli.js --verbose          # Verbose output
  node src/cli/system-health-cli.js --component QualityGates  # Check specific component
  node src/cli/system-health-cli.js --output report.json  # Save report to file

Components:
  - QualityGates
  - FileFilter
  - AuditLogger
  - LargeCommitHandler
  - FallbackHandler
    `);
  }

  /**
   * Run the health check
   * @param {Object} options - CLI options
   */
  async run(options) {
    console.log('🚀 Starting System Health Check...\n');
    
    try {
      // Perform health check
      const healthStatus = await this.healthChecker.performHealthCheck(this.config);
      
      // Display results
      this.displayResults(healthStatus, options);
      
      // Save output if requested
      if (options.output) {
        this.saveOutput(healthStatus, options.output);
      }
      
      // Exit with appropriate code
      const exitCode = healthStatus.overall === 'critical' ? 1 : 0;
      process.exit(exitCode);
      
    } catch (error) {
      console.error('❌ Health check failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Display health check results
   * @param {Object} healthStatus - Health status object
   * @param {Object} options - CLI options
   */
  displayResults(healthStatus, options) {
    const summary = this.healthChecker.getHealthSummary();
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 SYSTEM HEALTH SUMMARY');
    console.log('='.repeat(60));
    
    // Overall status
    const statusEmoji = healthStatus.overall === 'healthy' ? '✅' : 
                       healthStatus.overall === 'degraded' ? '⚠️' : '❌';
    console.log(`Overall Status: ${statusEmoji} ${healthStatus.overall.toUpperCase()}`);
    
    // Component summary
    console.log(`\nComponents: ${summary.healthyComponents} healthy, ${summary.degradedComponents} degraded, ${summary.criticalComponents} critical`);
    console.log(`Total Issues: ${summary.issueCount}`);
    console.log(`Recommendations: ${summary.recommendationCount}`);
    
    // Detailed component status
    if (options.verbose) {
      console.log('\n' + '-'.repeat(60));
      console.log('🔍 DETAILED COMPONENT STATUS');
      console.log('-'.repeat(60));
      
      for (const [component, status] of Object.entries(healthStatus.components)) {
        const emoji = status.status === 'healthy' ? '✅' : 
                     status.status === 'degraded' ? '⚠️' : '❌';
        
        console.log(`\n${emoji} ${component}: ${status.status.toUpperCase()}`);
        
        if (status.methods) {
          console.log(`  Methods: ${status.total} available`);
          if (status.missing && status.missing.length > 0) {
            console.log(`  Missing: ${status.missing.join(', ')}`);
          }
        }
        
        if (status.error) {
          console.log(`  Error: ${status.error}`);
        }
        
        if (status.proxy) {
          console.log(`  Dynamic Proxy: Active`);
        }
      }
    }
    
    // Issues and recommendations
    if (healthStatus.issues.length > 0) {
      console.log('\n' + '-'.repeat(60));
      console.log('🚨 ISSUES FOUND');
      console.log('-'.repeat(60));
      
      for (const issue of healthStatus.issues) {
        const severityEmoji = issue.severity === 'critical' ? '❌' : '⚠️';
        console.log(`${severityEmoji} ${issue.component}: ${issue.error || issue.missing?.join(', ')}`);
      }
    }
    
    if (healthStatus.recommendations.length > 0) {
      console.log('\n' + '-'.repeat(60));
      console.log('💡 RECOMMENDATIONS');
      console.log('-'.repeat(60));
      
      for (const rec of healthStatus.recommendations) {
        console.log(`• ${rec}`);
      }
    }
    
    // Final verdict
    console.log('\n' + '='.repeat(60));
    if (healthStatus.overall === 'healthy') {
      console.log('🎉 SYSTEM IS HEALTHY AND READY FOR OPERATION!');
    } else if (healthStatus.overall === 'degraded') {
      console.log('⚠️  SYSTEM WILL OPERATE WITH REDUCED FUNCTIONALITY');
    } else {
      console.log('❌ SYSTEM HAS CRITICAL ISSUES - MUST BE RESOLVED BEFORE USE');
    }
    console.log('='.repeat(60));
  }

  /**
   * Save health report to file
   * @param {Object} healthStatus - Health status object
   * @param {string} outputPath - Output file path
   */
  saveOutput(healthStatus, outputPath) {
    try {
      const report = {
        timestamp: new Date().toISOString(),
        healthStatus: healthStatus,
        summary: this.healthChecker.getHealthSummary(),
        componentsNeedingAttention: this.healthChecker.getComponentsNeedingAttention()
      };
      
      fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
      console.log(`\n💾 Health report saved to: ${outputPath}`);
      
    } catch (error) {
      console.error(`❌ Failed to save report to ${outputPath}:`, error.message);
    }
  }

  /**
   * Main execution method
   */
  async execute() {
    const options = this.parseArguments();
    
    if (options.component) {
      console.log(`🔍 Checking specific component: ${options.component}`);
      // TODO: Implement single component check
    }
    
    await this.run(options);
  }
}

// Run CLI if called directly
if (require.main === module) {
  const cli = new SystemHealthCLI();
  cli.execute().catch(error => {
    console.error('❌ CLI execution failed:', error);
    process.exit(1);
  });
}

module.exports = SystemHealthCLI;
