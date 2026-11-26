import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' };
const sides = new Set(['BUY','SELL','BALANCE','CREDIT','CHARGE','CORRECTION','BONUS','OTHER']);
const entries = new Set(['IN','OUT','INOUT','OUT_BY','OTHER']);

function authorized(request: Request): boolean {
  const expected = process.env.MT5_ACCOUNT_INGEST_TOKEN?.trim() ?? '';
  const header = request.headers.get('authorization')?.trim() ?? '';
  const candidate = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return expected.length >= 32 && a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}
function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function str(value: unknown, max = 160): string | null {
  if (typeof value !== 'string') return null;
  const result = value.trim();
  return result.length > 0 && result.length <= max ? result : null;
}
function num(value: unknown, fallback = 0): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.abs(value) <= 1e15 ? value : null;
}
function iso(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}
function safeJson(value: unknown): unknown[] {
  return Array.isArray(value) ? value.slice(0, 500).flatMap((item) => {
    const p = record(item);
    if (!p) return [];
    const symbol = str(p.symbol, 32);
    const side = str(p.side, 12);
    const ticket = str(p.ticket, 64);
    const openedAtUtc = iso(p.openedAtUtc);
    const volume = num(p.volume, null);
    const openPrice = num(p.openPrice, null);
    const currentPrice = num(p.currentPrice, null);
    const profit = num(p.profit, null);
    if (!symbol || !side || !ticket || !openedAtServer || volume === null || openPrice === null || currentPrice === null || profit === null) return [];
    return [{
      ticket, symbol, side: side === 'BUY' ? 'BUY' : 'SELL', volume, openPrice, currentPrice, profit,
      swap: num(p.swap), stopLoss: num(p.stopLoss, null), takeProfit: num(p.takeProfit, null),
      openedAtServer, magic: str(String(p.magic ?? ''), 64), comment: str(p.comment ?? '', 120),
    }];
  }) : [];
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized account publisher.' }, { status: 401, headers });
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > 1_000_000) return NextResponse.json({ error: 'Payload too large.' }, { status: 413, headers });

  try {
    const raw = await request.text();
    if (raw.length > 1_000_000) return NextResponse.json({ error: 'Payload too large.' }, { status: 413, headers });
    const payload = record(JSON.parse(raw));
    const account = record(payload?.account);
    if (!payload || !account) return NextResponse.json({ error: 'Invalid account payload.' }, { status: 400, headers });

    const login = str(String(account.login ?? ''), 32);
    const server = str(account.server, 120);
    const currency = str(account.currency, 12);
    const observedAt = iso(account.observedAtUtc);
    const leverage = num(account.leverage, null);
    const balance = num(account.balance, null);
    const equity = num(account.equity, null);
    const margin = num(account.margin, null);
    const freeMargin = num(account.freeMargin, null);
    const marginLevel = num(account.marginLevel, null);
    if (!login || !server || !currency || !observedAt || leverage === null || leverage <= 0
      || balance === null || equity === null || margin === null || freeMargin === null || marginLevel === null) {
      return NextResponse.json({ error: 'Required account fields are invalid or missing.' }, { status: 400, headers });
    }

    const accountKey = createHash('sha256').update(server.toLowerCase() + ':' + login).digest('hex');
    const accountModeRaw = str(account.accountMode, 16);
    const accountMode = accountModeRaw && ['REAL','DEMO','CONTEST'].includes(accountModeRaw) ? accountModeRaw : 'UNKNOWN';
    const snapshot = {
      account_key: accountKey,
      account_login: login,
      broker: str(account.broker, 120),
      server,
      currency,
      leverage: Math.round(leverage),
      account_mode: accountMode,
      balance,
      equity,
      margin,
      free_margin: freeMargin,
      margin_level: marginLevel,
      positions: safeJson(payload.positions),
      observed_at: observedAt,
      received_at: new Date().toISOString(),
    };

    const supabase = getSupabaseAdmin();
    const { error: snapshotError } = await supabase.from('mt5_account_snapshots').upsert(snapshot, { onConflict: 'account_key' });
    if (snapshotError) throw snapshotError;

    const incomingDeals = Array.isArray(payload.deals) ? payload.deals.slice(0, 500) : [];
    const deals = incomingDeals.flatMap((value) => {
      const deal = record(value);
      if (!deal) return [];
      const ticket = str(String(deal.ticket ?? ''), 64);
      const symbol = str(deal.symbol, 32);
      const dealTimeServer = str(deal.timeServer, 40);
      const volume = num(deal.volume);
      const price = num(deal.price);
      const profit = num(deal.profit);
      const sideRaw = str(deal.side, 16) ?? 'OTHER';
      const entryRaw = str(deal.entry, 16) ?? 'OTHER';
      if (!ticket || !symbol || !dealTimeServer || volume === null || price === null || profit === null) return [];
      return [{
        account_key: accountKey,
        deal_ticket: ticket,
        order_ticket: str(String(deal.order ?? ''), 64),
        position_id: str(String(deal.positionId ?? ''), 64),
        symbol,
        side: sides.has(sideRaw) ? sideRaw : 'OTHER',
        entry_type: entries.has(entryRaw) ? entryRaw : 'OTHER',
        volume, price, profit,
        commission: num(deal.commission),
        swap: num(deal.swap),
        fee: num(deal.fee),
        deal_time_server: dealTimeServer,
        magic: str(String(deal.magic ?? ''), 64),
        comment: str(deal.comment ?? '', 120),
      }];
    });

    if (deals.length) {
      const { error: dealsError } = await supabase.from('mt5_account_deals')
        .upsert(deals, { onConflict: 'account_key,deal_ticket', ignoreDuplicates: true });
      if (dealsError) throw dealsError;
    }

    return NextResponse.json({
      status: 'ACCEPTED',
      accountKey,
      positionsReceived: snapshot.positions.length,
      dealsReceived: deals.length,
      observedAtUtc: observedAt,
      receivedAtUtc: snapshot.received_at,
    }, { status: 200, headers });
  } catch (error) {
    console.error('MT5 account ingestion failed:', error);
    return NextResponse.json({ error: 'Account data could not be stored.' }, { status: 503, headers });
  }
}
