import 'server-only';

import type { MarketQuote } from '@/types/macro';
import { supabaseRead } from '@/lib/supabaseAdmin';

const MAX_QUOTE_AGE_MS = 30_000;
const MAX_RECEIVE_AGE_MS = 30_000;

const finnhubSymbols = [
  ['EURUSD', 'OANDA:EUR_USD'],
  ['GBPUSD', 'OANDA:GBP_USD'],
  ['USDJPY', 'OANDA:USD_JPY'],
  ['AUDUSD', 'OANDA:AUD_USD'],
  ['USDCAD', 'OANDA:USD_CAD'],
  ['USDCHF', 'OANDA:USD_CHF'],
  ['NZDUSD', 'OANDA:NZD_USD'],
  ['XAUUSD', 'OANDA:XAU_USD'],
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasTimezone(value: string): boolean {
  return /(?:Z|[+-]\\d{2}:?\\d{2})$/i.test(value);
}

async function getFinnhubQuotes(apiKey: string): Promise<MarketQuote[]> {
  const now = Date.now();
  const results = await Promise.allSettled(finnhubSymbols.map(async ([symbol, providerSymbol]) => {
    const url = new URL('https://finnhub.io/api/v1/quote');
    url.searchParams.set('symbol', providerSymbol);
    url.searchParams.set('token', apiKey);
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new Error(`Finnhub quote returned ${response.status} for ${symbol}.`);
    const payload: unknown = await response.json();
    if (!isRecord(payload) || typeof payload.c !== 'number' || !Number.isFinite(payload.c)
      || payload.c <= 0 || typeof payload.t !== 'number' || !Number.isFinite(payload.t) || payload.t <= 0) {
      throw new Error(`Finnhub returned an invalid quote for ${symbol}.`);
    }
    const quoteTimestampMs = payload.t * 1000;
    const quoteAgeMs = now - quoteTimestampMs;
    if (quoteAgeMs < -30_000 || quoteAgeMs > MAX_QUOTE_AGE_MS) {
      throw new Error(`Finnhub quote is stale or future-dated for ${symbol}.`);
    }
    return {
      symbol,
      price: payload.c,
      changePercent: typeof payload.dp === 'number' && Number.isFinite(payload.dp) ? payload.dp : null,
      timestamp: new Date(quoteTimestampMs).toISOString(),
      source: 'finnhub' as const,
    };
  }));
  return results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
}

type StoredMt5Quote = {
  symbol: string;
  bid: number;
  ask: number;
  quote_time: string;
  received_at: string;
  installation: { status: string } | { status: string }[];
};

async function getMt5Quotes(installationId: string): Promise<MarketQuote[]> {
  if (!/^[0-9a-f-]{36}$/i.test(installationId)) return [];
  const query = new URLSearchParams({
    select: 'symbol,bid,ask,quote_time,received_at,installation:mt5_installations!inner(status)',
    installation_id: `eq.${installationId}`,
    'installation.status': 'eq.active',
    order: 'quote_time.desc',
    limit: '100',
  });
  const rows = await supabaseRead<StoredMt5Quote[]>('mt5_market_quotes', query.toString());
  if (!rows?.length) return [];

  const now = Date.now();
  const latestBySymbol = new Map<string, StoredMt5Quote>();
  for (const row of rows) {
    if (!['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD', 'XAUUSD'].includes(row.symbol)) continue;
    if (!hasTimezone(row.quote_time) || !hasTimezone(row.received_at)) continue;
    const quoteTimeMs = Date.parse(row.quote_time);
    const receivedAtMs = Date.parse(row.received_at);
    const bid = Number(row.bid);
    const ask = Number(row.ask);
    if (!Number.isFinite(quoteTimeMs) || !Number.isFinite(receivedAtMs)
      || now - quoteTimeMs < -30_000 || now - quoteTimeMs > MAX_QUOTE_AGE_MS
      || now - receivedAtMs < -30_000 || now - receivedAtMs > MAX_RECEIVE_AGE_MS) continue;
    if (!Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0 || ask < bid) continue;
    if (!latestBySymbol.has(row.symbol)) latestBySymbol.set(row.symbol, row);
  }

  return [...latestBySymbol.values()].flatMap((row) => {
    const mid = (Number(row.bid) + Number(row.ask)) / 2;
    const timestampMs = Date.parse(row.quote_time);
    if (!Number.isFinite(mid) || mid <= 0 || !Number.isFinite(timestampMs)) return [];
    return [{
      symbol: row.symbol as MarketQuote['symbol'],
      price: mid,
      changePercent: null,
      timestamp: new Date(timestampMs).toISOString(),
      source: 'mt5' as const,
    }];
  });
}

/**
 * Returns only timestamp-verified provider or explicitly selected broker quotes.
 * There is deliberately no daily reference-rate or synthetic fallback.
 */
export async function getMarketQuotes(installationId?: string): Promise<MarketQuote[]> {
  const [mt5Quotes, finnhubQuotes] = await Promise.all([
    installationId ? getMt5Quotes(installationId).catch((error) => {
      console.warn('Selected MT5 installation quotes are unavailable:', error);
      return [];
    }) : Promise.resolve([]),
    process.env.FINNHUB_PERSONAL_PLAN_ACTIVE === 'true' && process.env.FINNHUB_API_KEY?.trim()
      ? getFinnhubQuotes(process.env.FINNHUB_API_KEY.trim()).catch((error) => {
        console.warn('Finnhub live quotes are unavailable:', error);
        return [];
      })
      : Promise.resolve([]),
  ]);

  const bySymbol = new Map<MarketQuote['symbol'], MarketQuote>();
  for (const quote of mt5Quotes) bySymbol.set(quote.symbol, quote);
  for (const quote of finnhubQuotes) if (!bySymbol.has(quote.symbol)) bySymbol.set(quote.symbol, quote);
  return [...bySymbol.values()];
}
