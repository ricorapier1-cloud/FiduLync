import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { supabaseInsert, supabaseQuery, supabaseRead } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Installation = { id: string; status: string };
type Quote = { symbol: string; bid: number; ask: number; quote_time: string; spread_points: number; digits?: number; point?: number; tick_size?: number; tick_value?: number; tick_value_loss?: number; tick_value_profit?: number; contract_size?: number; volume_min?: number; volume_max?: number; volume_step?: number; stop_level_points?: number; margin_per_lot_buy?: number; margin_per_lot_sell?: number; broker?: string; server?: string };
type Candle = { symbol: string; timeframe: 'H1' | 'H4' | 'D1'; bar_time: string; open: number; high: number; low: number; close: number; tick_volume?: number; spread_points?: number; real_volume?: number; is_closed?: boolean; broker?: string; server?: string; digits?: number; point?: number; tick_size?: number; tick_value?: number; contract_size?: number };
type PositionSnapshot = { snapshot_id: string; captured_at: string; account_login: number; expected_positions: number; positions: Record<string, unknown>[] };
type ExecutionEvent = { event_id: string; event_type: 'FILL' | 'DEAL_CLOSE'; symbol: string; side: 'BUY' | 'SELL'; fill_price: number; volume: number; event_time: string; broker_code?: string | null };

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
    || !Array.isArray(body.execution_events ?? []) || (body.execution_events as unknown[]).length > 500
    || body.quotes.length + body.candles.length === 0 && body.account_snapshot == null && body.position_snapshot == null && !(Array.isArray(body.execution_events) && body.execution_events.length)) {
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
        || (snapshot.consecutive_losses !== undefined && snapshot.consecutive_losses !== null && (!Number.isSafeInteger(snapshot.consecutive_losses) || Number(snapshot.consecutive_losses) < 0 || Number(snapshot.consecutive_losses) > 10000))
        || (snapshot.loss_streak_verified !== undefined && typeof snapshot.loss_streak_verified !== 'boolean')
        || (snapshot.history_synced_at !== undefined && snapshot.history_synced_at !== null && (typeof snapshot.history_synced_at !== 'string' || !validTime(snapshot.history_synced_at, false)))
        || (snapshot.loss_streak_verified === true && (!Number.isSafeInteger(snapshot.consecutive_losses) || typeof snapshot.history_synced_at !== 'string' || !validTime(snapshot.history_synced_at, false)))
        || typeof snapshot.captured_at !== 'string' || !validTime(snapshot.captured_at, false)) {
        return NextResponse.json({ error: 'Account snapshot failed validation.' }, { status: 400 });
      }
      accountSnapshot = snapshot;
    }

    const rawPositionSnapshot = body.position_snapshot;
    let positionSnapshot: PositionSnapshot | null = null;
    if (rawPositionSnapshot !== undefined && rawPositionSnapshot !== null) {
      if (!isRecord(rawPositionSnapshot) || typeof rawPositionSnapshot.snapshot_id !== 'string'
        || !/^[0-9a-f-]{36}$/i.test(rawPositionSnapshot.snapshot_id)
        || typeof rawPositionSnapshot.captured_at !== 'string' || !validTime(rawPositionSnapshot.captured_at, false)
        || !Number.isSafeInteger(rawPositionSnapshot.account_login) || Number(rawPositionSnapshot.account_login) <= 0
        || !Number.isSafeInteger(rawPositionSnapshot.expected_positions) || Number(rawPositionSnapshot.expected_positions) < 0
        || Number(rawPositionSnapshot.expected_positions) > 500
        || !Array.isArray(rawPositionSnapshot.positions)
        || rawPositionSnapshot.positions.length !== rawPositionSnapshot.expected_positions
        || (accountSnapshot && Number(accountSnapshot.account_login) !== Number(rawPositionSnapshot.account_login))) {
        return NextResponse.json({ error: 'Position snapshot manifest failed validation.' }, { status: 400 });
      }
      const rows: Record<string, unknown>[] = [];
      for (const raw of rawPositionSnapshot.positions) {
        if (!isRecord(raw) || !Number.isSafeInteger(raw.position_ticket) || Number(raw.position_ticket) <= 0
          || (raw.position_identifier !== undefined && raw.position_identifier !== null && (!Number.isSafeInteger(raw.position_identifier) || Number(raw.position_identifier) <= 0))
          || !validSymbol(raw.symbol) || !['BUY', 'SELL'].includes(String(raw.side))
          || typeof raw.volume !== 'number' || !Number.isFinite(raw.volume) || raw.volume <= 0
          || typeof raw.price_open !== 'number' || !Number.isFinite(raw.price_open) || raw.price_open <= 0
          || (raw.stop_loss !== undefined && raw.stop_loss !== null && (typeof raw.stop_loss !== 'number' || !Number.isFinite(raw.stop_loss) || raw.stop_loss <= 0))
          || (raw.take_profit !== undefined && raw.take_profit !== null && (typeof raw.take_profit !== 'number' || !Number.isFinite(raw.take_profit) || raw.take_profit <= 0))
          || (raw.profit_account_currency !== undefined && raw.profit_account_currency !== null && (typeof raw.profit_account_currency !== 'number' || !Number.isFinite(raw.profit_account_currency)))
          || (raw.contract_size !== undefined && raw.contract_size !== null && (typeof raw.contract_size !== 'number' || !Number.isFinite(raw.contract_size) || raw.contract_size <= 0))
          || (raw.tick_size !== undefined && raw.tick_size !== null && (typeof raw.tick_size !== 'number' || !Number.isFinite(raw.tick_size) || raw.tick_size <= 0))
          || (raw.tick_value_loss !== undefined && raw.tick_value_loss !== null && (typeof raw.tick_value_loss !== 'number' || !Number.isFinite(raw.tick_value_loss) || raw.tick_value_loss <= 0))
          || (raw.quote_currency !== undefined && raw.quote_currency !== null && (typeof raw.quote_currency !== 'string' || !/^[A-Z]{3,8}$/.test(raw.quote_currency)))
          || (raw.base_currency !== undefined && raw.base_currency !== null && (typeof raw.base_currency !== 'string' || !/^[A-Z]{3,8}$/.test(raw.base_currency)))) {
          return NextResponse.json({ error: 'One or more open positions failed validation.' }, { status: 400 });
        }
        rows.push(raw);
      }
      positionSnapshot = { ...rawPositionSnapshot, positions: rows } as PositionSnapshot;
    }

    const executionEvents: ExecutionEvent[] = [];
    for (const raw of (body.execution_events ?? []) as unknown[]) {
      if (!isRecord(raw) || typeof raw.event_id !== 'string' || !/^[A-Za-z0-9._:-]{1,80}$/.test(raw.event_id)
        || !['FILL', 'DEAL_CLOSE'].includes(String(raw.event_type))
        || !validSymbol(raw.symbol) || !['BUY', 'SELL'].includes(String(raw.side))
        || typeof raw.fill_price !== 'number' || !Number.isFinite(raw.fill_price) || raw.fill_price <= 0
        || typeof raw.volume !== 'number' || !Number.isFinite(raw.volume) || raw.volume <= 0
        || typeof raw.event_time !== 'string' || !validTime(raw.event_time, true)
        || (raw.broker_code !== undefined && raw.broker_code !== null && (typeof raw.broker_code !== 'string' || raw.broker_code.length > 80))) {
        return NextResponse.json({ error: 'One or more execution events failed validation.' }, { status: 400 });
      }
      executionEvents.push(raw as ExecutionEvent);
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
        || raw.tick_value_loss !== undefined && (typeof raw.tick_value_loss !== 'number' || !Number.isFinite(raw.tick_value_loss) || raw.tick_value_loss < 0)
        || raw.tick_value_profit !== undefined && (typeof raw.tick_value_profit !== 'number' || !Number.isFinite(raw.tick_value_profit) || raw.tick_value_profit < 0)
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
    let executionEventsReceived = 0;
    if (executionEvents.length) {
      const eventRows = executionEvents.map((event) => {
        const evidence = {
          installation_id: installation.id,
          account_login: Number(accountSnapshot?.account_login ?? (positionSnapshot?.account_login ?? 0)),
          event_id: event.event_id,
          event_type: event.event_type,
          symbol: event.symbol.toUpperCase(),
          side: event.side,
          fill_price: event.fill_price,
          volume: event.volume,
          event_time: event.event_time,
        };
        return {
          installation_id: installation.id,
          account_login: evidence.account_login,
          event_id: event.event_id,
          event_type: event.event_type,
          symbol: event.symbol.toUpperCase(),
          side: event.side,
          requested_price: null,
          fill_price: event.fill_price,
          volume: event.volume,
          spread_points: null,
          slippage_points: null,
          latency_ms: null,
          broker_code: event.broker_code ?? null,
          event_time: event.event_time,
          evidence_hash: createHash('sha256').update(JSON.stringify(evidence)).digest('hex'),
        };
      });
      if (eventRows.some((row) => !Number.isSafeInteger(row.account_login) || row.account_login <= 0)) {
        return NextResponse.json({ error: 'Execution events require a verified account snapshot.' }, { status: 400 });
      }
      const insertedEvents = await supabaseQuery('mt5_execution_quality_events', {
        method: 'POST', query: 'on_conflict=installation_id,event_id',
        prefer: 'resolution=ignore-duplicates,return=minimal', body: eventRows,
      });
      if (!insertedEvents) throw new Error('Execution evidence could not be stored.');
      executionEventsReceived = eventRows.length;
    }

    let positionsReceived = 0;
    if (positionSnapshot) {
      const positionRows = positionSnapshot.positions.map((position) => ({
        installation_id: installation.id,
        account_login: positionSnapshot.account_login,
        snapshot_id: positionSnapshot.snapshot_id,
        captured_at: positionSnapshot.captured_at,
        position_ticket: position.position_ticket,
        position_identifier: position.position_identifier ?? null,
        symbol: String(position.symbol).toUpperCase(),
        side: position.side,
        volume: position.volume,
        price_open: position.price_open,
        stop_loss: position.stop_loss ?? null,
        take_profit: position.take_profit ?? null,
        profit_account_currency: position.profit_account_currency ?? null,
        contract_size: position.contract_size ?? null,
        tick_size: position.tick_size ?? null,
        tick_value_loss: position.tick_value_loss ?? null,
        quote_currency: position.quote_currency ?? null,
        base_currency: position.base_currency ?? null,
        snapshot_complete: true,
      }));
      if (positionRows.length) {
        const insertedPositions = await supabaseQuery('mt5_open_position_snapshots', {
          method: 'POST', query: 'on_conflict=installation_id,account_login,snapshot_id,position_ticket',
          prefer: 'resolution=ignore-duplicates,return=minimal', body: positionRows,
        });
        if (!insertedPositions) throw new Error('Position snapshot rows could not be stored.');
      }
      const manifest = await supabaseQuery('mt5_position_snapshot_manifests', {
        method: 'POST', query: 'on_conflict=installation_id,account_login,snapshot_id',
        prefer: 'return=minimal',
        body: [{
          installation_id: installation.id,
          account_login: positionSnapshot.account_login,
          snapshot_id: positionSnapshot.snapshot_id,
          captured_at: positionSnapshot.captured_at,
          expected_positions: positionSnapshot.expected_positions,
          complete: true,
        }],
      });
      if (!manifest) throw new Error('Position snapshot completion manifest could not be stored.');
      positionsReceived = positionRows.length;
    }
    await supabaseQuery('mt5_installations', {
      method: 'PATCH', query: `id=eq.${installation.id}`,
      prefer: 'return=representation', body: { last_seen_at: new Date().toISOString() },
    });
    return NextResponse.json({
      accepted: true, installation_id: installation.id,
      quotes_received: quotes.length, candles_received: candles.length, account_snapshot_received: Boolean(accountSnapshot),
      positions_received: positionsReceived, position_snapshot_complete: Boolean(positionSnapshot),
      execution_events_received: executionEventsReceived,
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
