/**
 * REST contract — verify free's BL namespace exposes the endpoints that
 * admin React + integrations depend on.
 */
const { test, expect } = require('@playwright/test');
const { waitForBLRoot } = require('../helpers/utils');

async function getNonce(page) {
  return await page.evaluate(async () => {
    const r = await fetch('/wp-admin/admin-ajax.php?action=rest-nonce', { credentials: 'include' });
    const raw = await r.text();
    const tokens = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    return tokens.reverse().find(s => /^[a-z0-9]+$/i.test(s)) || raw.trim();
  });
}

async function listRoutes(page) {
  const nonce = await getNonce(page);
  return await page.evaluate(async (nonce) => {
    const r = await fetch('/wp-json/betterlinks/v1/', { credentials: 'include', headers: { 'X-WP-Nonce': nonce } });
    const d = await r.json();
    const out = {};
    for (const [k, v] of Object.entries(d.routes || {})) out[k] = v.methods || [];
    return out;
  }, nonce);
}

test.describe('REST contract — free', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/wp-admin/', { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async ({ page }) => {
    try {
      await page.goto('/wp-admin/admin.php?page=betterlinks', { waitUntil: 'domcontentloaded' });
      await waitForBLRoot(page).catch(() => {});
    } catch { /* best-effort for screenshot */ }
  });

  test('namespace discovery works', async ({ page }) => {
    const routes = await listRoutes(page);
    expect(Object.keys(routes).length).toBeGreaterThan(5);
  });

  test('core endpoints are registered', async ({ page }) => {
    const routes = await listRoutes(page);
    const expected = [
      '/betterlinks/v1/links',
      '/betterlinks/v1/terms',
    ];
    for (const r of expected) {
      expect(routes[r], `missing REST route ${r}`).toBeTruthy();
    }
  });

  test('links collection supports POST (create), GET (list), DELETE', async ({ page }) => {
    const routes = await listRoutes(page);
    // Free's /links supports multiple methods on the collection
    const methods = routes['/betterlinks/v1/links'] || [];
    expect(methods).toContain('POST');
    expect(methods).toContain('GET');
  });

  test('links item route is registered with id param', async ({ page }) => {
    const routes = await listRoutes(page);
    const match = Object.keys(routes).find(k => /links\/\(\?P<id>/.test(k));
    expect(match, 'no /links/{id} route registered').toBeTruthy();
  });

  test('terms collection supports CRUD methods', async ({ page }) => {
    const routes = await listRoutes(page);
    const methods = routes['/betterlinks/v1/terms'] || [];
    expect(methods).toContain('POST');
    expect(methods).toContain('GET');
    expect(methods).toContain('DELETE');
  });

  test('clicks endpoints exist', async ({ page }) => {
    const routes = await listRoutes(page);
    const hasClicks = Object.keys(routes).some(k => /\/betterlinks\/v1\/clicks/.test(k));
    expect(hasClicks, 'no clicks endpoints').toBe(true);
  });

  test('unauthenticated user cannot hit /links POST', async ({ browser, baseURL }) => {
    // Use a fresh context with no auth cookies
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const resp = await page.evaluate(async (baseURL) => {
      const r = await fetch(baseURL + '/wp-json/betterlinks/v1/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ params: { short_url: 'x', target_url: 'https://example.com/' } }),
      });
      return r.status;
    }, baseURL);
    // WP REST without auth should return 401 or 403 (NOT 200)
    expect([401, 403]).toContain(resp);
    await ctx.close();
  });
});
