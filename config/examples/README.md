# 🚀 AI Code Review System - Configuration Examples

This directory contains example configuration files for different scenarios and use cases. Copy the example that best fits your needs and customize it for your environment.

## 📁 Available Examples

### 🏠 **Basic Examples**
- [`minimal-config.yml`](./minimal-config.yml) - Minimal working configuration
- [`development-config.yml`](./development-config.yml) - Development environment setup
- [`production-config.yml`](./production-config.yml) - Production environment setup

### 🎯 **Use Case Examples**
- [`security-focused.yml`](./security-focused.yml) - Security-first configuration
- [`performance-focused.yml`](./performance-focused.yml) - Performance optimization focus
- [`quality-focused.yml`](./quality-focused.yml) - Code quality emphasis
- [`startup-config.yml`](./startup-config.yml) - Small team/startup configuration
- [`enterprise-config.yml`](./enterprise-config.yml) - Large enterprise setup

### 🏢 **Industry Examples**
- [`fintech-config.yml`](./fintech-config.yml) - Financial technology requirements
- [`healthcare-config.yml`](./healthcare-config.yml) - Healthcare compliance needs
- [`ecommerce-config.yml`](./ecommerce-config.yml) - E-commerce platform setup
- [`saas-config.yml`](./saas-config.yml) - Software-as-a-Service configuration

### 🔧 **Integration Examples**
- [`github-actions.yml`](./github-actions.yml) - GitHub Actions integration
- [`jenkins-config.yml`](./jenkins-config.yml) - Jenkins CI/CD integration
- [`gitlab-config.yml`](./gitlab-config.yml) - GitLab CI/CD integration
- [`azure-devops.yml`](./azure-devops.yml) - Azure DevOps integration

## 🚀 Quick Start

### 1. Choose Your Example

```bash
# For a basic setup
cp examples/minimal-config.yml ai-review-config.yml

# For security focus
cp examples/security-focused.yml ai-review-config.yml

# For development
cp examples/development-config.yml ai-review-config.yml
```

### 2. Customize Configuration

```bash
# Edit the configuration
nano ai-review-config.yml

# Or use your preferred editor
code ai-review-config.yml
```

### 3. Set Environment Variables

```bash
# Required variables
export EMAIL_TO="your-team@company.com"
export SMTP_HOST="smtp.gmail.com"
export SMTP_USER="your-email@gmail.com"
export SMTP_PASS="your-app-password"
export GITHUB_TOKEN="your-github-token"
export OPENAI_API_KEY="your-openai-api-key"
```

### 4. Test Configuration

```bash
# Validate configuration
npm run validate-config

# Test components
npm run test-email
npm run test-github
```

## 📋 Example Categories

### 🔒 **Security-Focused Configurations**

These configurations prioritize security and compliance:

- **Strict file filtering** - Only review security-relevant files
- **Enhanced security scanning** - Deep security analysis
- **Critical issue blocking** - Block deployments on security issues
- **Security team assignment** - Automatic assignment to security experts
- **Audit logging** - Comprehensive security audit trails

**Best for:** Financial services, healthcare, government, security-conscious organizations

### ⚡ **Performance-Focused Configurations**

These configurations focus on code performance and optimization:

- **Performance analysis** - Complexity and efficiency metrics
- **Performance thresholds** - Strict performance quality gates
- **Performance team routing** - Expert performance review
- **Performance metrics** - Detailed performance reporting
- **Optimization suggestions** - AI-powered performance improvements

**Best for:** High-traffic applications, real-time systems, performance-critical services

### 🎯 **Quality-Focused Configurations**

These configurations emphasize overall code quality:

- **Comprehensive review** - Review all code changes
- **Quality metrics** - Detailed quality scoring
- **Style enforcement** - Consistent coding standards
- **Documentation review** - Code documentation quality
- **Testing coverage** - Test quality and coverage analysis

**Best for:** Open source projects, quality-focused teams, educational institutions

### 🏢 **Enterprise Configurations**

These configurations are designed for large organizations:

- **Multi-team support** - Multiple development teams
- **Role-based access** - Different permissions per role
- **Compliance reporting** - Regulatory compliance features
- **Integration support** - Enterprise tool integration
- **Scalability features** - High-volume processing

**Best for:** Large corporations, government agencies, enterprise software companies

## 🔧 Customization Guide

### Environment-Specific Settings

```yaml
# Base configuration
environment: 'production'
log_level: 'info'

# Environment-specific overrides
environments:
  development:
    log_level: 'debug'
    email_enabled: false
    issue_creation_enabled: false
  
  staging:
    log_level: 'info'
    email_enabled: true
    issue_creation_enabled: true
  
  production:
    log_level: 'warn'
    email_enabled: true
    issue_creation_enabled: true
```

### Team-Specific Configuration

```yaml
# Team configuration
teams:
  frontend:
    expertise: ['javascript', 'typescript', 'react', 'vue']
    capacity: 15
    members:
      - username: 'frontend-lead'
        expertise: ['react', 'typescript']
        seniority: 'senior'
        capacity: 8
  
  backend:
    expertise: ['python', 'java', 'nodejs', 'database']
    capacity: 12
    members:
      - username: 'backend-lead'
        expertise: ['python', 'architecture']
        seniority: 'senior'
        capacity: 8
```

### Custom Rules and Policies

```yaml
# Custom review rules
review:
  custom_rules:
    - name: 'No console.log in production'
      pattern: 'console\\.log'
      severity: 'medium'
      message: 'Remove console.log statements before production'
    
    - name: 'Require JSDoc for public functions'
      pattern: 'function\\s+\\w+\\s*\\('
      severity: 'low'
      message: 'Add JSDoc documentation for public functions'
  
  quality_gates:
    min_score: 0.8
    max_issues: 5
    block_on_critical: true
    block_on_security: true
```

## 📊 Configuration Comparison

| Feature | Minimal | Security | Performance | Quality | Enterprise |
|---------|---------|----------|-------------|---------|------------|
| **Email Notifications** | ✅ Basic | ✅ Enhanced | ✅ Standard | ✅ Standard | ✅ Advanced |
| **Issue Creation** | ❌ Disabled | ✅ Security Only | ✅ Performance Focus | ✅ All Issues | ✅ Comprehensive |
| **Team Assignment** | ❌ Disabled | ✅ Security Team | ✅ Performance Team | ✅ General | ✅ Multi-Team |
| **Labeling** | ❌ Disabled | ✅ Security Labels | ✅ Performance Labels | ✅ All Labels | ✅ Advanced |
| **Quality Gates** | ✅ Basic | ✅ Strict | ✅ Performance | ✅ Quality | ✅ Comprehensive |
| **Compliance** | ❌ None | ✅ Security | ❌ None | ❌ None | ✅ Full |
| **Integration** | ❌ Basic | ❌ Basic | ❌ Basic | ❌ Basic | ✅ Advanced |

## 🚨 Important Notes

### ⚠️ **Security Considerations**

- **Never commit secrets** to version control
- **Use environment variables** for sensitive data
- **Rotate API keys** regularly
- **Monitor access** to configuration files
- **Validate configuration** before deployment

### 🔧 **Performance Considerations**

- **Cache configuration** in production
- **Lazy load** configuration sections
- **Validate early** to fail fast
- **Monitor configuration** loading time
- **Use appropriate** log levels

### 📚 **Maintenance Considerations**

- **Document changes** to configuration
- **Version control** configuration files
- **Test changes** in staging first
- **Backup configuration** before changes
- **Have rollback** plan ready

## 🆘 Getting Help

### 📖 **Documentation**

- [Configuration Guide](../docs/CONFIGURATION_GUIDE.md)
- [API Reference](../api/README.md)
- [Deployment Guide](../deployment/README.md)

### 🐛 **Troubleshooting**

- [Common Issues](../docs/TROUBLESHOOTING.md)
- [Configuration Validation](../docs/VALIDATION.md)
- [Debug Mode](../docs/DEBUG.md)

### 💬 **Support**

- [GitHub Issues](https://github.com/your-org/ai-code-review/issues)
- [Discussions](https://github.com/your-org/ai-code-review/discussions)
- [Wiki](https://github.com/your-org/ai-code-review/wiki)

## 📝 **Contributing Examples**

We welcome contributions of new configuration examples! To contribute:

1. **Create a new file** in the `examples/` directory
2. **Follow the naming convention**: `descriptive-name-config.yml`
3. **Include comprehensive comments** explaining each section
4. **Add documentation** in this README
5. **Test the configuration** before submitting
6. **Submit a pull request** with your example

### Example Template

```yaml
# Example: [Descriptive Name] Configuration
# Use case: [Brief description of when to use this config]
# Best for: [Target audience/organization type]
# Last updated: [Date]

# Basic configuration
environment: 'production'
log_level: 'info'

# [Add your configuration sections here]
# Include detailed comments for each section
# Provide examples and explanations
# Document any special requirements or dependencies

# Configuration metadata
metadata:
  example_name: '[Descriptive Name]'
  use_case: '[Brief description]'
  target_audience: '[Target users]'
  complexity: '[Simple/Medium/Complex]'
  estimated_setup_time: '[Time estimate]'
```

---

*Last updated: December 19, 2024*
*Version: 1.0.0*

