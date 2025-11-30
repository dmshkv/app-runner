/**
 * Simple local test using full puppeteer (includes Chrome)
 * Run: node apps/crawler/dataextractor/src/simple-local-test.js
 */

const puppeteer = require('puppeteer');

async function testCrawler() {
  console.log('🧪 Testing crawler locally with Puppeteer...\n');

  const testUrl = process.argv[2] || 'https://example.com';
  
  console.log(`📍 URL: ${testUrl}\n`);

  let browser;
  try {
    // Launch browser
    console.log('🚀 Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    console.log('✓ Browser launched');
    console.log('✓ Version:', await browser.version());

    // Create new page
    const page = await browser.newPage();

    // Navigate to URL
    console.log(`\n🌐 Navigating to ${testUrl}...`);
    await page.goto(testUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    // Extract data
    const html = await page.content();
    const title = await page.title();

    console.log('\n✅ Success!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📄 Title: ${title}`);
    console.log(`📊 HTML Length: ${html.length} characters`);
    console.log('\n📋 HTML Preview (first 500 chars):');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(html.substring(0, 500) + '...\n');

    await page.close();

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔒 Browser closed\n');
    }
  }
}

testCrawler().catch(console.error);
