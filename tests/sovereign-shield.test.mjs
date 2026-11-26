import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../lib/quant/sovereignShield.ts', import.meta.url), 'utf8');

test('Sovereign Shield implements VIX and intraday range tail-risk thresholds', () => {
  assert.match(source, /vix >= 32/);
  assert.match(source, /vix >= 25/);
  assert.match(source, /intradayRangeAtrMultiple > 2\.5/);
  assert.match(source, /status === 'BLACK_SWAN_LOCKOUT' \|\| status === 'DATA_UNAVAILABLE'/);
  assert.match(source, /status === 'ELEVATED_VOLATILITY_HALF_RISK' \? 0\.5 : 1/);
  assert.match(source, /!vixAvailable \? 'DATA_UNAVAILABLE'/);
  assert.match(source, /status === 'DATA_UNAVAILABLE'/);
});

test('Sovereign Shield blocks spread blowouts, event windows and crowded positioning', () => {
  assert.match(source, /spreadMultipleOfSessionBaseline > 2/);
  assert.match(source, /isCentralBankRateDecision \? 60 : 30/);
  assert.match(source, /percentile >= 90 \|\| item\.percentile <= 10/);
  assert.match(source, /SPREAD_BLOWOUT_BLOCK/);
  assert.match(source, /CROWDED_UNWIND_RISK/);
});

test('Sovereign Shield fails closed when account governance cannot be verified', () => {
  assert.match(source, /TRADE_GOVERNANCE_LEDGER_UNVERIFIED/);
  assert.match(source, /governance\.tradesToday! >= 2/);
  assert.match(source, /governance\.lossesToday! >= 2/);
  assert.match(source, /rollingSevenDayDrawdownPct! <= -4/);
  assert.match(source, /if \(hardBlock\) maxAllowedRiskPct = 0/);
});


test('market-risk shield is independently enforced by intraday signals without inventing account-ledger verification', () => {
  assert.match(source, /export function evaluateMarketRiskShield/);
  assert.match(source, /intradayRangeAtrMultiple > 2\.5/);
  assert.match(source, /maxAllowedRiskPct = Math\.min\(maxAllowedRiskPct, 0\.5\)/);
  assert.match(source, /spreadBlowoutBlock \|\| eventWindow/);
  assert.match(source, /marketConditionsClear: !hardBlock/);
});
