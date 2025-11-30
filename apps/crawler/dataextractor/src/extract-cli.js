#!/usr/bin/env node
/**
 * CLI tool for testing selector extraction
 * 
 * Usage:
 *   node apps/crawler/dataextractor/src/extract-cli.js <url> [options]
 * 
 * Examples:
 *   # Extract full HTML
 *   node apps/crawler/dataextractor/src/extract-cli.js "https://example.com"
 * 
 *   # Extract specific selectors
 *   node apps/crawler/dataextractor/src/extract-cli.js "https://example.com" \
 *     --selector title="h1" \
 *     --selector price=".price" \
 *     --selector features=".features li"
 * 
 *   # With screenshot and no full HTML
 *   node apps/crawler/dataextractor/src/extract-cli.js "https://example.com" \
 *     --selector title="h1" \
 *     --screenshot \
 *     --no-html
 * 
 *   # Wait for specific element
 *   node apps/crawler/dataextractor/src/extract-cli.js "https://example.com" \
 *     --wait-for ".product-loaded" \
 *     --selector title="h1.product-title"
 */

const puppeteer = require('puppeteer');

function parseArgs() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
🕷️  Web Crawler - Selector Extraction CLI

Usage:
  node apps/crawler/dataextractor/src/extract-cli.js <url> [options]

Options:
  --selector <key>=<selector>   Extract element(s) using CSS selector
                                Can be used multiple times
                                Example: --selector title="h1"

  --wait-for <selector>         Wait for this selector before extracting
  --screenshot                  Take a screenshot (saved as base64)
  --no-html                     Don't extract full HTML
  --timeout <ms>                Timeout in milliseconds (default: 30000)
  --no-wait-network             Don't wait for network idle
  --output <file>               Save output to JSON file

Examples:
  # Extract full HTML
  node apps/crawler/dataextractor/src/extract-cli.js "https://example.com"

  # Extract title and price
  node apps/crawler/dataextractor/src/extract-cli.js "https://amazon.com/product" \\
    --selector title="h1#productTitle" \\
    --selector price="span.a-price-whole"

  # Extract multiple items (returns array)
  node apps/crawler/dataextractor/src/extract-cli.js "https://news.ycombinator.com" \\
    --selector headlines=".titleline > a" \\
    --no-html

  # With screenshot
  node apps/crawler/dataextractor/src/extract-cli.js "https://example.com" \\
    --selector title="h1" \\
    --screenshot \\
    --output result.json
`);
    process.exit(0);
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
  };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--selector' && i + 1 < args.length) {
      const selectorArg = args[i + 1];
      const [key, ...rest] = selectorArg.split('=');
      const selector = rest.join('=').replace(/^["']|["']$/g, ''); // Remove quotes
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
    }
  }

  return config;
}

async function extract(config) {
  console.log('🕷️  Web Crawler - Selector Extraction\n');
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
    console.log('🚀 Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-http2', // Fix HTTP/2 protocol errors
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-blink-features=AutomationControlled',
      ],
    });

    const page = await browser.newPage();

    console.log('🌐 Navigating to page...');
    await page.goto(config.url, {
      waitUntil: config.waitForNetworkIdle ? 'networkidle0' : 'domcontentloaded',
      timeout: config.timeout,
    });

    // Wait for specific selector if provided
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

    // Output results
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
