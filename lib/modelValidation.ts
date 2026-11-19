export type ValidationTrade = {
  trade_id: string;
  closed_at: string;
  gross_r: number;
  cost_r: number;
};

export type ModelValidationResult = {
  validation_metrics: {
    trade_count: number;
    profit_factor: number;
    expectancy_r: number;
    sharpe_ratio: number;
    max_drawdown_pct: number;
    monte_carlo_p95_drawdown_pct: number;
    walk_forward_pass_rate_pct: number;
    out_of_sample_trade_count: number;
    stressed_profit_factor: number;
  };
  evidence: Record<string, unknown>;
};

function profitFactor(values: number[]): number {
  const wins = values.reduce((sum, value) => sum + Math.max(0, value), 0);
  const losses = values.reduce((sum, value) => sum + Math.min(0, value), 0);
  if (losses === 0) return wins > 0 ? 99.99 : 0;
  return Number((wins / Math.abs(losses)).toFixed(4));
}

function expectancy(values: number): number;
function expectancy(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function sharpe(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = expectancy(values);
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const deviation = Math.sqrt(variance);
  return deviation > 0 ? mean / deviation : 0;
}

function maxDrawdownPct(values: number[], riskPct: number): number {
  let equity = 100, peak = 100, maxDrawdown = 0;
  for (const value of values) {
    equity *= Math.max(0, 1 + (riskPct / 100) * value);
    peak = Math.max(peak, equity);
    if (peak > 0) maxDrawdown = Math.max(maxDrawdown, ((peak - equity) / peak) * 100);
  }
  return maxDrawdown;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function monteCarloP95(values: number[], riskPct: number, fingerprint: string): number {
  const seed = Number.parseInt(fingerprint.slice(0, 8), 16) >>> 0;
  const random = seededRandom(seed);
  const simulations = 1500;
  const drawdowns: number[] = [];
  for (let simulation = 0; simulation < simulations; simulation += 1) {
    const sample = new Array<number>(values.length);
    for (let index = 0; index < values.length; index += 1) {
      sample[index] = values[Math.floor(random() * values.length)];
    }
    drawdowns.push(maxDrawdownPct(sample, riskPct));
  }
  drawdowns.sort((a, b) => a - b);
  return Number(drawdowns[Math.min(drawdowns.length - 1, Math.ceil(drawdowns.length * 0.95) - 1)].toFixed(4));
}

export function validateModelTrades(
  trades: ValidationTrade[],
  datasetFingerprint: string,
  codeFingerprint: string,
  riskPctPerTrade: number,
): ModelValidationResult {
  if (trades.length < 100 || trades.length > 5000) throw new Error('Validation requires 100–5,000 chronological trades.');
  if (!/^[a-f0-9]{64}$/i.test(datasetFingerprint) || !/^[a-f0-9]{64}$/i.test(codeFingerprint)) {
    throw new Error('Dataset and code SHA-256 fingerprints are required.');
  }
  if (!Number.isFinite(riskPctPerTrade) || riskPctPerTrade < 0.05 || riskPctPerTrade > 5) {
    throw new Error('Risk per trade must be between 0.05% and 5%.');
  }
  const sorted = [...trades].sort((a, b) => Date.parse(a.closed_at) - Date.parse(b.closed_at));
  const ids = new Set<string>();
  for (const trade of sorted) {
    if (!trade.trade_id || trade.trade_id.length > 100 || ids.has(trade.trade_id)
      || !Number.isFinite(Date.parse(trade.closed_at))
      || !Number.isFinite(trade.gross_r) || Math.abs(trade.gross_r) > 100
      || !Number.isFinite(trade.cost_r) || trade.cost_r < 0 || trade.cost_r > 10) {
      throw new Error('Trade rows contain duplicate IDs, invalid dates, or invalid R/cost values.');
    }
    ids.add(trade.trade_id);
  }
  const net = sorted.map((trade) => trade.gross_r - trade.cost_r);
  const count = net.length;
  const trainEnd = Math.floor(count * 0.6);
  const validationEnd = Math.floor(count * 0.8);
  const train = net.slice(0, trainEnd);
  const validation = net.slice(trainEnd, validationEnd);
  const outOfSample = net.slice(validationEnd);
  if (outOfSample.length < 20 || train.length < 40 || validation.length < 20) {
    throw new Error('Chronological split does not contain enough train, validation and out-of-sample trades.');
  }

  const foldStart = Math.floor(count * 0.5);
  const foldSize = Math.floor((count - foldStart) / 5);
  let passedFolds = 0;
  const folds: Array<{ fold: number; validation_start: string; validation_end: string; trade_count: number; expectancy_r: number; profit_factor: number; passed: boolean }> = [];
  for (let fold = 0; fold < 5; fold += 1) {
    const start = foldStart + fold * foldSize;
    const end = fold === 4 ? count : Math.min(count, start + foldSize);
    const values = net.slice(start, end);
    const pf = profitFactor(values);
    const exp = expectancy(values);
    const passed = values.length >= 10 && exp > 0 && pf > 1;
    if (passed) passedFolds += 1;
    folds.push({
      fold: fold + 1,
      validation_start: sorted[start]?.closed_at ?? '',
      validation_end: sorted[Math.max(start, end - 1)]?.closed_at ?? '',
      trade_count: values.length,
      expectancy_r: Number(exp.toFixed(5)),
      profit_factor: pf,
      passed,
    });
  }
  const stressedValues = sorted.map((trade) => trade.gross_r - trade.cost_r * 2);
  const stressed15 = sorted.map((trade) => trade.gross_r - trade.cost_r * 1.5);
  const p95Drawdown = monteCarloP95(net, riskPctPerTrade, datasetFingerprint);
  const metrics = {
    trade_count: count,
    profit_factor: profitFactor(net),
    expectancy_r: Number(expectancy(net).toFixed(5)),
    sharpe_ratio: Number(sharpe(net).toFixed(5)),
    max_drawdown_pct: Number(maxDrawdownPct(net, riskPctPerTrade).toFixed(4)),
    monte_carlo_p95_drawdown_pct: p95Drawdown,
    walk_forward_pass_rate_pct: Number((passedFolds / 5 * 100).toFixed(2)),
    out_of_sample_trade_count: outOfSample.length,
    stressed_profit_factor: profitFactor(stressedValues),
  };
  return {
    validation_metrics: metrics,
    evidence: {
      dataset_fingerprint: datasetFingerprint.toLowerCase(),
      code_fingerprint: codeFingerprint.toLowerCase(),
      dataset_start: sorted[0].closed_at,
      dataset_end: sorted[count - 1].closed_at,
      train_test_protocol: {
        method: 'chronological_holdout',
        train_pct: 60,
        validation_pct: 20,
        out_of_sample_pct: 20,
        no_random_shuffling: true,
      },
      walk_forward: {
        method: 'five_sequential_validation_windows_after_initial_50_percent',
        folds,
        pass_criteria: 'positive expectancy and profit factor greater than 1.0',
      },
      out_of_sample: {
        trade_count: outOfSample.length,
        expectancy_r: Number(expectancy(outOfSample).toFixed(5)),
        profit_factor: profitFactor(outOfSample),
        max_drawdown_pct: Number(maxDrawdownPct(outOfSample, riskPctPerTrade).toFixed(4)),
      },
      monte_carlo: {
        method: 'bootstrap_resampling_with_replacement',
        simulations: 1500,
        seed: datasetFingerprint.slice(0, 8).toLowerCase(),
        p95_max_drawdown_pct: p95Drawdown,
      },
      cost_stress: {
        base_cost_multiple: 1,
        stress_cost_multiples: [1.5, 2],
        profit_factor_1_5x: profitFactor(stressed15),
        profit_factor_2x: profitFactor(stressedValues),
      },
      reproducibility: {
        validator_version: 'fidulync-model-validation-v1',
        risk_pct_per_trade: riskPctPerTrade,
        trade_order: 'ascending_closed_at',
        trade_count: count,
      },
    },
  };
}
