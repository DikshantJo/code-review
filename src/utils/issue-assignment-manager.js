/**
 * Issue Assignment Manager for AI Code Review System
 * Intelligently assigns issues to appropriate team members
 */
class IssueAssignmentManager {
  constructor(config = {}) {
    this.config = {
      assignmentRules: {
        // Default assignment rules by issue type
        security: { team: 'security-team', fallback: 'dev-team' },
        performance: { team: 'performance-team', fallback: 'dev-team' },
        bug: { team: 'qa-team', fallback: 'dev-team' },
        architecture: { team: 'arch-team', fallback: 'dev-team' },
        quality: { team: 'dev-team', fallback: 'senior-dev' },
        style: { team: 'dev-team', fallback: 'junior-dev' },
        documentation: { team: 'docs-team', fallback: 'dev-team' },
        testing: { team: 'qa-team', fallback: 'dev-team' }
      },
      
      // Team member expertise mapping
      teamExpertise: {
        'security-team': ['security', 'authentication', 'authorization', 'encryption'],
        'performance-team': ['performance', 'optimization', 'scalability', 'monitoring'],
        'qa-team': ['testing', 'bug', 'quality-assurance', 'regression'],
        'arch-team': ['architecture', 'design-patterns', 'system-design', 'scalability'],
        'dev-team': ['general', 'code-quality', 'refactoring', 'maintenance'],
        'docs-team': ['documentation', 'api-docs', 'user-guides', 'technical-writing'],
        'senior-dev': ['senior', 'mentoring', 'code-review', 'architecture'],
        'junior-dev': ['junior', 'learning', 'basic-implementation', 'style']
      },
      
      // Workload balancing configuration
      workloadBalancing: {
        enabled: true,
        maxIssuesPerMember: 5,
        maxCriticalIssuesPerMember: 2,
        workloadThreshold: 0.8, // 80% capacity
        autoReassignment: true
      },
      
      // Assignment strategies
      strategies: {
        primary: 'expertise', // expertise, workload, round-robin, random
        fallback: 'workload',
        tiebreaker: 'seniority'
      },
      
      // Team member availability and capacity
      teamCapacity: {
        'security-team': { capacity: 10, currentLoad: 0, members: [] },
        'performance-team': { capacity: 8, currentLoad: 0, members: [] },
        'qa-team': { capacity: 12, currentLoad: 0, members: [] },
        'arch-team': { capacity: 6, currentLoad: 0, members: [] },
        'dev-team': { capacity: 20, currentLoad: 0, members: [] },
        'docs-team': { capacity: 5, currentLoad: 0, members: [] },
        'senior-dev': { capacity: 15, currentLoad: 0, members: [] },
        'junior-dev': { capacity: 10, currentLoad: 0, members: [] }
      },
      
      ...config
    };
    
    this.assignmentHistory = new Map();
    this.workloadTracker = new WorkloadTracker();
    this.expertiseMatcher = new ExpertiseMatcher();
  }

  /**
   * Assign issue to appropriate team member
   * @param {Object} issue - Issue data
   * @param {Object} context - Review context
   * @returns {Object} Assignment result
   */
  assignIssue(issue, context = {}) {
    try {
      console.log(`🔍 Assigning issue: ${issue.type} - ${issue.severity}`);
      
      // Step 1: Determine target team
      const targetTeam = this.determineTargetTeam(issue, context);
      
      // Step 2: Get available team members
      const availableMembers = this.getAvailableMembers(targetTeam, issue);
      
      if (availableMembers.length === 0) {
        console.warn(`⚠️ No available members in team: ${targetTeam}`);
        return this.handleNoAssignment(issue, context);
      }
      
      // Step 3: Score and rank candidates
      const scoredCandidates = this.scoreCandidates(availableMembers, issue, context);
      
      // Step 4: Select best candidate
      const selectedMember = this.selectBestCandidate(scoredCandidates, issue);
      
      // Step 5: Create assignment
      const assignment = this.createAssignment(issue, selectedMember, context);
      
      // Step 6: Update tracking
      this.updateAssignmentTracking(assignment);
      
      console.log(`✅ Issue assigned to: ${selectedMember.username} (${selectedMember.team})`);
      
      return assignment;
      
    } catch (error) {
      console.error('❌ Issue assignment failed:', error.message);
      return this.createFallbackAssignment(issue, context);
    }
  }

  /**
   * Determine target team for issue
   * @param {Object} issue - Issue data
   * @param {Object} context - Review context
   * @returns {string} Target team
   */
  determineTargetTeam(issue, context) {
    // Check for explicit team assignment
    if (issue.assignedTeam) {
      return issue.assignedTeam;
    }
    
    // Check assignment rules
    const rule = this.config.assignmentRules[issue.type];
    if (rule) {
      return rule.team;
    }
    
    // Check context for team hints
    if (context.filePath) {
      const teamHint = this.getTeamFromFilePath(context.filePath);
      if (teamHint) {
        return teamHint;
      }
    }
    
    // Default to dev-team
    return 'dev-team';
  }

  /**
   * Get team hint from file path
   * @param {string} filePath - File path
   * @returns {string|null} Team hint
   */
  getTeamFromFilePath(filePath) {
    const path = filePath.toLowerCase();
    
    if (path.includes('security') || path.includes('auth') || path.includes('encrypt')) {
      return 'security-team';
    }
    
    if (path.includes('performance') || path.includes('optimize') || path.includes('cache')) {
      return 'performance-team';
    }
    
    if (path.includes('test') || path.includes('spec') || path.includes('mock')) {
      return 'qa-team';
    }
    
    if (path.includes('arch') || path.includes('design') || path.includes('pattern')) {
      return 'arch-team';
    }
    
    if (path.includes('docs') || path.includes('readme') || path.includes('api')) {
      return 'docs-team';
    }
    
    return null;
  }

  /**
   * Get available team members
   * @param {string} team - Team name
   * @param {Object} issue - Issue data
   * @returns {Array} Available team members
   */
  getAvailableMembers(team, issue) {
    const teamMembers = this.config.teamCapacity[team]?.members || [];
    
    if (teamMembers.length === 0) {
      // Return default team members if none configured
      return this.getDefaultTeamMembers(team);
    }
    
    // Filter by availability and capacity
    return teamMembers.filter(member => {
      const workload = this.workloadTracker.getMemberWorkload(member.username);
      const capacity = this.getMemberCapacity(member);
      
      // Check if member can handle the issue
      if (issue.severity === 'critical') {
        return workload.criticalIssues < this.config.workloadBalancing.maxCriticalIssuesPerMember;
      }
      
      return workload.totalIssues < this.config.workloadBalancing.maxIssuesPerMember &&
             workload.loadPercentage < this.config.workloadBalancing.workloadThreshold;
    });
  }

  /**
   * Get default team members for a team
   * @param {string} team - Team name
   * @returns {Array} Default team members
   */
  getDefaultTeamMembers(team) {
    const defaultMembers = {
      'security-team': [
        { username: 'security-lead', expertise: ['security', 'authentication'], seniority: 'senior' },
        { username: 'security-dev', expertise: ['security', 'encryption'], seniority: 'mid' }
      ],
      'performance-team': [
        { username: 'perf-lead', expertise: ['performance', 'optimization'], seniority: 'senior' },
        { username: 'perf-dev', expertise: ['performance', 'monitoring'], seniority: 'mid' }
      ],
      'qa-team': [
        { username: 'qa-lead', expertise: ['testing', 'quality'], seniority: 'senior' },
        { username: 'qa-dev', expertise: ['testing', 'automation'], seniority: 'mid' }
      ],
      'arch-team': [
        { username: 'arch-lead', expertise: ['architecture', 'design'], seniority: 'senior' },
        { username: 'arch-dev', expertise: ['architecture', 'patterns'], seniority: 'mid' }
      ],
      'dev-team': [
        { username: 'senior-dev-1', expertise: ['general', 'mentoring'], seniority: 'senior' },
        { username: 'mid-dev-1', expertise: ['general', 'implementation'], seniority: 'mid' },
        { username: 'junior-dev-1', expertise: ['general', 'learning'], seniority: 'junior' }
      ],
      'docs-team': [
        { username: 'docs-lead', expertise: ['documentation', 'technical-writing'], seniority: 'senior' },
        { username: 'docs-writer', expertise: ['documentation', 'api-docs'], seniority: 'mid' }
      ]
    };
    
    return defaultMembers[team] || defaultMembers['dev-team'];
  }

  /**
   * Score candidates for assignment
   * @param {Array} candidates - Available candidates
   * @param {Object} issue - Issue data
   * @param {Object} context - Review context
   * @returns {Array} Scored candidates
   */
  scoreCandidates(candidates, issue, context) {
    return candidates.map(candidate => {
      const scores = {};
      
      // Expertise score (0-1)
      scores.expertise = this.expertiseMatcher.calculateExpertiseScore(candidate, issue);
      
      // Workload score (0-1, lower is better)
      const workload = this.workloadTracker.getMemberWorkload(candidate.username);
      scores.workload = 1 - Math.min(workload.loadPercentage, 1);
      
      // Seniority score (0-1)
      scores.seniority = this.getSeniorityScore(candidate.seniority);
      
      // Historical success score (0-1)
      scores.history = this.getHistoricalSuccessScore(candidate.username, issue.type);
      
      // Context relevance score (0-1)
      scores.context = this.getContextRelevanceScore(candidate, context);
      
      // Calculate weighted total score
      const weights = {
        expertise: 0.35,
        workload: 0.25,
        seniority: 0.20,
        history: 0.15,
        context: 0.05
      };
      
      const totalScore = Object.keys(scores).reduce((total, key) => {
        return total + (scores[key] * weights[key]);
      }, 0);
      
      return {
        member: candidate,
        scores: scores,
        totalScore: totalScore,
        weightedBreakdown: Object.keys(scores).map(key => ({
          factor: key,
          score: scores[key],
          weight: weights[key],
          contribution: scores[key] * weights[key]
        }))
      };
    }).sort((a, b) => b.totalScore - a.totalScore);
  }

  /**
   * Select best candidate for assignment
   * @param {Array} scoredCandidates - Scored candidates
   * @param {Object} issue - Issue data
   * @returns {Object} Selected candidate
   */
  selectBestCandidate(scoredCandidates, issue) {
    if (scoredCandidates.length === 0) {
      throw new Error('No candidates available for assignment');
    }
    
    // For critical issues, prefer senior members
    if (issue.severity === 'critical') {
      const seniorCandidates = scoredCandidates.filter(c => 
        c.member.seniority === 'senior'
      );
      
      if (seniorCandidates.length > 0) {
        return seniorCandidates[0].member;
      }
    }
    
    // Return top-scored candidate
    return scoredCandidates[0].member;
  }

  /**
   * Create assignment object
   * @param {Object} issue - Issue data
   * @param {Object} member - Assigned member
   * @param {Object} context - Review context
   * @returns {Object} Assignment object
   */
  createAssignment(issue, member, context) {
    const assignment = {
      issueId: issue.id || `issue-${Date.now()}`,
      assignedTo: member.username,
      team: member.team,
      assignedAt: new Date(),
      assignmentReason: this.generateAssignmentReason(issue, member),
      estimatedEffort: this.estimateEffort(issue),
      priority: this.determinePriority(issue),
      context: {
        repository: context.repository,
        branch: context.branch,
        commit: context.commit,
        file: issue.file
      },
      metadata: {
        expertiseScore: this.expertiseMatcher.calculateExpertiseScore(member, issue),
        workloadPercentage: this.workloadTracker.getMemberWorkload(member.username).loadPercentage,
        seniority: member.seniority
      }
    };
    
    return assignment;
  }

  /**
   * Generate assignment reason
   * @param {Object} issue - Issue data
   * @param {Object} member - Assigned member
   * @returns {string} Assignment reason
   */
  generateAssignmentReason(issue, member) {
    const reasons = [];
    
    // Expertise-based reason
    const expertiseScore = this.expertiseMatcher.calculateExpertiseScore(member, issue);
    if (expertiseScore > 0.8) {
      reasons.push('High expertise in this area');
    } else if (expertiseScore > 0.6) {
      reasons.push('Good expertise match');
    }
    
    // Workload-based reason
    const workload = this.workloadTracker.getMemberWorkload(member.username);
    if (workload.loadPercentage < 0.5) {
      reasons.push('Available capacity');
    } else if (workload.loadPercentage < 0.8) {
      reasons.push('Reasonable workload');
    }
    
    // Seniority-based reason
    if (issue.severity === 'critical' && member.seniority === 'senior') {
      reasons.push('Critical issue requires senior expertise');
    }
    
    return reasons.length > 0 ? reasons.join('; ') : 'Best available team member';
  }

  /**
   * Estimate effort for issue
   * @param {Object} issue - Issue data
   * @returns {string} Effort estimate
   */
  estimateEffort(issue) {
    const effortMap = {
      critical: 'High (2-4 days)',
      high: 'Medium-High (1-3 days)',
      medium: 'Medium (0.5-2 days)',
      low: 'Low (0.25-1 day)',
      info: 'Minimal (0.25-0.5 days)'
    };
    
    return effortMap[issue.severity] || 'Unknown';
  }

  /**
   * Determine priority for assignment
   * @param {Object} issue - Issue data
   * @returns {string} Priority level
   */
  determinePriority(issue) {
    if (issue.severity === 'critical') return 'Immediate';
    if (issue.severity === 'high') return 'High';
    if (issue.severity === 'medium') return 'Normal';
    if (issue.severity === 'low') return 'Low';
    return 'Lowest';
  }

  /**
   * Update assignment tracking
   * @param {Object} assignment - Assignment object
   */
  updateAssignmentTracking(assignment) {
    // Update workload tracker
    this.workloadTracker.addAssignment(assignment);
    
    // Update assignment history
    if (!this.assignmentHistory.has(assignment.assignedTo)) {
      this.assignmentHistory.set(assignment.assignedTo, []);
    }
    
    this.assignmentHistory.get(assignment.assignedTo).push(assignment);
    
    // Keep only last 50 assignments per member
    const history = this.assignmentHistory.get(assignment.assignedTo);
    if (history.length > 50) {
      this.assignmentHistory.set(assignment.assignedTo, history.slice(-50));
    }
  }

  /**
   * Handle case when no assignment is possible
   * @param {Object} issue - Issue data
   * @param {Object} context - Review context
   * @returns {Object} Fallback assignment
   */
  handleNoAssignment(issue, context) {
    console.warn('⚠️ No assignment possible, creating fallback assignment');
    
    // Try fallback team
    const rule = this.config.assignmentRules[issue.type];
    if (rule && rule.fallback) {
      const fallbackMembers = this.getAvailableMembers(rule.fallback, issue);
      if (fallbackMembers.length > 0) {
        return this.createAssignment(issue, fallbackMembers[0], context);
      }
    }
    
    // Last resort: assign to any available member
    return this.createFallbackAssignment(issue, context);
  }

  /**
   * Create fallback assignment
   * @param {Object} issue - Issue data
   * @param {Object} context - Review context
   * @returns {Object} Fallback assignment
   */
  createFallbackAssignment(issue, context) {
    // Find any available member across all teams
    for (const [team, capacity] of Object.entries(this.config.teamCapacity)) {
      const members = this.getAvailableMembers(team, issue);
      if (members.length > 0) {
        return this.createAssignment(issue, members[0], context);
      }
    }
    
    // If still no assignment, create unassigned issue
    return {
      issueId: issue.id || `issue-${Date.now()}`,
      assignedTo: null,
      team: 'unassigned',
      assignedAt: new Date(),
      assignmentReason: 'No available team members - manual assignment required',
      estimatedEffort: this.estimateEffort(issue),
      priority: this.determinePriority(issue),
      context: {
        repository: context.repository,
        branch: context.branch,
        commit: context.commit,
        file: issue.file
      },
      metadata: {
        assignmentFailed: true,
        failureReason: 'No available team members',
        requiresManualAssignment: true
      }
    };
  }

  /**
   * Get seniority score
   * @param {string} seniority - Seniority level
   * @returns {number} Seniority score (0-1)
   */
  getSeniorityScore(seniority) {
    const scores = {
      'senior': 1.0,
      'mid': 0.7,
      'junior': 0.4
    };
    
    return scores[seniority] || 0.5;
  }

  /**
   * Get historical success score
   * @param {string} username - Username
   * @param {string} issueType - Issue type
   * @returns {number} Historical success score (0-1)
   */
  getHistoricalSuccessScore(username, issueType) {
    const history = this.assignmentHistory.get(username) || [];
    
    if (history.length === 0) return 0.5; // Default score for new members
    
    const relevantHistory = history.filter(h => h.issueType === issueType);
    if (relevantHistory.length === 0) return 0.5;
    
    // Calculate success rate (assuming completed issues are successful)
    const completedIssues = relevantHistory.filter(h => h.status === 'completed');
    return completedIssues.length / relevantHistory.length;
  }

  /**
   * Get context relevance score
   * @param {Object} member - Team member
   * @param {Object} context - Review context
   * @returns {number} Context relevance score (0-1)
   */
  getContextRelevanceScore(member, context) {
    // This could be enhanced with more sophisticated context analysis
    // For now, return a base score
    return 0.5;
  }

  /**
   * Get member capacity
   * @param {Object} member - Team member
   * @returns {number} Member capacity
   */
  getMemberCapacity(member) {
    // Base capacity by seniority
    const baseCapacity = {
      'senior': 8,
      'mid': 6,
      'junior': 4
    };
    
    return baseCapacity[member.seniority] || 5;
  }

  /**
   * Get assignment statistics
   * @returns {Object} Assignment statistics
   */
  getAssignmentStats() {
    const stats = {
      totalAssignments: 0,
      byTeam: {},
      byMember: {},
      unassignedCount: 0,
      averageAssignmentTime: 0
    };
    
    this.assignmentHistory.forEach((assignments, username) => {
      assignments.forEach(assignment => {
        stats.totalAssignments++;
        
        // Count by team
        const team = assignment.team;
        stats.byTeam[team] = (stats.byTeam[team] || 0) + 1;
        
        // Count by member
        stats.byMember[username] = (stats.byMember[username] || 0) + 1;
        
        // Count unassigned
        if (team === 'unassigned') {
          stats.unassignedCount++;
        }
      });
    });
    
    return stats;
  }

  /**
   * Reassign issue to different member
   * @param {string} issueId - Issue ID
   * @param {Object} context - Review context
   * @returns {Object} New assignment
   */
  reassignIssue(issueId, context) {
    // Find current assignment
    let currentAssignment = null;
    let currentMember = null;
    
    for (const [username, assignments] of this.assignmentHistory.entries()) {
      const assignment = assignments.find(a => a.issueId === issueId);
      if (assignment) {
        currentAssignment = assignment;
        currentMember = { username, team: assignment.team };
        break;
      }
    }
    
    if (!currentAssignment) {
      throw new Error(`Issue ${issueId} not found in assignment history`);
    }
    
    // Remove current assignment
    this.workloadTracker.removeAssignment(currentAssignment);
    
    // Create new assignment
    const newAssignment = this.assignIssue(currentAssignment, context);
    
    return newAssignment;
  }

  /**
   * Clear assignment history
   */
  clearHistory() {
    this.assignmentHistory.clear();
    this.workloadTracker.clear();
  }
}

/**
 * Workload Tracker
 * Tracks workload for team members
 */
class WorkloadTracker {
  constructor() {
    this.memberWorkloads = new Map();
  }

  /**
   * Get member workload
   * @param {string} username - Username
   * @returns {Object} Workload information
   */
  getMemberWorkload(username) {
    if (!this.memberWorkloads.has(username)) {
      this.memberWorkloads.set(username, {
        totalIssues: 0,
        criticalIssues: 0,
        highIssues: 0,
        mediumIssues: 0,
        lowIssues: 0,
        loadPercentage: 0
      });
    }
    
    return this.memberWorkloads.get(username);
  }

  /**
   * Add assignment to workload
   * @param {Object} assignment - Assignment object
   */
  addAssignment(assignment) {
    const workload = this.getMemberWorkload(assignment.assignedTo);
    
    workload.totalIssues++;
    
    // Count by priority
    if (assignment.priority === 'Immediate') workload.criticalIssues++;
    else if (assignment.priority === 'High') workload.highIssues++;
    else if (assignment.priority === 'Normal') workload.mediumIssues++;
    else workload.lowIssues++;
    
    // Calculate load percentage (assuming max capacity of 8)
    workload.loadPercentage = Math.min(1.0, workload.totalIssues / 8);
  }

  /**
   * Remove assignment from workload
   * @param {Object} assignment - Assignment object
   */
  removeAssignment(assignment) {
    const workload = this.getMemberWorkload(assignment.assignedTo);
    
    if (workload.totalIssues > 0) {
      workload.totalIssues--;
      
      // Decrease by priority
      if (assignment.priority === 'Immediate') workload.criticalIssues = Math.max(0, workload.criticalIssues - 1);
      else if (assignment.priority === 'High') workload.highIssues = Math.max(0, workload.highIssues - 1);
      else if (assignment.priority === 'Normal') workload.mediumIssues = Math.max(0, workload.mediumIssues - 1);
      else workload.lowIssues = Math.max(0, workload.lowIssues - 1);
      
      // Recalculate load percentage
      workload.loadPercentage = Math.min(1.0, workload.totalIssues / 8);
    }
  }

  /**
   * Clear all workloads
   */
  clear() {
    this.memberWorkloads.clear();
  }
}

/**
 * Expertise Matcher
 * Matches team member expertise with issue requirements
 */
class ExpertiseMatcher {
  constructor() {
    this.expertiseKeywords = {
      security: ['security', 'authentication', 'authorization', 'encryption', 'vulnerability', 'penetration'],
      performance: ['performance', 'optimization', 'caching', 'scalability', 'monitoring', 'profiling'],
      testing: ['testing', 'unit-test', 'integration-test', 'automation', 'qa', 'quality'],
      architecture: ['architecture', 'design-pattern', 'system-design', 'scalability', 'maintainability'],
      documentation: ['documentation', 'api-docs', 'technical-writing', 'user-guides', 'readme'],
      general: ['general', 'implementation', 'refactoring', 'maintenance', 'bug-fix']
    };
  }

  /**
   * Calculate expertise score for member and issue
   * @param {Object} member - Team member
   * @param {Object} issue - Issue data
   * @returns {number} Expertise score (0-1)
   */
  calculateExpertiseScore(member, issue) {
    if (!member.expertise || !issue.description) return 0.5;
    
    const issueText = `${issue.type} ${issue.category} ${issue.description}`.toLowerCase();
    let totalScore = 0;
    let maxScore = 0;
    
    member.expertise.forEach(expertise => {
      const keywords = this.expertiseKeywords[expertise] || [expertise];
      let score = 0;
      
      keywords.forEach(keyword => {
        if (issueText.includes(keyword)) {
          score += 1;
        }
      });
      
      // Normalize score for this expertise area
      const normalizedScore = Math.min(1.0, score / keywords.length);
      totalScore += normalizedScore;
      maxScore += 1.0;
    });
    
    return maxScore > 0 ? totalScore / maxScore : 0.5;
  }
}

module.exports = IssueAssignmentManager;

