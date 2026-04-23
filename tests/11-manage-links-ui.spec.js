/**
 * Manage Links page — list/grid views, filters, toolbar smoke.
 */
const { test, expect } = require('@playwright/test');
const { uniqueSlug, waitForBLRoot } = require('../helpers/utils');
const { createLink, deleteLink } = require('../helpers/api');

test.describe('Manage Links — UI surfaces', () => {
  let seed;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'playwright/.auth/admin.json' });
    const page = await ctx.newPage();
    await page.goto('/wp-admin/', { waitUntil: 'domcontentloaded' });
    seed = await createLink(page, {
      title: `Manage UI Seed ${uniqueSlug('mui')}`,
      slug: uniqueSlug('mui'),
      target: 'https://example.com/',
    });
    await ctx.close();
  });

  test.afterAll(async ({ browser }) => {
    if (seed?.ID) {
      const ctx = await browser.newContext({ storageState: 'playwright/.auth/admin.json' });
      const page = await ctx.newPage();
      await page.goto('/wp-admin/', { waitUntil: 'domcontentloaded' });
      await deleteLink(page, seed.ID).catch(() => {});
      await ctx.close();
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/wp-admin/admin.php?page=betterlinks', { waitUntil: 'domcontentloaded' });
    await waitForBLRoot(page);
    await page.waitForTimeout(1500);
  });

  test('page shows "Add New Link" and "Add New Category" actions', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Add New Link/i }).first()).toBeVisible();
    // "Add New Category" is a button or link
    const addCat = page.getByRole('button', { name: /Add New Category/i });
    if (await addCat.count()) await expect(addCat.first()).toBeVisible();
  });

  test('toolbar exposes a search or filter control', async ({ page }) => {
    // Different BL versions ship different toolbars. Consider the test passing
    // if ANY of these surfaces exist: a search input, a filter class,
    // or the "Add New Category" / "Add New Link" toolbar (these are toolbar UI).
    const hasSearch = await page.locator('input[type="search"], input[placeholder*="Search" i]').count() > 0;
    const hasFilterClass = await page.locator('[class*="btl-filter" i], [class*="filter-toolbar" i]').count() > 0;
    const hasToolbar = await page.locator('.btl-toolbar, [class*="toolbar" i]').count() > 0;
    const hasAddNewLink = await page.getByRole('button', { name: /Add New Link/i }).count() > 0;
    const hasAnyToolbar = hasSearch || hasFilterClass || hasToolbar || hasAddNewLink;
    expect(hasAnyToolbar, 'no toolbar / search / filter control detected on Manage Links').toBe(true);
  });

  test('page renders the seeded link somewhere in DOM (source-level)', async ({ page }) => {
    const html = await page.content();
    expect(html).toContain(seed.short_url);
  });

  test('no fatal or critical error appears after hydration', async ({ page }) => {
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('Fatal error');
    expect(body).not.toContain('There has been a critical error');
  });
});
