import { RESEARCH_OBJECTIVES } from './researchObjectives';

/**
 * Deterministic validation analytics for actual, closed, chronological trade records.
 * Monte Carlo resamples observed outcomes; it is not synthetic market history.
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
  winRateWilson95: { lower: number; upper: number };
  averageWinR: number | null;
  averageLossR: number | null;
  realizedRewardRisk: number | null;
  profitFactor: number | null;
  maxDrawdownR: number;
  totalR: number;
};

export const QUANT_CORE_RESEARCH_OBJECTIVES = RESEARCH_OBJECTIVES;

export function wilsonScoreInterval(wins: number, trades: number, z = 1.96): { lower: number; upper: number } | null {
  if (!Number.isSafeInteger(wins) || !Number.isSafeInteger(trades) || trades < 1
    || wins < 0 || wins > trades || !Number.isFinite(z) || z <= 0) return null;
  const p = wins / trades;
  const z2 = z * z;
  const denominator = 1 + z2 / trades;
  const center = (p + z2 / (2 * trades)) / denominator;
  const margin = (z * Math.sqrt((p * (1 - p) / trades) + z2 / (4 * trades * trades))) / denominator;
  return { lower: Math.max(0, center - margin), upper: Math.min(1, center + margin) };
}

export function calculateTradeMetrics(trades: NetTrade[]): TradeMetrics | null {
  if (!trades.length || trades.some((trade) => !Number.isFinite(trade.netR))) return null;
  let equity = 0, peak = 0, maxDrawdownR = 0, grossProfit = 0, grossLoss = 0;
  const winners: number[] = [], losers: number[] = [];
  for (const trade of trades) {
    equity += trade.netR;
    peak = Math.max(peak, equity);
    maxDrawdownR = Math.max(maxDrawdownR, peak - equity);
    if (trade.netR > 0) { grossProfit += trade.netR; winners.push(trade.netR); }
    if (trade.netR < 0) { grossLoss += Math.abs(trade.netR); losers.push(Math.abs(trade.netR)); }
  }
  const totalR = trades.reduce((sum, trade) => sum + trade.netR, 0);
  const wins = winners.length;
  const interval = wilsonScoreInterval(wins, trades.length);
  if (!interval) return null;
  const averageWinR = winners.length ? winners.reduce((sum, value) => sum + value, 0) / winners.length : null;
  const averageLossR = losers.length ? losers.reduce((sum, value) => sum + value, 0) / losers.length : null;
  return {
    trades: trades.length,
    expectancyR: totalR / trades.length,
    winRate: wins / trades.length,
    winRateWilson95: interval,
    averageWinR,
    averageLossR,
    realizedRewardRisk: averageWinR !== null && averageLossR !== null && averageLossR > 0
      ? averageWinR / averageLossR : null,
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
  if (typeof value !== 'string' || !/(Z|[+-]\\d{2}:?\\d{2})$/i.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function tradesChronologicalWithin(trades: NetTrade[], start: string, end: string): boolean {
  const startMs = timestamp(start), endMs = timestamp(end);
  if (startMs === null || endMs === null || !trades.length) return false;
  let previous = Number.NEGATIVE_INFINITY;
  for (const trade of trades) {
    if (!trade.closedAt) return false;
    const closed = timestamp(trade.closedAt);
    if (closed === null || closed < startMs || closed >= endMs || closed < previous) return false;
    previous = closed;
  }
  return true;
}

export function evaluateWalkForward(folds: WalkForwardFold[]): {
  eligible: boolean;
  blockers: string[];
  foldCount: number;
  aggregateOos: TradeMetrics | null;
  folds: Array<{ inSample: TradeMetrics | null; outOfSample: TradeMetrics | null; degradationR: number | null }>;
} {
  const blockers: string[] = [];
  if (folds.length < QUANT_CORE_RESEARCH_OBJECTIVES.minimumWalkForwardFolds) blockers.push('WFA_REQUIRES_AT_LEAST_THREE_CHRONOLOGICAL_FOLDS');
  let previousTestEnd = Number.NEGATIVE_INFINITY;
  const reports = folds.map((fold) => {
    const parsed = [fold.trainStart, fold.trainEnd, fold.testStart, fold.testEnd].map(timestamp);
    const times = parsed.map((value) => value ?? Number.NaN);
    const validTimes = parsed.every((value) => value !== null) && times[0] < times[1] && times[1] <= times[2] && times[2] < times[3];
    if (!validTimes || times[2] < previousTestEnd) blockers.push('WFA_FOLD_DATES_OVERLAP_OR_ARE_NOT_CHRONOLOGICAL');
    if (validTimes) previousTestEnd = times[3];
    const inSample = calculateTradeMetrics(fold.inSample);
    const outOfSample = calculateTradeMetrics(fold.outOfSample);
    if (!tradesChronologicalWithin(fold.inSample, fold.trainStart, fold.trainEnd)) blockers.push('WFA_IN_SAMPLE_TRADES_NOT_CHRONOLOGICAL_OR_TIMESTAMPED');
    if (!tradesChronologicalWithin(fold.outOfSample, fold.testStart, fold.testEnd)) blockers.push('WFA_OOS_TRADES_NOT_CHRONOLOGICAL_OR_TIMESTAMPED');
    if (!inSample || !outOfSample) blockers.push('WFA_FOLD_HAS_INVALID_OR_EMPTY_TRADES');
    if (outOfSample && outOfSample.trades < QUANT_CORE_RESEARCH_OBJECTIVES.minimumOutOfSampleTradesPerFold) blockers.push('WFA_FOLD_HAS_FEWER_THAN_THIRTY_OOS_TRADES');
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

export type ResearchObjectiveEvidence = {
  walkForwardEligible: boolean;
  untouchedOutOfSample: boolean;
  allTradesPassedQualityFilter: boolean;
  costStressApplied: boolean;
  stressedExpectancyR: number | null;
  maxDrawdownPct: number | null;
  approvedMaxDrawdownPct: number | null;
};

/**
 * A deployment gate, not a strategy optimiser. It evaluates only supplied,
 * actual closed-trade OOS outcomes and refuses to infer missing evidence.
 */
export function evaluateResearchObjectives(
  outOfSampleTrades: NetTrade[],
  evidence: ResearchObjectiveEvidence,
): {
  status: 'NOT_VALIDATED' | 'INSUFFICIENT_EVIDENCE' | 'REJECTED' | 'VALIDATED';
  eligible: boolean;
  blockers: string[];
  objectives: typeof QUANT_CORE_RESEARCH_OBJECTIVES;
  metrics: TradeMetrics | null;
  winRateTarget: 'INSUFFICIENT_SAMPLE' | 'BELOW_TARGET' | 'PROVISIONAL' | 'CONFIRMED' | 'ABOVE_TARGET_BAND';
} {
  const blockers: string[] = [];
  const metrics = calculateTradeMetrics(outOfSampleTrades);
  if (!metrics) blockers.push('OOS_TRADE_OUTCOMES_MISSING_OR_INVALID');
  if (outOfSampleTrades.length < QUANT_CORE_RESEARCH_OBJECTIVES.minimumOutOfSampleTrades) blockers.push('OOS_SAMPLE_BELOW_300_TRADES');
  let previous = Number.NEGATIVE_INFINITY;
  for (const trade of outOfSampleTrades) {
    const closed = trade.closedAt ? timestamp(trade.closedAt) : null;
    if (closed === null || closed < previous) { blockers.push('OOS_TRADES_MUST_HAVE_CHRONOLOGICAL_UTC_CLOSE_TIMESTAMPS'); break; }
    previous = closed;
  }
  if (!evidence.walkForwardEligible) blockers.push('WALK_FORWARD_VALIDATION_NOT_PASSED');
  if (!evidence.untouchedOutOfSample) blockers.push('OUT_OF_SAMPLE_NOT_UNTOUCHED');
  if (!evidence.allTradesPassedQualityFilter) blockers.push('LOW_QUALITY_OR_UNFILTERED_TRADES_PRESENT');
  if (!evidence.costStressApplied) blockers.push('EXECUTION_COST_STRESS_NOT_APPLIED');
  if (evidence.stressedExpectancyR === null || !Number.isFinite(evidence.stressedExpectancyR) || evidence.stressedExpectancyR <= 0) blockers.push('STRESSED_NET_EXPECTANCY_NOT_POSITIVE');
  if (evidence.maxDrawdownPct === null || !Number.isFinite(evidence.maxDrawdownPct) || evidence.maxDrawdownPct < 0) blockers.push('REALIZED_DRAWDOWN_EVIDENCE_MISSING');
  if (evidence.approvedMaxDrawdownPct === null || !Number.isFinite(evidence.approvedMaxDrawdownPct) || evidence.approvedMaxDrawdownPct <= 0) blockers.push('OWNER_APPROVED_DRAWDOWN_LIMIT_MISSING');
  else if (evidence.maxDrawdownPct !== null && Number.isFinite(evidence.maxDrawdownPct)
    && evidence.maxDrawdownPct > evidence.approvedMaxDrawdownPct) blockers.push('DRAWDOWN_EXCEEDS_APPROVED_LIMIT');
  if (metrics && metrics.expectancyR <= 0) blockers.push('OOS_NET_EXPECTANCY_NOT_POSITIVE');
  if (metrics && metrics.winRate < QUANT_CORE_RESEARCH_OBJECTIVES.winRateTargetMin) blockers.push('OBSERVED_WIN_RATE_BELOW_60_PERCENT');
  else if (metrics && metrics.winRateWilson95.lower < QUANT_CORE_RESEARCH_OBJECTIVES.winRateTargetMin) blockers.push('WIN_RATE_TARGET_NOT_STATISTICALLY_CONFIRMED');
  if (metrics && (metrics.realizedRewardRisk === null
    || metrics.realizedRewardRisk < QUANT_CORE_RESEARCH_OBJECTIVES.plannedRewardRisk)) blockers.push('REALIZED_NET_REWARD_RISK_BELOW_1_TO_2');

  const winRateTarget = !metrics || metrics.trades < QUANT_CORE_RESEARCH_OBJECTIVES.minimumOutOfSampleTrades
    ? 'INSUFFICIENT_SAMPLE'
    : metrics.winRate < QUANT_CORE_RESEARCH_OBJECTIVES.winRateTargetMin ? 'BELOW_TARGET'
      : metrics.winRate > QUANT_CORE_RESEARCH_OBJECTIVES.winRateTargetMax ? 'ABOVE_TARGET_BAND'
        : metrics.winRateWilson95.lower >= QUANT_CORE_RESEARCH_OBJECTIVES.winRateTargetMin ? 'CONFIRMED' : 'PROVISIONAL';
  const eligible = blockers.length === 0;
  const evidenceMissing = blockers.some((blocker) => blocker.includes('MISSING') || blocker.includes('NOT_PASSED')
    || blocker.includes('NOT_UNTOUCHED') || blocker.includes('NOT_APPLIED') || blocker.includes('BELOW_300')
    || blocker.includes('TIMESTAMPS') || blocker.includes('INVALID') || blocker.includes('UTC')
    || blocker.includes('NOT_STATISTICALLY_CONFIRMED'));
  const status = eligible ? 'VALIDATED' : evidenceMissing ? 'NOT_VALIDATED'
    : blockers.some((blocker) => blocker.includes('BELOW') || blocker.includes('NOT_POSITIVE') || blocker.includes('EXCEEDS'))
      ? 'REJECTED' : 'INSUFFICIENT_EVIDENCE';
  return { status, eligible, blockers: [...new Set(blockers)], objectives: QUANT_CORE_RESEARCH_OBJECTIVES, metrics, winRateTarget };
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
    || !Number.isFinite(startingEquityR) || startingEquityR <= 0
    || !Number.isFinite(ruinDrawdownPct) || ruinDrawdownPct <= 0 || ruinDrawdownPct >= 100) return null;
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


/**
 * Circular moving-block bootstrap. Contiguous observed trade outcomes are
 * resampled together to retain short-run clustering better than IID draws.
 */
export function monteCarloBlockBootstrap(
  trades: NetTrade[],
  options: {
    iterations?: number;
    horizon?: number;
    seed?: number;
    blockLength?: number;
    startingEquityR?: number;
    ruinDrawdownPct?: number;
  } = {},
): {
  method: 'CIRCULAR_MOVING_BLOCK';
  iterations: number;
  seed: number;
  horizon: number;
  blockLength: number;
  endingEquityR: { p05: number; p50: number; p95: number };
  maxDrawdownPct: { p50: number; p95: number; p99: number };
  ruinProbability: number;
} | null {
  const iterations = options.iterations ?? 5000;
  const horizon = options.horizon ?? trades.length;
  const seed = options.seed ?? 20261128;
  const blockLength = options.blockLength ?? Math.max(1, Math.floor(Math.sqrt(trades.length)));
  const startingEquityR = options.startingEquityR ?? 100;
  const ruinDrawdownPct = options.ruinDrawdownPct ?? 50;
  if (!trades.length || trades.some((trade) => !Number.isFinite(trade.netR))
    || !Number.isSafeInteger(iterations) || iterations < 100 || iterations > 100_000
    || !Number.isSafeInteger(horizon) || horizon < 1 || horizon > 100_000
    || !Number.isSafeInteger(seed)
    || !Number.isSafeInteger(blockLength) || blockLength < 1 || blockLength > trades.length
    || !Number.isFinite(startingEquityR) || startingEquityR <= 0
    || !Number.isFinite(ruinDrawdownPct) || ruinDrawdownPct <= 0 || ruinDrawdownPct >= 100) return null;

  const random = mulberry32(seed);
  const endings: number[] = [], drawdowns: number[] = [];
  let ruined = 0;
  for (let path = 0; path < iterations; path += 1) {
    let equity = startingEquityR, peak = startingEquityR, maxDd = 0, step = 0;
    while (step < horizon) {
      const blockStart = Math.floor(random() * trades.length);
      for (let offset = 0; offset < blockLength && step < horizon; offset += 1) {
        const trade = trades[(blockStart + offset) % trades.length];
        equity = Math.max(0, equity + trade.netR);
        peak = Math.max(peak, equity);
        const drawdown = peak > 0 ? ((peak - equity) / peak) * 100 : 100;
        maxDd = Math.max(maxDd, drawdown);
        step += 1;
      }
    }
    endings.push(equity);
    drawdowns.push(maxDd);
    if (maxDd >= ruinDrawdownPct) ruined += 1;
  }
  return {
    method: 'CIRCULAR_MOVING_BLOCK',
    iterations,
    seed,
    horizon,
    blockLength,
    endingEquityR: { p05: percentile(endings, 0.05), p50: percentile(endings, 0.5), p95: percentile(endings, 0.95) },
    maxDrawdownPct: { p50: percentile(drawdowns, 0.5), p95: percentile(drawdowns, 0.95), p99: percentile(drawdowns, 0.99) },
    ruinProbability: ruined / iterations,
  };
}
