import 'server-only';

import { getCachedData } from '@/lib/redisCache';
import { supabaseRead } from '@/lib/supabaseAdmin';

export type Candle = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type ExecutionFilter = {
  allow_buys: boolean;
  allow_sells: boolean;
  recommended_lot_multiplier: number;
};

export type MarketRegime = 'TRENDING_EXPANSION' | 'MEAN_REVERTING' | 'HIGH_VOL_CHOP' | 'UNAVAILABLE';

export type TechnicalSignal = {
  available: boolean;
  data_source: 'mt5' | 'configured_provider' | 'twelve_data' | 'unavailable' | 'unknown';
  latest_candle_at: string | null;
  candle_counts: { h1: number; h4: number; d1: number };
  score: number;
  gaussian_z_score: number | null;
  kaufman_efficiency_ratio: number | null;
  adx: number | null;
  regime: MarketRegime;
  execution_filter: ExecutionFilter;
  atr_stop_pips: number | null;
  atr_take_profit_pips: number | null;
};

const LIVE_PRICE_TTL_SECONDS = 60;
const MAX_CANDLES = 1_000;

function unavailableSignal(): TechnicalSignal {
  return {
    available: false,
    data_source: 'unavailable',
    latest_candle_at: null,
    candle_counts: { h1: 0, h4: 0, d1: 0 },
    score: 0,
    gaussian_z_score: null,
    kaufman_efficiency_ratio: null,
    adx: null,
    regime: 'UNAVAILABLE',
    execution_filter: { allow_buys: false, allow_sells: false, recommended_lot_multiplier: 0 },
    atr_stop_pips: null,
    atr_take_profit_pips: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseCandle(value: unknown): Candle | null {
  if (!isRecord(value)) return null;
  const timestamp = typeof value.timestamp === 'number'
    ? value.timestamp
    : typeof value.timestamp === 'string'
      ? Date.parse(value.timestamp)
      : Number.NaN;
  const candle = {
    timestamp,
    open: Number(value.open),
    high: Number(value.high),
    low: Number(value.low),
    close: Number(value.close),
  };
  if (!Object.values(candle).every(Number.isFinite)
    || candle.timestamp <= 0
    || candle.low <= 0
    || candle.high < candle.low
    || candle.open < candle.low
    || candle.open > candle.high
    || candle.close < candle.low
    || candle.close > candle.high) return null;
  return candle;
}

async function fetchTwelveDataCandles(pair: string, timeframe: 'H1' | 'H4' | 'D1'): Promise<Candle[]> {
  const apiKey = process.env.TWELVE_DATA_API_KEY?.trim();
  if (!apiKey) return [];

  const interval = timeframe === 'H1' ? '1h' : timeframe === 'H4' ? '4h' : '1day';
  const symbol = pair === 'XAUUSD' ? 'XAU/USD' : `${pair.slice(0, 3)}/${pair.slice(3)}`;
  const url = new URL('https://api.twelvedata.com/time_series');
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('interval', interval);
  url.searchParams.set('outputsize', '500');
  url.searchParams.set('timezone', 'UTC');
  url.searchParams.set('apikey', apiKey);

  const response = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Twelve Data candle request returned ${response.status}.`);

  const payload: unknown = await response.json();
  if (!isRecord(payload) || !Array.isArray(payload.values)) {
    // Never include the request URL or credential in logs/errors.
    const providerMessage = isRecord(payload) && typeof payload.message === 'string'
      ? payload.message.slice(0, 160)
      : 'Invalid Twelve Data response.';
    throw new Error(providerMessage);
  }

  const candles = payload.values.map((item): Candle | null => {
    if (!isRecord(item) || typeof item.datetime !== 'string') return null;
    return parseCandle({
      timestamp: Date.parse(item.datetime.endsWith('Z') ? item.datetime : `${item.datetime}Z`) / 1000,
      open: item.open, high: item.high, low: item.low, close: item.close,
    });
  });
  if (!candles.every((candle): candle is Candle => candle !== null)) {
    throw new Error('Twelve Data returned an invalid candle series.');
  }
  const ordered = candles.sort((left, right) => left.timestamp - right.timestamp).slice(-MAX_CANDLES);
  const latest = ordered.at(-1)?.timestamp;
  const maxAgeSeconds = timeframe === 'H1' ? 2 * 60 * 60
    : timeframe === 'H4' ? 8 * 60 * 60 : 48 * 60 * 60;
  if (latest === undefined || Date.now() / 1000 - latest > maxAgeSeconds || latest > Date.now() / 1000 + 300) {
    throw new Error(`Twelve Data returned stale ${timeframe} candles for ${pair}.`);
  }
  return ordered;
}

async function fetchCandles(pair: string, timeframe: 'H1' | 'H4' | 'D1'): Promise<Candle[]> {
  const endpoint = process.env.MARKET_DATA_PROVIDER_URL?.trim();
  if (!endpoint) return [];

  const providerUrl = new URL(endpoint);
  if (providerUrl.protocol !== 'https:') throw new Error('Market data provider must use HTTPS.');
  providerUrl.searchParams.set('pair', pair);
  providerUrl.searchParams.set('timeframe', timeframe);
  const token = process.env.MARKET_DATA_PROVIDER_TOKEN?.trim();
  const response = await fetch(providerUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Market data provider returned ${response.status}.`);

  const payload: unknown = await response.json();
  const rawCandles = Array.isArray(payload) ? payload : isRecord(payload) ? payload.candles : null;
  if (!Array.isArray(rawCandles)) throw new Error('Market data payload must contain a candles array.');
  const candles = rawCandles.map(parseCandle);
  if (!candles.every((candle): candle is Candle => candle !== null)) {
    throw new Error('Market data provider returned an invalid candle.');
  }
  const ordered = candles.sort((left, right) => left.timestamp - right.timestamp).slice(-MAX_CANDLES);
  const latest = ordered.at(-1)?.timestamp;
  const maxAgeSeconds = timeframe === 'H1' ? 2 * 60 * 60
    : timeframe === 'H4' ? 8 * 60 * 60 : 48 * 60 * 60;
  if (latest === undefined || Date.now() / 1000 - latest > maxAgeSeconds || latest > Date.now() / 1000 + 300) {
    throw new Error(`Market data provider returned stale ${timeframe} candles for ${pair}.`);
  }
  return ordered;
}

type StoredCandle = {
  installation_id: string;
  bar_time: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

async function fetchActiveMt5Candles(pair: string, timeframe: 'H1' | 'H4' | 'D1'): Promise<Candle[]> {
  const query = new URLSearchParams({
    select: 'installation_id,bar_time,open,high,low,close,installation:mt5_installations!inner(status)',
    symbol: `eq.${pair}`,
    timeframe: `eq.${timeframe}`,
    is_closed: 'eq.true',
    'installation.status': 'eq.active',
    order: 'bar_time.desc',
    limit: String(MAX_CANDLES * 3),
  });
  const rows = await supabaseRead<Array<StoredCandle>>('mt5_market_candles', query.toString());
  if (!rows?.length) return [];

  // Never mix bars from different brokers/terminals in one indicator calculation.
  const byInstallation = new Map<string, StoredCandle[]>();
  for (const row of rows) {
    const group = byInstallation.get(row.installation_id) ?? [];
    group.push(row);
    byInstallation.set(row.installation_id, group);
  }
  const selected = [...byInstallation.values()]
    .sort((a, b) => Date.parse(b[0].bar_time) - Date.parse(a[0].bar_time))[0];
  if (!selected) return [];

  const maxAgeMs = timeframe === 'H1' ? 2 * 60 * 60_000
    : timeframe === 'H4' ? 8 * 60 * 60_000 : 48 * 60 * 60_000;
  const latest = Date.parse(selected[0].bar_time);
  if (!Number.isFinite(latest) || Date.now() - latest > maxAgeMs || latest > Date.now() + 5 * 60_000) return [];

  return selected
    .map((row) => ({
      timestamp: Date.parse(row.bar_time) / 1000,
      open: Number(row.open), high: Number(row.high),
      low: Number(row.low), close: Number(row.close),
    }))
    .filter((candle) => Object.values(candle).every(Number.isFinite))
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-MAX_CANDLES);
}

type CandleSource = 'mt5' | 'configured_provider' | 'twelve_data' | 'unavailable';
type CandleSeries = { candles: Candle[]; source: CandleSource };

async function getCandles(pair: string, timeframe: 'H1' | 'H4' | 'D1'): Promise<CandleSeries> {
  return getCachedData(`market:candles:${pair}:${timeframe}`, async () => {
    const mt5Candles = await fetchActiveMt5Candles(pair, timeframe);
    if (mt5Candles.length >= 200) return { candles: mt5Candles, source: 'mt5' as const };
    // Keep providers isolated: never splice OHLC bars from different feeds into one indicator series.
    const configuredProvider = await fetchCandles(pair, timeframe).catch((error) => {
      console.warn(`Configured market data provider unavailable for ${pair} ${timeframe}.`, error);
      return [];
    });
    if (configuredProvider.length >= 200) return { candles: configuredProvider, source: 'configured_provider' as const };
    const twelveData = await fetchTwelveDataCandles(pair, timeframe).catch((error) => {
      console.warn(`Twelve Data unavailable for ${pair} ${timeframe}; technical execution remains disabled.`, error);
      return [];
    });
    return twelveData.length >= 200
      ? { candles: twelveData, source: 'twelve_data' as const }
      : { candles: [], source: 'unavailable' as const };
  }, LIVE_PRICE_TTL_SECONDS);
}

function ema(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const alpha = 2 / (period + 1);
  let result = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  for (const value of values.slice(period)) result = value * alpha + result * (1 - alpha);
  return result;
}

function alignment(values: number[]): -1 | 0 | 1 {
  const ema20 = ema(values, 20);
  const ema50 = ema(values, 50);
  const ema200 = ema(values, 200);
  if (ema20 === null || ema50 === null || ema200 === null) return 0;
  if (ema20 > ema50 && ema50 > ema200) return 1;
  if (ema20 < ema50 && ema50 < ema200) return -1;
  return 0;
}

function gaussianZScore(values: number[], period = 20) {
  const window = values.slice(-period);
  const mean = window.reduce((sum, value) => sum + value, 0) / window.length;
  const variance = window.reduce((sum, value) => sum + (value - mean) ** 2, 0) / window.length;
  const deviation = Math.sqrt(variance);
  return deviation === 0 ? 0 : (values.at(-1)! - mean) / deviation;
}

function kaufmanEfficiencyRatio(values: number[], period = 10) {
  const window = values.slice(-(period + 1));
  const change = Math.abs(window.at(-1)! - window[0]);
  const volatility = window.slice(1).reduce((sum, value, index) => sum + Math.abs(value - window[index]), 0);
  return volatility === 0 ? 0 : change / volatility;
}

function trueRanges(candles: Candle[]) {
  return candles.slice(1).map((candle, index) => {
    const previousClose = candles[index].close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose),
    );
  });
}

function averageTrueRange(candles: Candle[], period = 14) {
  const window = trueRanges(candles).slice(-period);
  return window.length < period ? null : window.reduce((sum, value) => sum + value, 0) / period;
}

function averageDirectionalIndex(candles: Candle[], period = 14) {
  if (candles.length < period * 2 + 1) return null;
  const ranges = trueRanges(candles);
  let smoothedTr = ranges.slice(0, period).reduce((sum, value) => sum + value, 0);
  let smoothedPlus = 0;
  let smoothedMinus = 0;
  for (let index = 1; index <= period; index += 1) {
    const up = candles[index].high - candles[index - 1].high;
    const down = candles[index - 1].low - candles[index].low;
    smoothedPlus += up > down && up > 0 ? up : 0;
    smoothedMinus += down > up && down > 0 ? down : 0;
  }

  const directionalIndexes: number[] = [];
  for (let index = period; index < candles.length; index += 1) {
    if (index > period) {
      const up = candles[index].high - candles[index - 1].high;
      const down = candles[index - 1].low - candles[index].low;
      smoothedTr = smoothedTr - smoothedTr / period + ranges[index - 1];
      smoothedPlus = smoothedPlus - smoothedPlus / period + (up > down && up > 0 ? up : 0);
      smoothedMinus = smoothedMinus - smoothedMinus / period + (down > up && down > 0 ? down : 0);
    }
    if (smoothedTr === 0) continue;
    const plusDi = 100 * smoothedPlus / smoothedTr;
    const minusDi = 100 * smoothedMinus / smoothedTr;
    const denominator = plusDi + minusDi;
    directionalIndexes.push(denominator === 0 ? 0 : 100 * Math.abs(plusDi - minusDi) / denominator);
  }

  if (directionalIndexes.length < period) return null;
  let adx = directionalIndexes.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  for (const directionalIndex of directionalIndexes.slice(period)) {
    adx = (adx * (period - 1) + directionalIndex) / period;
  }
  return adx;
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function normalizedAtrHistory(candles: Candle[], period = 14) {
  const values: number[] = [];
  for (let end = Math.max(period + 1, candles.length - 100); end <= candles.length; end += 1) {
    const window = candles.slice(0, end);
    const atr = averageTrueRange(window, period);
    const close = window.at(-1)?.close;
    if (atr !== null && close) values.push(atr / close);
  }
  return values;
}

export function calculateTechnicalSignal(pair: string, h1: Candle[], h4: Candle[], d1: Candle[]): TechnicalSignal {
  if (h1.length < 200 || h4.length < 200 || d1.length < 200) return unavailableSignal();
  const h1Values = h1.map((candle) => candle.close);
  const h4Values = h4.map((candle) => candle.close);
  const d1Values = d1.map((candle) => candle.close);
  const h1Alignment = alignment(h1Values);
  const h4Alignment = alignment(h4Values);
  const d1Alignment = alignment(d1Values);
  const h1ZScore = gaussianZScore(h1Values);
  const h4ZScore = gaussianZScore(h4Values);
  const ker = kaufmanEfficiencyRatio(h1Values);
  const adx = averageDirectionalIndex(h1);
  const atr = averageTrueRange(h1);
  if (adx === null || atr === null) return unavailableSignal();

  const currentNormalizedAtr = atr / h1Values.at(-1)!;
  const typicalNormalizedAtr = median(normalizedAtrHistory(h1));
  const highVolatility = typicalNormalizedAtr > 0 && currentNormalizedAtr > typicalNormalizedAtr * 1.5;
  const regime: MarketRegime = adx < 18 && highVolatility
    ? 'HIGH_VOL_CHOP'
    : adx >= 22 && ker >= 0.35
      ? 'TRENDING_EXPANSION'
      : 'MEAN_REVERTING';

  const normalizedZ = Math.max(-3, Math.min(3, h1ZScore * 0.6 + h4ZScore * 0.4));
  const trendDirection = Math.sign(h1Values.at(-1)! - h1Values.at(-11)!);
  const directionalScore = h4Alignment * 20 + d1Alignment * 25
    + trendDirection * ker * 20 + normalizedZ * 10;
  const reversionScore = -normalizedZ * 25 + (h1Alignment + h4Alignment) * 5;
  const rawScore = regime === 'TRENDING_EXPANSION'
    ? directionalScore
    : regime === 'MEAN_REVERTING'
      ? reversionScore
      : Math.round(reversionScore * 0.25);
  const score = Math.max(-100, Math.min(100, Math.round(rawScore)));
  const pipSize = pair.endsWith('JPY') ? 0.01 : pair.startsWith('XAU') ? 0.1 : 0.0001;
  const atrPips = atr / pipSize;
  const allowBuys = regime !== 'HIGH_VOL_CHOP'
    && score >= 35
    && (regime === 'MEAN_REVERTING' ? h1ZScore <= -1.2 : h4Alignment > 0 && d1Alignment > 0);
  const allowSells = regime !== 'HIGH_VOL_CHOP'
    && score <= -35
    && (regime === 'MEAN_REVERTING' ? h1ZScore >= 1.2 : h4Alignment < 0 && d1Alignment < 0);
  const allowsExecution = allowBuys || allowSells;
  const stopMultiplier = regime === 'TRENDING_EXPANSION' ? 1.75 : 1.5;
  const targetMultiplier = regime === 'TRENDING_EXPANSION' ? 3 : 2;

  return {
    available: true,
    data_source: 'unknown',
    latest_candle_at: null,
    candle_counts: { h1: h1.length, h4: h4.length, d1: d1.length },
    score,
    gaussian_z_score: Number(normalizedZ.toFixed(3)),
    kaufman_efficiency_ratio: Number(ker.toFixed(3)),
    adx: Number(adx.toFixed(2)),
    regime,
    execution_filter: {
      allow_buys: allowBuys,
      allow_sells: allowSells,
      recommended_lot_multiplier: allowsExecution
        ? Number(Math.min(1.2, 0.5 + Math.abs(score) / 150).toFixed(2))
        : 0,
    },
    atr_stop_pips: Number((atrPips * stopMultiplier).toFixed(1)),
    atr_take_profit_pips: Number((atrPips * targetMultiplier).toFixed(1)),
  };
}

export async function getTechnicalSignal(pair: string): Promise<TechnicalSignal> {
  try {
    return await getCachedData(`technical:signal:${pair}`, async () => {
      const [h1Series, h4Series, d1Series] = await Promise.all([
        getCandles(pair, 'H1'),
        getCandles(pair, 'H4'),
        getCandles(pair, 'D1'),
      ]);
      const candleCounts = {
        h1: h1Series.candles.length,
        h4: h4Series.candles.length,
        d1: d1Series.candles.length,
      };
      const sameSource = h1Series.source === h4Series.source && h4Series.source === d1Series.source;
      if (!sameSource || h1Series.source === 'unavailable') {
        console.warn(`Technical analysis for ${pair} blocked: timeframe data sources do not match.`);
        return { ...unavailableSignal(), candle_counts: candleCounts };
      }
      const h1 = h1Series.candles;
      const h4 = h4Series.candles;
      const d1 = d1Series.candles;
      const calculated = calculateTechnicalSignal(pair, h1, h4, d1);
      if (!calculated.available) return { ...calculated, candle_counts: candleCounts };
      const latestTimestamp = Math.min(
        h1.at(-1)?.timestamp ?? 0,
        h4.at(-1)?.timestamp ?? 0,
        d1.at(-1)?.timestamp ?? 0,
      );
      return {
        ...calculated,
        data_source: h1Series.source,
        latest_candle_at: latestTimestamp > 0 ? new Date(latestTimestamp * 1000).toISOString() : null,
        candle_counts: candleCounts,
      };
    }, LIVE_PRICE_TTL_SECONDS);
  } catch (error) {
    console.warn(`Technical data unavailable for ${pair}; execution filters are disabled.`, error);
    return unavailableSignal();
  }
}
