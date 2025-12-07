-- Migration: Add Strategy-Based Crawling Support
-- Version: 2.0.0
-- Date: 2024-01-15
-- Description: Adds support for multiple crawling strategies (FULL_HTML, TEMPLATE)

BEGIN;

-- 1. Add new columns to crawl_results table
ALTER TABLE crawl_results 
  ADD COLUMN IF NOT EXISTS status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS strategy VARCHAR(50),
  ADD COLUMN IF NOT EXISTS cleaned_html TEXT,
  ADD COLUMN IF NOT EXISTS cleaned_html_length INTEGER;

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_crawl_results_status 
  ON crawl_results(status);

CREATE INDEX IF NOT EXISTS idx_crawl_results_strategy 
  ON crawl_results(strategy);

CREATE INDEX IF NOT EXISTS idx_crawl_results_url_id_strategy 
  ON crawl_results(url_id, strategy);

-- 3. Update existing records to have default values
UPDATE crawl_results 
SET 
  status = 'COMPLETED',
  strategy = 'TEMPLATE'
WHERE status IS NULL;

-- 4. Add comments for documentation
COMMENT ON COLUMN crawl_results.status IS 'Current strategy status: FULL_HTML, TEMPLATE, or COMPLETED';
COMMENT ON COLUMN crawl_results.strategy IS 'Strategy used for this result: FULL_HTML or TEMPLATE';
COMMENT ON COLUMN crawl_results.cleaned_html IS 'Cleaned HTML from FULL_HTML strategy (scripts, styles removed)';
COMMENT ON COLUMN crawl_results.cleaned_html_length IS 'Length of cleaned HTML in characters';

-- 5. Verify changes
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'crawl_results'
  AND column_name IN ('status', 'strategy', 'cleaned_html', 'cleaned_html_length')
ORDER BY ordinal_position;

COMMIT;

-- Rollback script (if needed)
-- BEGIN;
-- DROP INDEX IF EXISTS idx_crawl_results_status;
-- DROP INDEX IF EXISTS idx_crawl_results_strategy;
-- DROP INDEX IF EXISTS idx_crawl_results_url_id_strategy;
-- ALTER TABLE crawl_results 
--   DROP COLUMN IF EXISTS status,
--   DROP COLUMN IF EXISTS strategy,
--   DROP COLUMN IF EXISTS cleaned_html,
--   DROP COLUMN IF EXISTS cleaned_html_length;
-- COMMIT;
