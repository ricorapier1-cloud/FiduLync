import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSovereignShield } from '../lib/quant/sovereignShield.ts';
import { calculateTechnicalConfluence } from '../lib/quant/technicalConfluence.ts';

const complete = {
  vix: 18, intradayRange: 1, atr20: 2, spreadRatio: 1,
  minutesToHighImpactEvent: 90, minutesToRateDecision: 120,
  cotPercentiles: {}, rollingSevenDayDrawdownPct: -1, tradesToday: 0, lossesToday: 0,
};

test('Sovereign Shield blocks black-swan volatility and sets zero risk', () => {
  const result = evaluateSovereignShield({ ...complete, vix: 28 });
  assert.equal(result.status, 'BLACK_SWAN_LOCKOUT');
  assert.equal(result.maxAllowedRiskPct, 0);
  assert.equal(result.allowedToTrade, false);
});

test('Sovereign Shield halves risk in elevated VIX and blocks spread blowout', () => {
  const elevated = evaluateSovereignShield({ ...complete, vix: 24 });
  assert.equal(elevated.maxAllowedRiskPct, 0.5);
  const spread = evaluateSovereignShield({ ...complete, spreadRatio: 2.1 });
  assert.equal(spread.spreadBlowoutBlock, true);
  assert.equal(spread.allowedToTrade, false);
});

test('Sovereign Shield locks around tier-1 and central bank rate decisions', () => {
  assert.equal(evaluateSovereignShield({ ...complete, minutesToHighImpactEvent: 20 }).allowedToTrade, false);
  assert.equal(evaluateSovereignShield({ ...complete, minutesToRateDecision: -45 }).allowedToTrade, false);
});

test('Sovereign Shield exposes missing account ledger instead of inventing it', () => {
  const result = evaluateSovereignShield({ ...complete, rollingSevenDayDrawdownPct: null, tradesToday: null, lossesToday: null });
  assert.equal(result.allowedToTrade, false);
  assert.ok(result.blockReasons.includes('AUTHORITATIVE_ACCOUNT_RISK_LEDGER_UNAVAILABLE'));
  assert.equal(result.dataGaps.length, 2);
});

test('technical confluence refuses to invent insufficient OHLC history', () => {
  const result = calculateTechnicalConfluence([], { instrument: 'EURUSD', pipSize: 0.0001 });
  assert.equal(result.status, 'INSUFFICIENT_HISTORY');
  assert.equal(result.atr14, null);
});
