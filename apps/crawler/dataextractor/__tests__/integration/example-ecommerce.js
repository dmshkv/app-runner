/**
 * Real-world example: Scraping an e-commerce product page
 * Run: node apps/crawler/dataextractor/src/example-ecommerce.js [url]
 */

const puppeteer = require('puppeteer');

async function scrapeProduct(url) {
  console.log('🛒 E-commerce Product Scraper\n');
  console.log(`URL: ${url}\n`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    console.log('🌐 Loading page and waiting for JavaScript...');
    await page.goto(url, {
      waitUntil: 'networkidle0', // Wait for all JS/AJAX to complete
      timeout: 30000,
    });

    console.log('✓ Page loaded\n');
    console.log('📊 Extracting product data...\n');

    // Example: Extract common e-commerce elements
    const productData = {
      title: null,
      price: null,
      images: [],
      description: null,
      metadata: {},
    };

    // Try common selectors for product title
    const titleSelectors = ['h1', '.product-title', '[itemprop="name"]', '.title'];
    for (const selector of titleSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          productData.title = await page.$eval(selector, el => el.textContent?.trim());
          console.log(`✓ Found title using "${selector}": ${productData.title}`);
          break;
        }
      } catch (e) {}
    }

    // Try common selectors for price
    const priceSelectors = [
      '.price',
      '[itemprop="price"]',
      '.product-price',
      '.cost',
      '[data-price]'
    ];
    for (const selector of priceSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          productData.price = await page.$eval(selector, el => 
            el.textContent?.trim() || el.getAttribute('content')
          );
          console.log(`✓ Found price using "${selector}": ${productData.price}`);
          break;
        }
      } catch (e) {}
    }

    // Extract all images
    try {
      productData.images = await page.$$eval('img', imgs =>
        imgs
          .map(img => ({
            src: img.src,
            alt: img.alt,
          }))
          .filter(img => img.src && !img.src.includes('data:image'))
          .slice(0, 5) // Limit to first 5 images
      );
      console.log(`✓ Found ${productData.images.length} images`);
    } catch (e) {}

    // Get page metadata
    try {
      productData.metadata = await page.evaluate(() => ({
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.content || '',
        ogTitle: document.querySelector('meta[property="og:title"]')?.content || '',
        ogImage: document.querySelector('meta[property="og:image"]')?.content || '',
      }));
      console.log(`✓ Extracted page metadata`);
    } catch (e) {}

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 Extracted Data:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(JSON.stringify(productData, null, 2));

    await page.close();

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Use command line argument or default URL
const url = process.argv[2] || 'https://www.npmjs.com/package/puppeteer';
scrapeProduct(url).catch(console.error);
