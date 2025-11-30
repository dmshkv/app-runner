/**
 * Local test script for the crawler
 * Run with: node apps/crawler/dataextractor/src/local-test.js
 */

const { handler } = require('../main');

async function testCrawler() {
  console.log('Testing crawler locally...\n');

  const testEvent = {
    url: 'https://example.com',
    // Optional: wait for a specific element
    // waitForSelector: 'h1',
    timeout: 30000,
  };

  try {
    const result = await handler(testEvent, {}, () => {});
    console.log('\n✅ Crawling successful!');
    console.log('Result:', JSON.stringify(result, null, 2));
    
    if (result.body && result.body.html) {
      console.log('\n📄 HTML Preview (first 500 chars):');
      console.log(result.body.html.substring(0, 500) + '...');
    }
  } catch (error) {
    console.error('❌ Crawling failed:', error);
    process.exit(1);
  }
}

testCrawler().catch(console.error);
