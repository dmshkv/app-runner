#!/usr/bin/env node
/**
 * Refactored CLI with stealth mode and modular architecture
 * Maximum anonymity and bot detection prevention
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Add stealth plugin
puppeteer.use(StealthPlugin());

function showHelp() {
  console.log(`
🕷️  Anonymous Web Crawler - Stealth Mode Enabled

Usage:
  node apps/crawler/dataextractor/src/cli.js <url> [options]

Options:
  --selector <key>=<selector>   Extract element(s) using CSS selector
  --wait-for <selector>         Wait for this selector before extracting
  --screenshot                  Take a screenshot
  --no-html                     Don't extract full HTML
  --timeout <ms>                Timeout in milliseconds (default: 30000)
  --no-wait-network             Don't wait for network idle
  --output <file>               Save output to JSON file
  --fast                        Block images/stylesheets for faster loading

Examples:
  # Extract news headlines
  node apps/crawler/dataextractor/src/cli.js "https://www.cbc.ca/news" \\
    --selector headlines="h3 a" \\
    --fast --no-html

  # Full extraction with screenshot
  node apps/crawler/dataextractor/src/cli.js "https://example.com" \\
    --selector title="h1" \\
    --screenshot \\
    --output result.json
`);
  process.exit(0);
}

function parseArgs() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp();
  }

  const config = {
    url: args[0],
    selectors: {},
    waitForSelector: null,
    screenshot: false,
    extractFullHtml: true,
    timeout: 30000,
    waitForNetworkIdle: true,
    outputFile: null,
    fastMode: false,
  };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--selector' && i + 1 < args.length) {
      const selectorArg = args[i + 1];
      const [key, ...rest] = selectorArg.split('=');
      const selector = rest.join('=').replace(/^["']|["']$/g, '');
      config.selectors[key] = selector;
      i++;
    } else if (arg === '--wait-for' && i + 1 < args.length) {
      config.waitForSelector = args[i + 1].replace(/^["']|["']$/g, '');
      i++;
    } else if (arg === '--screenshot') {
      config.screenshot = true;
    } else if (arg === '--no-html') {
      config.extractFullHtml = false;
    } else if (arg === '--timeout' && i + 1 < args.length) {
      config.timeout = parseInt(args[i + 1], 10);
      i++;
    } else if (arg === '--no-wait-network') {
      config.waitForNetworkIdle = false;
    } else if (arg === '--output' && i + 1 < args.length) {
      config.outputFile = args[i + 1];
      i++;
    } else if (arg === '--fast') {
      config.fastMode = true;
    }
  }

  return config;
}

async function extract(config) {
  console.log('🕷️  Anonymous Web Crawler - Stealth Mode\n');
  console.log(`📍 URL: ${config.url}`);
  
  if (Object.keys(config.selectors).length > 0) {
    console.log(`🎯 Selectors:`);
    Object.entries(config.selectors).forEach(([key, selector]) => {
      console.log(`   ${key}: "${selector}"`);
    });
  }
  
  console.log('');

  let browser;
  try {
    console.log('🚀 Launching stealth browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: [
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
        // Maximum anonymization
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-sync',
        '--disable-translate',
        '--hide-scrollbars',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-default-browser-check',
        '--safebrowsing-disable-auto-update',
      ],
      defaultViewport: {
        width: 1920,
        height: 1080,
      },
    });

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
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
      window.navigator.chrome = { runtime: {} };
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
    });

    // Block resources in fast mode
    if (config.fastMode) {
      console.log('⚡ Fast mode: Blocking images, stylesheets, fonts...');
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const resourceType = request.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          request.abort();
        } else {
          request.continue();
        }
      });
    }

    console.log('🌐 Navigating to page...');
    await page.goto(config.url, {
      waitUntil: config.waitForNetworkIdle ? 'networkidle0' : 'domcontentloaded',
      timeout: config.timeout,
    });

    if (config.waitForSelector) {
      console.log(`⏳ Waiting for selector: ${config.waitForSelector}`);
      await page.waitForSelector(config.waitForSelector, { timeout: config.timeout });
    }

    console.log('✓ Page loaded\n');

    const response = {
      url: config.url,
      title: await page.title(),
      timestamp: new Date().toISOString(),
    };

    // Extract selectors
    if (Object.keys(config.selectors).length > 0) {
      console.log('📊 Extracting selectors...');
      response.extracted = {};

      for (const [key, selector] of Object.entries(config.selectors)) {
        try {
          const elements = await page.$$(selector);

          if (elements.length === 0) {
            response.extracted[key] = null;
            console.log(`   ${key}: No elements found`);
          } else if (elements.length === 1) {
            const content = await page.$eval(selector, (el) => ({
              text: el.textContent?.trim() || '',
              html: el.innerHTML,
              attributes: Array.from(el.attributes).reduce((acc, attr) => {
                acc[attr.name] = attr.value;
                return acc;
              }, {}),
            }));
            response.extracted[key] = content;
            console.log(`   ${key}: "${content.text.substring(0, 60)}${content.text.length > 60 ? '...' : ''}"`);
          } else {
            const contents = await page.$$eval(selector, (els) =>
              els.map((el) => ({
                text: el.textContent?.trim() || '',
                html: el.innerHTML,
                attributes: Array.from(el.attributes).reduce((acc, attr) => {
                  acc[attr.name] = attr.value;
                  return acc;
                }, {}),
              }))
            );
            response.extracted[key] = contents;
            console.log(`   ${key}: ${contents.length} elements`);
          }
        } catch (error) {
          response.extracted[key] = { error: error.message };
          console.log(`   ${key}: Error - ${error.message}`);
        }
      }
      console.log('');
    }

    // Extract full HTML
    if (config.extractFullHtml) {
      console.log('📄 Extracting full HTML...');
      const html = await page.content();
      response.html = html;
      response.htmlLength = html.length;
      console.log(`   ${html.length} characters\n`);
    }

    // Take screenshot
    if (config.screenshot) {
      console.log('📸 Taking screenshot...');
      const screenshotBuffer = await page.screenshot({
        type: 'png',
        fullPage: false,
      });
      response.screenshot = screenshotBuffer.toString('base64');
      response.screenshotSize = screenshotBuffer.length;
      console.log(`   ${screenshotBuffer.length} bytes\n`);
    }

    await page.close();

    console.log('✅ Extraction complete!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 Results:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (config.outputFile) {
      const fs = require('fs');
      fs.writeFileSync(config.outputFile, JSON.stringify(response, null, 2));
      console.log(`\n💾 Saved to: ${config.outputFile}`);
    } else {
      console.log(JSON.stringify(response, null, 2));
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

const config = parseArgs();
extract(config).catch(console.error);
