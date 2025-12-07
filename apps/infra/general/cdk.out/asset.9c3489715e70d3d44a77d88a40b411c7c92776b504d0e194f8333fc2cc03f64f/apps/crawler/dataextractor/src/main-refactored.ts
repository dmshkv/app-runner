/**
 * Refactored main Lambda handler using modular architecture
 */
import { Handler } from 'aws-lambda';
import { launchBrowser, createStealthPage } from './lib/browser';
import { navigateToPage } from './lib/network';
import { extractSelectors, extractHTML, takeScreenshot } from './lib/parser';

/**
 * EventBridge event structure for crawler requests
 */
interface CrawlerEvent {
  url: string;
  waitForSelector?: string;
  timeout?: number;
  selectors?: {
    [key: string]: string;
  };
  extractFullHtml?: boolean;
  screenshot?: boolean;
  waitForNetworkIdle?: boolean;
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
    screenshot: takeScreenshotFlag = false,
    waitForNetworkIdle = true,
  } = event;

  if (!url) {
    throw new Error('URL is required in the event payload');
  }

  let browser;
  try {
    // Launch stealth browser
    console.log('Launching stealth browser...');
    browser = await launchBrowser({
      headless: true,
      isLambda: true,
      timeout,
    });

    console.log('Browser launched successfully');
    console.log('Browser version:', await browser.version());

    // Create stealth page
    const page = await createStealthPage(browser);

    // Navigate to URL
    await navigateToPage(page, url, {
      timeout,
      waitForNetworkIdle,
      waitForSelector,
    });

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
      console.log('Extracting selectors...');
      response.extracted = await extractSelectors(page, selectors);
    }

    // Extract full HTML if requested
    if (extractFullHtml) {
      console.log('Extracting full HTML...');
      const html = await extractHTML(page);
      response.html = html;
      response.htmlLength = html.length;
      console.log(`Extracted ${html.length} characters`);
    }

    // Take screenshot if requested
    if (takeScreenshotFlag) {
      console.log('Taking screenshot...');
      const screenshotData = await takeScreenshot(page);
      response.screenshot = screenshotData;
      response.screenshotSize = screenshotData.length;
      console.log(`Screenshot captured: ${screenshotData.length} bytes`);
    }

    await page.close();
    console.log('Extraction completed successfully');

    return {
      statusCode: 200,
      body: response,
    };
  } catch (error: any) {
    console.error('Error during crawling:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log('Browser closed');
    }
  }
};
