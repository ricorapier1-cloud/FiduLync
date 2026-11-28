import { NextResponse } from 'next/server';
import { getMacroSnapshot } from '@/lib/macroEngine';
import { buildGoldMacroContext } from '@/lib/macro/goldAndRegimeEngine';
import { G8_PAIRS, generatePairDossier } from '@/lib/macro/dossierEngine';
import { buildIntradaySignal, classifyWATSession, type IntradaySignal } from '@/lib/quant/intradaySignalEngine';
import type { OhlcvBar } from '@/lib/quant/technicalConfluence';
import { recordAndEvaluateSpreadBaseline } from '@/lib/quant/spreadBaseline';
import { calculateAtr } from '@/lib/quant/technicalConfluence';
import { evaluateMarketRiskShield } from '@/lib/quant/sovereignShield';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


type CandlePayload = { status: string; source?: string; executionGrade?: boolean; marketDataQuality?: string; intradayBars: OhlcvBar[]; dailyBars: OhlcvBar[]; latestBarUtc: string | null };
type QuotePayload = { source?: string; executionGrade?: boolean; quotes?: Array<{ symbol: string; bid: number | null; ask: number | null; mid: number | null; spread: number | null; quoteTimeUtc: string | null; freshness: string }> };

function watDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '00';
  return part('year') + '-' + part('month') + '-' + part('day');
}

function freshCot(snapshot: Awaited<ReturnType<typeof getMacroSnapshot>>, currency: string): number | null {
  const item = snapshot.cot.find((row) => row.market === currency || (currency === 'XAU' && row.market === 'GOLD'));
  if (!item?.reportDate || item.sampleSize === undefined || item.sampleSize < 52 || item.percentile === null) return null;
  const reportTimestamp = Date.parse(item.reportDate);
  const ageMs = Date.now() - reportTimestamp;
  if (!Number.isFinite(reportTimestamp) || ageMs < -5 * 60_000 || ageMs > 14 * 86_400_000) return null;
  return typeof item.percentile === 'number' && Number.isFinite(item.percentile)
    && item.percentile >= 0 && item.percentile <= 100 ? item.percentile : null;
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const accountKey = requestUrl.searchParams.get('accountKey')?.trim() ?? '';
    const authorization = request.headers.get('authorization') ?? '';
    const marketParams = new URLSearchParams();
    if (accountKey) marketParams.set('accountKey', accountKey);
    const snapshot = await getMacroSnapshot();
    const gold = await buildGoldMacroContext(snapshot);
    const now = new Date();
    const session = classifyWATSession(now);
    const calendarRetrievedAtMs = snapshot.calendarRetrievedAtUtc ? Date.parse(snapshot.calendarRetrievedAtUtc) : NaN;
    const calendarCoverageEndMs = snapshot.calendarCoverageEndUtc ? Date.parse(snapshot.calendarCoverageEndUtc) : NaN;
    const calendarVerified = snapshot.calendarSource === 'provider' && Boolean(snapshot.calendarProvider)
      && Number.isFinite(calendarRetrievedAtMs)
      && now.getTime() - calendarRetrievedAtMs <= 60 * 60_000
      && now.getTime() - calendarRetrievedAtMs >= -30_000
      && Number.isFinite(calendarCoverageEndMs)
      && calendarCoverageEndMs >= now.getTime() + 24 * 60 * 60_000;
    const highImpactEvents = (calendarVerified ? snapshot.catalysts : []).filter((event) => event.impact === 'High')
      .map((event) => ({ event, minutes: (Date.parse(event.scheduledAt) - now.getTime()) / 60_000 }))
      .filter((item) => Number.isFinite(item.minutes));
    const nearest = [...highImpactEvents].sort((a, b) => Math.abs(a.minutes) - Math.abs(b.minutes))[0];
    const nearestRateDecision = highImpactEvents
      .filter((item) => /rate decision|interest rate|monetary policy decision|policy rate/i.test(item.event.title))
      .sort((a, b) => Math.abs(a.minutes) - Math.abs(b.minutes))[0];
    const rateDecision = Boolean(nearestRateDecision && Math.abs(nearestRateDecision.minutes) <= 60);
    const eventMinutesAway = rateDecision ? nearestRateDecision!.minutes : nearest?.minutes ?? null;
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
    const symbols = ['EURUSD', 'GBPUSD', 'XAUUSD', 'USDJPY', ...(satellite ? [satellite] : [])];
    const origin = requestUrl.origin;
    const quoteParams = new URLSearchParams(marketParams);
    if (satellite) quoteParams.set('satellite', satellite);
    const quoteQuery = quoteParams.size ? '?' + quoteParams.toString() : '';
    const marketHeaders = authorization ? { Authorization: authorization } : {};
    const quoteResponse = await fetch(new URL('/api/v1/live-quotes' + quoteQuery, origin), {
      cache: 'no-store', headers: marketHeaders, signal: AbortSignal.timeout(9_000),
    }).catch(() => null);
    const quotePayload = quoteResponse?.ok ? await quoteResponse.json() as QuotePayload : {};
    const quotes = quotePayload.quotes ?? [];
    const results = await Promise.all(symbols.map(async (symbol): Promise<IntradaySignal> => {
      const candleParams = new URLSearchParams(marketParams);
      candleParams.set('symbol', symbol);
      const candleResponse = await fetch(new URL('/api/v1/intraday-candles?' + candleParams.toString(), origin), {
        cache: 'no-store', headers: marketHeaders, signal: AbortSignal.timeout(18_000),
      }).catch(() => null);
      const candles = candleResponse?.ok ? await candleResponse.json() as CandlePayload : null;
      const quote = quotes.find((item) => item.symbol === symbol);
      const baseline = await recordAndEvaluateSpreadBaseline(symbol, quote?.freshness === 'LIVE' ? quote.spread : null, session, watDate(now));
      const isGold = symbol === 'XAUUSD';
      const dossier = isGold ? null : generatePairDossier(snapshot, symbol);
      const macroScore = isGold ? gold.goldBiasScore : dossier?.confidence === 'INSUFFICIENT_EVIDENCE' ? null : dossier?.biasScore ?? null;
      const dailyBars = candles?.dailyBars ?? [];
      const dailyAtr = calculateAtr(dailyBars, 14);
      const recentBars = (candles?.intradayBars ?? []).filter((bar) =>
        Date.parse(bar.timestampUtc) >= now.getTime() - 24 * 60 * 60_000);
      const recentRange = recentBars.length >= 12
        ? Math.max(...recentBars.map((bar) => bar.high)) - Math.min(...recentBars.map((bar) => bar.low))
        : null;
      const intradayRangeAtrMultiple = dailyAtr !== null && recentRange !== null && dailyAtr > 0
        ? recentRange / dailyAtr : null;
      const cotPercentiles = isGold
        ? [{ symbol: 'GOLD', percentile: freshCot(snapshot, 'XAU') }]
        : [
          { symbol: dossier!.base, percentile: freshCot(snapshot, dossier!.base) },
          { symbol: dossier!.quote, percentile: freshCot(snapshot, dossier!.quote) },
        ];
      const vix = gold.drivers.VIXCLS.state === 'HEALTHY' ? gold.drivers.VIXCLS.value : null;
      const marketShield = evaluateMarketRiskShield({
        vix,
        intradayRangeAtrMultiple,
        spreadMultipleOfSessionBaseline: baseline.multiple,
        eventMinutesAway,
        isCentralBankRateDecision: rateDecision,
        cotPercentiles,
      });
      const signal = buildIntradaySignal({
        symbol, macroScore,
        intradayBars: candles?.intradayBars ?? [],
        dailyBars,
        quoteMid: quote?.freshness === 'LIVE' ? quote.mid : null,
        quoteTimestampUtc: quote?.freshness === 'LIVE' ? quote.quoteTimeUtc : null,
        vix,
        calendarVerified,
        eventMinutesAway,
        rateDecision,
        spreadMultipleOfBaseline: baseline.multiple,
        candleSource: candles?.source ?? 'UNAVAILABLE',
        candleSourceVerified: candles?.executionGrade === true,
        quoteSource: quotePayload.source ?? 'UNAVAILABLE',
        brokerQuoteVerified: quotePayload.executionGrade === true,
        marketShield,
        session,
        nowUtc: now.toISOString(),
      });
      return {
        ...signal,
        spreadBaselineStatus: baseline.status,
        spreadBaselineObservations: baseline.observations,
        spreadMultipleOfBaseline: baseline.multiple,
      };
    }));
    return NextResponse.json({
      generatedAtUtc: now.toISOString(),
      timezone: 'Africa/Lagos',
      source: 'Yahoo Finance OHLCV (reference only) + Swissquote public BBO (external, non-broker) + MacroLync macro research',
      marketDataQuality: {
        candles: { provider: 'Yahoo Finance', status: 'REFERENCE_ONLY', executionGrade: false },
        quotes: { provider: quotePayload.source ?? 'UNAVAILABLE', status: 'EXTERNAL_REFERENCE', executionGrade: false },
        brokerMarketData: { status: 'NOT_CONNECTED', executionGrade: false },
      },
      satelliteSymbol: satellite,
      signals: results,
      executionAuthority: 'RESEARCH_ONLY_NO_EXECUTION_APPROVAL',
    }, { headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) {
    console.error('Intraday signal generation failed:', error);
    return NextResponse.json({ error: 'Intraday signal service is temporarily unavailable.', signals: [] }, { status: 503 });
  }
}
