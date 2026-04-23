/**
 * Link options via REST — nofollow, sponsored, param_forwarding, track_me,
 * uncloaked. Free supports all of these at the DB/REST layer.
 */
const { test, expect } = require('@playwright/test');
const { uniqueSlug } = require('../helpers/utils');
const { createLink, getRestNonce, listLinks } = require('../helpers/api');

async function flatLinks(list) {
  const flat = [];
  const data = list?.data?.data || list?.data || {};
  for (const catId of Object.keys(data)) {
    const bucket = data[catId];
    const lists = bucket?.lists || bucket || [];
    if (Array.isArray(lists)) for (const it of lists) flat.push(it);
  }
  return flat;
}

async function createLinkWithOptions(page, params) {
  const nonce = await getRestNonce(page);
  return await page.evaluate(async ({ nonce, params }) => {
    const r = await fetch('/wp-json/betterlinks/v1/links', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': nonce },
      body: JSON.stringify({ params }),
    });
    const body = await r.json();
    if (!r.ok || !body.success) throw new Error(`create failed (${r.status}): ${JSON.stringify(body).slice(0, 300)}`);
    return body.data;
  }, { nonce, params });
}

test.describe('Link options via REST — free', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/wp-admin/', { waitUntil: 'domcontentloaded' });
  });

  test('nofollow=1 persists', async ({ page }) => {
    const slug = uniqueSlug('nf');
    const created = await createLinkWithOptions(page, {
      link_title: `Nofollow ${slug}`, short_url: slug, target_url: 'https://example.com/',
      redirect_type: '301', link_status: 'publish', cat_id: 1, nofollow: '1',
    });
    const flat = await flatLinks(await listLinks(page));
    const found = flat.find(l => l.short_url === slug);
    expect(String(found?.nofollow)).toBe('1');
  });

  test('sponsored=1 persists', async ({ page }) => {
    const slug = uniqueSlug('sp');
    await createLinkWithOptions(page, {
      link_title: `Sponsored ${slug}`, short_url: slug, target_url: 'https://example.com/',
      redirect_type: '301', link_status: 'publish', cat_id: 1, sponsored: '1',
    });
    const flat = await flatLinks(await listLinks(page));
    const found = flat.find(l => l.short_url === slug);
    expect(String(found?.sponsored)).toBe('1');
  });

  test('param_forwarding=1 persists', async ({ page }) => {
    const slug = uniqueSlug('pfw');
    await createLinkWithOptions(page, {
      link_title: `ParamFwd ${slug}`, short_url: slug, target_url: 'https://example.com/',
      redirect_type: '301', link_status: 'publish', cat_id: 1, param_forwarding: '1',
    });
    const flat = await flatLinks(await listLinks(page));
    const found = flat.find(l => l.short_url === slug);
    expect(String(found?.param_forwarding)).toBe('1');
  });

  test('track_me=0 persists (tracking disabled)', async ({ page }) => {
    const slug = uniqueSlug('ntr');
    await createLinkWithOptions(page, {
      link_title: `NoTrack ${slug}`, short_url: slug, target_url: 'https://example.com/',
      redirect_type: '301', link_status: 'publish', cat_id: 1, track_me: '0',
    });
    const flat = await flatLinks(await listLinks(page));
    const found = flat.find(l => l.short_url === slug);
    expect(String(found?.track_me)).toBe('0');
  });

  test('multiple options combine (nofollow + sponsored + param_forwarding)', async ({ page }) => {
    const slug = uniqueSlug('multi');
    await createLinkWithOptions(page, {
      link_title: `Multi ${slug}`, short_url: slug, target_url: 'https://example.com/',
      redirect_type: '301', link_status: 'publish', cat_id: 1,
      nofollow: '1', sponsored: '1', param_forwarding: '1',
    });
    const flat = await flatLinks(await listLinks(page));
    const found = flat.find(l => l.short_url === slug);
    expect(String(found?.nofollow)).toBe('1');
    expect(String(found?.sponsored)).toBe('1');
    expect(String(found?.param_forwarding)).toBe('1');
  });
});
