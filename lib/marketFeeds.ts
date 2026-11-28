import 'server-only';

import type { MarketQuote } from '@/types/macro';
import { supabaseRead } from '@/lib/supabaseAdmin';

const finnhubSymbols = [
  ['EURUSD', 'OANDA:EUR_USD'],
  ['GBPUSD', 'OANDA:GBP_USD'],
  ['USDJPY', 'OANDA:USD_JPY'],
  ['XAUUSD', 'OANDA:XAU_USD'],
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function getFinnhubQuotes(apiKey: string): Promise<MarketQuote[]> {
  const results = await Promise.allSettled(finnhubSymbols.map(async ([symbol, providerSymbol]) => {
    const url = new URL('https://finnhub.io/api/v1/quote');
    url.searchParams.set('symbol', providerSymbol);
    url.searchParams.set('token', apiKey);
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new Error(`Finnhub quote returned ${response.status} for ${symbol}.`);
    const payload: unknown = await response.json();
    if (!isRecord(payload) || typeof payload.c !== 'number' || !Number.isFinite(payload.c)
      || payload.c <= 0 || typeof payload.t !== 'number' || payload.t <= 0) {
      throw new Error(`Finnhub returned an invalid quote for ${symbol}.`);
    }
    return {
      symbol,
      price: payload.c,
      changePercent: typeof payload.dp === 'number' && Number.isFinite(payload.dp) ? payload.dp : null,
      timestamp: new Date(payload.t * 1000).toISOString(),
      source: 'finnhub' as const,
    };
  }));
  const quotes = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
  if (!quotes.length) {
    const failures = results.flatMap((result) => result.status === 'rejected' ? [result.reason] : []);
    throw new AggregateError(failures, 'Finnhub did not return any valid quotes.');
  }
  return quotes;
}

type StoredMt5Quote = {
  symbol: string;
  bid: number;
  ask: number;
  quote_time: string;
  received_at: string;
  spread_points: number | null;
  point: number | null;
  broker: string | null;
  server: string | null;
};

async function getMt5Quotes(installationId: string): Promise<MarketQuote[]> {
  // Never aggregate quotes across installations or accounts.
  const query = new URLSearchParams({
    select: 'symbol,bid,ask,quote_time,received_at,spread_points,point,broker,server,installation:mt5_installations!inner(status)',
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
    if (!/^[A-Z]{6}$/.test(row.symbol) && !['XAUUSD', 'XAGUSD', 'DXY', 'USOIL', 'SPX500'].includes(row.symbol)) continue;
    const quoteTime = Date.parse(row.quote_time);
    const receivedAt = Date.parse(row.received_at);
    const bid = Number(row.bid);
    const ask = Number(row.ask);
    if (!Number.isFinite(quoteTime) || !Number.isFinite(receivedAt)
      || now - quoteTime < -60_000 || now - quoteTime > 30_000
      || now - receivedAt < -60_000 || now - receivedAt > 30_000
      || !Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0 || ask < bid) continue;
    if (!latestBySymbol.has(row.symbol)) latestBySymbol.set(row.symbol, row);
  }
  return [...latestBySymbol.values()].map((row) => ({
    symbol: row.symbol as MarketQuote['symbol'],
    price: (Number(row.bid) + Number(row.ask)) / 2,
    changePercent: null,
    timestamp: new Date(row.quote_time).toISOString(),
    source: 'mt5' as const,
    bid: Number(row.bid),
    ask: Number(row.ask),
    spread_points: typeof row.spread_points === 'number' && row.spread_points >= 0 ? row.spread_points : null,
    point: typeof row.point === 'number' && row.point > 0 ? row.point : null,
    broker: row.broker ?? undefined,
    server: row.server ?? undefined,
  }));
}

async function fetchMarketQuotes(installationId?: string): Promise<MarketQuote[]> {
  const failures: unknown[] = [];
  const mt5Quotes = installationId
    ? await getMt5Quotes(installationId).catch((error) => {
      failures.push(error);
      console.warn('Scoped MT5 broker quotes are unavailable:', error);
      return [];
    })
    : [];

  const planActive = process.env.FINNHUB_PERSONAL_PLAN_ACTIVE === 'true';
  const apiKey = planActive ? process.env.FINNHUB_API_KEY?.trim() : undefined;
  let providerQuotes: MarketQuote[] = [];
  if (planActive && !apiKey) {
    failures.push(new Error('Finnhub is approved but FINNHUB_API_KEY is not configured.'));
  } else if (apiKey) {
    try {
      providerQuotes = await getFinnhubQuotes(apiKey);
    } catch (error) {
      failures.push(error);
      console.warn('Finnhub live quote provider is unavailable:', error);
    }
  }

  const bySymbol = new Map<MarketQuote['symbol'], MarketQuote>();
  for (const quote of mt5Quotes) bySymbol.set(quote.symbol, quote);
  for (const quote of providerQuotes) if (!bySymbol.has(quote.symbol)) bySymbol.set(quote.symbol, quote);

  if (bySymbol.size) return [...bySymbol.values()];
  if (failures.length) throw new AggregateError(failures, 'Configured live quote providers returned no usable data.');
  return [];
}

export async function getMarketQuotes(installationId?: string): Promise<MarketQuote[]> {
  // No shared cache and no daily reference-rate fallback: only recent provider or
  // installation-scoped broker observations may enter this live-quote collection.
  const quotes = await fetchMarketQuotes(installationId);
  const now = Date.now();
  return quotes.filter((quote) => {
    const timestamp = Date.parse(quote.timestamp);
    const ageMs = now - timestamp;
    if (!Number.isFinite(timestamp) || ageMs < -60_000) return false;
    if (quote.source === 'mt5') return ageMs <= 30_000;
    return process.env.FINNHUB_PERSONAL_PLAN_ACTIVE === 'true' && ageMs <= 120_000;
  });
}
