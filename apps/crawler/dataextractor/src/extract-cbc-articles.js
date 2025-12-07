/**
 * Extract article links from CBC.ca
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function extractArticles(url) {
  console.log(`🕷️  Crawling: ${url}`);
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
    console.log('');

    // Extract article links
    console.log('🔍 Extracting article links...');
    const articles = await page.evaluate(() => {
      const links = [];
      
      // Common CBC article link selectors
      const articleLinks = document.querySelectorAll('a[href*="/news/"]');
      
      const seenUrls = new Set();
      
      articleLinks.forEach((link) => {
        const href = link.href;
        const text = link.textContent.trim();
        
        // Filter out navigation links, empty links, and duplicates
        if (
          href &&
          !href.includes('#') &&
          !href.includes('?') &&
          href.match(/\/news\/.*-\d+\.\d+$/) && // CBC article pattern
          text.length > 10 &&
          !seenUrls.has(href)
        ) {
          seenUrls.add(href);
          
          // Get headline from link or nearby heading
          let headline = text;
          const parent = link.closest('article, div, li');
          if (parent) {
            const heading = parent.querySelector('h2, h3, h4');
            if (heading) {
              headline = heading.textContent.trim();
            }
          }
          
          links.push({
            url: href,
            headline: headline.substring(0, 200), // Limit length
          });
        }
      });
      
      return links;
    });

    console.log(`✅ Found ${articles.length} articles`);
    console.log('');
    
    // Display articles
    articles.slice(0, 10).forEach((article, i) => {
      console.log(`${i + 1}. ${article.headline}`);
      console.log(`   ${article.url}`);
      console.log('');
    });
    
    if (articles.length > 10) {
      console.log(`... and ${articles.length - 10} more articles`);
      console.log('');
    }

    await page.close();

    return {
      success: true,
      url,
      title,
      articles,
      totalArticles: articles.length,
    };
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

// Run
const testUrl = process.argv[2] || 'https://www.cbc.ca';

console.log('🧪 CBC Article Extractor');
console.log('========================');
console.log('');

extractArticles(testUrl)
  .then(result => {
    console.log('---');
    console.log(`✅ Successfully extracted ${result.totalArticles} articles`);
    
    // Save to file
    const fs = require('fs');
    const filename = 'cbc-articles.json';
    fs.writeFileSync(filename, JSON.stringify(result, null, 2));
    console.log(`📄 Results saved to: ${filename}`);
    
    process.exit(0);
  })
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
