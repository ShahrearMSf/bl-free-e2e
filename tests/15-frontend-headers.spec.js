/**
 * Frontend redirect headers — verify nofollow, sponsored, and uncloaked
 * behavior end-to-end by curling the short URL.
 *
 * Note: BL's default redirect mode is "cloaked" (301/302/307 to target_url).
 * The nofollow/sponsored flags affect HTML rendering of shortcodes, not the
 * redirect response headers. So these tests are primarily about ensuring the
 * redirect itself still works with options enabled.
 */
const { test, expect, request } = require('@playwright/test');
const { uniqueSlug } = require('../helpers/utils');
const { createLink, getRestNonce, deleteLink } = require('../helpers/api');

async function proveRedirectOnPage(page, slug, query = '') {
  try {
    await page.goto(`/${slug}${query}`, { waitUntil: 'domcontentloaded', timeout: 15_000 });
  } catch { /* destination may be unreachable from CI */ }
}

test.describe('Frontend — redirect with options', () => {
  const trash = [];
  test.afterAll(async ({ browser }) => {
    if (!trash.length) return;
    const ctx = await browser.newContext({ storageState: 'playwright/.auth/admin.json' });
    const page = await ctx.newPage();
    await page.goto('/wp-admin/', { waitUntil: 'domcontentloaded' });
    for (const id of trash) await deleteLink(page, id).catch(() => {});
    await ctx.close();
  });

  async function createWithOpts(page, params) {
    const nonce = await getRestNonce(page);
    return await page.evaluate(async ({ nonce, params }) => {
      const r = await fetch('/wp-json/betterlinks/v1/links', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': nonce },
        body: JSON.stringify({ params }),
      });
      return await r.json();
    }, { nonce, params });
  }

  test('link with nofollow=1 still redirects', async ({ browser, baseURL, page }) => {
    const ctx = await browser.newContext({ storageState: 'playwright/.auth/admin.json' });
    const adminPage = await ctx.newPage();
    await adminPage.goto('/wp-admin/');
    const slug = uniqueSlug('fnf');
    const body = await createWithOpts(adminPage, {
      link_title: `FE NoFollow ${slug}`, short_url: slug, target_url: 'https://example.com/nf',
      redirect_type: '301', link_status: 'publish', cat_id: 1, nofollow: '1',
    });
    trash.push(body.data.ID);
    await ctx.close();

    const api = await request.newContext({ baseURL, ignoreHTTPSErrors: true });
    const resp = await api.get(`/${slug}`, { maxRedirects: 0 });
    expect([301, 302, 307]).toContain(resp.status());
    expect(resp.headers()['location']).toContain('example.com/nf');
    await api.dispose();

    await proveRedirectOnPage(page, slug);
  });

  test('link with param_forwarding=1 preserves incoming query string', async ({ browser, baseURL, page }) => {
    const ctx = await browser.newContext({ storageState: 'playwright/.auth/admin.json' });
    const adminPage = await ctx.newPage();
    await adminPage.goto('/wp-admin/');
    const slug = uniqueSlug('fpfw');
    const body = await createWithOpts(adminPage, {
      link_title: `FE ParamFwd ${slug}`, short_url: slug, target_url: 'https://example.com/path',
      redirect_type: '301', link_status: 'publish', cat_id: 1, param_forwarding: '1',
    });
    trash.push(body.data.ID);
    await ctx.close();

    const api = await request.newContext({ baseURL, ignoreHTTPSErrors: true });
    const resp = await api.get(`/${slug}?utm_source=free-e2e&ref=probe`, { maxRedirects: 0 });
    expect([301, 302, 307]).toContain(resp.status());
    const loc = resp.headers()['location'];
    expect(loc).toMatch(/utm_source=free-e2e/);
    expect(loc).toMatch(/ref=probe/);
    await api.dispose();

    await proveRedirectOnPage(page, slug, '?utm_source=free-e2e&ref=probe');
  });

  test('link with param_forwarding=0 does NOT forward query string', async ({ browser, baseURL, page }) => {
    const ctx = await browser.newContext({ storageState: 'playwright/.auth/admin.json' });
    const adminPage = await ctx.newPage();
    await adminPage.goto('/wp-admin/');
    const slug = uniqueSlug('fnopfw');
    const body = await createWithOpts(adminPage, {
      link_title: `FE NoParamFwd ${slug}`, short_url: slug, target_url: 'https://example.com/clean',
      redirect_type: '301', link_status: 'publish', cat_id: 1, param_forwarding: '',
    });
    trash.push(body.data.ID);
    await ctx.close();

    const api = await request.newContext({ baseURL, ignoreHTTPSErrors: true });
    const resp = await api.get(`/${slug}?utm_source=should-be-stripped`, { maxRedirects: 0 });
    expect([301, 302, 307]).toContain(resp.status());
    const loc = resp.headers()['location'];
    expect(loc).not.toContain('utm_source=should-be-stripped');
    await api.dispose();

    await proveRedirectOnPage(page, slug);
  });
});
