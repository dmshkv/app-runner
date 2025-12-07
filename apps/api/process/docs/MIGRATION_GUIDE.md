# Feature-Based Migration Guide

## Changes Overview

The application has been refactored from a module-based to a feature-based architecture. Each feature now represents a complete use case with both API endpoints and event handlers.

## New Structure

```
src/
├── core/
│   ├── config/          # Shared configuration
│   ├── entities/        # Database entities
│   ├── services/        # Shared services (SQS)
│   └── interfaces/      # Shared interfaces
└── features/
    ├── submit-crawl-request/      # Submit URLs + Scheduled processing
    ├── process-crawl-results/     # SQS listener + Result storage
    ├── query-urls/                # URL queries
    └── query-results/             # Result queries
```

## API Endpoint Changes

### Before → After

**Submit URL for Crawling:**
- Before: `POST /api/urls`
- After: `POST /api/crawl/submit`

**Trigger Processing:**
- Before: `POST /api/urls/process`
- After: `POST /api/crawl/process`

**Query URLs:**
- Before: `GET /api/urls`
- After: `GET /api/urls` (unchanged)

**URL Stats:**
- Before: `GET /api/urls/stats`
- After: `GET /api/urls/stats` (unchanged)

**Get URL by ID:**
- Before: `GET /api/urls/:id`
- After: `GET /api/urls/:id` (unchanged)

**Retry Failed:**
- Before: `POST /api/urls/retry-failed`
- After: `POST /api/urls/retry-failed` (unchanged)

**Query Results:**
- All `/api/results/*` endpoints remain unchanged

## Feature Descriptions

### 1. Submit Crawl Request
**Location**: `features/submit-crawl-request/`

**Components**:
- `submit-crawl-request.controller.ts` - API endpoints
- `submit-crawl-request.service.ts` - Business logic
- `submit-crawl-request.scheduler.ts` - Scheduled event handler

**API Endpoints**:
- `POST /api/crawl/submit` - Submit URL
- `POST /api/crawl/process` - Manual trigger

**Events**:
- Cron job every 30 seconds → Processes pending URLs

---

### 2. Process Crawl Results
**Location**: `features/process-crawl-results/`

**Components**:
- `process-crawl-results.service.ts` - Business logic
- `process-crawl-results.listener.ts` - SQS event listener

**Events**:
- SQS message received → Process and store result

---

### 3. Query URLs
**Location**: `features/query-urls/`

**Components**:
- `query-urls.controller.ts` - API endpoints
- `query-urls.service.ts` - Business logic

**API Endpoints**:
- `GET /api/urls` - List URLs
- `GET /api/urls/:id` - Get URL by ID
- `GET /api/urls/stats` - Get statistics
- `POST /api/urls/retry-failed` - Retry failed URLs

---

### 4. Query Results
**Location**: `features/query-results/`

**Components**:
- `query-results.controller.ts` - API endpoints
- `query-results.service.ts` - Business logic

**API Endpoints**:
- `GET /api/results` - List results
- `GET /api/results/:id` - Get result by ID
- `GET /api/results/stats` - Get statistics

---

## Updated Usage Examples

### Submit URL (NEW endpoint)
```bash
curl -X POST http://localhost:3000/api/crawl/submit \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "selectors": {
      "title": "h1"
    },
    "options": {
      "screenshot": true
    }
  }'
```

### Trigger Processing (NEW endpoint)
```bash
curl -X POST http://localhost:3000/api/crawl/process
```

### Query URLs (unchanged)
```bash
# All URLs
curl http://localhost:3000/api/urls

# By status
curl http://localhost:3000/api/urls?status=pending

# Statistics
curl http://localhost:3000/api/urls/stats

# By ID
curl http://localhost:3000/api/urls/123

# Retry failed
curl -X POST http://localhost:3000/api/urls/retry-failed
```

### Query Results (unchanged)
```bash
# All results
curl http://localhost:3000/api/results

# By URL ID
curl http://localhost:3000/api/results?urlId=123

# Statistics
curl http://localhost:3000/api/results/stats

# By ID
curl http://localhost:3000/api/results/123
```

## Benefits of New Architecture

1. **Clear Use Cases**: Each feature represents a complete business use case
2. **Event + API Together**: Related functionality is colocated
3. **Easy to Test**: Features can be tested independently
4. **Scalable**: Features can be extracted to microservices if needed
5. **Maintainable**: Easy to find and modify specific functionality

## Migration Checklist

- [x] Move entities to `core/entities/`
- [x] Move config to `core/config/`
- [x] Move SQS service to `core/services/`
- [x] Create feature modules
- [x] Update app.module.ts
- [x] Update test scripts
- [x] Update documentation

## Testing

```bash
# Run the updated test script
./test-api.sh

# Or test manually
# 1. Submit URL
curl -X POST http://localhost:3000/api/crawl/submit \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# 2. Check status
curl http://localhost:3000/api/urls/stats

# 3. View results
curl http://localhost:3000/api/results
```
