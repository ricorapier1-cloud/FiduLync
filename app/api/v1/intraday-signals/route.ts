import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getMacroSnapshot } from '@/lib/macroEngine';
import { buildGoldMacroContext } from '@/lib/macro/goldAndRegimeEngine';
import { G8_PAIRS, generatePairDossier } from '@/lib/macro/dossierEngine';
import { buildIntradaySignal, classifyWATSession, type IntradaySignal } from '@/lib/quant/intradaySignalEngine';
import type { OhlcvBar } from '@/lib/quant/technicalConfluence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(request: Request): boolean {
  const auth = request.headers.get('authorization') ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const supplied = (request.headers.get('x-macro-key') ?? bearer).trim();
  const expected = (process.env.MACRO_API_TOKEN ?? process.env.MACROLYNC_API_SECRET ?? process.env.ALGO_PRIVATE_API_KEY ?? '').trim();
  if (!supplied || expected.length < 32) return false;
  const left = Buffer.from(supplied), right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

type CandlePayload = { status: string; intradayBars: OhlcvBar[]; dailyBars: OhlcvBar[]; latestBarUtc: string | null };
type QuotePayload = { quotes?: Array<{ symbol: string; bid: number | null; ask: number | null; mid: number | null; spread: number | null; quoteTimeUtc: string | null; freshness: string }> };

function freshCot(snapshot: Awaited<ReturnType<typeof getMacroSnapshot>>, currency: string): number | null {
  const item = snapshot.cot.find((row) => row.market === currency || (currency === 'XAU' && row.market === 'GOLD'));
  if (!item?.reportDate || Date.now() - Date.parse(item.reportDate) > 14 * 86_400_000) return null;
  return item.percentile;
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  try {
    const snapshot = await getMacroSnapshot();
    const gold = await buildGoldMacroContext(snapshot);
    const now = new Date();
    const session = classifyWATSession(now);
    const nearest = snapshot.catalysts.filter((event) => event.impact === 'High')
      .map((event) => ({ event, minutes: (Date.parse(event.scheduledAt) - now.getTime()) / 60_000 }))
      .filter((item) => Number.isFinite(item.minutes))
      .sort((a, b) => Math.abs(a.minutes) - Math.abs(b.minutes))[0];
    const rateDecision = Boolean(nearest && /rate decision|interest rate|monetary policy decision|policy rate/i.test(nearest.event.title));
    const calendarVerified = snapshot.calendarSource === 'provider' && Boolean(snapshot.calendarProvider);
    const satellite = G8_PAIRS.filter((symbol) => symbol !== 'EURUSD' && symbol !== 'USDJPY' && symbol !== 'GBPUSD' && symbol !== 'XAUUSD')
      .map((symbol) => {
        const dossier = generatePairDossier(snapshot, symbol);
        const base = freshCot(snapshot, dossier.base);
        const quote = freshCot(snapshot, dossier.quote);
        return { symbol, score: dossier.biasScore, confidence: dossier.confidence, base, quote,
          uncrowded: base !== null && quote !== null && base > 10 && base < 90 && quote > 10 && quote < 90 };
      })
      .filter((item) => item.uncrowded && (item.confidence === 'HIGH' || item.confidence === 'MODERATE') && Math.abs(item.score) >= 25)
      .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))[0]?.symbol ?? null;
    const symbols = ['EURUSD', 'XAUUSD', 'USDJPY', ...(satellite ? [satellite] : [])];
    const origin = new URL(request.url).origin;
    const token = (process.env.MACRO_API_TOKEN ?? process.env.MACROLYNC_API_SECRET ?? process.env.ALGO_PRIVATE_API_KEY ?? '').trim();
    const quoteResponse = await fetch(new URL('/api/v1/live-quotes' + (satellite ? '?satellite=' + satellite : ''), origin), {
      headers: { 'x-macro-key': token }, cache: 'no-store', signal: AbortSignal.timeout(9_000),
    }).catch(() => null);
    const quotePayload = quoteResponse?.ok ? await quoteResponse.json() as QuotePayload : {};
    const quotes = quotePayload.quotes ?? [];
    const results = await Promise.all(symbols.map(async (symbol): Promise<IntradaySignal> => {
      const candleResponse = await fetch(new URL('/api/v1/intraday-candles?symbol=' + symbol, origin), {
        cache: 'no-store', signal: AbortSignal.timeout(18_000),
      }).catch(() => null);
      const candles = candleResponse?.ok ? await candleResponse.json() as CandlePayload : null;
      const quote = quotes.find((item) => item.symbol === symbol);
      const isGold = symbol === 'XAUUSD';
      const dossier = isGold ? null : generatePairDossier(snapshot, symbol);
      const macroScore = isGold ? gold.goldBiasScore : dossier?.confidence === 'INSUFFICIENT_EVIDENCE' ? null : dossier?.biasScore ?? null;
      return buildIntradaySignal({
        symbol, macroScore,
        intradayBars: candles?.intradayBars ?? [],
        dailyBars: candles?.dailyBars ?? [],
        quoteMid: quote?.freshness === 'LIVE' ? quote.mid : null,
        quoteTimestampUtc: quote?.freshness === 'LIVE' ? quote.quoteTimeUtc : null,
        vix: snapshot.vix?.freshness === 'LATEST PUBLISHED' ? snapshot.vix.value : null,
        calendarVerified,
        eventMinutesAway: nearest?.minutes ?? null,
        rateDecision,
        // Swissquote exposes current BBO only. No measured session spread distribution exists yet.
        // Missing baseline is a hard block; a fabricated normal spread is never substituted.
        spreadMultipleOfBaseline: null,
        session,
        nowUtc: now.toISOString(),
      });
    }));
    return NextResponse.json({
      generatedAtUtc: now.toISOString(),
      timezone: 'Africa/Lagos',
      source: 'Yahoo Finance OHLCV + Swissquote BBO + verified MacroLync macro snapshot',
      satelliteSymbol: satellite,
      signals: results,
      executionAuthority: 'MANUAL_OR_EA_CONFIRMATION_REQUIRED',
    }, { headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) {
    console.error('Intraday signal generation failed:', error);
    return NextResponse.json({ error: 'Intraday signal service is temporarily unavailable.', signals: [] }, { status: 503 });
  }
}
