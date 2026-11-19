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

test('critical public licensing endpoints use distributed fail-closed rate limiting', async () => {
  for (const path of [
    'app/api/v1/validate-license/route.ts',
    'app/api/v1/bind-account/route.ts',
    'app/api/v1/provision-demo-license/route.ts',
    'app/api/v1/license-bind/route.ts',
    'app/api/owner/verify/route.ts',
  ]) {
    const source = await read(path);
    assert.match(source, /enforceDistributedRateLimit/, path);
    assert.match(source, /rate\.unavailable/, path);
    assert.match(source, /status:\s*503/, path);
  }
});

test('owner privileged routes independently verify administrator or reviewer identity', async () => {
  for (const path of [
    'app/api/owner/operations/route.ts',
    'app/api/owner/licenses/route.ts',
    'app/api/owner/mt5-installations/route.ts',
    'app/api/owner/control-plane/route.ts',
    'app/api/owner/research-governance/route.ts',
    'app/api/owner/research-governance/models/route.ts',
    'app/api/owner/research-governance/validate/route.ts',
  ]) {
    const source = await read(path);
    assert.match(source, /requireOwner\(request\)/, path);
  }
  const review = await read('app/api/owner/research-governance/models/review/route.ts');
  assert.match(review, /QUANT_INDEPENDENT_REVIEWER_IDS/);
  assert.match(review, /enforceDistributedRateLimit/);
});

test('Paystack entitlement minting verifies provider-side payment and server price', async () => {
  const source = await read('lib/provisionLicense.ts');
  assert.match(source, /api\.paystack\.co\/transaction\/verify/);
  assert.match(source, /payment\.status !== 'success'/);
  assert.match(source, /paidAmount !== expectedAmount/);
  assert.match(source, /provision_algolync_license_v2/);
  assert.match(source, /payment_reference/);
});

test('demo licences are returned only after a represented active row is persisted', async () => {
  const admin = await read('lib/supabaseAdmin.ts');
  const demo = await read('app/api/v1/provision-demo-license/route.ts');
  assert.match(admin, /resolution=merge-duplicates,return=representation/);
  assert.match(demo, /Array\.isArray\(persisted\)/);
  assert.match(demo, /row\.license_key === licenseKey/);
  assert.match(demo, /row\.status\.toLowerCase\(\) === 'active'/);
});

test('database enforces global MT5 seat uniqueness across LIVE and DEMO types', async () => {
  const migration = await read('supabase/migrations/20261119130000_global_mt5_seat_login_uniqueness.sql');
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS ea_license_seats_mt5_login_global_uidx/);
  assert.match(migration, /ON public\.ea_license_seats \(mt5_login\)/);
  assert.match(migration, /WHERE mt5_login IS NOT NULL/);
});

test('store separates live verified telemetry from reported user-submitted ledger', async () => {
  const source = await read('app/components/LegacyStoreTerminal.tsx');
  assert.match(source, /No independently verified live-performance dataset/);
  assert.match(source, /Not Independently Verified/);
  assert.match(source, /not labelled broker-verified/);
});

test('all required secondary routes provide Back to Terminal navigation', async () => {
  const routes = [
    'app/store/page.tsx',
    'app/account/page.tsx',
    'app/owner/page.tsx',
    'app/privacy/page.tsx',
    'app/terms/page.tsx',
    'app/faq/page.tsx',
    'app/guide/page.tsx',
  ];
  for (const path of routes) {
    let source = await read(path);
    if (path === 'app/store/page.tsx') source += await read('app/components/LegacyStoreTerminal.tsx');
    assert.match(source, /BACK TO TERMINAL/, path);
  }
});
