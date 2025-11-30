/**
 * Simple test for local development
 * This version uses a local Chromium installation for faster testing
 */
import puppeteer from 'puppeteer-core';

async function quickTest() {
  console.log('🧪 Quick local test (using system Chrome/Chromium)...\n');

  const testUrl = 'https://example.com';

  try {
    // For local testing, you can use your system's Chrome
    // On macOS: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    // Or use puppeteer (not puppeteer-core) which includes Chrome
    
    console.log('Note: This test requires Chrome/Chromium installed locally');
    console.log('For full Lambda test with @sparticuz/chromium, use local-test.ts\n');
    
    console.log(`Testing URL: ${testUrl}`);
    console.log('To test the actual Lambda handler with @sparticuz/chromium:');
    console.log('  npx ts-node apps/crawler/dataextractor/src/local-test.ts\n');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

quickTest();
