import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';
import guards from '../.quant-test/institutionalGuards.js';

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('personal edition keeps payment and customer account endpoints retired', () => {
  for (const path of [
    '../app/api/v1/create-checkout/route.ts',
    '../app/api/v1/verify-payment/route.ts',
    '../app/api/v1/bind-account/route.ts',
    '../app/api/v1/validate-license/route.ts',
    '../app/api/v1/customer-portal/route.ts',
  ]) {
    const route = source(path);
    assert.match(route, /status:\s*410/, `${path} must remain permanently retired`);
  }
});

test('macro refresh does not depend on a second scheduled GitHub secret', () => {
  assert.equal(existsSync(new URL('../.github/workflows/hourly-macro-sync.yml', import.meta.url)), false);
  const vercel = JSON.parse(source('../vercel.json'));
  assert.ok(vercel.crons.some((cron) => cron.path === '/api/cron/sync-macro' && cron.schedule === '0 0 * * *'));
});

test('Quant Lab is a distinct technical research surface', () => {
  const page = source('../app/research/page.tsx');
  const component = source('../app/components/QuantResearchLab.tsx');
  assert.match(page, /QuantResearchLab/);
  for (const indicator of ['rsi14', 'adx', 'hurst_exponent', 'trend_r_squared', 'gaussian_z_score', 'kaufman_efficiency_ratio']) {
    assert.ok(component.includes(indicator), `Quant Lab must display ${indicator}`);
  }
  assert.match(component, /technical_data_verified/);
  assert.match(component, /macro_data_verified/);
});

test('macro relative-value ranking never invents a pair or claims execution eligibility', () => {
  const candidate = guards.getTopRelativeValueCandidate([
    { currency: 'USD', score: 80 },
    { currency: 'EUR', score: 20 },
    { currency: 'JPY', score: -30 },
    { currency: 'NOK', score: 99 },
    { currency: 'GBP', score: Number.POSITIVE_INFINITY },
  ]);
  assert.deepEqual(candidate, { pair: 'USDJPY', direction: 'LONG', spread: 110, base: 'USD', quote: 'JPY' });
  assert.equal(guards.getTopRelativeValueCandidate([{ currency: 'USD', score: 10 }]), null);
  assert.equal(guards.getTopRelativeValueCandidate([{ currency: 'USD', score: 10 }, { currency: 'EUR', score: 10 }]), null);
});

test('top-pair endpoint and banner describe macro candidates, never executable trades', () => {
  const route = source('../app/api/v1/top-pairs/route.ts');
  const banner = source('../components/TopPairBanner.tsx');
  assert.match(route, /execution_eligibility:\s*'NOT_EVALUATED'/);
  assert.doesNotMatch(route, /safe_to_trade|top_executable_pair/);
  assert.match(banner, /MACRO RELATIVE-VALUE RESEARCH/);
  assert.match(banner, /Execution: NOT EVALUATED/);
});

test('private alert dispatch fails closed without its dedicated secret', () => {
  const route = source('../app/api/v1/dispatch-alert/route.ts');
  assert.match(route, /ALGO_PRIVATE_API_KEY/);
  assert.match(route, /Private alert dispatch is not configured/);
  assert.doesNotMatch(route, /process\.env\.CRON_SECRET/);
});

test('public commercial product-readiness route is retired', () => {
  const route = source('../app/api/v1/product-readiness/route.ts');
  assert.match(route, /status:\s*410/);
});
