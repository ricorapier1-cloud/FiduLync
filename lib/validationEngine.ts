/**
 * Deterministic validation analytics for actual, closed, chronological trade records.
 * Monte Carlo is a bootstrap of observed outcomes, not synthetic market history.
 */
export type NetTrade = { netR: number; closedAt?: string };
export type CostedTrade = {
  grossR: number;
  spreadCostR: number;
  slippageCostR: number;
  commissionCostR: number;
  swapCostR: number;
};

export type TradeMetrics = {
  trades: number;
  expectancyR: number;
  winRate: number;
  profitFactor: number | null;
  maxDrawdownR: number;
  totalR: number;
};

export function calculateTradeMetrics(trades: NetTrade[]): TradeMetrics | null {
  if (!trades.length || trades.some((trade) => !Number.isFinite(trade.netR))) return null;
  let equity = 0, peak = 0, maxDrawdownR = 0, grossProfit = 0, grossLoss = 0, wins = 0;
  for (const trade of trades) {
    equity += trade.netR;
    peak = Math.max(peak, equity);
    maxDrawdownR = Math.max(maxDrawdownR, peak - equity);
    if (trade.netR > 0) { grossProfit += trade.netR; wins += 1; }
    if (trade.netR < 0) grossLoss += Math.abs(trade.netR);
  }
  const totalR = trades.reduce((sum, trade) => sum + trade.netR, 0);
  return {
    trades: trades.length,
    expectancyR: totalR / trades.length,
    winRate: wins / trades.length,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? null : 0,
    maxDrawdownR,
    totalR,
  };
}

export function applyExecutionCostStress(
  trades: CostedTrade[],
  multipliers: { spread: number; slippage: number; commission: number; swap: number },
): { baseline: TradeMetrics; stressed: TradeMetrics; stressedTrades: NetTrade[] } | null {
  if (!trades.length || Object.values(multipliers).some((v) => !Number.isFinite(v) || v < 1)
    || trades.some((t) => Object.values(t).some((v) => !Number.isFinite(v))
      || [t.spreadCostR, t.slippageCostR, t.commissionCostR, t.swapCostR].some((v) => v < 0))) return null;
  const baselineTrades = trades.map((t) => ({
    netR: t.grossR - t.spreadCostR - t.slippageCostR - t.commissionCostR - t.swapCostR,
  }));
  const stressedTrades = trades.map((t) => ({
    netR: t.grossR - t.spreadCostR * multipliers.spread
      - t.slippageCostR * multipliers.slippage
      - t.commissionCostR * multipliers.commission
      - t.swapCostR * multipliers.swap,
  }));
  const baseline = calculateTradeMetrics(baselineTrades);
  const stressed = calculateTradeMetrics(stressedTrades);
  return baseline && stressed ? { baseline, stressed, stressedTrades } : null;
}

export type WalkForwardFold = {
  trainStart: string;
  trainEnd: string;
  testStart: string;
  testEnd: string;
  inSample: NetTrade[];
  outOfSample: NetTrade[];
};

function timestamp(value: string): number | null {
  if (typeof value !== 'string' || !/(Z|[+-]\d{2}:?\d{2})$/i.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function evaluateWalkForward(folds: WalkForwardFold[]): {
  eligible: boolean;
  blockers: string[];
  foldCount: number;
  aggregateOos: TradeMetrics | null;
  folds: Array<{ inSample: TradeMetrics | null; outOfSample: TradeMetrics | null; degradationR: number | null }>;
} {
  const blockers: string[] = [];
  if (folds.length < 3) blockers.push('WFA_REQUIRES_AT_LEAST_THREE_CHRONOLOGICAL_FOLDS');
  let previousTestEnd = Number.NEGATIVE_INFINITY;
  const reports = folds.map((fold) => {
    const parsed = [fold.trainStart, fold.trainEnd, fold.testStart, fold.testEnd].map(timestamp);
    const times = parsed.map((value) => value ?? Number.NaN);
    const validTimes = parsed.every((value) => value !== null) && times[0] < times[1] && times[1] <= times[2] && times[2] < times[3];
    if (!validTimes || times[2] < previousTestEnd) blockers.push('WFA_FOLD_DATES_OVERLAP_OR_ARE_NOT_CHRONOLOGICAL');
    if (validTimes) previousTestEnd = times[3];
    const inSample = calculateTradeMetrics(fold.inSample);
    const outOfSample = calculateTradeMetrics(fold.outOfSample);
    if (!inSample || !outOfSample) blockers.push('WFA_FOLD_HAS_INVALID_OR_EMPTY_TRADES');
    if (outOfSample && outOfSample.trades < 30) blockers.push('WFA_FOLD_HAS_FEWER_THAN_THIRTY_OOS_TRADES');
    return {
      inSample, outOfSample,
      degradationR: inSample && outOfSample ? inSample.expectancyR - outOfSample.expectancyR : null,
    };
  });
  const allOos = folds.flatMap((fold) => fold.outOfSample);
  const aggregateOos = calculateTradeMetrics(allOos);
  if (!aggregateOos || aggregateOos.expectancyR <= 0) blockers.push('AGGREGATE_OOS_EXPECTANCY_NOT_POSITIVE');
  return { eligible: blockers.length === 0, blockers: [...new Set(blockers)], foldCount: folds.length, aggregateOos, folds: reports };
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index), upper = Math.ceil(index);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

/** Bootstrap observed closed-trade R-multiples with replacement. */
export function monteCarloBootstrap(
  trades: NetTrade[],
  options: { iterations?: number; horizon?: number; seed?: number; startingEquityR?: number; ruinDrawdownPct?: number } = {},
): {
  iterations: number;
  seed: number;
  endingEquityR: { p05: number; p50: number; p95: number };
  maxDrawdownPct: { p50: number; p95: number; p99: number };
  ruinProbability: number;
} | null {
  const iterations = options.iterations ?? 5000;
  const horizon = options.horizon ?? trades.length;
  const seed = options.seed ?? 20261119;
  const startingEquityR = options.startingEquityR ?? 100;
  const ruinDrawdownPct = options.ruinDrawdownPct ?? 50;
  if (!trades.length || trades.some((t) => !Number.isFinite(t.netR))
    || !Number.isSafeInteger(iterations) || iterations < 100 || iterations > 100_000
    || !Number.isSafeInteger(horizon) || horizon < 1 || horizon > 100_000
    || !Number.isSafeInteger(seed) || startingEquityR <= 0
    || !Number.isFinite(startingEquityR) || startingEquityR <= 0\n    || !Number.isFinite(ruinDrawdownPct) || ruinDrawdownPct <= 0 || ruinDrawdownPct >= 100) return null;
  const random = mulberry32(seed);
  const endings: number[] = [], drawdowns: number[] = [];
  let ruined = 0;
  for (let path = 0; path < iterations; path += 1) {
    let equity = startingEquityR, peak = startingEquityR, maxDd = 0;
    for (let step = 0; step < horizon; step += 1) {
      const trade = trades[Math.floor(random() * trades.length)];
      equity = Math.max(0, equity + trade.netR);
      peak = Math.max(peak, equity);
      const dd = peak > 0 ? (peak - equity) / peak * 100 : 100;
      maxDd = Math.max(maxDd, dd);
    }
    endings.push(equity);
    drawdowns.push(maxDd);
    if (maxDd >= ruinDrawdownPct) ruined += 1;
  }
  return {
    iterations, seed,
    endingEquityR: { p05: percentile(endings, 0.05), p50: percentile(endings, 0.5), p95: percentile(endings, 0.95) },
    maxDrawdownPct: { p50: percentile(drawdowns, 0.5), p95: percentile(drawdowns, 0.95), p99: percentile(drawdowns, 0.99) },
    ruinProbability: ruined / iterations,
  };
}
