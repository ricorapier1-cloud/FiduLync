import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const macroData = read('../lib/macroData.ts');
const macroEngine = read('../lib/macroEngine.ts');
const dashboard = read('../app/components/MacroIntelligenceDashboard.tsx');
const crossAsset = read('../app/analytics/page.tsx');
const homePage = read('../app/page.tsx');
const aiBrief = read('../lib/aiBrief.ts');
const envExample = read('../.env.example');
const macroContextApi = read('../app/api/v1/macro-context/route.ts');
const macroContextBridge = read('../MQL5/Include/FiduLync/MacroContextBridge.mqh');
const marketFeeds = read('../lib/marketFeeds.ts');
const currencyStrength = read('../lib/currencyStrength.ts');

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
  assert.ok(macroEngine.includes('observationFresh(currency.policyRateAsOf, policyRateMaxAgeDays(currency.policyRateProvider))'));
  assert.ok(macroEngine.includes('observationFresh(currency.inflationAsOf, 75)'));
  assert.ok(macroEngine.includes('observationFresh(currency.twoYearYieldAsOf, 10)'));
});

test('stale macro snapshots are rejected instead of silently reused', () => {
  assert.match(macroEngine, /ageMs > 24 \* 60 \* 60_000/);
  assert.match(macroEngine, /return getFallbackSnapshot\(\)/);
  assert.match(macroEngine, /calendarProvider === 'finnhub'/);
  assert.match(macroEngine, /COT_DATA_PROVIDER_PERSONAL_USE_ENABLED === 'true'/);
  assert.match(macroEngine, /SNB_PERSONAL_USE_ENABLED === 'true'/);
});

test('CFTC positioning is bounded-cached while daily reference FX rates are excluded', () => {
  assert.match(macroData, /getCachedData\('macro:cftc-cot', getCftcCot, 6 \* 60 \* 60\)/);
  assert.doesNotMatch(macroData, /Frankfurter|getFrankfurterRates|ecbRates/);
});

test('active terminal is macro-only and does not depend on technical signals or broker quotes', () => {
  assert.match(homePage, /MacroIntelligenceDashboard/);
  assert.match(homePage, /getMacroSnapshot/);
  assert.doesNotMatch(homePage, /getMarketQuotes|MarketQuote|technicalEngine|signalEngine/);
  assert.match(dashboard, /G8 currency strength/);
  assert.match(dashboard, /Central-bank policy & inflation matrix/);
  assert.match(dashboard, /CFTC COT/);
  assert.match(dashboard, /Upcoming economic events/);
  assert.doesNotMatch(dashboard, /FxDriverAssessment|technical_data_verified|safeToTrade|OrderSend|ATR|RSI|ADX/);
});

test('cross-asset board displays source observations and refuses fabricated correlations', () => {
  assert.match(crossAsset, /Cross-asset observations/);
  assert.match(crossAsset, /tenYearRealYieldPct/);
  assert.match(crossAsset, /usdBroadIndex/);
  assert.match(crossAsset, /snapshot\.cot/);
  assert.match(crossAsset, /not displayed until synchronized historical observations/);
  assert.doesNotMatch(crossAsset, /correlationCoefficient\s*=\s*0\./);
});

test('provider entitlements remain explicit and separate from key presence', () => {
  assert.match(macroData, /COT_DATA_PROVIDER_PERSONAL_USE_ENABLED === 'true'/);
  assert.match(macroData, /SNB_DATA_SOURCE_ENABLED === 'true'/);
  assert.match(envExample, /PERSONAL_QUANT_EDITION=true/);
  assert.doesNotMatch(envExample, /PAYSTACK_SECRET_KEY|PAYSTACK_WEBHOOK_SECRET/);
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
    assert.match(read(path), /status:\s*410/, path);
  }
});

test('browser owner console is absent while privileged installation APIs remain protected', () => {
  for (const path of [
    '../app/owner/page.tsx',
    '../app/owner/OwnerOperations.tsx',
    '../app/owner/OwnerTradingDesk.tsx',
    '../app/owner/OwnerResearchGovernance.tsx',
    '../app/owner/OwnerArtifactRelease.tsx',
  ]) {
    assert.equal(existsSync(new URL(path, import.meta.url)), false);
  }
  const installationsApi = read('../app/api/owner/mt5-installations/route.ts');
  assert.match(installationsApi, /requireOwner/);
});

test('MT5 macro context is installation-authenticated and read-only', () => {
  assert.match(macroContextApi, /createHash\('sha256'\)/);
  assert.match(macroContextApi, /token_hash=eq\./);
  assert.match(macroContextApi, /status=eq\.active/);
  assert.match(macroContextApi, /x-mt5-timestamp/);
  assert.match(macroContextApi, /enforceDistributedRateLimit/);
  assert.match(macroContextApi, /high_impact_lockout: !calendarVerified/);
  assert.match(macroContextApi, /INSUFFICIENT_EVIDENCE/);
  assert.doesNotMatch(macroContextApi, /OrderSend|CTrade|PositionClose|PositionModify/);
  assert.match(macroContextBridge, /\/api\/v1\/macro-context\?symbol=/);
  assert.match(macroContextBridge, /Authorization: Bearer/);
  assert.match(macroContextBridge, /X-MT5-Timestamp/);
  assert.doesNotMatch(macroContextBridge, /OrderSend|CTrade|PositionClose|PositionModify/);
});

test('technical EA approval, broker ingestion and legacy signal routes are retired', () => {
  for (const path of [
    '../app/api/v1/ea-supervisor/decision/route.ts',
    '../app/api/v1/market-data/ingest/route.ts',
    '../app/api/v1/macro-signal/route.ts',
  ]) {
    assert.match(read(path), /status:\s*410/, path);
  }
});


test('COT ranks require at least 52 observations and never impute missing weekly change as zero', () => {
  assert.match(macroData, /history.length < 52/);
  assert.match(macroData, /sampleSize: history.length/);
  assert.match(macroData, /changeLong === null \|\| changeShort === null/);
  assert.doesNotMatch(macroData, /Number\.isFinite\(changeLong\) \? changeLong : 0/);
  assert.match(macroEngine, /position\.sampleSize >= 52/);
  assert.match(macroEngine, /position\.publishedAt/);
  assert.doesNotMatch(macroEngine, /percentile\s*\?\?\s*50/);
});

test('annual World Bank inflation cannot enter current monthly relative-strength scores', () => {
  assert.match(macroEngine, /case 'world-bank':[\s\S]*?default: return false/);
  assert.match(currencyStrength, /MAX_INFLATION_AGE_MS = 75/);
  assert.match(currencyStrength, /item\.inflationProvider !== 'world-bank'/);
  assert.match(currencyStrength, /currencies\.length !== MAJOR_CURRENCIES\.length/);
});

test('market quote aggregation never substitutes daily reference rates or mixes installations', () => {
  assert.doesNotMatch(marketFeeds, /getFrankfurterQuotes|getExchangeRateQuotes|getGoldQuote/);
  assert.doesNotMatch(marketFeeds, /getCachedData|market:live-quotes/);
  assert.match(marketFeeds, /installationId\\s*\\?/);
  assert.match(marketFeeds, /installation\.status/);
  assert.match(marketFeeds, /now - quoteTime > 30_000/);
});

test('calendar feed freshness is mandatory for event-risk clearance', () => {
  assert.match(macroEngine, /calendarRetrievedAt/);
  assert.match(macroEngine, /isObservationFresh\(snapshot\.calendarRetrievedAt, 60 \* 60_000\)/);
  assert.doesNotMatch(macroData, /getCachedData\('macro:fair-economy-calendar'/);
  assert.match(macroData, /snapshot\.calendarRetrievedAt = new Date\(\)\.toISOString\(\)/);
  assert.match(macroContextApi, /high_impact_lockout: !calendarVerified/);
});

test('cached official statistics and FRED series are freshness-checked independently', () => {
  assert.match(macroData, /fredRetrievedAt: new Date\(\)\.toISOString\(\)/);
  assert.match(macroEngine, /officialStatisticsFresh/);
  assert.match(macroEngine, /fredRetrievalFresh/);
  assert.match(macroEngine, /observationFresh\(snapshot\.usIndicators\?\.retrievedAt, 1\)/);
  assert.match(macroEngine, /observationFresh\(snapshot\.usIndicators\?\.fredRetrievedAt, 1\)/);
});

test('gold receives no currency-style heuristic score', () => {
  assert.match(macroEngine, /if \(baseCode === 'XAU'\) return null/);
  assert.match(macroContextApi, /Gold-specific real-yield, official-sector demand and positioning model is not validated/);
});
