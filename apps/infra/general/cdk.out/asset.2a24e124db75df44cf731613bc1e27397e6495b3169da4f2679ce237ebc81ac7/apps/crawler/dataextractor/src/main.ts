import { Handler } from 'aws-lambda';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import chromium from '@sparticuz/chromium';

// Enable stealth mode to bypass bot detection
puppeteer.use(StealthPlugin());

/**
 * EventBridge event structure for crawler requests
 */
interface CrawlerEvent {
  url: string;
  waitForSelector?: string;
  timeout?: number;
  selectors?: {
    [key: string]: string; // e.g., { "title": "h1", "price": ".price-value" }
  };
  extractFullHtml?: boolean; // Default: true
  screenshot?: boolean; // Take screenshot
  waitForNetworkIdle?: boolean; // Wait for network idle (default: true)
}

/**
 * Lambda handler for web crawling/data extraction
 * Triggered by EventBridge events
 */
export const handler: Handler = async (event: CrawlerEvent) => {
  console.log('Received crawler event:', JSON.stringify(event, null, 2));

  const {
    url,
    waitForSelector,
    timeout = 30000,
    selectors,
    extractFullHtml = true,
    screenshot = false,
    waitForNetworkIdle = true,
  } = event;

  if (!url) {
    throw new Error('URL is required in the event payload');
  }

  let browser;
  try {
    // Launch browser with stealth mode and Lambda-optimized settings
    console.log('Launching stealth browser...');
    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--disable-http2',
        '--disable-blink-features=AutomationControlled',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-sync',
        '--disable-translate',
        '--hide-scrollbars',
        '--metrics-recording-only',
        '--mute-audio',
      ],
      defaultViewport: {
        width: 1920,
        height: 1080,
      },
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    console.log('Browser launched successfully');
    console.log('Browser version:', await browser.version());

    // Create new page with anonymization
    const page = await browser.newPage();

    // Set realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Set additional headers for anonymity
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Referer': 'https://www.google.com/',
    });

    // Remove webdriver traces
    await page.evaluateOnNewDocument(() => {
      // @ts-ignore
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
      // @ts-ignore
      window.navigator.chrome = { runtime: {} };
      // @ts-ignore
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      // @ts-ignore
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
    });

    // Navigate to URL
    console.log(`Navigating to: ${url}`);
    await page.goto(url, {
      waitUntil: waitForNetworkIdle ? 'networkidle0' : 'domcontentloaded',
      timeout,
    });

    // Wait for optional selector
    if (waitForSelector) {
      console.log(`Waiting for selector: ${waitForSelector}`);
      await page.waitForSelector(waitForSelector, { timeout });
    }

    // Extract page title
    const pageTitle = await page.title();
    console.log(`Page title: ${pageTitle}`);

    // Build response object
    const response: any = {
      url,
      title: pageTitle,
      timestamp: new Date().toISOString(),
    };

    // Extract specific selectors if provided
    if (selectors && Object.keys(selectors).length > 0) {
      console.log('Extracting specific selectors:', Object.keys(selectors));
      response.extracted = {};

      for (const [key, selector] of Object.entries(selectors)) {
        try {
          // Try to extract multiple elements first
          const elements = await page.$$(selector);

          if (elements.length === 0) {
            response.extracted[key] = null;
            console.log(`No elements found for selector "${selector}"`);
          } else if (elements.length === 1) {
            // Single element - extract text or HTML
            const content = await page.$eval(
              selector,
              (el) => ({
                text: el.textContent?.trim() || '',
                html: el.innerHTML,
                attributes: Array.from(el.attributes).reduce(
                  (acc: Record<string, string>, attr: Attr) => {
                    acc[attr.name] = attr.value;
                    return acc;
                  },
                  {}
                ),
              })
            );
            response.extracted[key] = content;
            console.log(`Extracted "${key}": ${content.text?.substring(0, 50)}...`);
          } else {
            // Multiple elements - extract array
            const contents = await page.$$eval(selector, (els) =>
              els.map((el) => ({
                text: el.textContent?.trim() || '',
                html: el.innerHTML,
                attributes: Array.from(el.attributes).reduce(
                  (acc: Record<string, string>, attr: Attr) => {
                    acc[attr.name] = attr.value;
                    return acc;
                  },
                  {}
                ),
              }))
            );
            response.extracted[key] = contents;
            console.log(`Extracted "${key}": ${contents.length} elements`);
          }
        } catch (error) {
          response.extracted[key] = {
            error: `Failed to extract: ${error.message}`,
          };
          console.error(`Error extracting "${key}" with selector "${selector}":`, error);
        }
      }
    }

    // Extract full HTML if requested
    if (extractFullHtml) {
      const html = await page.content();
      response.html = html;
      response.htmlLength = html.length;
      console.log(`Extracted full HTML: ${html.length} characters`);
    }

    // Take screenshot if requested
    if (screenshot) {
      console.log('Taking screenshot...');
      const screenshotBuffer = await page.screenshot({
        type: 'png',
        fullPage: false, // Only visible viewport
      });
      response.screenshot = screenshotBuffer.toString('base64');
      response.screenshotSize = screenshotBuffer.length;
      console.log(`Screenshot captured: ${screenshotBuffer.length} bytes`);
    }

    await page.close();

    console.log('Extraction completed successfully');

    return {
      statusCode: 200,
      body: response,
    };
  } catch (error) {
    console.error('Error during crawling:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log('Browser closed');
    }
  }
};
