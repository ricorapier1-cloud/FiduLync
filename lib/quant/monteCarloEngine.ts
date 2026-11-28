export type TradeInput = {
  ticket: string | number;
  openTime?: string;
  closeTime?: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  volume: number;
  openPrice?: number;
  closePrice?: number;
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
  profitFactor: number | null;
  netProfit: number;
  maxDrawdownPct: number;
  expectancyR: number | null;
};

export type WalkForwardAnalysis = {
  totalTrades: number;
  inSampleTrades: number;
  outOfSampleTrades: number;
  inSample: WalkForwardMetrics;
  outOfSample: WalkForwardMetrics;
  walkForwardEfficiencyPct: number | null;
  status: 'ROBUST_EDGE' | 'MODERATE_DEGRADATION' | 'OVERFITTED_FAILURE' | 'INSUFFICIENT_SAMPLE';
};

export type MonteCarloSimulationResult = {
  totalRuns: number;
  ninetyFifthPercentileDrawdownPct: number;
  medianDrawdownPct: number;
  worstCaseDrawdownPct: number;
  probabilityOfRuinPct: number;
  sovereignShieldSurvivalRatePct: number;
  stressParameters: { randomOrderShuffling: true };
};

const netPnl = (trade: TradeInput) =>
  trade.profit + (trade.commission ?? 0) + (trade.swap ?? 0) + (trade.fee ?? 0);

function calculateMetrics(trades: TradeInput[], initialBalance: number): WalkForwardMetrics {
  if (!Number.isFinite(initialBalance) || initialBalance <= 0) {
    throw new Error('A verified positive starting balance is required for drawdown calculations.');
  }
  if (trades.length === 0) {
    return { tradesCount: 0, winRatePct: 0, profitFactor: 0, netProfit: 0, maxDrawdownPct: 0, expectancyR: null };
  }
  let grossWins = 0;
  let grossLosses = 0;
  let winsCount = 0;
  let runningEquity = initialBalance;
  let peakEquity = initialBalance;
  let maxDd = 0;
  let rTotal = 0;
  let rCount = 0;

  for (const trade of trades) {
    const net = netPnl(trade);
    if (net > 0) { grossWins += net; winsCount++; }
    else if (net < 0) grossLosses += Math.abs(net);
    runningEquity += net;
    if (runningEquity > peakEquity) peakEquity = runningEquity;
    const drawdown = peakEquity > 0 ? ((peakEquity - runningEquity) / peakEquity) * 100 : 0;
    maxDd = Math.max(maxDd, drawdown);
    if (typeof trade.rMultiple === 'number' && Number.isFinite(trade.rMultiple)) {
      rTotal += trade.rMultiple;
      rCount++;
    }
  }

  return {
    tradesCount: trades.length,
    winRatePct: Number(((winsCount / trades.length) * 100).toFixed(1)),
    profitFactor: grossLosses > 0 ? Number((grossWins / grossLosses).toFixed(2)) : null,
    netProfit: Number((runningEquity - initialBalance).toFixed(2)),
    maxDrawdownPct: Number(maxDd.toFixed(2)),
    expectancyR: rCount === trades.length ? Number((rTotal / trades.length).toFixed(2)) : null,
  };
}

export function runWalkForwardAnalysis(
  trades: TradeInput[],
  initialBalance: number,
  inSampleRatio = 0.7,
): WalkForwardAnalysis {
  const zeroMetrics: WalkForwardMetrics = {
    tradesCount: 0, winRatePct: 0, profitFactor: 0, netProfit: 0, maxDrawdownPct: 0, expectancyR: null,
  };
  if (!Number.isFinite(initialBalance) || initialBalance <= 0 || trades.length < 5) {
    return {
      totalTrades: trades.length, inSampleTrades: 0, outOfSampleTrades: 0,
      inSample: zeroMetrics, outOfSample: zeroMetrics, walkForwardEfficiencyPct: 0,
      status: 'INSUFFICIENT_SAMPLE',
    };
  }

  const splitIndex = Math.floor(trades.length * inSampleRatio);
  const inSampleTrades = trades.slice(0, splitIndex);
  const outOfSampleTrades = trades.slice(splitIndex);
  const inSample = calculateMetrics(inSampleTrades, initialBalance);
  const outOfSample = calculateMetrics(outOfSampleTrades, initialBalance);
  let wfe: number | null = null;
  if (inSample.expectancyR !== null && inSample.expectancyR > 0 && outOfSample.expectancyR !== null) {
    wfe = Number(((outOfSample.expectancyR / inSample.expectancyR) * 100).toFixed(1));
  } else if (inSample.profitFactor !== null && outOfSample.profitFactor !== null && inSample.profitFactor > 1.0) {
    wfe = Number(((outOfSample.profitFactor / inSample.profitFactor) * 100).toFixed(1));
  }

  let status: WalkForwardAnalysis['status'] = 'INSUFFICIENT_SAMPLE';
  if (trades.length >= 20 && wfe !== null && outOfSample.profitFactor !== null) {
    status = wfe >= 60 && outOfSample.profitFactor >= 1.2
      ? 'ROBUST_EDGE'
      : wfe >= 30 && outOfSample.profitFactor >= 1.0
        ? 'MODERATE_DEGRADATION'
        : 'OVERFITTED_FAILURE';
  }
  return {
    totalTrades: trades.length, inSampleTrades: inSampleTrades.length, outOfSampleTrades: outOfSampleTrades.length,
    inSample, outOfSample, walkForwardEfficiencyPct: wfe === null ? null : Math.max(0, wfe), status,
  };
}

export function runMonteCarloStressSimulation(
  trades: TradeInput[],
  initialBalance: number,
  iterations = 1000,
): MonteCarloSimulationResult {
  if (!Number.isFinite(initialBalance) || initialBalance <= 0) {
    throw new Error('A verified positive starting balance is required for Monte Carlo drawdown calculations.');
  }
  if (!Number.isInteger(iterations) || iterations < 1) throw new Error('Iterations must be a positive integer.');
  if (trades.length === 0) {
    return {
      totalRuns: 0, ninetyFifthPercentileDrawdownPct: 0, medianDrawdownPct: 0,
      worstCaseDrawdownPct: 0, probabilityOfRuinPct: 0, sovereignShieldSurvivalRatePct: 0,
      stressParameters: { randomOrderShuffling: true },
    };
  }

  const drawdowns: number[] = [];
  let ruinCount = 0;
  let survivalCount = 0;
  for (let run = 0; run < iterations; run++) {
    let equity = initialBalance;
    let peak = initialBalance;
    let maxDrawdown = 0;
    let breachedShieldFloor = false;
    for (let i = 0; i < trades.length; i++) {
      const trade = trades[Math.floor(Math.random() * trades.length)];
      equity += netPnl(trade);
      peak = Math.max(peak, equity);
      const drawdown = peak > 0 ? ((peak - equity) / peak) * 100 : 100;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
      if (drawdown >= 10) breachedShieldFloor = true;
    }
    drawdowns.push(maxDrawdown);
    if (maxDrawdown >= 20) ruinCount++;
    if (!breachedShieldFloor) survivalCount++;
  }
  drawdowns.sort((a, b) => a - b);
  const p95 = drawdowns[Math.min(drawdowns.length - 1, Math.floor(iterations * 0.95))] ?? 0;
  const median = drawdowns[Math.floor(drawdowns.length * 0.5)] ?? 0;
  return {
    totalRuns: iterations,
    ninetyFifthPercentileDrawdownPct: Number(p95.toFixed(2)),
    medianDrawdownPct: Number(median.toFixed(2)),
    worstCaseDrawdownPct: Number((drawdowns[drawdowns.length - 1] ?? 0).toFixed(2)),
    probabilityOfRuinPct: Number(((ruinCount / iterations) * 100).toFixed(1)),
    sovereignShieldSurvivalRatePct: Number(((survivalCount / iterations) * 100).toFixed(1)),
    stressParameters: { randomOrderShuffling: true },
  };
}

export function parseMt5ReportCsv(csvText: string): TradeInput[] {
  const lines = csvText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const delimiter = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
  const parseRow = (line: string) => line.split(delimiter).map((cell) => cell.replace(/^["']|["']$/g, '').trim());
  const headers = parseRow(lines[0]).map((header) => header.toLowerCase().replace(/[_-]+/g, ' '));
  const indexOf = (pattern: RegExp) => headers.findIndex((header) => pattern.test(header));
  const ticketIndex = indexOf(/ticket|deal|order/);
  const symbolIndex = indexOf(/symbol|instrument/);
  const directionIndex = indexOf(/type|direction|side/);
  const volumeIndex = indexOf(/volume|lots?|size/);
  const profitIndex = indexOf(/^profit$|net profit|p\/l|profit/);
  const commissionIndex = indexOf(/commission/);
  const swapIndex = indexOf(/swap/);
  const feeIndex = indexOf(/^fee$|fees/);
  const rIndex = indexOf(/^r$|r multiple|rmultiple|r units/);
  if ([ticketIndex, symbolIndex, directionIndex, volumeIndex, profitIndex].some((index) => index < 0)) return [];

  const trades: TradeInput[] = [];
  for (const line of lines.slice(1)) {
    const cols = parseRow(line);
    const ticket = cols[ticketIndex];
    const symbol = (cols[symbolIndex] ?? '').toUpperCase();
    const side = (cols[directionIndex] ?? '').toLowerCase();
    const volume = Number(cols[volumeIndex]);
    const profit = Number(cols[profitIndex]);
    if (!ticket || !/^(EURUSD|USDJPY|XAUUSD|GBPUSD|AUDUSD|USDCAD|USDCHF|NZDUSD)$/i.test(symbol)
      || (!side.includes('buy') && !side.includes('sell'))
      || !Number.isFinite(volume) || volume <= 0 || !Number.isFinite(profit)) continue;
    const optionalNumber = (index: number) => index >= 0 && Number.isFinite(Number(cols[index])) ? Number(cols[index]) : undefined;
    trades.push({
      ticket, symbol, direction: side.includes('buy') ? 'BUY' : 'SELL', volume, profit,
      commission: optionalNumber(commissionIndex), swap: optionalNumber(swapIndex), fee: optionalNumber(feeIndex),
      rMultiple: optionalNumber(rIndex),
    });
  }
  return trades;
}
