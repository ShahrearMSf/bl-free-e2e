/**
 * Pro upsell — verify the free plugin correctly advertises Pro features when
 * Pro is not installed. Regression guard for accidental removal of upgrade CTAs.
 */
const { test, expect } = require('@playwright/test');
const { waitForBLRoot } = require('../helpers/utils');

test.describe('Pro upsell visibility (free only)', () => {
  test('"Upgrade to Pro" link present on Plugins page', async ({ page }) => {
    await page.goto('/wp-admin/plugins.php', { waitUntil: 'domcontentloaded' });
    const blRow = page.locator('tr[data-slug="betterlinks"]').first();
    await expect(blRow).toBeVisible();

    const upgrade = blRow.getByRole('link', { name: /Upgrade to Pro/i });
    await expect(upgrade).toBeVisible();
    const href = await upgrade.getAttribute('href');
    expect(href).toContain('wpdeveloper.com');
  });

  test('is_pro_enabled global is false on free-only install', async ({ page }) => {
    await page.goto('/wp-admin/admin.php?page=betterlinks', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#betterlinksbody', { state: 'attached' });
    const flag = await page.evaluate(() => window.betterLinksGlobal?.is_pro_enabled);
    expect(flag, 'is_pro_enabled should be false when Pro is not installed').toBeFalsy();
  });

test('Advanced Options tab shows Pro-only features by label', async ({ page }) => {
    await page.goto('/wp-admin/admin.php?page=betterlinks-settings', { waitUntil: 'domcontentloaded' });
    await waitForBLRoot(page);
    await page.waitForTimeout(1500);
    const advTab = page.getByRole('tab', { name: /Advanced Options/i });
    if (await advTab.count() === 0) test.skip(true, 'no Advanced Options tab in this install');
    await advTab.click();
    await page.waitForTimeout(800);
    const panel = page.locator('.react-tabs__tab-panel--selected, [role="tabpanel"][aria-selected="true"]').first();
    const text = await panel.innerText();
    // Free ships Pro-only feature headings but they should be present in the advertising surface
    const proFeatures = [
      /Affiliate Link Disclosure/i,
      /Password Protected Redirect/i,
      /Customize Link Preview/i,
      /Auto-Link Keywords/i,
    ];
    for (const re of proFeatures) {
      expect(text, `Advanced Options missing Pro advertise: ${re}`).toMatch(re);
    }
  });

  test('link create modal surfaces Pro-only panels (accordion headings)', async ({ page }) => {
    await page.goto('/wp-admin/admin.php?page=betterlinks', { waitUntil: 'domcontentloaded' });
    await waitForBLRoot(page);
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: /Add New Link/i }).first().click();
    await page.waitForTimeout(1000);

    const modal = page.locator('.ReactModalPortal, [class*="Modal__Content"]').first();
    const text = await modal.innerText();
    // Free surfaces these Pro feature headings inside the modal's accordion
    const expected = [
      /Dynamic Redirects/i,
      /Customize Link Preview/i,
      /Custom Tracking Scripts/i,
      /Auto-Link Keywords/i,
    ];
    for (const re of expected) {
      expect(text, `modal missing Pro feature accordion: ${re}`).toMatch(re);
    }
  });
});
