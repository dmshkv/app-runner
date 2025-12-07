# Strategy-Based Crawling Architecture

## Overview

The crawler now supports multiple crawling strategies, enabling sophisticated multi-phase data extraction workflows. This architecture allows for sequential processing where different strategies can be applied to the same URL.

## Strategies

### 1. FULL_HTML Strategy

**Purpose:** Grabs the complete page HTML and cleans it by removing unnecessary elements.

**Workflow:**
1. Crawler navigates to URL
2. Extracts full page HTML
3. Cleans HTML by removing:
   - `<script>` tags and content
   - `<style>` tags and content
   - `<noscript>` tags
   - Inline `style` attributes
   - `<svg>` elements
   - `data-*` attributes
   - Excessive whitespace
4. Returns cleaned HTML

**Response Format:**
```typescript
{
  strategy: "FULL_HTML",
  url: string,
  title: string,
  cleanedHtml: string,
  cleanedHtmlLength: number,
  timestamp: string,
  requestId?: string
}
```

**Use Cases:**
- Pre-processing pages for AI analysis
- Extracting clean content for archival
- Preparing data for LLM context
- Getting page structure without clutter

### 2. TEMPLATE Strategy

**Purpose:** Extracts structured data using CSS selectors.

**Workflow:**
1. Crawler navigates to URL
2. Waits for optional selector
3. Extracts data using provided selectors
4. Optionally takes screenshot
5. Returns structured data

**Response Format:**
```typescript
{
  strategy: "TEMPLATE",
  url: string,
  title: string,
  extracted: Record<string, any>,
  screenshot?: string, // base64
  screenshotSize?: number,
  timestamp: string,
  requestId?: string
}
```

**Use Cases:**
- Extracting specific fields (title, price, description)
- Structured data harvesting
- Content monitoring
- E-commerce data collection

## Sequential Workflow (Per URL)

The system implements a two-phase sequential workflow **for each URL**:

```
┌─────────────────────────────────────────────────────────────────┐
│                         Process Initiated                        │
│                      (e.g., 10 URLs submitted)                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Phase 1: FULL_HTML Strategy                   │
│  • Process sends 10 FULL_HTML commands to SQS (one per URL)    │
│  • Crawler grabs and cleans HTML for each URL (parallel)       │
│  • Publishes 10 results to SNS                                 │
│  • Process stores 10 cleaned HTMLs with status=FULL_HTML       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Phase 2: TEMPLATE Strategy                     │
│  • For each FULL_HTML result received, send TEMPLATE command   │
│  • Process sends 10 TEMPLATE commands to SQS (one per URL)     │
│  • Crawler extracts data using selectors (parallel)            │
│  • Publishes 10 results to SNS                                 │
│  • Process stores 10 extracted data with status=COMPLETED      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Process Complete                         │
│         (When all 10 URLs are processed or failed)              │
│         completedUrls=9, failedUrls=1, status=COMPLETED         │
└─────────────────────────────────────────────────────────────────┘
```

**Important:** Each URL is processed independently through both phases. If you submit 10 URLs:
- 10 FULL_HTML commands are sent immediately
- As each FULL_HTML completes, a TEMPLATE command is sent for that specific URL
- Process completes when all 10 URLs are done (succeeded or failed)

See [MULTI_URL_WORKFLOW.md](./MULTI_URL_WORKFLOW.md) for detailed multi-URL processing documentation.

## Database Schema

### CrawlResult Entity

The `CrawlResult` entity stores strategy-specific data:

```typescript
export enum CrawlResultStatus {
  FULL_HTML = 'FULL_HTML',    // FULL_HTML strategy completed
  TEMPLATE = 'TEMPLATE',       // TEMPLATE strategy completed
  COMPLETED = 'COMPLETED',     // All strategies completed
}

@Entity('crawl_results')
export class CrawlResult {
  @Column({ type: 'enum', enum: CrawlResultStatus })
  status: CrawlResultStatus;

  @Column({ type: 'varchar', nullable: true })
  strategy: string; // 'FULL_HTML' or 'TEMPLATE'

  // FULL_HTML strategy fields
  @Column({ type: 'text', nullable: true })
  cleanedHtml: string;

  @Column({ type: 'int', nullable: true })
  cleanedHtmlLength: number;

  // TEMPLATE strategy fields
  @Column({ type: 'jsonb', nullable: true })
  extracted: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  screenshot: string;

  @Column({ type: 'int', nullable: true })
  screenshotSize: number;

  // Common fields
  @Column({ type: 'varchar' })
  sourceUrl: string;

  @Column({ type: 'varchar', nullable: true })
  title: string;

  @Column({ type: 'int', nullable: true })
  statusCode: number;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;
}
```

## API Integration

### Submit Crawl Request

When a process is initiated:

```typescript
POST /api/process/submit

{
  "urls": [
    {
      "url": "https://example.com",
      "selectors": {
        "title": "h1.title",
        "price": ".price"
      }
    }
  ]
}
```

**What happens:**
1. Process entity created with status `INITIATED`
2. URL entities created
3. **FULL_HTML commands sent to SQS** (Phase 1)
4. Process status updated to `IN_PROGRESS`

### Process Crawl Results

SNS listener receives results and processes based on strategy:

#### FULL_HTML Result Handler
```typescript
if (data.strategy === CrawlStrategy.FULL_HTML) {
  // Store cleaned HTML
  await saveCrawlResult({
    strategy: 'FULL_HTML',
    status: CrawlResultStatus.FULL_HTML,
    cleanedHtml: data.cleanedHtml,
    cleanedHtmlLength: data.cleanedHtmlLength
  });
  
  // Trigger TEMPLATE strategy if selectors exist
  if (urlEntity.selectors) {
    await sqsService.sendTemplateCommand(
      urlEntity.url,
      urlEntity.id,
      urlEntity.selectors
    );
  }
}
```

#### TEMPLATE Result Handler
```typescript
if (data.strategy === CrawlStrategy.TEMPLATE) {
  // Store extracted data
  await saveCrawlResult({
    strategy: 'TEMPLATE',
    status: CrawlResultStatus.COMPLETED,
    extracted: data.extracted,
    screenshot: data.screenshot
  });
  
  // Mark URL as completed
  urlEntity.status = UrlStatus.COMPLETED;
  
  // Check if process is complete
  await checkProcessCompletion(processId);
}
```

### Query Process Status

Poll for process status and results:

```typescript
GET /api/process/query/:processId

Response:
{
  "id": "uuid",
  "status": "IN_PROGRESS",
  "progress": {
    "total": 10,
    "completed": 3,
    "failed": 1,
    "processing": 6,
    "percentage": 40
  },
  "results": [
    {
      "urlId": "uuid",
      "url": "https://example.com",
      "status": "completed",
      "strategy": {
        "current": "TEMPLATE",
        "fullHtml": {
          "cleanedHtml": "<html>...</html>",
          "cleanedHtmlLength": 5432
        },
        "template": {
          "extracted": {
            "title": { "text": "Example", "html": "..." },
            "price": { "text": "$99.99", "html": "..." }
          },
          "screenshot": "base64...",
          "screenshotSize": 12345
        }
      }
    }
  ]
}
```

## Message Flow

### 1. FULL_HTML Command (SQS)

```json
{
  "type": "CRAWL",
  "strategy": "FULL_HTML",
  "url": "https://example.com",
  "requestId": "uuid",
  "timeout": 30000,
  "waitForNetworkIdle": true
}
```

### 2. FULL_HTML Result (SNS)

```json
{
  "statusCode": 200,
  "body": {
    "strategy": "FULL_HTML",
    "url": "https://example.com",
    "title": "Example Site",
    "cleanedHtml": "<html><body>...</body></html>",
    "cleanedHtmlLength": 5432,
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "uuid"
  }
}
```

### 3. TEMPLATE Command (SQS)

```json
{
  "type": "CRAWL",
  "strategy": "TEMPLATE",
  "url": "https://example.com",
  "requestId": "uuid",
  "selectors": {
    "title": "h1.title",
    "price": ".price"
  },
  "timeout": 30000,
  "waitForNetworkIdle": true,
  "screenshot": true
}
```

### 4. TEMPLATE Result (SNS)

```json
{
  "statusCode": 200,
  "body": {
    "strategy": "TEMPLATE",
    "url": "https://example.com",
    "title": "Example Site",
    "extracted": {
      "title": {
        "text": "Example Product",
        "html": "<h1>Example Product</h1>",
        "attributes": { "class": "title" }
      },
      "price": {
        "text": "$99.99",
        "html": "<span>$99.99</span>",
        "attributes": { "class": "price" }
      }
    },
    "screenshot": "base64...",
    "screenshotSize": 12345,
    "timestamp": "2024-01-15T10:30:15Z",
    "requestId": "uuid"
  }
}
```

## HTML Cleaning Logic

The `cleanHtml()` function removes:

1. **Scripts:** All `<script>` tags and their content
2. **Styles:** All `<style>` tags and inline `style` attributes
3. **NoScript:** All `<noscript>` tags
4. **SVG Graphics:** All `<svg>` elements
5. **Data Attributes:** All `data-*` attributes
6. **Whitespace:** Excessive spaces and newlines

**Before Cleaning:**
```html
<html>
  <head>
    <style>.class { color: red; }</style>
    <script>console.log('test');</script>
  </head>
  <body style="margin: 0;">
    <svg width="100">...</svg>
    <div data-id="123" class="content">
      <h1>Title</h1>
    </div>
  </body>
</html>
```

**After Cleaning:**
```html
<html><head></head><body><div class="content"><h1>Title</h1></div></body></html>
```

## Benefits

1. **Separation of Concerns:** Different strategies handle different extraction needs
2. **Reusability:** Clean HTML can be stored and reprocessed without re-crawling
3. **Flexibility:** Easy to add new strategies (e.g., JS_INJECTION, AI_EXTRACTION)
4. **Efficiency:** Only crawl once, apply multiple extraction methods
5. **Debugging:** Each strategy result stored separately for troubleshooting

## Future Strategies

Potential strategies to implement:

1. **JS_INJECTION:** Inject custom JavaScript for dynamic content
2. **AI_EXTRACTION:** Use LLM to extract semantic content
3. **SCREENSHOT_ONLY:** Just capture visual representation
4. **PDF_EXPORT:** Convert page to PDF format
5. **INTERACTIVE:** Perform user interactions (clicks, forms)

## Error Handling

Each strategy handles errors independently:

- **FULL_HTML fails:** URL marked as failed, no TEMPLATE triggered
- **TEMPLATE fails:** FULL_HTML result preserved, URL marked as failed
- **Network errors:** Retry logic can be implemented per strategy
- **Timeout errors:** Strategy-specific timeout handling

## Performance Considerations

- **Sequential Processing:** TEMPLATE waits for FULL_HTML completion
- **Storage:** Cleaned HTML can be large, consider compression
- **Caching:** Store FULL_HTML results for quick re-extraction
- **Parallelization:** Different URLs processed in parallel

## Testing

Example test scenarios:

```bash
# 1. Submit with selectors (triggers both strategies)
curl -X POST http://localhost:3000/api/process/submit \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [{
      "url": "https://example.com",
      "selectors": {"title": "h1"}
    }]
  }'

# 2. Submit without selectors (FULL_HTML only)
curl -X POST http://localhost:3000/api/process/submit \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [{
      "url": "https://example.com"
    }]
  }'

# 3. Query process status
curl http://localhost:3000/api/process/query/{processId}
```

## Migration from Old System

Old system stored all data in one result:
```typescript
{
  html: string,
  extracted: object,
  screenshot: string
}
```

New system separates by strategy:
```typescript
// FULL_HTML Result
{
  strategy: "FULL_HTML",
  cleanedHtml: string,
  cleanedHtmlLength: number
}

// TEMPLATE Result
{
  strategy: "TEMPLATE",
  extracted: object,
  screenshot: string
}
```

**Migration steps:**
1. Update API clients to handle strategy-based responses
2. Run database migration to add `status` and `strategy` columns
3. Deploy updated crawler Lambda
4. Update SNS listener logic
5. Test end-to-end workflow

## Monitoring

Key metrics to track:

- **Strategy completion rates:** % of FULL_HTML → TEMPLATE transitions
- **Strategy timings:** Time spent in each phase
- **Cleaning efficiency:** HTML size reduction percentage
- **Error rates by strategy:** Which strategy fails more often
- **Queue depths:** SQS message counts per strategy

## Troubleshooting

### TEMPLATE never triggered

**Symptoms:** FULL_HTML completes but no TEMPLATE result

**Check:**
1. URL has selectors defined
2. FULL_HTML result has `statusCode: 200`
3. SQS service properly sending TEMPLATE command
4. Crawler processing TEMPLATE commands

### Cleaned HTML too small

**Symptoms:** `cleanedHtmlLength` is unexpectedly small

**Possible causes:**
1. Aggressive cleaning removed too much
2. Page loaded with empty content
3. JavaScript-rendered content not present

**Solution:** Adjust `waitForNetworkIdle` or add `waitForSelector`

### Process never completes

**Symptoms:** URLs stuck in `PROCESSING` status

**Check:**
1. SNS topic subscriptions working
2. Lambda function errors in CloudWatch
3. SQS dead letter queue for failed messages
4. Database connection issues in API

## See Also

- [API Reference](./API_REFERENCE.md)
- [Process-Based Architecture](./PROCESS_BASED_ARCHITECTURE.md)
- [Communication Analysis](./COMMUNICATION_ANALYSIS.md)
- [AWS Deployment Guide](./AWS_DEPLOYMENT_GUIDE.md)
