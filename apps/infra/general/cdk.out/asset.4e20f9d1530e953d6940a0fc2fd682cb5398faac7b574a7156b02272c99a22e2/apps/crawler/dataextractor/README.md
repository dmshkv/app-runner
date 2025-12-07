# Crawler Data Extractor

AWS Lambda-based web crawler using Puppeteer and Chromium for serverless data extraction.

## Architecture

- **Trigger**: EventBridge events or direct Lambda invocation
- **Runtime**: Node.js 20 on AWS Lambda (Docker container)
- **Browser**: Chromium via @sparticuz/chromium
- **Memory**: 2048 MB (Chromium requires significant memory)
- **Timeout**: 5 minutes

## Local Development

### Install Dependencies
```bash
npm install
```

### Build Application
```bash
npx nx build dataextractor
```

### Local Testing

**Test with mock HTML (recommended):**
```bash
node apps/crawler/dataextractor/src/test-with-mock.js
```

**Test with real URL:**
```bash
node apps/crawler/dataextractor/src/simple-local-test.js "https://www.google.com"
```

Note: Local testing uses full `puppeteer` (includes Chrome). The Lambda deployment uses `@sparticuz/chromium` (optimized for AWS Lambda).

## Deployment

### Deploy to AWS
```bash
./scripts/aws/cdk-deploy-crawler.sh dev
```

### Test Lambda Function Directly
```bash
./scripts/aws/test-crawler.sh "https://example.com" dev
```

### Trigger via EventBridge
```bash
./scripts/aws/trigger-crawler.sh "https://example.com" dev
```

## Usage

### EventBridge Event Format

**Basic: Extract full HTML**
```json
{
  "source": "custom.crawler",
  "detail-type": "CrawlRequest",
  "detail": {
    "url": "https://example.com",
    "timeout": 30000
  }
}
```

**Advanced: Extract specific selectors (JS fully loaded)**
```json
{
  "source": "custom.crawler",
  "detail-type": "CrawlRequest",
  "detail": {
    "url": "https://example.com/product",
    "waitForNetworkIdle": true,
    "selectors": {
      "title": "h1.product-title",
      "price": ".price",
      "features": ".features li",
      "reviews": ".review"
    },
    "extractFullHtml": false,
    "screenshot": true
  }
}
```

### Direct Lambda Invocation
```bash
aws lambda invoke \
  --function-name crawler-dataextractor-dev \
  --payload '{"url": "https://example.com"}' \
  response.json
```

### Response Format

**With selectors:**
```json
{
  "statusCode": 200,
  "body": {
    "url": "https://example.com/product",
    "title": "Amazing Laptop",
    "extracted": {
      "title": {
        "text": "Amazing Laptop",
        "html": "Amazing Laptop",
        "attributes": { "class": "product-title" }
      },
      "price": {
        "text": "$1,299.99",
        "html": "$1,299.99",
        "attributes": { "class": "price", "data-currency": "USD" }
      },
      "features": [
        { "text": "16GB RAM", "html": "16GB RAM", "attributes": {} },
        { "text": "512GB SSD", "html": "512GB SSD", "attributes": {} }
      ]
    },
    "screenshot": "base64_encoded_png...",
    "screenshotSize": 52341,
    "timestamp": "2025-11-30T12:00:00.000Z"
  }
}
```

**With full HTML:**
```json
{
  "statusCode": 200,
  "body": {
    "url": "https://example.com",
    "title": "Example Domain",
    "html": "<!doctype html>...",
    "htmlLength": 1256,
    "timestamp": "2025-11-30T12:00:00.000Z"
  }
}
```

## Configuration

### Event Parameters
- `url` (required): URL to crawl
- `waitForSelector` (optional): CSS selector to wait for before extracting
- `timeout` (optional): Timeout in milliseconds (default: 30000)
- `selectors` (optional): Object mapping keys to CSS selectors to extract
  - Single element: Returns object with `text`, `html`, `attributes`
  - Multiple elements: Returns array of objects
- `extractFullHtml` (optional): Extract full page HTML (default: true)
- `screenshot` (optional): Take screenshot and return as base64 (default: false)
- `waitForNetworkIdle` (optional): Wait for all network requests to complete (default: true)

### Selector Extraction Features
- ✅ **JavaScript Support**: Waits for `networkidle0` by default (all JS executed)
- ✅ **Single Elements**: Extract one element with text, HTML, and attributes
- ✅ **Multiple Elements**: Extract arrays of elements matching a selector
- ✅ **Nested Data**: Use complex selectors to extract structured data
- ✅ **Attributes**: Automatically extracts all HTML attributes (class, id, data-*, etc.)
- ✅ **Dynamic Content**: Waits for JavaScript-rendered content to load

### Example Selectors
```javascript
{
  "productTitle": "h1.product-name",
  "price": ".price-value",
  "images": "img.product-image",      // Returns array
  "description": "#description",
  "reviews": ".review-item",           // Returns array
  "rating": "[data-rating]"            // Extracts data-rating attribute
}
```

## Monitoring

### View Logs
```bash
aws logs tail /aws/lambda/crawler-dataextractor-dev --follow
```

### CloudWatch Metrics
- Function invocations
- Duration
- Errors
- Throttles

## Development Notes

- Uses `@sparticuz/chromium` - pre-built Chromium binary optimized for Lambda
- Container image deployment (easier dependency management)
- Chromium args optimized for serverless environments
- No persistent browser state (new browser per invocation)
