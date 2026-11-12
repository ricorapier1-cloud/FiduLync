import 'server-only';

import { getCachedData } from '@/lib/redisCache';
import type { MarketQuote } from '@/types/macro';

const QUOTE_CACHE_TTL_SECONDS = 60;
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

async function getFrankfurterQuotes(): Promise<MarketQuote[]> {
  const response = await fetch('https://api.frankfurter.app/latest?from=EUR&to=USD,GBP,JPY', {
    cache: 'no-store',
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Frankfurter returned ${response.status}.`);
  const payload: unknown = await response.json();
  if (!isRecord(payload) || !isRecord(payload.rates)) throw new Error('Frankfurter rates payload is invalid.');
  const usd = payload.rates.USD;
  const gbp = payload.rates.GBP;
  const jpy = payload.rates.JPY;
  if (typeof usd !== 'number' || typeof gbp !== 'number' || typeof jpy !== 'number'
    || ![usd, gbp, jpy].every((rate) => Number.isFinite(rate) && rate > 0)) {
    throw new Error('Frankfurter did not return the required currency rates.');
  }
  const timestamp = typeof payload.date === 'string' ? `${payload.date}T16:00:00.000Z` : new Date().toISOString();
  return [
    { symbol: 'EURUSD', price: usd, changePercent: null, timestamp, source: 'frankfurter' },
    { symbol: 'GBPUSD', price: usd / gbp, changePercent: null, timestamp, source: 'frankfurter' },
    { symbol: 'USDJPY', price: jpy / usd, changePercent: null, timestamp, source: 'frankfurter' },
  ];
}

async function getExchangeRateQuotes(): Promise<MarketQuote[]> {
  const response = await fetch('https://open.er-api.com/v6/latest/USD', {
    cache: 'no-store',
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`ExchangeRate-API returned ${response.status}.`);
  const payload: unknown = await response.json();
  if (!isRecord(payload) || payload.result !== 'success' || !isRecord(payload.rates)) {
    throw new Error('ExchangeRate-API returned an invalid USD rates payload.');
  }
  const eur = payload.rates.EUR;
  const gbp = payload.rates.GBP;
  const jpy = payload.rates.JPY;
  if (typeof eur !== 'number' || typeof gbp !== 'number' || typeof jpy !== 'number'
    || ![eur, gbp, jpy].every((rate) => Number.isFinite(rate) && rate > 0)) {
    throw new Error('ExchangeRate-API did not return the required currency rates.');
  }
  const timestamp = typeof payload.time_last_update_utc === 'string'
    ? new Date(payload.time_last_update_utc).toISOString()
    : new Date().toISOString();
  return [
    { symbol: 'EURUSD', price: 1 / eur, changePercent: null, timestamp, source: 'exchangerate-api' },
    { symbol: 'GBPUSD', price: 1 / gbp, changePercent: null, timestamp, source: 'exchangerate-api' },
    { symbol: 'USDJPY', price: jpy, changePercent: null, timestamp, source: 'exchangerate-api' },
  ];
}

async function getGoldQuote(): Promise<MarketQuote> {
  const response = await fetch('https://api.gold-api.com/price/XAU', {
    cache: 'no-store',
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Gold-API returned ${response.status}.`);
  const payload: unknown = await response.json();
  if (!isRecord(payload) || payload.currency !== 'USD' || typeof payload.price !== 'number'
    || !Number.isFinite(payload.price) || payload.price <= 0
    || typeof payload.updatedAt !== 'string' || !Number.isFinite(Date.parse(payload.updatedAt))) {
    throw new Error('Gold-API returned an invalid XAU/USD quote.');
  }
  return {
    symbol: 'XAUUSD',
    price: payload.price,
    changePercent: null,
    timestamp: new Date(payload.updatedAt).toISOString(),
    source: 'gold-api',
  };
}

async function fetchMarketQuotes(): Promise<MarketQuote[]> {
  const apiKey = process.env.FINNHUB_API_KEY?.trim();
  let liveQuotes: MarketQuote[] = [];
  if (apiKey) {
    try {
      liveQuotes = await getFinnhubQuotes(apiKey);
    } catch (error) {
      console.warn('Finnhub live FX quotes are unavailable:', error);
    }
  }

  if (liveQuotes.length === finnhubSymbols.length) return liveQuotes;

  const bySymbol = new Map(liveQuotes.map((quote) => [quote.symbol, quote]));
  const failures: unknown[] = [];
  for (const provider of [getFrankfurterQuotes, getExchangeRateQuotes]) {
    try {
      for (const quote of await provider()) {
        if (!bySymbol.has(quote.symbol)) bySymbol.set(quote.symbol, quote);
      }
    } catch (error) {
      failures.push(error);
      console.warn('An FX reference quote provider is unavailable:', error);
    }
    if (bySymbol.size >= 3 && liveQuotes.length === 0) break;
  }
  if (!bySymbol.has('XAUUSD')) {
    try {
      bySymbol.set('XAUUSD', await getGoldQuote());
    } catch (error) {
      failures.push(error);
      console.warn('Gold reference quote provider is unavailable:', error);
    }
  }
  if (bySymbol.size) return [...bySymbol.values()];
  throw new AggregateError(failures, 'No configured FX quote provider returned usable data.');
}

export function getMarketQuotes(): Promise<MarketQuote[]> {
  return getCachedData('market:live-quotes', fetchMarketQuotes, QUOTE_CACHE_TTL_SECONDS);
}
