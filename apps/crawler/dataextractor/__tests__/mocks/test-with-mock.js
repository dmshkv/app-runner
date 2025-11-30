/**
 * Test with local HTML file to verify functionality
 * Run: node apps/crawler/dataextractor/src/test-with-mock.js
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function testCrawler() {
  console.log('🧪 Testing crawler with mock HTML...\n');

  // Create a temporary HTML file
  const testHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Page for Crawler</title>
</head>
<body>
    <h1>Hello from Test Page!</h1>
    <p>This is a test page to verify the crawler functionality.</p>
    <div id="content">
        <ul>
            <li>Item 1</li>
            <li>Item 2</li>
            <li>Item 3</li>
        </ul>
    </div>
</body>
</html>
  `;

  const tempFile = path.join(__dirname, 'test-page.html');
  fs.writeFileSync(tempFile, testHtml);
  const testUrl = `file://${tempFile}`;

  let browser;
  try {
    console.log('🚀 Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    console.log('✓ Browser launched');
    console.log('✓ Version:', await browser.version());

    const page = await browser.newPage();

    console.log(`\n🌐 Loading test page...`);
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
    console.log('\n📋 Extracted HTML:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(html);
    console.log('\n✨ Crawler is working correctly!\n');

    await page.close();

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔒 Browser closed\n');
    }
    // Clean up temp file
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
}

testCrawler().catch(console.error);
