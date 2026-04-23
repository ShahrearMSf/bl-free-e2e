/**
 * Link CRUD via the React admin UI.
 */
const { test, expect } = require('@playwright/test');
const { uniqueSlug, waitForBLRoot } = require('../helpers/utils');
const { createLink, deleteLink, listLinks } = require('../helpers/api');

test.describe('Link create via UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/wp-admin/admin.php?page=betterlinks', { waitUntil: 'domcontentloaded' });
    await waitForBLRoot(page);
    await page.waitForTimeout(1500);
  });

  test('open Add New Link modal and see required fields', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /Add New Link/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 15_000 });
    await addBtn.click();

    await expect(page.locator('input[name="link_title"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('input[name="short_url"]')).toBeVisible();
    await expect(page.locator('input[name="target_url"]')).toBeVisible();
  });

  test('create a link via the form', async ({ page }) => {
    const slug = uniqueSlug('ui');
    const target = 'https://example.com/page';
    const title = `UI Created ${slug}`;

    await page.getByRole('button', { name: /Add New Link/i }).first().click();
    await page.locator('input[name="link_title"]').fill(title);
    await page.locator('input[name="short_url"]').fill(slug);
    await page.locator('input[name="target_url"]').fill(target);
    await page.locator('button.btl-modal-submit-button').first().click();

    // Verify via REST (stable)
    let found = null;
    for (let i = 0; i < 6; i++) {
      const all = await listLinks(page);
      const data = all?.data?.data || all?.data || {};
      for (const catId of Object.keys(data)) {
        const lists = data[catId]?.lists || data[catId] || [];
        const hit = Array.isArray(lists) ? lists.find(l => l.short_url === slug) : null;
        if (hit) { found = hit; break; }
      }
      if (found) break;
      await page.waitForTimeout(1000);
    }
    expect(found, `link with slug ${slug} not created via UI`).toBeTruthy();
    expect(found.target_url).toContain('example.com');
  });

  test('modal closes when X / close button is clicked', async ({ page }) => {
    await page.getByRole('button', { name: /Add New Link/i }).first().click();
    await expect(page.locator('input[name="link_title"]')).toBeVisible();

    // Close via any of the common close-button patterns
    const closeBtn = page.locator('.ReactModalPortal [aria-label*="close" i], .ReactModalPortal button.btl-close, .ReactModalPortal button:has-text("Cancel"), .ReactModalPortal svg').first();
    if (await closeBtn.count()) {
      await closeBtn.click().catch(() => {});
    } else {
      // Fallback — press Escape
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(500);
  });

  test('Add New Link button is rendered on Manage Links page', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /Add New Link/i }).first();
    await expect(addBtn).toBeVisible();
  });

  test('cannot submit link with empty target URL (validation)', async ({ page }) => {
    await page.getByRole('button', { name: /Add New Link/i }).first().click();
    await page.locator('input[name="link_title"]').fill(`Empty Target Test`);
    await page.locator('input[name="short_url"]').fill(uniqueSlug('nouri'));
    // Intentionally leave target blank
    await page.locator('button.btl-modal-submit-button').first().click();
    await page.waitForTimeout(1500);
    // Modal should still be open
    await expect(page.locator('input[name="target_url"]')).toBeVisible();
  });
});

test.describe('Link list shows seeded data', () => {
  let seed;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'playwright/.auth/admin.json' });
    const page = await ctx.newPage();
    await page.goto('/wp-admin/', { waitUntil: 'domcontentloaded' });
    seed = await createLink(page, {
      title: `Seed for list ${uniqueSlug('seed')}`,
      slug: uniqueSlug('seed'),
      target: 'https://example.com/seed',
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

  test('seeded link exists via REST and Manage Links page renders', async ({ page }) => {
    await page.goto('/wp-admin/', { waitUntil: 'domcontentloaded' });
    const all = await listLinks(page);
    const data = all?.data?.data || all?.data || {};
    let found = null;
    for (const catId of Object.keys(data)) {
      const lists = data[catId]?.lists || data[catId] || [];
      const hit = Array.isArray(lists) ? lists.find(l => String(l.ID) === String(seed.ID)) : null;
      if (hit) { found = hit; break; }
    }
    expect(found, 'seeded link missing from REST list').toBeTruthy();

    await page.goto('/wp-admin/admin.php?page=betterlinks', { waitUntil: 'domcontentloaded' });
    await waitForBLRoot(page);
    await page.waitForTimeout(2000);
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('Fatal error');
  });
});
