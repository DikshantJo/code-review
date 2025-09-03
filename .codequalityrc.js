module.exports = {
  // Code quality thresholds
  thresholds: {
    // Test coverage thresholds
    coverage: {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80
    },
    
    // Code complexity thresholds
    complexity: {
      maxCyclomaticComplexity: 10,
      maxDepth: 4,
      maxLines: 300,
      maxLinesPerFunction: 50,
      maxParams: 5,
      maxStatements: 20
    },
    
    // Performance thresholds
    performance: {
      maxResponseTime: 1000, // ms
      maxMemoryUsage: 100, // MB
      maxCpuUsage: 80 // percentage
    },
    
    // Security thresholds
    security: {
      maxVulnerabilities: 0,
      maxSecurityIssues: 0,
      requireSecurityAudit: true
    }
  },
  
  // Quality gates configuration
  qualityGates: {
    // Pre-commit quality gates
    preCommit: [
      'lint',
      'format',
      'test:unit',
      'coverage:threshold'
    ],
    
    // Pre-push quality gates
    prePush: [
      'lint',
      'format',
      'test:all',
      'coverage:threshold',
      'security:audit'
    ],
    
    // CI/CD quality gates
    ci: [
      'lint',
      'format',
      'test:all',
      'coverage:threshold',
      'security:audit',
      'performance:benchmark'
    ]
  },
  
  // Code analysis tools
  tools: {
    // Static analysis
    static: {
      eslint: true,
      prettier: true,
      sonarqube: false, // Can be enabled if SonarQube is available
      codeql: false // Can be enabled if GitHub CodeQL is available
    },
    
    // Security scanning
    security: {
      npmAudit: true,
      snyk: false, // Can be enabled if Snyk is available
      dependencyCheck: true
    },
    
    // Performance analysis
    performance: {
      lighthouse: false, // For web applications
      webpackBundleAnalyzer: false, // For Node.js applications
      memoryLeakDetection: true
    },
    
    // Documentation quality
    documentation: {
      jsdoc: true,
      readme: true,
      apiDocs: true,
      changelog: true
    }
  },
  
  // File patterns for analysis
  patterns: {
    include: [
      'src/**/*.js',
      'tests/**/*.js',
      'scripts/**/*.js',
      '*.js'
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'test-results/**',
      '*.min.js',
      '*.bundle.js'
    ]
  },
  
  // Reporting configuration
  reporting: {
    output: {
      console: true,
      json: true,
      html: true,
      junit: true
    },
    thresholds: {
      failOnError: true,
      failOnWarning: false,
      failOnLow: false
    }
  }
};
