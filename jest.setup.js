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

// Mock path module - Fixed to avoid circular dependencies
jest.mock('path', () => {
  // Store the original string methods to avoid recursion
  const originalSplit = String.prototype.split;
  const originalSlice = Array.prototype.slice;
  const originalPop = Array.prototype.pop;
  
  return {
    join: jest.fn((...args) => args.join('/')),
    resolve: jest.fn((...args) => args.join('/')),
    split: jest.fn((path, separator) => originalSplit.call(path, separator)),
    dirname: jest.fn((path) => {
      const parts = originalSplit.call(path, '/');
      return originalSlice.call(parts, 0, -1).join('/');
    }),
    basename: jest.fn((path) => {
      const parts = originalSplit.call(path, '/');
      return originalPop.call(parts);
    }),
    extname: jest.fn((path) => {
      const parts = originalSplit.call(path, '.');
      const ext = originalPop.call(parts);
      return ext === path ? '' : `.${ext}`;
    })
  };
});

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

// Global test setup
beforeAll(() => {
  console.log('✅ Global test setup completed');
});

// Global test teardown
afterAll(() => {
  console.log('✅ Global test teardown completed');
});
