# AI Code Review System - Configuration Reference

## Overview

This document provides a comprehensive reference for all configuration options available in the AI Code Review System. It includes detailed explanations, examples, and best practices for each configuration section.

## Table of Contents

1. [Configuration File Structure](#configuration-file-structure)
2. [AI Model Configuration](#ai-model-configuration)
3. [Review Criteria Configuration](#review-criteria-configuration)
4. [Environment-Specific Settings](#environment-specific-settings)
5. [Notification Configuration](#notification-configuration)
6. [Monitoring and Alerting](#monitoring-and-alerting)
7. [Audit and Compliance](#audit-and-compliance)
8. [Advanced Configuration](#advanced-configuration)
9. [Configuration Validation](#configuration-validation)

## Configuration File Structure

The main configuration file is located at `.github/ai-review-config.yml` and follows this structure:

```yaml
# AI Code Review Configuration
ai:
  # AI model settings
  model: "gpt-4"
  max_tokens: 4000
  temperature: 0.1
  timeout: 30000
  max_retries: 3

review:
  # Review criteria and thresholds
  severity_thresholds:
    security: "HIGH"
    logic: "HIGH"
    standards: "MEDIUM"
    performance: "MEDIUM"
    formatting: "LOW"
  
  min_quality_score: 0.7
  excluded_files: []
  custom_prompts: {}

environments:
  # Environment-specific settings
  dev: {}
  uat: {}
  main: {}

notifications:
  # Notification settings
  email: {}
  slack: {}

monitoring:
  # Monitoring and alerting
  dashboard_dir: "./dashboard"
  alerts: {}

audit:
  # Audit and compliance
  enabled: true
  log_level: "info"
  retention_days: 90
```

## AI Model Configuration

### Basic AI Settings

```yaml
ai:
  # The AI model to use for code review
  model: "gpt-4"                    # Options: "gpt-4", "gpt-3.5-turbo"
  
  # Maximum tokens for AI response
  max_tokens: 4000                  # Range: 1000-8000
  
  # Response creativity (0.0 = deterministic, 1.0 = creative)
  temperature: 0.1                  # Range: 0.0-1.0
  
  # API timeout in milliseconds
  timeout: 30000                    # Range: 10000-120000
  
  # Number of retry attempts for failed API calls
  max_retries: 3                    # Range: 1-5
  
  # Rate limiting (requests per minute)
  rate_limit: 10                    # Range: 1-60
```

### Advanced AI Settings

```yaml
ai:
  # Model-specific settings
  model: "gpt-4"
  
  # Custom system prompt
  system_prompt: |
    You are an expert code reviewer. Analyze the provided code for:
    - Security vulnerabilities
    - Logical flaws and bugs
    - Coding standards violations
    - Performance issues
    - Code formatting problems
    
    Provide structured feedback with severity levels.
  
  # Response format specification
  response_format:
    type: "json"
    schema:
      issues:
        - severity: "HIGH|MEDIUM|LOW"
          category: "security|logic|standards|performance|formatting"
          description: "string"
          line_number: "number"
          suggestion: "string"
  
  # Fallback model if primary fails
  fallback_model: "gpt-3.5-turbo"
  
  # Cost optimization
  cost_optimization:
    enabled: true
    max_cost_per_review: 0.10      # USD
    token_optimization: true
```

## Review Criteria Configuration

### Severity Thresholds

```yaml
review:
  # Define severity levels for different issue categories
  severity_thresholds:
    security: "HIGH"                # Security vulnerabilities
    logic: "HIGH"                   # Logical flaws and bugs
    standards: "MEDIUM"             # Coding standards
    performance: "MEDIUM"           # Performance issues
    formatting: "LOW"               # Code formatting
  
  # Minimum quality score required (0.0 - 1.0)
  min_quality_score: 0.7
  
  # Maximum number of files to review per commit
  max_files_per_review: 50
  
  # Maximum file size in bytes
  max_file_size: 1048576           # 1MB
  
  # Maximum lines of code per review
  max_lines_per_review: 5000
```

### File Exclusions

```yaml
review:
  # Files and directories to exclude from review
  excluded_files:
    # Environment and configuration files
    - "*.env"
    - "*.env.*"
    - ".env.local"
    - ".env.production"
    - "*.config.js"
    - "*.config.json"
    - "config/production/**"
    
    # Dependencies and build artifacts
    - "node_modules/**"
    - "dist/**"
    - "build/**"
    - "coverage/**"
    - "*.min.js"
    - "*.bundle.js"
    
    # Database and data files
    - "*.db"
    - "*.sqlite"
    - "*.sql"
    - "data/**"
    
    # Log files
    - "*.log"
    - "logs/**"
    
    # Documentation
    - "*.md"
    - "docs/**"
    - "README.md"
    
    # Binary and media files
    - "*.png"
    - "*.jpg"
    - "*.jpeg"
    - "*.gif"
    - "*.svg"
    - "*.pdf"
    - "*.zip"
    - "*.tar.gz"
    
    # Security-sensitive files
    - "*.key"
    - "*.pem"
    - "*.p12"
    - "*.pfx"
    - "secrets/**"
    - "private/**"
    
    # Lock files
    - "package-lock.json"
    - "yarn.lock"
    - "*.lock"
```

### Custom Review Prompts

```yaml
review:
  # Custom prompts for specific review categories
  custom_prompts:
    security:
      - "Check for SQL injection vulnerabilities"
      - "Validate input sanitization and validation"
      - "Review authentication and authorization mechanisms"
      - "Check for sensitive data exposure"
      - "Validate encryption and hashing practices"
    
    logic:
      - "Identify potential null pointer exceptions"
      - "Check for infinite loops and recursion issues"
      - "Validate error handling and edge cases"
      - "Review algorithm efficiency and correctness"
      - "Check for race conditions and concurrency issues"
    
    standards:
      - "Follow project coding conventions"
      - "Ensure proper naming conventions"
      - "Check for code duplication"
      - "Validate function and class structure"
      - "Review documentation and comments"
    
    performance:
      - "Identify potential memory leaks"
      - "Check for inefficient algorithms"
      - "Review database query optimization"
      - "Validate resource usage patterns"
      - "Check for unnecessary computations"
    
    formatting:
      - "Ensure consistent indentation"
      - "Check for proper spacing and line breaks"
      - "Validate code organization and structure"
      - "Review import/require statements"
      - "Check for trailing whitespace"
```

## Environment-Specific Settings

### Development Environment

```yaml
environments:
  dev:
    enabled: true                   # Enable AI review for dev branch
    blocking: false                 # Don't block merges on failures
    notification_channels: ["github", "email"]
    
    quality_gates:
      enabled: true
      min_quality_score: 0.6        # Lower threshold for development
      max_severity_issues: 5        # Allow more issues in dev
      max_high_severity_issues: 2   # Limit high severity issues
    
    # Override settings for development
    overrides:
      allow_urgent_override: true
      urgent_keyword: "URGENT"
      daily_override_limit: 5
    
    # Custom rules for development
    custom_rules:
      ignore_formatting: true       # Ignore formatting issues in dev
      focus_on_security: true       # Prioritize security issues
      allow_experimental: true      # Allow experimental code patterns
```

### UAT Environment

```yaml
environments:
  uat:
    enabled: true
    blocking: false                 # Don't block merges, but create issues
    notification_channels: ["github", "email", "slack"]
    
    quality_gates:
      enabled: true
      min_quality_score: 0.7        # Medium threshold for UAT
      max_severity_issues: 3
      max_high_severity_issues: 1
    
    overrides:
      allow_urgent_override: true
      urgent_keyword: "URGENT"
      daily_override_limit: 3
    
    custom_rules:
      strict_security: true         # Strict security checks
      performance_focus: true       # Focus on performance issues
      production_ready: true        # Ensure production readiness
```

### Production Environment

```yaml
environments:
  main:
    enabled: true
    blocking: true                  # Block merges on failures
    notification_channels: ["github", "email", "slack"]
    
    quality_gates:
      enabled: true
      min_quality_score: 0.8        # High threshold for production
      max_severity_issues: 1
      max_high_severity_issues: 0   # No high severity issues allowed
    
    overrides:
      allow_urgent_override: true
      urgent_keyword: "URGENT"
      daily_override_limit: 1       # Very limited overrides for production
      require_approval: true        # Require manual approval for overrides
    
    custom_rules:
      zero_tolerance_security: true # Zero tolerance for security issues
      production_standards: true    # Strict production standards
      performance_critical: true    # Critical performance requirements
```

## Notification Configuration

### Email Notifications

```yaml
notifications:
  email:
    enabled: true
    smtp:
      host: "smtp.gmail.com"
      port: 587
      secure: true
      auth:
        user: "your-email@gmail.com"
        pass: "${{ secrets.EMAIL_PASSWORD }}"
    
    recipients:
      - "team-lead@company.com"
      - "devops@company.com"
      - "security@company.com"
    
    templates:
      subject: "AI Code Review: {status} - {repository}/{branch}"
      body: |
        AI Code Review completed for {repository}/{branch}
        
        **Status:** {status}
        **Quality Score:** {quality_score}
        **Issues Found:** {issue_count}
        **Review Duration:** {duration}
        
        **Summary:**
        - High Severity: {high_count}
        - Medium Severity: {medium_count}
        - Low Severity: {low_count}
        
        **Review Details:** {github_issue_url}
        
        ---
        This is an automated message from the AI Code Review System.
    
    # Notification triggers
    triggers:
      on_failure: true              # Send on review failure
      on_success: false             # Don't send on success
      on_override: true             # Send when override is used
      on_security_issues: true      # Always send for security issues
```

### Slack Notifications

```yaml
notifications:
  slack:
    enabled: true
    webhook_url: "${{ secrets.SLACK_WEBHOOK_URL }}"
    channel: "#code-reviews"
    
    templates:
      message: |
        :robot_face: **AI Code Review: {status}**
        
        **Repository:** {repository}
        **Branch:** {branch}
        **Quality Score:** {quality_score}
        **Issues Found:** {issue_count}
        
        **Severity Breakdown:**
        • High: {high_count}
        • Medium: {medium_count}
        • Low: {low_count}
        
        <{github_issue_url}|View Details>
    
    # Message formatting
    formatting:
      include_attachments: true
      include_thumbnails: true
      color_scheme:
        success: "#36a64f"
        warning: "#ff9500"
        error: "#ff0000"
    
    triggers:
      on_failure: true
      on_override: true
      on_security_issues: true
```

### GitHub Notifications

```yaml
notifications:
  github:
    enabled: true
    
    # Issue creation settings
    issue_creation:
      enabled: true
      assignees: ["team-lead"]
      labels: ["ai-review", "code-quality"]
      milestone: "Code Review"
    
    # Issue templates
    templates:
      title: "AI Code Review: {branch} - {status}"
      body: |
        ## AI Code Review Results
        
        **Branch:** {branch}
        **Status:** {status}
        **Quality Score:** {quality_score}
        **Review Duration:** {duration}
        
        ### Issues Found: {issue_count}
        
        {issues_list}
        
        ### Recommendations
        
        {recommendations}
        
        ---
        *This issue was automatically created by the AI Code Review System.*
    
    # Status check settings
    status_checks:
      enabled: true
      name: "AI Code Review"
      description: "Automated code review using AI"
      context: "ai-review"
```

## Monitoring and Alerting

### Dashboard Configuration

```yaml
monitoring:
  dashboard:
    enabled: true
    directory: "./dashboard"
    url: "https://your-domain.com/dashboard"
    auto_refresh_interval: 300      # 5 minutes
    
    # Dashboard features
    features:
      real_time_metrics: true
      performance_trends: true
      alert_history: true
      system_health: true
      cost_analysis: true
    
    # Data retention
    retention:
      metrics_days: 30
      logs_days: 90
      alerts_days: 365
```

### Alert Configuration

```yaml
monitoring:
  alerts:
    # Response time alerts
    response_time:
      enabled: true
      threshold: 10000              # 10 seconds
      action: "alert"               # alert, block, warn
    
    # Error rate alerts
    error_rate:
      enabled: true
      threshold: 5                  # 5%
      action: "alert"
    
    # Quality score alerts
    quality_score:
      enabled: true
      threshold: 0.7
      action: "warn"
    
    # Cost alerts
    cost:
      enabled: true
      threshold: 0.10               # $0.10 per review
      action: "alert"
    
    # Failure rate alerts
    failure_rate:
      enabled: true
      threshold: 10                 # 10%
      action: "block"
    
    # Review volume alerts
    review_volume:
      enabled: true
      threshold: 100                # 100 reviews per day
      action: "warn"
    
    # Alert channels
    channels:
      email:
        enabled: true
        recipients: ["alerts@company.com"]
        frequency: "immediate"
      
      slack:
        enabled: true
        channel: "#alerts"
        frequency: "immediate"
      
      github:
        enabled: true
        repository: "your-org/alerts"
        frequency: "daily"
      
      webhook:
        enabled: false
        url: "https://your-webhook.com/alerts"
        frequency: "immediate"
```

## Audit and Compliance

### Audit Configuration

```yaml
audit:
  enabled: true
  log_level: "info"                 # debug, info, warn, error
  
  # Data retention settings
  retention_days: 90
  compliance_mode: false
  
  # Data retention policies
  data_retention:
    audit_logs: 365                 # 1 year
    performance_logs: 90            # 3 months
    error_logs: 30                  # 1 month
    compliance_logs: 2555           # 7 years
  
  # Audit trail features
  features:
    audit_chain: true               # Blockchain-like audit trail
    data_integrity: true            # Hash verification
    compliance_tracking: true       # Regulatory compliance
    access_logging: true            # Access audit logs
  
  # Compliance settings
  compliance:
    sox: false                      # SOX compliance
    gdpr: false                     # GDPR compliance
    hipaa: false                    # HIPAA compliance
    pci_dss: false                  # PCI DSS compliance
```

## Advanced Configuration

### Performance Optimization

```yaml
performance:
  # Caching settings
  caching:
    enabled: true
    cache_key: "ai-review-${{ github.sha }}"
    cache_path: ".cache/ai-review"
    retention_days: 7
  
  # Parallel processing
  parallel:
    enabled: true
    max_concurrent: 5
    timeout_minutes: 10
  
  # Resource limits
  limits:
    max_memory: "512MB"
    max_cpu: "2"
    max_disk: "1GB"
  
  # Optimization strategies
  optimization:
    token_optimization: true
    response_caching: true
    file_chunking: true
    incremental_reviews: true
```

### Security Configuration

```yaml
security:
  # API security
  api:
    rate_limiting: true
    request_signing: true
    encryption: true
  
  # Data protection
  data_protection:
    encryption_at_rest: true
    encryption_in_transit: true
    data_masking: true
    anonymization: true
  
  # Access control
  access_control:
    authentication: true
    authorization: true
    audit_logging: true
    session_management: true
```

### Custom Integrations

```yaml
integrations:
  # External tools integration
  tools:
    sonarqube:
      enabled: false
      url: "https://sonarqube.company.com"
      token: "${{ secrets.SONARQUBE_TOKEN }}"
    
    jira:
      enabled: false
      url: "https://company.atlassian.net"
      username: "${{ secrets.JIRA_USERNAME }}"
      api_token: "${{ secrets.JIRA_API_TOKEN }}"
    
    teams:
      enabled: false
      webhook_url: "${{ secrets.TEAMS_WEBHOOK_URL }}"
  
  # Custom webhooks
  webhooks:
    - name: "custom-alert"
      url: "https://your-webhook.com/alert"
      events: ["review_failed", "security_issue"]
      headers:
        Authorization: "Bearer ${{ secrets.WEBHOOK_TOKEN }}"
```

## Configuration Validation

### Schema Validation

The configuration file is validated against a JSON schema to ensure correctness:

```yaml
# Configuration validation
validation:
  schema_version: "1.0"
  strict_mode: true
  required_fields:
    - "ai.model"
    - "review.severity_thresholds"
    - "environments"
  
  # Field validation rules
  rules:
    ai.model:
      type: "string"
      enum: ["gpt-4", "gpt-3.5-turbo"]
    
    review.min_quality_score:
      type: "number"
      minimum: 0.0
      maximum: 1.0
    
    review.max_files_per_review:
      type: "integer"
      minimum: 1
      maximum: 1000
```

### Configuration Testing

```yaml
# Configuration testing
testing:
  enabled: true
  
  # Test scenarios
  scenarios:
    - name: "basic_review"
      description: "Test basic code review functionality"
      files: ["test/sample.js"]
      expected_result: "success"
    
    - name: "security_review"
      description: "Test security vulnerability detection"
      files: ["test/security_test.js"]
      expected_result: "failure"
      expected_issues: ["security"]
    
    - name: "performance_review"
      description: "Test performance issue detection"
      files: ["test/performance_test.js"]
      expected_result: "warning"
      expected_issues: ["performance"]
  
  # Validation rules
  validation:
    check_syntax: true
    check_semantics: true
    check_performance: true
    check_security: true
```

## Configuration Examples

### Complete Configuration Example

```yaml
# Complete AI Code Review Configuration
ai:
  model: "gpt-4"
  max_tokens: 4000
  temperature: 0.1
  timeout: 30000
  max_retries: 3
  rate_limit: 10

review:
  severity_thresholds:
    security: "HIGH"
    logic: "HIGH"
    standards: "MEDIUM"
    performance: "MEDIUM"
    formatting: "LOW"
  
  min_quality_score: 0.7
  max_files_per_review: 50
  max_file_size: 1048576
  
  excluded_files:
    - "*.env"
    - "node_modules/**"
    - "dist/**"
    - "*.log"
    - "*.md"
    - "*.json"

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

notifications:
  email:
    enabled: true
    recipients: ["team-lead@company.com"]
  
  slack:
    enabled: false
    channel: "#code-reviews"

monitoring:
  dashboard:
    enabled: true
    directory: "./dashboard"
  
  alerts:
    response_time:
      enabled: true
      threshold: 10000
    error_rate:
      enabled: true
      threshold: 5

audit:
  enabled: true
  log_level: "info"
  retention_days: 90
```

This configuration reference provides comprehensive documentation for all available options in the AI Code Review System. Use this as a guide to customize the system according to your specific requirements and constraints.



