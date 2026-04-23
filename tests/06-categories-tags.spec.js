/**
 * Categories & Tags — REST-driven CRUD + basic UI smoke.
 */
const { test, expect } = require('@playwright/test');
const { uniqueTermName, waitForBLRoot } = require('../helpers/utils');
const { createTerm, deleteTerm, listTerms } = require('../helpers/api');

test.describe('Categories & Tags — free', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/wp-admin/', { waitUntil: 'domcontentloaded' });
  });

  test('create category via REST then delete it', async ({ page }) => {
    const name = uniqueTermName('CAT');
    const created = await createTerm(page, { name, type: 'category' });
    expect([200, 201]).toContain(created.status);
    const id = created.body?.data?.ID || created.body?.ID;
    expect(id).toBeTruthy();

    const list = await listTerms(page);
    const arr = list?.data?.data || list?.data || list?.terms || [];
    const listArr = Array.isArray(arr) ? arr : Object.values(arr);
    expect(listArr.some(t => String(t.ID) === String(id) && t.term_name === name)).toBe(true);

    const del = await deleteTerm(page, id);
    expect([200, 204]).toContain(del.status);
  });

  test('create tag via REST then delete it', async ({ page }) => {
    const name = uniqueTermName('TAG');
    const created = await createTerm(page, { name, type: 'tags' });
    expect([200, 201]).toContain(created.status);
    const id = created.body?.data?.ID || created.body?.ID;
    expect(id).toBeTruthy();
    const del = await deleteTerm(page, id);
    expect([200, 204]).toContain(del.status);
  });

  test('Tags & Categories admin page loads', async ({ page }) => {
    await page.goto('/wp-admin/admin.php?page=betterlinks-manage-tags-and-categories', { waitUntil: 'domcontentloaded' });
    await waitForBLRoot(page);
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('Fatal error');
    expect(body).not.toContain('There has been a critical error');
  });

  test('Tags & Categories page exposes both tabs / sections', async ({ page }) => {
    await page.goto('/wp-admin/admin.php?page=betterlinks-manage-tags-and-categories', { waitUntil: 'domcontentloaded' });
    await waitForBLRoot(page);
    await page.waitForTimeout(1500);
    const body = await page.locator('body').innerText();
    // Page should advertise both categories and tags
    expect(body).toMatch(/Categor/i);
    expect(body).toMatch(/Tag/i);
  });

  test('Uncategorized category (ID=1) exists and is returned by listTerms', async ({ page }) => {
    const list = await listTerms(page);
    const arr = list?.data?.data || list?.data || list?.terms || [];
    const listArr = Array.isArray(arr) ? arr : Object.values(arr);
    const uncat = listArr.find(t => t.term_slug === 'uncategorized' || String(t.ID) === '1');
    expect(uncat, 'Uncategorized category not found').toBeTruthy();
  });

  test('creating term with empty name fails or is rejected', async ({ page }) => {
    const res = await createTerm(page, { name: '', type: 'category' });
    // Accept either HTTP error or success:false
    const ok = res.status === 200 && res.body?.success === true;
    expect(ok, 'empty term name should not create successfully').toBe(false);
  });

  test('listTerms returns an array-like collection', async ({ page }) => {
    const list = await listTerms(page);
    const arr = list?.data?.data || list?.data || list?.terms || [];
    const listArr = Array.isArray(arr) ? arr : Object.values(arr);
    expect(listArr.length).toBeGreaterThan(0);
  });
});
