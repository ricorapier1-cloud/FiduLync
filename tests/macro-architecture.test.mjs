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

test('security: /owner returns a genuine 404 via notFound()', () => {
  assert.match(ownerPage, /notFound\(\)/);
  assert.doesNotMatch(ownerPage, /password|auth|login|Supabase/i);
});

test('security: commercial account/store surfaces redirect to the research terminal', () => {
  assert.match(storePage, /redirect\('\/'\)/);
  assert.match(accountPage, /redirect\('\/'\)/);
  assert.doesNotMatch(storePage, /PaystackCheckout|paystack/i);
  assert.doesNotMatch(accountPage, /PaystackCheckout|paystack/i);
});

test('architecture: /analytics redirects to /workbench', () => {
  assert.match(analyticsPage, /redirect\('\/workbench'\)/);
});

test('security: macro context API fails closed and validates installation tokens', () => {
  assert.match(macroContextRoute, /candidate\.startsWith\('flmt5_'\)/);
  assert.match(macroContextRoute, /createHash\('sha256'\)/);
  assert.match(macroContextRoute, /from\('mt5_installations'\)/);
  assert.match(macroContextRoute, /status: 503/);
  assert.match(macroContextRoute, /timingSafeEqual/);
  assert.doesNotMatch(macroContextRoute, /isLocalhost|if \(!macroSecret\) return true/);
});

test('architecture: macro context API is read-only and contains no order execution', () => {
  assert.match(macroContextRoute, /export async function GET/);
  assert.doesNotMatch(macroContextRoute, /export async function POST/);
  assert.doesNotMatch(macroContextRoute, /OrderSend|executeOrder|brokerPassword|tradeLot/i);
  assert.match(macroContextRoute, /checkRateLimit/);
});

test('research notebook starts empty and defaults to insufficient evidence', () => {
  assert.match(notebookPage, /useState<ResearchHypothesis\[]>\(\[\]\)/);
  assert.doesNotMatch(notebookPage, /INITIAL_DEMO_HYPOTHESIS|hyp-sample-01/);
  assert.match(notebookPage, /INSUFFICIENT_EVIDENCE/);
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

