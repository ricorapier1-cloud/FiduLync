import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { supabaseInsert, supabaseRead } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Installation = { id: string; status: string };
type Quote = { symbol: string; bid: number; ask: number; quote_time: string; spread_points: number; digits?: number; point?: number; broker?: string; server?: string };
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

    const quotes: Quote[] = [];
    for (const raw of body.quotes) {
      if (!isRecord(raw) || !validSymbol(raw.symbol) || !validTime(raw.quote_time, false)
        || typeof raw.bid !== 'number' || !Number.isFinite(raw.bid) || raw.bid <= 0
        || typeof raw.ask !== 'number' || !Number.isFinite(raw.ask) || raw.ask < raw.bid
        || typeof raw.spread_points !== 'number' || !Number.isFinite(raw.spread_points) || raw.spread_points < 0) {
        return NextResponse.json({ error: 'One or more quotes failed validation.' }, { status: 400 });
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
      const result = await supabaseInsert('mt5_market_quotes', quotes.map((quote) => ({
        ...quote, installation_id: installation.id,
      })) as unknown as Record<string, unknown>);
      if (!result) throw new Error('Quote storage failed.');
    }
    if (candles.length) {
      const result = await supabaseInsert('mt5_market_candles', candles.map((candle) => ({
        ...candle, installation_id: installation.id,
      })) as unknown as Record<string, unknown>);
      if (!result) throw new Error('Candle storage failed.');
    }
    await supabaseInsert('mt5_installations', {
      id: installation.id, last_seen_at: new Date().toISOString(),
    });
    return NextResponse.json({
      accepted: true, installation_id: installation.id,
      quotes_received: quotes.length, candles_received: candles.length,
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
