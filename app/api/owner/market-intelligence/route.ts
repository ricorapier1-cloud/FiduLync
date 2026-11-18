import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/ownerAuth';
import { getSupabaseAdmin } from '@/lib/serverSupabase';
import { getPersonalRiskPolicy } from '@/lib/riskPolicy';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PAIRS = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'USDCAD', 'AUDUSD', 'NZDUSD', 'XAUUSD'] as const;
const FRAMES = ['D1', 'H4', 'H1'] as const;
type Candle = { symbol: string; timeframe: string; bar_time: string; open: number; high: number; low: number; close: number; is_closed: boolean; broker: string; server: string };
type Quote = { symbol: string; bid: number; ask: number; quote_time: string; spread_points: number; point: number; broker: string; server: string };

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
function selectSingleSeries(rows: Candle[], timeframe: string): Candle[] {
  const groups = new Map<string, Candle[]>();
  for (const row of rows) {
    const key = [row.symbol, row.broker, row.server].join('|');
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  const candidates = [...groups.values()].map((group) => {
    const ordered = [...group].sort((a, b) => Date.parse(a.bar_time) - Date.parse(b.bar_time));
    const latest = ordered.at(-1);
    const ageMinutes = latest ? (Date.now() - Date.parse(latest.bar_time)) / 60000 : Number.POSITIVE_INFINITY;
    const freshnessLimit = timeframe === 'H1' ? 180 : timeframe === 'H4' ? 720 : 2880;
    return { ordered, fresh: ageMinutes >= 0 && ageMinutes <= freshnessLimit, latestTime: latest ? Date.parse(latest.bar_time) : 0 };
  });
  candidates.sort((a, b) => Number(b.fresh) - Number(a.fresh) || b.ordered.length - a.ordered.length || b.latestTime - a.latestTime);
  return candidates[0]?.ordered ?? [];
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
        ? supabase.from('mt5_market_quotes').select('symbol,bid,ask,quote_time,spread_points,point,broker,server')
            .in('installation_id', installationIds).order('quote_time', { ascending: false }).limit(1000)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('macro_snapshots').select('regime_label,top_long,top_short,policy_spread,provenance,csi_scores,recorded_at')
        .order('recorded_at', { ascending: false }).limit(1),
      ...PAIRS.flatMap((pair) => FRAMES.map((timeframe) => installationIds.length
        ? supabase.from('mt5_market_candles').select('symbol,timeframe,bar_time,open,high,low,close,is_closed,broker,server')
            .in('installation_id', installationIds).ilike('symbol', pair + '%').eq('timeframe', timeframe).eq('is_closed', true)
            .order('bar_time', { ascending: false }).limit(250)
        : Promise.resolve({ data: [], error: null }))),
    ]);
    if (quoteResult.error) throw quoteResult.error;
    if (macroResult.error) throw macroResult.error;
    for (const result of candleResults) if (result.error) throw result.error;

    const quoteRows = (quoteResult.data ?? []) as Quote[];
    const policy = getPersonalRiskPolicy();
    const pairs = PAIRS.map((pair, pairIndex) => {
      const frames = {} as Record<string, ReturnType<typeof frameAnalysis>>;
      FRAMES.forEach((timeframe, frameIndex) => {
        const result = candleResults[pairIndex * FRAMES.length + frameIndex];
        const rows = selectSingleSeries((result.data ?? []) as Candle[], timeframe);
        frames[timeframe] = frameAnalysis(rows, timeframe);
      });
      const h1Source = frames.H1;
      const quote = h1Source.symbol
        ? quoteRows.find((row) => row.symbol === h1Source.symbol && row.broker === h1Source.broker && row.server === h1Source.server)
        : quoteRows.find((row) => row.symbol.toUpperCase().startsWith(pair));
      const quoteAgeSeconds = quote ? (Date.now() - Date.parse(quote.quote_time)) / 1000 : null;
      const quoteFresh = quoteAgeSeconds !== null && quoteAgeSeconds >= 0 && quoteAgeSeconds <= 120;
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
      return {
        pair,
        quote: quote ? { ...quote, age_seconds: Math.max(0, Math.round(quoteAgeSeconds ?? 0)), fresh: quoteFresh } : null,
        frames,
        multi_timeframe_bias: aligned,
        data_complete: dataComplete,
        data_fresh: fresh,
        spread_atr_ratio: spreadAtrRatio,
        spread_within_guard: spreadWithinGuard,
        readiness: !installationIds.length ? 'AWAITING_MT5' : !dataComplete ? 'INSUFFICIENT_HISTORY'
          : !fresh ? 'STALE_OR_MISSING_FEED' : !spreadWithinGuard ? 'SPREAD_GUARD' : 'RESEARCH_READY',
      };
    });

    const macro = macroResult.data?.[0] ?? null;
    const macroAgeHours = macro ? (Date.now() - Date.parse(macro.recorded_at)) / 3_600_000 : null;
    return NextResponse.json({
      generated_at: new Date().toISOString(),
      universe: PAIRS,
      frames: FRAMES,
      active_installations: installationIds.length,
      pairs,
      macro: macro ? { ...macro, age_hours: Math.max(0, Math.round(macroAgeHours ?? 0)), fresh: macroAgeHours !== null && macroAgeHours >= 0 && macroAgeHours <= 24 } : null,
      guardrails: { max_spread_points: policy.maxSpreadPoints, max_spread_atr_ratio: policy.maxSpreadAtrRatio, quote_max_age_seconds: 120 },
      execution_enabled: false,
      disclaimer: 'Research context only. No entry signal, trade instruction or broker execution is produced by this endpoint.',
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('Owner market intelligence failed:', error);
    return NextResponse.json({ error: 'Market intelligence is temporarily unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
