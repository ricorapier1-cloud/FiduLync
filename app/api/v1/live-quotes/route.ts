import { NextResponse } from 'next/server';

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
  if (typeof value === 'number' || (typeof value === 'string' && /^\\d{10,13}$/.test(value))) {
    const numeric = Number(value);
    const date = new Date(numeric < 1_000_000_000_000 ? numeric * 1000 : numeric);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

async function fetchQuote(instrument: typeof instruments[number]) {
  const started = performance.now();
  try {
    const response = await fetch(
      `https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/${instrument.path}`,
      { cache: 'no-store', signal: AbortSignal.timeout(8_000) },
    );
    if (!response.ok) throw new Error(`Swissquote HTTP ${response.status}`);
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) throw new Error('Invalid Swissquote response shape');
    let quote: { bid: number; ask: number; quoteTimeUtc: string } | null = null;
    for (const item of payload) {
      if (!isRecord(item) || !Array.isArray(item.spreadProfilePrices)) continue;
      for (const raw of item.spreadProfilePrices) {
        if (!isRecord(raw)) continue;
        const bid = numberValue(raw.bid);
        const ask = numberValue(raw.ask);
        const quoteTimeUtc = isoTime(raw.ts ?? item.ts);
        if (bid !== null && ask !== null && bid > 0 && ask >= bid && quoteTimeUtc) {
          quote = { bid, ask, quoteTimeUtc };
          break;
        }
      }
      if (quote) break;
    }
    if (!quote) throw new Error('No valid bid/ask observation');
    const ageMs = Math.max(0, Date.now() - Date.parse(quote.quoteTimeUtc));
    return {
      symbol: instrument.symbol, ...quote,
      mid: (quote.bid + quote.ask) / 2,
      spread: quote.ask - quote.bid,
      retrievedAtUtc: new Date().toISOString(),
      ageMs,
      freshness: ageMs > 3_600_000 ? 'STALE' as const : 'LIVE' as const,
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

export async function GET() {
  const started = performance.now();
  const quotes = await Promise.all(instruments.map(fetchQuote));
  const healthy = quotes.filter((quote) => quote.freshness === 'LIVE').length;
  return NextResponse.json({
    schemaVersion: '1.0.0',
    generatedAtUtc: new Date().toISOString(),
    source: 'Swissquote public BBO feed',
    pollIntervalSeconds: 15,
    staleAfterSeconds: 3600,
    latencyMs: Math.max(0, Math.round(performance.now() - started)),
    status: healthy === instruments.length ? 'HEALTHY' : healthy > 0 ? 'PARTIAL' : 'UNAVAILABLE',
    quotes,
  }, { headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' } });
}
