# Feature-Based Architecture

## Overview

This application follows a feature-based architecture where each feature (use case) is self-contained with:
- Event handlers (SQS, scheduled jobs, etc.)
- API endpoints (REST controllers)
- Business logic (services)
- Data access (repositories via entities)

## Features

### 1. Submit Crawl Request
**Location**: `src/features/submit-crawl-request/`

**Responsibilities**:
- Accept URL submission via REST API
- Scheduled job to process pending URLs
- Send crawl commands to SQS crawler queue
- Update URL status

**Triggers**:
- API: `POST /api/crawl/submit`
- Event: Scheduled cron job (every 30s)

**Outputs**:
- SQS message to crawler command queue
- Database: URL record with status

---

### 2. Process Crawl Results
**Location**: `src/features/process-crawl-results/`

**Responsibilities**:
- Listen to SQS results queue
- Store crawl results in database
- Update URL status
- Handle errors and retries

**Triggers**:
- Event: SQS message from crawler

**Outputs**:
- Database: CrawlResult record
- Database: Updated URL status

---

### 3. Query URLs
**Location**: `src/features/query-urls/`

**Responsibilities**:
- Get URLs by status
- Get URL by ID
- Get URL statistics
- Retry failed URLs

**Triggers**:
- API: `GET /api/urls`
- API: `GET /api/urls/:id`
- API: `GET /api/urls/stats`
- API: `POST /api/urls/retry-failed`

**Outputs**:
- JSON responses

---

### 4. Query Results
**Location**: `src/features/query-results/`

**Responsibilities**:
- Get crawl results by URL
- Get result by ID
- Get result statistics

**Triggers**:
- API: `GET /api/results`
- API: `GET /api/results/:id`
- API: `GET /api/results/stats`

**Outputs**:
- JSON responses

---

## Shared Infrastructure

### Core
- Database configuration
- SQS service
- Entities (URL, CrawlResult)
- Base feature class

### Location
`src/core/`
- `config/` - Configuration services
- `entities/` - TypeORM entities
- `services/` - Shared services (SQS, database)
- `interfaces/` - Shared interfaces

---

## Directory Structure

```
src/
├── main.ts
├── app/
│   └── app.module.ts
├── core/
│   ├── config/
│   │   ├── database.config.ts
│   │   └── sqs.config.ts
│   ├── entities/
│   │   ├── url.entity.ts
│   │   └── crawl-result.entity.ts
│   ├── services/
│   │   └── sqs.service.ts
│   └── interfaces/
│       └── feature.interface.ts
└── features/
    ├── submit-crawl-request/
    │   ├── submit-crawl-request.module.ts
    │   ├── submit-crawl-request.controller.ts
    │   ├── submit-crawl-request.service.ts
    │   └── submit-crawl-request.scheduler.ts
    ├── process-crawl-results/
    │   ├── process-crawl-results.module.ts
    │   ├── process-crawl-results.service.ts
    │   └── process-crawl-results.listener.ts
    ├── query-urls/
    │   ├── query-urls.module.ts
    │   ├── query-urls.controller.ts
    │   └── query-urls.service.ts
    └── query-results/
        ├── query-results.module.ts
        ├── query-results.controller.ts
        └── query-results.service.ts
```

---

## Feature Pattern

Each feature follows this pattern:

```typescript
// Feature Module
@Module({
  imports: [TypeOrmModule.forFeature([Entity1, Entity2])],
  controllers: [FeatureController],
  providers: [FeatureService, FeatureScheduler?, FeatureListener?],
  exports: [FeatureService],
})
export class FeatureModule {}

// Feature Controller (API Endpoints)
@Controller('feature-path')
export class FeatureController {
  constructor(private readonly service: FeatureService) {}
  
  @Post()
  async handleRequest(@Body() dto: RequestDto) {
    return await this.service.execute(dto);
  }
}

// Feature Service (Business Logic)
@Injectable()
export class FeatureService {
  constructor(
    @InjectRepository(Entity) private repo: Repository<Entity>,
    private sqsService: SqsService,
  ) {}
  
  async execute(data: any): Promise<Result> {
    // Business logic here
  }
}

// Feature Scheduler (Optional - for scheduled events)
@Injectable()
export class FeatureScheduler {
  constructor(private readonly service: FeatureService) {}
  
  @Cron(CronExpression.EVERY_30_SECONDS)
  async handleScheduledEvent() {
    await this.service.execute();
  }
}

// Feature Listener (Optional - for SQS/SNS events)
@Injectable()
export class FeatureListener implements OnModuleInit {
  constructor(private readonly service: FeatureService) {}
  
  async onModuleInit() {
    // Start listening to events
  }
}
```

---

## Benefits

1. **Clear Separation**: Each use case is isolated
2. **Easy Testing**: Test features independently
3. **Maintainable**: Add/remove features without affecting others
4. **Discoverable**: Easy to find code related to a specific use case
5. **Scalable**: Features can be extracted to microservices if needed
