import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const macroData = read('../lib/macroData.ts');
const macroEngine = read('../lib/macroEngine.ts');
const currencyStrength = read('../lib/currencyStrength.ts');
const dashboard = read('../app/components/MacroDashboard.tsx');
const marketFeeds = read('../lib/marketFeeds.ts');
const technicalEngine = read('../lib/technicalEngine.ts');
const aiBrief = read('../lib/aiBrief.ts');
const storeTerminal = read('../app/components/StoreTerminal.tsx');
const storePage = read('../app/store/page.tsx');
const envExample = read('../.env.example');
const historicalBackfill = read('../scripts/mt5_historical_backfill.py');
const publicHistoricalBackfill = read('../public/downloads/FiduLync_MT5_Historical_Backfill.py');
const readme = read('../README.md');
const artifactUi = read('../app/owner/OwnerArtifactRelease.tsx');
const uploadUrlApi = read('../app/api/owner/artifacts/upload-url/route.ts');
const registerApi = read('../app/api/owner/artifacts/register/route.ts');
const idempotentArtifactMigration = read('../supabase/migrations/20261119133834_idempotent_ea_artifact_registration.sql');

test('provider outage returns an empty, untimestamped macro fallback', () => {
  const fallback = macroData.match(/export function getFallbackSnapshot\(\): MacroSnapshot \{[\s\S]*?\n\}/)?.[0];
  assert.ok(fallback, 'fallback snapshot function exists');
  assert.match(fallback, /asOf: ''/);
  assert.match(fallback, /currencies: \[\]/);
  assert.match(fallback, /cot: \[\]/);
  assert.match(fallback, /catalysts: \[\]/);
  assert.doesNotMatch(fallback, /policyRate: [1-9]|inflation: [1-9]/);
});

test('macro observations preserve source observation dates, not only retrieval time', () => {
  for (const field of ['policyRateAsOf', 'corePceAsOf', 'cpiAsOf', 'twoYearYieldAsOf']) {
    assert.match(macroData, new RegExp(field));
  }
  assert.match(macroEngine, /observationFresh\(currency\.policyRateAsOf, 10\)/);
  assert.match(macroEngine, /observationFresh\(currency\.inflationAsOf, 60\)/);
  assert.match(macroEngine, /observationFresh\(currency\.twoYearYieldAsOf, 10\)/);
});

test('stale macro snapshots are rejected instead of silently reused', () => {
  assert.match(macroEngine, /ageMs > 24 \* 60 \* 60_000/);
  assert.match(macroEngine, /return getFallbackSnapshot\(\)/);
  assert.match(macroEngine, /calendarProvider === 'finnhub'/);
  assert.match(macroEngine, /COT_DATA_PROVIDER_PERSONAL_USE_ENABLED === 'true'/);
  assert.match(macroEngine, /SNB_DATA_SOURCE_ENABLED === 'true'/);
});

test('weekly CFTC and daily reference feeds use bounded shared caching', () => {
  assert.match(macroData, /getCachedData\('macro:cftc-cot', getCftcCot, 6 \* 60 \* 60\)/);
  assert.match(macroData, /getCachedData\('macro:frankfurter-reference', getFrankfurterRates, 6 \* 60 \* 60\)/);
});

test('dashboard never substitutes hardcoded events or fabricated risk values', () => {
  assert.doesNotMatch(dashboard, /US Non-Farm Payrolls|425 bps \(G8\)|Tier-1 Catalyst • 13:30 UTC/);
  assert.match(dashboard, /providerPolicyInputs/);
  assert.match(dashboard, /NO VERIFIED DATA/);
  assert.match(dashboard, /formatQuoteAge\(quote\.timestamp, now\)/);
  assert.match(dashboard, /SNAPSHOT REFRESHED/);
  assert.match(dashboard, /not endorsed or certified by the Federal Reserve Bank of St\. Louis/);
  assert.doesNotMatch(dashboard, /'LIVE' : snapshot\.source/);
});

test('personal-use provider gates are separate from commercial permissions', () => {
  assert.match(marketFeeds, /FINNHUB_PERSONAL_PLAN_ACTIVE === 'true'/);
  assert.match(marketFeeds, /EXCHANGERATE_API_PERSONAL_USE_ENABLED/);
  assert.match(marketFeeds, /GOLD_API_PERSONAL_USE_ENABLED/);
  assert.match(marketFeeds, /Frankfurter is a public reference-rate service/);
  assert.match(marketFeeds, /T00:00:00\.000Z/);
  assert.match(technicalEngine, /TWELVE_DATA_PERSONAL_DISPLAY_PLAN_ACTIVE/);
  assert.match(technicalEngine, /MARKET_DATA_PROVIDER_PERSONAL_USE_ENABLED/);
});

test('FRED observations are not transmitted to external AI prompts', () => {
  assert.match(aiBrief, /containsFredObservations/);
  assert.match(aiBrief, /if \(!apiKey \|\| containsFredObservations\) return fallback/);
});

test('personal edition retires checkout and customer licence APIs', () => {
  for (const path of [
    '../app/api/v1/create-checkout/route.ts',
    '../app/api/v1/customer-portal/route.ts',
    '../app/api/v1/validate-license/route.ts',
    '../app/api/v1/license/verify/route.ts',
    '../app/api/v1/license/heartbeat/route.ts',
    '../app/api/v1/license-bind/route.ts',
    '../app/api/v1/license-transfer/route.ts',
    '../app/api/v1/lookup-license/route.ts',
    '../app/api/v1/provision-demo-license/route.ts',
    '../app/api/v1/paystack-webhook/route.ts',
    '../app/api/paystack/webhook/route.ts',
    '../app/api/owner/licenses/route.ts',
  ]) {
    assert.match(read(path), /status:\s*410/ , path);
  }
  assert.match(envExample, /PERSONAL_QUANT_EDITION=true/);
  assert.doesNotMatch(envExample, /PAYSTACK_SECRET_KEY|PAYSTACK_WEBHOOK_SECRET|ALGO_PRIVATE_API_KEY/);
});

test('private EA lab uses owner MT5 publisher and supervisor components only', () => {
  assert.match(storePage, /import StoreTerminal/);
  assert.doesNotMatch(storePage, /LegacyStoreTerminal|Paystack|bridgeSource|readFile/);
  assert.match(storeTerminal, /QuantSupervisor\.mqh/);
  assert.match(storeTerminal, /FiduLync_MT5_Market_Publisher\.py/);
  assert.match(storeTerminal, /per-installation publisher token/);
  assert.doesNotMatch(storeTerminal, /MacroLyncBridge|Paystack|Checkout|Eridam_Nexus|Velocity_Vault|MacroLync_G10|ALGO_PRIVATE_API_KEY/);
  assert.match(storeTerminal, /atr_sl_pips === null \? 'Unavailable'/);
  assert.match(storeTerminal, /atr_tp_pips === null \? 'Unavailable'/);
});

test('historical MT5 backfill imports only real closed broker bars and never trades', () => {
  assert.equal(historicalBackfill, publicHistoricalBackfill);
  assert.match(historicalBackfill, /MT5_BACKFILL_START.*1996-01-01/);
  assert.match(historicalBackfill, /copy_rates_range/);
  assert.match(historicalBackfill, /bar_epoch \+ seconds > now_epoch/);
  assert.match(historicalBackfill, /BATCH_SIZE = .*1000/);
  assert.match(historicalBackfill, /FIDULYNC_PUBLISHER_TOKEN/);
  assert.match(historicalBackfill, /is_closed/);
  assert.doesNotMatch(historicalBackfill, /order_send|order_send_async|TRADE_ACTION/);
});

test('private EA artifact upload uses owner-only signed Storage URLs and audited registration', () => {
  assert.match(uploadUrlApi, /requireOwner/);
  assert.match(registerApi, /requireOwner/);
  assert.match(registerApi, /record_ea_product_artifact_upload/);
  assert.match(idempotentArtifactMigration, /release_approved = CASE/);
  assert.match(artifactUi, /crypto\.subtle\.digest\('SHA-256'/);
  assert.match(artifactUi, /api\/owner\/artifacts\/upload-url/);
  assert.match(artifactUi, /api\/owner\/artifacts\/register/);
});

test('owner release approval is distinct from upload and laptop compile is prepared', () => {
  assert.match(artifactUi, /Approve release/);
  assert.match(artifactUi, /zero errors and zero warnings/);
  assert.match(readme, /Personal Quant Edition/);
});
