import test from 'node:test';
import assert from 'node:assert/strict';
import { assessFxDrivers, robustMacroSurpriseZ, ratePathRepricingZ } from '../.quant-test/forexResearchEngine.js';

const asOf = '2026-11-19T18:00:00Z';
const factor = (category, pairSignedZ = 1.5) => ({
  category, pairSignedZ, source: 'verified-provider',
  observedAt: '2026-11-19T17:30:00Z',
  releasedAt: '2026-11-19T17:00:00Z',
  verified: true, maxAgeHours: 24,
});
const technical = {
  trendZ: 1.2, structureZ: 1.0, volatilityPercentile: 0.65,
  spreadToAtr: 0.03, closedBarVerified: true,
};

test('robust macro surprise requires sufficient historical distribution', () => {
  assert.equal(robustMacroSurpriseZ(2, 1, [1, 2, 3]), null);
  assert.ok((robustMacroSurpriseZ(5, 0, Array.from({ length: 30 }, (_, i) => (i % 5) - 2)) ?? 0) > 0);
});

test('rate path repricing uses changes, not the absolute policy rate', () => {
  assert.ok((ratePathRepricingZ([25, 50, 75], [0, 0, 0], Array.from({ length: 30 }, (_, i) => (i % 5) - 2)) ?? 0) > 0);
  assert.equal(ratePathRepricingZ([1], [0, 0], Array(25).fill(1)), null);
});

test('complete aligned macro and technical evidence may form a research setup', () => {
  const categories = ['RATE_PATH_REPRICING','REAL_YIELD_DIFFERENTIAL','MACRO_SURPRISE','TERMS_OF_TRADE','POSITIONING','RISK_SENTIMENT','FUNDING_STRESS'];
  const result = assessFxDrivers('EURUSD', categories.map((category) => factor(category)), technical, asOf);
  assert.equal(result.setup, 'LONG_BIAS');
  assert.equal(result.evidenceCoverage, 1);
  assert.ok(result.confidence > 0.9);
});

test('missing, stale, unverified and look-ahead evidence cannot create a setup', () => {
  const result = assessFxDrivers('EURUSD', [
    factor('RATE_PATH_REPRICING'),
    { ...factor('REAL_YIELD_DIFFERENTIAL'), verified: false },
    { ...factor('MACRO_SURPRISE'), observedAt: '2026-11-20T00:00:00Z' },
    { ...factor('POSITIONING'), observedAt: '2026-11-01T00:00:00Z', maxAgeHours: 1 },
  ], technical, asOf);
  assert.equal(result.setup, 'NO_SETUP');
  assert.ok(result.excluded.length >= 3);
  assert.ok(result.blockers.includes('INSUFFICIENT_MACRO_DRIVER_COVERAGE'));
});

test('macro and technical disagreement returns no setup', () => {
  const categories = ['RATE_PATH_REPRICING','REAL_YIELD_DIFFERENTIAL','MACRO_SURPRISE','TERMS_OF_TRADE','POSITIONING','RISK_SENTIMENT','FUNDING_STRESS'];
  const result = assessFxDrivers('GBPUSD', categories.map((category) => factor(category)), {
    ...technical, trendZ: -1.5, structureZ: -1.2,
  }, asOf);
  assert.equal(result.setup, 'NO_SETUP');
  assert.ok(result.blockers.includes('MACRO_TECHNICAL_ALIGNMENT_MISSING'));
});

test('extreme volatility and excessive spread costs lock out the setup', () => {
  const categories = ['RATE_PATH_REPRICING','REAL_YIELD_DIFFERENTIAL','MACRO_SURPRISE','TERMS_OF_TRADE','POSITIONING','RISK_SENTIMENT','FUNDING_STRESS'];
  const result = assessFxDrivers('USDJPY', categories.map((category) => factor(category)), {
    ...technical, volatilityPercentile: 0.99, spreadToAtr: 0.2,
  }, asOf);
  assert.equal(result.setup, 'NO_SETUP');
  assert.ok(result.blockers.includes('EXTREME_VOLATILITY_LOCKOUT'));
  assert.ok(result.blockers.includes('SPREAD_COST_TOO_HIGH_RELATIVE_TO_ATR'));
});

test('invalid pairs and timezone-free as-of timestamps fail closed', () => {
  assert.ok(assessFxDrivers('EURUSD', [], technical, '2026-11-19T18:00:00').blockers.includes('INVALID_PAIR_OR_AS_OF'));
  assert.equal(assessFxDrivers('EURUSD', [], technical, asOf).setup, 'NO_SETUP');
});
