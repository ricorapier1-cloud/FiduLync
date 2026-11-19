import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTradeMetrics, applyExecutionCostStress, evaluateWalkForward, monteCarloBootstrap } from '../.quant-test/validationEngine.js';

const trades = Array.from({ length: 40 }, (_, i) => ({ netR: i % 4 === 0 ? -0.5 : 0.4 }));
const thirtyWins = Array.from({ length: 30 }, () => ({ netR: 0.2 }));

test('trade metrics compute expectancy, profit factor and drawdown', () => {
  const result = calculateTradeMetrics(trades);
  assert.ok(result);
  assert.equal(result.trades, 40);
  assert.ok(result.expectancyR > 0);
  assert.ok(result.profitFactor > 1);
  assert.ok(result.maxDrawdownR >= 0);
});

test('execution stress deducts spread, slippage, commission and swap independently', () => {
  const sample = [{ grossR: 1, spreadCostR: 0.05, slippageCostR: 0.05, commissionCostR: 0.02, swapCostR: 0.01 }];
  const result = applyExecutionCostStress(sample, { spread: 2, slippage: 3, commission: 1, swap: 2 });
  assert.ok(result);
  assert.ok(result.stressed.expectancyR < result.baseline.expectancyR);
  assert.equal(applyExecutionCostStress(sample, { spread: 0.5, slippage: 1, commission: 1, swap: 1 }), null);
});

test('walk-forward validation requires chronological folds and sufficient OOS evidence', () => {
  const folds = [
    { trainStart:'2025-01-01T00:00:00Z', trainEnd:'2025-02-01T00:00:00Z', testStart:'2025-02-01T00:00:00Z', testEnd:'2025-03-01T00:00:00Z', inSample:thirtyWins, outOfSample:thirtyWins },
    { trainStart:'2025-02-01T00:00:00Z', trainEnd:'2025-03-01T00:00:00Z', testStart:'2025-03-01T00:00:00Z', testEnd:'2025-04-01T00:00:00Z', inSample:thirtyWins, outOfSample:thirtyWins },
    { trainStart:'2025-03-01T00:00:00Z', trainEnd:'2025-04-01T00:00:00Z', testStart:'2025-04-01T00:00:00Z', testEnd:'2025-05-01T00:00:00Z', inSample:thirtyWins, outOfSample:thirtyWins },
  ];
  const result = evaluateWalkForward(folds);
  assert.equal(result.eligible, true);
  assert.equal(result.aggregateOos.trades, 90);
  assert.equal(evaluateWalkForward(folds.slice(0,2)).eligible, false);
});

test('Monte Carlo bootstrap is reproducible and uses actual trade R outcomes', () => {
  const a = monteCarloBootstrap(trades, { iterations: 500, seed: 42 });
  const b = monteCarloBootstrap(trades, { iterations: 500, seed: 42 });
  assert.deepEqual(a, b);
  assert.ok(a.maxDrawdownPct.p99 >= a.maxDrawdownPct.p50);
  assert.equal(monteCarloBootstrap([], {}), null);
});
