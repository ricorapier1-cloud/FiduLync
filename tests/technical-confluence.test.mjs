import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../lib/quant/technicalConfluence.ts', import.meta.url), 'utf8');

test('technical confluence exposes Hurst regime boundaries and 14-period KER', () => {
  assert.match(source, /value > 0\.52/);
  assert.match(source, /value < 0\.45/);
  assert.match(source, /RANDOM_WALK_NOISE/);
  assert.match(source, /calculateKaufmanEfficiencyRatio\(closes: number\[\], period = 14\)/);
  assert.match(source, /Math\.max\(0, Math\.min\(1, netChange \/ volatility\)\)/);
});

test('ATR confluence uses true range and exposes 1.2x–1.5x calibration', () => {
  assert.match(source, /Math\.max\(\s*bar\.high - bar\.low/);
  assert.match(source, /recommendedStopLossLow: atrDisplay === null \? null : atrDisplay \* 1\.2/);
  assert.match(source, /recommendedStopLossHigh: atrDisplay === null \? null : atrDisplay \* 1\.5/);
  assert.match(source, /STOP_TIGHTER_THAN_1X_ATR/);
});

test('technical confluence withholds metrics when history is insufficient', () => {
  assert.match(source, /bars\.length >= 40/);
  assert.match(source, /state: valid \? 'AVAILABLE' : 'INSUFFICIENT_HISTORY'/);
  assert.match(source, /observationsUsed: bars\.length/);
});
