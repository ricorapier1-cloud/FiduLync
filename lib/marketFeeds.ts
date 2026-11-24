import 'server-only';

import { getCachedData } from '@/lib/redisCache';
import type { MarketQuote } from '@/types/macro';
import { supabaseRead } from '@/lib/supabaseAdmin';

const QUOTE_CACHE_TTL_SECONDS = 60;
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
  const response = await fetch('https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY,AUD,CAD,CHF,NZD', {
    cache: 'no-store',
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Frankfurter returned ${response.status}.`);
  const payload: unknown = await response.json();
  if (!isRecord(payload) || !isRecord(payload.rates)) throw new Error('Frankfurter rates payload is invalid.');
  const rates = payload.rates;
  const timestamp = typeof payload.date === 'string' ? `${payload.date}T16:00:00.000Z` : new Date().toISOString();

  let prevRates: Record<string, unknown> | null = null;
  if (typeof payload.date === 'string') {
    try {
      const prevDate = new Date(payload.date);
      const day = prevDate.getUTCDay();
      const stepDays = day === 1 ? 3 : day === 0 ? 2 : 1;
      prevDate.setUTCDate(prevDate.getUTCDate() - stepDays);
      const prevDateStr = prevDate.toISOString().slice(0, 10);
      const prevResp = await fetch(`https://api.frankfurter.app/${prevDateStr}?from=USD&to=EUR,GBP,JPY,AUD,CAD,CHF,NZD`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(4_000),
      });
      if (prevResp.ok) {
        const prevPayload: unknown = await prevResp.json();
        if (isRecord(prevPayload) && isRecord(prevPayload.rates)) {
          prevRates = prevPayload.rates;
        }
      }
    } catch {
      // Non-critical; fallback to null changePercent if prior date fails
    }
  }

  const calcChange = (priceNow: number, pricePrev: number | undefined): number | null => {
    if (pricePrev === undefined || pricePrev <= 0) return null;
    return Number(((priceNow - pricePrev) / pricePrev * 100).toFixed(2));
  };

  const quotes: MarketQuote[] = [];
  if (typeof rates.EUR === 'number' && rates.EUR > 0) {
    const p = 1 / rates.EUR;
    const prevP = typeof prevRates?.EUR === 'number' && prevRates.EUR > 0 ? 1 / prevRates.EUR : undefined;
    quotes.push({ symbol: 'EURUSD', price: p, changePercent: calcChange(p, prevP), timestamp, source: 'frankfurter' });
  }
  if (typeof rates.GBP === 'number' && rates.GBP > 0) {
    const p = 1 / rates.GBP;
    const prevP = typeof prevRates?.GBP === 'number' && prevRates.GBP > 0 ? 1 / prevRates.GBP : undefined;
    quotes.push({ symbol: 'GBPUSD', price: p, changePercent: calcChange(p, prevP), timestamp, source: 'frankfurter' });
  }
  if (typeof rates.JPY === 'number' && rates.JPY > 0) {
    const p = rates.JPY;
    const prevP = typeof prevRates?.JPY === 'number' && prevRates.JPY > 0 ? prevRates.JPY : undefined;
    quotes.push({ symbol: 'USDJPY', price: p, changePercent: calcChange(p, prevP), timestamp, source: 'frankfurter' });
  }
  if (typeof rates.AUD === 'number' && rates.AUD > 0) {
    const p = 1 / rates.AUD;
    const prevP = typeof prevRates?.AUD === 'number' && prevRates.AUD > 0 ? 1 / prevRates.AUD : undefined;
    quotes.push({ symbol: 'AUDUSD', price: p, changePercent: calcChange(p, prevP), timestamp, source: 'frankfurter' });
  }
  if (typeof rates.CAD === 'number' && rates.CAD > 0) {
    const p = rates.CAD;
    const prevP = typeof prevRates?.CAD === 'number' && prevRates.CAD > 0 ? prevRates.CAD : undefined;
    quotes.push({ symbol: 'USDCAD', price: p, changePercent: calcChange(p, prevP), timestamp, source: 'frankfurter' });
  }
  if (typeof rates.CHF === 'number' && rates.CHF > 0) {
    const p = rates.CHF;
    const prevP = typeof prevRates?.CHF === 'number' && prevRates.CHF > 0 ? prevRates.CHF : undefined;
    quotes.push({ symbol: 'USDCHF', price: p, changePercent: calcChange(p, prevP), timestamp, source: 'frankfurter' });
  }
  if (typeof rates.NZD === 'number' && rates.NZD > 0) {
    const p = 1 / rates.NZD;
    const prevP = typeof prevRates?.NZD === 'number' && prevRates.NZD > 0 ? 1 / prevRates.NZD : undefined;
    quotes.push({ symbol: 'NZDUSD', price: p, changePercent: calcChange(p, prevP), timestamp, source: 'frankfurter' });
  }
  if (!quotes.length) throw new Error('Frankfurter returned no usable currency quotes.');
  return quotes;
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

type StoredMt5Quote = {
  symbol: string;
  bid: number;
  ask: number;
  quote_time: string;
  received_at: string;
  installation: { status: string } | { status: string }[];
};

async function getMt5Quotes(): Promise<MarketQuote[]> {
  const query = new URLSearchParams({
    select: 'symbol,bid,ask,quote_time,received_at,installation:mt5_installations!inner(status)',
    'installation.status': 'eq.active',
    order: 'quote_time.desc',
    limit: '100',
  });
  const rows = await supabaseRead<StoredMt5Quote[]>('mt5_market_quotes', query.toString());
  if (!rows?.length) return [];
  const latestBySymbol = new Map<string, StoredMt5Quote>();
  for (const row of rows) {
    if (!['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD'].includes(row.symbol)) continue;
    if (Date.now() - Date.parse(row.quote_time) > 120_000) continue;
    if (!latestBySymbol.has(row.symbol)) latestBySymbol.set(row.symbol, row);
  }
  return [...latestBySymbol.values()].map((row) => ({
    symbol: row.symbol as MarketQuote['symbol'],
    price: (Number(row.bid) + Number(row.ask)) / 2,
    changePercent: null,
    timestamp: new Date(row.quote_time).toISOString(),
    source: 'mt5' as const,
  }));
}

async function fetchMarketQuotes(): Promise<MarketQuote[]> {
  const mt5Quotes = await getMt5Quotes().catch((error) => {
    console.warn('MT5 broker quotes are unavailable:', error);
    return [];
  });
  const apiKey = process.env.FINNHUB_API_KEY?.trim();
  let liveQuotes: MarketQuote[] = [];
  if (apiKey) {
    try {
      liveQuotes = await getFinnhubQuotes(apiKey);
    } catch (error) {
      console.warn('Finnhub live FX quotes are unavailable:', error);
    }
  }

  const bySymbol = new Map<MarketQuote['symbol'], MarketQuote>();
  for (const quote of mt5Quotes) bySymbol.set(quote.symbol, quote);
  for (const quote of liveQuotes) if (!bySymbol.has(quote.symbol)) bySymbol.set(quote.symbol, quote);
  if (bySymbol.size === finnhubSymbols.length) return [...bySymbol.values()];
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
