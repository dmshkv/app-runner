# Process API Service

A NestJS-based service for **batch web crawling** with process tracking, AWS RDS (PostgreSQL), and SQS integration.

## 📚 Documentation

- **[API Reference](docs/API_REFERENCE.md)** - Complete API documentation with examples ⭐
- **[Process-Based Architecture](docs/PROCESS_BASED_ARCHITECTURE.md)** - New workflow guide ⭐
- **[Quick Reference Guide](docs/QUICK_REFERENCE.md)** - Fast lookup for features and APIs
- **[Architecture Overview](docs/ARCHITECTURE.md)** - Feature-based architecture
- **[Architecture Diagrams](docs/ARCHITECTURE_DIAGRAMS.md)** - Visual flow diagrams
- **[Setup Guide](docs/SETUP.md)** - Environment configuration
- **[Migration Guide](docs/MIGRATION_GUIDE.md)** - API changes from old structure
- **[CDK Integration](docs/CDK_INTEGRATION.md)** - AWS deployment guide

## Overview

This service manages **batch crawling processes**:

1. **Initiate**: Submit multiple URLs as a process → `POST /api/process/initiate`
2. **Execute**: URLs immediately sent to AWS SQS for crawler Lambda
3. **Track**: Monitor progress in real-time → `GET /api/process/:id`
4. **Results**: Retrieve extracted data when complete

**Example Response:**
```json
{
  "status": "in_progress",
  "progress": { "completed": 15, "total": 30, "percentage": 50 },
  "results": [
    { "url": "...", "status": "completed", "data": {...} }
  ]
}
```

## Features

- 🔄 **Batch Processing**: Submit multiple URLs in one request
- 📊 **Progress Tracking**: Real-time monitoring (X/Y completed, percentage)
- ⚡ **Immediate Execution**: No waiting for cron jobs
- 🎯 **Status Management**: Track process and individual URL status
- 🗄️ **PostgreSQL Storage**: TypeORM with AWS RDS
- 📨 **SQS Integration**: Async communication with crawler Lambda
- 📈 **Statistics**: Process and URL analytics
- 🔁 **Auto-completion**: Process status updates when all URLs finish

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                     Process API (NestJS)                   │
│                                                            │
│  POST /process/initiate  →  Create Process + URLs         │
│                          →  Send to SQS immediately       │
│                                                            │
│  GET /process/:id        →  Poll for progress & results   │
└─────────┬──────────────────────────────┬───────────────────┘
          │                              │
          ▼                              ▼
   ┌──────────────┐            ┌───────────────────┐
   │ PostgreSQL   │            │   AWS SQS         │
   │ - processes  │            │ - Command Queue   │
   │ - urls       │            │ - Results Queue   │
   │ - results    │            │                   │
   └──────────────┘            └─────────┬─────────┘
                                         │
                                         ▼
                                  ┌─────────────┐
                                  │   Crawler   │
                                  │   Lambda    │
                                  └─────────────┘
```

## Prerequisites

- Node.js 20+
- PostgreSQL database (local or AWS RDS)
- AWS credentials with SQS access

## Installation

```bash
# Install dependencies (from workspace root)
npm install

# Install additional dependencies
npm install @nestjs/schedule
```

## Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Required environment variables:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/app_runner
DB_SSL=false

# AWS
AWS_REGION=ca-central-1
AWS_PROFILE=default

# SQS Queues
SQS_CRAWL_QUEUE_URL=https://sqs.ca-central-1.amazonaws.com/xxx/crawler-commands-dev
SQS_RESULTS_QUEUE_URL=https://sqs.ca-central-1.amazonaws.com/xxx/crawler-results-dev

# App
PORT=3000
NODE_ENV=development
```

## Database Schema

### URLs Table
- `id`: UUID (Primary Key)
- `url`: TEXT (URL to crawl)
- `status`: ENUM (pending, processing, completed, failed)
- `retryCount`: INT
- `selectors`: JSONB (CSS selectors to extract)
- `options`: JSONB (Crawl options)
- `errorMessage`: TEXT
- `processedAt`: TIMESTAMP
- `createdAt`: TIMESTAMP
- `updatedAt`: TIMESTAMP

### Crawl Results Table
- `id`: UUID (Primary Key)
- `urlId`: UUID (Foreign Key)
- `sourceUrl`: TEXT
- `title`: TEXT
- `html`: TEXT
- `extracted`: JSONB (Extracted data)
- `screenshot`: TEXT (Base64)
- `statusCode`: INT
- `errorMessage`: TEXT
- `requestId`: TEXT
- `createdAt`: TIMESTAMP

## Running the Application

### Development

```bash
# From workspace root
nx serve process

# Or
npm run start:process
```

### Production Build

```bash
# Build
nx build process

# Run built version
node dist/apps/api/process/main.js
```

### Docker

```bash
# Build Docker image
docker build -f apps/api/process/Dockerfile -t process-api .

# Run container
docker run -p 3000:3000 --env-file .env process-api
```

## API Endpoints

### URLs Management

**Create URL**
```bash
POST /api/urls
Content-Type: application/json

{
  "url": "https://example.com",
  "selectors": {
    "title": "h1",
    "content": ".article-body"
  },
  "options": {
    "waitForSelector": ".main-content",
    "timeout": 30000,
    "screenshot": true
  }
}
```

**Get All URLs**
```bash
GET /api/urls?status=pending
```

**Get URL by ID**
```bash
GET /api/urls/:id
```

**Get Statistics**
```bash
GET /api/urls/stats
```

**Process Pending URLs**
```bash
POST /api/urls/process
```

**Retry Failed URLs**
```bash
POST /api/urls/retry-failed
```

### Crawl Results

**Get All Results**
```bash
GET /api/results?urlId=xxx
```

**Get Result by ID**
```bash
GET /api/results/:id
```

**Get Statistics**
```bash
GET /api/results/stats
```

## Workflow

1. **Create URL**: POST a URL to `/api/urls`
2. **Auto-Processing**: Scheduled job (every 30s) picks up pending URLs
3. **Send to SQS**: URLs are sent to crawler command queue
4. **Crawler Processes**: Remote crawler Lambda processes the URL
5. **Results Return**: Crawler sends results to results queue
6. **Store Results**: SQS listener stores results in database
7. **Update Status**: URL status is updated to completed/failed

## Scheduled Jobs

- **URL Processing**: Runs every 30 seconds
  - Picks up pending URLs
  - Sends them to SQS crawler queue
  - Updates status to "processing"

## SQS Integration

### Command Queue (Outgoing)
Sends crawl commands to crawler Lambda:

```json
{
  "type": "CRAWL",
  "url": "https://example.com",
  "requestId": "uuid",
  "selectors": {...},
  "options": {...}
}
```

### Results Queue (Incoming)
Receives crawl results from crawler:

```json
{
  "statusCode": 200,
  "body": {
    "url": "https://example.com",
    "title": "Page Title",
    "html": "...",
    "extracted": {...},
    "requestId": "uuid"
  }
}
```

## Testing

```bash
# Run tests
nx test process

# Test API locally
curl http://localhost:3000/api/health
```

## Monitoring

- Check processing stats: `GET /api/urls/stats`
- Check result stats: `GET /api/results/stats`
- View logs for SQS polling and processing
- Monitor AWS SQS queue depths

## Error Handling

- Failed URLs are marked with status "failed"
- Retry count is tracked
- Maximum retries: 3 (configurable per URL)
- Failed URLs can be retried via `/api/urls/retry-failed`

## Architecture

This service follows a **feature-based architecture** where each feature represents a complete use case with both API endpoints and event handlers.

### Features:
1. **Submit Crawl Request** - Submit URLs and trigger crawler (API + Cron)
2. **Process Crawl Results** - Receive and store results (SQS Event)
3. **Query URLs** - View and manage URLs (API)
4. **Query Results** - View crawl results (API)

See [Architecture Overview](docs/ARCHITECTURE.md) for details.

## Development

### Adding New Features

1. Create feature directory: `features/new-feature/`
2. Create module, service, and controller/listener files
3. Add to `app.module.ts`
4. See existing features for examples

### Database Migrations

```bash
# Generate migration
npm run typeorm migration:generate -- -n MigrationName

# Run migrations
npm run typeorm migration:run
```

## Troubleshooting

**Database connection fails:**
- Check DATABASE_URL is correct
- Verify database is accessible
- Check DB_SSL setting

**SQS polling not working:**
- Verify SQS_RESULTS_QUEUE_URL is set
- Check AWS credentials
- Verify IAM permissions for SQS

**URLs not processing:**
- Check scheduled job logs
- Verify SQS_CRAWL_QUEUE_URL is set
- Check AWS SQS queue exists

## Key Design Decisions

- **Feature-Based Architecture**: Each use case is self-contained
- **TypeORM**: For database abstraction and migrations
- **Scheduled Jobs**: For automatic URL processing
- **SQS Long Polling**: For efficient result retrieval
- **UUID**: For distributed system compatibility
- **JSONB**: For flexible schema-less data storage

See [Refactoring Summary](docs/REFACTORING_SUMMARY.md) for architecture details.

## Future Enhancements

- [ ] Add authentication/authorization
- [ ] Implement rate limiting
- [ ] Add webhook notifications
- [ ] Support batch URL uploads
- [ ] Add result filtering and search
- [ ] Implement result caching
- [ ] Add GraphQL API
- [ ] Support multiple crawler types
