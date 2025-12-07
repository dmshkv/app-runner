# Feature-Based Architecture Visual Guide

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Process API Service                          │
│                         (Feature-Based)                              │
└─────────────────────────────────────────────────────────────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  API Triggers   │    │  Event Triggers  │    │  Shared Core     │
│  (Controllers)  │    │  (Listeners)     │    │  (Entities/SQS)  │
└─────────────────┘    └──────────────────┘    └──────────────────┘
         │                        │                        │
         └────────────────────────┴────────────────────────┘
                                  │
                                  ▼
                        ┌─────────────────┐
                        │  Feature Layer  │
                        └─────────────────┘
```

## Feature Interaction Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                       │
│  1. Submit Crawl Request Feature                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                                                              │    │
│  │  API Trigger:              Event Trigger:                   │    │
│  │  POST /api/crawl/submit    Cron (every 30s)                │    │
│  │         │                         │                          │    │
│  │         └─────────┬───────────────┘                          │    │
│  │                   ▼                                          │    │
│  │         SubmitCrawlRequestService                           │    │
│  │                   │                                          │    │
│  │                   ├─► Store URL as PENDING                  │    │
│  │                   ├─► Send to SQS crawler queue             │    │
│  │                   └─► Update status to PROCESSING           │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
└───────────────────────────────┬───────────────────────────────────────┘
                                │
                                ▼
                        ┌───────────────┐
                        │  SQS Queue    │
                        │  (Commands)   │
                        └───────────────┘
                                │
                                ▼
                        ┌───────────────┐
                        │ Crawler Lambda│
                        │  (External)   │
                        └───────────────┘
                                │
                                ▼
                        ┌───────────────┐
                        │  SQS Queue    │
                        │  (Results)    │
                        └───────────────┘
                                │
                                ▼
┌───────────────────────────────┴───────────────────────────────────────┐
│                                                                       │
│  2. Process Crawl Results Feature                                    │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                                                              │    │
│  │  Event Trigger:                                             │    │
│  │  SQS Message Received (long polling)                        │    │
│  │         │                                                    │    │
│  │         ▼                                                    │    │
│  │  ProcessCrawlResultsListener                                │    │
│  │         │                                                    │    │
│  │         ▼                                                    │    │
│  │  ProcessCrawlResultsService                                 │    │
│  │         │                                                    │    │
│  │         ├─► Parse crawler result                            │    │
│  │         ├─► Store in crawl_results table                    │    │
│  │         └─► Update URL status (COMPLETED/FAILED)            │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
└───────────────────────────────┬───────────────────────────────────────┘
                                │
                                ▼
                        ┌───────────────┐
                        │   PostgreSQL  │
                        │   (RDS)       │
                        └───────────────┘
                                │
        ┌───────────────────────┴───────────────────────┐
        │                                               │
        ▼                                               ▼
┌───────────────────┐                         ┌────────────────────┐
│                   │                         │                    │
│  3. Query URLs    │                         │  4. Query Results  │
│  Feature          │                         │  Feature           │
│                   │                         │                    │
│  API Triggers:    │                         │  API Triggers:     │
│  GET /api/urls    │                         │  GET /api/results  │
│  GET /api/urls/:id│                         │  GET /api/results/ │
│  GET /stats       │                         │  GET /stats        │
│                   │                         │                    │
└───────────────────┘                         └────────────────────┘
```

## Feature Components Breakdown

### Feature 1: Submit Crawl Request
```
┌─────────────────────────────────────────────────┐
│  submit-crawl-request/                          │
│                                                 │
│  ┌─────────────────────────────────────┐       │
│  │  Controller (API)                   │       │
│  │  - POST /api/crawl/submit           │       │
│  │  - POST /api/crawl/process          │       │
│  └──────────────┬──────────────────────┘       │
│                 │                               │
│  ┌──────────────▼──────────────────────┐       │
│  │  Service (Business Logic)           │       │
│  │  - submitUrl()                      │       │
│  │  - processPendingUrls()             │       │
│  │  - sendCrawlCommand()               │       │
│  └──────────────┬──────────────────────┘       │
│                 │                               │
│  ┌──────────────▼──────────────────────┐       │
│  │  Scheduler (Event Handler)          │       │
│  │  - @Cron(every 30s)                 │       │
│  │  - handleScheduledProcessing()      │       │
│  └─────────────────────────────────────┘       │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Feature 2: Process Crawl Results
```
┌─────────────────────────────────────────────────┐
│  process-crawl-results/                         │
│                                                 │
│  ┌─────────────────────────────────────┐       │
│  │  Listener (Event Handler)           │       │
│  │  - OnModuleInit                     │       │
│  │  - poll() - Long polling            │       │
│  │  - handleMessage()                  │       │
│  └──────────────┬──────────────────────┘       │
│                 │                               │
│  ┌──────────────▼──────────────────────┐       │
│  │  Service (Business Logic)           │       │
│  │  - processResult()                  │       │
│  │  - storeCrawlResult()               │       │
│  │  - updateUrlStatus()                │       │
│  └─────────────────────────────────────┘       │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Feature 3: Query URLs
```
┌─────────────────────────────────────────────────┐
│  query-urls/                                    │
│                                                 │
│  ┌─────────────────────────────────────┐       │
│  │  Controller (API)                   │       │
│  │  - GET /api/urls                    │       │
│  │  - GET /api/urls/:id                │       │
│  │  - GET /api/urls/stats              │       │
│  │  - POST /api/urls/retry-failed      │       │
│  └──────────────┬──────────────────────┘       │
│                 │                               │
│  ┌──────────────▼──────────────────────┐       │
│  │  Service (Business Logic)           │       │
│  │  - findAll()                        │       │
│  │  - findOne()                        │       │
│  │  - getStats()                       │       │
│  │  - retryFailedUrls()                │       │
│  └─────────────────────────────────────┘       │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Feature 4: Query Results
```
┌─────────────────────────────────────────────────┐
│  query-results/                                 │
│                                                 │
│  ┌─────────────────────────────────────┐       │
│  │  Controller (API)                   │       │
│  │  - GET /api/results                 │       │
│  │  - GET /api/results/:id             │       │
│  │  - GET /api/results/stats           │       │
│  └──────────────┬──────────────────────┘       │
│                 │                               │
│  ┌──────────────▼──────────────────────┐       │
│  │  Service (Business Logic)           │       │
│  │  - findAll()                        │       │
│  │  - findOne()                        │       │
│  │  - getStats()                       │       │
│  └─────────────────────────────────────┘       │
│                                                 │
└─────────────────────────────────────────────────┘
```

## Core Layer (Shared Infrastructure)

```
┌─────────────────────────────────────────────────┐
│  core/                                          │
│                                                 │
│  ┌─────────────────────────────────────┐       │
│  │  config/                            │       │
│  │  - database.config.ts               │       │
│  └─────────────────────────────────────┘       │
│                                                 │
│  ┌─────────────────────────────────────┐       │
│  │  entities/                          │       │
│  │  - url.entity.ts                    │       │
│  │  - crawl-result.entity.ts           │       │
│  └─────────────────────────────────────┘       │
│                                                 │
│  ┌─────────────────────────────────────┐       │
│  │  services/                          │       │
│  │  - sqs.service.ts                   │       │
│  └─────────────────────────────────────┘       │
│                                                 │
│  ┌─────────────────────────────────────┐       │
│  │  interfaces/                        │       │
│  │  - crawler.interface.ts             │       │
│  └─────────────────────────────────────┘       │
│                                                 │
└─────────────────────────────────────────────────┘
```

## Data Flow

### Write Path (URL Submission → Crawling)
```
User
  │
  │ POST /api/crawl/submit
  ▼
Submit Crawl Request Feature
  │
  │ Create URL (status: PENDING)
  ▼
PostgreSQL
  │
  │ Cron Event (30s)
  ▼
Submit Crawl Request Feature
  │
  │ Pick PENDING URLs
  │ Send to SQS
  │ Update status: PROCESSING
  ▼
SQS Command Queue
  │
  ▼
Crawler Lambda
```

### Read Path (Results → Storage)
```
Crawler Lambda
  │
  │ Sends result
  ▼
SQS Results Queue
  │
  │ Long polling
  ▼
Process Crawl Results Feature
  │
  │ Parse result
  │ Store in DB
  │ Update URL status
  ▼
PostgreSQL
```

### Query Path
```
User
  │
  │ GET /api/urls
  │ GET /api/results
  ▼
Query Features
  │
  │ Read from DB
  ▼
PostgreSQL
  │
  │ Return JSON
  ▼
User
```

## Key Principles

1. **Feature Independence**: Each feature can work independently
2. **Single Responsibility**: Each feature has one clear purpose
3. **Event + API Together**: Related triggers are colocated
4. **Shared Infrastructure**: Common code in core/
5. **Clear Boundaries**: Easy to see what belongs to each feature
