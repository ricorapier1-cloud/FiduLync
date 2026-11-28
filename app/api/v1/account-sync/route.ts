import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/serverSupabase';
import { recordMT5Heartbeat } from '@/lib/quant/mt5Heartbeat';

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
function num(value: unknown, fallback: number | null = 0): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.abs(value) <= 1e15 ? value : null;
}
function iso(value: unknown): string | null {
  if (typeof value !== 'string' || !/(?:Z|[+-]\\d{2}:?\\d{2})$/i.test(value)) return null;
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
    const openedAtServer = str(p.openedAtServer, 40);
    const volume = num(p.volume, null);
    const openPrice = num(p.openPrice, null);
    const currentPrice = num(p.currentPrice, null);
    const profit = num(p.profit, null);
    if (!symbol || !['BUY','SELL'].includes(side) || !ticket || !openedAtServer || volume === null || volume < 0 || openPrice === null || openPrice <= 0 || currentPrice === null || currentPrice <= 0 || profit === null) return [];
    return [{
      ticket, positionId: str(String(p.positionId ?? ''), 64), symbol, side: side === 'BUY' ? 'BUY' : 'SELL', volume, openPrice, currentPrice, profit,
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
    const currencyValue = str(account.currency, 12)?.toUpperCase() ?? null;
    const currency = currencyValue && /^[A-Z]{3}$/.test(currencyValue) ? currencyValue : null;
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
    const { error: snapshotError } = await supabase.from('macrolinc_account_snapshots').upsert(snapshot, { onConflict: 'account_key' });
    if (snapshotError) throw snapshotError;

    const allowedMarketSymbols = new Set([
      'EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'AUDUSD', 'NZDUSD', 'USDCAD', 'USDCHF',
      'EURJPY', 'GBPJPY', 'AUDJPY', 'CADJPY', 'CHFJPY', 'NZDJPY', 'EURGBP', 'EURAUD',
      'EURCAD', 'EURCHF', 'EURNZD', 'GBPAUD', 'GBPCAD', 'GBPCHF', 'GBPNZD', 'AUDCAD',
      'AUDCHF', 'AUDNZD', 'CADCHF', 'NZDCAD', 'NZDCHF',
    ]);
    const nowMs = Date.now();
    const receivedAt = new Date(nowMs).toISOString();
    const incomingQuotes = Array.isArray(payload.quotes) ? payload.quotes.slice(0, 32) : [];
    const quotes = incomingQuotes.flatMap((value) => {
      const quote = record(value);
      if (!quote) return [];
      const symbol = str(quote.symbol, 12)?.toUpperCase() ?? '';
      const bid = num(quote.bid, null);
      const ask = num(quote.ask, null);
      const quoteTimeUtc = iso(quote.quoteTimeUtc);
      const digits = num(quote.digits, null);
      const point = num(quote.point, null);
      const spreadPoints = num(quote.spreadPoints, null);
      const serverUtcOffsetMinutes = num(quote.serverUtcOffsetMinutes, null);
      const timeBasis = str(quote.timeBasis, 64);
      if (!allowedMarketSymbols.has(symbol) || bid === null || ask === null || bid <= 0 || ask < bid
        || !quoteTimeUtc || digits === null || !Number.isInteger(digits) || digits < 0 || digits > 12
        || point === null || point <= 0 || spreadPoints === null || spreadPoints < 0
        || serverUtcOffsetMinutes === null || !Number.isInteger(serverUtcOffsetMinutes)
        || serverUtcOffsetMinutes < -840 || serverUtcOffsetMinutes > 840
        || timeBasis !== 'BROKER_SERVER_CURRENT_OFFSET') return [];
      const ageMs = nowMs - Date.parse(quoteTimeUtc);
      if (!Number.isFinite(ageMs) || ageMs < -30_000 || ageMs > 30_000) return [];
      return [{
        account_key: accountKey, symbol, bid, ask, quote_time: quoteTimeUtc, spread_points: spreadPoints,
        digits, point, server_utc_offset_minutes: serverUtcOffsetMinutes, time_basis: timeBasis,
        broker: snapshot.broker, server: snapshot.server, received_at: receivedAt,
      }];
    });
    if (quotes.length) {
      const { error: quoteError } = await supabase.from('macrolinc_market_quotes')
        .upsert(quotes, { onConflict: 'account_key,symbol' });
      if (quoteError) throw quoteError;
    }

    const incomingCandles = Array.isArray(payload.candles) ? payload.candles.slice(0, 2_000) : [];
    const candles = incomingCandles.flatMap((value) => {
      const candle = record(value);
      if (!candle || candle.isClosed !== true) return [];
      const symbol = str(candle.symbol, 12)?.toUpperCase() ?? '';
      const timeframe = str(candle.timeframe, 4)?.toUpperCase() ?? '';
      const barTimeUtc = iso(candle.barTimeUtc);
      const open = num(candle.open, null), high = num(candle.high, null);
      const low = num(candle.low, null), close = num(candle.close, null);
      const tickVolume = num(candle.tickVolume, 0) ?? 0;
      const spreadPoints = num(candle.spreadPoints, 0) ?? 0;
      const realVolume = num(candle.realVolume, 0) ?? 0;
      const digits = num(candle.digits, null), point = num(candle.point, null);
      const serverUtcOffsetMinutes = num(candle.serverUtcOffsetMinutes, null);
      const timeBasis = str(candle.timeBasis, 64);
      if (!allowedMarketSymbols.has(symbol) || !['M5', 'D1'].includes(timeframe) || !barTimeUtc
        || open === null || high === null || low === null || close === null
        || open <= 0 || high <= 0 || low <= 0 || close <= 0
        || high < low || open < low || open > high || close < low || close > high
        || tickVolume < 0 || spreadPoints < 0 || realVolume < 0
        || digits === null || !Number.isInteger(digits) || digits < 0 || digits > 12
        || point === null || point <= 0
        || serverUtcOffsetMinutes === null || !Number.isInteger(serverUtcOffsetMinutes)
        || serverUtcOffsetMinutes < -840 || serverUtcOffsetMinutes > 840
        || timeBasis !== 'BROKER_SERVER_CURRENT_OFFSET') return [];
      const ageMs = nowMs - Date.parse(barTimeUtc);
      const maxAgeMs = timeframe === 'M5' ? 48 * 60 * 60_000 : 180 * 86_400_000;
      if (!Number.isFinite(ageMs) || ageMs < -30_000 || ageMs > maxAgeMs) return [];
      return [{
        account_key: accountKey, symbol, timeframe, bar_time: barTimeUtc,
        open, high, low, close, tick_volume: Math.trunc(tickVolume),
        spread_points: spreadPoints, real_volume: Math.trunc(realVolume),
        is_closed: true, digits, point, server_utc_offset_minutes: serverUtcOffsetMinutes,
        time_basis: timeBasis, received_at: receivedAt,
      }];
    });
    if (candles.length) {
      const { error: candleError } = await supabase.from('macrolinc_market_candles')
        .upsert(candles, { onConflict: 'account_key,symbol,timeframe,bar_time' });
      if (candleError) throw candleError;
      await Promise.all([
        supabase.from('macrolinc_market_candles').delete().eq('account_key', accountKey)
          .eq('timeframe', 'M5').lt('bar_time', new Date(nowMs - 7 * 86_400_000).toISOString()),
        supabase.from('macrolinc_market_candles').delete().eq('account_key', accountKey)
          .eq('timeframe', 'D1').lt('bar_time', new Date(nowMs - 180 * 86_400_000).toISOString()),
      ]);
    }

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
      const { error: dealsError } = await supabase.from('macrolinc_account_deals')
        .upsert(deals, { onConflict: 'account_key,deal_ticket', ignoreDuplicates: true });
      if (dealsError) throw dealsError;
    }

    let heartbeatStatus: 'ACCEPTED' | 'NOT_ACCEPTED' = 'NOT_ACCEPTED';
    let heartbeatGovernanceVerified = false;
    const dailyClosedTrades = num(payload.dailyClosedTrades, null);
    const dailyLosses = num(payload.dailyLosses, null);
    const dailyStatsTimeBasis = str(payload.dailyStatsTimeBasis, 32);
    const openCurrencyLegs = Array.isArray(payload.openCurrencyLegs)
      ? payload.openCurrencyLegs.filter((value): value is string => typeof value === 'string' && /^[A-Z0-9._-]{3,16}$/.test(value)).slice(0, 32)
      : null;
    const liveBrokerSpread = num(payload.liveBrokerSpread, null);
    const spreadSymbol = str(payload.spreadSymbol, 16);
    if (snapshot.account_mode === 'REAL' && dailyClosedTrades !== null && Number.isSafeInteger(dailyClosedTrades) && dailyClosedTrades >= 0
      && dailyLosses !== null && Number.isSafeInteger(dailyLosses) && dailyLosses >= 0
      && dailyLosses <= dailyClosedTrades && dailyStatsTimeBasis === 'BROKER_SERVER_DAY') {
      try {
        const heartbeat = await recordMT5Heartbeat({
          accountKey,
          login: snapshot.account_login,
          server: snapshot.server,
          broker: snapshot.broker,
          accountEquity: snapshot.equity,
          accountBalance: snapshot.balance,
          dailyClosedTrades,
          dailyLosses,
          dailyStatsTimeBasis: 'BROKER_SERVER_DAY',
          openCurrencyLegs,
          liveBrokerSpread,
          spreadSymbol,
          timestampUtc: observedAt,
        });
        heartbeatStatus = 'ACCEPTED';
        heartbeatGovernanceVerified = heartbeat.governanceVerified;
      } catch (error) {
        console.error('MT5 account sync heartbeat was not accepted:', error);
      }
    }

    return NextResponse.json({
      status: 'ACCEPTED',
      accountKey,
      positionsReceived: snapshot.positions.length,
      dealsReceived: deals.length,
      quotesReceived: quotes.length,
      candlesReceived: candles.length,
      heartbeatStatus,
      heartbeatGovernanceVerified,
      observedAtUtc: observedAt,
      receivedAtUtc: snapshot.received_at,
    }, { status: 200, headers });
  } catch (error) {
    console.error('MT5 account ingestion failed:', error);
    return NextResponse.json({ error: 'Account data could not be stored.' }, { status: 503, headers });
  }
}
