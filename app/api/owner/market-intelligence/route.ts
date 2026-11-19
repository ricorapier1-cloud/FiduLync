import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/ownerAuth';
import { getSupabaseAdmin } from '@/lib/serverSupabase';
import { getPersonalRiskPolicy } from '@/lib/riskPolicy';
import { getCurrencyStrengthIndex } from '@/lib/currencyStrength';
import { getMacroSnapshot } from '@/lib/macroEngine';
import type { MacroSnapshot } from '@/types/macro';
import { calculateTechnicalSignal } from '@/lib/technicalEngine';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PAIRS = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'USDCAD', 'AUDUSD', 'NZDUSD', 'XAUUSD'] as const;
const FRAMES = ['D1', 'H4', 'H1'] as const;
type Candle = { installation_id: string; symbol: string; timeframe: string; bar_time: string; open: number; high: number; low: number; close: number; is_closed: boolean; broker: string; server: string };
type Quote = { installation_id: string; symbol: string; bid: number; ask: number; quote_time: string; spread_points: number; point: number; broker: string; server: string };

function ema(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const alpha = 2 / (period + 1);
  let value = values.slice(0, period).reduce((sum, item) => sum + item, 0) / period;
  for (const item of values.slice(period)) value = item * alpha + value * (1 - alpha);
  return value;
}
function atr(bars: Candle[], period = 14): number | null {
  if (bars.length < period + 1) return null;
  const ranges = bars.slice(1).map((bar, index) => Math.max(
    bar.high - bar.low,
    Math.abs(bar.high - bars[index].close),
    Math.abs(bar.low - bars[index].close),
  ));
  let value = ranges.slice(0, period).reduce((sum, item) => sum + item, 0) / period;
  for (const range of ranges.slice(period)) value = (value * (period - 1) + range) / period;
  return value;
}
function rsi(values: number[], period = 14): number | null {
  if (values.length < period + 1) return null;
  const changes = values.slice(1).map((value, index) => value - values[index]);
  const seed = changes.slice(0, period);
  let averageGain = seed.reduce((sum, value) => sum + Math.max(value, 0), 0) / period;
  let averageLoss = seed.reduce((sum, value) => sum + Math.max(-value, 0), 0) / period;
  for (const change of changes.slice(period)) {
    averageGain = (averageGain * (period - 1) + Math.max(change, 0)) / period;
    averageLoss = (averageLoss * (period - 1) + Math.max(-change, 0)) / period;
  }
  if (averageLoss === 0) return averageGain === 0 ? 50 : 100;
  return 100 - 100 / (1 + averageGain / averageLoss);
}
function sourceKey(row: Candle) {
  return [row.installation_id, row.symbol, row.broker, row.server].join('|');
}
function frameAnalysis(rows: Candle[], timeframe: string) {
  const bars = rows.filter((bar) => [bar.open, bar.high, bar.low, bar.close].every((value) => Number.isFinite(value) && value > 0)
    && bar.high >= bar.low && bar.high >= Math.max(bar.open, bar.close) && bar.low <= Math.min(bar.open, bar.close))
    .sort((a, b) => Date.parse(a.bar_time) - Date.parse(b.bar_time));
  const closes = bars.map((bar) => Number(bar.close));
  const fast = ema(closes, 20);
  const slow = ema(closes, 50);
  const long = ema(closes, 200);
  const last = closes.at(-1) ?? null;
  const volatility = atr(bars);
  const momentum = rsi(closes);
  let bias = 'INSUFFICIENT_DATA';
  if (fast !== null && slow !== null && long !== null && last !== null) {
    if (fast > slow && slow > long && last > fast) bias = 'BULLISH';
    else if (fast < slow && slow < long && last < fast) bias = 'BEARISH';
    else bias = 'NEUTRAL';
  }
  const ageMinutes = bars.length ? Math.max(0, (Date.now() - Date.parse(bars.at(-1)!.bar_time)) / 60000) : null;
  const freshnessLimit = timeframe === 'H1' ? 180 : timeframe === 'H4' ? 720 : 2880;
  return {
    timeframe,
    symbol: bars.at(-1)?.symbol ?? null,
    installation_id: bars.at(-1)?.installation_id ?? null,
    bars: bars.length,
    last_close: last,
    ema20: fast,
    ema50: slow,
    ema200: long,
    atr14: volatility,
    rsi14: momentum,
    bias,
    last_bar_at: bars.at(-1)?.bar_time ?? null,
    age_minutes: ageMinutes === null ? null : Math.round(ageMinutes),
    fresh: ageMinutes !== null && ageMinutes >= 0 && ageMinutes <= freshnessLimit,
    broker: bars.at(-1)?.broker ?? null,
    server: bars.at(-1)?.server ?? null,
  };
}

export async function GET(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: 'Owner authentication required.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });

  try {
    const supabase = getSupabaseAdmin();
    const { data: installs, error: installError } = await supabase.from('mt5_installations')
      .select('id').eq('user_id', owner.id).eq('status', 'active').limit(20);
    if (installError) throw installError;
    const installationIds = (installs ?? []).map((item) => item.id as string);

    const [quoteResult, macroResult, ...candleResults] = await Promise.all([
      installationIds.length
        ? supabase.from('mt5_market_quotes').select('installation_id,symbol,bid,ask,quote_time,spread_points,point,broker,server')
            .in('installation_id', installationIds).order('quote_time', { ascending: false }).limit(1000)
        : Promise.resolve({ data: [], error: null }),
      getMacroSnapshot(),
      ...PAIRS.flatMap((pair) => FRAMES.map((timeframe) => installationIds.length
        ? supabase.from('mt5_market_candles').select('installation_id,symbol,timeframe,bar_time,open,high,low,close,is_closed,broker,server')
            .in('installation_id', installationIds).ilike('symbol', pair + '%').eq('timeframe', timeframe).eq('is_closed', true)
            .order('bar_time', { ascending: false }).limit(250)
        : Promise.resolve({ data: [], error: null }))),
    ]);
    if (quoteResult.error) throw quoteResult.error;
    for (const result of candleResults) if (result.error) throw result.error;

    const quoteRows = (quoteResult.data ?? []) as Quote[];
    const policy = getPersonalRiskPolicy();
    const rawMacro = macroResult as MacroSnapshot;
    const macroTimestamp = Date.parse(rawMacro.asOf);
    const macroAgeMs = Date.now() - macroTimestamp;
    const macroFresh = Number.isFinite(macroTimestamp) && macroAgeMs >= -5 * 60_000 && macroAgeMs <= 24 * 60 * 60_000;
    const regionByCurrency: Record<string, string> = { USD: 'US', EUR: 'EU', GBP: 'UK', JPY: 'JP', CHF: 'CH', CAD: 'CA', AUD: 'AU', NZD: 'NZ', SEK: 'SE', NOK: 'NO' };
    const pairFundamental = (pair: string) => {
      const baseCode = pair.slice(0, 3);
      const quoteCode = pair.slice(3);
      const base = rawMacro.currencies.find((currency) => currency.code === baseCode);
      const quote = rawMacro.currencies.find((currency) => currency.code === quoteCode);
      const requiresTimestampedPolicy = (currency: NonNullable<typeof quote>) =>
        !['JPY', 'AUD', 'NZD', 'CHF'].includes(currency.code)
        || (Boolean(currency.policyRateAsOf) && Number.isFinite(Date.parse(currency.policyRateAsOf!))
          && Date.now() - Date.parse(currency.policyRateAsOf!) >= -5 * 60_000
          && Date.now() - Date.parse(currency.policyRateAsOf!) <= 180 * 24 * 60 * 60_000);
      const policyVerified = Boolean(quote && quote.policyRateSource === 'provider' && quote.inflationSource === 'provider'
        && requiresTimestampedPolicy(quote)
        && (pair === 'XAUUSD' || (base && base.policyRateSource === 'provider' && base.inflationSource === 'provider'
          && requiresTimestampedPolicy(base))));
      const hasComparableYields = base?.twoYearYield !== undefined && quote?.twoYearYield !== undefined;
      const yieldVerified = !hasComparableYields
        || (base?.twoYearYieldSource === 'provider' && quote?.twoYearYieldSource === 'provider');
      const cotMarkets = pair === 'XAUUSD' ? ['GOLD'] : [baseCode, quoteCode].filter((code) => code !== 'USD');
      const cotRows = cotMarkets.map((market) => rawMacro.cot.find((position) => position.market === market));
      const cotFresh = cotMarkets.length > 0 && cotRows.every((position) => {
        const observedAt = position?.asOf ? Date.parse(position.asOf) : Number.NaN;
        const age = Date.now() - observedAt;
        return Number.isFinite(observedAt) && age >= -5 * 60_000 && age <= 14 * 24 * 60 * 60_000;
      });
      const calendarVerified = rawMacro.calendarSource === 'provider' && macroFresh;
      const blockers = [
        ...(!macroFresh || rawMacro.source === 'fallback' ? ['MACRO_SNAPSHOT_NOT_FRESH_OR_PROVIDER'] : []),
        ...(!policyVerified ? ['PAIR_POLICY_OR_INFLATION_INPUTS_UNVERIFIED'] : []),
        ...([base, quote].filter((currency): currency is NonNullable<typeof currency> => Boolean(currency && ['JPY','AUD','NZD','CHF'].includes(currency.code))).some((currency) => !requiresTimestampedPolicy(currency)) ? ['OFFICIAL_POLICY_OBSERVATION_MISSING_OR_STALE'] : []),
        ...(!yieldVerified ? ['COMPARABLE_TWO_YEAR_YIELDS_UNVERIFIED'] : []),
        ...(!cotFresh ? ['RELEVANT_COT_POSITIONING_MISSING_OR_STALE'] : []),
        ...(!calendarVerified ? ['ECONOMIC_CALENDAR_NOT_PROVIDER_VERIFIED'] : []),
      ];
      const regions = [regionByCurrency[baseCode], regionByCurrency[quoteCode]].filter(Boolean);
      const relevantEvents = rawMacro.calendarSource === 'provider' ? rawMacro.catalysts.filter((event) =>
        regions.includes(event.region) && Date.parse(event.scheduledAt) >= Date.now() - 60 * 60_000
        && Date.parse(event.scheduledAt) <= Date.now() + 7 * 24 * 60 * 60_000) : [];
      const policyDiff = base ? base.policyRate - (quote?.policyRate ?? 0) : -(quote?.policyRate ?? 0);
      const realYieldDiff = base
        ? (base.policyRate - base.inflation) - ((quote?.policyRate ?? 0) - (quote?.inflation ?? 0))
        : -((quote?.policyRate ?? 0) - (quote?.inflation ?? 0));
      const baseCot = rawMacro.cot.find((position) => position.market === (baseCode === 'XAU' ? 'GOLD' : baseCode));
      const quoteCot = rawMacro.cot.find((position) => position.market === quoteCode);
      return {
        verified: blockers.length === 0,
        status: blockers.length === 0 ? 'VERIFIED' : 'BLOCKED',
        blockers,
        policy_rate_diff_bps: policyVerified && quote ? Math.round(policyDiff * 100) : null,
        real_yield_diff_bps: policyVerified && quote ? Math.round(realYieldDiff * 100) : null,
        cot_position_diff: cotFresh ? Math.round((baseCot?.percentile ?? 50) - (quoteCot?.percentile ?? 50)) : null,
        upcoming_events: relevantEvents.length,
        high_impact_news_lockout: relevantEvents.some((event) => event.impact === 'High'
          && Math.abs(Date.parse(event.scheduledAt) - Date.now()) <= 30 * 60_000),
      };
    };
    const pairs = PAIRS.map((pair, pairIndex) => {
      const sourceGroups = new Map<string, Record<string, Candle[]>>();
      FRAMES.forEach((timeframe, frameIndex) => {
        const result = candleResults[pairIndex * FRAMES.length + frameIndex];
        for (const row of (result.data ?? []) as Candle[]) {
          const key = sourceKey(row);
          const group = sourceGroups.get(key) ?? {};
          group[timeframe] = group[timeframe] ?? [];
          group[timeframe].push(row);
          sourceGroups.set(key, group);
        }
      });
      const candidates = [...sourceGroups.entries()].map(([key, grouped]) => {
        const orderedByFrame = Object.fromEntries(FRAMES.map((timeframe) => [timeframe,
          [...(grouped[timeframe] ?? [])].sort((a, b) => Date.parse(a.bar_time) - Date.parse(b.bar_time)),
        ])) as Record<string, Candle[]>;
        const analyses = FRAMES.map((timeframe) => frameAnalysis(orderedByFrame[timeframe] ?? [], timeframe));
        const completeFrames = FRAMES.filter((timeframe) => (orderedByFrame[timeframe]?.length ?? 0) >= 200).length;
        const availableFrames = FRAMES.filter((timeframe) => (orderedByFrame[timeframe]?.length ?? 0) > 0).length;
        const freshFrames = analyses.filter((analysis) => analysis.fresh).length;
        const freshCompleteFrames = analyses.filter((analysis) => analysis.fresh && analysis.bars >= 200).length;
        const totalBars = FRAMES.reduce((sum, timeframe) => sum + (orderedByFrame[timeframe]?.length ?? 0), 0);
        const latestTime = Math.max(0, ...FRAMES.map((timeframe) => Date.parse(orderedByFrame[timeframe]?.at(-1)?.bar_time ?? '') || 0));
        return { key, orderedByFrame, completeFrames, availableFrames, freshFrames, freshCompleteFrames, totalBars, latestTime };
      });
      candidates.sort((a, b) => b.freshCompleteFrames - a.freshCompleteFrames || b.freshFrames - a.freshFrames
        || b.completeFrames - a.completeFrames || b.availableFrames - a.availableFrames
        || b.totalBars - a.totalBars || b.latestTime - a.latestTime);
      const selectedSource = candidates[0];
      const frames = {} as Record<string, ReturnType<typeof frameAnalysis>>;
      FRAMES.forEach((timeframe) => {
        frames[timeframe] = frameAnalysis(selectedSource?.orderedByFrame[timeframe] ?? [], timeframe);
      });
      const h1Source = frames.H1;
      const quote = h1Source.symbol
        ? quoteRows.find((row) => row.installation_id === h1Source.installation_id && row.symbol === h1Source.symbol && row.broker === h1Source.broker && row.server === h1Source.server)
        : undefined;
      const quoteAgeSeconds = quote ? (Date.now() - Date.parse(quote.quote_time)) / 1000 : null;
      const quoteFresh = quoteAgeSeconds !== null && quoteAgeSeconds >= 0 && quoteAgeSeconds <= policy.maxQuoteAgeMs / 1000;
      const h1Atr = frames.H1.atr14;
      const spreadPrice = quote && Number.isFinite(quote.point) ? quote.spread_points * quote.point : null;
      const spreadAtrRatio = spreadPrice !== null && h1Atr && h1Atr > 0 ? spreadPrice / h1Atr : null;
      const biases = FRAMES.map((timeframe) => frames[timeframe].bias);
      const aligned = biases.every((bias) => bias === 'BULLISH') ? 'BULLISH'
        : biases.every((bias) => bias === 'BEARISH') ? 'BEARISH'
        : biases.every((bias) => bias === 'INSUFFICIENT_DATA') ? 'INSUFFICIENT_DATA' : 'MIXED';
      const dataComplete = FRAMES.every((timeframe) => frames[timeframe].bars >= 200);
      const fresh = quoteFresh && FRAMES.every((timeframe) => frames[timeframe].fresh);
      const spreadWithinGuard = spreadAtrRatio !== null && spreadAtrRatio <= policy.maxSpreadAtrRatio
        && quote !== undefined && quote.spread_points <= policy.maxSpreadPoints;
      const fundamental = pairFundamental(pair);
      const quantitative = calculateTechnicalSignal(pair,
        (selectedSource?.orderedByFrame.H1 ?? []).map((bar) => ({ timestamp: Date.parse(bar.bar_time) / 1000, open: bar.open, high: bar.high, low: bar.low, close: bar.close })),
        (selectedSource?.orderedByFrame.H4 ?? []).map((bar) => ({ timestamp: Date.parse(bar.bar_time) / 1000, open: bar.open, high: bar.high, low: bar.low, close: bar.close })),
        (selectedSource?.orderedByFrame.D1 ?? []).map((bar) => ({ timestamp: Date.parse(bar.bar_time) / 1000, open: bar.open, high: bar.high, low: bar.low, close: bar.close })),
      );
      return {
        pair,
        quote: quote ? { ...quote, age_seconds: Math.max(0, Math.round(quoteAgeSeconds ?? 0)), fresh: quoteFresh } : null,
        frames,
        quantitative: {
          available: quantitative.available, regime: quantitative.regime,
          rsi14: quantitative.rsi14, alma20: quantitative.alma20, kama10: quantitative.kama10,
          hurst_exponent: quantitative.hurst_exponent, trend_r_squared: quantitative.trend_r_squared,
          adr20_pips: quantitative.adr20_pips, current_daily_range_adr: quantitative.current_daily_range_adr,
          gaussian_z_score: quantitative.gaussian_z_score,
          kaufman_efficiency_ratio: quantitative.kaufman_efficiency_ratio, adx: quantitative.adx,
        },
        fundamental,
        multi_timeframe_bias: aligned,
        data_complete: dataComplete,
        data_fresh: fresh,
        spread_atr_ratio: spreadAtrRatio,
        spread_within_guard: spreadWithinGuard,
        readiness: !installationIds.length ? 'AWAITING_MT5' : !dataComplete ? 'INSUFFICIENT_HISTORY'
          : !fresh ? 'STALE_OR_MISSING_FEED' : !spreadWithinGuard ? 'SPREAD_GUARD'
            : fundamental.verified ? 'RESEARCH_INPUTS_READY' : 'FUNDAMENTALS_BLOCKED',
      };
    });

    const verifiedMacro = rawMacro ? {
      ...rawMacro,
      currencies: rawMacro.currencies.filter((currency) => currency.policyRateSource === 'provider' && currency.inflationSource === 'provider'),
      cot: rawMacro.cot.filter((position) => {
        const observedAt = position.asOf ? Date.parse(position.asOf) : Number.NaN;
        const age = Date.now() - observedAt;
        return Number.isFinite(observedAt) && age >= -5 * 60_000 && age <= 14 * 24 * 60 * 60_000;
      }),
    } : null;
    const macroStrength = verifiedMacro ? getCurrencyStrengthIndex(verifiedMacro) : [];
    const macroRates = verifiedMacro?.currencies.map((currency) => currency.policyRate).filter(Number.isFinite) ?? [];
    const policySpread = macroRates.length ? Math.max(...macroRates) - Math.min(...macroRates) : null;
    const macroRecordedAt = rawMacro?.asOf ?? null;
    const macroAgeHours = macroRecordedAt ? (Date.now() - Date.parse(macroRecordedAt)) / 3_600_000 : null;
    const macro = rawMacro && macroRecordedAt ? {
      regime_label: rawMacro.source.toUpperCase() + (rawMacro.source === 'partial' ? ' · PARTIAL' : ''),
      top_long: macroStrength.length >= 2 ? macroStrength[0].currency : '',
      top_short: macroStrength.length >= 2 ? macroStrength.at(-1)?.currency ?? '' : '',
      policy_spread: policySpread,
      provenance: [rawMacro.source, 'COT '+(rawMacro.cotSource ?? 'unavailable'), 'Calendar '+(rawMacro.calendarSource ?? 'reference')].join(' · '),
      csi_scores: Object.fromEntries(macroStrength.map((item) => [item.currency, item.score])),
      source: rawMacro.source,
      cot_source: rawMacro.cotSource ?? 'unavailable',
      calendar_source: rawMacro.calendarSource ?? 'reference',
      currencies: rawMacro.currencies.map((currency) => ({
        code: currency.code,
        policy_rate: currency.policyRate,
        inflation: currency.inflation,
        real_rate_proxy: currency.policyRate - currency.inflation,
        two_year_yield: currency.twoYearYield ?? null,
        policy_rate_source: currency.policyRateSource ?? 'reference',
        inflation_source: currency.inflationSource ?? 'reference',
        policy_rate_as_of: currency.policyRateAsOf ?? null,
        inflation_as_of: currency.inflationAsOf ?? null,
        policy_rate_source_url: currency.policyRateSourceUrl ?? null,
        inflation_source_url: currency.inflationSourceUrl ?? null,
        two_year_yield_source: currency.twoYearYieldSource ?? 'reference',
      })),
      cot: rawMacro.cot.map((position) => ({
        market: position.market, net_contracts: position.netContracts,
        percentile: position.percentile, weekly_change: position.weeklyChange,
        as_of: position.asOf ?? null,
      })),
      catalysts: rawMacro.calendarSource === 'provider'
        ? rawMacro.catalysts.filter((event) => Date.parse(event.scheduledAt) >= Date.now() - 60 * 60_000
          && Date.parse(event.scheduledAt) <= Date.now() + 7 * 24 * 60 * 60_000)
          .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt)).slice(0, 20)
          .map((event) => ({ id: event.id, region: event.region, title: event.title, scheduled_at: event.scheduledAt,
            impact: event.impact, consensus: event.consensus, actual: event.actual }))
        : [],
      recorded_at: macroRecordedAt,
      age_hours: macroAgeHours === null ? 0 : Math.max(0, Math.round(macroAgeHours)),
      fresh: rawMacro.source !== 'fallback' && macroAgeHours !== null && macroAgeHours >= -0.01 && macroAgeHours <= 24,
    } : null;
    return NextResponse.json({
      generated_at: new Date().toISOString(),
      universe: PAIRS,
      frames: FRAMES,
      active_installations: installationIds.length,
      pairs,
      macro,
      guardrails: { max_spread_points: policy.maxSpreadPoints, max_spread_atr_ratio: policy.maxSpreadAtrRatio, quote_max_age_seconds: policy.maxQuoteAgeMs / 1000 },
      execution_enabled: false,
      disclaimer: 'Research context only. No entry signal, trade instruction or broker execution is produced by this endpoint.',
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('Owner market intelligence failed:', error);
    return NextResponse.json({ error: 'Market intelligence is temporarily unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
