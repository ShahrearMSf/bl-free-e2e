const { defineConfig } = require('@playwright/test');
require('dotenv').config();

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // html → human-browsable report (in playwright-report/)
  // list → live console output during the run
  // json → machine-readable totals for CI summaries (read by workflow step)
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
    // NOTE: write outside playwright-report/ — the HTML reporter wipes its
    // own output dir on each run and would delete this file.
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  globalSetup: require.resolve('./helpers/global-setup.js'),
  globalTeardown: require.resolve('./helpers/global-teardown.js'),
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:8080',
    ignoreHTTPSErrors: true,
    //   - screenshot: 'on'              → end-of-test screenshot for every test
    //                                      (so passing tests still have visual proof in the report)
    //   - trace: 'retain-on-failure'    → trace.zip kept only when a test fails
    //                                      (browseable timeline + network + DOM in viewer)
    //   - video: 'retain-on-failure'    → screencast kept only when a test fails
    //                                      (no overhead on passing runs)
    screenshot: 'on',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
  },
  projects: [
    {
      name: 'auth-setup',
      testMatch: /auth\.setup\.js/,
    },
    {
      name: 'free',
      testDir: './tests',
      testIgnore: /auth\.setup\.js/,
      dependencies: ['auth-setup'],
      use: {
        storageState: 'playwright/.auth/admin.json',
      },
    },
  ],
});
