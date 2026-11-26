import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('MT5 ingestion and account-read routes use separate private bearer credentials', () => {
  const ingest = read('../app/api/v1/account-sync/route.ts');
  const readRoute = read('../app/api/v1/accounts/route.ts');
  assert.match(ingest, /MT5_ACCOUNT_INGEST_TOKEN/);
  assert.match(readRoute, /MT5_ACCOUNT_READ_TOKEN/);
  assert.match(ingest, /timingSafeEqual/);
  assert.match(readRoute, /timingSafeEqual/);
  assert.match(ingest, /upsert\(snapshot/);
  assert.match(ingest, /ignoreDuplicates: true/);
  assert.doesNotMatch(ingest + readRoute, /searchParams\.get\(['"]token/);
  assert.doesNotMatch(ingest + readRoute, /brokerPassword|investorPassword|OrderSend|OrderModify|OrderClose/i);
});

test('MT5 account storage is private and service-role-only', () => {
  const migration = read('../supabase/migrations/20261126174500_mt5_account_intelligence.sql');
  assert.match(migration, /enable row level security/gi);
  assert.match(migration, /revoke all on public\.macrolinc_account_snapshots from anon, authenticated/i);
  assert.match(migration, /revoke all on public\.macrolinc_account_deals from anon, authenticated/i);
  assert.match(migration, /grant all on public\.macrolinc_account_snapshots to service_role/i);
  assert.match(migration, /grant all on public\.macrolinc_account_deals to service_role/i);
  assert.match(migration, /deal_time_server text not null/);
});

test('MT5 publisher is read-only and account dashboard uses session-scoped read access', () => {
  const publisher = read('../public/MacroLyncAccountPublisher.mq5');
  const page = read('../app/accounts/page.tsx');
  assert.match(publisher, /WebRequest\("POST"/);
  assert.match(publisher, /HistoryDealsTotal/);
  assert.match(publisher, /PositionsTotal/);
  assert.match(publisher, /TimeGMT/);
  assert.doesNotMatch(publisher, /OrderSend|OrderModify|OrderDelete|CTrade/i);
  assert.match(page, /sessionStorage/);
  assert.match(page, /MT5_ACCOUNT_READ_TOKEN/);
  assert.match(page, /Never paste your IC Markets master or investor password/);
  assert.match(page, /Recent closed trades/);
});
