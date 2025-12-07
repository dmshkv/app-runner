# Quick Reference Guide - Feature-Based Architecture

## 🎯 Four Features, Two Types of Triggers

### Feature 1: Submit Crawl Request
**Use Case**: Get URLs into the system and send them to crawler

| Trigger Type | Details | Handler |
|-------------|---------|---------|
| **API** | `POST /api/crawl/submit` | `submit-crawl-request.controller.ts` |
| **API** | `POST /api/crawl/process` | `submit-crawl-request.controller.ts` |
| **Event** | Cron (every 30s) | `submit-crawl-request.scheduler.ts` |

**Business Logic**: `submit-crawl-request.service.ts`

---

### Feature 2: Process Crawl Results
**Use Case**: Receive crawler results and store them

| Trigger Type | Details | Handler |
|-------------|---------|---------|
| **Event** | SQS message received | `process-crawl-results.listener.ts` |

**Business Logic**: `process-crawl-results.service.ts`

---

### Feature 3: Query URLs
**Use Case**: View and manage URLs

| Trigger Type | Details | Handler |
|-------------|---------|---------|
| **API** | `GET /api/urls` | `query-urls.controller.ts` |
| **API** | `GET /api/urls/:id` | `query-urls.controller.ts` |
| **API** | `GET /api/urls/stats` | `query-urls.controller.ts` |
| **API** | `POST /api/urls/retry-failed` | `query-urls.controller.ts` |

**Business Logic**: `query-urls.service.ts`

---

### Feature 4: Query Results
**Use Case**: View crawl results

| Trigger Type | Details | Handler |
|-------------|---------|---------|
| **API** | `GET /api/results` | `query-results.controller.ts` |
| **API** | `GET /api/results/:id` | `query-results.controller.ts` |
| **API** | `GET /api/results/stats` | `query-results.controller.ts` |

**Business Logic**: `query-results.service.ts`

---

## 📂 File Organization

```
src/
├── core/                      # Shared infrastructure
│   ├── config/
│   ├── entities/
│   ├── services/
│   └── interfaces/
└── features/                  # Business features
    ├── submit-crawl-request/
    │   ├── *.module.ts       # Feature module
    │   ├── *.controller.ts   # API endpoints
    │   ├── *.service.ts      # Business logic
    │   └── *.scheduler.ts    # Event handler (cron)
    ├── process-crawl-results/
    │   ├── *.module.ts
    │   ├── *.service.ts
    │   └── *.listener.ts     # Event handler (SQS)
    ├── query-urls/
    │   ├── *.module.ts
    │   ├── *.controller.ts
    │   └── *.service.ts
    └── query-results/
        ├── *.module.ts
        ├── *.controller.ts
        └── *.service.ts
```

## 🔄 Complete Workflow

```
1. User submits URL
   → POST /api/crawl/submit
   → [Submit Crawl Request] stores as PENDING

2. Scheduled event fires (every 30s)
   → Cron trigger
   → [Submit Crawl Request] processes PENDING
   → Sends to SQS queue
   → Updates to PROCESSING

3. Crawler Lambda processes
   → Crawls URL
   → Sends result to SQS results queue

4. SQS event received
   → Long polling
   → [Process Crawl Results] handles message
   → Stores result
   → Updates URL to COMPLETED/FAILED

5. User queries results
   → GET /api/results
   → [Query Results] returns data
```

## 📝 API Quick Reference

### Submit & Process
```bash
# Submit URL
POST /api/crawl/submit
Body: { "url": "...", "selectors": {...}, "options": {...} }

# Trigger processing
POST /api/crawl/process
```

### Query URLs
```bash
# List all
GET /api/urls

# Filter by status
GET /api/urls?status=pending

# Get specific
GET /api/urls/:id

# Statistics
GET /api/urls/stats

# Retry failed
POST /api/urls/retry-failed
```

### Query Results
```bash
# List all
GET /api/results

# Filter by URL
GET /api/results?urlId=:urlId

# Get specific
GET /api/results/:id

# Statistics
GET /api/results/stats
```

### Health
```bash
GET /api/health
```

## 🔍 Finding Code

**Need to modify URL submission?**
→ `features/submit-crawl-request/`

**Need to modify result processing?**
→ `features/process-crawl-results/`

**Need to add a new query endpoint?**
→ `features/query-urls/` or `features/query-results/`

**Need to modify SQS logic?**
→ `core/services/sqs.service.ts`

**Need to modify database schema?**
→ `core/entities/`

## 🧪 Testing

```bash
# Run test script
./apps/api/process/test-api.sh

# Start service
nx serve process

# Manual test
curl http://localhost:3000/api/health
```

## 📚 Documentation Files

- `ARCHITECTURE.md` - Architecture explanation
- `ARCHITECTURE_DIAGRAMS.md` - Visual diagrams
- `MIGRATION_GUIDE.md` - API changes
- `REFACTORING_SUMMARY.md` - Complete summary
- `README.md` - Full documentation
- `SETUP.md` - Setup instructions
