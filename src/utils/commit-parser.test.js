/**
 * Unit tests for CommitParser utility
 */

const CommitParser = require('./commit-parser');

// Mock @actions/core
jest.mock('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn()
}));

describe('CommitParser', () => {
  let commitParser;
  let mockCore;

  beforeEach(() => {
    mockCore = require('@actions/core');
    jest.clearAllMocks();
    commitParser = new CommitParser();
  });

  describe('Constructor', () => {
    test('should initialize with default options', () => {
      expect(commitParser.options.urgentKeywords).toEqual(['URGENT', 'EMERGENCY', 'CRITICAL']);
      expect(commitParser.options.overrideKeywords).toEqual(['OVERRIDE', 'BYPASS']);
      expect(commitParser.options.extractMetadata).toBe(true);
      expect(commitParser.options.extractTickets).toBe(true);
      expect(commitParser.options.extractConventionalType).toBe(true);
      expect(commitParser.options.enableLogging).toBe(true);
    });

    test('should initialize with custom options', () => {
      const customOptions = {
        urgentKeywords: ['EMERGENCY', 'CRITICAL'],
        overrideKeywords: ['BYPASS'],
        extractMetadata: false,
        extractTickets: false,
        extractConventionalType: false,
        enableLogging: false,
        logLevel: 'ERROR'
      };
      
      const parser = new CommitParser(customOptions);
      
      expect(parser.options.urgentKeywords).toEqual(['EMERGENCY', 'CRITICAL']);
      expect(parser.options.overrideKeywords).toEqual(['BYPASS']);
      expect(parser.options.extractMetadata).toBe(false);
      expect(parser.options.extractTickets).toBe(false);
      expect(parser.options.extractConventionalType).toBe(false);
      expect(parser.options.enableLogging).toBe(false);
    });
  });

  describe('parseCommit', () => {
    test('should parse conventional commit message', () => {
      const commitMessage = 'feat(auth): add user authentication\n\nThis adds JWT-based authentication for users.\n\nCloses #123';
      
      const result = commitParser.parseCommit(commitMessage);
      
      expect(result.type).toBe('feat');
      expect(result.scope).toBe('auth');
      expect(result.subject).toBe('feat(auth): add user authentication');
      expect(result.body).toBe('This adds JWT-based authentication for users.\n\nCloses #123');
      expect(result.clean).toBe('feat(auth): add user authentication\nThis adds JWT-based authentication for users.\nCloses #123');
    });

    test('should parse commit with urgency keyword', () => {
      const commitMessage = 'URGENT: Fix security vulnerability';
      
      const result = commitParser.parseCommit(commitMessage);
      
      expect(result.type).toBe('urgent');
      expect(result.urgency).toHaveLength(1);
      expect(result.urgency[0].keyword).toBe('URGENT');
      expect(result.urgency[0].level).toBe('high');
    });

    test('should parse commit with override keyword', () => {
      const commitMessage = 'OVERRIDE: Skip review for emergency fix';
      
      const result = commitParser.parseCommit(commitMessage);
      
      expect(result.overrides).toHaveLength(1);
      expect(result.overrides[0].keyword).toBe('OVERRIDE');
      expect(result.overrides[0].type).toBe('override');
    });

    test('should parse commit with ticket references', () => {
      const commitMessage = 'fix: resolve issue PROJ-123 and bug PROJ-456';
      
      const result = commitParser.parseCommit(commitMessage);
      
      expect(result.tickets).toContain('PROJ-123');
      expect(result.tickets).toContain('PROJ-456');
      expect(result.tickets).toHaveLength(2);
    });

    test('should handle empty commit message', () => {
      const result = commitParser.parseCommit('');
      
      expect(result.raw).toBe('');
      expect(result.clean).toBe('');
      expect(result.type).toBe('unknown');
      expect(result.tickets).toEqual([]);
      expect(result.overrides).toEqual([]);
      expect(result.urgency).toEqual([]);
    });

    test('should handle null commit message', () => {
      const result = commitParser.parseCommit(null);
      
      expect(result.raw).toBe('');
      expect(result.clean).toBe('');
      expect(result.type).toBe('unknown');
    });
  });

  describe('cleanCommitMessage', () => {
    test('should clean commit message', () => {
      const dirtyMessage = '  feat: add feature  \n\n\n  with extra spaces  \r\n\r\n';
      const cleanMessage = commitParser.cleanCommitMessage(dirtyMessage);
      
      expect(cleanMessage).toBe('feat: add feature\nwith extra spaces');
    });

    test('should handle empty message', () => {
      expect(commitParser.cleanCommitMessage('')).toBe('');
      expect(commitParser.cleanCommitMessage(null)).toBe('');
    });
  });

  describe('extractCommitType', () => {
    test('should extract conventional commit types', () => {
      expect(commitParser.extractCommitType('feat: add feature')).toBe('feat');
      expect(commitParser.extractCommitType('fix: bug fix')).toBe('fix');
      expect(commitParser.extractCommitType('docs: update readme')).toBe('docs');
      expect(commitParser.extractCommitType('style: format code')).toBe('style');
      expect(commitParser.extractCommitType('refactor: restructure')).toBe('refactor');
      expect(commitParser.extractCommitType('test: add tests')).toBe('test');
      expect(commitParser.extractCommitType('chore: update deps')).toBe('chore');
    });

    test('should extract type with scope', () => {
      expect(commitParser.extractCommitType('feat(auth): add login')).toBe('feat');
      expect(commitParser.extractCommitType('fix(api): resolve endpoint')).toBe('fix');
    });

    test('should return unknown for non-conventional commits', () => {
      expect(commitParser.extractCommitType('Regular commit message')).toBe('unknown');
      expect(commitParser.extractCommitType('')).toBe('unknown');
    });

    test('should respect extractConventionalType setting', () => {
      const parser = new CommitParser({ extractConventionalType: false });
      
      expect(parser.extractCommitType('feat: add feature')).toBe('unknown');
    });
  });

  describe('extractCommitScope', () => {
    test('should extract scope from conventional commits', () => {
      expect(commitParser.extractCommitScope('feat(auth): add login')).toBe('auth');
      expect(commitParser.extractCommitScope('fix(api): resolve endpoint')).toBe('api');
      expect(commitParser.extractCommitScope('docs(readme): update')).toBe('readme');
    });

    test('should return null for commits without scope', () => {
      expect(commitParser.extractCommitScope('feat: add feature')).toBe(null);
      expect(commitParser.extractCommitScope('Regular commit')).toBe(null);
    });

    test('should respect extractConventionalType setting', () => {
      const parser = new CommitParser({ extractConventionalType: false });
      
      expect(parser.extractCommitScope('feat(auth): add login')).toBe(null);
    });
  });

  describe('extractCommitSubject', () => {
    test('should extract first line as subject', () => {
      expect(commitParser.extractCommitSubject('feat: add feature')).toBe('feat: add feature');
      expect(commitParser.extractCommitSubject('feat: add feature\n\nThis is the body')).toBe('feat: add feature');
    });

    test('should handle empty message', () => {
      expect(commitParser.extractCommitSubject('')).toBe('');
      expect(commitParser.extractCommitSubject(null)).toBe('');
    });
  });

  describe('extractCommitBody', () => {
    test('should extract body from multi-line commit', () => {
      const message = 'feat: add feature\n\nThis is the body\nwith multiple lines';
      expect(commitParser.extractCommitBody(message)).toBe('This is the body\nwith multiple lines');
    });

    test('should return empty string for single-line commit', () => {
      expect(commitParser.extractCommitBody('feat: add feature')).toBe('');
    });

    test('should handle empty message', () => {
      expect(commitParser.extractCommitBody('')).toBe('');
      expect(commitParser.extractCommitBody(null)).toBe('');
    });
  });

  describe('extractTickets', () => {
    test('should extract ticket references', () => {
      const message = 'fix: resolve issue PROJ-123 and bug PROJ-456';
      const tickets = commitParser.extractTickets(message);
      
      expect(tickets).toContain('PROJ-123');
      expect(tickets).toContain('PROJ-456');
    });

    test('should handle different ticket formats', () => {
      const message = 'fix: resolve ticket ABC-123, issue DEF-456, bug GHI-789';
      const tickets = commitParser.extractTickets(message);
      
      expect(tickets).toContain('ABC-123');
      expect(tickets).toContain('DEF-456');
      expect(tickets).toContain('GHI-789');
    });

    test('should not extract duplicate tickets', () => {
      const message = 'fix: resolve issue PROJ-123 and also PROJ-123 again';
      const tickets = commitParser.extractTickets(message);
      
      expect(tickets).toEqual(['PROJ-123']);
    });

    test('should respect extractTickets setting', () => {
      const parser = new CommitParser({ extractTickets: false });
      const message = 'fix: resolve issue PROJ-123';
      
      expect(parser.extractTickets(message)).toEqual([]);
    });
  });

  describe('detectOverrides', () => {
    test('should detect override keywords', () => {
      const message = 'OVERRIDE: Skip review for emergency';
      const overrides = commitParser.detectOverrides(message);
      
      expect(overrides).toHaveLength(1);
      expect(overrides[0].keyword).toBe('OVERRIDE');
      expect(overrides[0].type).toBe('override');
    });

    test('should detect multiple overrides', () => {
      const message = 'OVERRIDE: Skip BYPASS checks';
      const overrides = commitParser.detectOverrides(message);
      
      expect(overrides).toHaveLength(2);
      expect(overrides.map(o => o.keyword)).toContain('OVERRIDE');
      expect(overrides.map(o => o.keyword)).toContain('BYPASS');
    });

    test('should be case insensitive', () => {
      const message = 'override: skip review';
      const overrides = commitParser.detectOverrides(message);
      
      expect(overrides).toHaveLength(1);
      expect(overrides[0].keyword).toBe('OVERRIDE');
    });

    test('should return empty array for no overrides', () => {
      const message = 'feat: add feature';
      const overrides = commitParser.detectOverrides(message);
      
      expect(overrides).toEqual([]);
    });
  });

  describe('detectUrgency', () => {
    test('should detect urgency keywords', () => {
      const message = 'URGENT: Fix issue';
      const urgency = commitParser.detectUrgency(message);
      
      expect(urgency).toHaveLength(1);
      expect(urgency[0].keyword).toBe('URGENT');
      expect(urgency[0].level).toBe('high');
    });

    test('should detect multiple urgency keywords', () => {
      const message = 'CRITICAL: Fix EMERGENCY immediately';
      const urgency = commitParser.detectUrgency(message);
      
      expect(urgency).toHaveLength(2);
      expect(urgency.map(u => u.keyword)).toContain('CRITICAL');
      expect(urgency.map(u => u.keyword)).toContain('EMERGENCY');
    });

    test('should assign correct urgency levels', () => {
      expect(commitParser.getUrgencyLevel('CRITICAL')).toBe('critical');
      expect(commitParser.getUrgencyLevel('EMERGENCY')).toBe('emergency');
      expect(commitParser.getUrgencyLevel('URGENT')).toBe('high');
      expect(commitParser.getUrgencyLevel('ASAP')).toBe('medium');
      expect(commitParser.getUrgencyLevel('UNKNOWN')).toBe('low');
    });

    test('should be case insensitive', () => {
      const message = 'urgent: fix issue';
      const urgency = commitParser.detectUrgency(message);
      
      expect(urgency).toHaveLength(1);
      expect(urgency[0].keyword).toBe('URGENT');
    });
  });

  describe('hasUrgentOverride', () => {
    test('should return true for urgent commits', () => {
      expect(commitParser.hasUrgentOverride('URGENT: fix issue')).toBe(true);
      expect(commitParser.hasUrgentOverride('CRITICAL: fix issue')).toBe(true);
      expect(commitParser.hasUrgentOverride('EMERGENCY: fix issue')).toBe(true);
    });

    test('should return false for non-urgent commits', () => {
      expect(commitParser.hasUrgentOverride('feat: add feature')).toBe(false);
      expect(commitParser.hasUrgentOverride('')).toBe(false);
      expect(commitParser.hasUrgentOverride(null)).toBe(false);
    });
  });

  describe('getUrgentOverride', () => {
    test('should return highest priority urgency', () => {
      const message = 'URGENT CRITICAL: fix issue';
      const override = commitParser.getUrgentOverride(message);
      
      expect(override.keyword).toBe('CRITICAL');
      expect(override.level).toBe('critical');
    });

    test('should return null for non-urgent commits', () => {
      expect(commitParser.getUrgentOverride('feat: add feature')).toBe(null);
      expect(commitParser.getUrgentOverride('')).toBe(null);
    });
  });

  describe('validateCommitMessage', () => {
    test('should validate conventional commit', () => {
      const message = 'feat: add new feature';
      const result = commitParser.validateCommitMessage(message);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should reject empty message', () => {
      const result = commitParser.validateCommitMessage('');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Commit message cannot be empty');
    });

    test('should warn about short message', () => {
      const result = commitParser.validateCommitMessage('short');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Commit message too short (minimum 10 characters)');
    });

    test('should warn about long message', () => {
      const longMessage = 'a'.repeat(501);
      const result = commitParser.validateCommitMessage(longMessage);
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Commit message very long (over 500 characters)');
    });

    test('should warn about non-conventional format', () => {
      const result = commitParser.validateCommitMessage('Regular commit message');
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Commit message does not follow conventional commit format');
    });

    test('should warn about WIP/TODO indicators', () => {
      const result = commitParser.validateCommitMessage('WIP: work in progress');
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Commit message contains WIP or TODO indicators');
    });

    test('should warn about URLs', () => {
      const result = commitParser.validateCommitMessage('feat: add feature https://example.com');
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Commit message contains URLs');
    });
  });

  describe('metadata extraction', () => {
    test('should detect breaking changes', () => {
      expect(commitParser.hasBreakingChange('feat!: breaking change')).toBe(true);
      expect(commitParser.hasBreakingChange('BREAKING CHANGE: major update')).toBe(true);
      expect(commitParser.hasBreakingChange('feat: regular change')).toBe(false);
    });

    test('should detect revert commits', () => {
      expect(commitParser.isRevert('revert: undo previous change')).toBe(true);
      expect(commitParser.isRevert('Revert "previous commit"')).toBe(true);
      expect(commitParser.isRevert('feat: regular change')).toBe(false);
    });

    test('should detect merge commits', () => {
      expect(commitParser.isMerge('merge branch feature into main')).toBe(true);
      expect(commitParser.isMerge('Merge pull request #123')).toBe(true);
      expect(commitParser.isMerge('feat: regular change')).toBe(false);
    });

    test('should detect squash commits', () => {
      expect(commitParser.isSquash('squash: combine commits')).toBe(true);
      expect(commitParser.isSquash('Squash multiple commits')).toBe(true);
      expect(commitParser.isSquash('feat: regular change')).toBe(false);
    });

    test('should count words and lines', () => {
      const message = 'feat: add feature\n\nThis is a multi-line\ncommit message';
      
      expect(commitParser.getWordCount(message)).toBe(9);
      expect(commitParser.getLineCount(message)).toBe(4);
    });

    test('should detect URLs and emails', () => {
      const message = 'feat: add feature https://example.com and contact@example.com';
      
      expect(commitParser.containsUrls(message)).toBe(true);
      expect(commitParser.containsEmails(message)).toBe(true);
    });
  });

  describe('createEmptyCommit', () => {
    test('should create empty commit object', () => {
      const empty = commitParser.createEmptyCommit();
      
      expect(empty.raw).toBe('');
      expect(empty.clean).toBe('');
      expect(empty.type).toBe('unknown');
      expect(empty.scope).toBe(null);
      expect(empty.subject).toBe('');
      expect(empty.body).toBe('');
      expect(empty.tickets).toEqual([]);
      expect(empty.overrides).toEqual([]);
      expect(empty.urgency).toEqual([]);
      expect(empty.metadata.hasBreakingChange).toBe(false);
      expect(empty.metadata.isRevert).toBe(false);
      expect(empty.metadata.isMerge).toBe(false);
      expect(empty.metadata.isSquash).toBe(false);
      expect(empty.metadata.wordCount).toBe(0);
      expect(empty.metadata.lineCount).toBe(0);
    });
  });

  describe('getCommitSummary', () => {
    test('should create commit summary', () => {
      const parsed = commitParser.parseCommit('feat(auth): add login feature\n\nCloses issue PROJ-123\n\nURGENT: security fix');
      const summary = commitParser.getCommitSummary(parsed);
      
      expect(summary.type).toBe('feat');
      expect(summary.scope).toBe('auth');
      expect(summary.subject).toContain('feat(auth): add login feature');
      expect(summary.tickets).toContain('PROJ-123');
      expect(summary.urgency).toContain('URGENT');
      expect(summary.wordCount).toBeGreaterThan(0);
      expect(summary.lineCount).toBeGreaterThan(0);
    });

    test('should truncate long subjects', () => {
      const longSubject = 'feat: ' + 'a'.repeat(60);
      const parsed = commitParser.parseCommit(longSubject);
      const summary = commitParser.getCommitSummary(parsed);
      
      expect(summary.subject).toHaveLength(53); // 50 + '...'
      expect(summary.subject.endsWith('...')).toBe(true);
    });
  });

  describe('Logging', () => {
    test('should log info messages when enabled', () => {
      const parser = new CommitParser({ 
        enableLogging: true, 
        logLevel: 'INFO' 
      });
      
      parser.logInfo('Test message');
      
      expect(mockCore.info).toHaveBeenCalledWith('[Commit Parser] Test message');
    });

    test('should not log info messages when disabled', () => {
      const parser = new CommitParser({ 
        enableLogging: false 
      });
      
      parser.logInfo('Test message');
      
      expect(mockCore.info).not.toHaveBeenCalled();
    });

    test('should log warning messages', () => {
      const parser = new CommitParser({ 
        enableLogging: true 
      });
      
      parser.logWarning('Test warning');
      
      expect(mockCore.warning).toHaveBeenCalledWith('[Commit Parser] Test warning');
    });

    test('should log error messages', () => {
      const parser = new CommitParser({ 
        enableLogging: true 
      });
      
      parser.logError('Test error');
      
      expect(mockCore.error).toHaveBeenCalledWith('[Commit Parser] Test error');
    });
  });
});
