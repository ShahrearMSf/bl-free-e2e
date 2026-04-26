const crypto = require('crypto');
require('dotenv').config();

const TEST_SLUG_PREFIX = process.env.TEST_SLUG_PREFIX || 'e2ef';

/** Generates a deterministic-ish test slug that's also unique to this run. */
function uniqueSlug(tag = 'link') {
  const suffix = crypto.randomBytes(3).toString('hex');
  return `${TEST_SLUG_PREFIX}-${tag}-${suffix}`;
}

function uniqueTermName(tag = 'cat') {
  const suffix = crypto.randomBytes(2).toString('hex');
  return `${TEST_SLUG_PREFIX.toUpperCase()}-${tag}-${suffix}`;
}

/** Safe goto that tolerates the WP "Check your email" confirmation modal on brand-new admins. */
async function safeGoto(page, path, opts = {}) {
  return page.goto(path, { waitUntil: 'domcontentloaded', ...opts });
}

/** WP admin occasionally shows "Confirm Admin Email Address" after install. Dismiss it. */
async function handleEmailVerification(page) {
  const btn = page.locator('a.admin-email__confirm-btn, #correct-admin-email');
  try {
    if (await btn.isVisible({ timeout: 1500 })) {
      await btn.click();
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    }
  } catch { /* not shown */ }
}

/**
 * Wait for the BetterLinks React app to mount AND finish first render.
 *
 * The plugin's PHP outputs an empty `<div id="betterlinksbody"></div>` early
 * in the page lifecycle, then React hydrates and paints the actual UI a few
 * hundred ms later. Just waiting for the mount point to attach captures the
 * page mid-paint, which:
 *   - makes screenshots look like blank/broken pages
 *   - causes flake on subsequent locator queries that target rendered content
 *
 * This helper waits for:
 *   1. `#betterlinksbody` to attach (PHP-side mount point ready)
 *   2. The mount point to have at least one child element (React painted)
 *   3. Network to settle (initial REST fetches done)
 *   4. Tiny final settle so animations/transitions finish before screenshot
 */
async function waitForBLRoot(page, timeout = 30_000) {
  await page.waitForSelector('#betterlinksbody', { state: 'attached', timeout });

  // Wait for React to render *substantive* content — not just the outer
  // wrapper div, but a meaningful subtree. BL's React components prefix
  // their classes with `btl-` (or render top-level headings); we wait for
  // either of those signals to ensure the screenshot captures real UI.
  await page.waitForFunction(
    () => {
      const root = document.querySelector('#betterlinksbody');
      if (!root) return false;
      // Substantive content: at least a few descendant elements with BL class
      // names, OR a top-level heading, OR a non-trivial total element count.
      const blEls = root.querySelectorAll('[class*="btl-"], [class*="BTL"], h1, h2, h3, button').length;
      const totalEls = root.querySelectorAll('*').length;
      return blEls >= 2 || totalEls >= 20;
    },
    { timeout },
  ).catch(() => { /* fall through — some pages (API-only health checks) intentionally don't render */ });

  // Let in-flight REST fetches settle so the screenshot reflects real data.
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

  // Final settle for CSS transitions / late paints. Bumped from 300ms to
  // 1500ms because slow CI runners need this to capture the rendered UI
  // (was the cause of blank-content screenshots on Tags & Categories etc.).
  await page.waitForTimeout(1500);
}

module.exports = {
  TEST_SLUG_PREFIX,
  uniqueSlug,
  uniqueTermName,
  safeGoto,
  handleEmailVerification,
  waitForBLRoot,
};
