# Web Crawler CLI - Quick Start Guide

## 🚀 Usage Examples

### 1. Extract Full HTML (Simple)
```bash
node apps/crawler/dataextractor/src/extract-cli.js "https://example.com"
```

### 2. Extract Specific Selectors
```bash
# Extract title and paragraph
node apps/crawler/dataextractor/src/extract-cli.js "https://example.com" \
  --selector title="h1" \
  --selector description="p" \
  --no-html
```

### 3. Extract Multiple Elements (Returns Array)
```bash
# Extract all list items
node apps/crawler/dataextractor/src/extract-cli.js "https://example.com" \
  --selector items="li" \
  --no-html
```

### 4. Complex Extraction with Screenshot
```bash
node apps/crawler/dataextractor/src/extract-cli.js "https://news.ycombinator.com" \
  --selector headlines=".titleline > a" \
  --selector points=".score" \
  --screenshot \
  --output hackernews.json
```

### 5. Wait for Dynamic Content
```bash
# Wait for JavaScript to load specific element
node apps/crawler/dataextractor/src/extract-cli.js "https://example.com" \
  --wait-for ".dynamic-content" \
  --selector data=".loaded-data" \
  --no-html
```

### 6. Product Scraping Example
```bash
node apps/crawler/dataextractor/src/extract-cli.js "https://www.npmjs.com/package/puppeteer" \
  --selector title="h2 > span" \
  --selector description="p" \
  --selector version=".typography__h1___1q9I_" \
  --no-html
```

## 📋 Command Options

| Option | Description | Example |
|--------|-------------|---------|
| `--selector key="selector"` | Extract element(s) with CSS selector | `--selector price=".price"` |
| `--wait-for "selector"` | Wait for element before extracting | `--wait-for ".loaded"` |
| `--screenshot` | Take a PNG screenshot | `--screenshot` |
| `--no-html` | Don't extract full HTML | `--no-html` |
| `--timeout <ms>` | Set timeout in milliseconds | `--timeout 60000` |
| `--no-wait-network` | Don't wait for network idle | `--no-wait-network` |
| `--output <file>` | Save to JSON file | `--output data.json` |

## 💡 Selector Tips

### Single Element
Returns an object with `text`, `html`, and `attributes`:
```bash
--selector title="h1.product-name"
```
Result:
```json
{
  "title": {
    "text": "Product Name",
    "html": "Product Name",
    "attributes": { "class": "product-name" }
  }
}
```

### Multiple Elements
Returns an array when selector matches multiple elements:
```bash
--selector items=".list-item"
```
Result:
```json
{
  "items": [
    { "text": "Item 1", "html": "Item 1", "attributes": {} },
    { "text": "Item 2", "html": "Item 2", "attributes": {} }
  ]
}
```

### Complex Selectors
Use any CSS selector:
```bash
--selector rating="[data-rating]"           # Attribute selector
--selector price=".price > span:first-child" # Child selector
--selector link="a[href*='product']"         # Attribute contains
```

## 🎯 Real-World Examples

### Scrape News Headlines
```bash
node apps/crawler/dataextractor/src/extract-cli.js "https://news.ycombinator.com" \
  --selector headlines=".titleline > a" \
  --selector scores=".score" \
  --no-html \
  --output hn-news.json
```

### Extract Product Info
```bash
node apps/crawler/dataextractor/src/extract-cli.js "https://www.amazon.com/product" \
  --selector title="#productTitle" \
  --selector price=".a-price-whole" \
  --selector images="#altImages img" \
  --wait-for "#productTitle" \
  --screenshot \
  --output product.json
```

### Monitor Prices
```bash
node apps/crawler/dataextractor/src/extract-cli.js "https://store.com/item" \
  --selector price=".price-value" \
  --selector stock=".availability" \
  --no-html \
  --output price-check.json
```

## 🔧 Advanced Usage

### Save Output to File
```bash
node apps/crawler/dataextractor/src/extract-cli.js "https://example.com" \
  --selector title="h1" \
  --output result.json

# View the result
cat result.json | jq .
```

### Extract Only What You Need
```bash
# Fast extraction without full HTML
node apps/crawler/dataextractor/src/extract-cli.js "https://example.com" \
  --selector title="h1" \
  --selector price=".price" \
  --no-html \
  --no-wait-network
```

### Debugging
```bash
# Get screenshot to see what the page looks like
node apps/crawler/dataextractor/src/extract-cli.js "https://example.com" \
  --screenshot \
  --output debug.json

# Then extract base64 screenshot
node -e "console.log(require('./debug.json').screenshot)" | base64 -d > screenshot.png
```
