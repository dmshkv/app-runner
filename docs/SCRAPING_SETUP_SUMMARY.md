# Scraping System Setup Summary

## ✅ What Was Created

### 1. Database Schema (`migrations/003_add_scraping_system.sql`)

**6 Main Tables**:
- ✅ `site_configs` - Site configuration per domain
- ✅ `llm_recipes` - Learned selectors (versioned, separate table)
- ✅ `crawl_runs` - Crawl execution tracking with **LLM cost analysis**
- ✅ `page_tasks` - Queue-based task management (state machine)
- ✅ `products` - Generic product storage with extensible `attributes` JSONB
- ✅ `llm_usage_logs` - Detailed LLM interaction logs

**Key Features**:
- ✅ **Cost Tracking**: Every crawl tracks LLM requests by type (classification, extraction, recipe_generation)
- ✅ **Generic Product Model**: Common fields + extensible `attributes` JSONB for product-specific data
- ✅ **Recipe System**: Separate table for learned selectors with versioning
- ✅ **Deduplication**: Per crawl run via `url_hash` in `page_tasks`
- ✅ **Indexes**: Optimized queries with GIN index on JSONB `attributes`
- ✅ **Views**: `v_active_crawl_runs`, `v_product_summary`, `v_queue_status`
- ✅ **Seed Data**: Example configs for Kijiji (automotive) and CBC (generic)

### 2. TypeORM Entities (`apps/api/process/src/core/entities/`)

- ✅ `site-config.entity.ts` - SiteConfig with relations
- ✅ `llm-recipe.entity.ts` - LlmRecipe with versioning
- ✅ `crawl-run.entity.ts` - CrawlRun with LLM cost fields
- ✅ `page-task.entity.ts` - PageTask with status enum
- ✅ `product.entity.ts` - Product with generic structure
- ✅ `llm-usage-log.entity.ts` - LlmUsageLog with request types
- ✅ `index.ts` - Export barrel

### 3. TypeScript Interfaces (`apps/api/process/src/core/interfaces/scraping.interface.ts`)

**Comprehensive type definitions**:
- ✅ Entity interfaces (ISiteConfig, ICrawlRun, IPageTask, etc.)
- ✅ Enums (CrawlRunStatus, PageTaskStatus, PageType, LlmRequestType)
- ✅ LLM response contracts (ILlmPageAnalysisResponse, IProductCandidate, ILinkInstruction)
- ✅ Queue job interfaces (IPageFetchJob, IPageAnalyzeJob)
- ✅ DTOs (ICreateCrawlRunDto, ICreateSiteConfigDto, etc.)
- ✅ AWS message interfaces (ISqsCrawlCommand, ISqsCrawlResult, ISnsNotification)
- ✅ Product-specific attribute interfaces (IAutomotiveAttributes, IGroceryAttributes)

### 4. Initialization Script (`scripts/init-db.sh`)

**Features**:
- ✅ Starts PostgreSQL in Docker (or uses existing container)
- ✅ Waits for database to be ready
- ✅ Runs all migrations in order
- ✅ Color-coded output
- ✅ Error handling
- ✅ Usage instructions
- ✅ Made executable (`chmod +x`)

### 5. Documentation (`docs/SCRAPING_ARCHITECTURE.md`)

**Complete architecture guide**:
- ✅ Overview of all components
- ✅ Data model explanations
- ✅ Crawl flow (step-by-step state machine)
- ✅ Connection diagrams (Process Service ↔ DataExtractor)
- ✅ Cost tracking & ROI analysis
- ✅ Product type extensibility examples
- ✅ Views & analytics usage
- ✅ Environment variable setup
- ✅ Next steps

---

## 🎯 Key Design Decisions (Per Your Requirements)

### ✅ Database Schema
**Decision**: Use existing database with migrations  
**Implementation**: Created `003_add_scraping_system.sql` that extends current schema

### ✅ Product Type Flexibility
**Decision**: Generic structure with extensible attributes  
**Implementation**: 
- Common fields for all products (title, price, description, location)
- `attributes` JSONB field for product-specific data
- `product_schema` in `site_configs` to guide extraction
- Examples: automotive (year, make, model) vs grocery (brand, size, organic)

### ✅ LLM Cost Tracking in CrawlRun
**Decision**: Track LLM requests by type to calculate cost per product  
**Implementation**:
```sql
llm_requests_classification INTEGER
llm_requests_extraction INTEGER
llm_requests_recipe_generation INTEGER
llm_total_tokens INTEGER
llm_total_cost DECIMAL
```
**Enables**: "For this crawl we asked ChatGPT 20 times for selectors + 16 for products, got 27 verified catches → $X per catch"

### ✅ LLM Recipe Storage
**Decision**: Separate table for versioning and performance tracking  
**Implementation**: `llm_recipes` table with:
- `version` number
- `is_active` flag
- `success_count` / `failure_count`
- Selectors for listing and product pages
- Relation to multiple `crawl_runs`

### ✅ Queue Implementation
**Decision**: PostgreSQL table for local dev + AWS SQS/SNS for production  
**Implementation**:
- `page_tasks` table acts as queue (status: queued → processing → completed)
- Interfaces for AWS SQS messages (`ISqsCrawlCommand`, `ISqsCrawlResult`)
- Both approaches supported in architecture

### ✅ Deduplication Strategy
**Decision**: Per crawl run only  
**Implementation**:
- `url_hash` in `page_tasks` with index on `(crawl_run_id, url_hash)`
- Check exists before creating new task within same crawl run

### ✅ Service Integration
**Decision**: Use existing `apps/api/process` project  
**Implementation**: All entities, interfaces, and logic placed in process service structure

---

## 🚀 Next Steps

### 1. Initialize Database

```bash
# Start PostgreSQL and run migrations
./scripts/init-db.sh

# Verify tables were created
docker exec -it postgres-app-runner psql -U username -d app_runner -c "\dt"
```

### 2. Update Environment Variables

Edit `apps/api/process/.env`:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/app_runner
```

### 3. Implement Services (Future Work)

These need to be created:
- [ ] `SiteConfigService` - CRUD for site configurations
- [ ] `CrawlService` - Start/stop/monitor crawl runs
- [ ] `PageTaskService` - Queue management
- [ ] `ProductService` - Product storage and retrieval
- [ ] `LlmService` - LLM interaction and cost tracking
- [ ] `RecipeService` - Learn and manage recipes

### 4. Connect to DataExtractor

The DataExtractor already exists in `apps/crawler/dataextractor`. Integration points:
- Process Service sends crawl commands via SQS
- DataExtractor fetches pages and returns HTML
- Process Service analyzes HTML and creates products

---

## 📊 Verification Queries

After running `init-db.sh`, verify the setup:

```sql
-- Check all tables exist
\dt

-- View site configurations
SELECT * FROM site_configs;

-- Check views
SELECT * FROM v_active_crawl_runs;
SELECT * FROM v_product_summary;
SELECT * FROM v_queue_status;

-- Verify indexes
\di

-- Check triggers
\dy
```

---

## 🔗 File Locations

```
migrations/
  003_add_scraping_system.sql ← Database schema

apps/api/process/src/core/
  entities/
    site-config.entity.ts
    llm-recipe.entity.ts
    crawl-run.entity.ts
    page-task.entity.ts
    product.entity.ts
    llm-usage-log.entity.ts
    index.ts
  interfaces/
    scraping.interface.ts
    index.ts

scripts/
  init-db.sh ← Database initialization

docs/
  SCRAPING_ARCHITECTURE.md ← Complete architecture guide
```

---

## ✨ Highlights

**What makes this system powerful**:

1. **Cost-Aware**: Every LLM call is tracked and attributed to crawl runs and products
2. **Learning System**: Recipes improve over time, reducing LLM dependency
3. **Generic**: Works for cars, groceries, or any product with extensible attributes
4. **State Machine**: Clear task lifecycle (queued → processing → completed)
5. **Scalable**: Queue-based architecture works locally or in cloud
6. **Auditable**: Complete history in `llm_usage_logs`
7. **Production-Ready**: Indexes, triggers, views, error handling

**ROI Tracking Example**:
```
Crawl Run #5 for kijiji.ca:
- 47 pages visited
- 23 products found
- 12 LLM classification calls
- 11 LLM extraction calls (recipe failed 11 times)
- 0 LLM recipe generation calls (using existing recipe v2)
- Total cost: $0.34
- Cost per product: $0.015
```

---

## 🎉 Status

All foundational data structures are **complete and ready**!

Next phase: Implement business logic services.
