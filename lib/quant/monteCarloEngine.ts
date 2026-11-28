import { RESEARCH_OBJECTIVES } from '@/lib/quant/researchObjectives';

export type TradeInput = {
  ticket: string | number;
  openTime?: string;
  closeTime?: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  volume: number;
  openPrice?: number;
  closePrice?: number;
  initialStopLoss?: number;
  profit: number;
  commission?: number;
  swap?: number;
  fee?: number;
  slippagePips?: number;
  rMultiple?: number;
  ruleAdhered?: boolean;
};

export type WalkForwardMetrics = {
  tradesCount: number;
  winRatePct: number;
  winRateWilson95LowerPct: number | null;
  profitFactor: number | null;
  averageWin: number | null;
  averageLoss: number | null;
  averagePayoffRatio: number | null;
  realizedRewardRisk: number | null;
  netProfit: number;
  maxDrawdownPct: number;
  expectancyR: number | null;
};

export type WalkForwardFold = {
  fold: number;
  trainingTrades: number;
  outOfSampleTrades: number;
  training: WalkForwardMetrics;
  outOfSample: WalkForwardMetrics;
  efficiencyPct: number | null;
};

export type WalkForwardAnalysis = {
  totalTrades: number;
  inSampleTrades: number;
  outOfSampleTrades: number;
  foldCount: number;
  minimumOutOfSampleTrades: number;
  minimumWalkForwardFolds: number;
  chronologicalDataVerified: boolean;
  inSample: WalkForwardMetrics;
  outOfSample: WalkForwardMetrics;
  walkForwardEfficiencyPct: number | null;
  targetWinRateBand: 'BELOW_TARGET' | 'WITHIN_TARGET' | 'ABOVE_TARGET' | 'UNAVAILABLE';
  targetRewardRiskMet: boolean;
  status: 'ROBUST_CANDIDATE' | 'MODERATE_DEGRADATION' | 'OVERFITTED_FAILURE' | 'INSUFFICIENT_SAMPLE';
  folds: WalkForwardFold[];
};

export type MonteCarloSimulationResult = {
  totalRuns: number;
  ninetyFifthPercentileDrawdownPct: number;
  medianDrawdownPct: number;
  worstCaseDrawdownPct: number;
  stressParameters: {
    bootstrapMethod: 'CIRCULAR_BLOCK';
    blockLength: number;
    deterministicSeed: string;
  };
};

const netPnl = (trade: TradeInput) =>
  trade.profit + (trade.commission ?? 0) + (trade.swap ?? 0) + (trade.fee ?? 0);

const ZERO_METRICS: WalkForwardMetrics = {
  tradesCount: 0,
  winRatePct: 0,
  winRateWilson95LowerPct: null,
  profitFactor: null,
  averageWin: null,
  averageLoss: null,
  averagePayoffRatio: null,
  realizedRewardRisk: null,
  netProfit: 0,
  maxDrawdownPct: 0,
  expectancyR: null,
};

function hasChronologicalTimestamp(trade: TradeInput): boolean {
  const value = trade.closeTime?.trim();
  if (!value) return false;
  return /^\d{4}[.-]\d{2}[.-]\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(value)
    || Number.isFinite(Date.parse(value));
}

function wilsonLowerBound(wins: number, total: number): number | null {
  if (total <= 0) return null;
  const z = 1.959963984540054;
  const p = wins / total;
  const z2 = z * z;
  const denominator = 1 + z2 / total;
  const center = p + z2 / (2 * total);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total);
  return Number((Math.max(0, (center - margin) / denominator) * 100).toFixed(2));
}

function calculateMetrics(trades: TradeInput[], initialBalance: number): WalkForwardMetrics {
  if (!Number.isFinite(initialBalance) || initialBalance <= 0) {
    throw new Error('A positive starting balance from the broker statement or an explicitly user-attested input is required.');
  }
  if (trades.length === 0) return ZERO_METRICS;

  let grossWins = 0;
  let grossLosses = 0;
  let winsCount = 0;
  let lossesCount = 0;
  let runningEquity = initialBalance;
  let peakEquity = initialBalance;
  let maxDd = 0;
  let rTotal = 0;
  let rCount = 0;
  let rWinsTotal = 0;
  let rLossesTotal = 0;
  let rWinsCount = 0;
  let rLossesCount = 0;

  for (const trade of trades) {
    const net = netPnl(trade);
    if (net > 0) { grossWins += net; winsCount++; }
    else if (net < 0) { grossLosses += Math.abs(net); lossesCount++; }
    runningEquity += net;
    if (runningEquity > peakEquity) peakEquity = runningEquity;
    const drawdown = peakEquity > 0 ? ((peakEquity - runningEquity) / peakEquity) * 100 : 0;
    maxDd = Math.max(maxDd, drawdown);
    if (typeof trade.rMultiple === 'number' && Number.isFinite(trade.rMultiple)) {
      rTotal += trade.rMultiple;
      rCount++;
      if (trade.rMultiple > 0) { rWinsTotal += trade.rMultiple; rWinsCount++; }
      else if (trade.rMultiple < 0) { rLossesTotal += Math.abs(trade.rMultiple); rLossesCount++; }
    }
  }

  const averageWin = winsCount ? grossWins / winsCount : null;
  const averageLoss = lossesCount ? grossLosses / lossesCount : null;
  return {
    tradesCount: trades.length,
    winRatePct: Number(((winsCount / trades.length) * 100).toFixed(2)),
    winRateWilson95LowerPct: wilsonLowerBound(winsCount, trades.length),
    profitFactor: grossLosses > 0 ? Number((grossWins / grossLosses).toFixed(3)) : null,
    averageWin: averageWin === null ? null : Number(averageWin.toFixed(4)),
    averageLoss: averageLoss === null ? null : Number(averageLoss.toFixed(4)),
    averagePayoffRatio: averageWin !== null && averageLoss !== null && averageLoss > 0
      ? Number((averageWin / averageLoss).toFixed(3)) : null,
    realizedRewardRisk: rCount === trades.length && rWinsCount > 0 && rLossesCount > 0
      ? Number(((rWinsTotal / rWinsCount) / (rLossesTotal / rLossesCount)).toFixed(3)) : null,
    netProfit: Number((runningEquity - initialBalance).toFixed(2)),
    maxDrawdownPct: Number(maxDd.toFixed(3)),
    expectancyR: rCount === trades.length ? Number((rTotal / trades.length).toFixed(4)) : null,
  };
}

function efficiency(training: WalkForwardMetrics, outOfSample: WalkForwardMetrics): number | null {
  if (training.expectancyR !== null && training.expectancyR > 0 && outOfSample.expectancyR !== null) {
    return Number(((outOfSample.expectancyR / training.expectancyR) * 100).toFixed(2));
  }
  if (training.profitFactor !== null && training.profitFactor > 1 && outOfSample.profitFactor !== null) {
    return Number(((outOfSample.profitFactor / training.profitFactor) * 100).toFixed(2));
  }
  return null;
}

export function runWalkForwardAnalysis(
  trades: TradeInput[],
  initialBalance: number,
): WalkForwardAnalysis {
  const minimumOutOfSampleTrades = RESEARCH_OBJECTIVES.minimumOutOfSampleTrades;
  const minimumWalkForwardFolds = RESEARCH_OBJECTIVES.minimumWalkForwardFolds;
  const ordered = [...trades].sort((a, b) => (a.closeTime ?? '').localeCompare(b.closeTime ?? ''));
  const chronologicalDataVerified = ordered.length === trades.length && ordered.every(hasChronologicalTimestamp);
  const insufficient = (): WalkForwardAnalysis => ({
    totalTrades: trades.length,
    inSampleTrades: 0,
    outOfSampleTrades: 0,
    foldCount: 0,
    minimumOutOfSampleTrades,
    minimumWalkForwardFolds,
    chronologicalDataVerified,
    inSample: ZERO_METRICS,
    outOfSample: ZERO_METRICS,
    walkForwardEfficiencyPct: null,
    targetWinRateBand: 'UNAVAILABLE',
    targetRewardRiskMet: false,
    status: 'INSUFFICIENT_SAMPLE',
    folds: [],
  });

  if (!Number.isFinite(initialBalance) || initialBalance <= 0 || !chronologicalDataVerified) return insufficient();

  const initialTrainingRatio = 0.55;
  const outOfSampleFoldRatio = 0.15;
  const initialTrainingCount = Math.floor(ordered.length * initialTrainingRatio);
  const foldSize = Math.floor(ordered.length * outOfSampleFoldRatio);
  if (foldSize < 1 || initialTrainingCount < 1) return insufficient();

  const folds: WalkForwardFold[] = [];
  const outOfSampleTrades: TradeInput[] = [];
  for (let fold = 0; fold < minimumWalkForwardFolds; fold++) {
    const trainingEnd = initialTrainingCount + (fold * foldSize);
    const outEnd = fold === minimumWalkForwardFolds - 1
      ? ordered.length
      : Math.min(ordered.length, trainingEnd + foldSize);
    const trainingTrades = ordered.slice(0, trainingEnd);
    const testTrades = ordered.slice(trainingEnd, outEnd);
    if (trainingTrades.length === 0 || testTrades.length === 0) return insufficient();
    const training = calculateMetrics(trainingTrades, initialBalance);
    const outOfSample = calculateMetrics(testTrades, initialBalance);
    folds.push({
      fold: fold + 1,
      trainingTrades: trainingTrades.length,
      outOfSampleTrades: testTrades.length,
      training,
      outOfSample,
      efficiencyPct: efficiency(training, outOfSample),
    });
    outOfSampleTrades.push(...testTrades);
  }

  const inSample = calculateMetrics(ordered.slice(0, initialTrainingCount), initialBalance);
  const outOfSample = calculateMetrics(outOfSampleTrades, initialBalance);
  const validEfficiency = folds.map((fold) => fold.efficiencyPct).filter((value): value is number => value !== null);
  const walkForwardEfficiencyPct = validEfficiency.length
    ? Number((validEfficiency.reduce((sum, value) => sum + value, 0) / validEfficiency.length).toFixed(2))
    : null;
  const targetWinRateBand = outOfSample.winRatePct < RESEARCH_OBJECTIVES.targetWinRateMin * 100
    ? 'BELOW_TARGET'
    : outOfSample.winRatePct <= RESEARCH_OBJECTIVES.targetWinRateMax * 100 ? 'WITHIN_TARGET' : 'ABOVE_TARGET';
  const targetRewardRiskMet = outOfSample.realizedRewardRisk !== null
    && outOfSample.realizedRewardRisk >= RESEARCH_OBJECTIVES.plannedRewardRisk;
  const adequate = outOfSample.tradesCount >= minimumOutOfSampleTrades
    && folds.length >= minimumWalkForwardFolds
    && folds.every((fold) => fold.outOfSampleTrades > 0);
  const everyFoldPositive = folds.every((fold) => fold.outOfSample.profitFactor !== null
    && fold.outOfSample.profitFactor >= 1);
  let status: WalkForwardAnalysis['status'] = 'INSUFFICIENT_SAMPLE';
  if (adequate) {
    if (outOfSample.profitFactor !== null && outOfSample.profitFactor < 1) status = 'OVERFITTED_FAILURE';
    else if (walkForwardEfficiencyPct !== null && walkForwardEfficiencyPct >= 60
      && outOfSample.profitFactor !== null && outOfSample.profitFactor >= 1.2
      && outOfSample.winRateWilson95LowerPct !== null
      && outOfSample.winRateWilson95LowerPct >= RESEARCH_OBJECTIVES.targetWinRateMin * 100
      && outOfSample.expectancyR !== null && targetRewardRiskMet && everyFoldPositive) status = 'ROBUST_CANDIDATE';
    else status = 'MODERATE_DEGRADATION';
  }

  return {
    totalTrades: trades.length,
    inSampleTrades: initialTrainingCount,
    outOfSampleTrades: outOfSample.tradesCount,
    foldCount: folds.length,
    minimumOutOfSampleTrades,
    minimumWalkForwardFolds,
    chronologicalDataVerified,
    inSample,
    outOfSample,
    walkForwardEfficiencyPct,
    targetWinRateBand,
    targetRewardRiskMet,
    status,
    folds,
  };
}

function stableSeed(trades: TradeInput[], initialBalance: number, iterations: number): number {
  const source = [
    initialBalance.toFixed(6),
    String(iterations),
    ...trades.map((trade) => [
      String(trade.ticket), trade.closeTime ?? '', trade.symbol, netPnl(trade).toFixed(6),
    ].join('|')),
  ].join('~');
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function runMonteCarloStressSimulation(
  trades: TradeInput[],
  initialBalance: number,
  iterations = 1000,
): MonteCarloSimulationResult {
  if (!Number.isFinite(initialBalance) || initialBalance <= 0) {
    throw new Error('A positive starting balance from the broker statement or an explicitly user-attested input is required.');
  }
  if (!Number.isInteger(iterations) || iterations < 1) throw new Error('Iterations must be a positive integer.');
  if (trades.length < 30) throw new Error('At least 30 closed trades are required for block-bootstrap stress analysis.');
  const seed = stableSeed(trades, initialBalance, iterations);
  const random = mulberry32(seed);
  const blockLength = Math.max(2, Math.min(10, Math.floor(Math.sqrt(trades.length))));
  const drawdowns: number[] = [];

  for (let run = 0; run < iterations; run++) {
    let equity = initialBalance;
    let peak = initialBalance;
    let maxDrawdown = 0;
    let sampled = 0;
    while (sampled < trades.length) {
      const blockStart = Math.floor(random() * trades.length);
      const blockCount = Math.min(blockLength, trades.length - sampled);
      for (let offset = 0; offset < blockCount; offset++) {
        const trade = trades[(blockStart + offset) % trades.length];
        equity += netPnl(trade);
        peak = Math.max(peak, equity);
        const drawdown = peak > 0 ? ((peak - equity) / peak) * 100 : 100;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      }
      sampled += blockCount;
    }
    drawdowns.push(maxDrawdown);
  }

  drawdowns.sort((a, b) => a - b);
  const p95 = drawdowns[Math.min(drawdowns.length - 1, Math.ceil(iterations * 0.95) - 1)] ?? 0;
  const median = drawdowns[Math.floor((drawdowns.length - 1) * 0.5)] ?? 0;
  return {
    totalRuns: iterations,
    ninetyFifthPercentileDrawdownPct: Number(p95.toFixed(3)),
    medianDrawdownPct: Number(median.toFixed(3)),
    worstCaseDrawdownPct: Number((drawdowns[drawdowns.length - 1] ?? 0).toFixed(3)),
    stressParameters: {
      bootstrapMethod: 'CIRCULAR_BLOCK',
      blockLength,
      deterministicSeed: '0x' + seed.toString(16).padStart(8, '0'),
    },
  };
}

function parseDelimitedRow(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      cells.push(value.trim());
      value = '';
    } else value += char;
  }
  cells.push(value.trim());
  return cells;
}

function parseLocalizedNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  let normalized = value.replace(/[^0-9, .+\-eE]/g, '').replace(/\s/g, '');
  if (!normalized) return undefined;
  const lastComma = normalized.lastIndexOf(',');
  const lastDot = normalized.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    normalized = lastComma > lastDot
      ? normalized.replace(/\./g, '').replace(',', '.')
      : normalized.replace(/,/g, '');
  } else if (lastComma >= 0) normalized = normalized.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseMt5ReportCsv(csvText: string): TradeInput[] {
  const lines = csvText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const delimiter = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
  const headers = parseDelimitedRow(lines[0], delimiter).map((header) => header.toLowerCase().replace(/[_-]+/g, ' '));
  const indexOf = (pattern: RegExp) => headers.findIndex((header) => pattern.test(header));
  const ticketIndex = indexOf(/ticket|deal|order|position/);
  const symbolIndex = indexOf(/symbol|instrument/);
  const directionIndex = indexOf(/type|direction|side/);
  const volumeIndex = indexOf(/volume|lots?|size/);
  const profitIndex = indexOf(/^profit$|net profit|p\/l|profit/);
  const commissionIndex = indexOf(/commission/);
  const swapIndex = indexOf(/swap/);
  const feeIndex = indexOf(/^fee$|fees/);
  const rIndex = indexOf(/^r$|r multiple|rmultiple|r units/);
  const openTimeIndex = indexOf(/open time|open date/);
  const closeTimeIndex = indexOf(/close time|close date|^time$|^date$/);
  const openPriceIndex = indexOf(/open price|price open/);
  const closePriceIndex = indexOf(/close price|price close/);
  const initialStopLossIndex = indexOf(/initial stop loss|initial sl|sl at entry|stop loss at entry/);
  if ([ticketIndex, symbolIndex, directionIndex, volumeIndex, profitIndex].some((index) => index < 0)) return [];

  const trades: TradeInput[] = [];
  for (const line of lines.slice(1)) {
    const cols = parseDelimitedRow(line, delimiter);
    const ticket = cols[ticketIndex];
    const symbol = (cols[symbolIndex] ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const side = (cols[directionIndex] ?? '').toLowerCase();
    const volume = parseLocalizedNumber(cols[volumeIndex]);
    const profit = parseLocalizedNumber(cols[profitIndex]);
    if (!ticket || !/^[A-Z]{6}$/.test(symbol)
      || (!side.includes('buy') && !side.includes('sell'))
      || volume === undefined || volume <= 0 || profit === undefined) continue;
    const optionalNumber = (index: number) => index >= 0 ? parseLocalizedNumber(cols[index]) : undefined;
    const direction = side.includes('buy') ? 'BUY' : 'SELL';
    const openPrice = optionalNumber(openPriceIndex);
    const closePrice = optionalNumber(closePriceIndex);
    const initialStopLoss = optionalNumber(initialStopLossIndex);
    const riskDistance = openPrice !== undefined && initialStopLoss !== undefined
      ? Math.abs(openPrice - initialStopLoss) : 0;
    const rewardDistance = openPrice !== undefined && closePrice !== undefined
      ? (direction === 'BUY' ? closePrice - openPrice : openPrice - closePrice) : 0;
    const importedR = optionalNumber(rIndex);
    const rMultiple = importedR ?? (riskDistance > 0 ? rewardDistance / riskDistance : undefined);
    trades.push({
      ticket,
      symbol,
      direction,
      volume,
      profit,
      commission: optionalNumber(commissionIndex),
      swap: optionalNumber(swapIndex),
      fee: optionalNumber(feeIndex),
      rMultiple,
      openTime: openTimeIndex >= 0 ? cols[openTimeIndex] : undefined,
      closeTime: closeTimeIndex >= 0 ? cols[closeTimeIndex] : undefined,
      openPrice,
      closePrice,
      initialStopLoss,
    });
  }
  return trades.sort((a, b) => (a.closeTime ?? '').localeCompare(b.closeTime ?? ''));
}
