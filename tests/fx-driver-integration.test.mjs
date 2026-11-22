import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const route = readFileSync(new URL('../app/api/research/fx-drivers/route.ts', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../app/components/MacroIntelligenceDashboard.tsx', import.meta.url), 'utf8');
const currencyStrength = readFileSync(new URL('../lib/currencyStrength.ts', import.meta.url), 'utf8');

test('FX driver research endpoint uses evidence-weighted macro factors and fails closed', () => {
  assert.match(route, /assessFxDrivers\(pair, factors, confirmation/);
  assert.match(route, /const factors: FxDriverObservation\[\] = \[\]/);
  assert.match(route, /structureZ: null/);
  assert.match(route, /volatilityPercentile: null/);
  assert.match(route, /spreadToAtr: null/);
  assert.match(route, /executionEnabled: false/);
  assert.match(route, /COT observation dates are available, but the release timestamp/);
  assert.match(route, /No point-in-time OIS or policy-futures path history/);
});

test('active dashboard is macro-only and does not consume technical FX signal output', () => {
  assert.match(dashboard, /G8 currency strength/);
  assert.match(dashboard, /Central-bank policy & inflation matrix/);
  assert.doesNotMatch(dashboard, /\/api\/research\/fx-drivers|fxAssessment|technical_data_verified|safeToTrade/);
});

test('currency context requires dated provider observations and excludes non-point-in-time COT', () => {
  assert.match(currencyStrength, /validObservationDate\(item\.policyRateAsOf/);
  assert.match(currencyStrength, /validObservationDate\(item\.inflationAsOf/);
  assert.match(currencyStrength, /currencies\.length < 3/);
  assert.doesNotMatch(currencyStrength, /snapshot\.cot/);
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

test('dashboard labels policy-minus-inflation as a proxy, not a market real yield', () => {
  assert.match(dashboard, /Policy minus inflation is a simplified ex-post proxy/);
  assert.doesNotMatch(dashboard, /matched-maturity market real yield/);
});

test('dashboard never labels reference values as live executable quotes', () => {
  assert.match(dashboard, /Only observations actually returned by approved providers are shown/);
  assert.doesNotMatch(dashboard, /LIVE REFERENCE FEED|LIVE BROKER QUOTE/);
});
