/**
 * Sweep helper — removes any BetterLinks data whose slug/name starts with the
 * TEST_SLUG_PREFIX. Used by globalSetup (pre-run) and globalTeardown (post-run)
 * so a re-run always starts from a clean slate without touching user data.
 */
const { chromium } = require('@playwright/test');
require('dotenv').config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin';
const PREFIX = (process.env.TEST_SLUG_PREFIX || 'e2ef').toLowerCase();
const TERM_PREFIX = PREFIX.toUpperCase();

async function sweep({ verbose = false } = {}) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const result = { links: 0, terms: 0, errors: [] };

  try {
    // Login
    await page.goto(`${BASE_URL}/wp-login.php`, { waitUntil: 'domcontentloaded' });
    await page.fill('#user_login', ADMIN_USER);
    await page.fill('#user_pass', ADMIN_PASS);
    await page.click('#wp-submit');
    await page.waitForURL('**/wp-admin/**', { timeout: 60_000 });

    // Load nonce — tolerate PHP debug output on site
    const rawNonce = await page.evaluate(async () => {
      const r = await fetch('/wp-admin/admin-ajax.php?action=rest-nonce', { credentials: 'include' });
      return await r.text();
    });
    const tokens = rawNonce.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const nonce = tokens.reverse().find(s => /^[a-z0-9]+$/i.test(s)) || rawNonce.trim();
    if (!nonce) throw new Error(`cleanup: empty nonce`);

    // Links sweep
    const links = await page.evaluate(async (nonce) => {
      const r = await fetch('/wp-json/betterlinks/v1/links', { credentials: 'include', headers: { 'X-WP-Nonce': nonce } });
      return await r.json();
    }, nonce);

    const flat = [];
    const data = links?.data?.data || links?.data || {};
    if (data && typeof data === 'object') {
      for (const catId of Object.keys(data)) {
        const bucket = data[catId];
        const lists = bucket?.lists || bucket || [];
        if (Array.isArray(lists)) {
          for (const item of lists) if (item?.short_url && item.short_url.toLowerCase().startsWith(PREFIX)) {
            flat.push(item);
          }
        }
      }
    }

    for (const link of flat) {
      try {
        await page.evaluate(async ({ nonce, id }) => {
          await fetch(`/wp-json/betterlinks/v1/links/${id}`, { method: 'DELETE', credentials: 'include', headers: { 'X-WP-Nonce': nonce } });
        }, { nonce, id: link.ID });
        result.links++;
      } catch (e) { result.errors.push(`link ${link.ID}: ${e.message}`); }
    }

    // Terms sweep (cats + tags)
    const terms = await page.evaluate(async (nonce) => {
      const r = await fetch('/wp-json/betterlinks/v1/terms', { credentials: 'include', headers: { 'X-WP-Nonce': nonce } });
      return await r.json();
    }, nonce);

    const termsList = terms?.data?.data || terms?.data || terms?.terms || [];
    const arr = Array.isArray(termsList) ? termsList : Object.values(termsList);
    for (const t of arr) {
      if (!t?.term_name) continue;
      if (!t.term_name.startsWith(TERM_PREFIX)) continue;
      try {
        await page.evaluate(async ({ nonce, id }) => {
          // BL uses collection DELETE with {params: {ID}}
          await fetch('/wp-json/betterlinks/v1/terms', {
            method: 'DELETE',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': nonce },
            body: JSON.stringify({ params: { ID: id } }),
          });
        }, { nonce, id: t.ID });
        result.terms++;
      } catch (e) { result.errors.push(`term ${t.ID}: ${e.message}`); }
    }
  } catch (e) {
    result.errors.push(`sweep: ${e.message}`);
    if (verbose) console.warn('[cleanup] error:', e.message);
  } finally {
    await browser.close();
  }

  return result;
}

module.exports = { sweep };
