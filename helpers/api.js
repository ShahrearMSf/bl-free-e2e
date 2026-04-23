/**
 * REST + Ajax helpers. All calls run inside the authenticated browser context
 * so they reuse the admin session cookie stored in playwright/.auth/admin.json.
 */

/**
 * Fetch a fresh WP REST nonce from admin-ajax. Requires an authenticated page.
 *
 * Strips any PHP warning / notice HTML that might be prepended to the response
 * body on sites with WP_DEBUG_DISPLAY enabled — otherwise the nonce string
 * contains newlines and setting it as an HTTP header value throws
 * "TypeError: Failed to execute 'fetch' on 'Window': Invalid value".
 */
async function getRestNonce(page) {
  const raw = await page.evaluate(async () => {
    const r = await fetch('/wp-admin/admin-ajax.php?action=rest-nonce', { credentials: 'include' });
    return await r.text();
  });
  // Extract the last non-empty line containing alphanumerics — WP core
  // returns nonces as a single hex-ish token. Warnings are wrapped in HTML.
  const tokens = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const last = tokens.reverse().find(s => /^[a-z0-9]+$/i.test(s)) || raw.trim();
  if (!last) throw new Error(`empty rest-nonce (raw: ${raw.slice(0, 200)})`);
  return last;
}

/** Fetch the admin-ajax nonce that BetterLinks itself uses (window.betterLinksGlobal.betterlinks_nonce). */
async function getBLAdminNonce(page) {
  return await page.evaluate(() => window.betterLinksGlobal?.betterlinks_nonce || null);
}

/**
 * Create a BetterLinks link via the plugin REST API.
 * Returns the created link object (incl. ID).
 */
async function createLink(page, { title, slug, target, redirectType = '301', status = 'publish', catId = 1 }) {
  const nonce = await getRestNonce(page);
  return await page.evaluate(async ({ nonce, title, slug, target, redirectType, status, catId }) => {
    const r = await fetch('/wp-json/betterlinks/v1/links', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': nonce },
      body: JSON.stringify({
        params: {
          link_title: title,
          short_url: slug,
          target_url: target,
          redirect_type: redirectType,
          link_status: status,
          cat_id: catId,
        },
      }),
    });
    const body = await r.json();
    if (!r.ok || !body.success) {
      throw new Error(`createLink failed (${r.status}): ${JSON.stringify(body).slice(0, 300)}`);
    }
    return body.data;
  }, { nonce, title, slug, target, redirectType, status, catId });
}

/**
 * List all links (nested-by-category response). Returns the raw response.
 */
async function listLinks(page) {
  const nonce = await getRestNonce(page);
  return await page.evaluate(async (nonce) => {
    const r = await fetch('/wp-json/betterlinks/v1/links', {
      credentials: 'include',
      headers: { 'X-WP-Nonce': nonce },
    });
    return await r.json();
  }, nonce);
}

/**
 * Delete a link by ID.
 */
async function deleteLink(page, id) {
  const nonce = await getRestNonce(page);
  return await page.evaluate(async ({ nonce, id }) => {
    const r = await fetch(`/wp-json/betterlinks/v1/links/${id}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'X-WP-Nonce': nonce },
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, { nonce, id });
}

/**
 * List all BL terms (categories + tags).
 */
async function listTerms(page) {
  const nonce = await getRestNonce(page);
  return await page.evaluate(async (nonce) => {
    const r = await fetch('/wp-json/betterlinks/v1/terms', {
      credentials: 'include',
      headers: { 'X-WP-Nonce': nonce },
    });
    return await r.json();
  }, nonce);
}

async function createTerm(page, { name, slug, type = 'category' }) {
  const nonce = await getRestNonce(page);
  return await page.evaluate(async ({ nonce, name, slug, type }) => {
    const r = await fetch('/wp-json/betterlinks/v1/terms', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': nonce },
      body: JSON.stringify({
        params: { term_name: name, term_slug: slug || name.toLowerCase().replace(/\s+/g, '-'), term_type: type },
      }),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, { nonce, name, slug, type });
}

async function deleteTerm(page, id) {
  // BL's DELETE uses the collection endpoint with {params: {ID}} in the body —
  // there is NO /terms/{id} DELETE route.
  const nonce = await getRestNonce(page);
  return await page.evaluate(async ({ nonce, id }) => {
    const r = await fetch('/wp-json/betterlinks/v1/terms', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': nonce },
      body: JSON.stringify({ params: { ID: id } }),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, { nonce, id });
}

module.exports = {
  getRestNonce,
  getBLAdminNonce,
  createLink,
  listLinks,
  deleteLink,
  listTerms,
  createTerm,
  deleteTerm,
};
