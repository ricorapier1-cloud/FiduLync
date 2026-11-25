export type OhlcvBar = {
  timestampUtc: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
};

export type HurstRegime = 'TRENDING_PERSISTENT' | 'RANDOM_WALK_NOISE' | 'MEAN_REVERTING';

export type TechnicalConfluence = {
  status: 'AVAILABLE' | 'INSUFFICIENT_HISTORY' | 'INVALID_DATA';
  observations: number;
  hurstExponent: number | null;
  hurstRegime: HurstRegime | 'UNAVAILABLE';
  kaufmanEfficiencyRatio14: number | null;
  atr14: number | null;
  atrUnit: 'PRICE' | 'PIPS';
  recommendedStopMin: number | null;
  recommendedStopMax: number | null;
  minimumNoiseFloor: number | null;
  sourceAsOfUtc: string | null;
};

function finitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

function estimateHurst(closes: number[]): number | null {
  if (closes.length < 64) return null;
  const returns = closes.slice(1).map((close, index) => Math.log(close / closes[index]));
  const scales = [8, 16, 32];
  const estimates: number[] = [];
  for (const scale of scales) {
    const chunks = Math.floor(returns.length / scale);
    const ratios: number[] = [];
    for (let chunk = 0; chunk < chunks; chunk += 1) {
      const sample = returns.slice(chunk * scale, (chunk + 1) * scale);
      const sigma = standardDeviation(sample);
      if (!finitePositive(sigma)) continue;
      const average = mean(sample);
      let cumulative = 0;
      let minimum = 0;
      let maximum = 0;
      for (const value of sample) {
        cumulative += value - average;
        minimum = Math.min(minimum, cumulative);
        maximum = Math.max(maximum, cumulative);
      }
      const ratio = (maximum - minimum) / sigma;
      if (finitePositive(ratio)) ratios.push(ratio);
    }
    if (ratios.length) estimates.push(Math.log(mean(ratios)) / Math.log(scale));
  }
  if (estimates.length < 2) return null;
  return Math.max(0, Math.min(1, mean(estimates)));
}

export function calculateTechnicalConfluence(
  bars: OhlcvBar[],
  options: { instrument: string; pipSize?: number; atrPeriod?: number } ,
): TechnicalConfluence {
  const period = options.atrPeriod ?? 14;
  const pipSize = options.pipSize;
  const invalid = bars.some((bar) => !bar.timestampUtc || !Number.isFinite(Date.parse(bar.timestampUtc))
    || !finitePositive(bar.open) || !finitePositive(bar.high) || !finitePositive(bar.low)
    || !finitePositive(bar.close) || bar.high < bar.low || bar.high < Math.max(bar.open, bar.close)
    || bar.low > Math.min(bar.open, bar.close));
  if (invalid) return unavailable('INVALID_DATA', options.instrument);
  const ordered = [...bars].sort((a, b) => Date.parse(a.timestampUtc) - Date.parse(b.timestampUtc));
  const unique = ordered.filter((bar, index) => index === 0 || bar.timestampUtc !== ordered[index - 1].timestampUtc);
  if (unique.length < Math.max(64, period + 1)) return unavailable('INSUFFICIENT_HISTORY', options.instrument, unique.length);
  const closes = unique.map((bar) => bar.close);
  const recent = unique.slice(-(period + 1));
  const trueRanges = recent.slice(1).map((bar, index) => Math.max(
    bar.high - bar.low,
    Math.abs(bar.high - recent[index].close),
    Math.abs(bar.low - recent[index].close),
  ));
  const atr = mean(trueRanges);
  const efficiencyWindow = closes.slice(-(period + 1));
  const netMove = Math.abs(efficiencyWindow.at(-1)! - efficiencyWindow[0]);
  const pathLength = efficiencyWindow.slice(1).reduce((sum, close, index) => sum + Math.abs(close - efficiencyWindow[index]), 0);
  const ker = pathLength > 0 ? Math.max(0, Math.min(1, netMove / pathLength)) : 0;
  const hurst = estimateHurst(closes);
  const isGold = options.instrument.toUpperCase().includes('XAU');
  const scale = isGold ? 1 : pipSize;
  const atrValue = scale ? atr / scale : atr;
  return {
    status: hurst === null ? 'INSUFFICIENT_HISTORY' : 'AVAILABLE',
    observations: unique.length,
    hurstExponent: hurst,
    hurstRegime: hurst === null ? 'UNAVAILABLE' : hurst > 0.55 ? 'TRENDING_PERSISTENT' : hurst < 0.45 ? 'MEAN_REVERTING' : 'RANDOM_WALK_NOISE',
    kaufmanEfficiencyRatio14: Number(ker.toFixed(4)),
    atr14: Number(atrValue.toFixed(6)),
    atrUnit: isGold ? 'PRICE' : 'PIPS',
    recommendedStopMin: Number((atrValue * 1.2).toFixed(4)),
    recommendedStopMax: Number((atrValue * 1.5).toFixed(4)),
    minimumNoiseFloor: Number(atrValue.toFixed(4)),
    sourceAsOfUtc: unique.at(-1)?.timestampUtc ?? null,
  };
}

function unavailable(status: 'INSUFFICIENT_HISTORY' | 'INVALID_DATA', instrument: string, observations = 0): TechnicalConfluence {
  return { status, observations, hurstExponent: null, hurstRegime: 'UNAVAILABLE', kaufmanEfficiencyRatio14: null, atr14: null,
    atrUnit: instrument.toUpperCase().includes('XAU') ? 'PRICE' : 'PIPS', recommendedStopMin: null, recommendedStopMax: null,
    minimumNoiseFloor: null, sourceAsOfUtc: null };
}
