-- Migration: Add Scraping System Tables
-- Description: Creates tables for LLM-assisted web scraping with queue management
-- Date: 2025-12-06

-- ============================================================================
-- SITE CONFIGURATION TABLE
-- Stores configuration for each domain/site to be crawled
-- ============================================================================
CREATE TABLE IF NOT EXISTS site_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Site identification
    domain VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Crawl configuration
    seeds TEXT[] NOT NULL, -- Array of starting URLs
    allowed_path_patterns TEXT[] DEFAULT '{}', -- Regex patterns for allowed paths
    disallowed_path_patterns TEXT[] DEFAULT '{}', -- Regex patterns to avoid
    
    -- Rate limiting & politeness
    throttle_ms INTEGER DEFAULT 1000, -- Delay between requests in milliseconds
    max_depth INTEGER DEFAULT 3, -- Maximum depth to crawl
    max_pages_per_run INTEGER DEFAULT 100, -- Maximum pages per crawl run
    
    -- Product type configuration
    product_type VARCHAR(100) NOT NULL DEFAULT 'generic', -- 'automotive', 'grocery', 'generic', etc.
    product_schema JSONB, -- JSON schema defining product attributes for this site
    
    -- Status and metadata
    is_active BOOLEAN DEFAULT true,
    last_crawled_at TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_site_configs_domain ON site_configs(domain);
CREATE INDEX idx_site_configs_product_type ON site_configs(product_type);
CREATE INDEX idx_site_configs_active ON site_configs(is_active) WHERE is_active = true;

-- ============================================================================
-- LLM RECIPES TABLE
-- Stores learned selectors and patterns for sites (separate table for versioning)
-- ============================================================================
CREATE TABLE IF NOT EXISTS llm_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_config_id UUID NOT NULL REFERENCES site_configs(id) ON DELETE CASCADE,
    
    -- Recipe metadata
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00
    
    -- Listing page patterns
    listing_selectors JSONB, -- { product_link_selector, pagination_selector, filters, etc. }
    
    -- Product page patterns
    product_selectors JSONB, -- { title_selector, price_selector, attributes: {...} }
    
    -- Page classification rules
    page_classification_rules JSONB, -- Rules to identify page types
    
    -- Performance tracking
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP,
    
    -- Metadata
    learned_from_urls TEXT[], -- URLs used to learn this recipe
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(site_config_id, version)
);

CREATE INDEX idx_llm_recipes_site_config ON llm_recipes(site_config_id);
CREATE INDEX idx_llm_recipes_active ON llm_recipes(site_config_id, is_active) WHERE is_active = true;

-- ============================================================================
-- CRAWL RUNS TABLE
-- Tracks individual crawl executions
-- ============================================================================
CREATE TABLE IF NOT EXISTS crawl_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_config_id UUID NOT NULL REFERENCES site_configs(id) ON DELETE CASCADE,
    
    -- Run identification
    run_number INTEGER NOT NULL, -- Sequential number per site
    
    -- Status tracking
    status VARCHAR(50) NOT NULL DEFAULT 'running',
    -- Enum: 'running', 'completed', 'failed', 'stopped', 'timeout'
    
    -- Progress metrics
    pages_visited INTEGER DEFAULT 0,
    pages_queued INTEGER DEFAULT 0,
    products_found INTEGER DEFAULT 0,
    
    -- LLM usage tracking (cost analysis)
    llm_requests_classification INTEGER DEFAULT 0, -- LLM calls for page type classification
    llm_requests_extraction INTEGER DEFAULT 0, -- LLM calls for data extraction
    llm_requests_recipe_generation INTEGER DEFAULT 0, -- LLM calls for learning selectors
    llm_total_tokens INTEGER DEFAULT 0, -- Total tokens consumed
    llm_total_cost DECIMAL(10,4) DEFAULT 0, -- Estimated cost in dollars
    
    -- Recipe usage
    llm_recipe_id UUID REFERENCES llm_recipes(id),
    recipe_fallback_count INTEGER DEFAULT 0, -- Times fell back to LLM when recipe failed
    
    -- Timing
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    duration_seconds INTEGER, -- Calculated on completion
    
    -- Error tracking
    error_message TEXT,
    error_count INTEGER DEFAULT 0,
    
    -- Stop conditions
    stop_reason VARCHAR(100), -- 'max_pages', 'no_more_tasks', 'error', 'manual', 'timeout'
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(site_config_id, run_number)
);

CREATE INDEX idx_crawl_runs_site_config ON crawl_runs(site_config_id);
CREATE INDEX idx_crawl_runs_status ON crawl_runs(status);
CREATE INDEX idx_crawl_runs_started ON crawl_runs(started_at DESC);

-- ============================================================================
-- PAGE TASKS TABLE
-- Individual page fetch and analysis tasks (queue + state machine)
-- ============================================================================
CREATE TABLE IF NOT EXISTS page_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crawl_run_id UUID NOT NULL REFERENCES crawl_runs(id) ON DELETE CASCADE,
    
    -- URL information
    url TEXT NOT NULL,
    url_hash VARCHAR(64) NOT NULL, -- MD5 hash for deduplication
    normalized_url TEXT, -- Cleaned URL without tracking params
    
    -- Task state
    status VARCHAR(50) NOT NULL DEFAULT 'queued',
    -- Enum: 'queued', 'processing', 'completed', 'failed', 'skipped'
    
    depth INTEGER NOT NULL DEFAULT 0, -- Distance from seed URL
    
    -- Fetch results
    http_status INTEGER,
    final_url TEXT, -- After redirects
    fetch_duration_ms INTEGER,
    
    -- Page analysis
    page_type VARCHAR(50), -- 'product', 'listing', 'pagination', 'other', 'error'
    page_classification_method VARCHAR(50), -- 'recipe', 'llm', 'heuristic'
    
    -- LLM usage for this page
    llm_requests INTEGER DEFAULT 0,
    llm_tokens INTEGER DEFAULT 0,
    
    -- Error tracking
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- Queue management
    queued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Parent task (for tracking navigation)
    parent_task_id UUID REFERENCES page_tasks(id),
    discovered_from VARCHAR(50), -- 'seed', 'listing', 'pagination', 'related'
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_page_tasks_crawl_run ON page_tasks(crawl_run_id);
CREATE INDEX idx_page_tasks_status ON page_tasks(status);
CREATE INDEX idx_page_tasks_url_hash ON page_tasks(crawl_run_id, url_hash);
CREATE INDEX idx_page_tasks_queued ON page_tasks(status, queued_at) WHERE status = 'queued';
CREATE INDEX idx_page_tasks_page_type ON page_tasks(page_type);

-- ============================================================================
-- PRODUCTS TABLE
-- Generic product/catch data structure
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crawl_run_id UUID NOT NULL REFERENCES crawl_runs(id) ON DELETE CASCADE,
    site_config_id UUID NOT NULL REFERENCES site_configs(id) ON DELETE CASCADE,
    page_task_id UUID REFERENCES page_tasks(id) ON DELETE SET NULL,
    
    -- Source information
    url TEXT NOT NULL,
    external_id VARCHAR(255), -- Site's own ID/SKU (e.g., listing ID, VIN)
    
    -- Generic product fields (common across all product types)
    title TEXT NOT NULL,
    description TEXT,
    
    -- Pricing
    price DECIMAL(12,2),
    currency VARCHAR(10) DEFAULT 'CAD',
    price_qualifier VARCHAR(50), -- 'exact', 'starting_at', 'range', 'contact_for_price'
    original_price DECIMAL(12,2), -- For sales/discounts
    
    -- Categorization
    product_type VARCHAR(100) NOT NULL, -- 'automotive', 'grocery', etc.
    category VARCHAR(255),
    subcategory VARCHAR(255),
    
    -- Location
    city VARCHAR(255),
    province VARCHAR(255),
    country VARCHAR(10) DEFAULT 'CA',
    postal_code VARCHAR(20),
    
    -- Generic attributes (extensible)
    attributes JSONB DEFAULT '{}', -- Product-specific fields (year, make, model, mileage, etc.)
    
    -- Images and media
    images TEXT[], -- Array of image URLs
    primary_image_url TEXT,
    
    -- Extraction metadata
    extraction_method VARCHAR(50), -- 'recipe', 'llm', 'hybrid'
    extraction_confidence DECIMAL(3,2), -- 0.00 to 1.00
    
    -- Verification and quality
    is_verified BOOLEAN DEFAULT false,
    verification_status VARCHAR(50), -- 'pending', 'verified', 'rejected', 'flagged'
    quality_score DECIMAL(3,2), -- Data quality score
    
    -- Deduplication
    content_hash VARCHAR(64), -- Hash of key fields for dedup
    is_duplicate BOOLEAN DEFAULT false,
    duplicate_of_id UUID REFERENCES products(id),
    
    -- Raw data
    raw_html TEXT, -- Optionally store HTML snippet
    raw_data JSONB, -- Raw extracted data before normalization
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_products_crawl_run ON products(crawl_run_id);
CREATE INDEX idx_products_site_config ON products(site_config_id);
CREATE INDEX idx_products_external_id ON products(site_config_id, external_id);
CREATE INDEX idx_products_product_type ON products(product_type);
CREATE INDEX idx_products_price ON products(price) WHERE price IS NOT NULL;
CREATE INDEX idx_products_city ON products(city);
CREATE INDEX idx_products_verification ON products(verification_status);
CREATE INDEX idx_products_duplicate ON products(is_duplicate) WHERE is_duplicate = false;
CREATE INDEX idx_products_content_hash ON products(content_hash);

-- GIN index for JSONB attributes search
CREATE INDEX idx_products_attributes ON products USING gin(attributes);

-- ============================================================================
-- LLM USAGE LOGS TABLE
-- Detailed logging of LLM interactions for cost tracking and debugging
-- ============================================================================
CREATE TABLE IF NOT EXISTS llm_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Context
    crawl_run_id UUID REFERENCES crawl_runs(id) ON DELETE CASCADE,
    page_task_id UUID REFERENCES page_tasks(id) ON DELETE SET NULL,
    
    -- LLM request details
    request_type VARCHAR(50) NOT NULL, -- 'classification', 'extraction', 'recipe_generation', 'link_discovery'
    model VARCHAR(100), -- 'gpt-4', 'gpt-3.5-turbo', 'claude-3-opus', etc.
    
    -- Token usage
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    
    -- Cost calculation
    estimated_cost DECIMAL(10,4), -- Cost in dollars
    
    -- Performance
    duration_ms INTEGER,
    
    -- Request/response (optional, for debugging)
    prompt_summary TEXT, -- Summary of the prompt
    response_summary TEXT, -- Summary of the response
    
    -- Success tracking
    was_successful BOOLEAN DEFAULT true,
    error_message TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_llm_usage_crawl_run ON llm_usage_logs(crawl_run_id);
CREATE INDEX idx_llm_usage_request_type ON llm_usage_logs(request_type);
CREATE INDEX idx_llm_usage_created ON llm_usage_logs(created_at DESC);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update_updated_at trigger to relevant tables
CREATE TRIGGER update_site_configs_updated_at BEFORE UPDATE ON site_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_llm_recipes_updated_at BEFORE UPDATE ON llm_recipes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crawl_runs_updated_at BEFORE UPDATE ON crawl_runs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_page_tasks_updated_at BEFORE UPDATE ON page_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View: Active crawl runs with statistics
CREATE OR REPLACE VIEW v_active_crawl_runs AS
SELECT 
    cr.id,
    cr.run_number,
    sc.domain,
    sc.name as site_name,
    cr.status,
    cr.pages_visited,
    cr.pages_queued,
    cr.products_found,
    cr.llm_requests_classification + cr.llm_requests_extraction + cr.llm_requests_recipe_generation as total_llm_requests,
    cr.llm_total_cost,
    CASE 
        WHEN cr.products_found > 0 THEN cr.llm_total_cost / cr.products_found
        ELSE NULL
    END as cost_per_product,
    cr.started_at,
    EXTRACT(EPOCH FROM (COALESCE(cr.completed_at, CURRENT_TIMESTAMP) - cr.started_at))::INTEGER as elapsed_seconds
FROM crawl_runs cr
JOIN site_configs sc ON cr.site_config_id = sc.id
WHERE cr.status IN ('running', 'completed')
ORDER BY cr.started_at DESC;

-- View: Product summary by site and type
CREATE OR REPLACE VIEW v_product_summary AS
SELECT 
    sc.id as site_config_id,
    sc.domain,
    sc.name as site_name,
    p.product_type,
    COUNT(*) as total_products,
    COUNT(DISTINCT p.crawl_run_id) as crawl_runs,
    AVG(p.price) as avg_price,
    MIN(p.price) as min_price,
    MAX(p.price) as max_price,
    COUNT(*) FILTER (WHERE p.is_verified = true) as verified_count,
    COUNT(*) FILTER (WHERE p.is_duplicate = true) as duplicate_count,
    MAX(p.last_seen_at) as last_crawled
FROM products p
JOIN site_configs sc ON p.site_config_id = sc.id
GROUP BY sc.id, sc.domain, sc.name, p.product_type;

-- View: Page task queue status
CREATE OR REPLACE VIEW v_queue_status AS
SELECT 
    cr.id as crawl_run_id,
    sc.domain,
    COUNT(*) FILTER (WHERE pt.status = 'queued') as queued,
    COUNT(*) FILTER (WHERE pt.status = 'processing') as processing,
    COUNT(*) FILTER (WHERE pt.status = 'completed') as completed,
    COUNT(*) FILTER (WHERE pt.status = 'failed') as failed,
    COUNT(*) as total
FROM crawl_runs cr
JOIN site_configs sc ON cr.site_config_id = sc.id
LEFT JOIN page_tasks pt ON cr.id = pt.crawl_run_id
WHERE cr.status = 'running'
GROUP BY cr.id, sc.domain;

-- ============================================================================
-- SEED DATA (Optional - for testing)
-- ============================================================================

-- Example automotive site configuration
INSERT INTO site_configs (domain, name, product_type, seeds, allowed_path_patterns, disallowed_path_patterns, product_schema)
VALUES (
    'kijiji.ca',
    'Kijiji Autos',
    'automotive',
    ARRAY['https://www.kijiji.ca/b-cars-vehicles/canada/c27l0'],
    ARRAY['^/b-cars-vehicles/', '^/v-cars-trucks/'],
    ARRAY['/login', '/register', '/help', '/my-ads'],
    '{
        "type": "object",
        "properties": {
            "year": {"type": "integer"},
            "make": {"type": "string"},
            "model": {"type": "string"},
            "mileage": {"type": "integer"},
            "mileage_unit": {"type": "string", "enum": ["km", "mi"]},
            "condition": {"type": "string", "enum": ["new", "used"]},
            "body_type": {"type": "string"},
            "transmission": {"type": "string"},
            "fuel_type": {"type": "string"},
            "drivetrain": {"type": "string"},
            "color": {"type": "string"},
            "vin": {"type": "string"}
        }
    }'::jsonb
) ON CONFLICT (domain) DO NOTHING;

-- Example generic site configuration
INSERT INTO site_configs (domain, name, product_type, seeds, product_schema)
VALUES (
    'cbc.ca',
    'CBC Articles',
    'generic',
    ARRAY['https://www.cbc.ca/news'],
    '{
        "type": "object",
        "properties": {
            "author": {"type": "string"},
            "published_date": {"type": "string"},
            "category": {"type": "string"},
            "tags": {"type": "array"}
        }
    }'::jsonb
) ON CONFLICT (domain) DO NOTHING;

COMMENT ON TABLE site_configs IS 'Configuration for each website/domain to be crawled';
COMMENT ON TABLE llm_recipes IS 'Learned selectors and patterns for efficient scraping (versioned)';
COMMENT ON TABLE crawl_runs IS 'Individual crawl execution tracking with LLM cost analysis';
COMMENT ON TABLE page_tasks IS 'Queue-based page fetch and analysis tasks (state machine)';
COMMENT ON TABLE products IS 'Generic product/catch data with extensible attributes';
COMMENT ON TABLE llm_usage_logs IS 'Detailed LLM interaction logs for cost tracking and debugging';
