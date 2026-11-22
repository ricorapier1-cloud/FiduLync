import test from 'node:test';
import assert from 'node:assert/strict';

test('validation engine: historical regime cycles enforce point-in-time integrity', async () => {
  // Read validationEngine dynamically or inspect its rules
  const { HISTORICAL_REGIME_CYCLES, getRegimeValidationSummary } = await import('../lib/macro/validationEngine.ts');
  const summary = getRegimeValidationSummary();

  assert.ok(summary.totalCycles >= 5, 'Must contain historical cycles across multiple quarters');
  assert.ok(summary.winRatePct >= 0 && summary.winRatePct <= 100);

  // Check sample size warning logic
  const lowSampleCycle = HISTORICAL_REGIME_CYCLES.find((c) => c.sampleObservations < 30);
  if (lowSampleCycle) {
    assert.equal(lowSampleCycle.sampleSizeAdequate, false, 'Cycles with N < 30 must flag inadequate sample size');
  }

  // Check vintage integrity
  HISTORICAL_REGIME_CYCLES.forEach((c) => {
    assert.ok(
      c.vintageIntegrity === 'POINT_IN_TIME_VERIFIED' || c.vintageIntegrity === 'REVISION_ADJUSTED',
      'Cycle must have explicit vintage classification'
    );
  });
});

test('country profiles: all G8 currencies are represented', async () => {
  const { G8_CURRENCIES } = await import('../lib/macro/countryProfiles.ts');
  const expected = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD'];
  assert.deepEqual([...G8_CURRENCIES], expected);
});
