import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('owner authorization is a single configured identity and fails closed', async () => {
  const source = await read('lib/ownerAuth.ts');
  assert.match(source, /process\.env\.OWNER_EMAIL/);
  assert.match(source, /email\.trim\(\)\.toLowerCase\(\) === OWNER_EMAIL/);
  assert.match(source, /email_confirmed_at/);
  assert.match(source, /catch\s*\{\s*\/\/ Auth provider errors are always deny/);
  assert.doesNotMatch(source, /fidulync@gmail\.com/);
  assert.doesNotMatch(source, /ADMIN_EMAIL/);
});

test('commercial routes are explicitly retired in the personal edition', async () => {
  for (const path of [
    'app/api/v1/create-checkout/route.ts',
    'app/api/v1/customer-portal/route.ts',
    'app/api/v1/validate-license/route.ts',
    'app/api/v1/license/verify/route.ts',
    'app/api/v1/license/heartbeat/route.ts',
    'app/api/v1/license-bind/route.ts',
    'app/api/v1/license-transfer/route.ts',
    'app/api/v1/lookup-license/route.ts',
    'app/api/v1/provision-demo-license/route.ts',
    'app/api/v1/paystack-webhook/route.ts',
    'app/api/paystack/webhook/route.ts',
    'app/api/owner/licenses/route.ts',
  ]) {
    const source = await read(path);
    assert.match(source, /status:\s*410/, path);
    assert.match(source, /Personal Quant Edition/, path);
  }
});

test('private owner and research-governance routes independently verify owner identity', async () => {
  for (const path of [
    'app/api/owner/operations/route.ts',
    'app/api/owner/mt5-installations/route.ts',
    'app/api/owner/research-governance/route.ts',
    'app/api/owner/research-governance/models/route.ts',
    'app/api/owner/research-governance/validate/route.ts',
    'app/api/owner/artifacts/route.ts',
    'app/api/owner/artifacts/upload-url/route.ts',
    'app/api/owner/artifacts/register/route.ts',
  ]) {
    const source = await read(path);
    assert.match(source, /requireOwner\(request\)/, path);
  }
  const review = await read('app/api/owner/research-governance/models/review/route.ts');
  assert.match(review, /QUANT_INDEPENDENT_REVIEWER_IDS/);
  assert.match(review, /enforceDistributedRateLimit/);
});

test('legacy Paystack provisioning is not reachable through active route handlers', async () => {
  const checkout = await read('app/api/v1/create-checkout/route.ts');
  const webhook = await read('app/api/v1/paystack-webhook/route.ts');
  assert.match(checkout, /status:\s*410/);
  assert.match(webhook, /status:\s*410/);
});

test('database enforces global MT5 seat uniqueness across LIVE and DEMO types', async () => {
  const migration = await read('supabase/migrations/20261119130000_global_mt5_seat_login_uniqueness.sql');
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS ea_license_seats_mt5_login_global_uidx/);
  assert.match(migration, /ON public\.ea_license_seats \(mt5_login\)/);
  assert.match(migration, /WHERE mt5_login IS NOT NULL/);
});

test('private EA fleet module exposes read-only telemetry behind owner authorization', async () => {
  const source = await read('app/owner/OwnerOperations.tsx');
  assert.match(source, /\/api\/owner\/operations/);
  assert.match(source, /\/api\/mt5\/installations/);
  assert.match(source, /Portfolio risk telemetry/);
  assert.match(source, /does not override trading or risk eligibility checks/);
  assert.match(source, /Order approval/);
  assert.doesNotMatch(source, /Paystack|Checkout|Customer Portal/);
});

test('retired account and customer pages route to the private owner console', async () => {
  for (const path of ['app/account/page.tsx', 'app/customer/page.tsx', 'app/licensing/page.tsx']) {
    const source = await read(path);
    assert.match(source, /redirect\('\/owner'\)/, path);
  }
});

test('public navigation replaces owner entry with strategy validation', async () => {
  const shell = await read('components/PlatformShell.tsx');
  const footer = await read('components/PlatformFooter.tsx');
  assert.match(shell, /href: '\/research\/validation'/);
  assert.match(shell, /Private workspace/);
  assert.doesNotMatch(shell, /href: '\/owner'/);
  assert.doesNotMatch(shell, /href: '\/store'/);
  assert.match(footer, /Strategy validation & risk lab/);
  assert.doesNotMatch(footer, /Owner Console|\/store/);
});
