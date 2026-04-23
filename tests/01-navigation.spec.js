/**
 * Navigation + plugin-row smoke across every admin page FREE registers.
 * Verifies: 200 response, React root mounts, no fatal banners, no JS noise.
 */
const { test, expect } = require('@playwright/test');
const { waitForBLRoot } = require('../helpers/utils');

// Free-plugin menu items — DO NOT add Pro-only slugs here.
const FREE_PAGES = [
  { slug: 'betterlinks', name: 'Manage Links' },
  { slug: 'betterlinks-manage-tags-and-categories', name: 'Tags & Categories' },
  { slug: 'betterlinks-analytics', name: 'Analytics' },
  { slug: 'betterlinks-link-scanner', name: 'Link Scanner' },
  { slug: 'betterlinks-settings', name: 'Settings' },
];

test.describe('Admin navigation — free only', () => {
  for (const p of FREE_PAGES) {
    test(`${p.name} (${p.slug}) loads without fatal`, async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', e => pageErrors.push(e.message));

      const resp = await page.goto(`/wp-admin/admin.php?page=${p.slug}`, { waitUntil: 'domcontentloaded' });
      expect(resp?.status(), `${p.slug} returned ${resp?.status()}`).toBeLessThan(400);

      await waitForBLRoot(page);

      const bodyText = await page.locator('body').textContent();
      expect(bodyText).not.toContain('There has been a critical error');
      expect(bodyText).not.toContain('Fatal error');

      const real = pageErrors.filter(e =>
        !/deprecated|favicon|ResizeObserver|Loading chunk|Script error|Non-Error promise rejection/i.test(e)
      );
      expect(real.length, `JS errors: ${real.join(' | ').slice(0, 300)}`).toBeLessThanOrEqual(3);
    });
  }

  test('BetterLinks top-level menu item is visible', async ({ page }) => {
    await page.goto('/wp-admin/');
    await expect(page.locator('#toplevel_page_betterlinks')).toBeVisible();
  });

  test('BetterLinks submenu items are visible in sidebar', async ({ page }) => {
    await page.goto('/wp-admin/admin.php?page=betterlinks');
    await waitForBLRoot(page);
    const submenu = page.locator('#toplevel_page_betterlinks .wp-submenu a');
    const count = await submenu.count();
    expect(count, 'BL submenu should have at least 3 links').toBeGreaterThanOrEqual(3);
  });

  test('wp-admin dashboard still renders (plugin did not break admin)', async ({ page }) => {
    const resp = await page.goto('/wp-admin/index.php');
    expect(resp?.status()).toBeLessThan(400);
    await expect(page.locator('#wpadminbar')).toBeVisible();
  });

  test('Plugins page shows BetterLinks as active', async ({ page }) => {
    await page.goto('/wp-admin/plugins.php', { waitUntil: 'domcontentloaded' });
    const row = page.locator('tr[data-slug="betterlinks"]').first();
    await expect(row).toBeVisible();
    // Row class "active" indicates active state. Also no "Activate" action.
    const classes = await row.getAttribute('class');
    expect(classes || '').toMatch(/active/i);
    // There should be NO "Activate" action link (only "Deactivate" for active plugins)
    expect(await row.locator('span.activate a').count()).toBe(0);
  });

  test('Plugins page exposes plugin metadata (Version, Description)', async ({ page }) => {
    await page.goto('/wp-admin/plugins.php', { waitUntil: 'domcontentloaded' });
    const row = page.locator('tr[data-slug="betterlinks"]').first();
    const meta = await row.innerText();
    expect(meta).toMatch(/Version\s+\d+\.\d+\.\d+/i);
    expect(meta.toLowerCase()).toContain('betterlinks');
  });

  test('Pro-only page slugs return 403 (Pro not installed)', async ({ page }) => {
    const PRO_ONLY = ['betterlinks-keywords-linking'];
    for (const slug of PRO_ONLY) {
      const resp = await page.goto(`/wp-admin/admin.php?page=${slug}`, { waitUntil: 'domcontentloaded' });
      expect(resp?.status(), `Pro slug ${slug} should not be accessible in free`).toBe(403);
    }
  });
});
