import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateMarketRiskShield, evaluateSovereignShield } from '../lib/quant/sovereignShield.ts';

test('VIX 28.29 is elevated half-risk, not a black-swan lockout', () => {
  const result = evaluateMarketRiskShield({ vix: 28.29 });
  assert.equal(result.status, 'ELEVATED_VOLATILITY_HALF_RISK');
  assert.equal(result.maxAllowedRiskPct, 0.5);
  assert.equal(result.marketConditionsClear, true);
});

test('VIX 24.99 remains normal and VIX 32.00 is a full lockout', () => {
  const normal = evaluateMarketRiskShield({ vix: 24.99 });
  const blackSwan = evaluateMarketRiskShield({ vix: 32 });
  assert.equal(normal.status, 'NORMAL');
  assert.equal(normal.maxAllowedRiskPct, 1);
  assert.equal(blackSwan.status, 'BLACK_SWAN_LOCKOUT');
  assert.equal(blackSwan.maxAllowedRiskPct, 0);
  assert.equal(blackSwan.marketConditionsClear, false);
});

test('acute 24-hour range expansion blocks the market shield', () => {
  const result = evaluateMarketRiskShield({ vix: 20, intradayRangeAtrMultiple: 2.51 });
  assert.equal(result.status, 'BLACK_SWAN_LOCKOUT');
  assert.equal(result.marketConditionsClear, false);
});

test('spread blowout and event windows independently block market conditions', () => {
  const spread = evaluateMarketRiskShield({ vix: 20, spreadMultipleOfSessionBaseline: 2.01 });
  const event = evaluateMarketRiskShield({ vix: 20, eventMinutesAway: 29 });
  const rateDecision = evaluateMarketRiskShield({ vix: 20, eventMinutesAway: 59, isCentralBankRateDecision: true });
  assert.equal(spread.marketConditionsClear, false);
  assert.equal(event.marketConditionsClear, false);
  assert.equal(rateDecision.marketConditionsClear, false);
});

test('crowded COT positioning reduces the market ceiling without converting a warning into a hard lockout', () => {
  const result = evaluateMarketRiskShield({
    vix: 20,
    cotPercentiles: [{ symbol: 'EUR', percentile: 95 }],
  });
  assert.equal(result.marketConditionsClear, true);
  assert.equal(result.maxAllowedRiskPct, 0.5);
  assert.ok(result.blockReasons.includes('CROWDED_UNWIND_RISK'));
});

test('missing VIX evidence fails closed', () => {
  const result = evaluateMarketRiskShield({ vix: null });
  assert.equal(result.status, 'DATA_UNAVAILABLE');
  assert.equal(result.maxAllowedRiskPct, 0);
  assert.equal(result.marketConditionsClear, false);
});

test('account governance remains fail-closed while market-only ceiling remains separately observable', () => {
  const result = evaluateSovereignShield({
    vix: 28.29,
    governance: {
      tradesToday: null,
      lossesToday: null,
      rollingSevenDayDrawdownPct: null,
      ledgerVerified: false,
    },
  });
  assert.equal(result.status, 'ELEVATED_VOLATILITY_HALF_RISK');
  assert.equal(result.marketConditionsClear, true);
  assert.equal(result.allowedToTrade, false);
  assert.equal(result.maxAllowedRiskPct, 0);
  assert.ok(result.blockReasons.includes('TRADE_GOVERNANCE_LEDGER_UNVERIFIED'));
});

test('verified account governance permits only within market ceiling and daily limits', () => {
  const allowed = evaluateSovereignShield({
    vix: 28.29,
    governance: { tradesToday: 0, lossesToday: 0, rollingSevenDayDrawdownPct: 0, ledgerVerified: true },
  });
  const dailyLimit = evaluateSovereignShield({
    vix: 20,
    governance: { tradesToday: 2, lossesToday: 0, rollingSevenDayDrawdownPct: 0, ledgerVerified: true },
  });
  assert.equal(allowed.allowedToTrade, true);
  assert.equal(allowed.maxAllowedRiskPct, 0.5);
  assert.equal(dailyLimit.allowedToTrade, false);
  assert.equal(dailyLimit.maxAllowedRiskPct, 0);
});
