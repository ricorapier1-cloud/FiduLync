import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const ownerPage = readFileSync(new URL('../app/owner/page.tsx', import.meta.url), 'utf8');
const storePage = readFileSync(new URL('../app/store/page.tsx', import.meta.url), 'utf8');
const accountPage = readFileSync(new URL('../app/account/page.tsx', import.meta.url), 'utf8');
const analyticsPage = readFileSync(new URL('../app/analytics/page.tsx', import.meta.url), 'utf8');
const macroContextRoute = readFileSync(new URL('../app/api/v1/macro-context/route.ts', import.meta.url), 'utf8');

test('security: /owner returns a genuine 404 via notFound()', () => {
  assert.match(ownerPage, /notFound\(\)/);
  assert.doesNotMatch(ownerPage, /password|auth|login|Supabase/i);
});

test('security: /store and /account cleanly redirect to the main research terminal', () => {
  assert.match(storePage, /redirect\('\/'\)/);
  assert.match(accountPage, /redirect\('\/'\)/);
  assert.doesNotMatch(storePage, /PaystackCheckout|paystack/i);
  assert.doesNotMatch(accountPage, /PaystackCheckout|paystack/i);
});

test('architecture: /analytics redirects to /workbench', () => {
  assert.match(analyticsPage, /redirect\('\/workbench'\)/);
});

test('architecture: /api/v1/macro-context is read-only and strictly contains no trade execution', () => {
  assert.match(macroContextRoute, /export async function GET/);
  assert.doesNotMatch(macroContextRoute, /export async function POST/);
  assert.doesNotMatch(macroContextRoute, /OrderSend|buy|sell|executeOrder|brokerPassword|tradeLot/i);
  assert.match(macroContextRoute, /checkRateLimit/);
});

test('architecture: research notebook and workbench pages exist', () => {
  assert.ok(existsSync(new URL('../app/notebook/page.tsx', import.meta.url)));
  assert.ok(existsSync(new URL('../app/workbench/page.tsx', import.meta.url)));
});
