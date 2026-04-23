/**
 * Link Scanner — free.
 */
const { test, expect } = require('@playwright/test');
const { waitForBLRoot } = require('../helpers/utils');

test.describe('Link Scanner — free', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/wp-admin/admin.php?page=betterlinks-link-scanner', { waitUntil: 'domcontentloaded' });
    await waitForBLRoot(page);
    await page.waitForTimeout(1500);
  });

  test('page renders with expected tabs and Start New Scan button', async ({ page }) => {
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('Fatal error');
    expect(body).not.toContain('There has been a critical error');

    const fullSiteTab = page.locator('li.react-tabs__tab', { hasText: /Full Site Link Scanner/i }).first();
    const brokenLinkTab = page.locator('li.react-tabs__tab', { hasText: /Broken Link Scanner/i }).first();
    await expect(fullSiteTab).toBeVisible({ timeout: 10_000 });
    await expect(brokenLinkTab).toBeVisible();

    await expect(page.getByRole('button', { name: /Start New Scan/i }).first()).toBeVisible();
  });

  test('can switch between scanner tabs', async ({ page }) => {
    const brokenLinkTab = page.locator('li.react-tabs__tab', { hasText: /Broken Link Scanner/i }).first();
    await brokenLinkTab.click();
    await page.waitForTimeout(500);
    const fullSiteTab = page.locator('li.react-tabs__tab', { hasText: /Full Site Link Scanner/i }).first();
    await fullSiteTab.click();
    await page.waitForTimeout(500);
    // Shouldn't error out
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('Fatal error');
  });

  test('Post Types selector is visible', async ({ page }) => {
    // Post type selector appears on Full Site Link Scanner tab
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/Post Type/i);
  });

  test('Clear Logs button is available', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Clear Logs/i }).first()).toBeVisible();
  });
});
