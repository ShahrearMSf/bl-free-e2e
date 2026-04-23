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

/** Wait for BetterLinks React root to attach. */
async function waitForBLRoot(page, timeout = 30_000) {
  await page.waitForSelector('#betterlinksbody', { state: 'attached', timeout });
}

module.exports = {
  TEST_SLUG_PREFIX,
  uniqueSlug,
  uniqueTermName,
  safeGoto,
  handleEmailVerification,
  waitForBLRoot,
};
