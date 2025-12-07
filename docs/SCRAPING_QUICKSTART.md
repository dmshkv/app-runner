# 🚀 Quick Start Guide - Scraping System

## Initialize Database (One Time)

```bash
# Start PostgreSQL and run migrations
./scripts/init-db.sh
```

## Verify Setup

```bash
# Check tables
docker exec -it postgres-app-runner psql -U username -d app_runner -c "\dt"

# View seed data
docker exec -it postgres-app-runner psql -U username -d app_runner -c "SELECT domain, name, product_type FROM site_configs;"
```

## Connection String

```
postgresql://username:password@localhost:5432/app_runner
```

Add to `apps/api/process/.env`:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/app_runner
```

## Key Tables Overview

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `site_configs` | Site configuration | domain, seeds, product_type, product_schema |
| `llm_recipes` | Learned selectors | version, listing_selectors, product_selectors |
| `crawl_runs` | Crawl execution | status, pages_visited, llm_requests_*, llm_total_cost |
| `page_tasks` | Queue items | url, status, depth, page_type |
| `products` | Extracted data | title, price, product_type, attributes (JSONB) |
| `llm_usage_logs` | LLM audit trail | request_type, tokens, cost |

## Cost Tracking Formula

```
Cost per Product = crawl_runs.llm_total_cost / crawl_runs.products_found
```

Query:
```sql
SELECT 
  domain,
  products_found,
  llm_total_cost,
  ROUND(llm_total_cost / NULLIF(products_found, 0), 4) as cost_per_product
FROM crawl_runs cr
JOIN site_configs sc ON cr.site_config_id = sc.id
WHERE status = 'completed'
ORDER BY cost_per_product;
```

## Useful Views

```sql
-- Active crawls
SELECT * FROM v_active_crawl_runs;

-- Product statistics
SELECT * FROM v_product_summary WHERE product_type = 'automotive';

-- Queue status
SELECT * FROM v_queue_status;
```

## Product Attributes Examples

### Automotive
```json
{
  "year": 2020,
  "make": "Honda",
  "model": "Accord",
  "mileage": 45000,
  "mileage_unit": "km",
  "transmission": "automatic",
  "vin": "1HGBH41JXMN109186"
}
```

### Grocery
```json
{
  "brand": "Campbell's",
  "size": "284ml",
  "unit": "can",
  "is_organic": false
}
```

## Next: Implement Services

Now you can build:
1. `SiteConfigService` - Manage site configs
2. `CrawlService` - Start/monitor crawls
3. `LlmService` - Interact with GPT, track costs
4. `ProductService` - Store/retrieve products
5. `RecipeService` - Learn/apply recipes

## Architecture Diagram

```
┌─────────────────────┐
│  NestJS Process     │
│  Service            │
│  ┌───────────────┐  │
│  │ SiteConfig    │  │
│  │ Service       │  │
│  └───────┬───────┘  │
│          │          │
│  ┌───────▼───────┐  │
│  │ Crawl         │  │
│  │ Service       │  │
│  └───────┬───────┘  │
│          │          │
│  ┌───────▼───────┐  │
│  │ PageTask      │  │      ┌─────────────┐
│  │ Service       ├──┼──────► SQS         │
│  └───────┬───────┘  │      │ (commands)  │
│          │          │      └──────┬──────┘
│  ┌───────▼───────┐  │             │
│  │ LLM           │  │             │
│  │ Service       │  │      ┌──────▼──────┐
│  └───────┬───────┘  │      │ DataExtract │
│          │          │      │ (Puppeteer) │
│  ┌───────▼───────┐  │      └──────┬──────┘
│  │ Product       │  │             │
│  │ Service       │  │      ┌──────▼──────┐
│  └───────────────┘  │      │ SQS         │
│                     │◄─────┤ (results)   │
└─────────┬───────────┘      └─────────────┘
          │
          ▼
    ┌─────────────┐
    │ PostgreSQL  │
    │ (Docker)    │
    └─────────────┘
```

## Documentation

- **Architecture**: `docs/SCRAPING_ARCHITECTURE.md`
- **Setup Summary**: `docs/SCRAPING_SETUP_SUMMARY.md`
- **This Guide**: `docs/SCRAPING_QUICKSTART.md`

## Database Management

```bash
# Stop PostgreSQL
docker stop postgres-app-runner

# Start PostgreSQL
docker start postgres-app-runner

# View logs
docker logs -f postgres-app-runner

# Connect to psql
docker exec -it postgres-app-runner psql -U username -d app_runner

# Backup database
docker exec postgres-app-runner pg_dump -U username app_runner > backup.sql

# Remove container (data persists in volume)
docker rm postgres-app-runner

# Remove data volume (⚠️  deletes all data)
docker volume rm postgres-app-runner-data
```

## Status: ✅ Ready to Build Services!

All foundational data structures are complete. Time to implement the business logic!
