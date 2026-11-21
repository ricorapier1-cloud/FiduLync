import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessFeedHealth,
  assessValidationEvidence,
  classifyMarketRegime,
  normalizeUtcTimestamp,
  pearsonCorrelation,
  regressionSpread,
  validatePointInTimeObservation,
} from '../.quant-test/quantPipeline.js';

test('normalizes timezone-aware timestamps and rejects timezone-free values', () => {
  assert.equal(normalizeUtcTimestamp('2026-11-19T12:00:00+01:00'), '2026-11-19T11:00:00.000Z');
  assert.equal(normalizeUtcTimestamp('2026-11-19T12:00:00'), null);
});

test('point-in-time validation blocks future macro releases and revisions', () => {
  const base = {
    source: 'FRED', seriesId: 'CPIAUCSL', observationAt: '2026-10-01T00:00:00Z',
    releasedAt: '2026-11-12T13:30:00Z', retrievedAt: '2026-11-13T00:00:00Z', value: 100,
  };
  assert.deepEqual(validatePointInTimeObservation(base, '2026-11-14T00:00:00Z'), { valid: true, reason: 'POINT_IN_TIME_VALID' });
  assert.equal(validatePointInTimeObservation({ ...base, releasedAt: '2026-11-15T13:30:00Z' }, '2026-11-14T00:00:00Z').reason, 'LOOKAHEAD_RELEASE');
  assert.equal(validatePointInTimeObservation({ ...base, retrievedAt: '2026-11-12T12:00:00Z' }, '2026-11-14T00:00:00Z').reason, 'RETRIEVED_BEFORE_RELEASE');
  assert.equal(validatePointInTimeObservation({ ...base, vintageAt: '2026-11-15T00:00:00Z' }, '2026-11-14T00:00:00Z').reason, 'VINTAGE_NOT_YET_KNOWN');
});

test('feed health fails closed for missing, stale, degraded and open-circuit feeds', () => {
  const base = { now: '2026-11-19T12:00:00Z', maxAgeMs: 60_000, consecutiveFailures: 0, circuitFailureThreshold: 3, configured: true };
  assert.equal(assessFeedHealth({ ...base, configured: false, lastObservedAt: null }).state, 'UNAVAILABLE');
  assert.equal(assessFeedHealth({ ...base, lastObservedAt: '2026-11-19T11:00:00Z' }).state, 'STALE');
  assert.equal(assessFeedHealth({ ...base, consecutiveFailures: 1, lastObservedAt: '2026-11-19T11:59:30Z' }).eligibleForResearch, false);
  assert.equal(assessFeedHealth({ ...base, consecutiveFailures: 3, lastObservedAt: '2026-11-19T11:59:30Z' }).state, 'CIRCUIT_OPEN');
});

test('regime classification requires verified inputs and respects event lockout', () => {
  assert.equal(classifyMarketRegime({ hurst: 0.7, kaufmanEfficiencyRatio: 0.5, zScore: 0.2, atrPercentile: 0.5, volatilityClusterScore: 0.4, policyRiskOff: false, eventLockout: false, inputsVerified: false }), 'UNCLASSIFIED');
  assert.equal(classifyMarketRegime({ hurst: 0.7, kaufmanEfficiencyRatio: 0.5, zScore: 0.2, atrPercentile: 0.99, volatilityClusterScore: 0.4, policyRiskOff: false, eventLockout: false, inputsVerified: true }), 'HIGH_VOLATILITY_EVENT_LOCKOUT');
  assert.equal(classifyMarketRegime({ hurst: 0.7, kaufmanEfficiencyRatio: 0.5, zScore: 0.2, atrPercentile: 0.5, volatilityClusterScore: 0.4, policyRiskOff: false, eventLockout: false, inputsVerified: true }), 'TRENDING');
});

test('cross-asset statistics reject misaligned samples and do not label OLS as cointegration', () => {
  assert.equal(pearsonCorrelation([1, 2, 3], [1, 2]), null);
  assert.ok(Math.abs((pearsonCorrelation([1, 2, 3, 4], [2, 4, 6, 8]) ?? 0) - 1) < 1e-10);
  const spread = regressionSpread([3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37, 39, 41], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  assert.ok(spread);
  assert.equal(spread?.hedgeRatio, 2);
});

test('validation evidence blocks incomplete OOS, WFA and transaction-cost stress', () => {
  const result = assessValidationEvidence({
    inSampleTrades: 100, outOfSampleTrades: 10, outOfSampleExpectancyR: 0.2, maxDrawdownPct: 12,
    spreadStressApplied: false, slippageStressApplied: true, commissionStressApplied: true,
    walkForwardFolds: 2, untouchedOos: false,
  });
  assert.equal(result.eligible, false);
  assert.ok(result.blockers.includes('INSUFFICIENT_OOS_TRADES'));
  assert.ok(result.blockers.includes('SPREAD_STRESS_MISSING'));
});
