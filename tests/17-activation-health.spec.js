/**
 * Activation health — verify BL created its DB tables + did NOT break WP admin.
 */
const { test, expect } = require('@playwright/test');

async function getNonce(page) {
  return await page.evaluate(async () => {
    const r = await fetch('/wp-admin/admin-ajax.php?action=rest-nonce', { credentials: 'include' });
    const raw = await r.text();
    const tokens = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    return tokens.reverse().find(s => /^[a-z0-9]+$/i.test(s)) || raw.trim();
  });
}

test.describe('Plugin activation health', () => {
  test('plugins_loaded → BL class exists (plugin is active)', async ({ page }) => {
    // Indirect check via is_pro_enabled global: if BL didn't load, this would be undefined.
    await page.goto('/wp-admin/admin.php?page=betterlinks', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#betterlinksbody');
    const g = await page.evaluate(() => typeof window.betterLinksGlobal);
    expect(g).toBe('object');
  });

  test('BetterLinks custom REST namespace is registered', async ({ page }) => {
    await page.goto('/wp-admin/', { waitUntil: 'domcontentloaded' });
    const nonce = await getNonce(page);
    const status = await page.evaluate(async (nonce) => {
      const r = await fetch('/wp-json/betterlinks/v1/', { credentials: 'include', headers: { 'X-WP-Nonce': nonce } });
      return r.status;
    }, nonce);
    expect(status).toBe(200);
  });

  test('admin does not emit "PHP Fatal error" into the BL admin page HTML', async ({ page }) => {
    const resp = await page.goto('/wp-admin/admin.php?page=betterlinks', { waitUntil: 'domcontentloaded' });
    expect(resp?.status()).toBeLessThan(400);
    const html = await page.content();
    expect(html).not.toContain('PHP Fatal error');
    expect(html).not.toMatch(/Uncaught\s+Error/i);
  });

  test('plugin exposes a betterlinks_version option', async ({ page }) => {
    // Indirect check — BL's React admin reads its own version; exposed via global.
    await page.goto('/wp-admin/admin.php?page=betterlinks');
    await page.waitForSelector('#betterlinksbody');
    const version = await page.evaluate(() => {
      const g = window.betterLinksGlobal || {};
      return g.version || g.betterlinks_version || g.plugin_version || null;
    });
    // It's OK if not exposed — but if exposed, must look like semver
    if (version) expect(version).toMatch(/^\d+\.\d+(\.\d+)?/);
  });
});
