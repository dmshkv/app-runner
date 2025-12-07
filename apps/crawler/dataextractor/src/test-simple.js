/**
 * Simple local test without SQS/SNS
 * Just tests the core crawling functionality
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function testCrawl(url) {
  console.log(`🕷️  Testing crawl: ${url}`);
  console.log('');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    );

    console.log('Navigating to URL...');
    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    const title = await page.title();
    console.log(`✅ Page title: ${title}`);

    // Extract h1
    const h1Text = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      return h1 ? h1.textContent.trim() : null;
    });
    console.log(`✅ H1 text: ${h1Text}`);

    // Extract all paragraphs
    const paragraphs = await page.evaluate(() => {
      const ps = Array.from(document.querySelectorAll('p'));
      return ps.slice(0, 3).map(p => p.textContent.trim());
    });
    console.log(`✅ First 3 paragraphs:`);
    paragraphs.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.substring(0, 100)}...`);
    });

    // Get HTML length
    const html = await page.content();
    console.log(`✅ HTML length: ${html.length} characters`);

    await page.close();

    console.log('');
    console.log('✅ Test completed successfully!');
    
    return {
      success: true,
      url,
      title,
      h1Text,
      paragraphCount: paragraphs.length,
      htmlLength: html.length,
    };
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

// Run test
const testUrl = process.argv[2] || 'https://example.com';

console.log('🧪 Local Crawler Test');
console.log('======================');
console.log('');

testCrawl(testUrl)
  .then(result => {
    console.log('');
    console.log('Result:', JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
