import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('MT5 macro context is installation-authenticated, read-only and fail-closed', async () => {
  const route = await read('app/api/v1/macro-context/route.ts');
  assert.match(route, /createHash\('sha256'\)/);
  assert.match(route, /token_hash=eq\./);
  assert.match(route, /status=eq\.active/);
  assert.match(route, /enforceDistributedRateLimit/);
  assert.match(route, /Cache-Control/);
  assert.match(route, /INSUFFICIENT_EVIDENCE/);
  assert.match(route, /high_impact_lockout/);
  assert.doesNotMatch(route, /OrderSend|order_send|trade\/modify|trade\/close/i);
  assert.doesNotMatch(route, /getMacroSignal|technicalScore|atr_sl|atr_tp|approvedVolume/i);
});

test('date-only official observation dates are supported without accepting timezone-free datetimes', async () => {
  const freshness = await read('lib/dataFreshness.ts');
  assert.ok(freshness.includes('Interpret that explicitly as a UTC calendar date'));
  assert.ok(freshness.includes('never accept timezone-free datetimes'));
  const route = await read('app/api/v1/macro-context/route.ts');
  assert.match(route, /isObservationFresh/);
});

test('XAUUSD is a supported read-only context symbol but cannot fabricate missing gold or USD evidence', async () => {
  const route = await read('app/api/v1/macro-context/route.ts');
  assert.match(route, /SUPPORTED_NON_FX_SYMBOLS = new Set\(\['XAUUSD'\]\)/);
  assert.match(route, /baseCode === 'XAU' \? 'GOLD' : baseCode/);
  assert.match(route, /base_cot_release_verified/);
  assert.match(route, /quote_cot_release_verified/);
  assert.match(route, /sampleSize >= 52/);
  assert.match(route, /publishedAt/);
});
