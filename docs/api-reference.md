# AI Code Review System - API Reference

## Overview

This document provides comprehensive API documentation for integrating with the AI Code Review System. It covers all available endpoints, data structures, authentication methods, and integration patterns.

## Table of Contents

1. [Authentication](#authentication)
2. [Core API Endpoints](#core-api-endpoints)
3. [Webhook Integration](#webhook-integration)
4. [Custom Integrations](#custom-integrations)
5. [Data Models](#data-models)
6. [Error Handling](#error-handling)
7. [Rate Limiting](#rate-limiting)
8. [SDK and Libraries](#sdk-and-libraries)
9. [Examples](#examples)

## Authentication

### API Key Authentication

All API requests require authentication using an API key:

```bash
# HTTP Header Authentication
Authorization: Bearer YOUR_API_KEY

# Example cURL request
curl -H "Authorization: Bearer sk-1234567890abcdef" \
     https://api.ai-code-review.com/v1/reviews
```

### GitHub Token Authentication

For GitHub-specific operations:

```bash
# GitHub Token Authentication
Authorization: token YOUR_GITHUB_TOKEN

# Example cURL request
curl -H "Authorization: token ghp_1234567890abcdef" \
     https://api.ai-code-review.com/v1/github/repositories
```

### JWT Token Authentication

For advanced integrations:

```bash
# JWT Token Authentication
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Example cURL request
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     https://api.ai-code-review.com/v1/reviews
```

## Core API Endpoints

### Reviews API

#### Create Review

```http
POST /v1/reviews
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY
```

**Request Body:**
```json
{
  "repository": "owner/repo",
  "branch": "feature/new-feature",
  "base_branch": "main",
  "files": [
    {
      "path": "src/components/Button.js",
      "content": "function Button() { ... }",
      "language": "javascript"
    }
  ],
  "configuration": {
    "ai_model": "gpt-4",
    "severity_thresholds": {
      "security": "HIGH",
      "logic": "HIGH"
    }
  },
  "options": {
    "create_issue": true,
    "send_notifications": true,
    "block_on_failure": false
  }
}
```

**Response:**
```json
{
  "id": "rev_1234567890abcdef",
  "status": "completed",
  "quality_score": 0.85,
  "issues": [
    {
      "id": "iss_1234567890abcdef",
      "severity": "HIGH",
      "category": "security",
      "description": "Potential SQL injection vulnerability",
      "line_number": 42,
      "suggestion": "Use parameterized queries instead of string concatenation"
    }
  ],
  "metrics": {
    "files_reviewed": 5,
    "lines_of_code": 250,
    "review_duration": 15000,
    "tokens_used": 3500
  },
  "created_at": "2024-01-15T10:30:00Z",
  "github_issue_url": "https://github.com/owner/repo/issues/123"
}
```

#### Get Review Status

```http
GET /v1/reviews/{review_id}
Authorization: Bearer YOUR_API_KEY
```

**Response:**
```json
{
  "id": "rev_1234567890abcdef",
  "status": "in_progress",
  "progress": 75,
  "estimated_completion": "2024-01-15T10:35:00Z",
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:32:30Z"
}
```

#### List Reviews

```http
GET /v1/reviews?repository=owner/repo&status=completed&limit=10&offset=0
Authorization: Bearer YOUR_API_KEY
```

**Response:**
```json
{
  "reviews": [
    {
      "id": "rev_1234567890abcdef",
      "repository": "owner/repo",
      "branch": "feature/new-feature",
      "status": "completed",
      "quality_score": 0.85,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 10,
    "offset": 0,
    "has_more": true
  }
}
```

### Configuration API

#### Get Repository Configuration

```http
GET /v1/configurations/{repository}
Authorization: Bearer YOUR_API_KEY
```

**Response:**
```json
{
  "repository": "owner/repo",
  "configuration": {
    "ai": {
      "model": "gpt-4",
      "max_tokens": 4000,
      "temperature": 0.1
    },
    "review": {
      "severity_thresholds": {
        "security": "HIGH",
        "logic": "HIGH",
        "standards": "MEDIUM"
      },
      "min_quality_score": 0.7
    },
    "environments": {
      "main": {
        "enabled": true,
        "blocking": true
      }
    }
  },
  "last_updated": "2024-01-15T10:30:00Z"
}
```

#### Update Repository Configuration

```http
PUT /v1/configurations/{repository}
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY
```

**Request Body:**
```json
{
  "configuration": {
    "ai": {
      "model": "gpt-4",
      "max_tokens": 4000
    },
    "review": {
      "severity_thresholds": {
        "security": "HIGH",
        "logic": "HIGH"
      }
    }
  }
}
```

### Metrics API

#### Get Review Metrics

```http
GET /v1/metrics/reviews?repository=owner/repo&start_date=2024-01-01&end_date=2024-01-15
Authorization: Bearer YOUR_API_KEY
```

**Response:**
```json
{
  "repository": "owner/repo",
  "period": {
    "start_date": "2024-01-01",
    "end_date": "2024-01-15"
  },
  "metrics": {
    "total_reviews": 45,
    "average_quality_score": 0.78,
    "average_review_duration": 12000,
    "total_issues_found": 156,
    "issues_by_severity": {
      "high": 12,
      "medium": 45,
      "low": 99
    },
    "issues_by_category": {
      "security": 8,
      "logic": 15,
      "standards": 67,
      "performance": 23,
      "formatting": 43
    }
  },
  "trends": {
    "quality_score_trend": "improving",
    "issue_count_trend": "decreasing",
    "review_duration_trend": "stable"
  }
}
```

#### Get Performance Metrics

```http
GET /v1/metrics/performance?repository=owner/repo
Authorization: Bearer YOUR_API_KEY
```

**Response:**
```json
{
  "repository": "owner/repo",
  "performance": {
    "average_response_time": 8500,
    "p95_response_time": 15000,
    "p99_response_time": 25000,
    "success_rate": 98.5,
    "error_rate": 1.5,
    "total_api_calls": 1250,
    "total_tokens_used": 45000,
    "estimated_cost": 12.50
  },
  "system_health": {
    "status": "healthy",
    "uptime": 99.9,
    "last_incident": null
  }
}
```

## Webhook Integration

### Webhook Configuration

Configure webhooks to receive real-time notifications:

```http
POST /v1/webhooks
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY
```

**Request Body:**
```json
{
  "url": "https://your-webhook.com/ai-review-events",
  "events": ["review.completed", "review.failed", "issue.created"],
  "secret": "your-webhook-secret",
  "headers": {
    "X-Custom-Header": "custom-value"
  },
  "active": true
}
```

### Webhook Events

#### Review Completed Event

```json
{
  "event": "review.completed",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "review_id": "rev_1234567890abcdef",
    "repository": "owner/repo",
    "branch": "feature/new-feature",
    "status": "completed",
    "quality_score": 0.85,
    "issues_count": 5,
    "github_issue_url": "https://github.com/owner/repo/issues/123"
  }
}
```

#### Review Failed Event

```json
{
  "event": "review.failed",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "review_id": "rev_1234567890abcdef",
    "repository": "owner/repo",
    "branch": "feature/new-feature",
    "status": "failed",
    "error": "OpenAI API timeout",
    "error_code": "TIMEOUT_ERROR"
  }
}
```

#### Issue Created Event

```json
{
  "event": "issue.created",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "review_id": "rev_1234567890abcdef",
    "issue_id": "iss_1234567890abcdef",
    "repository": "owner/repo",
    "github_issue_url": "https://github.com/owner/repo/issues/123",
    "severity": "HIGH",
    "category": "security"
  }
}
```

### Webhook Verification

Verify webhook authenticity:

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

## Custom Integrations

### GitHub App Integration

#### Install GitHub App

```http
POST /v1/github/app/install
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY
```

**Request Body:**
```json
{
  "installation_id": 123456,
  "repository_ids": ["owner/repo1", "owner/repo2"],
  "permissions": {
    "contents": "read",
    "issues": "write",
    "pull_requests": "read"
  }
}
```

#### Configure Repository

```http
POST /v1/github/app/repositories/{repository}/configure
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY
```

**Request Body:**
```json
{
  "auto_review": true,
  "branch_patterns": ["feature/*", "bugfix/*"],
  "notification_channels": ["github", "email"],
  "quality_gates": {
    "enabled": true,
    "min_quality_score": 0.7
  }
}
```

### CI/CD Integration

#### GitHub Actions Integration

```yaml
# .github/workflows/ai-review.yml
name: AI Code Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  ai-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run AI Code Review
        uses: ai-code-review/action@v1
        with:
          api_key: ${{ secrets.AI_REVIEW_API_KEY }}
          repository: ${{ github.repository }}
          branch: ${{ github.head_ref }}
          base_branch: ${{ github.base_ref }}
          configuration: .github/ai-review-config.yml
```

#### Jenkins Integration

```groovy
// Jenkinsfile
pipeline {
    agent any
    
    stages {
        stage('AI Code Review') {
            steps {
                script {
                    def reviewResult = sh(
                        script: """
                            curl -X POST https://api.ai-code-review.com/v1/reviews \\
                                -H "Authorization: Bearer ${env.AI_REVIEW_API_KEY}" \\
                                -H "Content-Type: application/json" \\
                                -d '{
                                    "repository": "${env.GIT_URL}",
                                    "branch": "${env.BRANCH_NAME}",
                                    "base_branch": "main"
                                }'
                        """,
                        returnStdout: true
                    ).trim()
                    
                    def result = readJSON text: reviewResult
                    
                    if (result.status == 'failed') {
                        error "AI Code Review failed: ${result.error}"
                    }
                }
            }
        }
    }
}
```

### Slack Integration

#### Send Review Notifications

```http
POST /v1/integrations/slack/notify
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY
```

**Request Body:**
```json
{
  "channel": "#code-reviews",
  "review_id": "rev_1234567890abcdef",
  "template": "review_summary",
  "custom_fields": {
    "team": "backend",
    "priority": "high"
  }
}
```

#### Configure Slack App

```http
POST /v1/integrations/slack/configure
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY
```

**Request Body:**
```json
{
  "workspace_id": "T1234567890",
  "bot_token": "xoxb-your-bot-token",
  "channels": {
    "reviews": "#code-reviews",
    "alerts": "#alerts",
    "general": "#general"
  },
  "notifications": {
    "review_completed": true,
    "review_failed": true,
    "security_issues": true
  }
}
```

## Data Models

### Review Object

```json
{
  "id": "rev_1234567890abcdef",
  "repository": "owner/repo",
  "branch": "feature/new-feature",
  "base_branch": "main",
  "status": "completed",
  "quality_score": 0.85,
  "issues": [
    {
      "id": "iss_1234567890abcdef",
      "severity": "HIGH",
      "category": "security",
      "description": "Potential SQL injection vulnerability",
      "line_number": 42,
      "file_path": "src/database/query.js",
      "suggestion": "Use parameterized queries",
      "code_snippet": "const query = `SELECT * FROM users WHERE id = ${userId}`;"
    }
  ],
  "metrics": {
    "files_reviewed": 5,
    "lines_of_code": 250,
    "review_duration": 15000,
    "tokens_used": 3500,
    "api_cost": 0.12
  },
  "configuration": {
    "ai_model": "gpt-4",
    "severity_thresholds": {
      "security": "HIGH",
      "logic": "HIGH"
    }
  },
  "github_issue_url": "https://github.com/owner/repo/issues/123",
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:32:30Z"
}
```

### Issue Object

```json
{
  "id": "iss_1234567890abcdef",
  "review_id": "rev_1234567890abcdef",
  "severity": "HIGH",
  "category": "security",
  "description": "Potential SQL injection vulnerability",
  "line_number": 42,
  "file_path": "src/database/query.js",
  "suggestion": "Use parameterized queries instead of string concatenation",
  "code_snippet": "const query = `SELECT * FROM users WHERE id = ${userId}`;",
  "fixed_code": "const query = 'SELECT * FROM users WHERE id = ?';",
  "tags": ["sql-injection", "security", "database"],
  "created_at": "2024-01-15T10:30:00Z"
}
```

### Configuration Object

```json
{
  "repository": "owner/repo",
  "ai": {
    "model": "gpt-4",
    "max_tokens": 4000,
    "temperature": 0.1,
    "timeout": 30000,
    "max_retries": 3
  },
  "review": {
    "severity_thresholds": {
      "security": "HIGH",
      "logic": "HIGH",
      "standards": "MEDIUM",
      "performance": "MEDIUM",
      "formatting": "LOW"
    },
    "min_quality_score": 0.7,
    "max_files_per_review": 50,
    "excluded_files": ["*.env", "node_modules/**"]
  },
  "environments": {
    "main": {
      "enabled": true,
      "blocking": true,
      "quality_gates": {
        "min_quality_score": 0.8,
        "max_severity_issues": 1
      }
    }
  },
  "notifications": {
    "email": {
      "enabled": true,
      "recipients": ["team@company.com"]
    },
    "slack": {
      "enabled": true,
      "channel": "#code-reviews"
    }
  }
}
```

## Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid configuration format",
    "details": {
      "field": "ai.model",
      "issue": "Model 'gpt-5' is not supported"
    },
    "request_id": "req_1234567890abcdef",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `AUTHENTICATION_ERROR` | Invalid API key or token | 401 |
| `AUTHORIZATION_ERROR` | Insufficient permissions | 403 |
| `VALIDATION_ERROR` | Invalid request data | 400 |
| `RATE_LIMIT_EXCEEDED` | Too many requests | 429 |
| `RESOURCE_NOT_FOUND` | Resource not found | 404 |
| `INTERNAL_ERROR` | Server error | 500 |
| `TIMEOUT_ERROR` | Request timeout | 408 |

### Error Handling Example

```javascript
async function createReview(reviewData) {
  try {
    const response = await fetch('https://api.ai-code-review.com/v1/reviews', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(reviewData)
    });

    if (!response.ok) {
      const error = await response.json();
      
      switch (error.error.code) {
        case 'AUTHENTICATION_ERROR':
          throw new Error('Invalid API key');
        case 'RATE_LIMIT_EXCEEDED':
          // Retry after delay
          await new Promise(resolve => setTimeout(resolve, 60000));
          return createReview(reviewData);
        case 'VALIDATION_ERROR':
          throw new Error(`Validation error: ${error.error.message}`);
        default:
          throw new Error(`API error: ${error.error.message}`);
      }
    }

    return await response.json();
  } catch (error) {
    console.error('Review creation failed:', error);
    throw error;
  }
}
```

## Rate Limiting

### Rate Limit Headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642248600
```

### Rate Limit Policies

| Endpoint | Rate Limit | Window |
|----------|------------|--------|
| `/v1/reviews` | 100 requests | 1 hour |
| `/v1/metrics/*` | 1000 requests | 1 hour |
| `/v1/configurations/*` | 500 requests | 1 hour |
| Webhooks | 1000 requests | 1 hour |

### Rate Limit Handling

```javascript
function handleRateLimit(response) {
  const resetTime = response.headers.get('X-RateLimit-Reset');
  const remaining = response.headers.get('X-RateLimit-Remaining');
  
  if (remaining === '0') {
    const waitTime = (resetTime * 1000) - Date.now();
    return new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  return Promise.resolve();
}
```

## SDK and Libraries

### JavaScript/Node.js SDK

```javascript
const AIRCodeReview = require('@ai-code-review/sdk');

const client = new AIRCodeReview({
  apiKey: 'your-api-key',
  baseURL: 'https://api.ai-code-review.com/v1'
});

// Create a review
const review = await client.reviews.create({
  repository: 'owner/repo',
  branch: 'feature/new-feature',
  files: [
    {
      path: 'src/components/Button.js',
      content: 'function Button() { ... }'
    }
  ]
});

// Get review status
const status = await client.reviews.getStatus(review.id);

// Get metrics
const metrics = await client.metrics.getReviews({
  repository: 'owner/repo',
  startDate: '2024-01-01',
  endDate: '2024-01-15'
});
```

### Python SDK

```python
from ai_code_review import Client

client = Client(api_key='your-api-key')

# Create a review
review = client.reviews.create(
    repository='owner/repo',
    branch='feature/new-feature',
    files=[
        {
            'path': 'src/components/Button.js',
            'content': 'function Button() { ... }'
        }
    ]
)

# Get review status
status = client.reviews.get_status(review.id)

# Get metrics
metrics = client.metrics.get_reviews(
    repository='owner/repo',
    start_date='2024-01-01',
    end_date='2024-01-15'
)
```

### Go SDK

```go
package main

import (
    "github.com/ai-code-review/go-sdk"
)

func main() {
    client := aicodereview.NewClient("your-api-key")
    
    // Create a review
    review, err := client.Reviews.Create(&aicodereview.CreateReviewRequest{
        Repository: "owner/repo",
        Branch:     "feature/new-feature",
        Files: []aicodereview.File{
            {
                Path:    "src/components/Button.js",
                Content: "function Button() { ... }",
            },
        },
    })
    
    if err != nil {
        log.Fatal(err)
    }
    
    // Get review status
    status, err := client.Reviews.GetStatus(review.ID)
    if err != nil {
        log.Fatal(err)
    }
}
```

## Examples

### Complete Integration Example

```javascript
// Complete integration example
class AIRCodeReviewIntegration {
  constructor(apiKey, repository) {
    this.client = new AIRCodeReview({ apiKey });
    this.repository = repository;
  }

  async reviewPullRequest(prNumber, branch, baseBranch) {
    try {
      // Get PR files from GitHub
      const files = await this.getGitHubFiles(prNumber);
      
      // Create AI review
      const review = await this.client.reviews.create({
        repository: this.repository,
        branch: branch,
        base_branch: baseBranch,
        files: files,
        options: {
          create_issue: true,
          send_notifications: true
        }
      });

      // Wait for completion
      const result = await this.waitForCompletion(review.id);
      
      // Handle results
      if (result.status === 'completed') {
        await this.handleReviewResults(result);
      } else {
        throw new Error(`Review failed: ${result.error}`);
      }

      return result;
    } catch (error) {
      console.error('Review failed:', error);
      throw error;
    }
  }

  async waitForCompletion(reviewId, maxWaitTime = 300000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.client.reviews.getStatus(reviewId);
      
      if (status.status === 'completed' || status.status === 'failed') {
        return status;
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    throw new Error('Review timeout');
  }

  async handleReviewResults(result) {
    if (result.quality_score < 0.7) {
      console.warn(`Low quality score: ${result.quality_score}`);
    }

    if (result.issues.length > 0) {
      console.log(`Found ${result.issues.length} issues`);
      
      const highSeverityIssues = result.issues.filter(
        issue => issue.severity === 'HIGH'
      );
      
      if (highSeverityIssues.length > 0) {
        console.error(`Found ${highSeverityIssues.length} high severity issues`);
      }
    }
  }
}

// Usage
const integration = new AIRCodeReviewIntegration(
  'your-api-key',
  'owner/repo'
);

integration.reviewPullRequest(123, 'feature/new-feature', 'main')
  .then(result => console.log('Review completed:', result))
  .catch(error => console.error('Review failed:', error));
```

### Webhook Handler Example

```javascript
// Express.js webhook handler
const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

app.post('/webhook/ai-review', (req, res) => {
  // Verify webhook signature
  const signature = req.headers['x-signature-256'];
  const payload = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  if (signature !== expectedSignature) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { event, data } = req.body;

  switch (event) {
    case 'review.completed':
      handleReviewCompleted(data);
      break;
    case 'review.failed':
      handleReviewFailed(data);
      break;
    case 'issue.created':
      handleIssueCreated(data);
      break;
    default:
      console.log('Unknown event:', event);
  }

  res.status(200).json({ received: true });
});

function handleReviewCompleted(data) {
  console.log(`Review completed for ${data.repository}/${data.branch}`);
  console.log(`Quality score: ${data.quality_score}`);
  console.log(`Issues found: ${data.issues_count}`);
  
  // Send notification to team
  if (data.quality_score < 0.7) {
    sendTeamNotification(data);
  }
}

function handleReviewFailed(data) {
  console.error(`Review failed for ${data.repository}/${data.branch}`);
  console.error(`Error: ${data.error}`);
  
  // Send alert to DevOps team
  sendDevOpsAlert(data);
}

function handleIssueCreated(data) {
  console.log(`Issue created for ${data.repository}`);
  console.log(`Severity: ${data.severity}`);
  console.log(`Category: ${data.category}`);
  
  // Assign issue to appropriate team member
  assignIssue(data);
}

app.listen(3000, () => {
  console.log('Webhook server running on port 3000');
});
```

This API reference provides comprehensive documentation for integrating with the AI Code Review System. Use these endpoints and examples to build custom integrations that fit your specific workflow requirements.



