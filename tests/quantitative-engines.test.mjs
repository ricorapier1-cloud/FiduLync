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
  assert.match(dossier, /policyRateObservationDate/);
  assert.match(dossier, /inflationObservationDate/);
  assert.match(dossier, /isFreshObservation/);
  assert.match(dossier, /policyDiffBps = essentialEvidenceVerified/);
  assert.match(dossier, /cotPercentileDiff = baseCot && quoteCot/);
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
  assert.match(strength, /isFreshObservation/);
});

test('dashboard marks cross-asset values unavailable until verified feeds exist', () => {
  assert.match(dashboard, /No verified live adapter/);
  assert.match(dashboard, /snapshot\.providerStatus\?\.length/);
  assert.doesNotMatch(dashboard, /FRED \(St\. Louis Fed\)[\s\S]{0,200}HEALTHY/);
  assert.doesNotMatch(dashboard, /4\.35%|2\.05%|14\.80|\$76\.40|\$2,740/);
});

test('US BLS and BEA adapters preserve observation dates and do not synthesize values', () => {
  const macroData = read('../lib/macroData.ts');
  const types = read('../types/macro.ts');
  assert.match(macroData, /getBlsUsdUpdates/);
  assert.match(macroData, /getBeaRealGdpYoY/);
  assert.match(macroData, /unemploymentObservationDate/);
  assert.match(macroData, /gdpObservationDate/);
  assert.match(types, /wageGrowthYoY\?: number/);
});

test('macro snapshot persistence uses the protected payload table and preserves source snapshots', () => {
  const macroData = read('../lib/macroData.ts');
  assert.match(macroData, /from\('macro_snapshot_payloads'\)/);
  assert.match(macroData, /upsert\(/);
  assert.match(macroData, /snapshot_key: 'global'/);
  assert.doesNotMatch(macroData, /from\('macro_snapshots'\)\s*\.select\('payload,refreshed_at'\)/);
});

test('BIS policy rates and CPI are connected for G8 with source provenance', () => {
  const macroData = read('../lib/macroData.ts');
  const macroTypes = read('../types/macro.ts');
  assert.match(macroData, /WS_CBPOL/);
  assert.match(macroData, /WS_LONG_CPI/);
  assert.match(macroData, /policyRateProvider = 'BIS'/);
  assert.match(macroData, /inflationProvider = 'BIS'/);
  assert.match(macroTypes, /policyRateProvider\?: string/);
  assert.match(macroTypes, /inflationProvider\?: string/);
});

test('dossier distinguishes real policy-rate proxies from market real yields', () => {
  const types = read('../types/macro.ts');
  const dossier = read('../lib/macro/dossierEngine.ts');
  const contextRoute = read('../app/api/v1/macro-context/route.ts');
  assert.match(types, /realPolicyRateDiffBps: number/);
  assert.match(dossier, /realPolicyRateDiffBps/);
  assert.match(contextRoute, /real_policy_rate_diff_bps/);
  assert.match(contextRoute, /real_yield_diff_bps: null/);
});

test('provider health is attributed to the actual source, not any provider flag', () => {
  const telemetry = read('../lib/macro/providerTelemetry.ts');
  assert.match(telemetry, /policyRateProvider === 'ECB'/);
  assert.match(telemetry, /inflationProvider === 'World Bank'/);
  assert.match(telemetry, /policyRateProvider === 'Bank of Canada'/);
  assert.match(telemetry, /BIS Statistics \/ G8 policy rates & CPI/);
});


test('normalized macro observations retain source, period, provenance and honest unknown release dates', () => {
  const persistence = read('../lib/macro/observationPersistence.ts');
  const macroData = read('../lib/macroData.ts');
  assert.match(persistence, /from\('macro_observations'\)/);
  assert.match(persistence, /onConflict: 'source_hash'/);
  assert.match(persistence, /source_hash/);
  assert.match(persistence, /released_at: null/);
  assert.match(persistence, /observation_period/);
  assert.match(macroData, /persistMacroObservations\(snapshot\)/);
});

test('G10 Nordic policy rates use official no-key central-bank sources', () => {
  const international = read('../lib/internationalMacro.ts');
  const macroData = read('../lib/macroData.ts');
  const telemetry = read('../lib/macro/providerTelemetry.ts');
  assert.match(international, /api\.riksbank\.se\/swea\/v1\/Observations\/Latest\/SECBREPOEFF/);
  assert.match(international, /data\.norges-bank\.no\/api\/data\/IR\/B\.KPRA\.SD\.R/);
  assert.match(macroData, /policyRateProvider = 'Sveriges Riksbank'/);
  assert.match(macroData, /policyRateProvider = 'Norges Bank'/);
  assert.match(telemetry, /Sveriges Riksbank policy rate/);
  assert.match(telemetry, /Norges Bank policy rate/);
});


test('complete G10 status requires fresh provider observations, not annual historical fallbacks', () => {
  const macroData = read('../lib/macroData.ts');
  assert.match(macroData, /isFreshProviderObservation\(currency\.policyRateObservationDate, 180\)/);
  assert.match(macroData, /isFreshProviderObservation\(currency\.inflationObservationDate, currency\.code === 'AUD' \? 180 : 120\)/);
});


test('BIS monthly CPI adapter maps Sweden and Norway when official observations exist', () => {
  const macroData = read('../lib/macroData.ts');
  assert.match(macroData, /SE: 'SEK', NO: 'NOK'/);
  assert.match(macroData, /WS_LONG_CPI/);
});


test('cron provenance distinguishes live macro data from a reference-only economic calendar', () => {
  const cron = read('../app/api/cron/sync-macro/route.ts');
  assert.match(cron, /LIVE_MACRO_REFERENCE_CALENDAR/);
  assert.match(cron, /hasLiveMacroData/);
  assert.match(cron, /hasLiveCalendar/);
  assert.match(cron, /status === 'partial'/);
  assert.doesNotMatch(cron, /snapshot\.source === 'partial'\s*\?\s*'PARTIAL_LIVE'/);
});

test('EIA adapter validates daily WTI and Brent observations and preserves published dates', () => {
  const macroData = read('../lib/macroData.ts');
  const macroTypes = read('../types/macro.ts');
  const dashboard = read('../app/components/MacroDashboard.tsx');
  assert.match(macroData, /process\.env\.EIA_API_KEY/);
  assert.match(macroData, /PET\.RWTC\.D/);
  assert.match(macroData, /PET\.RBRTE\.D/);
  assert.match(macroData, /EIA latest observation is stale or invalid/);
  assert.match(macroData, /observationDate: wti\.period/);
  assert.match(macroTypes, /energyMarkets\?: EnergyMarkets/);
  assert.match(dashboard, /EIA Brent–WTI spot spread/);
  assert.match(dashboard, /not intraday futures or live ticks/);
});

test('EIA crude feed is reported independently and cannot promote macro snapshot provenance', () => {
  const macroData = read('../lib/macroData.ts');
  const telemetry = read('../lib/macro/providerTelemetry.ts');
  assert.match(macroData, /snapshot\.energyMarkets = eiaResult\.value;\s*\}/);
  assert.doesNotMatch(macroData, /snapshot\.energyMarkets = eiaResult\.value; hasLiveData = true/);
  assert.match(telemetry, /U\.S\. Energy Information Administration \(WTI \/ Brent\)/);
});
