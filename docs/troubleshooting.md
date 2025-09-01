# AI Code Review System - Troubleshooting Guide

## Overview

This troubleshooting guide provides solutions for common issues you may encounter when using the AI Code Review System. It includes error messages, diagnostic steps, and resolution procedures.

## Table of Contents

1. [Quick Diagnostic Checklist](#quick-diagnostic-checklist)
2. [Common Error Messages](#common-error-messages)
3. [Workflow Issues](#workflow-issues)
4. [API and Integration Issues](#api-and-integration-issues)
5. [Configuration Problems](#configuration-problems)
6. [Performance Issues](#performance-issues)
7. [Security and Permission Issues](#security-and-permission-issues)
8. [Monitoring and Alerting Issues](#monitoring-and-alerting-issues)
9. [Debug Mode and Logging](#debug-mode-and-logging)
10. [Getting Help](#getting-help)

## Quick Diagnostic Checklist

Before diving into specific issues, run through this checklist:

### ✅ Basic Setup Verification
- [ ] GitHub Actions are enabled on the repository
- [ ] Workflow file exists at `.github/workflows/ai-code-review.yml`
- [ ] Configuration file exists at `.github/ai-review-config.yml`
- [ ] Required secrets are set in repository settings
- [ ] Branch protection rules are configured (if needed)

### ✅ API and Authentication
- [ ] OpenAI API key is valid and has sufficient credits
- [ ] GitHub token has required permissions
- [ ] API rate limits are not exceeded
- [ ] Network connectivity is stable

### ✅ Configuration Validation
- [ ] YAML syntax is correct
- [ ] All required fields are present
- [ ] File paths and patterns are valid
- [ ] Environment settings match branch names

## Common Error Messages

### Error: "OpenAI API key is invalid or expired"

**Symptoms:**
```
Error: OpenAI API key is invalid or expired
Status: 401 Unauthorized
```

**Causes:**
- Invalid API key format
- Expired API key
- Insufficient credits
- Incorrect secret name

**Solutions:**
1. **Verify API Key Format:**
   ```bash
   # OpenAI API keys should start with 'sk-'
   sk-1234567890abcdef1234567890abcdef1234567890abcdef
   ```

2. **Check API Key Status:**
   - Visit [OpenAI Platform](https://platform.openai.com/account/api-keys)
   - Verify key is active and has credits
   - Check usage limits

3. **Update GitHub Secret:**
   ```bash
   # In repository settings → Secrets and variables → Actions
   # Update OPENAI_API_KEY secret with correct value
   ```

4. **Test API Key:**
   ```bash
   curl -H "Authorization: Bearer YOUR_API_KEY" \
        https://api.openai.com/v1/models
   ```

### Error: "GitHub token does not have required permissions"

**Symptoms:**
```
Error: GitHub token does not have required permissions
Status: 403 Forbidden
```

**Causes:**
- Insufficient token permissions
- Token expired
- Repository access denied

**Solutions:**
1. **Check Token Permissions:**
   - Go to GitHub Settings → Developer settings → Personal access tokens
   - Ensure token has these scopes:
     - `repo` (Full control of private repositories)
     - `workflow` (Update GitHub Action workflows)
     - `admin:org` (if using organization repositories)

2. **Regenerate Token:**
   ```bash
   # Create new token with required permissions
   # Update GITHUB_TOKEN secret in repository settings
   ```

3. **Verify Repository Access:**
   - Ensure token has access to the specific repository
   - Check organization permissions if applicable

### Error: "Configuration file not found or invalid"

**Symptoms:**
```
Error: Configuration file not found or invalid
File: .github/ai-review-config.yml
```

**Causes:**
- Missing configuration file
- Invalid YAML syntax
- Incorrect file path

**Solutions:**
1. **Verify File Location:**
   ```bash
   # Ensure file exists at correct path
   .github/ai-review-config.yml
   ```

2. **Check YAML Syntax:**
   ```bash
   # Use online YAML validator or local tool
   python -c "import yaml; yaml.safe_load(open('.github/ai-review-config.yml'))"
   ```

3. **Validate Configuration:**
   ```yaml
   # Minimum required configuration
   ai:
     model: "gpt-4"
   
   review:
     severity_thresholds:
       security: "HIGH"
       logic: "HIGH"
   
   environments:
     main:
       enabled: true
   ```

### Error: "Rate limit exceeded"

**Symptoms:**
```
Error: Rate limit exceeded
Retry after: 60 seconds
```

**Causes:**
- Too many API requests
- Concurrent reviews
- Low rate limit settings

**Solutions:**
1. **Check Rate Limits:**
   ```yaml
   # Increase rate limits in configuration
   ai:
     rate_limit: 20  # requests per minute
     max_retries: 5
   ```

2. **Implement Caching:**
   ```yaml
   # Enable caching to reduce API calls
   caching:
     enabled: true
     retention_days: 7
   ```

3. **Reduce Concurrent Reviews:**
   ```yaml
   # Limit concurrent reviews
   workflow:
     max_concurrent: 3
   ```

## Workflow Issues

### Issue: Workflow Not Triggering

**Symptoms:**
- No AI review runs when PR is created
- Workflow doesn't appear in Actions tab

**Diagnostic Steps:**
1. **Check Workflow File:**
   ```yaml
   # Verify workflow triggers
   on:
     pull_request:
       types: [opened, synchronize, reopened]
       branches: [main, dev, uat]  # Match your branch names
   ```

2. **Check Branch Names:**
   ```bash
   # Ensure branch names match exactly
   git branch -a
   ```

3. **Verify File Location:**
   ```bash
   # Workflow must be in correct location
   .github/workflows/ai-code-review.yml
   ```

**Solutions:**
1. **Update Branch Names:**
   ```yaml
   on:
     pull_request:
       branches: [main, master, develop, staging]  # Your actual branches
   ```

2. **Add Manual Trigger:**
   ```yaml
   on:
     pull_request:
       types: [opened, synchronize, reopened]
     workflow_dispatch:  # Allow manual triggering
   ```

3. **Check Repository Settings:**
   - Go to Settings → Actions → General
   - Ensure "Allow all actions and reusable workflows" is selected

### Issue: Workflow Fails Immediately

**Symptoms:**
- Workflow starts but fails in first step
- No detailed error information

**Diagnostic Steps:**
1. **Check Workflow Syntax:**
   ```yaml
   # Validate YAML syntax
   name: AI Code Review
   on: [pull_request]
   
   jobs:
     ai-review:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: ./
   ```

2. **Check Action Metadata:**
   ```yaml
   # Verify action.yml exists and is valid
   name: 'AI Code Review'
   description: 'Automated code review using AI'
   inputs:
     github_token:
       required: true
   ```

**Solutions:**
1. **Fix YAML Syntax:**
   - Use online YAML validator
   - Check indentation and spacing

2. **Update Action Dependencies:**
   ```yaml
   # Use latest action versions
   - uses: actions/checkout@v4
   - uses: actions/setup-node@v4
   ```

## API and Integration Issues

### Issue: OpenAI API Timeout

**Symptoms:**
```
Error: OpenAI API request timed out
Timeout: 30000ms
```

**Causes:**
- Large code changes
- Network connectivity issues
- OpenAI service delays

**Solutions:**
1. **Increase Timeout:**
   ```yaml
   ai:
     timeout: 60000  # 60 seconds
     max_retries: 5
   ```

2. **Optimize File Processing:**
   ```yaml
   review:
     max_file_size: 1048576  # 1MB
     max_files_per_review: 50
   ```

3. **Implement Chunking:**
   ```yaml
   # Break large reviews into chunks
   review:
     chunk_size: 1000  # lines per chunk
     parallel_processing: true
   ```

### Issue: GitHub API Rate Limiting

**Symptoms:**
```
Error: GitHub API rate limit exceeded
X-RateLimit-Remaining: 0
```

**Causes:**
- Too many GitHub API calls
- Low rate limit for token
- Concurrent workflows

**Solutions:**
1. **Use GitHub Token:**
   ```yaml
   # Use built-in GitHub token
   - uses: ./
     with:
       github_token: ${{ secrets.GITHUB_TOKEN }}
   ```

2. **Implement Caching:**
   ```yaml
   # Cache GitHub API responses
   - uses: actions/cache@v3
     with:
       path: .cache/github
       key: github-${{ github.sha }}
   ```

3. **Reduce API Calls:**
   ```yaml
   # Batch API operations
   review:
     batch_size: 10
     parallel_requests: 3
   ```

## Configuration Problems

### Issue: Invalid Configuration Format

**Symptoms:**
```
Error: Invalid configuration format
Field 'ai.model' is required
```

**Causes:**
- Missing required fields
- Invalid data types
- Incorrect YAML structure

**Solutions:**
1. **Use Configuration Template:**
   ```yaml
   # Basic configuration template
   ai:
     model: "gpt-4"
     max_tokens: 4000
     temperature: 0.1
   
   review:
     severity_thresholds:
       security: "HIGH"
       logic: "HIGH"
       standards: "MEDIUM"
       performance: "MEDIUM"
       formatting: "LOW"
     min_quality_score: 0.7
   
   environments:
     main:
       enabled: true
       blocking: true
   ```

2. **Validate Configuration:**
   ```bash
   # Use configuration validator
   npm run validate-config
   ```

3. **Check Data Types:**
   ```yaml
   # Ensure correct data types
   review:
     min_quality_score: 0.7  # number, not string
     max_files_per_review: 50  # integer, not string
   ```

### Issue: Environment Mismatch

**Symptoms:**
```
Error: Environment 'production' not found in configuration
Available environments: [dev, uat, main]
```

**Causes:**
- Branch name doesn't match environment configuration
- Missing environment definition
- Case sensitivity issues

**Solutions:**
1. **Match Branch Names:**
   ```yaml
   # Ensure environment names match branch names
   environments:
     main:  # matches 'main' branch
       enabled: true
     dev:   # matches 'dev' branch
       enabled: true
     uat:   # matches 'uat' branch
       enabled: true
   ```

2. **Add Environment Mapping:**
   ```yaml
   # Map branch names to environments
   branch_mapping:
     main: production
     master: production
     develop: dev
     staging: uat
   ```

3. **Use Default Environment:**
   ```yaml
   # Provide default environment
   default_environment:
     enabled: true
     blocking: false
     quality_gates:
       min_quality_score: 0.6
   ```

## Performance Issues

### Issue: Slow Review Performance

**Symptoms:**
- Reviews take longer than expected
- Timeout errors
- High resource usage

**Diagnostic Steps:**
1. **Check File Sizes:**
   ```bash
   # Identify large files
   find . -name "*.js" -size +1M
   ```

2. **Monitor API Response Times:**
   ```yaml
   # Enable performance monitoring
   monitoring:
     performance_tracking: true
     response_time_threshold: 10000
   ```

**Solutions:**
1. **Optimize File Exclusions:**
   ```yaml
   review:
     excluded_files:
       - "node_modules/**"
       - "dist/**"
       - "build/**"
       - "*.min.js"
       - "*.bundle.js"
   ```

2. **Implement Caching:**
   ```yaml
   caching:
     enabled: true
     cache_key: "ai-review-${{ github.sha }}"
     retention_days: 7
   ```

3. **Use Parallel Processing:**
   ```yaml
   workflow:
     parallel_reviews: 3
     max_concurrent: 5
   ```

### Issue: High Memory Usage

**Symptoms:**
- Out of memory errors
- Slow system performance
- Workflow failures

**Solutions:**
1. **Limit Resource Usage:**
   ```yaml
   performance:
     limits:
       max_memory: "512MB"
       max_cpu: "2"
       max_disk: "1GB"
   ```

2. **Optimize File Processing:**
   ```yaml
   review:
     stream_processing: true
     chunk_size: 1000
     memory_optimization: true
   ```

3. **Use External Processing:**
   ```yaml
   # Use external services for large files
   external_processing:
     enabled: true
     service: "aws-lambda"
     max_file_size: 5242880  # 5MB
   ```

## Security and Permission Issues

### Issue: Permission Denied Errors

**Symptoms:**
```
Error: Permission denied
Status: 403 Forbidden
```

**Causes:**
- Insufficient repository permissions
- Token scope limitations
- Organization restrictions

**Solutions:**
1. **Check Repository Permissions:**
   - Go to repository Settings → Collaborators and teams
   - Ensure user has appropriate permissions

2. **Update Token Scopes:**
   ```bash
   # Required scopes for GitHub token
   repo: Full control of private repositories
   workflow: Update GitHub Action workflows
   admin:org: Full control of orgs and teams (if applicable)
   ```

3. **Use Organization Token:**
   ```yaml
   # Use organization-level token for org repositories
   - uses: ./
     with:
       github_token: ${{ secrets.ORG_GITHUB_TOKEN }}
   ```

### Issue: Sensitive Data Exposure

**Symptoms:**
- API keys in logs
- Sensitive files included in review
- Security warnings

**Solutions:**
1. **Update File Exclusions:**
   ```yaml
   review:
     excluded_files:
       - "*.env"
       - "*.key"
       - "*.pem"
       - "secrets/**"
       - "config/production/**"
   ```

2. **Enable Data Masking:**
   ```yaml
   security:
     data_masking: true
     sensitive_patterns:
       - "sk-.*"
       - "ghp_.*"
       - "password.*"
   ```

3. **Use Secure Logging:**
   ```yaml
   audit:
     secure_logging: true
     mask_sensitive_data: true
     encryption: true
   ```

## Monitoring and Alerting Issues

### Issue: Alerts Not Triggering

**Symptoms:**
- No alert notifications
- Missing dashboard data
- Silent failures

**Diagnostic Steps:**
1. **Check Alert Configuration:**
   ```yaml
   monitoring:
     alerts:
       response_time:
         enabled: true
         threshold: 10000
       error_rate:
         enabled: true
         threshold: 5
   ```

2. **Verify Notification Channels:**
   ```yaml
   notifications:
     email:
       enabled: true
       recipients: ["team@company.com"]
     slack:
       enabled: true
       webhook_url: "${{ secrets.SLACK_WEBHOOK_URL }}"
   ```

**Solutions:**
1. **Test Alert Channels:**
   ```bash
   # Test email notifications
   curl -X POST https://api.sendgrid.com/v3/mail/send \
        -H "Authorization: Bearer $SENDGRID_API_KEY" \
        -d '{"personalizations":[{"to":[{"email":"test@example.com"}]}],"from":{"email":"noreply@company.com"},"subject":"Test Alert","content":[{"type":"text/plain","value":"Test message"}]}'
   ```

2. **Enable Debug Logging:**
   ```yaml
   audit:
     log_level: "debug"
     alert_debugging: true
   ```

3. **Check Alert History:**
   ```bash
   # View alert logs
   cat logs/alerts.log | grep "$(date +%Y-%m-%d)"
   ```

### Issue: Dashboard Not Updating

**Symptoms:**
- Stale dashboard data
- Missing metrics
- Dashboard errors

**Solutions:**
1. **Check Dashboard Configuration:**
   ```yaml
   monitoring:
     dashboard:
       enabled: true
       directory: "./dashboard"
       auto_refresh_interval: 300
   ```

2. **Verify Data Collection:**
   ```yaml
   monitoring:
     metrics_collection:
       enabled: true
       interval: 60
       retention_days: 30
   ```

3. **Check File Permissions:**
   ```bash
   # Ensure dashboard directory is writable
   chmod 755 ./dashboard
   chown -R $USER:$USER ./dashboard
   ```

## Debug Mode and Logging

### Enable Debug Mode

**For Workflow Debugging:**
```yaml
- uses: ./
  with:
    debug: true
    log_level: "debug"
```

**For Configuration Debugging:**
```yaml
audit:
  log_level: "debug"
  debug_mode: true
  verbose_logging: true
```

### View Debug Logs

**Workflow Logs:**
```bash
# View workflow execution logs
# Go to Actions tab → Select workflow → View logs
```

**Application Logs:**
```bash
# View application logs
cat logs/application.log | grep "DEBUG"

# View error logs
cat logs/errors.log | tail -50

# View audit logs
cat logs/audit.log | grep "$(date +%Y-%m-%d)"
```

### Common Debug Commands

```bash
# Test configuration validation
npm run validate-config

# Test API connectivity
npm run test-api

# Run performance tests
npm run test:perf

# Check system health
npm run health-check

# Generate debug report
npm run debug-report
```

## Getting Help

### Self-Service Resources

1. **Documentation:**
   - [Setup Guide](setup-guide.md)
   - [Usage Examples](usage-examples.md)
   - [Configuration Reference](configuration-reference.md)

2. **Troubleshooting Tools:**
   ```bash
   # Run diagnostic tools
   npm run diagnose
   npm run health-check
   npm run validate-config
   ```

3. **Log Analysis:**
   ```bash
   # Analyze logs for patterns
   npm run analyze-logs
   npm run performance-report
   ```

### Community Support

1. **GitHub Issues:**
   - Search existing issues
   - Create new issue with detailed information
   - Include logs and configuration

2. **Discussions:**
   - Use GitHub Discussions for questions
   - Share solutions and best practices
   - Get help from community

### Escalation Process

1. **Gather Information:**
   ```bash
   # Collect diagnostic information
   npm run collect-debug-info
   ```

2. **Create Issue:**
   - Include error messages
   - Attach configuration files
   - Provide reproduction steps
   - Include system information

3. **Contact Support:**
   - Email: support@ai-code-review.com
   - Include issue number and debug info
   - Provide business impact details

### Issue Template

When creating issues, use this template:

```markdown
## Issue Description
Brief description of the problem

## Steps to Reproduce
1. Step 1
2. Step 2
3. Step 3

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- Repository: [repository name]
- Branch: [branch name]
- Configuration: [config file contents]
- Error Logs: [relevant log entries]

## Additional Information
- Screenshots
- Debug information
- System details
```

This troubleshooting guide should help you resolve most common issues with the AI Code Review System. If you continue to experience problems, refer to the getting help section for additional support options.



