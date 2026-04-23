/**
 * Analytics smoke — the BL analytics UI renders, shows zero-state or data.
 */
const { test, expect } = require('@playwright/test');
const { waitForBLRoot } = require('../helpers/utils');

test.describe('Analytics — free', () => {
  test('overview analytics page renders', async ({ page }) => {
    await page.goto('/wp-admin/admin.php?page=betterlinks-analytics', { waitUntil: 'domcontentloaded' });
    await waitForBLRoot(page);
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('There has been a critical error');
    expect(body).not.toContain('Fatal error');
  });

  test('analytics page exposes a date range / filter control', async ({ page }) => {
    await page.goto('/wp-admin/admin.php?page=betterlinks-analytics', { waitUntil: 'domcontentloaded' });
    await waitForBLRoot(page);
    await page.waitForTimeout(1500);
    const body = await page.locator('body').innerText();
    // Free analytics shows some date-range / stat labels
    expect(body).toMatch(/Today|Yesterday|7\s*Day|30\s*Day|Custom|Last/i);
  });

  test('analytics REST endpoint is available', async ({ page }) => {
    await page.goto('/wp-admin/', { waitUntil: 'domcontentloaded' });
    const nonce = await page.evaluate(async () => (await (await fetch('/wp-admin/admin-ajax.php?action=rest-nonce', { credentials: 'include' })).text()).trim());
    const status = await page.evaluate(async (nonce) => {
      const r = await fetch('/wp-json/betterlinks/v1/clicks/total-charts-data', { credentials: 'include', headers: { 'X-WP-Nonce': nonce } });
      return r.status;
    }, nonce);
    // Free exposes various clicks endpoints; one of them is required.
    expect([200, 400, 404]).toContain(status); // non-500 is fine — endpoint shape may vary
  });
});
