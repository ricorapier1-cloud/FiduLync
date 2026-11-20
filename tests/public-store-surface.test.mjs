import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const shell = read('../components/PlatformShell.tsx');
const footer = read('../components/PlatformFooter.tsx');
const proxy = read('../proxy.ts');

test('public storefront and customer checkout surfaces are absent', () => {
  assert.equal(existsSync(new URL('../app/store/page.tsx', import.meta.url)), false);
  assert.equal(existsSync(new URL('../app/components/StoreTerminal.tsx', import.meta.url)), false);
  assert.doesNotMatch(shell, /Paystack|Checkout|Customer Portal|Subscription|\/store/);
  assert.doesNotMatch(footer, /Paystack|Checkout|Customer Portal|Subscription|\/store/);
});

test('owner sign-in is not exposed through navigation or footer', () => {
  assert.doesNotMatch(shell, /href: '\/owner'|href="\/owner"|EA Fleet/);
  assert.doesNotMatch(footer, /href="\/owner"|Owner Console/);
  assert.match(shell, /Strategy Validation/);
  assert.match(shell, /\/research\/validation/);
});

test('private terminal gate fails closed and does not broadly exempt file extensions', () => {
  assert.match(proxy, /fidulync_owner_session/);
  assert.match(proxy, /PUBLIC_ASSET_PATHS/);
  assert.match(proxy, /'\\/icon\\.svg'/);
  assert.match(proxy, /manifest\\.webmanifest/);
  assert.match(proxy, /redirectToOwner\(request, true\)/);
  assert.doesNotMatch(proxy, /\\\.[a-zA-Z0-9]\{2,8\}\$/);
  assert.match(proxy, /X-Robots-Tag/);
});

test('legacy commerce endpoints explicitly return Gone', () => {
  for (const path of [
    '../app/api/v1/create-checkout/route.ts',
    '../app/api/v1/customer-portal/route.ts',
    '../app/api/v1/paystack-webhook/route.ts',
    '../app/api/paystack/webhook/route.ts',
  ]) {
    assert.match(read(path), /status:\s*410/, path);
  }
});
