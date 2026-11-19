import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';

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
