/**
 * Runs once after all tests (including failures). Sweeps test-created data
 * so the target site stays clean for the next run.
 */
const { sweep } = require('./cleanup');

module.exports = async () => {
  console.log('[globalTeardown] post-run cleanup starting...');
  const r = await sweep({ verbose: true });
  console.log('[globalTeardown] post-run cleanup done:', r);
};
