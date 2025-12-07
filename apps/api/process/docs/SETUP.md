# Process API Service - Quick Setup Guide

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

This will install:
- `@nestjs/config` - Configuration management
- `@nestjs/schedule` - Scheduled jobs/cron tasks

### 2. Configure Environment

```bash
cd apps/api/process
cp .env.example .env
```

Edit `.env` with your settings:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/app_runner
AWS_REGION=ca-central-1
SQS_CRAWL_QUEUE_URL=https://sqs.ca-central-1.amazonaws.com/xxx/crawler-commands-dev
SQS_RESULTS_QUEUE_URL=https://sqs.ca-central-1.amazonaws.com/xxx/crawler-results-dev
```

### 3. Setup Database

```bash
# Create database
createdb app_runner

# Or use AWS RDS connection string
```

### 4. Run the Service

```bash
# Development mode with hot reload
nx serve process

# Production build
nx build process
node dist/apps/api/process/main.js
```

### 5. Test the API

```bash
# Health check
curl http://localhost:3000/api/health

# Create a URL to crawl
curl -X POST http://localhost:3000/api/urls \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "selectors": {
      "title": "h1",
      "content": "p"
    }
  }'

# Check stats
curl http://localhost:3000/api/urls/stats
```

## 📋 Complete Workflow Example

### Step 1: Add URLs to Process

```bash
# Add single URL
curl -X POST http://localhost:3000/api/urls \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://cbc.ca",
    "selectors": {
      "articles": "article.card",
      "headlines": "h3.headline"
    },
    "options": {
      "screenshot": true,
      "waitForNetworkIdle": true
    }
  }'
```

### Step 2: Automatic Processing

The service automatically processes pending URLs every 30 seconds via scheduled job.

Or trigger manually:
```bash
curl -X POST http://localhost:3000/api/urls/process
```

### Step 3: Monitor Status

```bash
# Get all URLs
curl http://localhost:3000/api/urls

# Get URLs by status
curl http://localhost:3000/api/urls?status=processing

# Get statistics
curl http://localhost:3000/api/urls/stats
```

### Step 4: View Results

```bash
# Get all results
curl http://localhost:3000/api/results

# Get results for specific URL
curl http://localhost:3000/api/results?urlId=<uuid>

# Get result statistics
curl http://localhost:3000/api/results/stats
```

## 🔧 Integration with Existing Crawler

The service integrates with your existing crawler Lambda:

1. **Sends crawl commands** to SQS queue → Crawler picks them up
2. **Receives results** from SQS results queue (or SNS subscription)
3. **Stores results** in PostgreSQL database
4. **Updates URL status** automatically

### Message Format to Crawler

```json
{
  "type": "CRAWL",
  "url": "https://example.com",
  "requestId": "uuid-from-database",
  "selectors": {
    "title": "h1",
    "content": ".article-body"
  },
  "waitForSelector": ".main-content",
  "timeout": 30000,
  "screenshot": true
}
```

### Expected Result Format from Crawler

```json
{
  "statusCode": 200,
  "body": {
    "url": "https://example.com",
    "title": "Page Title",
    "html": "<!DOCTYPE html>...",
    "extracted": {
      "title": { "text": "...", "html": "..." },
      "content": [...]
    },
    "screenshot": "base64-encoded-image",
    "requestId": "uuid-from-database",
    "timestamp": "2025-12-04T..."
  }
}
```

## 🏗️ Architecture

```
┌──────────────────┐
│   Process API    │
│    (NestJS)      │
└────────┬─────────┘
         │
         ├─────────► PostgreSQL RDS
         │           └─ URLs table
         │           └─ Crawl Results table
         │
         ├─────────► SQS Command Queue ────► Crawler Lambda
         │           (Send crawl requests)
         │
         └─────────► SQS Results Queue ◄──── Crawler Lambda
                     (Receive results)
```

## 📊 Database Schema

### URLs Table
```sql
CREATE TABLE urls (
  id UUID PRIMARY KEY,
  url TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  selectors JSONB,
  options JSONB,
  error_message TEXT,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Crawl Results Table
```sql
CREATE TABLE crawl_results (
  id UUID PRIMARY KEY,
  url_id UUID REFERENCES urls(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  title TEXT,
  html TEXT,
  extracted JSONB,
  screenshot TEXT,
  status_code INT,
  error_message TEXT,
  request_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🔍 Troubleshooting

### Database Connection Issues
```bash
# Test PostgreSQL connection
psql postgresql://username:password@localhost:5432/app_runner

# Check DATABASE_URL in .env
echo $DATABASE_URL
```

### SQS Not Working
```bash
# Verify AWS credentials
aws sts get-caller-identity --profile dmieshkov

# Test SQS access
aws sqs list-queues --profile dmieshkov

# Check queue URLs
aws sqs get-queue-url --queue-name crawler-commands-dev --profile dmieshkov
```

### URLs Not Processing
```bash
# Check logs for scheduled job
# Should see: "Running scheduled URL processing job"

# Manually trigger processing
curl -X POST http://localhost:3000/api/urls/process

# Check URL status
curl http://localhost:3000/api/urls
```

## 🧪 Testing Locally

### Without AWS (Local Testing)
1. Comment out SQS_CRAWL_QUEUE_URL and SQS_RESULTS_QUEUE_URL
2. Create URLs via API
3. Check database entries
4. Manually process: `POST /api/urls/process`

### With AWS (Integration Testing)
1. Set all environment variables
2. Create URLs via API
3. Watch logs for SQS sending
4. Check AWS SQS console for messages
5. Run crawler Lambda
6. Watch for results in results queue
7. Check database for stored results

## 📝 Next Steps

1. ✅ Install dependencies: `npm install`
2. ✅ Configure `.env` file
3. ✅ Setup database
4. ✅ Run service: `nx serve process`
5. ✅ Test API endpoints
6. ⏳ Configure AWS SQS queues (see CDK deployment)
7. ⏳ Update crawler to send results to correct queue
8. ⏳ Test end-to-end workflow

## 🚢 Deployment

See the main README for deployment instructions using AWS CDK.
