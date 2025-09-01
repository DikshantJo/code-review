# AI Code Review System - Usage Examples and Best Practices

## Overview

This guide provides practical examples and best practices for using the AI Code Review System effectively. It covers common scenarios, configuration examples, and tips for optimizing your review process.

## Table of Contents

1. [Basic Usage Examples](#basic-usage-examples)
2. [Configuration Examples](#configuration-examples)
3. [Best Practices](#best-practices)
4. [Common Scenarios](#common-scenarios)
5. [Troubleshooting Tips](#troubleshooting-tips)
6. [Performance Optimization](#performance-optimization)
7. [Security Considerations](#security-considerations)

## Basic Usage Examples

### Example 1: Simple Code Review Workflow

```yaml
# .github/workflows/ai-code-review.yml
name: AI Code Review

on:
  pull_request:
    types: [opened, synchronize, reopened]
    branches: [main, dev, uat]

jobs:
  ai-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          openai_api_key: ${{ secrets.OPENAI_API_KEY }}
          config_file: '.github/ai-review-config.yml'
```

### Example 2: Environment-Specific Configuration

```yaml
# .github/ai-review-config.yml
environments:
  dev:
    enabled: true
    blocking: false
    quality_gates:
      min_quality_score: 0.6
      max_severity_issues: 5
  
  uat:
    enabled: true
    blocking: false
    quality_gates:
      min_quality_score: 0.7
      max_severity_issues: 3
  
  main:
    enabled: true
    blocking: true
    quality_gates:
      min_quality_score: 0.8
      max_severity_issues: 1
```

### Example 3: Custom Review Criteria

```yaml
review:
  severity_thresholds:
    security: "HIGH"
    logic: "HIGH"
    standards: "MEDIUM"
    performance: "MEDIUM"
    formatting: "LOW"
  
  min_quality_score: 0.7
  
  excluded_files:
    - "*.env"
    - "*.config.js"
    - "node_modules/**"
    - "dist/**"
    - "*.md"
    - "*.json"
```

## Configuration Examples

### Example 1: Strict Security Review

```yaml
# High-security environment configuration
ai:
  model: "gpt-4"
  max_tokens: 4000
  temperature: 0.1

review:
  severity_thresholds:
    security: "HIGH"
    logic: "HIGH"
    standards: "HIGH"
    performance: "MEDIUM"
    formatting: "LOW"
  
  min_quality_score: 0.9
  
  excluded_files:
    - "*.env"
    - "*.key"
    - "*.pem"
    - "secrets/**"
    - "config/production/**"

environments:
  production:
    enabled: true
    blocking: true
    quality_gates:
      min_quality_score: 0.9
      max_severity_issues: 0
    urgent_override:
      enabled: true
      keyword: "URGENT"
      daily_limit: 1
```

### Example 2: Development-Friendly Configuration

```yaml
# Relaxed development environment
ai:
  model: "gpt-4"
  max_tokens: 4000
  temperature: 0.2

review:
  severity_thresholds:
    security: "HIGH"
    logic: "MEDIUM"
    standards: "LOW"
    performance: "LOW"
    formatting: "LOW"
  
  min_quality_score: 0.5
  
  excluded_files:
    - "*.env"
    - "node_modules/**"
    - "dist/**"
    - "coverage/**"

environments:
  dev:
    enabled: true
    blocking: false
    quality_gates:
      min_quality_score: 0.5
      max_severity_issues: 10
```

### Example 3: Multi-Language Project

```yaml
# Configuration for mixed language project
review:
  severity_thresholds:
    security: "HIGH"
    logic: "HIGH"
    standards: "MEDIUM"
    performance: "MEDIUM"
    formatting: "LOW"
  
  excluded_files:
    # JavaScript/TypeScript
    - "node_modules/**"
    - "dist/**"
    - "build/**"
    - "*.min.js"
    - "*.bundle.js"
    
    # Python
    - "__pycache__/**"
    - "*.pyc"
    - "venv/**"
    - "env/**"
    
    # Java
    - "target/**"
    - "*.class"
    - "*.jar"
    
    # General
    - "*.env"
    - "*.log"
    - "*.sql"
    - "*.db"
    - "*.lock"
```

## Best Practices

### 1. Configuration Management

#### ✅ Do's:
- Use environment-specific configurations
- Keep sensitive data in GitHub Secrets
- Version control your configuration files
- Use descriptive branch names
- Regularly review and update rules

#### ❌ Don'ts:
- Don't commit API keys or secrets
- Don't use overly strict rules for development
- Don't ignore security issues
- Don't skip configuration validation

### 2. File Organization

#### ✅ Recommended Structure:
```
.github/
├── workflows/
│   └── ai-code-review.yml
├── ai-review-config.yml
└── ISSUE_TEMPLATE/
    └── ai-review-feedback.md

src/
├── components/
├── utils/
└── tests/

docs/
├── setup-guide.md
├── usage-examples.md
└── troubleshooting.md
```

### 3. Branch Strategy

#### ✅ Recommended Branch Naming:
- `feature/ai-review-integration`
- `bugfix/security-vulnerability`
- `hotfix/urgent-production-fix`
- `release/v1.2.0`

#### ✅ Branch Protection Rules:
```yaml
# Example branch protection configuration
branches:
  - name: main
    protection:
      required_status_checks:
        - "AI Code Review"
      required_pull_request_reviews: 1
      enforce_admins: true
```

### 4. Commit Message Best Practices

#### ✅ Good Commit Messages:
```
feat: add AI code review integration

- Implement OpenAI GPT-4 integration
- Add file filtering for security
- Create GitHub issue automation
- Add configuration management

Fixes #123
```

#### ✅ Urgent Override Example:
```
URGENT: fix critical security vulnerability in auth system

- Patch SQL injection vulnerability
- Update authentication middleware
- Add input validation

Security: HIGH
```

## Common Scenarios

### Scenario 1: New Feature Development

**Situation**: Developing a new feature with multiple files

**Configuration**:
```yaml
environments:
  dev:
    enabled: true
    blocking: false
    quality_gates:
      min_quality_score: 0.6
      max_severity_issues: 5
    notification_channels: ["github"]
```

**Workflow**:
1. Create feature branch: `feature/new-payment-system`
2. Make changes and commit with descriptive messages
3. Create PR to `dev` branch
4. AI review runs automatically
5. Address any issues found
6. Merge when quality gates pass

### Scenario 2: Security Hotfix

**Situation**: Critical security vulnerability needs immediate fix

**Configuration**:
```yaml
environments:
  main:
    enabled: true
    blocking: true
    quality_gates:
      min_quality_score: 0.8
      max_severity_issues: 0
    urgent_override:
      enabled: true
      keyword: "URGENT"
      daily_limit: 3
```

**Workflow**:
1. Create hotfix branch: `hotfix/security-patch`
2. Commit with "URGENT" in message
3. Create PR to `main` branch
4. Override quality gates if necessary
5. Deploy immediately after merge

### Scenario 3: Large Refactoring

**Situation**: Major code refactoring affecting many files

**Configuration**:
```yaml
review:
  max_files_per_review: 100
  max_file_size: 2097152  # 2MB
  
environments:
  dev:
    enabled: true
    blocking: false
    quality_gates:
      min_quality_score: 0.5
      max_severity_issues: 10
```

**Workflow**:
1. Break refactoring into smaller PRs
2. Use feature flags for gradual rollout
3. Monitor AI review performance
4. Address issues incrementally

### Scenario 4: Third-Party Integration

**Situation**: Integrating external libraries or APIs

**Configuration**:
```yaml
review:
  excluded_files:
    - "vendor/**"
    - "node_modules/**"
    - "*.min.js"
    - "*.bundle.js"
  
  severity_thresholds:
    security: "HIGH"
    logic: "HIGH"
    standards: "MEDIUM"
    performance: "MEDIUM"
```

**Workflow**:
1. Review third-party code separately
2. Focus AI review on integration code
3. Validate security implications
4. Test thoroughly before production

## Troubleshooting Tips

### Common Issues and Solutions

#### Issue 1: AI Review Not Triggering

**Symptoms**: No AI review runs on PR creation

**Solutions**:
1. Check workflow file location: `.github/workflows/ai-code-review.yml`
2. Verify branch names in workflow triggers
3. Ensure GitHub Actions are enabled
4. Check repository permissions

```yaml
# Debug workflow triggers
on:
  pull_request:
    types: [opened, synchronize, reopened]
    branches: [main, dev, uat]  # Verify these match your branches
```

#### Issue 2: High False Positive Rate

**Symptoms**: AI flags legitimate patterns as issues

**Solutions**:
1. Adjust severity thresholds
2. Add file exclusions
3. Update review criteria
4. Use custom prompts

```yaml
# Reduce false positives
review:
  severity_thresholds:
    formatting: "LOW"  # Reduce formatting strictness
    standards: "LOW"   # Reduce standards strictness
  
  excluded_files:
    - "generated/**"   # Exclude generated code
    - "legacy/**"      # Exclude legacy code
```

#### Issue 3: Slow Review Performance

**Symptoms**: Reviews take too long to complete

**Solutions**:
1. Optimize file exclusions
2. Reduce file size limits
3. Use caching strategies
4. Monitor API usage

```yaml
# Performance optimization
ai:
  max_tokens: 2000  # Reduce token limit
  timeout: 30000    # Increase timeout

review:
  max_file_size: 1048576  # 1MB limit
  max_files_per_review: 50
```

#### Issue 4: API Rate Limiting

**Symptoms**: OpenAI API rate limit errors

**Solutions**:
1. Implement retry logic
2. Reduce concurrent reviews
3. Monitor API usage
4. Use appropriate timeouts

```yaml
# Rate limiting configuration
ai:
  max_retries: 3
  rate_limit: 10  # requests per minute
  timeout: 60000  # 60 seconds
```

## Performance Optimization

### 1. File Processing Optimization

```yaml
# Optimize file processing
review:
  max_file_size: 1048576      # 1MB
  max_files_per_review: 50
  excluded_files:
    - "node_modules/**"
    - "dist/**"
    - "build/**"
    - "*.min.js"
    - "*.bundle.js"
    - "coverage/**"
    - "*.log"
    - "*.sql"
```

### 2. Caching Strategies

```yaml
# Enable caching
caching:
  enabled: true
  cache_key: "ai-review-${{ github.sha }}"
  cache_path: ".cache/ai-review"
  retention_days: 7
```

### 3. Parallel Processing

```yaml
# Parallel review configuration
workflow:
  parallel_reviews: 3
  max_concurrent: 5
  timeout_minutes: 10
```

## Security Considerations

### 1. API Key Security

```yaml
# Secure API configuration
secrets:
  openai_api_key: ${{ secrets.OPENAI_API_KEY }}
  github_token: ${{ secrets.GITHUB_TOKEN }}
  
# Never commit these to version control
# Always use GitHub Secrets
```

### 2. File Exclusion Best Practices

```yaml
# Comprehensive file exclusions
review:
  excluded_files:
    # Environment files
    - "*.env"
    - "*.env.*"
    - ".env.local"
    - ".env.production"
    
    # Configuration files
    - "config/production/**"
    - "secrets/**"
    - "*.key"
    - "*.pem"
    - "*.p12"
    - "*.pfx"
    
    # Database files
    - "*.db"
    - "*.sqlite"
    - "*.sql"
    
    # Log files
    - "*.log"
    - "logs/**"
    
    # Build artifacts
    - "dist/**"
    - "build/**"
    - "node_modules/**"
    - "*.min.js"
    - "*.bundle.js"
```

### 3. Access Control

```yaml
# Repository access control
permissions:
  contents: read
  issues: write
  pull-requests: read
  statuses: write
  
# Limit to necessary permissions only
```

## Advanced Usage Examples

### Example 1: Custom Review Prompts

```yaml
# Custom review criteria
review:
  custom_prompts:
    security:
      - "Check for SQL injection vulnerabilities"
      - "Validate input sanitization"
      - "Review authentication mechanisms"
    
    performance:
      - "Identify potential memory leaks"
      - "Check for inefficient algorithms"
      - "Review database query optimization"
    
    standards:
      - "Follow project coding conventions"
      - "Ensure proper error handling"
      - "Validate code documentation"
```

### Example 2: Team-Specific Rules

```yaml
# Team-specific configurations
teams:
  frontend:
    excluded_files:
      - "backend/**"
      - "*.java"
      - "*.py"
    
    severity_thresholds:
      security: "HIGH"
      logic: "MEDIUM"
      standards: "HIGH"
      performance: "MEDIUM"
  
  backend:
    excluded_files:
      - "frontend/**"
      - "*.js"
      - "*.ts"
      - "*.css"
    
    severity_thresholds:
      security: "HIGH"
      logic: "HIGH"
      standards: "MEDIUM"
      performance: "HIGH"
```

### Example 3: Integration with CI/CD

```yaml
# CI/CD integration
workflow:
  stages:
    - name: "AI Code Review"
      condition: "pull_request"
      timeout: 10
    
    - name: "Unit Tests"
      condition: "always"
      depends_on: "AI Code Review"
    
    - name: "Integration Tests"
      condition: "ai_review_passed"
      depends_on: "Unit Tests"
    
    - name: "Deploy to Dev"
      condition: "ai_review_passed && tests_passed"
      depends_on: "Integration Tests"
```

## Conclusion

The AI Code Review System provides powerful automation for maintaining code quality across your development workflow. By following these best practices and examples, you can maximize the effectiveness of the system while minimizing false positives and performance issues.

Remember to:
- Start with relaxed rules and gradually tighten them
- Monitor performance and adjust configurations accordingly
- Keep security as a top priority
- Regularly review and update your configuration
- Train your team on the review process

For additional help, refer to the [Setup Guide](setup-guide.md) and [Troubleshooting Guide](troubleshooting.md).



