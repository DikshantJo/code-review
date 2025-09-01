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
```

### 3. Set Required Secrets

- `OPENAI_API_KEY`: Your OpenAI API key
- `GITHUB_TOKEN`: GitHub token (automatically provided)

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
