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

test('sensitive installation and governance APIs remain server-authorized', async () => {
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
  const migration = await read('supabase/migrations/20261119115211_global_mt5_seat_login_uniqueness.sql');
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS ea_license_seats_mt5_login_global_uidx/);
  assert.match(migration, /ON public\.ea_license_seats \(mt5_login\)/);
  assert.match(migration, /WHERE mt5_login IS NOT NULL/);
});

test('browser owner console is removed while sensitive management APIs remain protected', async () => {
  const { existsSync } = await import('node:fs');
  assert.equal(existsSync(new URL('../app/owner/page.tsx', import.meta.url)), false);
  assert.equal(existsSync(new URL('../app/owner/OwnerOperations.tsx', import.meta.url)), false);
  for (const path of ['app/api/owner/operations/route.ts', 'app/api/owner/mt5-installations/route.ts']) {
    const source = await read(path);
    assert.match(source, /requireOwner|isAuthorizedOwnerEmail/);
  }
});

test('retired account and customer pages route to the public research terminal', async () => {
  for (const path of ['app/account/page.tsx', 'app/customer/page.tsx', 'app/licensing/page.tsx']) {
    const source = await read(path);
    assert.ok(source.includes("redirect('/')"), path);
  }
});

test('public navigation contains only macro research surfaces', async () => {
  const shell = await read('components/PlatformShell.tsx');
  const footer = await read('components/PlatformFooter.tsx');
  assert.match(shell, /href: '\/analytics'/);
  assert.match(shell, /href: '\/research\/notebook'/);
  assert.match(shell, /No sign-in required/);
  assert.doesNotMatch(shell, /href: '\/owner'|href: '\/risk'|href: '\/research'|href: '\/research\/validation'/);
  assert.match(footer, /Fundamental research notebook/);
  assert.doesNotMatch(footer, /Strategy validation|Risk planning|Owner Console|QuantSupervisor/);
});

test('the legacy technical signal endpoint is retired', async () => {
  const route = await read('app/api/v1/macro-signal/route.ts');
  assert.match(route, /status:\s*410/);
  assert.match(route, /technical decisions belong inside independent MT5 EAs/);
});
