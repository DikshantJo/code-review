# 🚀 AI Code Review System - Configuration Guide

## 📋 Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Configuration Files](#configuration-files)
4. [Email Configuration](#email-configuration)
5. [Issue Creation Configuration](#issue-creation-configuration)
6. [Environment Variables](#environment-variables)
7. [Advanced Configuration](#advanced-configuration)
8. [Troubleshooting](#troubleshooting)
9. [Examples](#examples)
10. [Best Practices](#best-practices)

---

## 🎯 Overview

The AI Code Review System uses a hierarchical configuration system that allows you to customize every aspect of the review process. Configuration can be set through:

- **Configuration files** (YAML format)
- **Environment variables**
- **Command line arguments**
- **Default values** (built-in)

The system follows this priority order (highest to lowest):
1. Command line arguments
2. Environment variables
3. Configuration files
4. Default values

---

## 🚀 Quick Start

### 1. Basic Setup

Create a configuration file in your project root:

```bash
# Copy the example configuration
cp config/email-config.yml ai-review-config.yml
cp config/issue-creation-config.yml ./

# Edit the configuration
nano ai-review-config.yml
```

### 2. Set Required Environment Variables

```bash
# Required for email notifications
export EMAIL_TO="dev@company.com,qa@company.com"
export SMTP_HOST="smtp.gmail.com"
export SMTP_USER="your-email@gmail.com"
export SMTP_PASS="your-app-password"

# Required for GitHub integration
export GITHUB_TOKEN="your-github-token"
export GITHUB_REPOSITORY="owner/repo"
```

### 3. Test Configuration

```bash
# Validate configuration
npm run validate-config

# Test email configuration
npm run test-email

# Test GitHub integration
npm run test-github
```

---

## 📁 Configuration Files

### Main Configuration File: `ai-review-config.yml`

This is the primary configuration file that consolidates all settings:

```yaml
# Basic configuration
environment: 'production'
log_level: 'info'

# AI Review settings
ai:
  model: 'gpt-4'
  max_tokens: 4000
  temperature: 0.1
  timeout_seconds: 60

# File filtering
files:
  include_patterns:
    - '**/*.js'
    - '**/*.ts'
    - '**/*.py'
    - '**/*.java'
  
  exclude_patterns:
    - '**/node_modules/**'
    - '**/dist/**'
    - '**/*.min.js'
    - '**/*.bundle.js'
  
  max_file_size_mb: 1
  max_files_per_review: 100

# Review settings
review:
  quality_gates:
    min_score: 0.7
    max_issues: 10
    block_on_critical: true
  
  auto_fix:
    enabled: false
    max_changes: 5
    require_approval: true
```

### Email Configuration: `email-config.yml`

Configure email notifications for different scenarios:

```yaml
notifications:
  email:
    enabled: true
    
    # SMTP Configuration
    smtp_host: ${SMTP_HOST:-smtp.gmail.com}
    smtp_port: ${SMTP_PORT:-587}
    smtp_secure: ${SMTP_SECURE:-false}
    smtp_user: ${SMTP_USER}
    smtp_pass: ${SMTP_PASS}
    
    # Email addresses
    from_email: ${EMAIL_FROM:-ai-review@github.com}
    to_emails: ${EMAIL_TO:-[]}
    
    # Notification triggers
    triggers:
      service_downtime: true
      review_failure: true
      quality_gate_failure: true
      security_issues: true
      performance_issues: true
```

### Issue Creation Configuration: `issue-creation-config.yml`

Configure how GitHub issues are created and managed:

```yaml
issue_creation:
  enabled: true
  
  # When to create issues
  triggers:
    review_failure: true
    review_passed: false
    severity_threshold: 'medium'
  
  # Issue creation behavior
  behavior:
    strategy: 'per_file'
    max_issues_per_review: 50
    min_severity: 'low'
    group_similar: true
    deduplicate: true
```

---

## 📧 Email Configuration

### SMTP Providers

#### Gmail
```yaml
smtp_host: smtp.gmail.com
smtp_port: 587
smtp_secure: false
smtp_user: your-email@gmail.com
smtp_pass: your-app-password  # Use App Password, not regular password
```

#### Outlook/Office 365
```yaml
smtp_host: smtp-mail.outlook.com
smtp_port: 587
smtp_secure: false
smtp_user: your-email@outlook.com
smtp_pass: your-password
```

#### SendGrid
```yaml
smtp_host: smtp.sendgrid.net
smtp_port: 587
smtp_secure: false
smtp_user: apikey
smtp_pass: your-sendgrid-api-key
```

#### AWS SES
```yaml
smtp_host: email-smtp.us-east-1.amazonaws.com
smtp_port: 587
smtp_secure: false
smtp_user: your-ses-smtp-username
smtp_pass: your-ses-smtp-password
```

### Email Templates

Customize email templates for different scenarios:

```yaml
templates:
  subjects:
    service_downtime: "[AI Review] Service Downtime - ${repository}"
    review_failure: "[AI Review] Review Failed - ${repository}"
    quality_gate: "[AI Review] Quality Gate Failed - ${repository}"
    security: "[AI Review] Security Issue Detected - ${repository}"
    performance: "[AI Review] Performance Issue - ${repository}"
  
  bodies:
    review_failure: |
      <h2>❌ AI Code Review Failed</h2>
      <p>A code review has failed for the following changes:</p>
      <p><strong>Repository:</strong> ${repository}</p>
      <p><strong>Branch:</strong> ${branch}</p>
      <p><strong>Commit:</strong> ${commit}</p>
      <p><strong>Issues Found:</strong> ${issues_count}</p>
      
      <h3>Issues Summary:</h3>
      <ul>
        ${issues_list}
      </ul>
      
      <p><strong>Review Score:</strong> ${review_score}</p>
      <p><strong>Next Steps:</strong> ${next_steps}</p>
```

### Rate Limiting

Configure email rate limiting to prevent spam:

```yaml
rate_limiting:
  max_per_hour: 10
  max_per_day: 50
  cooldown_minutes: 30
```

---

## 🚨 Issue Creation Configuration

### Severity Management

Configure how issues are categorized and escalated:

```yaml
severity:
  auto_escalation:
    enabled: true
    
    thresholds:
      repeated_issues: 2
      critical_patterns: 1
      multiple_files: 5
  
  levels:
    critical:
      auto_create: true
      block_deployment: true
      notify_stakeholders: true
      require_immediate_action: true
    
    high:
      auto_create: true
      block_deployment: false
      notify_stakeholders: false
      require_immediate_action: false
    
    medium:
      auto_create: true
      block_deployment: false
      notify_stakeholders: false
      require_immediate_action: false
    
    low:
      auto_create: false
      block_deployment: false
      notify_stakeholders: false
      require_immediate_action: false
```

### Team Assignment

Configure team structure and assignment rules:

```yaml
assignment:
  teams:
    security_team:
      name: 'Security Team'
      expertise: ['security', 'authentication', 'authorization', 'encryption']
      capacity: 10
      members:
        - username: 'security-lead'
          expertise: ['security', 'authentication']
          seniority: 'senior'
          capacity: 8
        
        - username: 'security-dev'
          expertise: ['security', 'encryption']
          seniority: 'mid'
          capacity: 6
  
  rules:
    security:
      team: 'security_team'
      fallback: 'dev_team'
      require_senior: true
    
    performance:
      team: 'performance_team'
      fallback: 'dev_team'
      require_senior: false
```

### Labeling System

Configure automatic label application:

```yaml
labeling:
  management:
    auto_create_labels: true
    auto_update_labels: true
    preserve_existing_labels: true
    max_labels_per_issue: 10
  
  label_sets:
    severity:
      critical: { name: 'severity:critical', color: 'd73a4a', description: 'Critical issue requiring immediate attention' }
      high: { name: 'severity:high', color: 'fbca04', description: 'High priority issue' }
      medium: { name: 'severity:medium', color: 'fef2c0', description: 'Medium priority issue' }
      low: { name: 'severity:low', color: 'd4c5f9', description: 'Low priority issue' }
      info: { name: 'severity:info', color: 'bfdadc', description: 'Informational issue' }
    
    type:
      security: { name: 'type:security', color: 'd73a4a', description: 'Security-related issue' }
      performance: { name: 'type:performance', color: 'fbca04', description: 'Performance-related issue' }
      bug: { name: 'type:bug', color: 'd73a4a', description: 'Bug or defect' }
      quality: { name: 'type:quality', color: '0075ca', description: 'Code quality issue' }
```

---

## 🔧 Environment Variables

### Required Variables

```bash
# Email Configuration
EMAIL_TO="dev@company.com,qa@company.com"
SMTP_HOST="smtp.gmail.com"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# GitHub Configuration
GITHUB_TOKEN="your-github-token"
GITHUB_REPOSITORY="owner/repo"

# AI Configuration
OPENAI_API_KEY="your-openai-api-key"
AI_MODEL="gpt-4"
```

### Optional Variables

```bash
# Email Configuration
EMAIL_FROM="ai-review@github.com"
SMTP_PORT="587"
SMTP_SECURE="false"

# AI Configuration
AI_MAX_TOKENS="4000"
AI_TEMPERATURE="0.1"
AI_TIMEOUT="60"

# Review Configuration
REVIEW_MIN_SCORE="0.7"
REVIEW_MAX_ISSUES="10"
REVIEW_BLOCK_ON_CRITICAL="true"

# File Configuration
MAX_FILE_SIZE_MB="1"
MAX_FILES_PER_REVIEW="100"
```

### Environment-Specific Variables

```bash
# Development
NODE_ENV="development"
LOG_LEVEL="debug"
EMAIL_ENABLED="false"
ISSUE_CREATION_ENABLED="false"

# Staging
NODE_ENV="staging"
LOG_LEVEL="info"
EMAIL_ENABLED="true"
ISSUE_CREATION_ENABLED="true"

# Production
NODE_ENV="production"
LOG_LEVEL="warn"
EMAIL_ENABLED="true"
ISSUE_CREATION_ENABLED="true"
```

---

## ⚙️ Advanced Configuration

### Configuration Inheritance

The system supports configuration inheritance for different environments:

```yaml
# Base configuration
ai:
  model: 'gpt-4'
  max_tokens: 4000
  temperature: 0.1

# Environment-specific overrides
environments:
  development:
    ai:
      model: 'gpt-3.5-turbo'  # Use cheaper model in dev
      max_tokens: 2000         # Lower token limit
      temperature: 0.2         # Slightly more creative
  
  production:
    ai:
      model: 'gpt-4'           # Use best model in production
      max_tokens: 4000         # Full token limit
      temperature: 0.1         # More focused
```

### Dynamic Configuration

Use environment variable substitution in configuration files:

```yaml
# Configuration with environment variable substitution
email:
  smtp_host: ${SMTP_HOST:-smtp.gmail.com}
  smtp_port: ${SMTP_PORT:-587}
  smtp_user: ${SMTP_USER}
  smtp_pass: ${SMTP_PASS}
  to_emails: ${EMAIL_TO:-[]}
  from_email: ${EMAIL_FROM:-ai-review@github.com}

# Fallback values
ai:
  model: ${AI_MODEL:-gpt-4}
  max_tokens: ${AI_MAX_TOKENS:-4000}
  temperature: ${AI_TEMPERATURE:-0.1}
```

### Configuration Validation

The system validates configuration on startup:

```yaml
validation:
  required_fields:
    - smtp_host
    - smtp_user
    - smtp_pass
    - to_emails
  
  email_format: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"
  
  port_range:
    min: 1
    max: 65535
  
  rate_limit_range:
    min_per_hour: 1
    max_per_hour: 1000
    min_per_day: 1
    max_per_day: 10000
```

---

## 🔍 Troubleshooting

### Common Issues

#### 1. Email Not Sending

**Symptoms:**
- No email notifications received
- SMTP connection errors

**Solutions:**
```bash
# Check SMTP configuration
npm run test-email

# Verify environment variables
echo $SMTP_HOST
echo $SMTP_USER
echo $SMTP_PASS

# Check firewall/network settings
telnet smtp.gmail.com 587
```

#### 2. GitHub Issues Not Creating

**Symptoms:**
- No issues created in repository
- GitHub API errors

**Solutions:**
```bash
# Check GitHub token permissions
npm run test-github

# Verify repository access
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/repos/$GITHUB_REPOSITORY

# Check issue creation configuration
cat issue-creation-config.yml | grep -A 5 "enabled:"
```

#### 3. Configuration Not Loading

**Symptoms:**
- Configuration errors on startup
- Default values being used

**Solutions:**
```bash
# Validate configuration
npm run validate-config

# Check file permissions
ls -la ai-review-config.yml

# Check YAML syntax
yamllint ai-review-config.yml
```

### Debug Mode

Enable debug logging to troubleshoot issues:

```bash
# Set debug level
export LOG_LEVEL="debug"

# Run with verbose output
npm run start -- --verbose

# Check logs
tail -f logs/ai-review.log
```

### Configuration Testing

Test individual configuration components:

```bash
# Test email configuration
npm run test-email

# Test GitHub integration
npm run test-github

# Test AI configuration
npm run test-ai

# Test file filtering
npm run test-files
```

---

## 📚 Examples

### Minimal Configuration

```yaml
# Minimal working configuration
environment: 'production'
log_level: 'info'

# Email (required for notifications)
notifications:
  email:
    enabled: true
    smtp_host: ${SMTP_HOST}
    smtp_user: ${SMTP_USER}
    smtp_pass: ${SMTP_PASS}
    to_emails: ${EMAIL_TO}

# AI Review
ai:
  model: 'gpt-4'
  max_tokens: 4000
```

### Security-Focused Configuration

```yaml
# Security-focused configuration
environment: 'production'
log_level: 'info'

# Strict file filtering
files:
  include_patterns:
    - '**/*.js'
    - '**/*.ts'
    - '**/*.py'
    - '**/*.java'
  
  exclude_patterns:
    - '**/node_modules/**'
    - '**/dist/**'
    - '**/*.min.js'

# Security-focused review
review:
  quality_gates:
    min_score: 0.8
    max_issues: 5
    block_on_critical: true
    block_on_security: true
  
  security_scanning:
    enabled: true
    scan_dependencies: true
    scan_secrets: true
    scan_vulnerabilities: true

# Issue creation for security issues
issue_creation:
  enabled: true
  triggers:
    security_issues: true
    severity_threshold: 'low'  # Create issues for all security issues
```

### Performance-Focused Configuration

```yaml
# Performance-focused configuration
environment: 'production'
log_level: 'info'

# Performance analysis
review:
  performance_analysis:
    enabled: true
    complexity_threshold: 10
    memory_usage_analysis: true
    execution_time_analysis: true
  
  quality_gates:
    min_score: 0.7
    max_complexity: 15
    max_file_size_mb: 0.5

# Performance-focused issue creation
issue_creation:
  enabled: true
  triggers:
    performance_issues: true
    complexity_issues: true
    size_issues: true

# Performance team assignment
assignment:
  teams:
    performance_team:
      name: 'Performance Team'
      expertise: ['performance', 'optimization', 'scalability']
      capacity: 8
      members:
        - username: 'perf-lead'
          expertise: ['performance', 'optimization']
          seniority: 'senior'
          capacity: 8
```

---

## 🎯 Best Practices

### 1. Configuration Organization

- **Separate concerns**: Use different config files for different aspects
- **Environment-specific**: Use environment variables for sensitive data
- **Version control**: Keep config files in version control (exclude secrets)
- **Documentation**: Document all configuration options

### 2. Security

- **Never commit secrets**: Use environment variables for sensitive data
- **Principle of least privilege**: Grant minimum required permissions
- **Regular rotation**: Rotate API keys and passwords regularly
- **Audit access**: Monitor and audit configuration access

### 3. Performance

- **Cache configuration**: Enable configuration caching for production
- **Lazy loading**: Load configuration only when needed
- **Validation**: Validate configuration early to fail fast
- **Monitoring**: Monitor configuration loading performance

### 4. Maintenance

- **Regular updates**: Keep configuration up to date with system changes
- **Backup configuration**: Backup configuration before major changes
- **Testing**: Test configuration changes in staging first
- **Rollback plan**: Have a plan to rollback configuration changes

### 5. Monitoring

- **Configuration health**: Monitor configuration loading success
- **Validation errors**: Alert on configuration validation failures
- **Performance metrics**: Track configuration loading time
- **Usage analytics**: Monitor configuration usage patterns

---

## 📖 Additional Resources

- [API Reference](../api/README.md)
- [Deployment Guide](../deployment/README.md)
- [Troubleshooting Guide](../troubleshooting/README.md)
- [Contributing Guide](../CONTRIBUTING.md)

---

## 🆘 Support

If you need help with configuration:

1. **Check the logs**: Look for error messages in the application logs
2. **Validate configuration**: Run `npm run validate-config`
3. **Test components**: Test individual components with test commands
4. **Check examples**: Review the example configurations
5. **Open an issue**: Create a GitHub issue with details about your problem

---

*Last updated: December 19, 2024*
*Version: 1.0.0*

