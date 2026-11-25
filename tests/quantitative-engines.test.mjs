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

test('CFTC COT retrieval is cached between weekly publications and tolerates slower official responses', () => {
  const macroData = read('../lib/macroData.ts');
  const cftc = macroData.slice(macroData.indexOf('async function getCftcCot'), macroData.indexOf('async function getLiveProviderSnapshot'));
  assert.match(cftc, /getCachedData\('macro:cftc-cot-v1'/);
  assert.match(cftc, /AbortSignal\.timeout\(20_000\)/);
  assert.match(cftc, /6 \* 60 \* 60/);
  assert.match(cftc, /reportDate: latest\.date/);
});

test('fallback snapshot does not embed fabricated policy rates or inflation levels', () => {
  const macroData = read('../lib/macroData.ts');
  const fallbackFn = macroData.slice(macroData.indexOf('export function getFallbackSnapshot()'), macroData.indexOf('function mergeWithFallback'));
  assert.doesNotMatch(fallbackFn, /policyRate: 3\.75|policyRate: 2\.15|policyRate: 4|policyRate: 0\.5|policyRate: 3\.6/);
  assert.doesNotMatch(fallbackFn, /inflation: 2\.8|inflation: 2\.1|inflation: 3|inflation: 3\.4/);
  assert.match(fallbackFn, /Awaiting Provider Feed/);
});

test('pair dossier does not fabricate fallback policy or inflation rates when missing', () => {
  const dossier = read('../lib/macro/dossierEngine.ts');
  assert.doesNotMatch(dossier, /\?\? 3\.5|\?\? 4\.75|\?\? 2\.5|\?\? 2\.8/);
});

test('market quote feeds include G8 currency pairs for Finnhub and Frankfurter', () => {
  const marketFeeds = read('../lib/marketFeeds.ts');
  for (const symbol of ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD', 'XAUUSD']) {
    assert.match(marketFeeds, new RegExp(symbol));
  }
});

test('FRED and Finnhub API keys are directly utilized without artificial gate blockers', () => {
  const macroData = read('../lib/macroData.ts');
  assert.match(macroData, /process\.env\.FRED_API_KEY\?\.trim\(\)/);
  assert.match(macroData, /process\.env\.FINNHUB_API_KEY\?\.trim\(\)/);
});


test('XAUUSD macro context engine requires verified spot, official macro series, and weekly CFTC evidence', () => {
  const engine = read('../lib/macro/goldAndRegimeEngine.ts');
  const route = read('../app/api/v1/xauusd-context/route.ts');
  assert.match(engine, /DFII10/);
  assert.match(engine, /T10YIE/);
  assert.match(engine, /DGS2/);
  assert.match(engine, /DTB3/);
  assert.match(engine, /BAMLH0A0HYM2/);
  assert.match(engine, /VIXCLS/);
  assert.match(engine, /cftc_contract_market_code/);
  assert.match(engine, /088691/);
  assert.match(engine, /rollingZScore/);
  assert.match(engine, /FRED_WINDOW = 65/);
  assert.match(engine, /QUOTE_MAX_AGE_MS = 60 \* 60 \* 1000/);
  assert.match(engine, /INSUFFICIENT_EVIDENCE/);
  assert.match(engine, /latencyMs/);
  assert.match(engine, /goldBiasScore: number \| null/);
  assert.match(route, /MACRO_API_TOKEN/);
  assert.match(route, /CRON_SECRET/);
  assert.match(route, /status: 401/);
  assert.match(route, /timingSafeEqual/);
});

test('XAUUSD fallback spot never fabricates bid, ask, or spread from a mid-only feed', () => {
  const engine = read('../lib/macro/goldAndRegimeEngine.ts');
  assert.match(engine, /source: 'XAUS'/);
  assert.match(engine, /bid: null, ask: null, mid/);
  assert.match(engine, /spreadUsd: null/);
});

test('authenticated macro bridge accepts the configured MACRO_API_TOKEN through constant-time comparison', () => {
  const route = read('../app/api/v1/macro-context/route.ts');
  assert.match(route, /process\.env\.MACRO_API_TOKEN\?\.trim\(\)/);
  assert.match(route, /timingSafeEqual/);
  assert.match(route, /candidate, secret/);
  assert.match(route, /consumePersistentRateLimit/);
});

test('desk pre-trade gate blocks stale quotes, low-confidence bias and below-minimum lot sizes', () => {
  const desk = read('../app/components/DeskTerminal.tsx');
  assert.match(desk, /dossier\.confidence === 'HIGH' \|\| dossier\.confidence === 'MODERATE'/);
  assert.match(desk, /quoteIsFresh = quote\?\.freshness === 'LIVE'/);
  assert.match(desk, /spreadPass = quoteIsFresh/);
  assert.match(desk, /lots >= 0\.01/);
  assert.match(desk, /account > 0/);
});

test('dashboard exposes one coherent set of anchored research workspaces and avoids stale LIVE quote labels', () => {
  const dashboard = read('../app/components/MacroDashboard.tsx');
  const desk = read('../app/components/DeskTerminal.tsx');
  for (const anchor of ['desk-terminal', 'matrix', 'bias', 'regimes', 'positioning', 'catalysts', 'health']) {
    assert.match(dashboard, new RegExp('href="#' + anchor + '"'));
  }
  assert.match(desk, /id="desk-terminal"/);
  assert.match(dashboard, /STALE \/ DELAYED/);
  assert.match(dashboard, /LIVE · FINNHUB/);
});
test('MT5 macro bridge rejects unsupported instruments and withholds stale provider prices', () => {
  const route = read('../app/api/v1/macro-context/route.ts');
  const types = read('../types/desk.ts');
  assert.match(route, /G8_PAIRS\.includes/);
  assert.match(route, /ageMs <= 120_000/);
  assert.match(route, /freshness === 'STALE' \? null : quote\.price/);
  assert.match(route, /age_ms: Number\.isFinite\(ageMs\)/);
  assert.match(types, /freshness: 'FRESH' \| 'STALE' \| 'REFERENCE'/);
});
test('XAUUSD dashboard, desk gate and MT5 context use the dedicated gold macro engine', () => {
  const page = read('../app/page.tsx');
  const dashboard = read('../app/components/MacroDashboard.tsx');
  const desk = read('../app/components/DeskTerminal.tsx');
  const route = read('../app/api/v1/macro-context/route.ts');
  assert.match(page, /buildGoldMacroContext\(\)/);
  assert.match(dashboard, /Gold Macro &amp; Liquidity Intelligence/);
  assert.match(desk, /selected === 'XAUUSD' \? goldMacroPass : fxMacroPass/);
  assert.match(route, /symbol === 'XAUUSD' \? buildGoldMacroContext\(\)/);
  assert.match(route, /goldAvailable/);
  assert.match(route, /goldContext\?\.invalidationTriggers/);
});
test('licensed or permission-dependent providers fail closed unless their explicit approval flag is true', () => {
  const macroData = read('../lib/macroData.ts');
  const marketFeeds = read('../lib/marketFeeds.ts');
  const goldEngine = read('../lib/macro/goldAndRegimeEngine.ts');
  assert.match(macroData, /FRED_DATA_STORAGE_PERMISSION_APPROVED === 'true' \? process\.env\.FRED_API_KEY/);
  assert.match(macroData, /FINNHUB_COMMERCIAL_USE_APPROVED === 'true' \? process\.env\.FINNHUB_API_KEY/);
  assert.match(macroData, /FAIRECONOMY_COMMERCIAL_USE_APPROVED === 'true'/);
  assert.match(marketFeeds, /FINNHUB_COMMERCIAL_USE_APPROVED === 'true' \? process\.env\.FINNHUB_API_KEY/);
  assert.match(goldEngine, /FRED_DATA_STORAGE_PERMISSION_APPROVED === 'true'/);
});
