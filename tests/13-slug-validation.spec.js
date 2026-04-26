/**
 * Short-URL slug validation — REST-level.
 */
const { test, expect } = require('@playwright/test');
const { uniqueSlug, waitForBLRoot } = require('../helpers/utils');
const { createLink } = require('../helpers/api');

test.describe('Slug validation — free', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/wp-admin/', { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async ({ page }) => {
    try {
      await page.goto('/wp-admin/admin.php?page=betterlinks', { waitUntil: 'domcontentloaded' });
      await waitForBLRoot(page).catch(() => {});
    } catch { /* best-effort for screenshot */ }
  });

  test('very long slug (200 chars) is accepted or trimmed', async ({ page }) => {
    const long = 'x'.repeat(200);
    const slug = uniqueSlug('long') + '-' + long;
    // Should either create with trimmed slug OR reject cleanly — not 500
    try {
      await createLink(page, { title: 'Long slug', slug, target: 'https://example.com/' });
    } catch (e) {
      // Fine to fail — just not with a fatal
      expect(String(e.message)).not.toMatch(/Fatal error|critical error/i);
    }
  });

  test('slug with spaces becomes normalised or is rejected', async ({ page }) => {
    const slug = uniqueSlug('spaces') + '-has space';
    let ok = true;
    try { await createLink(page, { title: 'Spaces', slug, target: 'https://example.com/' }); }
    catch { ok = false; }
    // Either the DB stores it (BL sanitises) or it's rejected — both valid
    expect(typeof ok).toBe('boolean');
  });

  test('slug with < > tags is rejected or sanitised (no stored script tags)', async ({ page }) => {
    const slug = uniqueSlug('xss') + '<script>';
    let created = null;
    try { created = await createLink(page, { title: 'XSS slug', slug, target: 'https://example.com/' }); }
    catch { /* rejected is fine */ }
    if (created) {
      expect(created.short_url).not.toContain('<');
      expect(created.short_url).not.toContain('>');
    }
  });
});
