import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const storeComponent = readFileSync(new URL('../app/components/LegacyStoreTerminal.tsx', import.meta.url), 'utf8');
const storePage = readFileSync(new URL('../app/store/page.tsx', import.meta.url), 'utf8');

test('public storefront does not render private publisher routes or authentication headers', () => {
  assert.doesNotMatch(storeComponent, /x-algo-key|ALGO_PRIVATE_API_KEY|\/api\/v1\/ea-heartbeat|\/api\/v1\/trade-log|Authorization:\s*Bearer/i);
});

test('public storefront does not inject or render the raw internal bridge source', () => {
  assert.doesNotMatch(storeComponent, /bridgeSource|View exact downloadable bridge source|Copy bridge source/);
  assert.doesNotMatch(storePage, /readFile|bridgeSource/);
});

test('public storefront keeps its MT5 download links limited to public integration includes', () => {
  assert.match(storeComponent, /href="\/mql5\/MacroLyncBridge\.mqh"/);
  assert.match(storeComponent, /href="\/mql5\/MacroLyncLicense\.mqh"/);
});
