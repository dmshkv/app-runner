/**
 * HTML parser and selector extraction utilities
 */
import type { Page } from 'puppeteer-core';

export interface ExtractedElement {
  text: string;
  html: string;
  attributes: Record<string, string>;
}

export interface ExtractionResult {
  [key: string]: ExtractedElement | ExtractedElement[] | null;
}

/**
 * Extract elements using CSS selectors
 */
export async function extractSelectors(
  page: Page,
  selectors: Record<string, string>
): Promise<ExtractionResult> {
  const result: ExtractionResult = {};

  for (const [key, selector] of Object.entries(selectors)) {
    try {
      const elements = await page.$$(selector);

      if (elements.length === 0) {
        result[key] = null;
        console.log(`   ${key}: No elements found`);
      } else if (elements.length === 1) {
        // Single element
        const content = await page.$eval(selector, (el) => ({
          text: el.textContent?.trim() || '',
          html: el.innerHTML,
          attributes: Array.from(el.attributes).reduce(
            (acc: Record<string, string>, attr: Attr) => {
              acc[attr.name] = attr.value;
              return acc;
            },
            {}
          ),
        }));
        result[key] = content;
        console.log(`   ${key}: "${content.text.substring(0, 60)}..."`);
      } else {
        // Multiple elements
        const contents = await page.$$eval(selector, (els) =>
          els.map((el) => ({
            text: el.textContent?.trim() || '',
            html: el.innerHTML,
            attributes: Array.from(el.attributes).reduce(
              (acc: Record<string, string>, attr: Attr) => {
                acc[attr.name] = attr.value;
                return acc;
              },
              {}
            ),
          }))
        );
        result[key] = contents;
        console.log(`   ${key}: ${contents.length} elements`);
      }
    } catch (error: any) {
      result[key] = {
        text: '',
        html: '',
        attributes: { error: error.message },
      };
      console.error(`   ${key}: Error - ${error.message}`);
    }
  }

  return result;
}

/**
 * Extract full page HTML
 */
export async function extractHTML(page: Page): Promise<string> {
  return await page.content();
}

/**
 * Take a screenshot
 */
export async function takeScreenshot(
  page: Page,
  fullPage: boolean = false
): Promise<string> {
  const buffer = await page.screenshot({
    type: 'png',
    fullPage,
  });
  return Buffer.from(buffer).toString('base64');
}
