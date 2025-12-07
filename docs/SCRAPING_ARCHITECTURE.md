# Scraping System Architecture

## Overview

This document describes the **LLM-Assisted Web Scraping System** - a production-ready architecture for intelligent, scalable web scraping with cost tracking and learned optimization.

**Key Principle**: Think of this as **(1) a queue + state machine**, **(2) a "site recipe" per domain**, and **(3) an LLM that helps you discover and execute those recipes** - NOT as "LLM randomly clicking around".

---

## Architecture Components

### 1. Process Service (NestJS Orchestrator)
- **Location**: `apps/api/process`
- **Responsibilities**:
  - Manages crawl runs and site configurations
  - Orchestrates page fetching and analysis
  - Tracks LLM usage and costs
  - Stores products and manages deduplication
  - Connects to both local PostgreSQL and AWS SQS/SNS

### 2. DataExtractor Service (Puppeteer Worker)
- **Location**: `apps/crawler/dataextractor`
- **Responsibilities**:
  - Long-running Lambda/worker that fetches pages
  - Receives "visit this URL" jobs from SQS
  - Opens pages (incognito, headless)
  - Returns HTML snapshots to Process Service
  - Can run locally or in AWS Lambda

### 3. PostgreSQL Database
- **Local**: Docker container on port 5432
- **Production**: AWS RDS or similar
- **Schema**: All tables defined in `migrations/003_add_scraping_system.sql`

### 4. AWS Infrastructure
- **SQS Queues**: 
  - `crawler-commands-dev`: Process → DataExtractor (fetch requests)
  - `crawler-results-dev`: DataExtractor → Process (fetch results)
- **SNS Topics**: Optional notifications for events
- **Lambda**: DataExtractor deployed as Lambda function

---

## Data Model

### Core Tables

#### 1. `site_configs`
Configuration per domain/site to crawl.

**Key Fields**:
- `domain`: Unique site identifier (e.g., 'kijiji.ca')
- `seeds`: Starting URLs
- `product_type`: 'automotive', 'grocery', 'generic', etc.
- `product_schema`: JSON schema defining expected product attributes
- `allowed_path_patterns`: Regex patterns for crawlable paths
- `throttle_ms`: Rate limiting
- `max_depth`, `max_pages_per_run`: Stop conditions

**Purpose**: One record per site you want to scrape. Defines HOW to scrape it.

#### 2. `llm_recipes`
Learned selectors and patterns for efficient scraping (separate table for versioning).

**Key Fields**:
- `site_config_id`: Which site this recipe is for
- `version`: Recipe version number
- `listing_selectors`: CSS selectors for product links, pagination
- `product_selectors`: CSS selectors for title, price, attributes
- `page_classification_rules`: Rules to identify page types
- `success_count`, `failure_count`: Performance tracking

**Purpose**: Store what the LLM learned about a site's structure. Try recipe-based extraction first (fast, cheap), fall back to LLM if it fails.

#### 3. `crawl_runs`
Individual crawl execution tracking with LLM cost analysis.

**Key Fields**:
- `site_config_id`: Which site was crawled
- `run_number`: Sequential number per site
- `status`: 'running', 'completed', 'failed', 'stopped', 'timeout'
- `pages_visited`, `pages_queued`, `products_found`: Progress metrics
- **LLM Cost Tracking**:
  - `llm_requests_classification`: LLM calls for page type detection
  - `llm_requests_extraction`: LLM calls for data extraction
  - `llm_requests_recipe_generation`: LLM calls for learning selectors
  - `llm_total_tokens`: Total tokens consumed
  - `llm_total_cost`: Estimated cost in dollars
- `llm_recipe_id`: Which recipe was used
- `recipe_fallback_count`: Times fell back to LLM when recipe failed

**Purpose**: One record per crawl execution. Track progress, costs, and ROI (cost per product found).

#### 4. `page_tasks`
Queue-based page fetch and analysis tasks (state machine).

**Key Fields**:
- `crawl_run_id`: Which crawl run this belongs to
- `url`, `url_hash`: URL to fetch (hash for deduplication)
- `status`: 'queued' → 'processing' → 'completed'/'failed'
- `depth`: Distance from seed URL
- `page_type`: 'product', 'listing', 'pagination', 'other'
- `parent_task_id`: Navigation tracking
- `llm_requests`, `llm_tokens`: LLM usage for this specific page

**Purpose**: Queue of work. Each page visit is a task. State machine tracks progress.

#### 5. `products`
Generic product/catch data with extensible attributes.

**Key Fields**:
- `crawl_run_id`, `site_config_id`: Source tracking
- `title`, `description`, `price`, `currency`: Common fields
- `product_type`: 'automotive', 'grocery', etc.
- `attributes`: JSONB for product-specific fields (year, make, model, etc.)
- **Quality Tracking**:
  - `extraction_method`: 'recipe', 'llm', 'hybrid'
  - `extraction_confidence`: 0.00 to 1.00
  - `is_verified`, `verification_status`: Manual verification
  - `quality_score`: Data quality metric
- **Deduplication**:
  - `content_hash`: Hash of key fields
  - `is_duplicate`, `duplicate_of_id`: Duplicate detection

**Purpose**: Store extracted products. Generic structure with extensible `attributes` JSONB field.

#### 6. `llm_usage_logs`
Detailed LLM interaction logs for cost tracking and debugging.

**Key Fields**:
- `crawl_run_id`, `page_task_id`: Context
- `request_type`: 'classification', 'extraction', 'recipe_generation', 'link_discovery'
- `model`: 'gpt-4', 'gpt-3.5-turbo', etc.
- `prompt_tokens`, `completion_tokens`, `total_tokens`: Token usage
- `estimated_cost`: Cost in dollars
- `was_successful`, `error_message`: Success tracking

**Purpose**: Audit trail for every LLM call. Debug failures, optimize costs.

---

## The Crawl Flow (State Machine)

### Step 1: Seed
```typescript
// User initiates crawl
const crawlRun = await createCrawlRun({ siteConfigId: 'uuid' });

// System creates initial page tasks from seeds
for (const seed of siteConfig.seeds) {
  await createPageTask({
    crawlRunId: crawlRun.id,
    url: seed,
    depth: 0,
    status: 'queued'
  });
}
```

### Step 2: Fetch (Puppeteer Worker)
```typescript
// Worker picks queued task
const task = await getNextQueuedTask();

// Send to DataExtractor via SQS
await sqs.send('crawler-commands-dev', {
  command: 'CRAWL',
  url: task.url,
  pageTaskId: task.id
});

// DataExtractor opens page, returns HTML
const result = await receiveFromSQS('crawler-results-dev');
```

### Step 3: Analyze with LLM
```typescript
// Try recipe-based extraction first
if (siteConfig.llmRecipe) {
  try {
    const products = extractWithSelectors(html, recipe.productSelectors);
    const links = extractWithSelectors(html, recipe.listingSelectors);
    // Success! Fast and cheap.
  } catch (error) {
    // Recipe failed, fall back to LLM
    crawlRun.recipeFallbackCount++;
  }
}

// Fall back to LLM
const llmResponse = await callLLM({
  prompt: `Analyze this page: ${html}`,
  schema: siteConfig.productSchema
});

// Log LLM usage
await logLlmUsage({
  crawlRunId,
  pageTaskId,
  requestType: 'extraction',
  tokens: llmResponse.tokens,
  cost: llmResponse.cost
});
```

### Step 4: Persist Results
```typescript
// Save products
for (const product of llmResponse.products) {
  await createProduct({
    crawlRunId,
    siteConfigId,
    pageTaskId,
    ...product,
    extractionMethod: usedRecipe ? 'recipe' : 'llm'
  });
}

// Create new page tasks from discovered links
for (const link of llmResponse.nextLinks) {
  const normalizedUrl = normalizeUrl(link.href);
  
  // Check deduplication (within this crawl run)
  const exists = await pageTaskExists(crawlRunId, normalizedUrl);
  if (exists) continue;
  
  // Check depth and patterns
  if (depth + 1 <= maxDepth && matchesPatterns(normalizedUrl)) {
    await createPageTask({
      crawlRunId,
      url: normalizedUrl,
      depth: depth + 1,
      parentTaskId: pageTaskId,
      status: 'queued'
    });
  }
}
```

### Step 5: Stop Conditions
```typescript
// Check stop conditions
if (crawlRun.pagesVisited >= siteConfig.maxPagesPerRun) {
  await completeCrawlRun(crawlRunId, 'max_pages');
}

const queuedTasks = await countPageTasks(crawlRunId, 'queued');
if (queuedTasks === 0) {
  await completeCrawlRun(crawlRunId, 'no_more_tasks');
}
```

---

## Connection to Existing Infrastructure

### Local Development

```bash
# 1. Start PostgreSQL
./scripts/init-db.sh

# 2. Start Process Service
cd apps/api/process
npm install
npm run start:dev

# 3. Start DataExtractor (in separate terminal)
cd apps/crawler/dataextractor
npm install
npm run start:dev

# 4. Trigger a crawl
curl -X POST http://localhost:3000/crawl/start \
  -H "Content-Type: application/json" \
  -d '{"siteConfigId": "uuid", "maxPages": 50}'
```

### AWS Deployment

Process Service connects to:
- **PostgreSQL**: AWS RDS or Aurora
- **SQS**: For sending crawl commands
- **SNS**: For receiving results (or polling SQS)

DataExtractor (Lambda) connects to:
- **SQS**: Receives crawl commands
- **SNS**: Publishes results

```
┌──────────────────┐
│  Process Service │
│    (NestJS)      │
└────────┬─────────┘
         │
         ├─── PostgreSQL (RDS)
         │
         ├─── SQS (crawler-commands-dev)
         │       │
         │       ▼
         │   ┌──────────────────┐
         │   │  DataExtractor   │
         │   │   (Lambda)       │
         │   └────────┬─────────┘
         │            │
         └─── SQS (crawler-results-dev) ◄──┘
```

---

## Cost Tracking & ROI

Every crawl run tracks:
- **Total LLM requests** by type (classification, extraction, recipe generation)
- **Total tokens** consumed
- **Estimated cost** in dollars
- **Products found**
- **Cost per product** = `llmTotalCost / productsFound`

Example query:
```sql
SELECT 
  sc.domain,
  cr.run_number,
  cr.products_found,
  cr.llm_total_cost,
  ROUND(cr.llm_total_cost / NULLIF(cr.products_found, 0), 4) as cost_per_product,
  cr.llm_requests_classification + cr.llm_requests_extraction as total_llm_calls
FROM crawl_runs cr
JOIN site_configs sc ON cr.site_config_id = sc.id
WHERE cr.status = 'completed'
ORDER BY cost_per_product DESC;
```

**Goal**: Drive cost per product down over time by:
1. Learning good recipes (fewer LLM calls)
2. Optimizing prompts
3. Using cheaper models for classification

---

## Product Type Extensibility

The system is **generic by design**:

### Common Fields (All Products)
- `title`, `description`, `price`, `currency`
- `category`, `subcategory`
- `city`, `province`, `country`

### Product-Specific Fields (JSONB `attributes`)

**Automotive**:
```json
{
  "year": 2020,
  "make": "Honda",
  "model": "Accord",
  "mileage": 45000,
  "mileage_unit": "km",
  "condition": "used",
  "transmission": "automatic",
  "fuel_type": "gasoline",
  "vin": "1HGBH41JXMN109186"
}
```

**Grocery**:
```json
{
  "brand": "Campbell's",
  "size": "284ml",
  "unit": "can",
  "quantity": 12,
  "is_organic": false
}
```

**Define product schema** in `site_configs.product_schema` to guide LLM extraction.

---

## Views & Analytics

The migration creates helpful views:

### `v_active_crawl_runs`
Live dashboard of running/recent crawls.

```sql
SELECT * FROM v_active_crawl_runs 
WHERE status = 'running';
```

### `v_product_summary`
Aggregate product statistics by site.

```sql
SELECT * FROM v_product_summary 
WHERE product_type = 'automotive'
ORDER BY last_crawled DESC;
```

### `v_queue_status`
Real-time queue status.

```sql
SELECT * FROM v_queue_status;
```

---

## Next Steps

1. **Initialize Database**:
   ```bash
   ./scripts/init-db.sh
   ```

2. **Create Site Configuration**:
   ```typescript
   const kijijiConfig = await siteConfigService.create({
     domain: 'kijiji.ca',
     name: 'Kijiji Autos',
     productType: 'automotive',
     seeds: ['https://www.kijiji.ca/b-cars-vehicles/canada/c27l0'],
     // ... other config
   });
   ```

3. **Start a Crawl**:
   ```typescript
   const crawlRun = await crawlService.startCrawl(kijijiConfig.id);
   ```

4. **Monitor Progress**:
   ```typescript
   const stats = await crawlService.getStats(crawlRun.id);
   console.log(`Products found: ${stats.productsFound}`);
   console.log(`Cost so far: $${stats.llmTotalCost}`);
   ```

5. **Review Products**:
   ```typescript
   const products = await productService.findByCrawlRun(crawlRun.id);
   ```

---

## Environment Variables

Update `apps/api/process/.env`:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/app_runner
DB_SSL=false

# AWS
AWS_REGION=ca-central-1
AWS_PROFILE=default

# SQS
SQS_CRAWL_QUEUE_URL=https://sqs.ca-central-1.amazonaws.com/.../crawler-commands-dev
SQS_RESULTS_QUEUE_URL=https://sqs.ca-central-1.amazonaws.com/.../crawler-results-dev

# OpenAI (for LLM)
OPENAI_API_KEY=sk-...

# Application
PORT=3000
NODE_ENV=development
```

---

## Files Created

### Database
- `migrations/003_add_scraping_system.sql` - Complete schema with tables, indexes, triggers, views

### Entities (TypeORM)
- `apps/api/process/src/core/entities/site-config.entity.ts`
- `apps/api/process/src/core/entities/llm-recipe.entity.ts`
- `apps/api/process/src/core/entities/crawl-run.entity.ts`
- `apps/api/process/src/core/entities/page-task.entity.ts`
- `apps/api/process/src/core/entities/product.entity.ts`
- `apps/api/process/src/core/entities/llm-usage-log.entity.ts`
- `apps/api/process/src/core/entities/index.ts` - Export barrel

### Interfaces
- `apps/api/process/src/core/interfaces/scraping.interface.ts` - All TypeScript interfaces
- `apps/api/process/src/core/interfaces/index.ts` - Export barrel

### Scripts
- `scripts/init-db.sh` - Initialize PostgreSQL and run migrations

---

## Summary

You now have:

✅ **Complete database schema** with tables, indexes, triggers, and views  
✅ **TypeORM entities** for all tables  
✅ **TypeScript interfaces** for type safety  
✅ **Cost tracking** at every level (per page, per run, per site)  
✅ **Generic product model** with extensible attributes  
✅ **Recipe system** for learned optimization  
✅ **Integration points** for Process Service ↔ DataExtractor via SQS/SNS  
✅ **Local development setup** with Docker PostgreSQL  

**Next**: Implement the services (SiteConfigService, CrawlService, etc.) to bring this architecture to life!
