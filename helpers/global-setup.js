/**
 * Runs once before all tests.
 * 1. Sweeps any leftover test data from previous runs (slug prefix scoped).
 */
const { sweep } = require('./cleanup');

module.exports = async () => {
  console.log('[globalSetup] pre-run cleanup starting...');
  const r = await sweep({ verbose: true });
  console.log('[globalSetup] pre-run cleanup done:', r);
};
