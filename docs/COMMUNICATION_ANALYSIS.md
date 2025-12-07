# Crawler ↔ API Process Communication Analysis

## Overview

The crawler (dataextractor Lambda) and API process service communicate asynchronously using **AWS SQS** for commands and results.

---

## Communication Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    API Process Service (NestJS)                  │
│                                                                   │
│  POST /api/process/initiate                                      │
│    └─> Create Process + URLs                                     │
│    └─> Send SQS messages ───────────────┐                        │
│                                         │                        │
│  ProcessCrawlResultsListener            │                        │
│    └─> Polls SQS Results Queue <─────┐  │                        │
│    └─> Stores results in DB          │  │                        │
│    └─> Updates Process status        │  │                        │
└────────────────────────────────────────┼──┼────────────────────┘
                                         │  │
                                         │  ▼
                    ┌────────────────────┼──────────────────────┐
                    │     AWS SQS        │                      │
                    │                    │                      │
                    │  Commands Queue ◄──┘                      │
                    │  (crawler-commands-{env})                 │
                    │                                           │
                    │  Results Queue                            │
                    │  (receives from SNS)                      │
                    └───────────┬──────────▲───────────────────┘
                                │          │
                                │          │
                    ┌───────────▼──────────┼───────────────────┐
                    │  Crawler Lambda      │                   │
                    │  (dataextractor)     │                   │
                    │                      │                   │
                    │  1. Receives SQS ────┘                   │
                    │  2. Launches browser                      │
                    │  3. Crawls URL                            │
                    │  4. Extracts data                         │
                    │  5. Publishes to SNS ─────────────────────┤
                    │  6. Polls for next message               │
                    └──────────────────────────────────────────┘
                                           │
                                           ▼
                    ┌─────────────────────────────────────────┐
                    │     AWS SNS                             │
                    │  crawler-results-{env}                  │
                    │                                         │
                    │  Subscribers:                           │
                    │  - SQS Results Queue (for API)         │
                    └─────────────────────────────────────────┘
```

---

## Message Flow

### 1. Process Initiation (API → Crawler)

**Endpoint:** `POST /api/process/initiate`

**API Action:**
```typescript
// apps/api/process/src/features/submit-crawl-request/submit-crawl-request.service.ts
async initiateProcess(data: InitiateProcessDto) {
  // 1. Create Process entry
  const process = await this.processRepository.save({
    status: ProcessStatus.INITIATED,
    totalUrls: data.urls.length
  });

  // 2. Create URL entries
  const urls = await this.urlRepository.save(urlEntities);

  // 3. Send SQS commands immediately
  for (const url of urls) {
    await this.sqsService.sendCrawlCommand({
      type: 'CRAWL',
      url: url.url,
      requestId: url.id,
      selectors: url.selectors,
      ...url.options
    });
  }
}
```

**SQS Message Format (Command):**
```json
{
  "type": "CRAWL",
  "url": "https://example.com",
  "requestId": "uuid-of-url-entity",
  "selectors": {
    "title": "h1",
    "content": "article"
  },
  "options": {
    "screenshot": true,
    "waitForNetworkIdle": true,
    "timeout": 30000
  }
}
```

**Queue:** `crawler-commands-{env}` (e.g., `crawler-commands-dev`)

### 2. Crawler Processing (Lambda)

**Trigger:** SQS event source automatically invokes Lambda

**Handler:** `apps/crawler/dataextractor/src/main-sqs.ts`

**Processing Flow:**
```typescript
export const handler = async (event: SQSEvent, context: Context) => {
  // 1. Launch browser once
  const browser = await puppeteer.launch(...);

  // 2. Process initial SQS messages
  for (const record of event.Records) {
    const command = JSON.parse(record.body);
    
    if (command.type === 'CRAWL') {
      const result = await processCrawl(browser, command);
      await publishResults(result); // Send to SNS
    }
  }

  // 3. Poll for more messages (long polling)
  while (hasTime) {
    const nextCommand = await pollForNextMessage();
    if (nextCommand?.type === 'CRAWL') {
      const result = await processCrawl(browser, nextCommand);
      await publishResults(result);
    }
  }

  await browser.close();
};
```

### 3. Results Publishing (Crawler → SNS → SQS)

**SNS Publish:**
```typescript
// apps/crawler/dataextractor/src/main-sqs.ts
async function publishResults(results: any) {
  await snsClient.send(
    new PublishCommand({
      TopicArn: SNS_TOPIC_ARN,
      Message: JSON.stringify({
        statusCode: 200,
        body: {
          url: "https://example.com",
          requestId: "uuid-of-url-entity",
          title: "Page Title",
          extracted: {
            title: { text: "...", html: "...", attributes: {} },
            content: { text: "...", html: "...", attributes: {} }
          },
          screenshot: "base64...",
          timestamp: "2024-12-04T01:00:00Z"
        }
      }),
      Subject: 'Crawl Complete: https://example.com',
      MessageAttributes: {
        eventType: { DataType: 'String', StringValue: 'CrawlComplete' },
        url: { DataType: 'String', StringValue: 'https://example.com' },
        statusCode: { DataType: 'Number', StringValue: '200' }
      }
    })
  );
}
```

**SNS Topic:** `crawler-results-{env}` (e.g., `crawler-results-dev`)

**SNS → SQS Subscription:** SNS automatically forwards to subscribed SQS queue

### 4. Results Processing (API)

**Listener:** `apps/api/process/src/features/process-crawl-results/process-crawl-results.listener.ts`

**Polling Flow:**
```typescript
export class ProcessCrawlResultsListener implements OnModuleInit {
  async onModuleInit() {
    this.startListening(); // Starts on app startup
  }

  private async poll() {
    // Long polling (20 seconds)
    const messages = await this.sqsClient.send(
      new ReceiveMessageCommand({
        QueueUrl: this.resultsQueueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 20
      })
    );

    for (const message of messages) {
      const result = this.parseMessage(message.Body);
      
      // 1. Store CrawlResult in DB
      await this.processCrawlResultsService.processResult(result);
      
      // 2. Update URL status
      // 3. Check if Process complete
      // 4. Update Process status
      
      // 5. Delete message
      await this.deleteMessage(message.ReceiptHandle);
    }
  }
}
```

**Service Logic:**
```typescript
// apps/api/process/src/features/process-crawl-results/process-crawl-results.service.ts
async processResult(data: CrawlResultData) {
  // 1. Find URL entity by requestId
  const url = await this.urlRepository.findOne({ id: data.requestId });

  // 2. Store CrawlResult
  await this.crawlResultRepository.save({
    urlId: url.id,
    processId: url.processId,
    extracted: data.extracted,
    statusCode: data.statusCode
  });

  // 3. Update URL status
  url.status = data.statusCode === 200 ? 'completed' : 'failed';
  await this.urlRepository.save(url);

  // 4. Check Process completion
  await this.checkProcessCompletion(url.processId);
}

async checkProcessCompletion(processId: string) {
  const process = await this.processRepository.findOne({ id: processId });
  const processingUrls = await this.urlRepository.count({ 
    processId, 
    status: 'processing' 
  });

  if (processingUrls === 0) {
    process.status = ProcessStatus.COMPLETED;
    process.completedAt = new Date();
    await this.processRepository.save(process);
  }
}
```

---

## AWS Resources & Topics

### SQS Queues

| Queue Name | Purpose | Direction | Configuration |
|------------|---------|-----------|---------------|
| `crawler-commands-{env}` | Crawl commands | API → Crawler | Visibility: 15min, Long polling: 20s, Retention: 4 days |
| `crawler-dlq-{env}` | Dead letter queue | Failed messages | Retention: 14 days, MaxReceiveCount: 3 |
| `{results-queue-name}` | Crawl results | Crawler → API | Auto-created by SNS subscription |

### SNS Topics

| Topic Name | Purpose | Publishers | Subscribers |
|------------|---------|------------|-------------|
| `crawler-results-{env}` | Crawl results | Crawler Lambda | SQS Results Queue (for API) |

### Environment Variables

**API Process Service (.env):**
```env
# Send commands to crawler
SQS_CRAWL_QUEUE_URL=https://sqs.ca-central-1.amazonaws.com/{account}/crawler-commands-dev

# Receive results from crawler
SQS_RESULTS_QUEUE_URL=https://sqs.ca-central-1.amazonaws.com/{account}/{results-queue}

# AWS Region
AWS_REGION=ca-central-1
```

**Crawler Lambda (CDK):**
```typescript
environment: {
  SQS_QUEUE_URL: this.commandQueue.queueUrl,  // Commands queue
  SNS_TOPIC_ARN: this.resultsTopicarn.topicArn, // Results topic
}
```

---

## Message Types

### 1. CRAWL Command (API → Crawler)

**Interface:**
```typescript
interface CrawlCommand {
  type: 'CRAWL';
  url: string;
  requestId?: string;           // UUID of URL entity
  selectors?: {
    [key: string]: string;      // CSS selectors
  };
  options?: {
    waitForSelector?: string;
    timeout?: number;
    extractFullHtml?: boolean;
    screenshot?: boolean;
    waitForNetworkIdle?: boolean;
  };
}
```

**Example:**
```json
{
  "type": "CRAWL",
  "url": "https://news.ycombinator.com",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "selectors": {
    "stories": ".athing .title a",
    "scores": ".score"
  },
  "options": {
    "waitForSelector": ".athing",
    "screenshot": false,
    "timeout": 30000
  }
}
```

### 2. EXIT Command (Control Signal)

**Interface:**
```typescript
interface ExitCommand {
  type: 'EXIT';
}
```

**Purpose:** Gracefully shutdown crawler Lambda (stop polling)

### 3. Crawl Result (Crawler → API)

**Interface:**
```typescript
interface CrawlResultMessage {
  statusCode: number;
  body: {
    url: string;
    requestId?: string;
    title?: string;
    timestamp: string;
    
    // Extracted data
    extracted?: {
      [selectorKey: string]: {
        text: string;
        html: string;
        attributes: Record<string, string>;
      } | Array<{...}>;
    };
    
    // Optional full HTML
    html?: string;
    htmlLength?: number;
    
    // Optional screenshot
    screenshot?: string;      // Base64
    screenshotSize?: number;
    
    // Error info
    statusCode?: number;
    errorMessage?: string;
  };
}
```

**Example:**
```json
{
  "statusCode": 200,
  "body": {
    "url": "https://example.com",
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Example Domain",
    "timestamp": "2024-12-04T01:00:00Z",
    "extracted": {
      "title": {
        "text": "Example Domain",
        "html": "Example Domain",
        "attributes": { "class": "title" }
      },
      "content": {
        "text": "This domain is for use in illustrative examples...",
        "html": "<p>This domain is for use in illustrative examples...</p>",
        "attributes": {}
      }
    },
    "html": "<!doctype html>...",
    "htmlLength": 1256,
    "screenshot": "iVBORw0KGgoAAAANSUhEUgAA...",
    "screenshotSize": 52341
  }
}
```

---

## Communication Patterns

### Pattern 1: Simple Single URL Crawl

```
API:         POST /initiate → Create Process → Send CRAWL command → SQS
                                                                      ↓
Crawler:                                                    Receive → Process → Publish → SNS
                                                                                          ↓
API:                                                                           Receive ← SQS
             Update URL status → Update Process status
```

### Pattern 2: Batch Crawl (Multiple URLs)

```
API:         POST /initiate → Create Process → Send N CRAWL commands → SQS
                                                                         ↓ ↓ ↓
Crawler:                                                    Process × N → Publish × N → SNS
                                                                                          ↓ ↓ ↓
API:                                                                            Receive × N ← SQS
             Update each URL → Check completion → Update Process when all done
```

### Pattern 3: Long-Running Lambda (Polling)

```
Crawler:     Receive initial SQS message → Process → Publish
                                              ↓
                                           Poll SQS (20s long poll)
                                              ↓
                                           Receive next? → Process → Publish
                                              ↓
                                           Poll again...
                                              ↓
                                           Timeout or EXIT → Shutdown
```

---

## Error Handling

### Failed Crawls

**Crawler:** Returns error in result message
```json
{
  "statusCode": 500,
  "body": {
    "url": "https://example.com",
    "requestId": "uuid",
    "error": "Navigation timeout of 30000 ms exceeded",
    "timestamp": "2024-12-04T01:00:00Z"
  }
}
```

**API:** Marks URL as failed, updates Process
```typescript
url.status = UrlStatus.FAILED;
url.errorMessage = result.errorMessage;
process.failedUrls++;
```

### SQS Processing Failures

**Dead Letter Queue:** After 3 failed attempts → `crawler-dlq-{env}`

**Monitoring:** CloudWatch alarms on DLQ depth

### Lambda Timeouts

**Strategy:** Exit gracefully before 15-minute limit
```typescript
if (context.getRemainingTimeInMillis() < 120000) {
  console.log('Approaching timeout, exiting');
  break;
}
```

---

## Testing Communication

### 1. Send Command to Crawler

```bash
# Send via SQS
aws sqs send-message \
  --queue-url https://sqs.ca-central-1.amazonaws.com/.../crawler-commands-dev \
  --message-body '{
    "type": "CRAWL",
    "url": "https://example.com",
    "requestId": "test-123"
  }'
```

### 2. Check Results Queue

```bash
# Receive from results queue
aws sqs receive-message \
  --queue-url https://sqs.ca-central-1.amazonaws.com/.../results-queue \
  --wait-time-seconds 20
```

### 3. Monitor SNS Topic

```bash
# Subscribe email to SNS topic
aws sns subscribe \
  --topic-arn arn:aws:sns:ca-central-1:.../crawler-results-dev \
  --protocol email \
  --notification-endpoint your@email.com
```

### 4. Test Full Flow

```bash
# Use API test script
cd apps/api/process
./test-api.sh
```

---

## Performance Characteristics

### Latency

- **Command delivery:** ~100-500ms (SQS)
- **Crawl execution:** 2-10s (depends on page)
- **Result delivery:** ~100-500ms (SNS → SQS)
- **Total round-trip:** 3-15s per URL

### Throughput

- **Single Lambda:** 10-50 URLs per invocation (with polling)
- **Concurrent Lambdas:** 1000+ URLs/min (SQS auto-scales)
- **SQS Limits:** 3000 messages/sec standard queue

### Cost

- **SQS:** $0.40 per 1M requests
- **SNS:** $0.50 per 1M publishes
- **Lambda:** Based on compute time (2048MB × execution duration)

---

## Summary

### Communication Channels

1. **API → Crawler:** SQS Command Queue (`crawler-commands-{env}`)
2. **Crawler → API:** SNS Topic (`crawler-results-{env}`) → SQS Results Queue

### Message Types

1. **CRAWL:** Main crawl command with URL and extraction config
2. **EXIT:** Graceful shutdown signal (optional)
3. **Result:** Crawl output with extracted data

### Key Features

- ✅ **Asynchronous:** Decoupled producers/consumers
- ✅ **Reliable:** SQS guarantees delivery, DLQ for failures
- ✅ **Scalable:** Auto-scales with queue depth
- ✅ **Persistent:** Browser stays open across multiple crawls
- ✅ **Traceable:** requestId links commands to results
- ✅ **Monitored:** CloudWatch metrics and alarms
