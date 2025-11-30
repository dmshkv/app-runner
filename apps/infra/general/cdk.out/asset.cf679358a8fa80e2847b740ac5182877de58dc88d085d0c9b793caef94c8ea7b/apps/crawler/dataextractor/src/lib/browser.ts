/**
 * Browser launcher with stealth mode and anonymization
 * Prevents detection as a bot
 */
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

// Add stealth plugin
puppeteer.use(StealthPlugin());

export interface BrowserConfig {
  headless?: boolean;
  timeout?: number;
  viewport?: {
    width: number;
    height: number;
  };
  userAgent?: string;
  isLambda?: boolean;
}

/**
 * Launch browser with maximum anonymization
 */
export async function launchBrowser(config: BrowserConfig = {}): Promise<Browser> {
  const {
    headless = true,
    viewport = { width: 1920, height: 1080 },
    userAgent,
    isLambda = false,
  } = config;

  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-http2',
    '--disable-blink-features=AutomationControlled',
    '--disable-features=IsolateOrigins,site-per-process',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu',
    // Anonymization
    '--disable-background-networking',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-breakpad',
    '--disable-client-side-phishing-detection',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-domain-reliability',
    '--disable-extensions',
    '--disable-hang-monitor',
    '--disable-ipc-flooding-protection',
    '--disable-popup-blocking',
    '--disable-prompt-on-repost',
    '--disable-renderer-backgrounding',
    '--disable-sync',
    '--disable-translate',
    '--metrics-recording-only',
    '--mute-audio',
    '--no-default-browser-check',
    '--safebrowsing-disable-auto-update',
    '--password-store=basic',
    '--use-mock-keychain',
  ];

  // Add Lambda-specific args
  if (isLambda) {
    args.push(...chromium.args);
  }

  const launchOptions: any = {
    args,
    headless,
    defaultViewport: viewport,
    ignoreHTTPSErrors: true,
  };

  // Set executable path for Lambda
  if (isLambda) {
    launchOptions.executablePath = await chromium.executablePath();
  }

  const browser = await puppeteer.launch(launchOptions);

  return browser as any;
}

/**
 * Create a new page with additional anonymization
 */
export async function createStealthPage(browser: Browser): Promise<Page> {
  const page = await browser.newPage();

  // Set realistic user agent
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  // Set additional headers
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  });

  // Override permissions
  const context = browser.defaultBrowserContext();
  await context.overridePermissions('https://www.cbc.ca', ['geolocation', 'notifications']);

  // Remove webdriver flag
  await page.evaluateOnNewDocument(() => {
    // @ts-ignore
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });

    // @ts-ignore
    window.navigator.chrome = {
      runtime: {},
    };

    // @ts-ignore
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });

    // @ts-ignore
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
  });

  return page;
}
