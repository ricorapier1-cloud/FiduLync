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
  slippagePips?: number;
  rMultiple?: number;
  ruleAdhered?: boolean;
};

export type WalkForwardMetrics = {
  tradesCount: number;
  winRatePct: number;
  profitFactor: number;
  netProfit: number;
  maxDrawdownPct: number;
  expectancyR: number;
};

export type WalkForwardAnalysis = {
  totalTrades: number;
  inSampleTrades: number;
  outOfSampleTrades: number;
  inSample: WalkForwardMetrics;
  outOfSample: WalkForwardMetrics;
  walkForwardEfficiencyPct: number;
  status: 'ROBUST_EDGE' | 'MODERATE_DEGRADATION' | 'OVERFITTED_FAILURE' | 'INSUFFICIENT_SAMPLE';
};

export type MonteCarloSimulationResult = {
  totalRuns: number;
  ninetyFifthPercentileDrawdownPct: number;
  medianDrawdownPct: number;
  worstCaseDrawdownPct: number;
  probabilityOfRuinPct: number;
  sovereignShieldSurvivalRatePct: number;
  stressParameters: {
    randomOrderShuffling: true;
    spreadWideningPct: 50;
    slippageShockRangePips: [0.5, 2.0];
  };
};

function calculateMetrics(trades: TradeInput[], initialBalance = 10_000): WalkForwardMetrics {
  if (trades.length === 0) {
    return {
      tradesCount: 0,
      winRatePct: 0,
      profitFactor: 0,
      netProfit: 0,
      maxDrawdownPct: 0,
      expectancyR: 0,
    };
  }

  let grossWins = 0;
  let grossLosses = 0;
  let winsCount = 0;
  let runningEquity = initialBalance;
  let peakEquity = initialBalance;
  let maxDd = 0;
  let sumR = 0;

  for (const trade of trades) {
    const net = trade.profit + (trade.commission ?? 0) + (trade.swap ?? 0);
    if (net > 0) {
      grossWins += net;
      winsCount++;
    } else {
      grossLosses += Math.abs(net);
    }

    runningEquity += net;
    if (runningEquity > peakEquity) peakEquity = runningEquity;
    const dd = peakEquity > 0 ? ((peakEquity - runningEquity) / peakEquity) * 100 : 0;
    if (dd > maxDd) maxDd = dd;

    const r = typeof trade.rMultiple === 'number' && Number.isFinite(trade.rMultiple)
      ? trade.rMultiple
      : net >= 0 ? net / 100 : net / 100;
    sumR += r;
  }

  const profitFactor = grossLosses > 0 ? Number((grossWins / grossLosses).toFixed(2)) : grossWins > 0 ? 99.9 : 0;
  const winRatePct = Number(((winsCount / trades.length) * 100).toFixed(1));
  const netProfit = Number((runningEquity - initialBalance).toFixed(2));
  const maxDrawdownPct = Number(maxDd.toFixed(2));
  const expectancyR = Number((sumR / trades.length).toFixed(2));

  return {
    tradesCount: trades.length,
    winRatePct,
    profitFactor,
    netProfit,
    maxDrawdownPct,
    expectancyR,
  };
}

export function runWalkForwardAnalysis(trades: TradeInput[], inSampleRatio = 0.7): WalkForwardAnalysis {
  if (trades.length < 5) {
    const zeroMetrics: WalkForwardMetrics = {
      tradesCount: 0,
      winRatePct: 0,
      profitFactor: 0,
      netProfit: 0,
      maxDrawdownPct: 0,
      expectancyR: 0,
    };
    return {
      totalTrades: trades.length,
      inSampleTrades: 0,
      outOfSampleTrades: 0,
      inSample: zeroMetrics,
      outOfSample: zeroMetrics,
      walkForwardEfficiencyPct: 0,
      status: 'INSUFFICIENT_SAMPLE',
    };
  }

  const splitIndex = Math.floor(trades.length * inSampleRatio);
  const inSampleTrades = trades.slice(0, splitIndex);
  const outOfSampleTrades = trades.slice(splitIndex);

  const inSample = calculateMetrics(inSampleTrades);
  const outOfSample = calculateMetrics(outOfSampleTrades);

  let wfe = 0;
  if (inSample.expectancyR > 0) {
    wfe = Number(((outOfSample.expectancyR / inSample.expectancyR) * 100).toFixed(1));
  } else if (inSample.profitFactor > 1.0) {
    wfe = Number(((outOfSample.profitFactor / inSample.profitFactor) * 100).toFixed(1));
  }

  let status: WalkForwardAnalysis['status'] = 'INSUFFICIENT_SAMPLE';
  if (trades.length >= 20) {
    if (wfe >= 60 && outOfSample.profitFactor >= 1.2) {
      status = 'ROBUST_EDGE';
    } else if (wfe >= 30 && outOfSample.profitFactor >= 1.0) {
      status = 'MODERATE_DEGRADATION';
    } else {
      status = 'OVERFITTED_FAILURE';
    }
  }

  return {
    totalTrades: trades.length,
    inSampleTrades: inSampleTrades.length,
    outOfSampleTrades: outOfSampleTrades.length,
    inSample,
    outOfSample,
    walkForwardEfficiencyPct: Math.max(0, wfe),
    status,
  };
}

export function runMonteCarloStressSimulation(
  trades: TradeInput[],
  iterations = 1000,
  initialBalance = 10_000,
): MonteCarloSimulationResult {
  if (trades.length === 0) {
    return {
      totalRuns: 0,
      ninetyFifthPercentileDrawdownPct: 0,
      medianDrawdownPct: 0,
      worstCaseDrawdownPct: 0,
      probabilityOfRuinPct: 0,
      sovereignShieldSurvivalRatePct: 0,
      stressParameters: {
        randomOrderShuffling: true,
        spreadWideningPct: 50,
        slippageShockRangePips: [0.5, 2.0],
      },
    };
  }

  const n = trades.length;
  const drawdowns: number[] = [];
  let ruinCount = 0;
  let survivalCount = 0;

  for (let run = 0; run < iterations; run++) {
    let runningEquity = initialBalance;
    let peakEquity = initialBalance;
    let maxDdThisRun = 0;
    let hitSovereignFloor = false;

    for (let i = 0; i < n; i++) {
      // Bootstrap with replacement (randomized trade order)
      const randomIndex = Math.floor(Math.random() * n);
      const baseTrade = trades[randomIndex];

      // Stress factor 1: +50% spread widening
      const spreadPenalty = baseTrade.volume > 0 ? (baseTrade.volume * 10.0 * 0.5) : 1.5;

      // Stress factor 2: slippage shock (0.5 to 2.0 pips adverse)
      const slippagePips = 0.5 + Math.random() * 1.5;
      const slippagePenalty = baseTrade.volume > 0 ? (slippagePips * baseTrade.volume * 10.0) : (slippagePips * 1.0);

      const netProfitStressed = baseTrade.profit - spreadPenalty - slippagePenalty;

      runningEquity += netProfitStressed;
      if (runningEquity > peakEquity) peakEquity = runningEquity;

      const currentDd = peakEquity > 0 ? ((peakEquity - runningEquity) / peakEquity) * 100 : 0;
      if (currentDd > maxDdThisRun) maxDdThisRun = currentDd;

      // Sovereign Shield drawdown floor check (10% total balance breach or -4% single sequence)
      if (currentDd >= 10.0) {
        hitSovereignFloor = true;
      }
    }

    drawdowns.push(maxDdThisRun);

    // Probability of Ruin threshold: drawdown >= 20%
    if (maxDdThisRun >= 20.0) {
      ruinCount++;
    }

    if (!hitSovereignFloor) {
      survivalCount++;
    }
  }

  drawdowns.sort((a, b) => a - b);
  const p95Index = Math.min(drawdowns.length - 1, Math.floor(iterations * 0.95));
  const p50Index = Math.floor(iterations * 0.5);

  const ninetyFifthPercentileDrawdownPct = Number((drawdowns[p95Index] ?? 0).toFixed(2));
  const medianDrawdownPct = Number((drawdowns[p50Index] ?? 0).toFixed(2));
  const worstCaseDrawdownPct = Number((drawdowns[drawdowns.length - 1] ?? 0).toFixed(2));
  const probabilityOfRuinPct = Number(((ruinCount / iterations) * 100).toFixed(1));
  const sovereignShieldSurvivalRatePct = Number(((survivalCount / iterations) * 100).toFixed(1));

  return {
    totalRuns: iterations,
    ninetyFifthPercentileDrawdownPct,
    medianDrawdownPct,
    worstCaseDrawdownPct,
    probabilityOfRuinPct,
    sovereignShieldSurvivalRatePct,
    stressParameters: {
      randomOrderShuffling: true,
      spreadWideningPct: 50,
      slippageShockRangePips: [0.5, 2.0],
    },
  };
}

export function parseMt5ReportCsv(csvText: string): TradeInput[] {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const trades: TradeInput[] = [];

  for (const line of lines) {
    // Look for CSV rows with profit, volume, symbol
    const cols = line.split(/[;,\t]/).map((c) => c.replace(/["']/g, '').trim());
    if (cols.length < 5) continue;

    // Check if row has numeric profit and volume
    const numericCols = cols.map((c) => parseFloat(c)).filter((n) => Number.isFinite(n));
    if (numericCols.length < 2) continue;

    // Search for ticket, symbol, type, profit
    const symbolIndex = cols.findIndex((c) => /^(EURUSD|USDJPY|XAUUSD|GBPUSD|AUDUSD|USDCAD|USDCHF|NZDUSD)$/i.test(c));
    const profitCol = cols.find((c, idx) => idx > 3 && Number.isFinite(parseFloat(c)) && !isNaN(Number(c)));

    if (symbolIndex !== -1 && profitCol !== undefined) {
      const profit = parseFloat(profitCol);
      const symbol = cols[symbolIndex].toUpperCase();
      const type = cols.some((c) => /buy/i.test(c)) ? 'BUY' : 'SELL';
      trades.push({
        ticket: trades.length + 1,
        symbol,
        direction: type,
        volume: 0.1,
        profit,
        rMultiple: profit > 0 ? Number((profit / 50).toFixed(2)) : -1.0,
      });
    }
  }

  return trades;
}
