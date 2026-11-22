import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const validation = read('../lib/macro/validationEngine.ts');
const dossier = read('../lib/macro/dossierEngine.ts');
const crossAsset = read('../lib/macro/crossAssetEngine.ts');
const profiles = read('../lib/macro/countryProfiles.ts');
const strength = read('../lib/currencyStrength.ts');
const dashboard = read('../app/components/MacroDashboard.tsx');

test('validation engine withholds unsupported historical performance claims', () => {
  assert.match(validation, /NOT_VALIDATED/);
  assert.match(validation, /HISTORICAL_REGIME_CYCLES: RegimeBacktestCycle\[\] = \[\]/);
  assert.match(validation, /winRatePct: null/);
  assert.match(validation, /avgReturnPct: null/);
  assert.match(validation, /avgDrawdownPct: null/);
});

test('pair dossier requires provider-sourced policy and inflation observations', () => {
  assert.match(dossier, /policyRateSource === 'provider'/);
  assert.match(dossier, /inflationSource === 'provider'/);
  assert.match(dossier, /essentialEvidenceVerified/);
  assert.match(dossier, /INSUFFICIENT EVIDENCE — NO RELIABLE CONCLUSION/);
  assert.doesNotMatch(dossier, /gdpGrowthYoY \?\? 1\.0|unemploymentRate \?\? 4\.0/);
});

test('cross-asset engine does not embed fabricated market levels', () => {
  for (const value of ['4.45', '1.95', '124.8', '14.6', '2680.0', '71.4', '75.2', '4.12', '312']) {
    assert.doesNotMatch(crossAsset, new RegExp(value.replace('.', '\\.'), 'g'));
  }
  assert.match(crossAsset, /freshness: 'UNAVAILABLE'/);
});

test('country profile engine does not publish hardcoded macro baselines', () => {
  assert.match(profiles, /return \[\]/);
  assert.doesNotMatch(profiles, /gdpGrowthYoY: 2\.7|unemploymentRate: 4\.1/);
});

test('currency strength uses only provider-sourced policy and inflation data', () => {
  assert.match(strength, /policyRateSource === 'provider'/);
  assert.match(strength, /inflationSource === 'provider'/);
});

test('dashboard marks cross-asset values unavailable until verified feeds exist', () => {
  assert.match(dashboard, /No verified live adapter/);
  assert.doesNotMatch(dashboard, /4\.35%|2\.05%|14\.80|\$76\.40|\$2,740/);
});
