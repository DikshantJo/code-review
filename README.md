# 🤖 AI Code Review GitHub Action

An intelligent, AI-powered code review system that automatically analyzes pull requests and commits for security vulnerabilities, code quality issues, and best practices using OpenAI's GPT-4.

## ✨ Features

- **🔒 Security Analysis**: Detects SQL injection, XSS, CSRF, and other security vulnerabilities
- **📊 Code Quality**: Identifies performance issues, code smells, and maintainability concerns
- **🎯 Environment-Aware**: Different severity thresholds for dev, staging, and production
- **⚡ Performance Optimized**: Handles large commits efficiently with configurable limits
- **📧 Smart Notifications**: Email and Slack alerts for critical issues
- **📈 Monitoring Dashboard**: Real-time metrics and health monitoring
- **🔄 Fallback Handling**: Graceful degradation when AI services are unavailable

## 🚀 Quick Start

### 1. Add the Action to Your Workflow

```yaml
# .github/workflows/ai-review.yml
name: AI Code Review

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main, staging, production]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: AI Code Review
        uses: YOUR_USERNAME/YOUR_REPO_NAME@v1.0.0
        with:
          target-branch: ${{ github.base_ref || github.ref_name }}
          severity-threshold: 'MEDIUM'
          enable-production-gates: true
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # Optional notification credentials
          SMTP_HOST: ${{ secrets.SMTP_HOST }}
          SMTP_USER: ${{ secrets.SMTP_USER }}
          SMTP_PASS: ${{ secrets.SMTP_PASS }}
          SMTP_PORT: ${{ secrets.SMTP_PORT }}
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### 2. Configure Your Repository

Create `.github/ai-review-config.yml`:

```yaml
version: '1.0'
enabled: true

environments:
  development:
    severity_threshold: 'LOW'
    max_files_per_review: 100
  
  production:
    severity_threshold: 'HIGH'
    max_files_per_review: 50
    rules:
      security: { enabled: true, priority: 'HIGH' }
      performance: { enabled: true, priority: 'HIGH' }

# Notification settings
notifications:
  email:
    enabled: true
    smtp_host: ${{ secrets.SMTP_HOST }}
    smtp_port: ${{ secrets.SMTP_PORT || 587 }}
    smtp_user: ${{ secrets.SMTP_USER }}
    smtp_pass: ${{ secrets.SMTP_PASS }}
    from_email: 'ai-review@yourcompany.com'
    to_emails: ['team@yourcompany.com']
  
  slack:
    enabled: true
    webhook_url: ${{ secrets.SLACK_WEBHOOK_URL }}
    channel: '#ai-reviews'
```

### 3. Set Required Secrets

- `OPENAI_API_KEY`: Your OpenAI API key
- `GITHUB_TOKEN`: GitHub token (automatically provided)

### 4. Configure Notifications (Optional)

If you want email notifications, add these secrets:
- `SMTP_HOST`: Your SMTP server (e.g., `smtp.gmail.com`)
- `SMTP_USER`: SMTP username/email
- `SMTP_PASS`: SMTP password or app-specific password
- `SMTP_PORT`: SMTP port (default: 587)
- `SMTP_SECURE`: Use TLS (default: false)

For Slack notifications:
- `SLACK_WEBHOOK_URL`: Your Slack webhook URL

## ⚙️ Configuration

### Action Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `target-branch` | Branch being reviewed | Yes | - |
| `severity-threshold` | Minimum severity to report | No | `MEDIUM` |
| `enable-production-gates` | Enable production quality gates | No | `false` |
| `timeout` | Review timeout in seconds | No | `300` |
| `max-files` | Maximum files per review | No | `50` |
| `max-file-size` | Maximum file size in bytes | No | `1000000` |

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key | Yes |
| `GITHUB_TOKEN` | GitHub token | Yes |

#### Optional Notification Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SMTP_HOST` | SMTP server hostname | - |
| `SMTP_USER` | SMTP username/email | - |
| `SMTP_PASS` | SMTP password | - |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_SECURE` | Use TLS | `false` |
| `SLACK_WEBHOOK_URL` | Slack webhook URL | - |

## 📧 Notification Setup

### Email Configuration

The action supports various SMTP providers. Here are common configurations:

#### Gmail
```yaml
notifications:
  email:
    enabled: true
    smtp_host: 'smtp.gmail.com'
    smtp_port: 587
    smtp_secure: false
    smtp_user: 'your-email@gmail.com'
    smtp_pass: 'your-app-specific-password'  # Use app password, not regular password
```

#### Outlook/Office 365
```yaml
notifications:
  email:
    enabled: true
    smtp_host: 'smtp-mail.outlook.com'
    smtp_port: 587
    smtp_secure: false
    smtp_user: 'your-email@outlook.com'
    smtp_pass: 'your-password'
```

#### SendGrid
```yaml
notifications:
  email:
    enabled: true
    smtp_host: 'smtp.sendgrid.net'
    smtp_port: 587
    smtp_secure: false
    smtp_user: 'apikey'
    smtp_pass: 'your-sendgrid-api-key'
```

#### Custom SMTP Server
```yaml
notifications:
  email:
    enabled: true
    smtp_host: 'mail.yourcompany.com'
    smtp_port: 587
    smtp_secure: false
    smtp_user: 'ai-review@yourcompany.com'
    smtp_pass: 'your-password'
```

### Slack Configuration

```yaml
notifications:
  slack:
    enabled: true
    webhook_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
    channel: '#ai-reviews'
    username: 'AI Review Bot'
    notify_on_failure_only: true
```

### Security Best Practices

1. **Use App-Specific Passwords**: For Gmail and other providers, use app-specific passwords instead of your main password
2. **Environment-Specific Credentials**: Use different SMTP accounts for different environments (dev/staging/prod)
3. **Secret Rotation**: Regularly rotate your SMTP passwords and API keys
4. **Minimal Permissions**: Use dedicated email accounts with minimal permissions for notifications
5. **Audit Logging**: Enable audit logging to monitor email notification usage

### Troubleshooting Email Issues

- **Authentication Failed**: Check SMTP credentials and ensure 2FA is properly configured
- **Connection Timeout**: Verify SMTP host and port, check firewall settings
- **Rate Limiting**: Some providers limit emails per hour/day
- **Spam Filters**: Ensure your from_email is properly configured and not marked as spam

## 🔧 Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME

# Install dependencies
npm install

# Build the action
npm run build

# Run tests
npm test
```

### Project Structure

```
src/
├── actions/          # Main action logic
├── utils/            # Utility modules
├── prompts/          # AI prompt templates
└── tests/            # Test files

.github/
├── workflows/        # GitHub Actions workflows
└── ai-review-config.yml  # Default configuration
```

## 📊 Test Coverage

Current test coverage: **69.55%** (target: 80%)

- ✅ Unit tests for all utility modules
- ✅ Integration tests for core workflows
- ✅ Performance tests for scalability
- ⚠️ Some tests need mocking improvements

## 🔧 Configuration Management

The system includes comprehensive configuration management tools:

### Configuration Migration
```bash
# Check if migration is needed
npm run config:migrate check config/email-config.yml

# Migrate to latest version
npm run config:migrate migrate config/email-config.yml
```

### Configuration Backup & Restore
```bash
# Create backup
npm run config:backup backup config/*.yml

# List backups
npm run config:backup list

# Restore from backup
npm run config:backup restore <backup-id>
```

For detailed information, see [Configuration Tools Documentation](docs/CONFIGURATION_TOOLS.md).

## 🧪 Code Quality System

The AI Review System includes a comprehensive code quality system with automated checks and quality gates:

### Quick Start

```bash
# Run all quality checks
npm run quality:all

# Run quality gates
npm run quality:gates

# Run specific checks
npm run quality:lint
npm run quality:format
npm run quality:security
```

### Quality Gates

- **Pre-Commit**: Basic quality checks for local development
- **Pre-Push**: Comprehensive checks before sharing code
- **CI/CD**: Full quality assurance for production

For detailed code quality documentation, see [CODE_QUALITY_SYSTEM.md](docs/CODE_QUALITY_SYSTEM.md).

## 🚀 Deployment

### Option 1: Deploy to Your Repository

1. **Push to GitHub**:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

2. **Create a Release**:
   - Go to Releases → Create new release
   - Tag: `v1.0.0`
   - Title: `AI Code Review Action v1.0.0`

3. **Use in Workflows**:
   ```yaml
   uses: YOUR_USERNAME/YOUR_REPO_NAME@v1.0.0
   ```

### Option 2: Deploy to GitHub Marketplace

1. **Prepare for Marketplace**:
   - Add marketplace metadata
   - Improve documentation
   - Ensure high test coverage

2. **Submit for Review**:
   - Follow GitHub's marketplace guidelines
   - Wait for approval process

### Step 5: Set Up Required Secrets

In any repository where you use the action:

1. **Go to Settings** → **Secrets and variables** → **Actions**
2. **Add required secrets**:
   - **Name**: `OPENAI_API_KEY`
   - **Value**: Your OpenAI API key (starts with `sk-...`)

3. **Add optional notification secrets** (if using email/Slack):
   - **Name**: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`
   - **Name**: `SLACK_WEBHOOK_URL`
   - **Value**: Your respective credentials

The `GITHUB_TOKEN` is automatically provided by GitHub.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/YOUR_USERNAME/YOUR_REPO_NAME/issues)
- **Documentation**: [Wiki](https://github.com/YOUR_USERNAME/YOUR_REPO_NAME/wiki)
- **Discussions**: [GitHub Discussions](https://github.com/YOUR_USERNAME/YOUR_REPO_NAME/discussions)

## 🔄 Version History

- **v1.0.0** - Initial release with core AI review functionality
- Core modules: Security analysis, code quality checks, performance monitoring
- Support for multiple environments and configurable thresholds
- Comprehensive logging and error handling

---

**Built with ❤️ by the AI Code Review Team**
