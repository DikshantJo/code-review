// Jest setup file for AI Code Review System tests

// Global test timeout
jest.setTimeout(10000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock process.env
process.env.NODE_ENV = 'test';

// Mock fs module globally
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    readdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    appendFile: jest.fn(),
    stat: jest.fn(),
    unlink: jest.fn(),
    rename: jest.fn()
  },
  constants: {
    O_RDONLY: 0,
    O_WRONLY: 1,
    O_RDWR: 2
  }
}));

// Mock path module
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  resolve: jest.fn((...args) => args.join('/')),
  dirname: jest.fn((path) => path.split('/').slice(0, -1).join('/')),
  basename: jest.fn((path) => path.split('/').pop()),
  extname: jest.fn((path) => {
    const ext = path.split('.').pop();
    return ext === path ? '' : `.${ext}`;
  })
}));

// Mock crypto module
jest.mock('crypto', () => ({
  randomBytes: jest.fn().mockReturnValue({
    toString: jest.fn().mockReturnValue('mock-random-string')
  }),
  createHash: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue('mock-hash')
  })
}));

// Mock https module
jest.mock('https', () => ({
  request: jest.fn()
}));

// Mock http module
jest.mock('http', () => ({
  request: jest.fn()
}));

// Mock net module
jest.mock('net', () => ({
  Socket: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    on: jest.fn(),
    write: jest.fn(),
    end: jest.fn()
  }))
}));

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({
      messageId: 'mock-message-id'
    }),
    verify: jest.fn().mockResolvedValue(true)
  })
}));

// Mock @actions/core
jest.mock('@actions/core', () => ({
  getInput: jest.fn(),
  setOutput: jest.fn(),
  setFailed: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  startGroup: jest.fn(),
  endGroup: jest.fn(),
  isDebug: jest.fn().mockReturnValue(false)
}));

// Mock @actions/github
jest.mock('@actions/github', () => ({
  getOctokit: jest.fn().mockReturnValue({
    rest: {
      issues: {
        create: jest.fn().mockResolvedValue({
          data: { id: 123, number: 456, html_url: 'https://github.com/test/issue/456' }
        }),
        update: jest.fn().mockResolvedValue({}),
        addLabels: jest.fn().mockResolvedValue({}),
        addAssignees: jest.fn().mockResolvedValue({})
      },
      pulls: {
        get: jest.fn().mockResolvedValue({
          data: {
            number: 123,
            title: 'Test PR',
            body: 'Test body',
            user: { login: 'testuser' },
            head: { ref: 'feature-branch' },
            base: { ref: 'main' }
          }
        }),
        listFiles: jest.fn().mockResolvedValue({
          data: [
            { filename: 'test.js', status: 'modified', additions: 10, deletions: 5 },
            { filename: 'config.json', status: 'added', additions: 20, deletions: 0 }
          ]
        })
      },
      repos: {
        getCommit: jest.fn().mockResolvedValue({
          data: {
            sha: 'abc123',
            commit: {
              message: 'Test commit',
              author: { name: 'Test User', email: 'test@example.com' }
            },
            files: [
              { filename: 'test.js', status: 'modified', additions: 10, deletions: 5 },
              { filename: 'config.json', status: 'added', additions: 20, deletions: 0 }
            ]
          }
        }),
        compareCommits: jest.fn().mockResolvedValue({
          data: {
            files: [
              { filename: 'test.js', status: 'modified', additions: 10, deletions: 5 },
              { filename: 'config.json', status: 'added', additions: 20, deletions: 0 }
            ]
          }
        })
      }
    }
  }),
  context: {
    eventName: 'pull_request',
    payload: {
      pull_request: {
        number: 123,
        title: 'Test PR',
        body: 'Test body',
        user: { login: 'testuser' },
        head: { ref: 'feature-branch' },
        base: { ref: 'main' }
      },
      repository: {
        owner: { login: 'testowner' },
        name: 'testrepo'
      }
    },
    repo: {
      owner: 'testowner',
      repo: 'testrepo'
    },
    issue: {
      owner: 'testowner',
      repo: 'testrepo',
      number: 123
    }
  }
}));

// Mock @actions/exec
jest.mock('@actions/exec', () => ({
  exec: jest.fn().mockResolvedValue(0),
  getExecOutput: jest.fn().mockResolvedValue({
    exitCode: 0,
    stdout: 'mock stdout',
    stderr: 'mock stderr'
  })
}));

// Mock @actions/io
jest.mock('@actions/io', () => ({
  mkdirP: jest.fn().mockResolvedValue(undefined),
  rmRF: jest.fn().mockResolvedValue(undefined),
  which: jest.fn().mockResolvedValue('/usr/bin/git')
}));

// Global test utilities
global.testUtils = {
  // Create mock configuration
  createMockConfig: () => ({
    openai: {
      api_key: 'test-api-key',
      model: 'gpt-4',
      max_tokens: 4000,
      temperature: 0.1
    },
    github: {
      token: 'test-github-token',
      owner: 'testowner',
      repo: 'testrepo'
    },
    review: {
      enabled: true,
      severity_thresholds: {
        high: 1,
        medium: 3,
        low: 5
      },
      min_quality_score: 0.7,
      max_files_per_review: 50,
      skip_large_commits: false,
      large_commit_threshold: 100
    },
    notifications: {
      email: {
        enabled: true,
        smtp_host: 'smtp.test.com',
        smtp_port: 587,
        smtp_user: 'test@test.com',
        smtp_pass: 'test-password',
        from_email: 'ai-review@test.com',
        to_emails: ['team-lead@test.com']
      },
      github_issues: {
        enabled: true,
        assignees: ['team-lead'],
        labels: ['ai-review', 'automated']
      }
    },
    logging: {
      level: 'INFO',
      audit_trail: true,
      performance_metrics: true,
      error_reporting: true,
      log_retention_days: 30
    },
    monitoring: {
      dashboard_dir: './test-dashboard',
      dashboard_url: 'http://localhost:3000',
      auto_refresh_interval: 30,
      alerts: {
        response_time_threshold: 60000,
        error_rate_threshold: 0.1,
        quality_score_threshold: 0.6,
        cost_threshold: 5.0,
        failure_rate_threshold: 0.05,
        volume_threshold: 100,
        email: { enabled: true },
        slack: { enabled: false },
        github: { enabled: true },
        webhook: { enabled: false }
      }
    }
  }),

  // Create mock review result
  createMockReviewResult: (passed = true) => ({
    passed,
    issues: passed ? [] : [
      {
        severity: 'high',
        category: 'security',
        message: 'Potential SQL injection vulnerability',
        line: 15,
        file: 'test.js'
      }
    ],
    qualityScore: passed ? 0.9 : 0.4,
    summary: passed ? 'Code review passed' : 'Code review failed',
    recommendations: passed ? [] : ['Fix SQL injection vulnerability'],
    aiResponseTime: 2500,
    costEstimate: 0.05,
    filesReviewed: 2,
    linesOfCode: 50,
    reviewCoverage: 100
  }),

  // Create mock file changes
  createMockFileChanges: () => [
    {
      filename: 'src/test.js',
      status: 'modified',
      additions: 10,
      deletions: 5,
      patch: '@@ -1,5 +1,10 @@\n+ // New code\n+ function test() {\n+   return true;\n+ }\n'
    },
    {
      filename: 'config.json',
      status: 'added',
      additions: 20,
      deletions: 0,
      patch: '@@ -0,0 +1,20 @@\n+{\n+  "test": true,\n+  "config": "value"\n+}'
    }
  ],

  // Create mock audit log entry
  createMockAuditLogEntry: (eventType = 'ai_review_completed') => ({
    timestamp: new Date().toISOString(),
    event_type: eventType,
    user: 'testuser',
    data: {
      review_id: 'test-review-123',
      passed: true,
      quality_score: 0.9
    }
  }),

  // Wait for async operations
  waitFor: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Mock file system operations
  mockFileSystem: {
    files: new Map(),
    directories: new Set(),
    
    reset: function() {
      this.files.clear();
      this.directories.clear();
    },
    
    addFile: function(path, content) {
      this.files.set(path, content);
    },
    
    addDirectory: function(path) {
      this.directories.add(path);
    },
    
    exists: function(path) {
      return this.files.has(path) || this.directories.has(path);
    },
    
    getContent: function(path) {
      return this.files.get(path);
    }
  }
};

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
  global.testUtils.mockFileSystem.reset();
});

// Global test teardown
afterAll(() => {
  jest.restoreAllMocks();
});



