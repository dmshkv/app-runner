/**
 * Test selector extraction with JavaScript-rendered content
 * Run: node apps/crawler/dataextractor/src/test-selectors.js
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function testSelectorExtraction() {
  console.log('🧪 Testing Selector Extraction...\n');

  // Create a test page with dynamic content
  const testHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>E-commerce Product Page</title>
</head>
<body>
    <h1 class="product-title">Amazing Laptop</h1>
    <div class="price-container">
        <span class="price" data-currency="USD">$1,299.99</span>
        <span class="discount">20% off</span>
    </div>
    <ul class="features">
        <li>16GB RAM</li>
        <li>512GB SSD</li>
        <li>Intel i7 Processor</li>
    </ul>
    <div id="reviews">
        <div class="review">
            <span class="author">John</span>
            <span class="rating" data-stars="5">⭐⭐⭐⭐⭐</span>
            <p class="comment">Great laptop!</p>
        </div>
        <div class="review">
            <span class="author">Jane</span>
            <span class="rating" data-stars="4">⭐⭐⭐⭐</span>
            <p class="comment">Very good, but pricey</p>
        </div>
    </div>
    
    <script>
        // Simulate dynamic content loading
        setTimeout(() => {
            const stockDiv = document.createElement('div');
            stockDiv.className = 'stock-info';
            stockDiv.innerHTML = '<span class="stock-status">In Stock</span>';
            document.body.appendChild(stockDiv);
        }, 100);
    </script>
</body>
</html>
  `;

  const tempFile = path.join(__dirname, 'test-product-page.html');
  fs.writeFileSync(tempFile, testHtml);
  const testUrl = `file://${tempFile}`;

  let browser;
  try {
    console.log('🚀 Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    console.log('🌐 Loading test page...');
    await page.goto(testUrl, {
      waitUntil: 'networkidle0', // Wait for JS to execute
      timeout: 30000,
    });

    console.log('✓ Page loaded with JavaScript executed\n');

    // Test 1: Extract single element
    console.log('📌 Test 1: Extract product title (single element)');
    const title = await page.$eval('.product-title', (el) => ({
      text: el.textContent?.trim() || '',
      html: el.innerHTML,
    }));
    console.log('  Result:', title);

    // Test 2: Extract with attributes
    console.log('\n📌 Test 2: Extract price with attributes');
    const price = await page.$eval('.price', (el) => ({
      text: el.textContent?.trim() || '',
      attributes: Array.from(el.attributes).reduce(
        (acc, attr) => {
          acc[attr.name] = attr.value;
          return acc;
        },
        {}
      ),
    }));
    console.log('  Result:', price);

    // Test 3: Extract multiple elements (array)
    console.log('\n📌 Test 3: Extract all features (multiple elements)');
    const features = await page.$$eval('.features li', (els) =>
      els.map((el) => ({
        text: el.textContent?.trim() || '',
      }))
    );
    console.log('  Result:', features);

    // Test 4: Extract complex nested structure
    console.log('\n📌 Test 4: Extract reviews (complex structure)');
    const reviews = await page.$$eval('.review', (els) =>
      els.map((el) => ({
        author: el.querySelector('.author')?.textContent?.trim() || '',
        rating: el.querySelector('.rating')?.getAttribute('data-stars') || '',
        comment: el.querySelector('.comment')?.textContent?.trim() || '',
      }))
    );
    console.log('  Result:', reviews);

    // Test 5: Check dynamically loaded content
    console.log('\n📌 Test 5: Extract dynamically loaded stock status');
    const stock = await page.$eval('.stock-status', (el) => ({
      text: el.textContent?.trim() || '',
    }));
    console.log('  Result:', stock);

    console.log('\n✅ All selector extraction tests passed!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Summary:');
    console.log('✓ Single element extraction works');
    console.log('✓ Attribute extraction works');
    console.log('✓ Multiple element extraction works');
    console.log('✓ Complex nested structure extraction works');
    console.log('✓ JavaScript-rendered content extraction works');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await page.close();

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
    // Clean up temp file
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
}

testSelectorExtraction().catch(console.error);
