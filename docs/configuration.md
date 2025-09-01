# AI Code Review Configuration Guide

This document explains how to configure the AI-powered code review system for your repository.

## Quick Start

1. Copy the minimal configuration template:
   ```bash
   cp .github/ai-review-config-minimal.yml .github/ai-review-config.yml
   ```

2. Update the `team_lead_username` in the configuration file with your team lead's GitHub username.

3. The system will automatically use these settings for all code reviews.

## Configuration File Location

The system looks for configuration files in the following order:
1. `.github/ai-review-config.yml` (recommended)
2. `.github/ai-review-config.yaml`
3. `ai-review-config.yml`
4. `ai-review-config.yaml`
5. `.ai-review-config.yml`
6. `.ai-review-config.yaml`

## Configuration Structure

### Basic Settings

```yaml
version: '1.0'          # Configuration version
enabled: true           # Enable/disable the system
```

### Global Settings

```yaml
global:
  severity_threshold: 'MEDIUM'    # Minimum severity to report (LOW, MEDIUM, HIGH)
  max_files_per_review: 50        # Maximum files to review per commit
  max_file_size_bytes: 1000000    # Maximum file size (1MB)
  timeout_seconds: 300            # AI review timeout
  retry_attempts: 3               # API retry attempts
  retry_delay_seconds: 5          # Delay between retries
```

### Environment-Specific Settings

```yaml
environments:
  development:
    severity_threshold: 'LOW'     # More lenient for dev
    max_files_per_review: 100     # Allow more files
    timeout_seconds: 600          # Longer timeout
    
  staging:
    severity_threshold: 'MEDIUM'  # Standard review
    
  production:
    severity_threshold: 'HIGH'    # Strict review
    max_files_per_review: 50      # Limit files
    timeout_seconds: 300          # Faster timeout
```

### Rule Configuration

```yaml
rules:
  security:
    enabled: true
    priority: 'HIGH'
    checks:
      - 'SQL injection vulnerabilities'
      - 'XSS vulnerabilities'
      - 'CSRF vulnerabilities'
      - 'Authentication bypass'
      - 'Authorization flaws'
      - 'Input validation issues'
      - 'Sensitive data exposure'
      - 'Insecure dependencies'
    custom_patterns: []           # Custom security patterns
    excluded_files:               # Files to skip
      - '*.test.js'
      - '*.spec.js'
      - 'tests/**/*'

  logic:
    enabled: true
    priority: 'HIGH'
    checks:
      - 'Null pointer exceptions'
      - 'Array bounds checking'
      - 'Type safety issues'
      - 'Race conditions'
      - 'Deadlock potential'
      - 'Resource leaks'
      - 'Error handling gaps'
      - 'Edge case handling'

  performance:
    enabled: true
    priority: 'MEDIUM'
    checks:
      - 'Inefficient algorithms'
      - 'Memory leaks'
      - 'Unnecessary computations'
      - 'Database query optimization'
      - 'Network call optimization'
      - 'Resource usage patterns'
      - 'Caching opportunities'
      - 'Async/await usage'

  standards:
    enabled: true
    priority: 'MEDIUM'
    checks:
      - 'Code style consistency'
      - 'Naming conventions'
      - 'Function complexity'
      - 'Code duplication'
      - 'Documentation quality'
      - 'Error handling patterns'
      - 'Logging standards'
      - 'Testing coverage'

  maintainability:
    enabled: true
    priority: 'LOW'
    checks:
      - 'Code readability'
      - 'Function length'
      - 'Class design'
      - 'Separation of concerns'
      - 'Dependency management'
      - 'Configuration management'
      - 'Code organization'
      - 'Future-proofing'
```

### File Filtering

```yaml
file_filtering:
  exclude_patterns:
    - '*.sql'              # Database files
    - '.env*'              # Environment files
    - '*.log'              # Log files
    - '*.key'              # Key files
    - '*.pem'              # Certificate files
    - '*.jpg'              # Image files
    - '*.png'
    - '*.gif'
    - '*.svg'
    - 'node_modules/**/*'  # Dependencies
    - '.git/**/*'          # Git files
    - 'dist/**/*'          # Build outputs
    - 'build/**/*'
    - 'coverage/**/*'      # Test coverage
    
  include_patterns: []     # Force include patterns
  max_file_size_bytes: 1000000
  max_files_per_review: 50
```

### Notification Settings

#### GitHub Issues

```yaml
notifications:
  github_issues:
    enabled: true
    assign_to_team_lead: true
    team_lead_username: 'your-team-lead-username'
    issue_labels:
      - 'ai-review'
      - 'code-quality'
    issue_template: 'default'
```

#### Email Notifications

```yaml
notifications:
  email:
    enabled: true
    smtp_host: 'smtp.gmail.com'
    smtp_port: 587
    smtp_user: 'your-email@gmail.com'
    smtp_pass: 'your-app-password'
    from_email: 'ai-review@yourcompany.com'
    to_emails:
      - 'team-lead@yourcompany.com'
      - 'dev-team@yourcompany.com'
```

#### Slack Notifications

```yaml
notifications:
  slack:
    enabled: true
    webhook_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
    channel: '#ai-reviews'
    notify_on_failure_only: true
```

### Production Quality Gates

```yaml
quality_gates:
  enabled: true                    # Enable production blocking
  block_high_severity: true        # Block high severity issues
  block_medium_severity: false     # Allow medium severity issues
  allow_urgent_override: true      # Allow URGENT commits to bypass
  urgent_keywords:                 # Keywords that trigger override
    - 'URGENT'
    - 'EMERGENCY'
    - 'HOTFIX'
  override_logging: true           # Log override usage
  max_override_frequency: 5        # Max overrides per day
```

### AI Settings

```yaml
ai:
  model: 'gpt-4'                   # AI model to use
  temperature: 0.1                 # Response creativity (0.0-1.0)
  max_tokens: 8000                 # Maximum response length
  system_prompt_template: 'default'
  response_format: 'json'          # Structured response format
  language_specific_prompts: true  # Use language-specific guidance
```

### Logging and Monitoring

```yaml
logging:
  level: 'INFO'                    # Log level (DEBUG, INFO, WARN, ERROR)
  audit_trail: true                # Log all review activities
  performance_metrics: true        # Track performance metrics
  error_reporting: true            # Report errors
  log_retention_days: 30          # Keep logs for 30 days
```

## Environment Detection

The system automatically detects the environment based on:

1. **Branch name patterns:**
   - `main`, `master` → `production`
   - `staging`, `uat`, `preprod` → `staging`
   - `develop`, `dev`, `feature/*` → `development`

2. **Environment variables:**
   - `NODE_ENV`
   - `ENVIRONMENT`

3. **Manual override:**
   - Set `current_environment` in configuration

## Severity Levels

- **LOW**: Minor issues, suggestions for improvement
- **MEDIUM**: Code quality issues, potential problems
- **HIGH**: Security vulnerabilities, critical bugs, logic flaws

## Best Practices

### 1. Start with Minimal Configuration

Begin with the minimal configuration and gradually add more rules as needed.

### 2. Environment-Specific Settings

Use different severity thresholds for different environments:
- **Development**: `LOW` - Catch issues early
- **Staging**: `MEDIUM` - Standard review
- **Production**: `HIGH` - Strict review

### 3. File Filtering

Always exclude sensitive files:
- Environment files (`.env*`)
- Database files (`*.sql`)
- Log files (`*.log`)
- Binary files (`*.exe`, `*.dll`)
- Dependencies (`node_modules/**/*`)

### 4. Notification Strategy

- Use GitHub Issues for detailed feedback
- Use email for critical issues
- Use Slack for team notifications

### 5. Production Quality Gates

Enable quality gates for production branches to prevent critical issues from being deployed.

## Troubleshooting

### Configuration Not Loading

1. Check file location and naming
2. Validate YAML syntax
3. Check file permissions

### Validation Errors

The system validates configuration on load. Common issues:
- Missing required fields
- Invalid severity levels
- Invalid boolean values
- Missing notification credentials

### Performance Issues

- Reduce `max_files_per_review`
- Increase `timeout_seconds`
- Add more file exclusions
- Use environment-specific settings

## Examples

### Node.js Project

```yaml
version: '1.0'
enabled: true

global:
  severity_threshold: 'MEDIUM'
  max_files_per_review: 50

environments:
  development:
    severity_threshold: 'LOW'
  production:
    severity_threshold: 'HIGH'

rules:
  security:
    enabled: true
    priority: 'HIGH'
  logic:
    enabled: true
    priority: 'HIGH'
  performance:
    enabled: true
    priority: 'MEDIUM'

file_filtering:
  exclude_patterns:
    - '*.sql'
    - '.env*'
    - 'node_modules/**/*'
    - 'dist/**/*'
    - 'coverage/**/*'

notifications:
  github_issues:
    enabled: true
    assign_to_team_lead: true
    team_lead_username: 'your-team-lead'
```

### Python Project

```yaml
version: '1.0'
enabled: true

global:
  severity_threshold: 'MEDIUM'

environments:
  development:
    severity_threshold: 'LOW'
  production:
    severity_threshold: 'HIGH'

rules:
  security:
    enabled: true
    priority: 'HIGH'
  logic:
    enabled: true
    priority: 'HIGH'

file_filtering:
  exclude_patterns:
    - '*.pyc'
    - '__pycache__/**/*'
    - 'venv/**/*'
    - '.env*'
    - '*.log'

notifications:
  github_issues:
    enabled: true
    assign_to_team_lead: true
    team_lead_username: 'your-team-lead'
```

## Support

For configuration issues or questions:
1. Check the validation errors in the logs
2. Review the example configurations
3. Consult the troubleshooting section
4. Open an issue in the repository



