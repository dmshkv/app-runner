# Changelog

## [2.0.0] - 2024-12-04

### 🎉 Major Release: Process-Based Architecture

Complete refactor to support batch crawling with process tracking and immediate execution.

### ✨ New Features

#### Process Entity
- New `Process` entity for tracking batch crawl jobs
- Status: `initiated`, `in_progress`, `completed`, `failed`
- Progress tracking: `totalUrls`, `completedUrls`, `failedUrls`, `percentage`
- Metadata support for custom tracking information
- Automatic completion detection

#### New API Endpoints
- `POST /api/process/initiate` - Start batch crawl with multiple URLs
- `GET /api/process/:id` - Poll for progress and results (shows X/Y completed)
- `GET /api/process` - List all processes with optional status filter
- `GET /api/process/stats/summary` - Get process statistics

#### Enhanced Workflow
- Immediate execution: URLs sent to SQS on process creation (no cron delays)
- Real-time progress: Track completion status live
- Batch results: All results returned in one polling call
- Automatic status updates: Process completes when all URLs finish

### 🔄 Changes

#### Entity Updates
- **URL Entity**: Added `processId` foreign key
- **CrawlResult Entity**: Added `processId` foreign key
- All entities now link to parent Process for easy querying

#### Feature Refactoring
- `submit-crawl-request`: Refactored to create Process and send URLs immediately
- `process-crawl-results`: Enhanced to update Process status on completion
- `query-process`: New feature for polling process status

### ❌ Removed

#### Deprecated Endpoints
- `POST /api/crawl/submit` - Single URL submission (use `/api/process/initiate`)
- `POST /api/crawl/process` - Manual processing trigger (no longer needed)

#### Removed Components
- Cron scheduler for pending URLs (immediate execution instead)
- `@nestjs/schedule` dependency (no longer needed)
- `submit-crawl-request.scheduler.ts` file

### 📚 Documentation

#### New Docs
- **API_REFERENCE.md**: Complete API documentation with examples
- **PROCESS_BASED_ARCHITECTURE.md**: New workflow guide and migration
- **CHANGELOG.md**: This file

#### Updated Docs
- README.md: Updated with new workflow and examples
- docs/README.md: New documentation index
- All architecture docs updated

### 🔧 Technical Details

#### Database Schema
```sql
-- New table
CREATE TABLE processes (
  id UUID PRIMARY KEY,
  status VARCHAR NOT NULL,
  total_urls INTEGER DEFAULT 0,
  completed_urls INTEGER DEFAULT 0,
  failed_urls INTEGER DEFAULT 0,
  metadata JSONB,
  error_message TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- Updated tables
ALTER TABLE urls ADD COLUMN process_id UUID REFERENCES processes(id);
ALTER TABLE crawl_results ADD COLUMN process_id UUID REFERENCES processes(id);
```

#### Performance Improvements
- Eliminated cron job overhead
- Immediate SQS message sending
- Indexed queries on `processId` and `status`
- Batch operations for URL creation

### 🚀 Migration Guide

**Old Code:**
```javascript
// Submit URL
await fetch('/api/crawl/submit', {
  method: 'POST',
  body: JSON.stringify({ url: 'https://example.com' })
});

// Wait for cron or trigger manually
await fetch('/api/crawl/process', { method: 'POST' });
```

**New Code:**
```javascript
// Initiate process
const { processId } = await fetch('/api/process/initiate', {
  method: 'POST',
  body: JSON.stringify({
    urls: [{ url: 'https://example.com' }]
  })
}).then(r => r.json());

// Poll for results
const poll = async () => {
  const data = await fetch(`/api/process/${processId}`).then(r => r.json());
  if (data.status === 'completed') return data;
  await new Promise(r => setTimeout(r, 5000));
  return poll();
};
```

### 📊 Benefits

1. **Simplified API**: One initiate call, one polling endpoint
2. **Better Tracking**: Know which URLs belong to which batch
3. **Faster Execution**: No waiting for cron jobs (30s → immediate)
4. **Progress Visibility**: Real-time percentage and status
5. **Atomic Operations**: All URLs in a batch tracked together
6. **Easier Debugging**: Process-level error tracking

### ⚠️ Breaking Changes

- `POST /api/crawl/submit` removed (use `POST /api/process/initiate`)
- `POST /api/crawl/process` removed (automatic now)
- Database schema requires migration (new `processes` table)
- URL and CrawlResult entities now require `processId`

### 🧪 Testing

Run the test script:
```bash
./test-api.sh
```

Tests included:
- Process initiation with multiple URLs
- Progress polling
- Status checking
- Statistics retrieval

### 📝 Notes

- Legacy endpoints (`/api/urls`, `/api/results`) maintained for backward compatibility
- All queries now support filtering by `processId`
- Process status auto-updates based on URL completion
- Supports metadata for custom tracking needs

---

## [1.0.0] - 2024-12-03

### Initial Release

- Feature-based NestJS architecture
- PostgreSQL with TypeORM
- AWS SQS integration
- URL and CrawlResult entities
- Scheduled processing with cron
- REST API for URL management
