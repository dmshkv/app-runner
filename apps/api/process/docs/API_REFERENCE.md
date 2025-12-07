# Process API Reference

## Overview

The Process API allows you to initiate batch crawling jobs, monitor their progress, and retrieve results. Each process tracks multiple URLs being crawled simultaneously.

## Workflow

1. **Initiate Process** - Create a new process with multiple URLs
2. **Process Execution** - URLs are immediately sent to SQS for crawling
3. **Poll for Status** - Check progress and retrieve results
4. **Completion** - Process completes when all URLs are done

## Endpoints

### 1. Initiate Process

Start a new batch crawl process.

```bash
POST /api/process/initiate
```

**Request Body:**

```json
{
  "urls": [
    {
      "url": "https://example.com",
      "selectors": {
        "title": "h1",
        "content": "article",
        "author": ".author-name"
      },
      "options": {
        "screenshot": true,
        "waitForNetworkIdle": true,
        "timeout": 30000
      }
    },
    {
      "url": "https://example.org",
      "selectors": {
        "title": ".page-title"
      }
    }
  ],
  "metadata": {
    "source": "manual-test",
    "userId": "user123"
  }
}
```

**Response:**

```json
{
  "processId": "uuid-process-id",
  "totalUrls": 2,
  "urls": [
    {
      "id": "uuid-url-1",
      "url": "https://example.com",
      "status": "processing"
    },
    {
      "id": "uuid-url-2",
      "url": "https://example.org",
      "status": "processing"
    }
  ]
}
```

### 2. Get Process Status (Polling Endpoint)

Monitor process progress and retrieve results.

```bash
GET /api/process/:id
```

**Response:**

```json
{
  "id": "uuid-process-id",
  "status": "in_progress",
  "progress": {
    "total": 30,
    "completed": 2,
    "failed": 0,
    "processing": 28,
    "percentage": 7
  },
  "results": [
    {
      "urlId": "uuid-url-1",
      "url": "https://example.com",
      "status": "completed",
      "selectors": {
        "title": "h1",
        "content": "article"
      },
      "data": {
        "title": "Example Domain",
        "content": "This domain is for..."
      }
    },
    {
      "urlId": "uuid-url-2",
      "url": "https://example.org",
      "status": "processing",
      "selectors": {
        "title": ".page-title"
      }
    }
  ],
  "metadata": {
    "source": "manual-test"
  },
  "createdAt": "2024-12-04T01:00:00Z"
}
```

**Status Values:**
- `initiated` - Process created, URLs being sent to SQS
- `in_progress` - URLs are being crawled
- `completed` - All URLs processed (may include failures)
- `failed` - All URLs failed

### 3. List Processes

Get a list of all processes.

```bash
GET /api/process?status=completed
```

**Query Parameters:**
- `status` (optional): Filter by status (`initiated`, `in_progress`, `completed`, `failed`)

**Response:**

```json
[
  {
    "id": "uuid-1",
    "status": "completed",
    "totalUrls": 30,
    "completedUrls": 28,
    "failedUrls": 2,
    "createdAt": "2024-12-04T01:00:00Z",
    "completedAt": "2024-12-04T01:05:00Z"
  }
]
```

### 4. Get Process Statistics

Get aggregate statistics across all processes.

```bash
GET /api/process/stats/summary
```

**Response:**

```json
{
  "total": 150,
  "initiated": 2,
  "inProgress": 5,
  "completed": 140,
  "failed": 3
}
```

### 5. List URLs

Get URLs with their status (legacy endpoint).

```bash
GET /api/urls?status=completed&limit=50
```

**Query Parameters:**
- `status` (optional): Filter by status
- `limit` (optional): Number of results (default: 50)

### 6. Get URL Statistics

```bash
GET /api/urls/stats
```

### 7. List Results

Get crawl results (legacy endpoint).

```bash
GET /api/results?processId=uuid&limit=50
```

## Polling Pattern

To monitor a process until completion:

```javascript
async function pollProcess(processId) {
  const maxAttempts = 60; // 5 minutes with 5s intervals
  
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`/api/process/${processId}`);
    const data = await response.json();
    
    console.log(`Progress: ${data.progress.completed}/${data.progress.total} (${data.progress.percentage}%)`);
    
    if (data.status === 'completed' || data.status === 'failed') {
      return data;
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds
  }
  
  throw new Error('Process polling timeout');
}
```

## Error Handling

**404 Not Found:**
```json
{
  "statusCode": 404,
  "message": "Process uuid not found"
}
```

**400 Bad Request:**
```json
{
  "statusCode": 400,
  "message": ["urls must be an array", "urls should not be empty"]
}
```

## Examples

### Example 1: Simple Batch Crawl

```bash
curl -X POST http://localhost:3000/api/process/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      {"url": "https://example.com"},
      {"url": "https://example.org"}
    ]
  }'
```

### Example 2: Advanced with Selectors

```bash
curl -X POST http://localhost:3000/api/process/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      {
        "url": "https://news.ycombinator.com",
        "selectors": {
          "stories": ".athing .title a",
          "scores": ".score"
        },
        "options": {
          "waitForSelector": ".athing",
          "screenshot": false
        }
      }
    ]
  }'
```

### Example 3: Poll for Results

```bash
# Get process status
PROCESS_ID="your-process-id"
curl http://localhost:3000/api/process/$PROCESS_ID | jq '.'

# Check progress
curl http://localhost:3000/api/process/$PROCESS_ID | \
  jq '{status: .status, progress: .progress}'

# Get completed results only
curl http://localhost:3000/api/process/$PROCESS_ID | \
  jq '.results[] | select(.status == "completed") | {url, data}'
```

## Best Practices

1. **Batch Size**: Keep batches under 100 URLs for optimal performance
2. **Polling Interval**: Poll every 5-10 seconds to avoid rate limiting
3. **Timeout**: Set appropriate timeouts based on expected crawl duration
4. **Metadata**: Include tracking information in metadata for debugging
5. **Error Handling**: Always check both process status and individual URL status

## Database Schema

### Process Table
- `id`: UUID (Primary Key)
- `status`: ENUM (initiated, in_progress, completed, failed)
- `totalUrls`: INTEGER
- `completedUrls`: INTEGER
- `failedUrls`: INTEGER
- `errorMessage`: TEXT (nullable)
- `metadata`: JSONB (nullable)
- `createdAt`: TIMESTAMP
- `completedAt`: TIMESTAMP (nullable)

### URL Table
- `id`: UUID (Primary Key)
- `processId`: UUID (Foreign Key → Process)
- `url`: TEXT
- `status`: ENUM (pending, processing, completed, failed)
- `selectors`: JSONB (nullable)
- `options`: JSONB (nullable)
- `errorMessage`: TEXT (nullable)

### CrawlResult Table
- `id`: UUID (Primary Key)
- `processId`: UUID (Foreign Key → Process)
- `urlId`: UUID (Foreign Key → URL)
- `extracted`: JSONB (crawled data)
- `screenshot`: TEXT (base64, nullable)
- `statusCode`: INTEGER
- `errorMessage`: TEXT (nullable)
