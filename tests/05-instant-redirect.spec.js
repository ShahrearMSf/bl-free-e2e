/**
 * Instant redirect — the core BL value.
 */
const { test, expect, request } = require('@playwright/test');
const { uniqueSlug, waitForBLRoot } = require('../helpers/utils');
const { createLink, deleteLink } = require('../helpers/api');

// Follow the short URL on the test's page fixture so the auto-screenshot
// captures visual proof that the redirect landed on the destination.
async function proveRedirectOnPage(page, slug) {
  try {
    await page.goto(`/${slug}`, { waitUntil: 'domcontentloaded', timeout: 15_000 });
  } catch { /* destination unreachable from CI is fine — screenshot still captures redirected URL */ }
}

test.describe('Instant redirect — free', () => {
  const created = [];

  test.afterAll(async ({ browser }) => {
    if (!created.length) return;
    const ctx = await browser.newContext({ storageState: 'playwright/.auth/admin.json' });
    const page = await ctx.newPage();
    await page.goto('/wp-admin/', { waitUntil: 'domcontentloaded' });
    for (const id of created) await deleteLink(page, id).catch(() => {});
    await ctx.close();
  });

  test('301 short URL redirects to target', async ({ browser, baseURL, page }) => {
    const ctx = await browser.newContext({ storageState: 'playwright/.auth/admin.json' });
    const adminPage = await ctx.newPage();
    await adminPage.goto('/wp-admin/');
    const link = await createLink(adminPage, {
      title: 'Redirect 301', slug: uniqueSlug('r301r'), target: 'https://example.com/one', redirectType: '301',
    });
    created.push(link.ID);
    await ctx.close();

    const api = await request.newContext({ baseURL, ignoreHTTPSErrors: true });
    const resp = await api.get(`/${link.short_url}`, { maxRedirects: 0 });
    expect(resp.status()).toBe(301);
    expect(resp.headers()['location']).toContain('example.com/one');
    await api.dispose();

    await proveRedirectOnPage(page, link.short_url);
  });

  test('302 short URL redirects to target', async ({ browser, baseURL, page }) => {
    const ctx = await browser.newContext({ storageState: 'playwright/.auth/admin.json' });
    const adminPage = await ctx.newPage();
    await adminPage.goto('/wp-admin/');
    const link = await createLink(adminPage, {
      title: 'Redirect 302', slug: uniqueSlug('r302r'), target: 'https://example.com/two', redirectType: '302',
    });
    created.push(link.ID);
    await ctx.close();

    const api = await request.newContext({ baseURL, ignoreHTTPSErrors: true });
    const resp = await api.get(`/${link.short_url}`, { maxRedirects: 0 });
    expect(resp.status()).toBe(302);
    expect(resp.headers()['location']).toContain('example.com/two');
    await api.dispose();

    await proveRedirectOnPage(page, link.short_url);
  });

  test('307 short URL redirects to target', async ({ browser, baseURL, page }) => {
    const ctx = await browser.newContext({ storageState: 'playwright/.auth/admin.json' });
    const adminPage = await ctx.newPage();
    await adminPage.goto('/wp-admin/');
    const link = await createLink(adminPage, {
      title: 'Redirect 307', slug: uniqueSlug('r307r'), target: 'https://example.com/three', redirectType: '307',
    });
    created.push(link.ID);
    await ctx.close();

    const api = await request.newContext({ baseURL, ignoreHTTPSErrors: true });
    const resp = await api.get(`/${link.short_url}`, { maxRedirects: 0 });
    expect(resp.status()).toBe(307);
    expect(resp.headers()['location']).toContain('example.com/three');
    await api.dispose();

    await proveRedirectOnPage(page, link.short_url);
  });

  test('unknown short URL returns 404', async ({ baseURL, page }) => {
    const slug = uniqueSlug('unknown');
    const api = await request.newContext({ baseURL, ignoreHTTPSErrors: true });
    const resp = await api.get(`/${slug}`, { maxRedirects: 0 });
    expect(resp.status()).toBe(404);
    await api.dispose();

    // Visit the unknown URL on the test's page so the screenshot shows the 404
    await proveRedirectOnPage(page, slug);
  });

  test('target URL with query string is preserved', async ({ browser, baseURL, page }) => {
    const ctx = await browser.newContext({ storageState: 'playwright/.auth/admin.json' });
    const adminPage = await ctx.newPage();
    await adminPage.goto('/wp-admin/');
    const link = await createLink(adminPage, {
      title: 'With Query', slug: uniqueSlug('qstr'),
      target: 'https://example.com/path?utm_source=bl&utm_campaign=test',
      redirectType: '301',
    });
    created.push(link.ID);
    await ctx.close();

    const api = await request.newContext({ baseURL, ignoreHTTPSErrors: true });
    const resp = await api.get(`/${link.short_url}`, { maxRedirects: 0 });
    expect([301, 302, 307]).toContain(resp.status());
    const loc = resp.headers()['location'];
    expect(loc).toContain('utm_source=bl');
    expect(loc).toContain('utm_campaign=test');
    await api.dispose();

    await proveRedirectOnPage(page, link.short_url);
  });
});
