import { NextResponse } from 'next/server';
import type { OhlcvBar } from '@/lib/quant/technicalConfluence';
import { getCachedData } from '@/lib/redisCache';
import { getMt5AccountCandles, getMt5AccountMarketIdentity, isAuthorizedMt5AccountRead } from '@/lib/mt5AccountMarketData';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED = new Set([
  'EURUSD', 'XAUUSD', 'USDJPY', 'GBPUSD', 'AUDUSD', 'NZDUSD', 'USDCAD', 'USDCHF',
  'EURJPY', 'GBPJPY', 'AUDJPY', 'CADJPY', 'CHFJPY', 'NZDJPY', 'EURGBP', 'EURAUD',
  'EURCAD', 'EURCHF', 'EURNZD', 'GBPAUD', 'GBPCAD', 'GBPCHF', 'GBPNZD', 'AUDCAD',
  'AUDCHF', 'AUDNZD', 'CADCHF', 'NZDCAD', 'NZDCHF',
]);

type YahooChart = {
  chart?: {
    error?: { description?: string } | null;
    result?: Array<{
      timestamp?: number[];
      indicators?: { quote?: Array<{ open?: Array<number | null>; high?: Array<number | null>; low?: Array<number | null>; close?: Array<number | null>; volume?: Array<number | null> }> };
    }>;
  };
};

function yahooTicker(symbol: string): string {
  return symbol === 'XAUUSD' ? 'XAUUSD=X' : symbol + '=X';
}

async function loadBars(symbol: string, interval: '5m' | '1d', range: '5d' | '1mo'): Promise<OhlcvBar[]> {
  const url = new URL('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(yahooTicker(symbol)));
  url.searchParams.set('interval', interval);
  url.searchParams.set('range', range);
  url.searchParams.set('includePrePost', 'false');
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 MacroLyncResearch/1.0' },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error('Yahoo chart returned HTTP ' + response.status);
  const payload = await response.json() as YahooChart;
  const result = payload.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  if (!result?.timestamp || !quote?.open || !quote.high || !quote.low || !quote.close) {
    throw new Error(payload.chart?.error?.description ?? 'No OHLCV observations returned');
  }
  const bars: OhlcvBar[] = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    const open = quote.open[i], high = quote.high[i], low = quote.low[i], close = quote.close[i];
    if (![open, high, low, close].every((value) => typeof value === 'number' && Number.isFinite(value) && value > 0)) continue;
    if (high! < low! || high! < Math.max(open!, close!) || low! > Math.min(open!, close!)) continue;
    const epochSeconds = result.timestamp[i];
    if (!Number.isFinite(epochSeconds)) continue;
    const timestampUtc = new Date(epochSeconds * 1000).toISOString();
    if (Date.parse(timestampUtc) > Date.now() + 60_000) continue;
    const rawVolume = quote.volume?.[i];
    const volume = typeof rawVolume === 'number' && Number.isFinite(rawVolume) && rawVolume >= 0 ? rawVolume : null;
    bars.push({ timestampUtc, open: open!, high: high!, low: low!, close: close!, volume });
  }
  return bars.sort((left, right) => Date.parse(left.timestampUtc) - Date.parse(right.timestampUtc));
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const symbol = (params.get('symbol') ?? '').trim().toUpperCase();
  const accountKey = params.get('accountKey')?.trim() ?? '';
  if (accountKey) {
    const headers = { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff', Vary: 'Authorization' };
    if (!/^[a-f0-9]{64}$/i.test(accountKey) || !isAuthorizedMt5AccountRead(request)) {
      return NextResponse.json({ error: 'A valid private MT5 account-read token and account key are required.' }, { status: 401, headers });
    }
    if (!ALLOWED.has(symbol)) return NextResponse.json({ error: 'Unsupported instrument.' }, { status: 400, headers });
    try {
      const [account, intradayRows, dailyRows] = await Promise.all([
        getMt5AccountMarketIdentity(accountKey),
        getMt5AccountCandles(accountKey, symbol, 'M5'),
        getMt5AccountCandles(accountKey, symbol, 'D1'),
      ]);
      if (!account) return NextResponse.json({ error: 'MT5 account was not found.' }, { status: 404, headers });
      const toBar = (row: (typeof intradayRows)[number]): OhlcvBar => ({
        timestampUtc: new Date(row.bar_time).toISOString(),
        open: row.open, high: row.high, low: row.low, close: row.close, volume: row.tick_volume,
      });
      const intradayBars = intradayRows.map(toBar);
      const dailyBars = dailyRows.map(toBar);
      const now = Date.now();
      const latestIntraday = intradayBars.at(-1);
      const latestDaily = dailyBars.at(-1);
      const intradayAgeMs = latestIntraday ? now - Date.parse(latestIntraday.timestampUtc) : null;
      const dailyAgeMs = latestDaily ? now - Date.parse(latestDaily.timestampUtc) : null;
      const accountAgeMs = now - Date.parse(account.received_at);
      const accountFresh = Number.isFinite(accountAgeMs) && accountAgeMs >= -30_000 && accountAgeMs <= 60_000;
      const intradayFresh = intradayAgeMs !== null && intradayAgeMs >= -30_000 && intradayAgeMs <= 10 * 60_000;
      const dailyFresh = dailyAgeMs !== null && dailyAgeMs >= -30_000 && dailyAgeMs <= 2 * 86_400_000;
      const enoughHistory = intradayBars.length >= 60 && dailyBars.length >= 15;
      const executionGrade = account.account_mode === 'REAL' && accountFresh && intradayFresh && dailyFresh && enoughHistory;
      return NextResponse.json({
        symbol,
        source: 'Authenticated MT5 broker OHLCV',
        marketDataQuality: executionGrade ? 'BROKER_LIVE_VERIFIED' : 'BROKER_FEED_INCOMPLETE_OR_STALE',
        executionGrade,
        executionGradeReason: executionGrade ? null
          : account.account_mode !== 'REAL' ? 'A real MT5 account is required for execution-grade candles.'
            : !accountFresh ? 'MT5 account publisher heartbeat is stale.'
              : !intradayFresh ? 'Latest closed broker M5 candle is stale or unavailable.'
                : !dailyFresh ? 'Latest closed broker D1 candle is stale or unavailable.'
                  : 'Insufficient broker candle history: require at least 60 M5 and 15 D1 closed bars.',
        interval: '5m',
        intradayBars,
        dailyBars,
        latestBarUtc: latestIntraday?.timestampUtc ?? null,
        intradayAgeMs,
        dailyAgeMs,
        accountAgeMs,
        broker: account.broker,
        server: account.server,
        accountMode: account.account_mode,
        status: executionGrade ? 'AVAILABLE' : 'INSUFFICIENT_OR_STALE',
      }, { headers });
    } catch (error) {
      console.error('Authenticated MT5 candle read failed:', error);
      return NextResponse.json({ symbol, source: 'Authenticated MT5 broker OHLCV', status: 'UNAVAILABLE',
        error: 'Broker candles are temporarily unavailable.', intradayBars: [], dailyBars: [], latestBarUtc: null },
      { status: 503, headers });
    }
  }
  if (!ALLOWED.has(symbol)) return NextResponse.json({ error: 'Unsupported instrument.' }, { status: 400 });
  try {
    const [intraday, daily] = await getCachedData('intraday:ohlcv:v1:' + symbol, () => Promise.all([
      loadBars(symbol, '5m', '5d'),
      loadBars(symbol, '1d', '1mo'),
    ]), 60);
    const latest = intraday.at(-1);
    const ageMs = latest ? Date.now() - Date.parse(latest.timestampUtc) : null;
    const fresh = ageMs !== null && ageMs >= -60_000 && ageMs <= 15 * 60_000;
    return NextResponse.json({
      symbol,
      source: 'Yahoo Finance chart endpoint',
      marketDataQuality: 'REFERENCE_ONLY',
      executionGrade: false,
      executionGradeReason: 'Yahoo Finance OHLCV is not an authenticated IC Markets MT5 candle feed and may be delayed.',
      interval: '5m',
      intradayBars: intraday,
      dailyBars: daily,
      latestBarUtc: latest?.timestampUtc ?? null,
      ageMs,
      status: fresh && intraday.length >= 60 && daily.length >= 15 ? 'AVAILABLE' : 'INSUFFICIENT_OR_STALE',
    }, { headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) {
    return NextResponse.json({
      symbol, source: 'Yahoo Finance chart endpoint', status: 'UNAVAILABLE',
      error: error instanceof Error ? error.message : 'OHLCV source unavailable',
      intradayBars: [], dailyBars: [], latestBarUtc: null, ageMs: null,
    }, { status: 503, headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' } });
  }
}
