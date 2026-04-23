const { test: setup, expect } = require('@playwright/test');
const { handleEmailVerification, safeGoto } = require('../helpers/utils');
require('dotenv').config();

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin';

async function attemptLogin(page) {
  await safeGoto(page, '/wp-login.php');

  const userField = page.locator('#user_login');
  const passField = page.locator('#user_pass');
  await userField.waitFor({ state: 'visible', timeout: 30_000 });

  // Use direct .fill() — pressSequentially has been flaky on slower sites
  // where typed characters can be dropped by React re-renders.
  await userField.fill(ADMIN_USER);
  await passField.fill(ADMIN_PASS);

  await page.locator('#wp-submit').click();
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await handleEmailVerification(page);

  try {
    await page.waitForURL('**/wp-admin/**', { timeout: 20_000 });
    return { ok: true, reason: '' };
  } catch (e) {
    const body = await page.locator('body').innerText().catch(() => '');
    return { ok: false, reason: body.slice(0, 300) };
  }
}

setup('authenticate as admin', async ({ page }) => {
  let last = null;
  for (const backoff of [0, 5_000, 15_000]) {
    if (backoff) await page.waitForTimeout(backoff);
    last = await attemptLogin(page);
    if (last.ok) break;
    console.warn(`[auth] login retry: ${last.reason.replace(/\s+/g, ' ').slice(0, 150)}`);
  }
  expect(last?.ok, `login did not reach wp-admin — last body: ${last?.reason}`).toBe(true);

  await page.context().storageState({ path: 'playwright/.auth/admin.json' });
});
