# Strategy-Based Crawling - Quick Start Guide

## Overview

The crawler now supports two strategies:
- **FULL_HTML:** Grabs and cleans the complete page HTML
- **TEMPLATE:** Extracts structured data using CSS selectors

When you submit a URL with selectors, the system automatically:
1. First runs FULL_HTML strategy → stores cleaned HTML
2. Then runs TEMPLATE strategy → extracts structured data

## Quick Examples

### Example 1: Extract Product Data

```bash
curl -X POST http://localhost:3000/api/process/submit \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      {
        "url": "https://example.com/product",
        "selectors": {
          "title": "h1.product-title",
          "price": ".product-price",
          "description": ".product-description",
          "images": "img.product-image"
        },
        "options": {
          "screenshot": true,
          "timeout": 30000
        }
      }
    ]
  }'

# Response:
# {
#   "processId": "uuid-here",
#   "totalUrls": 1,
#   "urls": [...]
# }
```

### Example 2: Get Clean HTML Only

```bash
# Submit without selectors = FULL_HTML only
curl -X POST http://localhost:3000/api/process/submit \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      {
        "url": "https://example.com/article"
      }
    ]
  }'
```

### Example 3: Poll for Results

```bash
# Get process status
curl http://localhost:3000/api/process/query/uuid-here

# Response shows both FULL_HTML and TEMPLATE results:
# {
#   "id": "uuid-here",
#   "status": "COMPLETED",
#   "progress": {
#     "total": 1,
#     "completed": 1,
#     "percentage": 100
#   },
#   "results": [
#     {
#       "urlId": "uuid",
#       "url": "https://example.com/product",
#       "status": "completed",
#       "strategy": {
#         "current": "TEMPLATE",
#         "fullHtml": {
#           "cleanedHtml": "<html>...</html>",
#           "cleanedHtmlLength": 5432
#         },
#         "template": {
#           "extracted": {
#             "title": { "text": "Product Name", "html": "..." },
#             "price": { "text": "$99.99", "html": "..." }
#           },
#           "screenshot": "base64...",
#           "screenshotSize": 12345
#         }
#       }
#     }
#   ]
# }
```

## Workflow Visualization

```
User Submits URL
       ↓
┌──────────────────┐
│ Process Created  │
│ status=INITIATED │
└────────┬─────────┘
         ↓
┌──────────────────┐     ┌───────────────────┐
│ FULL_HTML sent   │────→│ Crawler processes │
│ to SQS Queue     │     │ Grabs & cleans    │
└────────┬─────────┘     └─────────┬─────────┘
         ↓                         ↓
┌──────────────────┐     ┌───────────────────┐
│ Process status=  │     │ Result published  │
│ IN_PROGRESS      │     │ to SNS            │
└──────────────────┘     └─────────┬─────────┘
                                   ↓
                         ┌───────────────────┐
                         │ API receives      │
                         │ FULL_HTML result  │
                         └─────────┬─────────┘
                                   ↓
                         ┌───────────────────┐
                         │ Store cleaned HTML│
                         │ status=FULL_HTML  │
                         └─────────┬─────────┘
                                   ↓
                         ┌───────────────────┐
                         │ If selectors exist│
                         │ send TEMPLATE cmd │
                         └─────────┬─────────┘
                                   ↓
                         ┌───────────────────┐
                         │ Crawler extracts  │
                         │ data via selectors│
                         └─────────┬─────────┘
                                   ↓
                         ┌───────────────────┐
                         │ TEMPLATE result   │
                         │ published to SNS  │
                         └─────────┬─────────┘
                                   ↓
                         ┌───────────────────┐
                         │ Store extracted   │
                         │ status=COMPLETED  │
                         └─────────┬─────────┘
                                   ↓
                         ┌───────────────────┐
                         │ URL marked        │
                         │ completed         │
                         └─────────┬─────────┘
                                   ↓
                         ┌───────────────────┐
                         │ Process status=   │
                         │ COMPLETED         │
                         └───────────────────┘
```

## Data Structure

### FULL_HTML Result

```typescript
{
  strategy: "FULL_HTML",
  url: "https://example.com",
  title: "Page Title",
  cleanedHtml: "<html><body><h1>Title</h1>...</body></html>",
  cleanedHtmlLength: 5432,
  timestamp: "2024-01-15T10:30:00Z",
  requestId: "uuid"
}
```

**What's Removed from HTML:**
- `<script>` tags
- `<style>` tags
- Inline `style` attributes
- `<svg>` elements
- `data-*` attributes
- Excessive whitespace

### TEMPLATE Result

```typescript
{
  strategy: "TEMPLATE",
  url: "https://example.com",
  title: "Page Title",
  extracted: {
    "title": {
      text: "Product Name",
      html: "<h1>Product Name</h1>",
      attributes: { class: "product-title" }
    },
    "price": {
      text: "$99.99",
      html: "<span>$99.99</span>",
      attributes: { class: "price" }
    }
  },
  screenshot: "base64-encoded-image...",
  screenshotSize: 12345,
  timestamp: "2024-01-15T10:30:15Z",
  requestId: "uuid"
}
```

## Common Use Cases

### 1. E-commerce Product Scraping

```javascript
{
  "url": "https://shop.example.com/product/123",
  "selectors": {
    "name": "h1.product-name",
    "price": ".price-current",
    "oldPrice": ".price-was",
    "availability": ".stock-status",
    "images": "img.product-image",
    "description": ".product-description",
    "specs": ".specifications li"
  },
  "options": {
    "screenshot": true,
    "waitForSelector": ".product-loaded",
    "timeout": 30000
  }
}
```

### 2. News Article Extraction

```javascript
{
  "url": "https://news.example.com/article/456",
  "selectors": {
    "headline": "h1.article-title",
    "author": ".author-name",
    "date": "time.publish-date",
    "content": ".article-body p",
    "tags": ".article-tags a"
  },
  "options": {
    "waitForNetworkIdle": true
  }
}
```

### 3. Real Estate Listings

```javascript
{
  "url": "https://realestate.example.com/listing/789",
  "selectors": {
    "address": ".property-address",
    "price": ".listing-price",
    "bedrooms": ".bed-count",
    "bathrooms": ".bath-count",
    "sqft": ".square-footage",
    "description": ".property-description",
    "photos": ".gallery img",
    "agent": ".agent-info"
  },
  "options": {
    "screenshot": true
  }
}
```

### 4. Job Postings

```javascript
{
  "url": "https://jobs.example.com/posting/321",
  "selectors": {
    "title": "h1.job-title",
    "company": ".company-name",
    "location": ".job-location",
    "salary": ".salary-range",
    "description": ".job-description",
    "requirements": ".requirements li",
    "benefits": ".benefits li"
  }
}
```

## Selector Tips

### Single Element
```javascript
"title": "h1.product-title"
// Returns: { text: "...", html: "...", attributes: {...} }
```

### Multiple Elements
```javascript
"images": "img.gallery"
// Returns: [
//   { text: "", html: "...", attributes: { src: "..." } },
//   { text: "", html: "...", attributes: { src: "..." } }
// ]
```

### Nested Content
```javascript
"specs": ".specifications li"
// Returns array of all <li> elements under .specifications
```

### Attributes
All elements return their attributes:
```javascript
{
  text: "Click here",
  html: "<a href='/page'>Click here</a>",
  attributes: {
    href: "/page",
    class: "link",
    "data-id": "123"
  }
}
```

## Error Handling

### Selector Not Found
```javascript
{
  "price": null  // Element doesn't exist
}
```

### Extraction Failed
```javascript
{
  "price": {
    error: "Failed to extract: Element removed during extraction"
  }
}
```

### Network Error
```javascript
{
  strategy: "FULL_HTML",
  url: "https://example.com",
  statusCode: 500,
  errorMessage: "Navigation timeout of 30000 ms exceeded"
}
```

## Testing Locally

### 1. Start API Server
```bash
cd apps/api/general
npm run start:dev
```

### 2. Submit Test Request
```bash
curl -X POST http://localhost:3000/api/process/submit \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [{
      "url": "https://example.com",
      "selectors": {
        "heading": "h1",
        "paragraphs": "p"
      }
    }]
  }' | jq
```

### 3. Check Process Status
```bash
PROCESS_ID="uuid-from-step-2"
curl http://localhost:3000/api/process/query/$PROCESS_ID | jq
```

### 4. Watch Progress
```bash
# Poll every 2 seconds
watch -n 2 "curl -s http://localhost:3000/api/process/query/$PROCESS_ID | jq '.progress'"
```

## Performance Tips

1. **Batch URLs:** Submit multiple URLs in one request
2. **Timeout:** Adjust timeout based on page complexity
3. **Network Idle:** Disable for simple static pages
4. **Selectors:** Be specific to reduce extraction time
5. **Screenshots:** Only enable when needed (adds overhead)

## Monitoring

### Check Queue Status
```bash
aws sqs get-queue-attributes \
  --queue-url $SQS_QUEUE_URL \
  --attribute-names ApproximateNumberOfMessages
```

### Check Lambda Logs
```bash
aws logs tail /aws/lambda/crawler-function --follow
```

### Check SNS Messages
```bash
aws sns list-subscriptions-by-topic \
  --topic-arn $SNS_TOPIC_ARN
```

## Common Issues

### Issue: Process stuck in IN_PROGRESS

**Solution:** Check SNS subscription and Lambda execution

```bash
# Check Lambda errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/crawler-function \
  --filter-pattern "ERROR"

# Check dead letter queue
aws sqs receive-message \
  --queue-url $DLQ_URL \
  --max-number-of-messages 10
```

### Issue: TEMPLATE never triggered

**Cause:** No selectors provided or FULL_HTML failed

**Solution:** Verify selectors exist and FULL_HTML succeeded
```bash
# Check database
SELECT * FROM crawl_results 
WHERE url_id = 'uuid' 
ORDER BY created_at;
```

### Issue: Cleaned HTML empty

**Cause:** Page content is JavaScript-rendered

**Solution:** Enable waitForNetworkIdle or add waitForSelector
```javascript
{
  "url": "...",
  "options": {
    "waitForNetworkIdle": true,
    "waitForSelector": ".content-loaded",
    "timeout": 60000
  }
}
```

## Next Steps

1. **Read Full Documentation:** [STRATEGY_BASED_CRAWLING.md](./STRATEGY_BASED_CRAWLING.md)
2. **API Reference:** [API_REFERENCE.md](./API_REFERENCE.md)
3. **AWS Deployment:** [AWS_DEPLOYMENT_GUIDE.md](./AWS_DEPLOYMENT_GUIDE.md)
4. **Process Architecture:** [PROCESS_BASED_ARCHITECTURE.md](./PROCESS_BASED_ARCHITECTURE.md)

## Support

For issues or questions:
1. Check CloudWatch logs
2. Verify SQS/SNS configuration
3. Review database entries
4. Check environment variables
