import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const route = readFileSync(new URL('../app/api/research/fx-drivers/route.ts', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../app/components/MacroDashboard.tsx', import.meta.url), 'utf8');
const currencyStrength = readFileSync(new URL('../lib/currencyStrength.ts', import.meta.url), 'utf8');

test('FX driver endpoint invokes the evidence-weighted engine and fails closed', () => {
  assert.match(route, /assessFxDrivers\(pair, factors, confirmation/);
  assert.match(route, /const factors: FxDriverObservation\[\] = \[\]/);
  assert.match(route, /structureZ: null/);
  assert.match(route, /volatilityPercentile: null/);
  assert.match(route, /spreadToAtr: null/);
  assert.match(route, /executionEnabled: false/);
  assert.match(route, /COT observation dates are available, but the release timestamp/);
  assert.match(route, /No point-in-time OIS or policy-futures path history/);
});

test('dashboard uses the engine assessment instead of the legacy heuristic score', () => {
  assert.match(dashboard, /\/api\/research\/fx-drivers/);
  assert.match(dashboard, /fxAssessment\?\.setup/);
  assert.doesNotMatch(dashboard, /function calculateBias\(/);
  assert.doesNotMatch(dashboard, /percentile \?\? 50/);
});

test('currency context requires dated provider observations and excludes non-point-in-time COT', () => {
  assert.match(currencyStrength, /validObservationDate\(item\.policyRateAsOf/);
  assert.match(currencyStrength, /validObservationDate\(item\.inflationAsOf/);
  assert.match(currencyStrength, /currencies\.length < 3/);
  assert.doesNotMatch(currencyStrength, /snapshot\.cot/);
  assert.match(dashboard, /COT is excluded until its publication timestamp is preserved/);
});

test('central-bank adapters preserve observation dates for policy and inflation context', () => {
  const international = readFileSync(new URL('../lib/internationalMacro.ts', import.meta.url), 'utf8');
  const macroData = readFileSync(new URL('../lib/macroData.ts', import.meta.url), 'utf8');
  assert.match(international, /TIME_PERIOD/);
  assert.match(international, /policyRateAsOf/);
  assert.match(international, /inflationAsOf/);
  assert.match(international, /OfficialPolicyObservation/);
  assert.match(macroData, /eur\.policyRateAsOf = ecbResult\.value\.policyRateAsOf/);
  assert.match(macroData, /cad\.inflationAsOf = bocResult\.value\.inflationAsOf/);
  assert.match(macroData, /gbp\.policyRateAsOf = boeResult\.value\.asOf/);
});

test('dashboard reports a failed assessment as unavailable instead of loading forever', () => {
  assert.match(dashboard, /status: 'ready' \| 'unavailable'/);
  assert.match(dashboard, /status: 'unavailable'/);
  assert.match(dashboard, /DATA OFFLINE/);
  assert.match(dashboard, /Research feed unavailable/);
});
