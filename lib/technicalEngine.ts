import 'server-only';

import { getCachedData } from '@/lib/redisCache';

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

export type TechnicalSignal = {
  available: boolean;
  score: number;
  gaussian_z_score: number | null;
  kaufman_efficiency_ratio: number | null;
  regime: 'TRENDING' | 'RANGING' | 'UNAVAILABLE';
  execution_filter: ExecutionFilter;
  atr_stop_pips: number | null;
  atr_take_profit_pips: number | null;
};

const LIVE_PRICE_TTL_SECONDS = 60;
const MAX_CANDLES = 1_000;

function unavailableSignal(): TechnicalSignal {
  return {
    available: false,
    score: 0,
    gaussian_z_score: null,
    kaufman_efficiency_ratio: null,
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

async function fetchCandles(pair: string, timeframe: 'H1' | 'H4'): Promise<Candle[]> {
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
  return candles.sort((left, right) => left.timestamp - right.timestamp).slice(-MAX_CANDLES);
}

async function getCandles(pair: string, timeframe: 'H1' | 'H4') {
  if (!process.env.MARKET_DATA_PROVIDER_URL?.trim()) return [];
  return getCachedData(`market:candles:${pair}:${timeframe}`, () => fetchCandles(pair, timeframe), LIVE_PRICE_TTL_SECONDS);
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

function averageTrueRange(candles: Candle[], period = 14) {
  const trueRanges = candles.slice(1).map((candle, index) => {
    const previousClose = candles[index].close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose),
    );
  });
  const window = trueRanges.slice(-period);
  return window.length < period ? null : window.reduce((sum, value) => sum + value, 0) / period;
}

export function calculateTechnicalSignal(pair: string, h1: Candle[], h4: Candle[]): TechnicalSignal {
  if (h1.length < 200 || h4.length < 200) return unavailableSignal();
  const h1Values = h1.map((candle) => candle.close);
  const h4Values = h4.map((candle) => candle.close);
  const h1Alignment = alignment(h1Values);
  const h4Alignment = alignment(h4Values);
  const zScore = gaussianZScore(h1Values);
  const ker = kaufmanEfficiencyRatio(h1Values);
  const h1Trend = h1Values.at(-1)! >= h1Values.at(-11)! ? 1 : -1;
  const normalizedZ = Math.max(-3, Math.min(3, zScore));
  const score = Math.max(-100, Math.min(100, Math.round(
    h1Alignment * 25 + h4Alignment * 35 + normalizedZ * 5 + h1Trend * ker * 25,
  )));
  const atr = averageTrueRange(h1);
  const pipSize = pair.endsWith('JPY') ? 0.01 : pair.startsWith('XAU') ? 0.1 : 0.0001;
  const atrPips = atr === null ? null : atr / pipSize;
  const allowBuys = score >= 35 && h4Alignment > 0;
  const allowSells = score <= -35 && h4Alignment < 0;
  const allowsExecution = allowBuys || allowSells;

  return {
    available: true,
    score,
    gaussian_z_score: Number(zScore.toFixed(3)),
    kaufman_efficiency_ratio: Number(ker.toFixed(3)),
    regime: ker >= 0.4 ? 'TRENDING' : 'RANGING',
    execution_filter: {
      allow_buys: allowBuys,
      allow_sells: allowSells,
      recommended_lot_multiplier: allowsExecution
        ? Number(Math.min(1.2, 0.5 + Math.abs(score) / 150).toFixed(2))
        : 0,
    },
    atr_stop_pips: atrPips === null ? null : Number((atrPips * 1.5).toFixed(1)),
    atr_take_profit_pips: atrPips === null ? null : Number((atrPips * 2.5).toFixed(1)),
  };
}

export async function getTechnicalSignal(pair: string): Promise<TechnicalSignal> {
  if (!process.env.MARKET_DATA_PROVIDER_URL?.trim()) return unavailableSignal();
  try {
    const [h1, h4] = await Promise.all([getCandles(pair, 'H1'), getCandles(pair, 'H4')]);
    return calculateTechnicalSignal(pair, h1, h4);
  } catch (error) {
    console.warn(`Technical data unavailable for ${pair}; execution filters are disabled.`, error);
    return unavailableSignal();
  }
}
