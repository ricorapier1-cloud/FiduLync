import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const MAX_BODY_BYTES = 256 * 1024;
const TIMEFRAME_SECONDS: Record<string, number> = { H1: 3600, H4: 14400, D1: 86400 };
type CandleInput = {
  symbol: string; timeframe: 'H1'|'H4'|'D1'; bar_time: string;
  open: number; high: number; low: number; close: number;
  tick_volume?: number; real_volume?: number; spread_points?: number; is_closed: boolean;
  digits?: number; point?: number; tick_size?: number; tick_value?: number; contract_size?: number;
};
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
function validOptional(value: unknown, min = 0): boolean { return value === undefined || (finite(value) && value >= min); }

export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!/^flmt5_[A-Za-z0-9_-]{40,}$/.test(token)) return NextResponse.json({ error: 'Invalid connector credentials.' }, { status: 401 });

  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_BODY_BYTES) return NextResponse.json({ error: 'Payload too large.' }, { status: 413 });
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return NextResponse.json({ error: 'Payload too large.' }, { status: 413 });

  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Malformed JSON.' }, { status: 400 }); }
  if (!record(payload) || !Array.isArray(payload.candles) || payload.candles.length < 1 || payload.candles.length > 150
    || !Array.isArray(payload.quotes) || payload.quotes.length > 30
    || typeof payload.nonce !== 'string' || !/^[0-9a-f-]{36}$/i.test(payload.nonce)
    || typeof payload.sent_at !== 'string' || !Number.isFinite(Date.parse(payload.sent_at))
    || Math.abs(Date.now() - Date.parse(payload.sent_at)) > 120_000) {
    return NextResponse.json({ error: 'Payload schema, nonce, or timestamp is invalid.' }, { status: 400 });
  }

  const broker = typeof payload.broker === 'string' ? payload.broker.slice(0, 100) : '';
  const server = typeof payload.server === 'string' ? payload.server.slice(0, 120) : '';
  if (!broker || !server) return NextResponse.json({ error: 'Broker and server metadata are required.' }, { status: 400 });

  const candles: CandleInput[] = [];
  for (const value of payload.candles) {
    if (!record(value)) return NextResponse.json({ error: 'Invalid candle record.' }, { status: 400 });
    const c = value as unknown as CandleInput;
    if (typeof c.symbol !== 'string' || !/^[A-Z0-9._-]{3,32}$/.test(c.symbol) || typeof c.timeframe !== 'string' || !(c.timeframe in TIMEFRAME_SECONDS)
      || typeof c.bar_time !== 'string' || !Number.isFinite(Date.parse(c.bar_time))
      || c.is_closed !== true || ![c.open,c.high,c.low,c.close].every(finite)
      || c.low <= 0 || c.high < c.low || c.open < c.low || c.open > c.high || c.close < c.low || c.close > c.high
      || !validOptional(c.tick_volume) || !validOptional(c.real_volume) || !validOptional(c.spread_points)
      || !validOptional(c.digits) || !validOptional(c.point) || !validOptional(c.tick_size) || !validOptional(c.tick_value) || !validOptional(c.contract_size)) {
      return NextResponse.json({ error: 'Candle failed market-data validation.' }, { status: 400 });
    }
    const barMs = Date.parse(c.bar_time);
    if (barMs > Date.now() + 60_000 || Date.now() - barMs > 400 * 86_400_000) {
      return NextResponse.json({ error: 'Candle timestamp is future-dated or too stale.' }, { status: 400 });
    }
    candles.push(c);
  }

  const quotes: Array<Record<string, unknown>> = [];
  for (const value of payload.quotes) {
    if (!record(value) || typeof value.symbol !== 'string' || !/^[A-Z0-9._-]{3,32}$/.test(value.symbol)
      || !finite(value.bid) || !finite(value.ask) || value.bid <= 0 || value.ask < value.bid
      || !finite(value.spread_points) || value.spread_points < 0
      || typeof value.quote_time !== 'string' || !Number.isFinite(Date.parse(value.quote_time))
      || Math.abs(Date.now() - Date.parse(value.quote_time)) > 120_000) {
      return NextResponse.json({ error: 'Quote failed market-data validation.' }, { status: 400 });
    }
    quotes.push({ symbol: value.symbol, bid: value.bid, ask: value.ask, spread_points: value.spread_points,
      quote_time: value.quote_time, digits: value.digits, point: value.point, tick_size: value.tick_size,
      tick_value: value.tick_value, contract_size: value.contract_size, broker, server });
  }

  try {
    const supabase = getSupabaseAdmin();
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const { data: installation, error: authError } = await supabase.from('mt5_installations')
      .select('id,status').eq('token_hash', tokenHash).maybeSingle();
    if (authError) throw authError;
    if (!installation || installation.status !== 'active') return NextResponse.json({ error: 'Connector revoked or unknown.' }, { status: 401 });

    const { count: recentCount, error: rateError } = await supabase.from('mt5_ingest_nonces')
      .select('nonce', { count: 'exact', head: true })
      .eq('installation_id', installation.id)
      .gt('created_at', new Date(Date.now() - 60_000).toISOString());
    if (rateError) throw rateError;
    if ((recentCount ?? 0) >= 40) return NextResponse.json({ error: 'Connector rate limit exceeded.' }, { status: 429 });

    const { error: nonceError } = await supabase.from('mt5_ingest_nonces')
      .insert({ installation_id: installation.id, nonce: payload.nonce });
    if (nonceError?.code === '23505') return NextResponse.json({ error: 'Replay detected.' }, { status: 409 });
    if (nonceError) throw nonceError;

    const rows = candles.map((c) => ({
      installation_id: installation.id, symbol: c.symbol, timeframe: c.timeframe, bar_time: c.bar_time,
      open: c.open, high: c.high, low: c.low, close: c.close,
      tick_volume: c.tick_volume ?? 0, real_volume: c.real_volume ?? 0, spread_points: c.spread_points ?? 0,
      is_closed: true, broker, server, digits: c.digits ?? null, point: c.point ?? null,
      tick_size: c.tick_size ?? null, tick_value: c.tick_value ?? null, contract_size: c.contract_size ?? null,
    }));
    const { error: candleError } = await supabase.from('mt5_market_candles')
      .upsert(rows, { onConflict: 'installation_id,symbol,timeframe,bar_time' });
    if (candleError) throw candleError;
    if (quotes.length) {
      const quoteRows = quotes.map((q) => ({ ...q, installation_id: installation.id }));
      const { error: quoteError } = await supabase.from('mt5_market_quotes')
        .upsert(quoteRows, { onConflict: 'installation_id,symbol' });
      if (quoteError) throw quoteError;
    }
    await supabase.from('mt5_installations').update({ last_seen_at: new Date().toISOString(), broker, server }).eq('id', installation.id);
    return NextResponse.json({ accepted: true, installation_id: installation.id, candles_upserted: rows.length, quotes_upserted: quotes.length,
      received_at: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('MT5 ingestion failed:', error);
    return NextResponse.json({ error: 'Market data ingestion failed.' }, { status: 503 });
  }
}
