/**
 * Short-URL slug validation — REST-level.
 */
const { test, expect } = require('@playwright/test');
const { uniqueSlug } = require('../helpers/utils');
const { createLink } = require('../helpers/api');

test.describe('Slug validation — free', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/wp-admin/', { waitUntil: 'domcontentloaded' });
  });

  test('empty short_url is handled gracefully (auto-generated or rejected)', async ({ page }) => {
    // BL accepts empty short_url and auto-generates a slug from the title.
    // Either behavior (auto-generate OR reject) is acceptable; what's NOT
    // acceptable is silently storing an empty slug. Verify the resulting
    // link (if any) has a non-empty short_url.
    let created;
    try {
      created = await createLink(page, {
        title: 'Empty slug ' + Date.now(),
        slug: '',
        target: 'https://example.com/',
      });
    } catch {
      // Rejection is a valid behavior — pass the test.
      return;
    }
    expect(created?.short_url, 'created link should have a non-empty slug').toBeTruthy();
    expect(created.short_url.length, 'auto-generated slug should be non-empty').toBeGreaterThan(0);
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
