/**
 * Network utilities for handling page navigation
 */
import type { Page } from 'puppeteer-core';

export interface NavigationOptions {
  timeout?: number;
  waitForNetworkIdle?: boolean;
  waitForSelector?: string;
}

/**
 * Navigate to URL with retry logic
 */
export async function navigateToPage(
  page: Page,
  url: string,
  options: NavigationOptions = {}
): Promise<void> {
  const { timeout = 30000, waitForNetworkIdle = true, waitForSelector } = options;

  console.log(`Navigating to: ${url}`);

  try {
    await page.goto(url, {
      waitUntil: waitForNetworkIdle ? 'networkidle0' : 'domcontentloaded',
      timeout,
    });

    // Wait for specific selector if provided
    if (waitForSelector) {
      console.log(`Waiting for selector: ${waitForSelector}`);
      await page.waitForSelector(waitForSelector, { timeout });
    }

    console.log('✓ Navigation successful');
  } catch (error) {
    console.error('Navigation failed:', error);
    throw error;
  }
}

/**
 * Block unnecessary resources to speed up loading
 */
export async function blockUnnecessaryResources(page: Page): Promise<void> {
  await page.setRequestInterception(true);

  page.on('request', (request) => {
    const resourceType = request.resourceType();
    const url = request.url();

    // Block ads, analytics, and heavy resources
    const blockedDomains = [
      'google-analytics.com',
      'googletagmanager.com',
      'doubleclick.net',
      'facebook.com',
      'twitter.com',
      'analytics',
      'ads',
    ];

    const shouldBlock =
      ['image', 'stylesheet', 'font', 'media'].includes(resourceType) ||
      blockedDomains.some((domain) => url.includes(domain));

    if (shouldBlock) {
      request.abort();
    } else {
      request.continue();
    }
  });
}
