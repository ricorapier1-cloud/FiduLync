import test from 'node:test';
import assert from 'node:assert/strict';

test('validation engine withholds historical KPIs until point-in-time calculations are verified', async () => {
  const { HISTORICAL_REGIME_CYCLES, getRegimeValidationSummary } = await import('../lib/macro/validationEngine.ts');
  const summary = getRegimeValidationSummary();
  assert.equal(summary.status, 'NOT_VALIDATED');
  assert.equal(summary.totalCycles, 0);
  assert.equal(summary.winRatePct, null);
  assert.equal(summary.avgReturnPct, null);
  assert.equal(summary.avgDrawdownPct, null);
  assert.deepEqual(HISTORICAL_REGIME_CYCLES, []);
});

test('country profiles: all G8 currencies are represented', async () => {
  const { G8_CURRENCIES } = await import('../lib/macro/countryProfiles.ts');
  const expected = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD'];
  assert.deepEqual([...G8_CURRENCIES], expected);
});
