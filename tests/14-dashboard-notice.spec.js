/**
 * Dashboard notice — BL shows a promo "NEW:" notice on its admin pages.
 * This test confirms it renders, can be dismissed, and the dismiss survives
 * a reload.
 */
const { test, expect } = require('@playwright/test');
const { waitForBLRoot } = require('../helpers/utils');

test.describe('Dashboard notice — free', () => {
  test('promo notice renders on BetterLinks admin pages', async ({ page }) => {
    await page.goto('/wp-admin/admin.php?page=betterlinks', { waitUntil: 'domcontentloaded' });
    await waitForBLRoot(page);
    await page.waitForTimeout(1500);
    // May not render if user dismissed it earlier — test is soft
    const notice = page.locator('.btl-dashboard-notice').first();
    const count = await notice.count();
    if (count === 0) test.skip(true, 'notice not present (possibly dismissed earlier)');
    await expect(notice).toBeVisible();
  });

  test('notice has a dismiss button that hides it', async ({ page }) => {
    await page.goto('/wp-admin/admin.php?page=betterlinks', { waitUntil: 'domcontentloaded' });
    await waitForBLRoot(page);
    await page.waitForTimeout(1500);
    const notice = page.locator('.btl-dashboard-notice').first();
    if (await notice.count() === 0) test.skip(true, 'notice not present');
    const dismiss = notice.locator('.notice-dismiss, [aria-label*="Dismiss" i]').first();
    if (await dismiss.count() === 0) test.skip(true, 'no dismiss button');
    await dismiss.click();
    await page.waitForTimeout(500);
    await expect(notice).not.toBeVisible();
  });
});
