export type OhlcvBar = {
  timestampUtc: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
};

export type HurstRegime = 'TRENDING_PERSISTENT' | 'RANDOM_WALK_NOISE' | 'MEAN_REVERTING';

export type TechnicalConfluence = {
  state: 'AVAILABLE' | 'INSUFFICIENT_HISTORY';
  hurstExponent: number | null;
  hurstRegime: HurstRegime | null;
  kaufmanEfficiencyRatio14: number | null;
  atr14: number | null;
  atrUnit: 'USD' | 'PRICE';
  minimumStopLoss: number | null;
  recommendedStopLossLow: number | null;
  recommendedStopLossHigh: number | null;
  warning: string | null;
  observationsUsed: number;
  latestBarUtc: string | null;
  zScore20: number | null;
};

const finite = (value: number) => Number.isFinite(value);
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

function classifyHurst(value: number): HurstRegime {
  if (value > 0.52) return 'TRENDING_PERSISTENT';
  if (value < 0.45) return 'MEAN_REVERTING';
  return 'RANDOM_WALK_NOISE';
}

/**
 * Variogram estimate: regress log variance of lagged price differences
 * against log lag, then halve the slope. This is a regime diagnostic,
 * not a predictive signal or a calibrated probability.
 */
export function estimateHurstExponent(closes: number[]): number | null {
  if (closes.length < 40 || closes.some((value) => !finite(value) || value <= 0)) return null;
  const maxLag = Math.min(20, Math.floor(closes.length / 4));
  const points: Array<{ x: number; y: number }> = [];
  for (let lag = 2; lag <= maxLag; lag++) {
    const differences: number[] = [];
    for (let i = lag; i < closes.length; i++) differences.push(Math.log(closes[i] / closes[i - lag]));
    if (differences.length < 10) continue;
    const center = mean(differences);
    const variance = mean(differences.map((value) => (value - center) ** 2));
    if (variance > 0 && finite(variance)) points.push({ x: Math.log(lag), y: Math.log(variance) });
  }
  if (points.length < 5) return null;
  const xMean = mean(points.map((point) => point.x));
  const yMean = mean(points.map((point) => point.y));
  const denominator = points.reduce((sum, point) => sum + (point.x - xMean) ** 2, 0);
  if (denominator === 0) return null;
  const slope = points.reduce((sum, point) => sum + (point.x - xMean) * (point.y - yMean), 0) / denominator;
  return finite(slope) ? Math.max(0, Math.min(1, slope / 2)) : null;
}

export function calculateKaufmanEfficiencyRatio(closes: number[], period = 14): number | null {
  if (!Number.isInteger(period) || period < 1 || closes.length <= period) return null;
  const window = closes.slice(-(period + 1));
  if (window.some((value) => !finite(value))) return null;
  const netChange = Math.abs(window[window.length - 1] - window[0]);
  const volatility = window.slice(1).reduce((sum, value, index) => sum + Math.abs(value - window[index]), 0);
  if (volatility === 0) return 0;
  return Math.max(0, Math.min(1, netChange / volatility));
}

export function calculateAtr(bars: OhlcvBar[], period = 14): number | null {
  if (!Number.isInteger(period) || period < 1 || bars.length <= period) return null;
  const window = bars.slice(-(period + 1));
  if (window.some((bar) => ![bar.high, bar.low, bar.close].every(finite) || bar.high < bar.low)) return null;
  const ranges = window.slice(1).map((bar, index) => Math.max(
    bar.high - bar.low,
    Math.abs(bar.high - window[index].close),
    Math.abs(bar.low - window[index].close),
  ));
  return ranges.every(finite) ? mean(ranges) : null;
}

export function buildTechnicalConfluence(
  bars: OhlcvBar[],
  options: { symbol: string; pipSize?: number; stopLossInput?: number } ,
): TechnicalConfluence {
  const symbol = options.symbol.toUpperCase();
  const isGold = symbol === 'XAUUSD';
  const unit: TechnicalConfluence['atrUnit'] = isGold ? 'USD' : 'PRICE';
  const closes = bars.map((bar) => bar.close);
  const atr = calculateAtr(bars, 14);
  const hurst = estimateHurstExponent(closes);
  const ker = calculateKaufmanEfficiencyRatio(closes, 14);
  const zWindow = closes.slice(-20);
  const zMean = zWindow.length === 20 ? mean(zWindow) : null;
  const zVariance = zMean === null ? null : mean(zWindow.map((value) => (value - zMean) ** 2));
  const zScore20 = zMean !== null && zVariance !== null && zVariance > 0 && closes.length >= 20
    ? (closes.at(-1)! - zMean) / Math.sqrt(zVariance) : null;
  const valid = bars.length >= 40 && atr !== null && hurst !== null && ker !== null;
  const multiplier = isGold ? 1 : (options.pipSize && options.pipSize > 0 ? 1 / options.pipSize : 1);
  const atrDisplay = atr === null ? null : atr * multiplier;
  const stopInput = options.stopLossInput;
  return {
    state: valid ? 'AVAILABLE' : 'INSUFFICIENT_HISTORY',
    hurstExponent: hurst,
    hurstRegime: hurst === null ? null : classifyHurst(hurst),
    kaufmanEfficiencyRatio14: ker,
    atr14: atrDisplay,
    atrUnit: unit,
    minimumStopLoss: atrDisplay === null ? null : atrDisplay,
    recommendedStopLossLow: atrDisplay === null ? null : atrDisplay * 1.2,
    recommendedStopLossHigh: atrDisplay === null ? null : atrDisplay * 1.5,
    warning: atrDisplay !== null && stopInput !== undefined && stopInput < atrDisplay
      ? 'STOP_TIGHTER_THAN_1X_ATR'
      : null,
    observationsUsed: bars.length,
    latestBarUtc: bars.at(-1)?.timestampUtc ?? null,
    zScore20,
  };
}
