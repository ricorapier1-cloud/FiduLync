import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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
  assert.ok(crossAsset.includes("freshness: treasury || vixObservation || wti !== null || brent !== null ? 'LATEST PUBLISHED' : 'UNAVAILABLE'"));
});
test('country profile engine does not publish hardcoded macro baselines', () => {
  assert.match(profiles, /return \[\]/);
  assert.doesNotMatch(profiles, /gdpGrowthYoY: 2\.7|unemploymentRate: 4\.1/);
});
test('currency strength uses only provider-sourced policy and inflation data', () => {
  assert.match(strength, /policyRateSource !== 'provider'/);
  assert.match(strength, /inflationSource !== 'provider'/);
  assert.match(strength, /isFreshObservation/);
});
test('dashboard marks cross-asset values unavailable until verified feeds exist', () => {
  assert.ok(dashboard.includes('CBOE daily close'));
  assert.ok(dashboard.includes('US 10Y benchmark'));
  assert.ok(dashboard.includes('10Y TIPS real yield'));
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
  assert.match(macroData, /persistMacroObservations\(safeSnapshot\)/);
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
  assert.match(cron, /LIVE_MACRO_CALENDAR_UNAVAILABLE/);
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
  assert.ok(macroData.includes('snapshot.energyMarkets = eiaResult.value; hasAnyProviderData = true;'));
  assert.doesNotMatch(macroData, /snapshot\.energyMarkets = eiaResult\.value;\s*hasMacroData = true/);
  assert.match(telemetry, /U\.S\. Energy Information Administration \(WTI \/ Brent\)/);
});
test('CFTC COT retrieval is cached between weekly publications and tolerates slower official responses', () => {
  const macroData = read('../lib/macroData.ts');
  const cftc = macroData.slice(macroData.indexOf('async function getCftcCot'), macroData.indexOf('async function getLiveProviderSnapshot'));
  assert.match(cftc, /getCachedData\('macro:cftc-cot-v2'/);
  assert.match(cftc, /AbortSignal\.timeout\(20_000\)/);
  assert.match(cftc, /6 \* 60 \* 60/);
  assert.match(cftc, /reportDate: latest\.date/);
});
test('macro fallback is empty and never synthesizes zero policy or inflation observations', () => {
  const macroData = read('../lib/macroData.ts');
  const fallbackFn = macroData.slice(macroData.indexOf('export function getFallbackSnapshot()'), macroData.indexOf('function mergeWithFallback'));
  const mergeFn = macroData.slice(macroData.indexOf('function mergeWithFallback'), macroData.indexOf('function isRecord'));
  assert.match(fallbackFn, /EMPTY_SNAPSHOT/);
  assert.doesNotMatch(fallbackFn, /policyRate:|inflation:|Awaiting Provider Feed/);
  assert.match(mergeFn, /currencies: snapshot\.currencies/);
  assert.doesNotMatch(mergeFn, /new Map\(fallback\.currencies/);
  assert.match(macroData, /return getFallbackSnapshot\(\);/);
  const macroEngine = read('../lib/macroEngine.ts');
  assert.match(macroEngine, /cotPositionDiff: number \| null/);
  assert.match(macroEngine, /roroScore: number \| null/);
  assert.match(macroEngine, /const roroScore = null/);
  assert.doesNotMatch(macroEngine, /const roroScore = 0/);
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
test('Frankfurter date-only reference rates retain their observation date without a fabricated future intraday timestamp', () => {
  const feeds = read('../lib/marketFeeds.ts');
  assert.match(feeds, /payload\.date\}T00:00:00\.000Z/);
  assert.doesNotMatch(feeds, /payload\.date\}T16:00:00\.000Z/);
});
test('provider quotes reject stale, future, crossed and malformed MT5 observations before macro use', () => {
  const feeds = read('../lib/marketFeeds.ts');
  const macroContext = read('../app/api/v1/macro-context/route.ts');
  assert.match(feeds, /quoteAgeMs < -5 \* 60_000 \|\| quoteAgeMs > 120_000/);
  assert.match(feeds, /ageMs < -5 \* 60_000 \|\| ageMs > 120_000/);
  assert.match(feeds, /ask < bid/);
  assert.match(macroContext, /rawAgeMs >= -5 \* 60_000/);
  assert.match(macroContext, /timestampValid \? Math\.max\(0, rawAgeMs\) : null/);
  assert.match(macroContext, /mid: freshness === 'STALE' \? null : quote\.price/);
});
test('FRED and Finnhub API keys are used only behind explicit provider approval', () => {
  const macroData = read('../lib/macroData.ts');
  assert.match(macroData, /FRED_DATA_STORAGE_PERMISSION_APPROVED\?\.trim\(\)\.toLowerCase\(\) !== 'false'/);
  assert.match(macroData, /FINNHUB_PERSONAL_PLAN_ACTIVE === 'true'/);
});
test('official Treasury TIPS series joins using the real-yield field and powers the no-key gold fallback', () => {
  const treasury = read('../lib/treasuryData.ts');
  const gold = read('../lib/macro/goldAndRegimeEngine.ts');
  assert.match(treasury, /row\.values\.TC_10YEAR/);
  assert.doesNotMatch(treasury, /row\.values\.BC_10YEAR\]\)/);
  assert.match(gold, /treasuryHistory\.map\(\(item\) => \(\{ date: item\.date, value: item\.real10YPct \}\)\)/);
  assert.match(gold, /snapshotVix/);
  assert.match(gold, /cot\.nonCommercialNet/);
});
test('gold refresh route reuses the synchronized macro snapshot and CBOE observation', () => {
  const route = read('../app/api/macro/gold-context/route.ts');
  assert.match(route, /getMacroSnapshot\(\)/);
  assert.match(route, /buildGoldMacroContext\(snapshot\)/);
});
test('public FairEconomy calendar is no-key, Tier-1-only, and records source provenance', () => {
  const macroData = read('../lib/macroData.ts');
  const types = read('../types/macro.ts');
  const macroContext = read('../app/api/v1/macro-context/route.ts');
  const signals = read('../app/api/v1/intraday-signals/route.ts');
  assert.match(macroData, /getFairEconomyCatalysts\(\),/);
  assert.doesNotMatch(macroData, /FAIRECONOMY_COMMERCIAL_USE_APPROVED === 'true' \? getFairEconomyCatalysts/);
  assert.match(macroData, /item\.impact === 'High'/);
  assert.match(macroData, /snapshot\.calendarProvider = calendarResult/);
  assert.match(types, /calendarProvider\?: 'FAIRECONOMY_PUBLIC'/);
  assert.match(macroContext, /calendar_verified: snapshot\.calendarSource === 'provider' && Boolean\(snapshot\.calendarProvider\)/);
  assert.match(macroContext, /const newsLockoutActive = snapshot\.calendarSource !== 'provider'/);
  assert.match(signals, /const calendarVerified = snapshot\.calendarSource === 'provider' && Boolean\(snapshot\.calendarProvider\)/);
});
test('Swissquote quote caching is per instrument so satellite selection cannot refetch every core pair', () => {
  const route = read('../app/api/v1/live-quotes/route.ts');
  assert.match(route, /macro:swissquote-bbo-v1:' \+ instrument\.symbol/);
  assert.doesNotMatch(route, /macro:swissquote-bbo-v1' \+ ':' \+ \(satelliteInstrument/);
});
test('Supabase REST helper is strictly read-only and contains no legacy commerce writes', () => {
  const adapter = read('../lib/supabaseAdmin.ts');
  assert.match(adapter, /method: 'GET'/);
  assert.match(adapter, /export async function supabaseRead/);
  assert.doesNotMatch(adapter, /persistLicense|recordTransaction|upsertHeartbeat|supabaseInsert|method: 'POST'|method: 'PATCH'|method: 'DELETE'/);
});
test('live quote API rounds each instrument to its display precision before JSON serialization', () => {
  const route = read('../app/api/v1/live-quotes/route.ts');
  assert.match(route, /quote\.symbol === 'XAUUSD' \? 2 : quote\.symbol === 'USDJPY' \? 3 : 5/);
  assert.match(route, /Number\(value\.toFixed\(digits\)\)/);
});
test('gold research cards wrap long values and desk execution workflow is placed once before research detail', () => {
  const dashboard = read('../app/components/MacroDashboard.tsx');
  assert.equal((dashboard.match(/07 \/ XAUUSD DEDICATED RESEARCH/g) ?? []).length, 1);
  assert.equal((dashboard.match(/<DeskTerminal initialSnapshot=/g) ?? []).length, 1);
  assert.ok(dashboard.indexOf('<DeskTerminal initialSnapshot=') < dashboard.indexOf('06 / CROSS-ASSET TELEMETRY'));
  assert.match(dashboard, /min-w-0 break-words/);
  assert.match(dashboard, /text-sm sm:text-lg/);
  assert.match(dashboard, /3M CMT · TREASURY PROXY/);
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
  assert.doesNotMatch(route, /CRON_SECRET/);
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
test('intraday signal engine blocks stale quotes, weak macro bias and missing shield evidence while leaving lot sizing to the EA', () => {
  const desk = read('../app/components/DeskTerminal.tsx');
  const engine = read('../lib/quant/intradaySignalEngine.ts');
  const route = read('../app/api/v1/intraday-signals/route.ts');
  assert.match(desk, /intradaySignals\.map/);
  assert.match(route, /buildIntradaySignal/);
  assert.match(route, /evaluateMarketRiskShield/);
  assert.match(engine, /input\.macroScore !== null && input\.macroScore >= \(isGold \? 20 : 25\)/);
  assert.match(engine, /LIVE_BBO_UNAVAILABLE_OR_STALE/);
  assert.match(engine, /INTRADAY_CANDLES_STALE/);
  assert.match(engine, /VIX_UNAVAILABLE/);
  assert.match(engine, /CALENDAR_UNVERIFIED/);
  assert.match(engine, /SHIELD_BLOCKED/);
  assert.doesNotMatch(desk, /lots >= 0\.01|setSl\(|setTp\(/);
});
test('dashboard exposes anchored research workspaces and keeps BBO presentation in the desk terminal', () => {
  const dashboard = read('../app/components/MacroDashboard.tsx');
  const desk = read('../app/components/DeskTerminal.tsx');
  for (const anchor of ['desk-terminal', 'matrix', 'bias', 'regimes', 'gold-research', 'positioning', 'catalysts', 'health']) {
    assert.match(dashboard, new RegExp('href="#' + anchor + '"'));
  }
  assert.match(desk, /id="desk-terminal"/);
  assert.match(desk, /FRESH BBO/);
  assert.doesNotMatch(dashboard, /api\/macro\/quotes|macro-quote-strip|LIVE · FINNHUB/);
});
test('MT5 macro bridge rejects unsupported instruments and withholds stale provider prices', () => {
  const route = read('../app/api/v1/macro-context/route.ts');
  const types = read('../types/desk.ts');
  assert.match(route, /G8_PAIRS\.includes/);
  assert.match(route, /ageMs > 120_000/);
  assert.match(route, /freshness === 'STALE' \? null : quote\.price/);
  assert.match(route, /age_ms: ageMs/);
  assert.match(route, /rawAgeMs >= -5 \* 60_000/);
  assert.match(types, /freshness: 'FRESH' \| 'STALE' \| 'REFERENCE'/);
});
test('XAUUSD dashboard, intraday signals and MT5 context use the dedicated gold macro engine', () => {
  const page = read('../app/page.tsx');
  const dashboard = read('../app/components/MacroDashboard.tsx');
  const signals = read('../app/api/v1/intraday-signals/route.ts');
  const route = read('../app/api/v1/macro-context/route.ts');
  const goldRoute = read('../app/api/v1/xauusd-context/route.ts');
  assert.match(page, /buildGoldMacroContext\(initialSnapshot\)/);
  assert.match(dashboard, /Gold Macro &amp; Liquidity Intelligence/);
  assert.match(signals, /isGold \? gold\.goldBiasScore/);
  assert.match(route, /const goldContext = await buildGoldMacroContext\(snapshot\)/);
  assert.match(route, /goldAvailable/);
  assert.match(route, /goldContext\?\.invalidationTriggers/);
  assert.match(goldRoute, /buildGoldMacroContext\(snapshot\)/);
  assert.match(goldRoute, /evaluateSovereignShield/);
});
test('keyed providers remain approval-gated while the public economic calendar works without a key', () => {
  const macroData = read('../lib/macroData.ts');
  const marketFeeds = read('../lib/marketFeeds.ts');
  const goldEngine = read('../lib/macro/goldAndRegimeEngine.ts');
  assert.match(macroData, /FRED_DATA_STORAGE_PERMISSION_APPROVED\?\.trim\(\)\.toLowerCase\(\) !== 'false' \? process\.env\.FRED_API_KEY/);
  assert.match(macroData, /FINNHUB_PERSONAL_PLAN_ACTIVE === 'true' \? process\.env\.FINNHUB_API_KEY/);
  assert.match(macroData, /getFairEconomyCatalysts\(\),/);
  assert.doesNotMatch(macroData, /FAIRECONOMY_COMMERCIAL_USE_APPROVED === 'true' \? getFairEconomyCatalysts/);
  assert.match(marketFeeds, /FINNHUB_PERSONAL_PLAN_ACTIVE === 'true' \? process\.env\.FINNHUB_API_KEY/);
  assert.match(goldEngine, /FRED_DATA_STORAGE_PERMISSION_APPROVED\?\.trim\(\)\.toLowerCase\(\) !== 'false'/);
});
test('Swissquote BBO future timestamps are bounded by the same 30-second clock-skew tolerance as intraday signals', () => {
  const quotes = read('../app/api/v1/live-quotes/route.ts');
  const engine = read('../lib/quant/intradaySignalEngine.ts');
  assert.match(quotes, /quoteTimestamp <= Date\.now\(\) \+ 30_000/);
  assert.match(engine, /quoteAge < -30_000/);
});
test('Swissquote BBO timestamp parsing accepts parent-level item timestamps and numeric Unix timestamps', () => {
  const quotes = read('../app/api/v1/live-quotes/route.ts');
  assert.ok(quotes.includes('raw.ts ?? item.ts'));
  assert.ok(quotes.includes('/^\\d{10,13}$/'));
  assert.match(quotes, /getCachedData\('macro:swissquote-bbo-v1:' \+ instrument\.symbol/);
  assert.ok(quotes.includes("ageMs > 60_000 ? 'STALE'"));
});
test('GDP quarter parsing uses a real digit matcher', () => {
  const dashboard = read('../app/components/MacroDashboard.tsx');
  assert.ok(dashboard.includes('period?.match(/^(\\d{4})Q([1-4])$/)'));
});
test('cached FRED observations are excluded when storage permission is not approved', () => {
  const macroData = read('../lib/macroData.ts');
  const engine = read('../lib/macroEngine.ts');
  const persistence = read('../lib/macro/observationPersistence.ts');
  const cache = read('../lib/redisCache.ts');
  assert.match(macroData, /sanitizeMacroSnapshotPermissions/);
  assert.match(macroData, /policyRateProvider === 'FRED'/);
  assert.match(macroData, /purgeFREDStorageArtifacts/);
  assert.match(engine, /macro:snapshot:v4:no-fred/);
  assert.match(engine, /sanitizeMacroSnapshotPermissions\(await loadMacroSnapshot\(\)\)/);
  assert.match(engine, /deleteCachedData\('macro:snapshot:v3'\)/);
  assert.match(persistence, /provider === 'FRED' && !fredStorageAllowed\(\)/);
  assert.match(persistence, /delete\(\)\.eq\('provider', 'FRED'\)/);
  assert.match(cache, /export async function deleteCachedData/);
  assert.match(macroData, /twoYearYieldProvider === 'FRED' \|\| !next\.twoYearYieldProvider/);
  assert.match(macroData, /CUSTOM MACRO PROVIDER/);
  assert.match(persistence, /currency\.twoYearYieldProvider \?\?/);
  assert.match(read('../types/macro.ts'), /twoYearYieldProvider\?: string/);
  assert.match(engine, /xau:fred:\$\{seriesId\}:v1/);
});
test('gold quote parser uses parent-level Swissquote timestamps and Treasury daily history when FRED storage is disabled', () => {
  const gold = read('../lib/macro/goldAndRegimeEngine.ts');
  const treasury = read('../lib/treasuryData.ts');
  assert.ok(gold.includes('raw.ts ?? item.ts'));
  assert.ok(gold.includes('macro:us-treasury-yields-history-v2'));
  assert.ok(gold.includes("requiredDailySeries = ['DFII10', 'T10YIE', 'DGS2', 'DTB3', 'VIXCLS']"));
  assert.ok(gold.includes('evidenceCoveragePct'));
  assert.ok(gold.includes('snapshotTreasury?.history'));
  assert.ok(gold.includes('treasuryObservedLatencyMs'));
  assert.ok(treasury.includes('history: history.slice(0, 260)'));
  assert.ok(treasury.includes("fetchTreasuryRows('daily_treasury_real_yield_curve', ['TC_10YEAR'])"));
});
test('economic calendar never falls back to hardcoded central-bank dates or stale persisted fixtures', () => {
  const macroData = read('../lib/macroData.ts');
  assert.doesNotMatch(macroData, /getCentralBankDecisionsSchedule/);
  assert.match(macroData, /snapshot\.catalysts = \[\]/);
  assert.match(macroData, /calendarSource = 'unavailable'/);
  assert.ok(macroData.includes("catalysts: data.payload.calendarSource === 'provider' ? persistedCatalysts : []"));
});
test('pair scenario probabilities remain uncalibrated until point-in-time backtests exist', () => {
  const dossier = read('../lib/macro/dossierEngine.ts');
  const types = read('../types/macro.ts');
  const dashboard = read('../app/components/MacroDashboard.tsx');
  assert.match(dossier, /probabilityPct: null/);
  assert.match(types, /probabilityPct: number \| null/);
  assert.match(dashboard, /PROBABILITY NOT CALIBRATED/);
});
test('pair ranking only publishes provider-evidenced candidates and never labels scores as win probabilities', () => {
  const route = read('../app/api/v1/top-pairs/route.ts');
  const board = read('../app/components/PairOpportunityBoard.tsx');
  assert.match(route, /confidence === 'HIGH' \|\| dossier\.confidence === 'MODERATE'/);
  assert.match(route, /Math\.abs\(dossier\.biasScore\) >= 20/);
  assert.match(route, /BLOCKED_EVENT_LOCKOUT/);
  assert.match(route, /G8_PAIRS/);
  assert.match(route, /buildGoldMacroContext/);
  assert.match(route, /not a calibrated win probability/);
  assert.match(board, /NO QUALIFIED MACRO OPPORTUNITIES/);
  assert.match(board, /No historical win probability is claimed/);
});
test('official Treasury daily nominal and TIPS yields work without a paid API key', () => {
  const adapter = read('../lib/treasuryData.ts');
  const macroData = read('../lib/macroData.ts');
  const dashboard = read('../app/components/MacroDashboard.tsx');
  assert.ok(adapter.includes('home.treasury.gov'));
  assert.ok(adapter.includes('daily_treasury_yield_curve'));
  assert.ok(adapter.includes('daily_treasury_real_yield_curve'));
  assert.ok(adapter.includes('BC_2YEAR'));
  assert.ok(adapter.includes('BC_10YEAR'));
  assert.ok(macroData.includes('getTreasuryYieldData'));
  assert.match(dashboard, /US 10Y benchmark/);
  assert.match(dashboard, /10Y TIPS real yield/);
  assert.ok(dashboard.includes('Daily published closing-market estimates'));
});
test('provider telemetry does not treat FRED key presence as data-use approval', () => {
  const telemetry = read('../lib/macro/providerTelemetry.ts');
  assert.ok(telemetry.includes("const fredStorageAllowed = process.env.FRED_DATA_STORAGE_PERMISSION_APPROVED?.trim().toLowerCase() !== 'false'"));
  assert.ok(!telemetry.includes("FRED_DATA_STORAGE_PERMISSION_APPROVED !== 'false' || fredKeyPresent"));
});
test('BLS USD inflation and labour data can use the public no-registration API with a safe cache window', () => {
  const macroData = read('../lib/macroData.ts');
  assert.match(macroData, /const version = apiKey \? 'v2' : 'v1'/);
  assert.match(macroData, /if \(apiKey\) requestBody\.registrationkey = apiKey/);
  assert.match(macroData, /macro:bls-usd-updates-v1/);
  assert.match(macroData, /getBlsUsdUpdates\(process\.env\.BLS_API_KEY\?\.trim\(\)\)/);
});
test('Cboe daily VIX closes populate cross-asset risk telemetry without claiming intraday data', () => {
  const adapter = read('../lib/cboeVix.ts');
  const macroData = read('../lib/macroData.ts');
  const crossAsset = read('../lib/macro/crossAssetEngine.ts');
  const dashboard = read('../app/components/MacroDashboard.tsx');
  const goldEngine = read('../lib/macro/goldAndRegimeEngine.ts');
  assert.ok(adapter.includes('cdn-api.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv'));
  assert.ok(adapter.includes('CLOSE'));
  assert.ok(macroData.includes('getCboeVixHistory'));
  assert.ok(crossAsset.includes('snapshot.vix?.freshness'));
  assert.ok(crossAsset.includes("vixRegime: vixObservation"));
  assert.ok(dashboard.includes('CBOE VIX'));
  assert.ok(dashboard.includes('Not an intraday volatility quote'));
  assert.ok(goldEngine.includes('getCboeVixHistory'));
});
test('provider resilience handles Riksbank single-observation payloads, caches EIA and gates Gemini by default', () => {
  const international = read('../lib/internationalMacro.ts');
  const macroData = read('../lib/macroData.ts');
  const aiBrief = read('../lib/aiBrief.ts');
  assert.ok(international.includes('nested && Array.isArray(nested.observations)'));
  assert.ok(international.includes('typeof record.date === \'string\''));
  assert.ok(macroData.includes("getCachedData('macro:eia-energy-markets-v1'"));
  assert.ok(macroData.includes('AbortSignal.timeout(15_000)'));
  assert.ok(aiBrief.includes("GEMINI_MACRO_BRIEF_ENABLED !== 'true'"));
  assert.ok(aiBrief.includes("'macro:ai-brief:v4'"));
});
test('gold score uses healthy Treasury levels, canonical CBOE VIX and CFTC positioning without a FRED z-score gate', () => {
  const engine = read('../lib/macro/goldAndRegimeEngine.ts');
  assert.match(engine, /const realYield = drivers\.DFII10\.value/);
  assert.match(engine, /realYield > 2\.25/);
  assert.match(engine, /snapshotVix/);
  assert.match(engine, /cot\.nonCommercialNet/);
  assert.match(engine, /drivers\.twoYearMinusThreeMonthPct !== null/);
  assert.doesNotMatch(engine, /drivers\.DFII10\.zScore65 !== null && drivers\.twoYearMinusThreeMonthPct/);
});
test('EA macro context exposes flat deterministic session, lockout, regime and per-symbol bias fields', () => {
  const route = read('../app/api/v1/macro-context/route.ts');
  const types = read('../types/desk.ts');
  assert.match(route, /allowedToTrade/);
  assert.match(route, /newsLockoutActive/);
  assert.match(route, /activeMarketSession/);
  assert.match(route, /macroRiskRegime/);
  assert.match(route, /symbolBiases/);
  assert.match(route, /buildGoldMacroContext\(snapshot\)/);
  assert.match(types, /symbols: Record<string, MacroSymbolBias>/);
  assert.match(types, /decisionScope: 'MACRO_GATE_ONLY'/);
});
test('private desk layout removes duplicated page footer and floating retail support widget', () => {
  const dashboard = read('../app/components/MacroDashboard.tsx');
  const shell = read('../components/PlatformShell.tsx');
  const footer = read('../components/PlatformFooter.tsx');
  assert.doesNotMatch(dashboard, /macro-footer|<footer/);
  assert.equal((shell.match(/<PlatformFooter \/>/g) ?? []).length, 1);
  assert.doesNotMatch(shell, /WhatsAppSupportButton/);
  assert.doesNotMatch(footer, /wa\.me|WhatsApp Desk/);
  assert.ok(dashboard.indexOf('<EABridgeDiagnostics />') < dashboard.indexOf('id="health"'));
});
test('public FairEconomy calendar is represented as healthy telemetry without Finnhub plan approval', () => {
  const telemetry = read('../lib/macro/providerTelemetry.ts');
  assert.match(telemetry, /snapshot\.calendarProvider === 'FAIRECONOMY_PUBLIC'/);
  assert.match(telemetry, /const calendarActive = snapshot\.calendarSource === 'provider' && Boolean\(snapshot\.calendarProvider\)/);
  assert.match(telemetry, /Economic Calendar' \+ \(snapshot\.calendarProvider/);
  assert.doesNotMatch(telemetry, /const calendar = finnhubKeyPresent && !finnhubPlanActive/);
});
test('manual journal and calculator workflows are retired while the macro currency matrix remains', () => {
  const desk = read('../app/components/DeskTerminal.tsx');
  assert.doesNotMatch(desk, /exportJournal|calculatorInputsValid|LIVE RISK CALCULATOR|desk-position-sizing/);
  assert.match(desk, /A \/ UNIFIED CURRENCY MATRIX/);
  const diagnostics = read('../app/components/EABridgeDiagnostics.tsx');
  assert.match(diagnostics, /ZONE 4/);
  assert.match(diagnostics, /MacroLyncBridge\.mqh/);
});
test('Force Sync refreshes the macro snapshot, gold context, BBO and spot reference inputs', () => {
  const snapshotRoute = read('../app/api/macro/snapshot/route.ts');
  const desk = read('../app/components/DeskTerminal.tsx');
  assert.match(snapshotRoute, /new URL\(request\.url\)\.searchParams\.get\('force'\) === 'true'/);
  assert.match(snapshotRoute, /getMacroSnapshot\(forceRefresh\)/);
  assert.match(desk, /api\/macro\/snapshot\?force=true/);
  assert.match(desk, /api\/macro\/gold-context/);
  assert.match(desk, /onSnapshotChange\(freshSnapshot\)/);
  assert.match(desk, /goldResult\.value\.ok/);
  assert.match(desk, /onGoldContextChange\(freshGold as GoldMacroContext\)/);
});
test('intraday signal engine enforces macro threshold, trend quality, live sessions, shield gates and ATR-calibrated levels', () => {
  const engine = read('../lib/quant/intradaySignalEngine.ts');
  const route = read('../app/api/v1/intraday-signals/route.ts');
  assert.match(engine, /isGold \? 20 : 25/);
  assert.match(engine, /isGold \? -20 : -25/);
  assert.match(engine, /calculateKaufmanEfficiencyRatio\(closes, 14\)/);
  assert.match(engine, /estimateHurstExponent/);
  assert.match(engine, /hurst <= 0\.52/);
  assert.match(engine, /MEAN_REVERSION_ONLY/);
  assert.match(engine, /zScoreZone/);
  assert.match(engine, /adrUsedPct >= 85/);
  assert.match(engine, /ker < 0\.30/);
  assert.match(engine, /const stopAtrMultiple = finite\(input\.vix\) && input\.vix >= 25 \? 1\.5 : 1\.35/);
  assert.match(engine, /riskDistance \* 2/);
  assert.match(engine, /riskDistance \* 3/);
  assert.match(engine, /VIX_BLACK_SWAN_LOCKOUT/);
  assert.match(engine, /input\.marketShield && !input\.marketShield\.marketConditionsClear/);
  assert.match(engine, /marketRiskCeilingPct/);
  assert.match(route, /evaluateMarketRiskShield/);
  assert.match(route, /intradayRangeAtrMultiple/);
  assert.match(route, /cotPercentiles/);
  assert.match(engine, /MACRO_SCORE_BELOW_\$\{isGold \? 20 : 25\}_THRESHOLD/);
  assert.match(engine, /sessionTimeZone = session === 'LONDON'/);
  assert.match(engine, /SPREAD_BLOWOUT_BLOCK/);
  assert.match(engine, /SPREAD_BASELINE_UNAVAILABLE/);
  assert.match(engine, /TIER_ONE_EVENT_LOCKOUT/);
  assert.match(engine, /RATE_DECISION_LOCKOUT/);
  assert.match(engine, /America\/New_York/);
  assert.match(route, /getActiveMarketSession/);
  assert.match(engine, /INTRADAY_CANDLES_STALE/);
});
test('Sovereign Shield fails closed when VIX evidence is missing or invalid', () => {
  const shield = read('../lib/quant/sovereignShield.ts');
  const deskTypes = read('../types/desk.ts');
  assert.match(shield, /!vixAvailable \? 'DATA_UNAVAILABLE'/);
  assert.match(shield, /status === 'DATA_UNAVAILABLE'/);
  assert.match(shield, /!vixAvailable\) reasons\.push\('VIX_UNAVAILABLE'\)/);
  assert.match(shield, /vix >= 32/);
  assert.match(deskTypes, /'DATA_UNAVAILABLE'/);
  const macroContext = read('../app/api/v1/macro-context/route.ts');
  const xauContext = read('../app/api/v1/xauusd-context/route.ts');
  assert.match(macroContext, /drivers\.VIXCLS\.state === 'HEALTHY' \? goldContext\.drivers\.VIXCLS\.value : null/);
  assert.match(xauContext, /drivers\.VIXCLS\.state === 'HEALTHY' \? context\.drivers\.VIXCLS\.value : null/);
});
test('intraday candle adapter rejects malformed OHLC ranges and invalid timestamps', () => {
  const route = read('../app/api/v1/intraday-candles/route.ts');
  assert.match(route, /high! < Math\.max\(open!, close!\)/);
  assert.match(route, /low! > Math\.min\(open!, close!\)/);
  assert.match(route, /Number\.isFinite\(epochSeconds\)/);
  assert.match(route, /bars\.sort\(\(left, right\)/);
});
test('broker trade history derives outcomes only from reconciled MT5 deals, without synthetic journal context', () => {
  const accounts = read('../app/accounts/page.tsx');
  assert.match(accounts, /const netDeal = \(deal: Deal\) => Number\(deal\.profit\) \+ Number\(deal\.commission\) \+ Number\(deal\.swap\) \+ Number\(deal\.fee\)/);
  assert.match(accounts, /selectedDeals\.forEach\(\(deal\) =>/);
  assert.match(accounts, /if \(!deal\.position_id\) return/);
  assert.match(accounts, /items\.some\(\(deal\) => deal\.entry_type === 'IN'\)/);
  assert.match(accounts, /items\.some\(closesPosition\)/);
  assert.match(accounts, /net: items\.reduce\(\(sum, deal\) => sum \+ netDeal\(deal\), 0\)/);
  assert.doesNotMatch(accounts, /riskPct|rMultiple|macroBiasScore|hurstRegime|vixLevel/);
});
test('account history attribution uses the broker-recorded position instrument and direction', () => {
  const accounts = read('../app/accounts/page.tsx');
  assert.match(accounts, /symbol: entry\.symbol/);
  assert.match(accounts, /side: entry\.side/);
  assert.match(accounts, /positionId/);
  assert.doesNotMatch(accounts, /generatePairDossier|journalSymbol|calculator/i);
});
test('intraday candle adapter exposes real OHLCV with explicit freshness and no synthetic fallback', () => {
  const route = read('../app/api/v1/intraday-candles/route.ts');
  assert.match(route, /query1\.finance\.yahoo\.com\/v8\/finance\/chart/);
  assert.match(route, /loadBars\(symbol, '5m', '5d'\)/);
  assert.match(route, /loadBars\(symbol, '1d', '1mo'\)/);
  assert.match(route, /status: fresh && intraday\.length >= 60/);
  assert.match(route, /intradayBars: \[\], dailyBars: \[\]/);
  assert.doesNotMatch(route, /Math\.random|synthetic|fallbackBars/);
});
test('authenticated EA macro context includes intraday signals and MQL5 read-only getters', () => {
  const route = read('../app/api/v1/macro-context/route.ts');
  const types = read('../types/desk.ts');
  const bridge = read('../public/MacroLyncBridge.mqh');
  assert.match(route, /api\/v1\/intraday-signals/);
  assert.match(route, /signals: intradaySignals/);
  assert.match(types, /signals: IntradaySignal\[\]/);
  assert.match(bridge, /GetSignalState/);
  assert.match(bridge, /GetSignalDirection/);
  assert.match(bridge, /GetRecommendedSL/);
  assert.match(bridge, /safe_to_trade = false/);
});
test('desk exposes macro-aligned intraday signals as research context without calculator or order execution', () => {
  const desk = read('../app/components/DeskTerminal.tsx');
  const signals = read('../app/api/v1/intraday-signals/route.ts');
  assert.match(desk, /REFERENCE-ONLY INTRADAY RESEARCH/);
  assert.match(desk, /intradaySignals\.map/);
  assert.match(desk, /Research context only/);
  assert.match(desk, /REFRESH SIGNALS/);
  assert.match(signals, /executionAuthority: 'RESEARCH_ONLY_NO_EXECUTION_APPROVAL'/);
  assert.doesNotMatch(desk, /LOAD INTO CALCULATOR|setSl\(|setTp\(|OrderSend/);
});
test('provider health includes real EIA and Treasury observation dates and BIS-backed World Bank standby', () => {
  const telemetry = read('../lib/macro/providerTelemetry.ts');
  const types = read('../types/macro.ts');
  const dashboard = read('../app/components/MacroDashboard.tsx');
  assert.match(telemetry, /snapshot\.energyMarkets\?\.wti\.observationDate/);
  assert.match(telemetry, /snapshot\.usTreasury\?\.observationDate/);
  assert.match(telemetry, /bis\.status === 'HEALTHY'/);
  assert.match(telemetry, /status: 'STANDBY'/);
  assert.match(telemetry, /eur\?\.policyRateProvider === 'ECB'/);
  assert.match(types, /'STANDBY'/);
  assert.match(dashboard, /STANDBY • BIS ACTIVE/);
  assert.match(dashboard, /const eiaFresh = Boolean\(snapshot\.energyMarkets/);
  assert.match(dashboard, /eiaFresh \? snapshot\.energyMarkets\?\.wti\.valueUsdPerBarrel/);
  assert.match(dashboard, /stale: Boolean\(snapshot\.energyMarkets && !eiaFresh\)/);
  assert.match(dashboard, /snapshot\.usTreasury\?\.freshness === 'STALE'/);
});
test('spread blowout protection requires measured same-session Redis history and never substitutes configured references', () => {
  const baseline = read('../lib/quant/spreadBaseline.ts');
  const route = read('../app/api/v1/intraday-signals/route.ts');
  const desk = read('../app/components/DeskTerminal.tsx');
  assert.match(baseline, /redis\.lpush/);
  assert.match(baseline, /redis\.lrange/);
  assert.doesNotMatch(baseline, /REFERENCE_SPREADS|CONFIGURED_REFERENCE|0\.00018|0\.00022|0\.020|0\.85/);
  assert.match(baseline, /values\.length < 20/);
  assert.match(baseline, /spread \/ medianSpread/);
  assert.match(route, /recordAndEvaluateSpreadBaseline/);
  assert.match(route, /quote\?\.freshness === 'LIVE' \? quote\.spread : null/);
  assert.match(route, /evaluateMarketRiskShield/);
  assert.match(route, /intradayRangeAtrMultiple/);
  assert.match(route, /cotPercentiles/);
  assert.match(route, /spreadMultipleOfBaseline: baseline\.multiple/);
  assert.match(desk, /Spread guard:/);
  assert.match(desk, /XAUUSD ±20 directional threshold/);
  assert.match(desk, /goldResult\.value\.ok/);
  assert.match(desk, /activeSatelliteSymbol/);
});
test('all distributable MacroLync MT5 bridge copies share one authenticated read-only contract', () => {
  const canonicalBridge = read('../public/MacroLyncBridge.mqh');
  assert.equal(read('../mql5/MacroLyncBridge.mqh'), canonicalBridge);
  assert.equal(read('../public/mql5/MacroLyncBridge.mqh'), canonicalBridge);
  assert.match(canonicalBridge, /x-macro-key/);
  assert.match(canonicalBridge, /safe_to_trade = false/);
  assert.doesNotMatch(canonicalBridge, /OrderSend|PositionModify|PositionClose/);
});
test('institutional technical confluence exposes Hurst, Gaussian Z-score and ADR/liquidity metrics with fail-closed gates', () => {
  const engine = read('../lib/quant/intradaySignalEngine.ts');
  const confluence = read('../lib/quant/technicalConfluence.ts');
  assert.match(engine, /estimateHurstExponent\(closes\)/);
  assert.match(engine, /hurst <= 0\.52/);
  assert.match(engine, /MEAN_REVERSION_ONLY/);
  assert.match(engine, /zScoreZone/);
  assert.match(engine, /Math\.abs\(zScore\) > 2\.5/);
  assert.match(engine, /adrUsedPct >= 85/);
  assert.match(engine, /asianRangeHigh/);
  assert.match(engine, /pdh: priorDay\?\.high/);
  assert.match(confluence, /zScore20/);
  assert.match(confluence, /value > 0\.52/);
});
test('macro context exposes zero-ambiguity executive desk fields and bridge parses them fail-closed', () => {
  const route = read('../app/api/v1/macro-context/route.ts');
  const types = read('../types/desk.ts');
  const bridge = read('../public/MacroLyncBridge.mqh');
  assert.match(route, /deskStatus/);
  assert.match(route, /maxRiskPct/);
  assert.match(route, /activeSessionWat/);
  assert.match(route, /deskLockoutReason/);
  for (const field of ['zScore','hurstExponent','ker','adrUsedPct','pdh','pdl','entryPrice','stopLoss','takeProfit1','takeProfit2']) {
    assert.match(route, new RegExp(field));
    assert.match(types, new RegExp(field));
  }
  for (const field of ['z_score','hurst_exponent','ker','adr_used_pct','pdh','pdl','entry_price','stop_loss','take_profit1','take_profit2']) assert.match(bridge, new RegExp(field));
  assert.match(bridge, /ML_JsonScalar\(selected_signal_json, "hurst"\)/);
  assert.match(bridge, /context\.desk_status == "LOCKOUT" && context\.max_risk_pct != 0\.0/);
  assert.match(bridge, /context\.allowed_to_trade = false/);
});
test('London and New York execution windows are fixed in WAT across daylight-saving changes', () => {
  const engine = read('../lib/quant/intradaySignalEngine.ts');
  const route = read('../app/api/v1/macro-context/route.ts');
  const desk = read('../app/components/DeskTerminal.tsx');
  assert.match(engine, /getActiveMarketSession/);
  assert.match(engine, /hour >= 13 && hour < 17/);
  assert.match(desk, /getActiveMarketSession/);
  assert.match(sessions, /America\\/New_York/);
  assert.match(desk, /EXECUTIVE DESK COMMAND/);
  assert.match(desk, /BROKER ACCOUNT GOVERNANCE NOT CONNECTED/);
  assert.match(sessions, /getNextMarketSessionOpenUtc/);
});
test('desk quote grid always reserves a fourth satellite slot and labels core instruments explicitly', () => {
  const desk = read('../app/components/DeskTerminal.tsx');
  assert.match(desk, /const activeSatelliteSymbol = satelliteSymbol \?\? 'GBPUSD'/);
  assert.match(desk, /CORE #1 · EURUSD/);
  assert.match(desk, /CORE #2 · XAUUSD/);
  assert.match(desk, /CORE #3 · USDJPY/);
  assert.match(desk, /SATELLITE #1 · /);
  assert.match(desk, /const displaySymbols = \[\.\.\.symbols, activeSatelliteSymbol\]/);
});
test('Gold real-yield driver prefers the same canonical Treasury snapshot vintage as cross-asset telemetry', () => {
  const gold = read('../lib/macro/goldAndRegimeEngine.ts');
  const telemetry = read('../lib/macro/providerTelemetry.ts');
  assert.match(gold, /const treasuryHistory = snapshotTreasury\?\.history\?\.length/);
  assert.match(gold, /const treasuryRetrievedAtUtc = snapshotTreasury\?\.retrievedAtUtc/);
  assert.match(telemetry, /calendarActive && snapshot\.calendarProvider === 'FAIRECONOMY_PUBLIC' \? utcWeekWindow\(\)/);
});
test('XAUUSD Fundamental Pair Dossier routes to the dedicated Gold liquidity and real-yield engine', () => {
  const dashboard = read('../app/components/MacroDashboard.tsx');
  assert.match(dashboard, /pair === 'XAUUSD' \? \(/);
  assert.match(dashboard, /goldContext\?\.goldBiasScore/);
  assert.match(dashboard, /goldContext\?\.liquidityRegime/);
  assert.match(dashboard, /10Y TIPS REAL YIELD/);
  assert.match(dashboard, /2Y-3M CURVE SPREAD/);
  assert.match(dashboard, /CBOE VIX \/ HY OAS/);
  assert.match(dashboard, /COMEX Gold non-commercial net long at/);
  const goldDossierBranch = dashboard.slice(dashboard.indexOf("pair === 'XAUUSD'"), dashboard.indexOf(') : (', dashboard.indexOf("pair === 'XAUUSD'")));
  assert.doesNotMatch(goldDossierBranch, /POLICY DIFF|REAL YIELD DIFF|2Y YIELD SPREAD/);
});
test('production UI fails closed on unconfigured account balance and never seeds mock execution prices', () => {
  const desk = read('../app/components/DeskTerminal.tsx');
  const accounts = read('../app/accounts/page.tsx');
  assert.match(desk, /useState<number \| null>\(null\)/);
  assert.match(desk, /BAL:|NOT SET \(ENTER REAL BALANCE\)/);
  assert.match(desk, /ENTER REAL ACCOUNT BALANCE TO COMPUTE LOTS/);
  assert.match(desk, /SAVE USER-ATTESTED BALANCE/);
  assert.match(desk, /MARKET CLOSED \(WEEKEND\)/);
  assert.match(desk, /globalDeskLockout \? 'STAND DOWN'/);
  assert.doesNotMatch(desk, /useState<number>\(10000\)|154\.50|2650|1\.085|6\.50/);
  assert.doesNotMatch(desk, /stopDistancePips = (?:30|35)|stopDistDollars[^;]*: 25/);
  assert.match(accounts, /currentEquityNumber = selected[\s\S]*: null/);
  assert.match(accounts, /NOT CONFIGURED · CONNECT A VERIFIED MT5 ACCOUNT/);
  assert.doesNotMatch(accounts, /selected \? Number\(selected\.equity\) : 10000/);
  const validationEngine = read('../lib/quant/monteCarloEngine.ts');
  const validationPage = read('../app/validation/page.tsx');
  assert.doesNotMatch(validationEngine, /initialBalance = 10_000|volume: 0\.1|profit \/ 50|net \/ 100|99\.9/);
  assert.match(validationPage, /NO VERIFIED TRADE HISTORY — IMPORT MT5 REPORT OR LOG REAL TRADES TO RUN MONTE CARLO/);
  assert.match(validationPage, /startingBalance === null/);
  assert.match(accounts, /useState<ManualTrade\[\]>\(\[\]\)/);
});
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function collectProductionSourceFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) return collectProductionSourceFiles(fullPath);
    return /\.(?:ts|tsx|js|jsx)$/.test(entry) ? [fullPath] : [];
  });
}
test('repository-wide static audit rejects default non-zero balances, seeded trades and mock prices', () => {
  const roots = ['app', 'components', 'lib', 'hooks', 'store', 'types'];
  const files = roots.flatMap((root) => collectProductionSourceFiles(join(repositoryRoot, root)));
  const source = files.map((file) => readFileSync(file, 'utf8')).join('\n');
  assert.ok(files.length > 0, 'production source directories must be scanned');
  assert.doesNotMatch(source, /\b(?:accountBalance|accountEquity|ticketBalance|startingBalance|initialBalance)\s*(?::\s*number(?:\s*\|\s*null)?\s*)?=\s*\d+(?:\.\d+)?/);
  assert.doesNotMatch(source, /\b(?:accountBalance|accountEquity|startingBalance|initialBalance)\s*:\s*\d+(?:\.\d+)?/);
  assert.doesNotMatch(source, /\b(?:accountBalance|accountEquity|ticketBalance|startingBalance|initialBalance)\s*=\s*useState(?:<[^>]+>)?\(\s*\d/);
  assert.doesNotMatch(source, /\b(?:sample|demo|mock)(?:Trades|Positions|Journal|Portfolio)\s*=\s*\[\s*\{/i);
  assert.doesNotMatch(source, /\b(?:mock|demo|fake)(?:Price|Bid|Ask|Quote)\s*[:=]\s*\d/i);
  const desk = read('../app/components/DeskTerminal.tsx');
  assert.match(desk, /ticketBalance \+ manualClosedTradesPnl/);
  assert.match(desk, /currentManualEquity/);
});