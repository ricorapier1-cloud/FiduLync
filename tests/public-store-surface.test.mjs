import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const storePage = read('../app/store/page.tsx');
const storeComponent = read('../app/components/StoreTerminal.tsx');

test('personal EA Lab contains no customer checkout, licence or payment UI', () => {
  assert.match(storePage, /StoreTerminal/);
  assert.doesNotMatch(storePage, /LegacyStoreTerminal|Paystack|bridgeSource|readFile/);
  assert.doesNotMatch(storeComponent, /Paystack|Checkout|Customer Portal|license_key|payment_reference/i);
});

test('personal EA Lab remains advisory and does not place broker orders', () => {
  assert.match(storeComponent, /Research readiness only/);
  assert.match(storeComponent, /does not place broker orders/);
  assert.match(storeComponent, /QuantSupervisor\.mqh/);
});

test('private MT5 publisher credentials and internal bridge source are not rendered', () => {
  assert.doesNotMatch(storeComponent, /x-algo-key|ALGO_PRIVATE_API_KEY|Authorization:\s*Bearer/i);
  assert.doesNotMatch(storeComponent, /bridgeSource|View exact downloadable bridge source|Copy bridge source/);
});
