import { NextResponse } from 'next/server';
import { getCachedData } from '@/lib/redisCache';
import { getMt5AccountMarketIdentity, getMt5AccountQuotes, isAuthorizedMt5AccountRead } from '@/lib/mt5AccountMarketData';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const instruments = [
  { symbol: 'EURUSD', path: 'EUR/USD' },
  { symbol: 'GBPUSD', path: 'GBP/USD' },
  { symbol: 'XAUUSD', path: 'XAU/USD' },
  { symbol: 'USDJPY', path: 'USD/JPY' },
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
function isoTime(value: unknown): string | null {
  if (typeof value === 'number' || (typeof value === 'string' && /^\d{10,13}$/.test(value))) {
    const numeric = Number(value);
    const date = new Date(numeric < 1_000_000_000_000 ? numeric * 1000 : numeric);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

async function fetchQuote(instrument: { symbol: string; path: string }) {
  const started = performance.now();
  try {
    const response = await fetch(
      `https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/${instrument.path}`,
      { cache: 'no-store', signal: AbortSignal.timeout(8_000) },
    );
    if (!response.ok) throw new Error(`Swissquote HTTP ${response.status}`);
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) throw new Error('Invalid Swissquote response shape');
    const observations: Array<{ bid: number; ask: number; quoteTimeUtc: string }> = [];
    for (const item of payload) {
      if (!isRecord(item) || !Array.isArray(item.spreadProfilePrices)) continue;
      for (const raw of item.spreadProfilePrices) {
        if (!isRecord(raw)) continue;
        const bid = numberValue(raw.bid);
        const ask = numberValue(raw.ask);
        const quoteTimeUtc = isoTime(raw.ts ?? item.ts);
        const quoteTimestamp = quoteTimeUtc ? Date.parse(quoteTimeUtc) : Number.NaN;
        if (bid !== null && ask !== null && bid > 0 && ask >= bid
          && Number.isFinite(quoteTimestamp) && quoteTimestamp <= Date.now() + 30_000) {
          observations.push({ bid, ask, quoteTimeUtc: quoteTimeUtc! });
        }
      }
    }
    const quote = observations.sort((left, right) => Date.parse(right.quoteTimeUtc) - Date.parse(left.quoteTimeUtc))[0];
    if (!quote) throw new Error('No valid bid/ask observation');
    const ageMs = Math.max(0, Date.now() - Date.parse(quote.quoteTimeUtc));
    return {
      symbol: instrument.symbol, ...quote,
      mid: (quote.bid + quote.ask) / 2,
      spread: quote.ask - quote.bid,
      retrievedAtUtc: new Date().toISOString(),
      ageMs,
      freshness: ageMs > 60_000 ? 'STALE' as const : 'LIVE' as const,
      latencyMs: Math.max(0, Math.round(performance.now() - started)),
      source: 'SWISSQUOTE_REFERENCE' as const,
      executionGrade: false,
      error: null,
    };
  } catch (error) {
    return {
      symbol: instrument.symbol, bid: null, ask: null, mid: null, spread: null,
      quoteTimeUtc: null, retrievedAtUtc: new Date().toISOString(), ageMs: null,
      freshness: 'UNAVAILABLE' as const,
      latencyMs: Math.max(0, Math.round(performance.now() - started)),
      source: 'SWISSQUOTE_REFERENCE' as const,
      executionGrade: false,
      error: error instanceof Error ? error.message : 'Quote unavailable',
    };
  }
}

export async function GET(request: Request) {
  const started = performance.now();
  const params = new URL(request.url).searchParams;
  const accountKey = params.get('accountKey')?.trim() ?? '';
  if (accountKey) {
    const headers = { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff', Vary: 'Authorization' };
    if (!/^[a-f0-9]{64}$/i.test(accountKey) || !isAuthorizedMt5AccountRead(request)) {
      return NextResponse.json({ error: 'A valid private MT5 account-read token and account key are required.' }, { status: 401, headers });
    }
    try {
      const [account, rows] = await Promise.all([
        getMt5AccountMarketIdentity(accountKey),
        getMt5AccountQuotes(accountKey),
      ]);
      if (!account) return NextResponse.json({ error: 'MT5 account was not found.' }, { status: 404, headers });
      const now = Date.now();
      const accountAgeMs = now - Date.parse(account.received_at);
      const accountFresh = Number.isFinite(accountAgeMs) && accountAgeMs >= -30_000 && accountAgeMs <= 60_000;
      const quotes = rows.map((quote) => {
        const quoteAgeMs = now - Date.parse(quote.quote_time);
        const receivedAgeMs = now - Date.parse(quote.received_at);
        const fresh = Number.isFinite(quoteAgeMs) && Number.isFinite(receivedAgeMs)
          && quoteAgeMs >= -5_000 && quoteAgeMs <= 15_000
          && receivedAgeMs >= -5_000 && receivedAgeMs <= 30_000;
        return {
          symbol: quote.symbol,
          bid: fresh ? quote.bid : null,
          ask: fresh ? quote.ask : null,
          mid: fresh ? (quote.bid + quote.ask) / 2 : null,
          spread: fresh ? quote.ask - quote.bid : null,
          quoteTimeUtc: quote.quote_time,
          retrievedAtUtc: quote.received_at,
          ageMs: Number.isFinite(quoteAgeMs) ? Math.max(0, quoteAgeMs) : null,
          freshness: fresh ? 'LIVE' as const : 'STALE' as const,
          latencyMs: null,
          source: 'MT5_BROKER' as const,
          broker: quote.broker ?? account.broker,
          server: quote.server,
          digits: quote.digits,
          point: quote.point,
          spreadPoints: quote.spread_points,
          executionGrade: fresh && accountFresh && account.account_mode === 'REAL',
          error: fresh ? null : 'Broker quote or account heartbeat is stale.',
        };
      });
      const required = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD'];
      const allRequiredFresh = required.every((symbol) => quotes.some((quote) =>
        quote.symbol === symbol && quote.freshness === 'LIVE' && quote.executionGrade));
      const executionGrade = accountFresh && account.account_mode === 'REAL' && allRequiredFresh;
      const healthy = quotes.filter((quote) => quote.freshness === 'LIVE').length;
      return NextResponse.json({
        schemaVersion: '1.0.0',
        generatedAtUtc: new Date().toISOString(),
        source: 'Authenticated MT5 broker feed',
        broker: account.broker,
        server: account.server,
        accountMode: account.account_mode,
        accountObservedAtUtc: account.observed_at,
        accountReceivedAtUtc: account.received_at,
        accountAgeMs,
        marketDataQuality: executionGrade ? 'BROKER_LIVE_VERIFIED' : 'BROKER_FEED_INCOMPLETE_OR_STALE',
        executionGrade,
        executionGradeReason: executionGrade ? null
          : account.account_mode !== 'REAL' ? 'A real MT5 account is required for execution-grade market data.'
            : !accountFresh ? 'MT5 account publisher heartbeat is stale.'
              : 'All four core instruments require fresh broker quotes.',
        pollIntervalSeconds: 15,
        staleAfterSeconds: 15,
        latencyMs: Math.max(0, Math.round(performance.now() - started)),
        status: executionGrade ? 'HEALTHY' : healthy > 0 ? 'PARTIAL' : 'UNAVAILABLE',
        quotes,
      }, { headers });
    } catch (error) {
      console.error('Authenticated MT5 market quote read failed:', error);
      return NextResponse.json({ error: 'Broker market data is temporarily unavailable.' }, { status: 503, headers });
    }
  }
  const satellite = new URL(request.url).searchParams.get('satellite')?.trim().toUpperCase() ?? '';
  const validSatellites = new Set(['AUDUSD', 'NZDUSD', 'USDCAD', 'USDCHF', 'EURJPY', 'GBPJPY', 'AUDJPY', 'CADJPY', 'CHFJPY', 'NZDJPY', 'EURGBP', 'EURAUD', 'EURCAD', 'EURCHF', 'EURNZD', 'GBPAUD', 'GBPCAD', 'GBPCHF', 'GBPNZD', 'AUDCAD', 'AUDCHF', 'AUDNZD', 'CADCHF', 'NZDCAD', 'NZDCHF']);
  const satelliteInstrument = validSatellites.has(satellite)
    ? { symbol: satellite, path: satellite.slice(0, 3) + '/' + satellite.slice(3, 6) }
    : null;
  const requestedInstruments = [...instruments, ...(satelliteInstrument ? [satelliteInstrument] : [])];
  const cachedQuotes = await Promise.all(requestedInstruments.map((instrument) =>
    getCachedData('macro:swissquote-bbo-v1:' + instrument.symbol, () => fetchQuote(instrument), 5),
  ));
  const quotes = cachedQuotes.map((quote) => {
    const ageMs = quote.quoteTimeUtc ? Math.max(0, Date.now() - Date.parse(quote.quoteTimeUtc)) : null;
    const freshness = ageMs === null ? 'UNAVAILABLE' as const : ageMs > 60_000 ? 'STALE' as const : 'LIVE' as const;
    const digits = quote.symbol === 'XAUUSD' ? 2 : quote.symbol === 'USDJPY' ? 3 : 5;
    const normalize = (value: number | null) => value === null ? null : Number(value.toFixed(digits));
    return { ...quote, bid: normalize(quote.bid), ask: normalize(quote.ask), mid: normalize(quote.mid), spread: normalize(quote.spread), ageMs, freshness };
  });
  const healthy = quotes.filter((quote) => quote.freshness === 'LIVE').length;
  return NextResponse.json({
    schemaVersion: '1.0.0',
    generatedAtUtc: new Date().toISOString(),
    source: 'Swissquote public BBO reference feed',
    marketDataQuality: 'REFERENCE_ONLY',
    executionGrade: false,
    executionGradeReason: 'Public Swissquote BBO is not the user\'s authenticated MT5 broker feed and cannot authorize execution.',
    pollIntervalSeconds: 15,
    staleAfterSeconds: 60,
    latencyMs: Math.max(0, Math.round(performance.now() - started)),
    status: healthy === requestedInstruments.length ? 'HEALTHY' : healthy > 0 ? 'PARTIAL' : 'UNAVAILABLE',
    quotes,
  }, { headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' } });
}
