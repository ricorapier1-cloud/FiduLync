import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const shell = read('../components/PlatformShell.tsx');
const footer = read('../components/PlatformFooter.tsx');

test('public storefront and customer checkout surfaces are absent', () => {
  assert.equal(existsSync(new URL('../app/store/page.tsx', import.meta.url)), false);
  assert.equal(existsSync(new URL('../app/components/StoreTerminal.tsx', import.meta.url)), false);
  assert.doesNotMatch(shell, /Paystack|Checkout|Customer Portal|Subscription|\/store/);
  assert.doesNotMatch(footer, /Paystack|Checkout|Customer Portal|Subscription|\/store/);
});

test('all browser login and owner-console surfaces are removed', () => {
  assert.equal(existsSync(new URL('../app/owner/page.tsx', import.meta.url)), false);
  assert.equal(existsSync(new URL('../app/owner/OwnerOperations.tsx', import.meta.url)), false);
  assert.equal(existsSync(new URL('../proxy.ts', import.meta.url)), false);
  assert.doesNotMatch(shell, /href:\s*'\/owner'|href="\/owner"|Owner Console|Sign in|Login/);
  assert.doesNotMatch(footer, /href="\/owner"|Owner Console|Sign in|Login/);
  assert.match(shell, /No sign-in required/);
});

test('retired commerce routes remain retired', () => {
  for (const path of [
    '../app/api/v1/create-checkout/route.ts',
    '../app/api/v1/customer-portal/route.ts',
    '../app/api/v1/paystack-webhook/route.ts',
    '../app/api/paystack/webhook/route.ts',
  ]) {
    assert.match(read(path), /status:\s*410/, path);
  }
});
