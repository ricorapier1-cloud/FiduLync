import { NextResponse } from 'next/server';
import { getCachedData } from '@/lib/redisCache';

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
          && Number.isFinite(quoteTimestamp) && quoteTimestamp <= Date.now() + 5 * 60_000) {
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
      source: 'SWISSQUOTE' as const,
      error: null,
    };
  } catch (error) {
    return {
      symbol: instrument.symbol, bid: null, ask: null, mid: null, spread: null,
      quoteTimeUtc: null, retrievedAtUtc: new Date().toISOString(), ageMs: null,
      freshness: 'UNAVAILABLE' as const,
      latencyMs: Math.max(0, Math.round(performance.now() - started)),
      source: 'SWISSQUOTE' as const,
      error: error instanceof Error ? error.message : 'Quote unavailable',
    };
  }
}

export async function GET(request: Request) {
  const started = performance.now();
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
    source: 'Swissquote public BBO feed',
    pollIntervalSeconds: 15,
    staleAfterSeconds: 60,
    latencyMs: Math.max(0, Math.round(performance.now() - started)),
    status: healthy === requestedInstruments.length ? 'HEALTHY' : healthy > 0 ? 'PARTIAL' : 'UNAVAILABLE',
    quotes,
  }, { headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' } });
}
