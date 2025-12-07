# Process-Based Architecture Summary

## Overview

The API has been refactored to support **process-based batch crawling** where:

1. User initiates a **Process** with multiple URLs
2. System immediately sends all URLs to SQS for crawling
3. Process tracks overall progress (X/Y completed)
4. Results are automatically linked to both URLs and Process
5. User polls for completion and retrieves results

## Key Changes

### New Entity: Process

```typescript
Process {
  id: UUID
  status: 'initiated' | 'in_progress' | 'completed' | 'failed'
  totalUrls: number
  completedUrls: number
  failedUrls: number
  metadata?: Record<string, any>
  createdAt: Date
  completedAt?: Date
}
```

### Updated Entities

**URL Entity:**
- Added `processId` (Foreign Key to Process)
- Removed scheduler-based processing
- URLs created and sent to SQS immediately

**CrawlResult Entity:**
- Added `processId` (Foreign Key to Process)
- Links results to both URL and Process

### New Workflow

#### Old Workflow (Removed)
```
1. POST /api/crawl/submit → Create URL (status: pending)
2. Cron job runs every 30s → Process pending URLs
3. Send to SQS → Update status to processing
4. Receive results → Store in CrawlResult
```

#### New Workflow (Current)
```
1. POST /api/process/initiate → Create Process + URLs
2. Immediately send all URLs to SQS (status: processing)
3. Process status: in_progress
4. Receive results → Store in CrawlResult, update URL status
5. When all URLs done → Process status: completed
6. GET /api/process/:id → Poll for results
```

## API Changes

### Removed Endpoints

- ❌ `POST /api/crawl/submit` - Single URL submission
- ❌ `POST /api/crawl/process` - Manual trigger for pending URLs
- ❌ Cron scheduler for processing pending URLs

### New Endpoints

- ✅ `POST /api/process/initiate` - Initiate batch crawl
- ✅ `GET /api/process/:id` - Poll for progress and results
- ✅ `GET /api/process` - List all processes
- ✅ `GET /api/process/stats/summary` - Process statistics

### Maintained Endpoints (Legacy)

- `GET /api/urls` - List URLs
- `GET /api/urls/stats` - URL statistics
- `GET /api/results` - List crawl results
- `GET /api/results/stats` - Result statistics

## Features

### 1. Process Tracking

Each process tracks:
- Total number of URLs
- Completed count
- Failed count
- Overall status
- Custom metadata

### 2. Immediate Execution

- No waiting for cron jobs
- URLs sent to SQS immediately on process creation
- Faster time-to-crawl

### 3. Progress Monitoring

```json
{
  "progress": {
    "total": 30,
    "completed": 15,
    "failed": 2,
    "processing": 13,
    "percentage": 57
  }
}
```

### 4. Automatic Completion Detection

When crawler results are received:
1. URL status updated to `completed` or `failed`
2. Process counters incremented
3. If all URLs done (processing = 0):
   - Process status → `completed` or `failed`
   - `completedAt` timestamp set

### 5. Detailed Results

Each process returns:
- Progress metrics
- Array of all URLs with their status
- Extracted data for completed URLs
- Error messages for failed URLs

## Database Relationships

```
Process (1) → (Many) URL → (Many) CrawlResult
         ↓
    (Many) CrawlResult
```

- Process owns multiple URLs
- URLs belong to one Process
- CrawlResults belong to both URL and Process
- Cascade delete: Deleting Process removes all URLs and CrawlResults

## Migration Path

### If Using Old API

**Old Code:**
```javascript
// Submit single URL
const url = await fetch('/api/crawl/submit', {
  method: 'POST',
  body: JSON.stringify({
    url: 'https://example.com',
    selectors: {...}
  })
});

// Wait for cron or manually trigger
await fetch('/api/crawl/process', { method: 'POST' });

// Check individual URL
const result = await fetch(`/api/results?urlId=${url.id}`);
```

**New Code:**
```javascript
// Initiate process with batch
const process = await fetch('/api/process/initiate', {
  method: 'POST',
  body: JSON.stringify({
    urls: [
      { url: 'https://example.com', selectors: {...} },
      { url: 'https://example.org', selectors: {...} }
    ]
  })
});

// Poll for completion
const pollProcess = async (processId) => {
  const response = await fetch(`/api/process/${processId}`);
  const data = await response.json();
  
  if (data.status === 'completed') {
    return data.results; // All results in one call
  }
  
  // Poll again after delay
  await new Promise(r => setTimeout(r, 5000));
  return pollProcess(processId);
};

const results = await pollProcess(process.processId);
```

## Benefits

1. **Simplified Client Code**: One initiate call, one polling endpoint
2. **Better Tracking**: Know exactly which URLs belong to which batch
3. **Faster Execution**: No waiting for cron jobs
4. **Progress Visibility**: Real-time progress percentage
5. **Atomic Operations**: All URLs in a batch tracked together
6. **Easier Retry**: Can retry entire process if needed
7. **Metadata Support**: Attach custom data to processes

## File Structure

```
src/
├── core/
│   ├── entities/
│   │   ├── process.entity.ts       # NEW: Process entity
│   │   ├── url.entity.ts           # UPDATED: Added processId
│   │   └── crawl-result.entity.ts  # UPDATED: Added processId
│   └── services/
│       └── sqs.service.ts          # Unchanged
├── features/
│   ├── submit-crawl-request/       # REFACTORED: Process initiation
│   │   ├── submit-crawl-request.service.ts
│   │   ├── submit-crawl-request.controller.ts
│   │   └── submit-crawl-request.module.ts
│   ├── process-crawl-results/      # UPDATED: Process completion logic
│   │   ├── process-crawl-results.service.ts
│   │   ├── process-crawl-results.listener.ts
│   │   └── process-crawl-results.module.ts
│   ├── query-process/              # NEW: Process polling
│   │   ├── query-process.service.ts
│   │   ├── query-process.controller.ts
│   │   └── query-process.module.ts
│   ├── query-urls/                 # Legacy support
│   └── query-results/              # Legacy support
└── app/
    └── app.module.ts               # UPDATED: Removed ScheduleModule
```

## Environment Variables

No new environment variables required. Existing variables remain the same:

```env
DATABASE_URL=postgresql://...
AWS_REGION=us-east-1
SQS_COMMAND_QUEUE_URL=https://sqs...
SQS_RESULT_QUEUE_URL=https://sqs...
```

## Testing

Use the updated test script:

```bash
./test-api.sh
```

This will:
1. Initiate a process with 2 URLs
2. Poll for status
3. Display progress
4. Show final results
5. Test statistics endpoints

## Performance Considerations

- **Batch Size**: Recommended < 100 URLs per process
- **SQS Limits**: AWS SQS standard queue handles 300 TPS
- **Database**: Indexes on `processId` and `status` for fast queries
- **Polling**: Client should poll every 5-10 seconds
- **Long Polling**: SQS listener uses 20s long polling for efficiency
