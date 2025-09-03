#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class CodeQualityCLI {
  constructor() {
    this.config = this.loadConfig();
    this.results = {
      startTime: Date.now(),
      checks: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0
      }
    };
  }

  loadConfig() {
    const configPath = path.join(process.cwd(), '.codequalityrc.js');
    if (fs.existsSync(configPath)) {
      return require(configPath);
    }
    return this.getDefaultConfig();
  }

  getDefaultConfig() {
    return {
      thresholds: {
        coverage: { statements: 80, branches: 75, functions: 80, lines: 80 },
        complexity: { maxCyclomaticComplexity: 10, maxDepth: 4, maxLines: 300, maxLinesPerFunction: 50, maxParams: 5, maxStatements: 20 }
      },
      qualityGates: {
        preCommit: ['lint', 'format', 'test:unit', 'coverage:threshold'],
        prePush: ['lint', 'format', 'test:all', 'coverage:threshold', 'security:audit'],
        ci: ['lint', 'format', 'test:all', 'coverage:threshold', 'security:audit', 'performance:benchmark']
      }
    };
  }

  async runCheck(checkName, command, options = {}) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      console.log(`\n🔍 Running: ${checkName}`);
      
      try {
        const child = spawn(command, options.args || [], {
          shell: true,
          stdio: 'pipe'
        });
        
        let stdout = '';
        let stderr = '';
        
        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        const timeout = setTimeout(() => {
          child.kill('SIGTERM');
          const duration = Date.now() - startTime;
          resolve({
            name: checkName,
            success: false,
            error: `Timeout after ${options.timeout || 30000}ms`,
            duration,
            stdout,
            stderr
          });
        }, options.timeout || 30000);
        
        child.on('close', (code) => {
          clearTimeout(timeout);
          const duration = Date.now() - startTime;
          
          if (code === 0) {
            resolve({
              name: checkName,
              success: true,
              duration,
              stdout,
              stderr
            });
          } else {
            resolve({
              name: checkName,
              success: false,
              error: `Process exited with code ${code}`,
              duration,
              stdout,
              stderr
            });
          }
        });
        
        child.on('error', (error) => {
          clearTimeout(timeout);
          const duration = Date.now() - startTime;
          resolve({
            name: checkName,
            success: false,
            error: error.message,
            duration
          });
        });
        
      } catch (error) {
        const duration = Date.now() - startTime;
        resolve({
          name: checkName,
          success: false,
          error: error.message,
          duration
        });
      }
    });
  }

  async runLinting() {
    return this.runCheck('ESLint Linting', 'npm run lint', {
      timeout: 30000
    });
  }

  async runFormatting() {
    return this.runCheck('Prettier Formatting', 'npm run format:check', {
      timeout: 15000
    });
  }

  async runSecurityAudit() {
    return this.runCheck('Security Audit', 'npm audit --audit-level=moderate', {
      timeout: 60000
    });
  }

  async runDependencyCheck() {
    return this.runCheck('Dependency Check', 'npm outdated', {
      timeout: 30000
    });
  }

  async runUnitTests() {
    return this.runCheck('Unit Tests', 'npm run test:unit', {
      timeout: 60000
    });
  }

  async runCoverageCheck() {
    return this.runCheck('Coverage Analysis', 'npm run test:coverage', {
      timeout: 120000
    });
  }

  async runQualityGates(gateType = 'ci') {
    const gates = this.config.qualityGates[gateType] || this.config.qualityGates.ci;
    console.log(`\n🚪 Running Quality Gates: ${gateType.toUpperCase()}`);
    
    const results = [];
    
    for (const gate of gates) {
      let result;
      
      switch (gate) {
        case 'lint':
          result = await this.runLinting();
          break;
        case 'format':
          result = await this.runFormatting();
          break;
        case 'test:unit':
          result = await this.runUnitTests();
          break;
        case 'test:all':
          result = await this.runCheck('All Tests', 'npm run test:all', { timeout: 300000 });
          break;
        case 'coverage:threshold':
          result = await this.runCoverageCheck();
          break;
        case 'security:audit':
          result = await this.runSecurityAudit();
          break;
        case 'performance:benchmark':
          result = await this.runCheck('Performance Tests', 'npm run test:performance', { timeout: 300000 });
          break;
        default:
          result = {
            name: gate,
            success: false,
            error: 'Unknown quality gate',
            duration: 0
          };
      }
      
      results.push(result);
      this.results.checks.push(result);
      
      if (result.success) {
        this.results.summary.passed++;
        console.log(`✅ ${gate}: PASSED`);
      } else {
        this.results.summary.failed++;
        console.log(`❌ ${gate}: FAILED - ${result.error}`);
      }
      
      this.results.summary.total++;
    }
    
    return results;
  }

  async runAllChecks() {
    console.log('🧪 AI REVIEW SYSTEM - CODE QUALITY CHECKS');
    console.log('='.repeat(60));
    
    const checks = [
      await this.runLinting(),
      await this.runFormatting(),
      await this.runSecurityAudit(),
      await this.runDependencyCheck(),
      await this.runUnitTests(),
      await this.runCoverageCheck()
    ];
    
    this.results.checks = checks;
    this.results.summary.total = checks.length;
    this.results.summary.passed = checks.filter(c => c.success).length;
    this.results.summary.failed = checks.filter(c => !c.success).length;
    
    this.printSummary();
    return checks;
  }

  printSummary() {
    const totalTime = Date.now() - this.results.startTime;
    const { total, passed, failed } = this.results.summary;
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 CODE QUALITY SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Checks: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️ Total Time: ${Math.round(totalTime / 1000)}s`);
    
    if (failed > 0) {
      console.log('\n❌ Some quality checks failed:');
      this.results.checks
        .filter(c => !c.success)
        .forEach(check => {
          console.log(`   - ${check.name}: ${check.error}`);
        });
    } else {
      console.log('\n🎉 All quality checks passed!');
    }
    
    console.log('='.repeat(60));
  }

  showHelp() {
    console.log('Usage: node src/cli/code-quality-cli.js [options]');
    console.log('\nOptions:');
    console.log('  --help, -h           Show this help message');
    console.log('  --all                Run all quality checks');
    console.log('  --gates <type>       Run quality gates (preCommit, prePush, ci)');
    console.log('  --lint               Run linting only');
    console.log('  --format             Run formatting check only');
    console.log('  --security           Run security audit only');
    console.log('  --tests              Run tests only');
    console.log('  --coverage           Run coverage analysis only');
    console.log('\nExamples:');
    console.log('  node src/cli/code-quality-cli.js --all');
    console.log('  node src/cli/code-quality-cli.js --gates preCommit');
    console.log('  node src/cli/code-quality-cli.js --lint --format');
  }

  async execute(options) {
    if (options.all) {
      return await this.runAllChecks();
    } else if (options.gates) {
      return await this.runQualityGates(options.gates);
    } else if (options.lint) {
      return [await this.runLinting()];
    } else if (options.format) {
      return [await this.runFormatting()];
    } else if (options.security) {
      return [await this.runSecurityAudit()];
    } else if (options.tests) {
      return [await this.runUnitTests()];
    } else if (options.coverage) {
      return [await this.runCoverageCheck()];
    } else {
      this.showHelp();
      return [];
    }
  }

  parseArguments() {
    const args = process.argv.slice(2);
    const options = {};
    
    if (args.includes('--help') || args.includes('-h')) {
      options.help = true;
    }
    if (args.includes('--all')) {
      options.all = true;
    }
    if (args.includes('--gates')) {
      const gatesIndex = args.indexOf('--gates');
      options.gates = args[gatesIndex + 1];
    }
    if (args.includes('--lint')) {
      options.lint = true;
    }
    if (args.includes('--format')) {
      options.format = true;
    }
    if (args.includes('--security')) {
      options.security = true;
    }
    if (args.includes('--tests')) {
      options.tests = true;
    }
    if (args.includes('--coverage')) {
      options.coverage = true;
    }
    
    return options;
  }

  async run() {
    try {
      const options = this.parseArguments();
      
      if (options.help) {
        this.showHelp();
        return;
      }
      
      const results = await this.execute(options);
      
      // Exit with appropriate code
      if (this.results.summary.failed > 0) {
        process.exit(1);
      } else {
        process.exit(0);
      }
      
    } catch (error) {
      console.error(`\n💥 Code quality check failed: ${error.message}`);
      console.error(error.stack);
      process.exit(1);
    }
  }
}

if (require.main === module) {
  const cli = new CodeQualityCLI();
  cli.run();
}

module.exports = CodeQualityCLI;
