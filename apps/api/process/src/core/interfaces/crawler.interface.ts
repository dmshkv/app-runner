/**
 * Crawl strategies
 */
export enum CrawlStrategy {
  FULL_HTML = 'FULL_HTML',
  TEMPLATE = 'TEMPLATE',
}

/**
 * Base crawl command
 */
export interface CrawlCommand {
  type: 'CRAWL';
  url: string;
  strategy: CrawlStrategy;
  requestId?: string;
  timeout?: number;
  waitForNetworkIdle?: boolean;
  screenshot?: boolean;
}

/**
 * FULL_HTML strategy command
 * Grabs full body HTML, cleans it from styles and trash
 */
export interface FullHtmlCrawlCommand extends CrawlCommand {
  strategy: CrawlStrategy.FULL_HTML;
  // No additional fields needed for FULL_HTML
}

/**
 * TEMPLATE strategy command
 * Extracts data using CSS selectors
 */
export interface TemplateCrawlCommand extends CrawlCommand {
  strategy: CrawlStrategy.TEMPLATE;
  selectors: Record<string, string>;
  waitForSelector?: string;
}

/**
 * Union type for all crawl commands
 */
export type AnyCrawlCommand = FullHtmlCrawlCommand | TemplateCrawlCommand;

/**
 * Base result data
 */
export interface BaseCrawlResultData {
  url: string;
  strategy: CrawlStrategy;
  requestId?: string;
  statusCode?: number;
  errorMessage?: string;
  timestamp?: string;
  title?: string;
}

/**
 * FULL_HTML strategy result
 * Contains cleaned body HTML
 */
export interface FullHtmlResultData extends BaseCrawlResultData {
  strategy: CrawlStrategy.FULL_HTML;
  html: string;
  htmlLength: number;
  cleanedHtml: string; // HTML with styles/scripts removed
  cleanedHtmlLength: number;
}

/**
 * TEMPLATE strategy result
 * Contains extracted data based on selectors
 */
export interface TemplateResultData extends BaseCrawlResultData {
  strategy: CrawlStrategy.TEMPLATE;
  extracted: Record<string, any>;
  screenshot?: string;
  screenshotSize?: number;
}

/**
 * Union type for all result data
 */
export type CrawlResultData = FullHtmlResultData | TemplateResultData;

/**
 * Result message wrapper
 */
export interface CrawlResultMessage {
  statusCode: number;
  body: CrawlResultData;
}
