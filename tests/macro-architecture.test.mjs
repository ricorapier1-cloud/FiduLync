import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const ownerPage = read('../app/owner/page.tsx');
const storePage = read('../app/store/page.tsx');
const accountPage = read('../app/account/page.tsx');
const analyticsPage = read('../app/analytics/page.tsx');
const macroContextRoute = read('../app/api/v1/macro-context/route.ts');
const notebookPage = read('../app/notebook/page.tsx');
const legacySignalRoute = read('../app/api/v1/macro-signal/route.ts');
const macroEngine = read('../lib/macroEngine.ts');

test('security: owner login and control-console implementation is absent; /owner remains a genuine 404', () => {
  assert.match(ownerPage, /notFound\(\)/);
  assert.doesNotMatch(ownerPage, /password|auth|login|Supabase/i);
  for (const retiredPath of [
    '../components/OwnerConsole.tsx',
    '../app/owner/OwnerOperations.tsx',
    '../app/owner/OwnerControlPlane.tsx',
    '../lib/ownerAuth.ts',
    '../app/api/owner/verify/route.ts',
    '../app/api/owner/operations/route.ts',
    '../app/api/owner/control-plane/route.ts',
    '../app/api/owner/diagnostics/route.ts',
    '../app/api/owner/mt5-installations/route.ts',
    '../app/api/owner/licenses/route.ts',
    '../app/api/mt5/installations/route.ts',
  ]) assert.equal(existsSync(new URL(retiredPath, import.meta.url)), false, retiredPath);
  for (const retiredPath of [
    '../app/api/v1/market-data/ingest/route.ts',
    '../app/api/mt5/ingest/route.ts',
    '../scripts/mt5_market_publisher.py',
    '../docs/OWNER_HYBRID_MARKET_DATA_RUNBOOK.md',
  ]) assert.equal(existsSync(new URL(retiredPath, import.meta.url)), false, retiredPath);
});

test('security: commercial account/store surfaces redirect and retired storefront components are absent', () => {
  assert.match(storePage, /redirect\('\/'\)/);
  assert.match(accountPage, /redirect\('\/'\)/);
  assert.doesNotMatch(storePage, /PaystackCheckout|paystack/i);
  assert.doesNotMatch(accountPage, /PaystackCheckout|paystack/i);
  for (const retiredPath of [
    '../components/CustomerLicensePortal.tsx',
    '../components/QuantStrategyCatalog.tsx',
    '../components/TopPairBanner.tsx',
  ]) assert.equal(existsSync(new URL(retiredPath, import.meta.url)), false, retiredPath);
});

test('architecture: quote display and polling are consolidated into the Swissquote desk terminal', () => {
  const dashboard = read('../app/components/MacroDashboard.tsx');
  const desk = read('../app/components/DeskTerminal.tsx');
  assert.doesNotMatch(dashboard, /api\/macro\/quotes|macro-quote-strip|MarketQuote|initialQuotes/);
  assert.match(desk, /api\/v1\/live-quotes/);
  assert.match(desk, /FRESH BBO/);
});

test('architecture: /analytics redirects to /workbench', () => {
  assert.match(analyticsPage, /redirect\('\/workbench'\)/);
});

test('security: macro context API accepts only the private read-only service credential and fails closed', () => {
  assert.match(macroContextRoute, /MACRO_API_TOKEN/);
  assert.match(macroContextRoute, /x-macro-key/);
  assert.match(macroContextRoute, /safeEqual\(candidate, secret\)/);
  assert.doesNotMatch(macroContextRoute, /flmt5_|mt5_installations/);
  assert.match(macroContextRoute, /status: 503/);
  assert.match(macroContextRoute, /timingSafeEqual/);
  assert.doesNotMatch(macroContextRoute, /isLocalhost|if \(!macroSecret\) return true/);
});

test('architecture: macro context API is read-only and contains no order execution', () => {
  assert.match(macroContextRoute, /export async function GET/);
  assert.doesNotMatch(macroContextRoute, /export async function POST/);
  assert.doesNotMatch(macroContextRoute, /OrderSend|executeOrder|brokerPassword|tradeLot/i);
  assert.match(macroContextRoute, /consume_api_rate_limit/);
  assert.match(macroContextRoute, /decision_status/);
  assert.match(macroContextRoute, /UNVERIFIED_CALENDAR/);
  assert.match(macroContextRoute, /news_lockout: dossier\.eventRiskLockout \|\| snapshot\.calendarSource !== 'provider'/);
  assert.match(macroContextRoute, /Retry-After/);
});

test('research notebook starts empty and defaults to insufficient evidence', () => {
  assert.match(notebookPage, /useState<ResearchHypothesis\[]>\(\[\]\)/);
  assert.doesNotMatch(notebookPage, /INITIAL_DEMO_HYPOTHESIS|hyp-sample-01/);
  assert.match(notebookPage, /INSUFFICIENT_EVIDENCE/);
});

test('public MT5 bridge is read-only macro context with no licensing, heartbeat or synthetic tester path', () => {
  const bridge = read('../public/mql5/MacroLyncBridge.mqh');
  assert.match(bridge, /api\/v1\/macro-context/);
  assert.match(bridge, /x-macro-key/);
  assert.match(bridge, /safe_to_trade = false/);
  assert.doesNotMatch(bridge, /license_key|LogClosedTrade|MacroLyncSendHeartbeat|SimulateTesterSignal|api\/v1\/macro-signal/i);
  for (const legacyFile of [
    '../public/downloads/AlgoLync_EA_README.txt',
    '../public/downloads/Eridam_Nexus_Adaptive_Demo.mq5',
    '../public/downloads/MacroLyncLicense.mqh',
    '../public/downloads/MacroLync_G10_Breakout_Test.mq5',
    '../public/downloads/MacroLync_Session_Momentum_Test.mq5',
    '../public/downloads/Velocity_Vault_Momentum_Demo.mq5',
  ]) assert.equal(existsSync(new URL(legacyFile, import.meta.url)), false, legacyFile);
  for (const legacyEngine of ['../lib/signalEngine.ts', '../lib/technicalEngine.ts', '../lib/macro/centralBankEngine.ts'])
    assert.equal(existsSync(new URL(legacyEngine, import.meta.url)), false, legacyEngine);
});

test('research pages exist', () => {
  assert.ok(existsSync(new URL('../app/notebook/page.tsx', import.meta.url)));
  assert.ok(existsSync(new URL('../app/workbench/page.tsx', import.meta.url)));
});

test('legacy macro-signal endpoint is retired and macro scoring fails closed', () => {
  assert.match(legacySignalRoute, /status: 410/);
  assert.match(legacySignalRoute, /api\/v1\/macro-context/);
  assert.match(macroEngine, /policyRateObservationDate/);
  assert.match(macroEngine, /inflationObservationDate/);
  assert.match(macroEngine, /if \(!verified\(base\) \|\| !verified\(quote\)\) return null/);
});


test('legacy storefront, licensing, payments and execution APIs are blocked at the application edge', () => {
  const proxy = read('../proxy.ts');
  assert.match(proxy, /export function proxy/);
  assert.match(proxy, /status: 410/);
  for (const route of [
    '/api/v1/create-checkout',
    '/api/v1/customer-portal',
    '/api/v1/paystack-webhook',
    '/api/v1/license-bind',
    '/api/v1/trade-log',
    '/api/mt5/ingest',
  ]) assert.ok(proxy.includes(route), route);
  assert.doesNotMatch(proxy, /'\/api\/v1\/top-pairs'/);
  assert.doesNotMatch(read('../app/components/MacroDashboard.tsx'), /TopPairBanner|top-pairs/);
});

test('architecture: one evidence-gated macro opportunity board is integrated into the main research flow', () => {
  const dashboard = read('../app/components/MacroDashboard.tsx');
  const board = read('../app/components/PairOpportunityBoard.tsx');
  const route = read('../app/api/v1/top-pairs/route.ts');
  assert.match(dashboard, /PairOpportunityBoard/);
  assert.match(dashboard, /href="#opportunities"/);
  assert.ok(board.includes("api/v1/top-pairs"));
  assert.ok(route.includes("confidence === 'HIGH' || dossier.confidence === 'MODERATE'"));
  assert.ok(route.includes('NO_QUALIFIED_CANDIDATES'));
  assert.doesNotMatch(route, /divergence_pair: pair/);
});
