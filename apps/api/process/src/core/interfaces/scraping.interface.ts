// ============================================================================
// SCRAPING SYSTEM INTERFACES
// Core interfaces for LLM-assisted web scraping architecture
// ============================================================================

// ----------------------------------------------------------------------------
// Site Configuration
// ----------------------------------------------------------------------------

export interface ISiteConfig {
  id: string;
  domain: string;
  name: string;
  description?: string;
  seeds: string[];
  allowedPathPatterns: string[];
  disallowedPathPatterns: string[];
  throttleMs: number;
  maxDepth: number;
  maxPagesPerRun: number;
  productType: string;
  productSchema?: IProductSchema;
  isActive: boolean;
  lastCrawledAt?: Date;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProductSchema {
  type: 'object';
  properties: Record<string, ISchemaProperty>;
  required?: string[];
}

export interface ISchemaProperty {
  type: string;
  enum?: string[];
  items?: ISchemaProperty;
  properties?: Record<string, ISchemaProperty>;
}

// ----------------------------------------------------------------------------
// LLM Recipe (Learned Patterns)
// ----------------------------------------------------------------------------

export interface ILlmRecipe {
  id: string;
  siteConfigId: string;
  version: number;
  isActive: boolean;
  confidenceScore?: number;
  listingSelectors?: IListingSelectors;
  productSelectors?: IProductSelectors;
  pageClassificationRules?: IPageClassificationRules;
  successCount: number;
  failureCount: number;
  lastUsedAt?: Date;
  learnedFromUrls?: string[];
  notes?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IListingSelectors {
  productLinkSelector?: string;
  productLinkAttribute?: string; // e.g., 'href'
  paginationSelector?: string;
  nextPageSelector?: string;
  filterSelectors?: Record<string, string>;
  itemContainerSelector?: string;
}

export interface IProductSelectors {
  titleSelector?: string;
  priceSelector?: string;
  descriptionSelector?: string;
  imageSelector?: string;
  attributes?: Record<string, string>; // e.g., { year: '.year-field', make: '.make-field' }
}

export interface IPageClassificationRules {
  productPageIndicators?: string[]; // URL patterns or DOM patterns
  listingPageIndicators?: string[];
  paginationIndicators?: string[];
}

// ----------------------------------------------------------------------------
// Crawl Run
// ----------------------------------------------------------------------------

export interface ICrawlRun {
  id: string;
  siteConfigId: string;
  runNumber: number;
  status: CrawlRunStatus;
  pagesVisited: number;
  pagesQueued: number;
  productsFound: number;
  llmRequestsClassification: number;
  llmRequestsExtraction: number;
  llmRequestsRecipeGeneration: number;
  llmTotalTokens: number;
  llmTotalCost: number;
  llmRecipeId?: string;
  recipeFallbackCount: number;
  startedAt: Date;
  completedAt?: Date;
  durationSeconds?: number;
  errorMessage?: string;
  errorCount: number;
  stopReason?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export enum CrawlRunStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  STOPPED = 'stopped',
  TIMEOUT = 'timeout',
}

export interface ICrawlRunStats {
  totalLlmRequests: number;
  costPerProduct: number | null;
  elapsedSeconds: number;
  pagesPerMinute: number;
  successRate: number;
}

// ----------------------------------------------------------------------------
// Page Task (Queue Item)
// ----------------------------------------------------------------------------

export interface IPageTask {
  id: string;
  crawlRunId: string;
  url: string;
  urlHash: string;
  normalizedUrl?: string;
  status: PageTaskStatus;
  depth: number;
  httpStatus?: number;
  finalUrl?: string;
  fetchDurationMs?: number;
  pageType?: PageType;
  pageClassificationMethod?: string;
  llmRequests: number;
  llmTokens: number;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  queuedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  parentTaskId?: string;
  discoveredFrom?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export enum PageTaskStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

export enum PageType {
  PRODUCT = 'product',
  LISTING = 'listing',
  PAGINATION = 'pagination',
  OTHER = 'other',
  ERROR = 'error',
}

// ----------------------------------------------------------------------------
// Product (Generic Catch/Match)
// ----------------------------------------------------------------------------

export interface IProduct {
  id: string;
  crawlRunId: string;
  siteConfigId: string;
  pageTaskId?: string;
  url: string;
  externalId?: string;
  title: string;
  description?: string;
  price?: number;
  currency: string;
  priceQualifier?: string;
  originalPrice?: number;
  productType: string;
  category?: string;
  subcategory?: string;
  city?: string;
  province?: string;
  country: string;
  postalCode?: string;
  attributes: Record<string, any>;
  images?: string[];
  primaryImageUrl?: string;
  extractionMethod?: string;
  extractionConfidence?: number;
  isVerified: boolean;
  verificationStatus?: string;
  qualityScore?: number;
  contentHash?: string;
  isDuplicate: boolean;
  duplicateOfId?: string;
  rawHtml?: string;
  rawData?: Record<string, any>;
  metadata: Record<string, any>;
  firstSeenAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Product-specific attribute interfaces
export interface IAutomotiveAttributes {
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  mileage?: number;
  mileageUnit?: 'km' | 'mi';
  condition?: 'new' | 'used' | 'certified';
  bodyType?: string;
  transmission?: 'automatic' | 'manual' | 'cvt' | 'other';
  fuelType?: 'gasoline' | 'diesel' | 'electric' | 'hybrid' | 'other';
  drivetrain?: 'fwd' | 'rwd' | 'awd' | '4wd';
  color?: string;
  interiorColor?: string;
  vin?: string;
  stockNumber?: string;
  doors?: number;
  seats?: number;
  engineSize?: string;
  cylinders?: number;
}

export interface IGroceryAttributes {
  brand?: string;
  size?: string;
  unit?: string;
  quantity?: number;
  isOrganic?: boolean;
  expiryDate?: string;
  nutritionInfo?: Record<string, any>;
  ingredients?: string[];
}

// ----------------------------------------------------------------------------
// LLM Usage Log
// ----------------------------------------------------------------------------

export interface ILlmUsageLog {
  id: string;
  crawlRunId?: string;
  pageTaskId?: string;
  requestType: LlmRequestType;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedCost?: number;
  durationMs?: number;
  promptSummary?: string;
  responseSummary?: string;
  wasSuccessful: boolean;
  errorMessage?: string;
  metadata: Record<string, any>;
  createdAt: Date;
}

export enum LlmRequestType {
  CLASSIFICATION = 'classification',
  EXTRACTION = 'extraction',
  RECIPE_GENERATION = 'recipe_generation',
  LINK_DISCOVERY = 'link_discovery',
}

// ----------------------------------------------------------------------------
// LLM Response Interfaces (Contract between Puppeteer and LLM)
// ----------------------------------------------------------------------------

export interface ILlmPageAnalysisRequest {
  url: string;
  html: string;
  domain: string;
  siteRecipe?: ILlmRecipe;
  previousPageType?: PageType;
}

export interface ILlmPageAnalysisResponse {
  pageType: PageType;
  confidence: number;
  reason: string;
  products?: IProductCandidate[];
  nextLinks?: ILinkInstruction[];
  suggestions?: string[]; // Suggestions for improving recipe
}

export interface IProductCandidate {
  title: string;
  price?: number;
  currency?: string;
  description?: string;
  attributes?: Record<string, any>;
  images?: string[];
  confidence: number;
  extractionMethod: 'recipe' | 'llm' | 'hybrid';
}

export interface ILinkInstruction {
  href: string;
  kind: 'product' | 'listing' | 'pagination' | 'category' | 'other';
  reason?: string;
  priority?: number; // 1-10, higher is more important
  text?: string;
}

// ----------------------------------------------------------------------------
// Queue & Worker Interfaces
// ----------------------------------------------------------------------------

export interface IPageFetchJob {
  pageTaskId: string;
  url: string;
  depth: number;
  maxRetries: number;
  siteConfig: Partial<ISiteConfig>;
}

export interface IPageFetchResult {
  pageTaskId: string;
  success: boolean;
  html?: string;
  finalUrl?: string;
  httpStatus?: number;
  fetchDurationMs: number;
  error?: string;
  screenshots?: string[]; // Base64 or S3 URLs
}

export interface IPageAnalyzeJob {
  pageTaskId: string;
  crawlRunId: string;
  url: string;
  html: string;
  siteConfig: Partial<ISiteConfig>;
  llmRecipe?: ILlmRecipe;
}

export interface IPageAnalyzeResult {
  pageTaskId: string;
  pageType: PageType;
  products: IProductCandidate[];
  links: ILinkInstruction[];
  llmUsed: boolean;
  llmTokens?: number;
  analysisMethod: 'recipe' | 'llm' | 'hybrid';
}

// ----------------------------------------------------------------------------
// Service DTOs (Data Transfer Objects)
// ----------------------------------------------------------------------------

export interface ICreateCrawlRunDto {
  siteConfigId: string;
  useRecipe?: boolean;
  recipeId?: string;
  maxPages?: number;
  maxDepth?: number;
}

export interface ICreateSiteConfigDto {
  domain: string;
  name: string;
  description?: string;
  seeds: string[];
  allowedPathPatterns?: string[];
  disallowedPathPatterns?: string[];
  throttleMs?: number;
  maxDepth?: number;
  maxPagesPerRun?: number;
  productType: string;
  productSchema?: IProductSchema;
}

export interface IUpdateSiteConfigDto {
  name?: string;
  description?: string;
  seeds?: string[];
  allowedPathPatterns?: string[];
  disallowedPathPatterns?: string[];
  throttleMs?: number;
  maxDepth?: number;
  maxPagesPerRun?: number;
  isActive?: boolean;
  productSchema?: IProductSchema;
}

export interface IQueueStatusDto {
  crawlRunId: string;
  domain: string;
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

// ----------------------------------------------------------------------------
// Statistics & Analytics Interfaces
// ----------------------------------------------------------------------------

export interface ICrawlRunSummary {
  id: string;
  runNumber: number;
  domain: string;
  siteName: string;
  status: CrawlRunStatus;
  pagesVisited: number;
  pagesQueued: number;
  productsFound: number;
  totalLlmRequests: number;
  llmTotalCost: number;
  costPerProduct: number | null;
  startedAt: Date;
  elapsedSeconds: number;
}

export interface IProductSummary {
  siteConfigId: string;
  domain: string;
  siteName: string;
  productType: string;
  totalProducts: number;
  crawlRuns: number;
  avgPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  verifiedCount: number;
  duplicateCount: number;
  lastCrawled: Date;
}

// ----------------------------------------------------------------------------
// AWS SQS/SNS Message Interfaces
// ----------------------------------------------------------------------------

export interface ISqsCrawlCommand {
  command: 'CRAWL' | 'STOP' | 'STATUS';
  siteConfigId?: string;
  crawlRunId?: string;
  urls?: string[];
  options?: {
    maxPages?: number;
    maxDepth?: number;
    useRecipe?: boolean;
  };
}

export interface ISqsCrawlResult {
  crawlRunId: string;
  pageTaskId: string;
  url: string;
  status: 'success' | 'failed';
  pageType?: PageType;
  productsCount: number;
  linksCount: number;
  llmUsed: boolean;
  error?: string;
  timestamp: string;
}

export interface ISnsNotification {
  type: 'CRAWL_STARTED' | 'CRAWL_COMPLETED' | 'CRAWL_FAILED' | 'PRODUCT_FOUND' | 'ERROR';
  crawlRunId: string;
  siteConfigId: string;
  domain: string;
  message: string;
  data?: Record<string, any>;
  timestamp: string;
}
