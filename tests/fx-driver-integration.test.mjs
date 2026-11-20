import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const route = readFileSync(new URL('../app/api/research/fx-drivers/route.ts', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../app/components/MacroDashboard.tsx', import.meta.url), 'utf8');

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
