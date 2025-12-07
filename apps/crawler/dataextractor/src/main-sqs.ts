import { SQSEvent, SQSRecord, Context } from 'aws-lambda';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import chromium from '@sparticuz/chromium';

// Enable stealth mode to bypass bot detection
puppeteer.use(StealthPlugin());

const sqsClient = new SQSClient({});
const snsClient = new SNSClient({});

const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL;
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;

/**
 * Crawl strategies
 */
enum CrawlStrategy {
  FULL_HTML = 'FULL_HTML',
  TEMPLATE = 'TEMPLATE',
}

/**
 * Base crawl command interface
 */
interface BaseCrawlCommand {
  type: 'CRAWL';
  url: string;
  requestId?: string;
  timeout?: number;
  waitForNetworkIdle?: boolean;
}

/**
 * FULL_HTML strategy: Grabs and cleans full page HTML
 */
interface FullHtmlCrawlCommand extends BaseCrawlCommand {
  strategy: CrawlStrategy.FULL_HTML;
}

/**
 * TEMPLATE strategy: Extracts data using selectors
 */
interface TemplateCrawlCommand extends BaseCrawlCommand {
  strategy: CrawlStrategy.TEMPLATE;
  selectors: Record<string, string>;
  waitForSelector?: string;
  screenshot?: boolean;
}

type CrawlCommand = FullHtmlCrawlCommand | TemplateCrawlCommand;

interface ExitCommand {
  type: 'EXIT';
}

type CrawlerCommand = CrawlCommand | ExitCommand;

/**
 * Publish crawl results to SNS
 */
async function publishResults(results: any): Promise<void> {
  if (!SNS_TOPIC_ARN) {
    console.log('⚠️ SNS_TOPIC_ARN not configured, skipping publish');
    return;
  }

  try {
    const messageAttributes: any = {
      eventType: {
        DataType: 'String',
        StringValue: 'CrawlComplete',
      },
      statusCode: {
        DataType: 'Number',
        StringValue: String(results.statusCode),
      },
    };

    // Only add URL attribute if it exists
    if (results.body?.url) {
      messageAttributes.url = {
        DataType: 'String',
        StringValue: results.body.url,
      };
    }

    await snsClient.send(
      new PublishCommand({
        TopicArn: SNS_TOPIC_ARN,
        Message: JSON.stringify(results),
        Subject: `Crawl Complete: ${results.body?.url || 'Unknown URL'}`,
        MessageAttributes: messageAttributes,
      })
    );
    console.log('✅ Results published to SNS');
  } catch (error) {
    console.error('❌ Failed to publish to SNS:', error);
    throw error;
  }
}

/**
 * Poll SQS for next message (long polling)
 */
async function pollForNextMessage(): Promise<CrawlerCommand | null> {
  if (!SQS_QUEUE_URL) {
    console.log('⚠️ SQS_QUEUE_URL not configured, skipping poll');
    return null;
  }

  try {
    const result = await sqsClient.send(
      new ReceiveMessageCommand({
        QueueUrl: SQS_QUEUE_URL,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 20, // Long polling
        MessageAttributeNames: ['All'],
      })
    );

    if (!result.Messages || result.Messages.length === 0) {
      console.log('No messages in queue');
      return null;
    }

    const message = result.Messages[0];
    const command: CrawlerCommand = JSON.parse(message.Body || '{}');

    console.log('📨 Received command from SQS:', command.type);

    // Delete message from queue
    await sqsClient.send(
      new DeleteMessageCommand({
        QueueUrl: SQS_QUEUE_URL,
        ReceiptHandle: message.ReceiptHandle,
      })
    );

    return command;
  } catch (error) {
    console.error('Error polling SQS:', error);
    return null;
  }
}

/**
 * Clean HTML by removing unwanted elements
 */
function cleanHtml(html: string): string {
  // Remove script tags and their content
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove style tags and their content
  html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Remove noscript tags
  html = html.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');
  
  // Remove inline style attributes
  html = html.replace(/\s+style="[^"]*"/gi, '');
  html = html.replace(/\s+style='[^']*'/gi, '');
  
  // Remove SVG elements (often used for icons/graphics)
  html = html.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '');
  
  // Remove data attributes
  html = html.replace(/\s+data-[a-z-]+=["'][^"']*["']/gi, '');
  
  // Remove class attributes (optional, comment out if you need classes)
  // html = html.replace(/\s+class="[^"]*"/gi, '');
  
  // Remove excessive whitespace
  html = html.replace(/\s+/g, ' ');
  html = html.replace(/>\s+</g, '><');
  
  return html.trim();
}

/**
 * Process FULL_HTML strategy
 */
async function processFullHtml(browser: any, command: FullHtmlCrawlCommand) {
  const { url, timeout = 30000, waitForNetworkIdle = true, requestId } = command;

  console.log(`🕷️ Processing FULL_HTML: ${url}`);

  try {
    const page = await browser.newPage();

    // Set realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Set additional headers for anonymity
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      Referer: 'https://www.google.com/',
    });

    // Remove webdriver traces
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
      (window.navigator as any).chrome = { runtime: {} };
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
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

    // Extract page title
    const pageTitle = await page.title();
    console.log(`Page title: ${pageTitle}`);

    // Get full HTML
    const rawHtml = await page.content();
    console.log(`Raw HTML: ${rawHtml.length} characters`);

    // Clean HTML
    const cleaned = cleanHtml(rawHtml);
    console.log(`Cleaned HTML: ${cleaned.length} characters (reduced by ${rawHtml.length - cleaned.length})`);

    await page.close();

    return {
      statusCode: 200,
      body: {
        strategy: CrawlStrategy.FULL_HTML,
        url,
        title: pageTitle,
        cleanedHtml: cleaned,
        cleanedHtmlLength: cleaned.length,
        timestamp: new Date().toISOString(),
        requestId,
      },
    };
  } catch (error: any) {
    console.error('Error during FULL_HTML crawl:', error);
    return {
      statusCode: 500,
      body: {
        strategy: CrawlStrategy.FULL_HTML,
        url,
        errorMessage: error.message,
        timestamp: new Date().toISOString(),
        requestId,
      },
    };
  }
}

/**
 * Process TEMPLATE strategy
 */
async function processTemplate(browser: any, command: TemplateCrawlCommand) {
  const {
    url,
    timeout = 30000,
    waitForNetworkIdle = true,
    selectors,
    waitForSelector,
    screenshot = false,
    requestId,
  } = command;

  console.log(`🕷️ Processing TEMPLATE: ${url}`);

  try {
    const page = await browser.newPage();

    // Set realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Set additional headers for anonymity
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      Referer: 'https://www.google.com/',
    });

    // Remove webdriver traces
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
      (window.navigator as any).chrome = { runtime: {} };
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
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

    // Extract specific selectors
    const extracted: Record<string, any> = {};

    if (selectors && Object.keys(selectors).length > 0) {
      console.log('Extracting selectors:', Object.keys(selectors));

      for (const [key, selector] of Object.entries(selectors)) {
        try {
          const elements = await page.$$(selector);

          if (elements.length === 0) {
            extracted[key] = null;
          } else if (elements.length === 1) {
            const content = await page.$eval(selector, (el: Element) => ({
              text: el.textContent?.trim() || '',
              html: el.innerHTML,
              attributes: Array.from(el.attributes).reduce(
                (acc: Record<string, string>, attr: Attr) => {
                  acc[attr.name] = attr.value;
                  return acc;
                },
                {}
              ),
            }));
            extracted[key] = content;
          } else {
            const contents = await page.$$eval(selector, (els: Element[]) =>
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
            extracted[key] = contents;
          }
        } catch (error: any) {
          extracted[key] = {
            error: `Failed to extract: ${error.message}`,
          };
          console.error(
            `Error extracting "${key}" with selector "${selector}":`,
            error
          );
        }
      }
    }

    // Build response
    const response: any = {
      strategy: CrawlStrategy.TEMPLATE,
      url,
      title: pageTitle,
      extracted,
      timestamp: new Date().toISOString(),
      requestId,
    };

    // Take screenshot if requested
    if (screenshot) {
      console.log('Taking screenshot...');
      const screenshotBuffer = await page.screenshot({
        type: 'png',
        fullPage: false,
      });
      response.screenshot = screenshotBuffer.toString('base64');
      response.screenshotSize = screenshotBuffer.length;
    }

    await page.close();

    return {
      statusCode: 200,
      body: response,
    };
  } catch (error: any) {
    console.error('Error during TEMPLATE crawl:', error);
    return {
      statusCode: 500,
      body: {
        strategy: CrawlStrategy.TEMPLATE,
        url,
        errorMessage: error.message,
        timestamp: new Date().toISOString(),
        requestId,
      },
    };
  }
}

/**
 * Process a single crawl request (strategy router)
 */
async function processCrawl(browser: any, command: CrawlCommand) {
  if (command.strategy === CrawlStrategy.FULL_HTML) {
    return processFullHtml(browser, command);
  } else {
    return processTemplate(browser, command);
  }
}

/**
 * Lambda handler - Processes SQS messages and polls for more
 */
export const handler = async (event: SQSEvent, context: Context) => {
  console.log('🚀 Crawler Lambda started');
  console.log('Remaining time:', context.getRemainingTimeInMillis(), 'ms');

  let browser;

  try {
    // Launch browser once
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

    console.log('✅ Browser launched successfully');

    let processedCount = 0;
    const maxProcessingTime = context.getRemainingTimeInMillis() - 60000; // Leave 1 min buffer
    const startTime = Date.now();

    // Process initial SQS event messages
    for (const record of event.Records) {
      const command: CrawlerCommand = JSON.parse(record.body);

      if (command.type === 'EXIT') {
        console.log('🛑 EXIT command received, shutting down');
        break;
      }

      if (command.type === 'CRAWL') {
        const result = await processCrawl(browser, command);
        await publishResults(result);
        processedCount++;
      }
    }

    // Poll for additional messages
    console.log('🔄 Starting polling loop for additional messages...');

    while (Date.now() - startTime < maxProcessingTime) {
      const remainingTime = context.getRemainingTimeInMillis();
      console.log(`⏱️ Remaining Lambda time: ${remainingTime}ms`);

      if (remainingTime < 120000) {
        // Less than 2 minutes left
        console.log('⚠️ Approaching timeout, exiting gracefully');
        break;
      }

      const command = await pollForNextMessage();

      if (!command) {
        console.log('No more messages, exiting');
        break;
      }

      if (command.type === 'EXIT') {
        console.log('🛑 EXIT command received, shutting down');
        break;
      }

      if (command.type === 'CRAWL') {
        const result = await processCrawl(browser, command);
        await publishResults(result);
        processedCount++;
      }
    }

    console.log(`✅ Processed ${processedCount} crawl(s) successfully`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Crawler completed',
        processedCount,
      }),
    };
  } catch (error: any) {
    console.error('❌ Fatal error:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log('Browser closed');
    }
  }
};
