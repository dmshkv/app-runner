# Project Structure - Data Extractor Crawler

## 📁 Directory Organization

```
apps/crawler/dataextractor/
├── src/
│   ├── lib/                      # Core libraries (modular architecture)
│   │   ├── browser.ts           # Browser launcher with stealth mode
│   │   ├── network.ts           # Network utilities & resource blocking
│   │   └── parser.ts            # HTML parsing & selector extraction
│   │
│   ├── utils/                    # Utility functions (future)
│   │
│   ├── main.ts                  # Original Lambda handler
│   ├── main-refactored.ts       # New modular Lambda handler
│   └── cli.js                   # CLI tool with stealth mode
│
├── __tests__/
│   ├── unit/                    # Unit tests (future)
│   ├── integration/             # Integration tests
│   │   ├── simple-local-test.js
│   │   ├── test-selectors.js
│   │   └── example-ecommerce.js
│   └── mocks/                   # Mock tests
│       └── test-with-mock.js
│
├── __fixtures__/                # Test data & sample pages
│   └── demo-page.html
│
├── __screenshots__/             # Screenshot outputs
│
├── Dockerfile                   # Lambda container image
├── project.json                 # Nx project config
├── README.md                    # Main documentation
└── CLI-EXAMPLES.md             # CLI usage examples
```

## 🏗️ Architecture

### Modular Components

**1. Browser (`lib/browser.ts`)**
- Launch stealth browser with anonymization
- Maximum bot detection prevention
- Puppeteer-extra with stealth plugin
- Custom user agent & headers

**2. Network (`lib/network.ts`)**
- Page navigation with retry logic
- Resource blocking for faster loading
- Network interception utilities

**3. Parser (`lib/parser.ts`)**
- CSS selector extraction
- HTML content extraction
- Screenshot capture
- Structured data extraction

### Entry Points

**Lambda Handler** (`main-refactored.ts`)
- AWS Lambda function
- EventBridge integration
- Uses modular lib/* components

**CLI Tool** (`cli.js`)
- Command-line interface
- Stealth mode enabled
- Fast mode for blocking resources
- Local testing & debugging

## 🔒 Anonymization Features

✅ **Stealth Plugin** - Prevents bot detection
✅ **Custom User Agent** - Realistic browser fingerprint
✅ **HTTP Headers** - Accept-Language, Referer, etc.
✅ **WebDriver Removal** - Hides automation traces
✅ **Chromium Flags** - 30+ anonymization flags
✅ **Fast Mode** - Blocks tracking/analytics

## 🚀 Usage

### CLI with Stealth Mode
```bash
node apps/crawler/dataextractor/src/cli.js "https://www.cbc.ca/news" \
  --selector headlines="h3" \
  --fast \
  --no-html
```

### Lambda Deployment
```bash
./scripts/aws/cdk-deploy-crawler.sh dev
```

## 📝 Next Steps for Decomposition

### Planned Modules

**`src/lib/`**
- ✅ `browser.ts` - Browser management
- ✅ `network.ts` - Network utilities
- ✅ `parser.ts` - HTML parsing
- 🔄 `storage.ts` - S3/DynamoDB integration
- 🔄 `queue.ts` - SQS queue management
- 🔄 `retry.ts` - Retry logic & error handling

**`src/utils/`**
- 🔄 `logger.ts` - Structured logging
- 🔄 `validator.ts` - Input validation
- 🔄 `formatter.ts` - Output formatting

**`src/services/`**
- 🔄 `crawler.service.ts` - Main crawler orchestration
- 🔄 `extraction.service.ts` - Data extraction logic
- 🔄 `screenshot.service.ts` - Screenshot management

## 🧪 Testing Strategy

- **Unit Tests** (`__tests__/unit/`) - Individual functions
- **Integration Tests** (`__tests__/integration/`) - Full workflows
- **Mocks** (`__tests__/mocks/`) - Mock HTML pages
- **Fixtures** (`__fixtures__/`) - Sample data
- **Screenshots** (`__screenshots__/`) - Visual outputs
