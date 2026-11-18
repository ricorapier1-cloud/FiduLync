import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { supabaseInsert, supabaseQuery, supabaseRead } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Installation = { id: string; status: string };
type Quote = { symbol: string; bid: number; ask: number; quote_time: string; spread_points: number; digits?: number; point?: number; tick_size?: number; tick_value?: number; contract_size?: number; volume_min?: number; volume_max?: number; volume_step?: number; stop_level_points?: number; margin_per_lot_buy?: number; margin_per_lot_sell?: number; broker?: string; server?: string };
type Candle = { symbol: string; timeframe: 'H1' | 'H4' | 'D1'; bar_time: string; open: number; high: number; low: number; close: number; tick_volume?: number; spread_points?: number; real_volume?: number; is_closed?: boolean; broker?: string; server?: string; digits?: number; point?: number; tick_size?: number; tick_value?: number; contract_size?: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function validSymbol(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z0-9._-]{3,20}$/.test(value);
}
function validTime(value: unknown, allowHistory: boolean) {
  if (typeof value !== 'string') return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= Date.now() + 5 * 60_000
    && (allowHistory || timestamp >= Date.now() - 24 * 60 * 60_000);
}

export async function POST(request: Request) {
  if (!checkRateLimit(getClientIp(request), 120, 60_000)) {
    return NextResponse.json({ error: 'MT5 ingestion rate limit exceeded.' }, { status: 429 });
  }
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const timestampHeader = request.headers.get('x-mt5-timestamp') ?? '';
  const nonce = request.headers.get('x-mt5-nonce') ?? '';
  const sentAt = Date.parse(timestampHeader);
  if (!token.startsWith('flmt5_') || token.length < 40 || !Number.isFinite(sentAt)
    || Math.abs(Date.now() - sentAt) > 5 * 60_000 || !/^[0-9a-f-]{36}$/i.test(nonce)) {
    return NextResponse.json({ error: 'Invalid publisher authentication envelope.' }, { status: 401 });
  }
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 1_000_000) return NextResponse.json({ error: 'Payload too large.' }, { status: 413 });
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'A valid JSON market-data payload is required.' }, { status: 400 });
  }
  if (!isRecord(body) || !Array.isArray(body.quotes) || !Array.isArray(body.candles)
    || body.quotes.length > 50 || body.candles.length > 1_000
    || body.quotes.length + body.candles.length === 0) {
    return NextResponse.json({ error: 'Payload must contain up to 50 quotes and 1,000 candles.' }, { status: 400 });
  }

  try {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const installations = await supabaseRead<Installation[]>(
      'mt5_installations',
      `select=id,status&token_hash=eq.${tokenHash}&status=eq.active&limit=1`
    );
    const installation = installations?.[0];
    if (!installation) return NextResponse.json({ error: 'Publisher token is invalid or revoked.' }, { status: 401 });

    const nonceRows = await supabaseInsert('mt5_ingest_nonces', {
      installation_id: installation.id, nonce,
    });
    if (!nonceRows) throw new Error('Replay protection could not be stored.');

    const rawAccountSnapshot = body.account_snapshot;
    let accountSnapshot: Record<string, unknown> | null = null;
    if (rawAccountSnapshot !== undefined && rawAccountSnapshot !== null) {
      if (!isRecord(rawAccountSnapshot)) {
        return NextResponse.json({ error: 'Account snapshot failed validation.' }, { status: 400 });
      }
      const snapshot = rawAccountSnapshot;
      if (!Number.isSafeInteger(snapshot.account_login) || Number(snapshot.account_login) <= 0
        || typeof snapshot.currency !== 'string' || !/^[A-Z]{3,8}$/.test(snapshot.currency)
        || !['balance','equity','margin','free_margin','open_risk_cash'].every((key) =>
          typeof snapshot[key] === 'number' && Number.isFinite(snapshot[key]) && (snapshot[key] as number) >= 0)
        || (snapshot.equity as number) <= 0
        || !Number.isSafeInteger(snapshot.open_positions) || (snapshot.open_positions as number) < 0
        || typeof snapshot.open_risk_verified !== 'boolean'
        || (snapshot.consecutive_losses !== undefined && (!Number.isSafeInteger(snapshot.consecutive_losses) || Number(snapshot.consecutive_losses) < 0 || Number(snapshot.consecutive_losses) > 10000))
        || (snapshot.loss_streak_verified !== undefined && typeof snapshot.loss_streak_verified !== 'boolean')
        || (snapshot.history_synced_at !== undefined && snapshot.history_synced_at !== null && (typeof snapshot.history_synced_at !== 'string' || !validTime(snapshot.history_synced_at, false)))
        || (snapshot.loss_streak_verified === true && (!Number.isSafeInteger(snapshot.consecutive_losses) || typeof snapshot.history_synced_at !== 'string' || !validTime(snapshot.history_synced_at, false)))
        || typeof snapshot.captured_at !== 'string' || !validTime(snapshot.captured_at, false)) {
        return NextResponse.json({ error: 'Account snapshot failed validation.' }, { status: 400 });
      }
      accountSnapshot = snapshot;
    }

    const quotes: Quote[] = [];
    for (const raw of body.quotes) {
      if (!isRecord(raw) || !validSymbol(raw.symbol) || !validTime(raw.quote_time, false)
        || typeof raw.bid !== 'number' || !Number.isFinite(raw.bid) || raw.bid <= 0
        || typeof raw.ask !== 'number' || !Number.isFinite(raw.ask) || raw.ask < raw.bid
        || typeof raw.spread_points !== 'number' || !Number.isFinite(raw.spread_points) || raw.spread_points < 0) {
        return NextResponse.json({ error: 'One or more quotes failed validation.' }, { status: 400 });
      }
      if (raw.point !== undefined && (typeof raw.point !== 'number' || !Number.isFinite(raw.point) || raw.point <= 0)
        || raw.tick_size !== undefined && (typeof raw.tick_size !== 'number' || !Number.isFinite(raw.tick_size) || raw.tick_size <= 0)
        || raw.tick_value !== undefined && (typeof raw.tick_value !== 'number' || !Number.isFinite(raw.tick_value) || raw.tick_value <= 0)
        || raw.contract_size !== undefined && (typeof raw.contract_size !== 'number' || !Number.isFinite(raw.contract_size) || raw.contract_size <= 0)
        || raw.volume_min !== undefined && (typeof raw.volume_min !== 'number' || !Number.isFinite(raw.volume_min) || raw.volume_min <= 0)
        || raw.volume_max !== undefined && (typeof raw.volume_max !== 'number' || !Number.isFinite(raw.volume_max) || raw.volume_max <= 0)
        || raw.volume_step !== undefined && (typeof raw.volume_step !== 'number' || !Number.isFinite(raw.volume_step) || raw.volume_step <= 0)
        || raw.stop_level_points !== undefined && (typeof raw.stop_level_points !== 'number' || !Number.isFinite(raw.stop_level_points) || raw.stop_level_points < 0)
        || raw.margin_per_lot_buy !== undefined && (typeof raw.margin_per_lot_buy !== 'number' || !Number.isFinite(raw.margin_per_lot_buy) || raw.margin_per_lot_buy < 0)
        || raw.margin_per_lot_sell !== undefined && (typeof raw.margin_per_lot_sell !== 'number' || !Number.isFinite(raw.margin_per_lot_sell) || raw.margin_per_lot_sell < 0)) {
        return NextResponse.json({ error: 'Quote broker metadata failed validation.' }, { status: 400 });
      }
      quotes.push({ ...raw, symbol: raw.symbol.toUpperCase() } as Quote);
    }
    const candles: Candle[] = [];
    for (const raw of body.candles) {
      if (!isRecord(raw) || !validSymbol(raw.symbol) || !['H1','H4','D1'].includes(String(raw.timeframe))
        || !validTime(raw.bar_time, true)
        || !['open','high','low','close'].every((key) => typeof raw[key] === 'number' && Number.isFinite(raw[key]) && (raw[key] as number) > 0)
        || (raw.high as number) < (raw.low as number)
        || (raw.open as number) < (raw.low as number) || (raw.open as number) > (raw.high as number)
        || (raw.close as number) < (raw.low as number) || (raw.close as number) > (raw.high as number)) {
        return NextResponse.json({ error: 'One or more candles failed OHLC/timeframe validation.' }, { status: 400 });
      }
      candles.push({ ...raw, symbol: raw.symbol.toUpperCase(), is_closed: true } as Candle);
    }

    if (quotes.length) {
      const result = await supabaseQuery('mt5_market_quotes', {
        method: 'POST', query: 'on_conflict=installation_id,symbol',
        prefer: 'resolution=merge-duplicates,return=representation',
        body: quotes.map((quote) => ({ ...quote, installation_id: installation.id })),
      });
      if (!result) throw new Error('Quote storage failed.');
    }
    if (candles.length) {
      const result = await supabaseQuery('mt5_market_candles', {
        method: 'POST', query: 'on_conflict=installation_id,symbol,timeframe,bar_time',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: candles.map((candle) => ({ ...candle, installation_id: installation.id })),
      });
      if (!result) throw new Error('Candle storage failed.');
    }
    if (accountSnapshot) {
      const accountLogin = Number(accountSnapshot.account_login);
      const snapshotResult = await supabaseQuery('mt5_account_snapshots', {
        method: 'POST',
        query: 'on_conflict=installation_id,account_login',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: [{
          installation_id: installation.id,
          account_login: accountLogin,
          currency: accountSnapshot.currency,
          balance: accountSnapshot.balance,
          equity: accountSnapshot.equity,
          margin: accountSnapshot.margin,
          free_margin: accountSnapshot.free_margin,
          margin_level: typeof accountSnapshot.margin_level === 'number' && Number.isFinite(accountSnapshot.margin_level) ? accountSnapshot.margin_level : null,
          open_positions: accountSnapshot.open_positions,
          open_risk_cash: accountSnapshot.open_risk_cash,
          open_risk_verified: accountSnapshot.open_risk_verified,
          consecutive_losses: Number.isSafeInteger(accountSnapshot.consecutive_losses) ? accountSnapshot.consecutive_losses : null,
          loss_streak_verified: accountSnapshot.loss_streak_verified === true,
          history_synced_at: typeof accountSnapshot.history_synced_at === 'string' ? accountSnapshot.history_synced_at : null,
          broker: typeof accountSnapshot.broker === 'string' ? accountSnapshot.broker.slice(0, 100) : null,
          server: typeof accountSnapshot.server === 'string' ? accountSnapshot.server.slice(0, 120) : null,
          captured_at: accountSnapshot.captured_at,
        }],
      });
      if (!snapshotResult) throw new Error('Account snapshot storage failed.');
    }
    await supabaseQuery('mt5_installations', {
      method: 'PATCH', query: `id=eq.${installation.id}`,
      prefer: 'return=representation', body: { last_seen_at: new Date().toISOString() },
    });
    return NextResponse.json({
      accepted: true, installation_id: installation.id,
      quotes_received: quotes.length, candles_received: candles.length, account_snapshot_received: Boolean(accountSnapshot),
      received_at_utc: new Date().toISOString(),
    }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof Error && /duplicate key|unique constraint/i.test(error.message)) {
      return NextResponse.json({ error: 'Replay detected or duplicate batch nonce.' }, { status: 409 });
    }
    console.error('MT5 market data ingestion failed:', error);
    return NextResponse.json({ error: 'Market data ingestion is temporarily unavailable.' }, { status: 503 });
  }
}
