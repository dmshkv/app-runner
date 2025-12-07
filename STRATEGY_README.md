# Strategy-Based Crawling System

## 🎯 What Changed?

The crawler now supports **multiple crawling strategies**, enabling sophisticated multi-phase data extraction:

- **FULL_HTML Strategy:** Grabs and cleans complete page HTML (removes scripts, styles, SVG, etc.)
- **TEMPLATE Strategy:** Extracts structured data using CSS selectors

### Sequential Workflow

When you submit **multiple URLs** (e.g., 10 URLs) with selectors:

```
1. Process sends 10 FULL_HTML commands to SQS (one per URL, all at once)
2. Crawler processes all 10 in parallel → Publishes 10 results to SNS
3. API receives each FULL_HTML result → Stores cleaned HTML → Sends TEMPLATE command for that URL
4. Crawler processes all 10 TEMPLATE requests in parallel → Publishes 10 results
5. API receives each TEMPLATE result → Stores extracted data
6. Process marked COMPLETED when all 10 URLs are done (success or failure)
```

**Key Points:**
- ✅ Each URL is sent immediately as separate SQS message
- ✅ URLs are processed in parallel (not sequentially)
- ✅ Each URL goes through: FULL_HTML → TEMPLATE
- ✅ Process completes when ALL URLs are done

See [MULTI_URL_WORKFLOW.md](./docs/MULTI_URL_WORKFLOW.md) for detailed documentation.

## 🚀 Quick Start

### Submit a Crawl Request

```bash
# With selectors (triggers both strategies)
curl -X POST http://localhost:3000/api/process/submit \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [{
      "url": "https://example.com",
      "selectors": {
        "title": "h1",
        "price": ".price"
      }
    }]
  }'

# Without selectors (FULL_HTML only)
curl -X POST http://localhost:3000/api/process/submit \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [{
      "url": "https://example.com"
    }]
  }'
```

### Query Results

```bash
curl http://localhost:3000/api/process/query/{processId} | jq
```

**Response shows both strategies:**

```json
{
  "results": [
    {
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
          }
        }
      }
    }
  ]
}
```

## 📁 Files Changed

### API (NestJS)

1. **`apps/api/process/src/core/interfaces/crawler.interface.ts`**
   - Added `CrawlStrategy` enum
   - Created strategy-specific command interfaces
   - Created strategy-specific result interfaces

2. **`apps/api/process/src/core/entities/crawl-result.entity.ts`**
   - Added `status` column (tracks strategy phase)
   - Added `strategy` column (FULL_HTML or TEMPLATE)
   - Added `cleanedHtml` and `cleanedHtmlLength` columns

3. **`apps/api/process/src/core/services/sqs.service.ts`**
   - Added `sendFullHtmlCommand()` method
   - Added `sendTemplateCommand()` method

4. **`apps/api/process/src/features/submit-crawl-request/submit-crawl-request.service.ts`**
   - Changed to send FULL_HTML strategy first

5. **`apps/api/process/src/features/process-crawl-results/process-crawl-results.service.ts`**
   - Added strategy routing logic
   - Added `handleFullHtmlResult()` - stores HTML, triggers TEMPLATE
   - Added `handleTemplateResult()` - stores data, completes URL

6. **`apps/api/process/src/features/query-process/query-process.service.ts`**
   - Enhanced response to show both strategies

### Crawler (Lambda)

7. **`apps/crawler/dataextractor/src/main-sqs.ts`**
   - Added `cleanHtml()` function (removes scripts, styles, etc.)
   - Added `processFullHtml()` strategy handler
   - Added `processTemplate()` strategy handler
   - Updated command interfaces

### Database

8. **`migrations/002_add_strategy_support.sql`**
   - Migration script for new columns

### Documentation

9. **`docs/STRATEGY_BASED_CRAWLING.md`** - Complete architecture guide
10. **`docs/STRATEGY_QUICKSTART.md`** - Quick start examples
11. **`docs/STRATEGY_IMPLEMENTATION_SUMMARY.md`** - Implementation details

### Scripts

12. **`scripts/test-strategy-crawling.sh`** - End-to-end test suite

## 🔧 Deployment Steps

### 1. Run Database Migration

```bash
psql $DATABASE_URL -f migrations/002_add_strategy_support.sql
```

### 2. Deploy Lambda

```bash
cd apps/crawler/dataextractor
npm run build
# Deploy to AWS Lambda
```

### 3. Deploy API

```bash
cd apps/api/general
npm run build
# Deploy to your infrastructure (EC2, ECS, etc.)
```

### 4. Test

```bash
./scripts/test-strategy-crawling.sh
```

## 📊 Benefits

1. **Clean HTML Storage:** Cleaned HTML can be reprocessed without re-crawling
2. **Flexibility:** Easy to add new strategies (JS injection, AI extraction)
3. **Separation of Concerns:** Different phases for different extraction needs
4. **Type Safety:** TypeScript discriminated unions prevent errors
5. **Better Monitoring:** Track each strategy phase separately

## 🧪 Testing

### Run All Tests

```bash
export API_URL=http://localhost:3000
./scripts/test-strategy-crawling.sh
```

### Manual Test

```bash
# 1. Submit request
PROCESS_ID=$(curl -s -X POST $API_URL/api/process/submit \
  -H "Content-Type: application/json" \
  -d '{"urls":[{"url":"https://example.com","selectors":{"h1":"h1"}}]}' \
  | jq -r '.processId')

# 2. Poll for results
watch -n 2 "curl -s $API_URL/api/process/query/$PROCESS_ID | jq '.progress'"

# 3. Get final results
curl -s $API_URL/api/process/query/$PROCESS_ID | jq '.results[0].strategy'
```

## 📖 Documentation

- **[STRATEGY_BASED_CRAWLING.md](./docs/STRATEGY_BASED_CRAWLING.md)** - Full architecture documentation
- **[STRATEGY_QUICKSTART.md](./docs/STRATEGY_QUICKSTART.md)** - Quick start guide with examples
- **[STRATEGY_IMPLEMENTATION_SUMMARY.md](./docs/STRATEGY_IMPLEMENTATION_SUMMARY.md)** - Implementation details

## 🐛 Troubleshooting

### Process stuck in IN_PROGRESS

**Check:**
1. Lambda execution logs: `aws logs tail /aws/lambda/crawler-function --follow`
2. SQS queue: `aws sqs get-queue-attributes --queue-url $SQS_QUEUE_URL`
3. SNS subscriptions: `aws sns list-subscriptions-by-topic --topic-arn $SNS_TOPIC_ARN`

### TEMPLATE never triggered

**Check:**
1. URL has selectors defined
2. FULL_HTML result has `statusCode: 200`
3. Database: `SELECT * FROM crawl_results WHERE url_id = 'uuid' ORDER BY created_at`

### Cleaned HTML too small

**Adjust options:**
```json
{
  "url": "...",
  "options": {
    "waitForNetworkIdle": true,
    "waitForSelector": ".content-loaded",
    "timeout": 60000
  }
}
```

## 🔮 Future Enhancements

Potential new strategies to implement:

1. **JS_INJECTION:** Execute custom JavaScript
2. **AI_EXTRACTION:** Use LLM for semantic extraction
3. **SCREENSHOT_ONLY:** Just capture visuals
4. **PDF_EXPORT:** Convert to PDF
5. **INTERACTIVE:** Fill forms, click buttons

## 📝 Version

- **Current:** v2.0.0 (Strategy-based architecture)
- **Previous:** v1.0.0 (Simple process-based)

## ✅ Status

- [x] ✅ Interfaces and types defined
- [x] ✅ Database entity updated
- [x] ✅ SQS service enhanced
- [x] ✅ Services refactored
- [x] ✅ Crawler updated
- [x] ✅ Documentation created
- [ ] ⏳ Database migration pending
- [ ] ⏳ Lambda deployment pending
- [ ] ⏳ End-to-end testing pending

---

**All code changes are complete and compile without errors!**

TypeScript compilation status: ✅ No errors

Next steps:
1. Run database migration
2. Deploy Lambda
3. Deploy API
4. Run test suite
