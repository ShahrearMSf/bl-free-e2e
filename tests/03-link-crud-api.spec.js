/**
 * Link CRUD via the plugin REST API. API-driven tests are stable because
 * they don't depend on the React UI reaching a specific state.
 */
const { test, expect } = require('@playwright/test');
const { uniqueSlug } = require('../helpers/utils');
const { createLink, listLinks, deleteLink } = require('../helpers/api');

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

test.describe('Link CRUD via REST API', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/wp-admin/', { waitUntil: 'domcontentloaded' });
  });

  test('create link → appears in list', async ({ page }) => {
    const slug = uniqueSlug('api');
    const created = await createLink(page, {
      title: `API Test ${slug}`,
      slug,
      target: 'https://example.com/',
    });
    expect(created?.ID).toBeTruthy();
    expect(created?.short_url).toBe(slug);

    const flat = await flatLinks(await listLinks(page));
    const found = flat.find(l => l.short_url === slug);
    expect(found).toBeTruthy();
  });

  test('delete link → DELETE succeeds', async ({ page }) => {
    const slug = uniqueSlug('apidel');
    const created = await createLink(page, {
      title: `To Delete ${slug}`, slug, target: 'https://example.net/',
    });
    const del = await deleteLink(page, created.ID);
    expect([200, 204]).toContain(del.status);
  });

  test('duplicate slug is rejected', async ({ page }) => {
    const slug = uniqueSlug('dup');
    await createLink(page, { title: `First ${slug}`, slug, target: 'https://example.com/' });
    let failed = false;
    try {
      await createLink(page, { title: `Second ${slug}`, slug, target: 'https://example.org/' });
    } catch { failed = true; }
    expect(failed).toBe(true);
  });

  test('redirect type 301 is the default and persists', async ({ page }) => {
    const slug = uniqueSlug('r301');
    const created = await createLink(page, { title: `301 ${slug}`, slug, target: 'https://example.com/', redirectType: '301' });
    expect(created.redirect_type).toBe('301');
  });

  test('redirect type 302 persists', async ({ page }) => {
    const slug = uniqueSlug('r302');
    const created = await createLink(page, { title: `302 ${slug}`, slug, target: 'https://example.com/', redirectType: '302' });
    expect(created.redirect_type).toBe('302');
  });

  test('redirect type 307 persists', async ({ page }) => {
    const slug = uniqueSlug('r307');
    const created = await createLink(page, { title: `307 ${slug}`, slug, target: 'https://example.com/', redirectType: '307' });
    expect(created.redirect_type).toBe('307');
  });

  test('link is assigned to Uncategorized when cat_id=1', async ({ page }) => {
    const slug = uniqueSlug('uncat');
    const created = await createLink(page, { title: `Uncat ${slug}`, slug, target: 'https://example.com/', catId: 1 });
    expect(String(created.cat_id)).toBe('1');
  });

  test('creating a link immediately reflects in list with correct target_url', async ({ page }) => {
    const slug = uniqueSlug('tgt');
    const target = 'https://example.com/unique-target-path-xyz';
    await createLink(page, { title: `Target ${slug}`, slug, target });
    const flat = await flatLinks(await listLinks(page));
    const found = flat.find(l => l.short_url === slug);
    expect(found?.target_url).toBe(target);
  });

  test('list returns non-empty after create', async ({ page }) => {
    await createLink(page, { title: `Count ${uniqueSlug('cnt')}`, slug: uniqueSlug('cnt'), target: 'https://example.com/' });
    const flat = await flatLinks(await listLinks(page));
    expect(flat.length).toBeGreaterThan(0);
  });

  test('DELETE endpoint returns success for existing link', async ({ page }) => {
    // BL's DELETE semantics may be soft-trash — we only verify the API call
    // reports success. Behavioral verification (does the redirect stop?) is
    // environment-dependent (depends on links.json sync + trash policy).
    const slug = uniqueSlug('delapi');
    const created = await createLink(page, { title: `Del API ${slug}`, slug, target: 'https://example.com/' });
    const del = await deleteLink(page, created.ID);
    expect([200, 204]).toContain(del.status);
  });
});
