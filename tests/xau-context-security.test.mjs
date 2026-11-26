import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const route = readFileSync(new URL('../app/api/v1/xauusd-context/route.ts', import.meta.url), 'utf8');

test('XAU context accepts only the dedicated private macro API credential, never the cron secret or URL tokens', () => {
  assert.match(route, /MACRO_API_TOKEN/);
  assert.match(route, /MACROLYNC_API_SECRET/);
  assert.match(route, /ALGO_PRIVATE_API_KEY/);
  assert.doesNotMatch(route, /CRON_SECRET/);
  assert.match(route, /authorization/);
  assert.match(route, /Bearer /);
  assert.match(route, /timingSafeEqual/);
  assert.doesNotMatch(route, /searchParams|get\(['"]token['"]\)/);
  assert.match(route, /A valid private bearer token is required/);
});
