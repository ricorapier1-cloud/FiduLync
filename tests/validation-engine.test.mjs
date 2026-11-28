import test from 'node:test';
import assert from 'node:assert/strict';
import { QUANT_CORE_RESEARCH_OBJECTIVES, wilsonScoreInterval, calculateTradeMetrics, applyExecutionCostStress, evaluateWalkForward, monteCarloBootstrap, evaluateResearchObjectives } from '../.quant-test/validationEngine.js';
import { assessMacroResearchEvidence } from '../.quant-test/quantPipeline.js';

const trades = Array.from({ length: 40 }, (_, i) => ({ netR: i % 4 === 0 ? -0.5 : 0.4 }));
const tradesBetween = (start, end) => {
  const from = Date.parse(start), to = Date.parse(end);
  return Array.from({ length: 30 }, (_, i) => ({ netR: 0.2, closedAt: new Date(from + ((to - from) * (i + 1)) / 31).toISOString() }));
};

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
    { trainStart:'2025-01-01T00:00:00Z', trainEnd:'2025-02-01T00:00:00Z', testStart:'2025-02-01T00:00:00Z', testEnd:'2025-03-01T00:00:00Z', inSample:tradesBetween('2025-01-01T00:00:00Z','2025-02-01T00:00:00Z'), outOfSample:tradesBetween('2025-02-01T00:00:00Z','2025-03-01T00:00:00Z') },
    { trainStart:'2025-02-01T00:00:00Z', trainEnd:'2025-03-01T00:00:00Z', testStart:'2025-03-01T00:00:00Z', testEnd:'2025-04-01T00:00:00Z', inSample:tradesBetween('2025-02-01T00:00:00Z','2025-03-01T00:00:00Z'), outOfSample:tradesBetween('2025-03-01T00:00:00Z','2025-04-01T00:00:00Z') },
    { trainStart:'2025-03-01T00:00:00Z', trainEnd:'2025-04-01T00:00:00Z', testStart:'2025-04-01T00:00:00Z', testEnd:'2025-05-01T00:00:00Z', inSample:tradesBetween('2025-03-01T00:00:00Z','2025-04-01T00:00:00Z'), outOfSample:tradesBetween('2025-04-01T00:00:00Z','2025-05-01T00:00:00Z') },
  ];
  const result = evaluateWalkForward(folds);
  assert.equal(result.eligible, true);
  assert.equal(result.aggregateOos.trades, 90);
  assert.equal(evaluateWalkForward(folds.slice(0,2)).eligible, false);
  assert.equal(evaluateWalkForward(folds.map((fold) => ({ ...fold, trainStart: '2025-01-01' }))).eligible, false);
});

test('Monte Carlo bootstrap is reproducible and uses actual trade R outcomes', () => {
  const a = monteCarloBootstrap(trades, { iterations: 500, seed: 42 });
  const b = monteCarloBootstrap(trades, { iterations: 500, seed: 42 });
  assert.deepEqual(a, b);
  assert.ok(a.maxDrawdownPct.p99 >= a.maxDrawdownPct.p50);
  assert.equal(monteCarloBootstrap([], {}), null);
});



test('research mandate is explicit and never creates a daily trade quota', () => {
  assert.equal(QUANT_CORE_RESEARCH_OBJECTIVES.winRateTargetMin, 0.60);
  assert.equal(QUANT_CORE_RESEARCH_OBJECTIVES.winRateTargetMax, 0.65);
  assert.equal(QUANT_CORE_RESEARCH_OBJECTIVES.plannedRewardRisk, 2);
  assert.equal(QUANT_CORE_RESEARCH_OBJECTIVES.dailyTradeQuota, null);
  assert.equal(QUANT_CORE_RESEARCH_OBJECTIVES.setupPolicy, 'HIGH_QUALITY_ONLY');
});

test('Wilson interval is bounded and rejects invalid samples', () => {
  const interval = wilsonScoreInterval(60, 100);
  assert.ok(interval && interval.lower < 0.60 && interval.upper > 0.60);
  assert.equal(wilsonScoreInterval(101, 100), null);
});

test('trade metrics disclose net realized reward-to-risk and win-rate uncertainty', () => {
  const sample = [
    ...Array.from({ length: 60 }, (_, i) => ({ netR: 2, closedAt: new Date(Date.UTC(2025, 0, 1, 0, i)).toISOString() })),
    ...Array.from({ length: 40 }, (_, i) => ({ netR: -1, closedAt: new Date(Date.UTC(2025, 0, 2, 0, i)).toISOString() })),
  ];
  const metrics = calculateTradeMetrics(sample);
  assert.equal(metrics?.winRate, 0.6);
  assert.equal(metrics?.realizedRewardRisk, 2);
  assert.ok(metrics?.winRateWilson95.lower < metrics.winRate);
});

test('research objective gate refuses small samples and missing risk approval', () => {
  const trades = Array.from({ length: 100 }, (_, i) => ({
    netR: i < 65 ? 2 : -1,
    closedAt: new Date(Date.UTC(2025, 0, 1, 0, i)).toISOString(),
  }));
  const result = evaluateResearchObjectives(trades, {
    walkForwardEligible: true,
    untouchedOutOfSample: true,
    allTradesPassedQualityFilter: true,
    costStressApplied: true,
    stressedExpectancyR: 0.4,
    maxDrawdownPct: 5,
    approvedMaxDrawdownPct: null,
  });
  assert.equal(result.eligible, false);
  assert.equal(result.status, 'NOT_VALIDATED');
  assert.ok(result.blockers.includes('OOS_SAMPLE_BELOW_300_TRADES'));
  assert.ok(result.blockers.includes('OWNER_APPROVED_DRAWDOWN_LIMIT_MISSING'));
});

test('macro research gate requires PIT vintages, source rights, OOS, costs, WFA and regime coverage', () => {
  const blocked = assessMacroResearchEvidence({
    pointInTimeReleaseVintagesVerified: true,
    synchronizedHistoricalObservationsVerified: true,
    sourcePermissionsVerified: false,
    untouchedOutOfSampleVerified: true,
    walkForwardFolds: 3,
    spreadStressApplied: true,
    slippageStressApplied: true,
    commissionStressApplied: true,
    swapStressApplied: true,
    parameterSensitivityCompleted: true,
    multiRegimeCoverageVerified: true,
  });
  assert.equal(blocked.eligible, false);
  assert.ok(blocked.blockers.includes('SOURCE_PERMISSIONS_UNVERIFIED'));
});


test('a fully evidenced 65 percent / 1:2 sample can pass only with approved drawdown and all independent gates', () => {
  const trades = Array.from({ length: 1000 }, (_, i) => ({
    netR: i < 650 ? 2 : -1,
    closedAt: new Date(Date.UTC(2024, 0, 1) + i * 60_000).toISOString(),
  }));
  const result = evaluateResearchObjectives(trades, {
    walkForwardEligible: true,
    untouchedOutOfSample: true,
    allTradesPassedQualityFilter: true,
    costStressApplied: true,
    stressedExpectancyR: 0.5,
    maxDrawdownPct: 12,
    approvedMaxDrawdownPct: 15,
  });
  assert.equal(result.status, 'VALIDATED');
  assert.equal(result.eligible, true);
  assert.equal(result.winRateTarget, 'CONFIRMED');
  assert.equal(result.metrics?.realizedRewardRisk, 2);
});

test('drawdown breach, negative stressed expectancy and unfiltered setups block validation', () => {
  const trades = Array.from({ length: 1000 }, (_, i) => ({
    netR: i < 650 ? 2 : -1,
    closedAt: new Date(Date.UTC(2024, 0, 1) + i * 60_000).toISOString(),
  }));
  const result = evaluateResearchObjectives(trades, {
    walkForwardEligible: true,
    untouchedOutOfSample: true,
    allTradesPassedQualityFilter: false,
    costStressApplied: true,
    stressedExpectancyR: -0.1,
    maxDrawdownPct: 20,
    approvedMaxDrawdownPct: 15,
  });
  assert.equal(result.eligible, false);
  assert.ok(result.blockers.includes('DRAWDOWN_EXCEEDS_APPROVED_LIMIT'));
  assert.ok(result.blockers.includes('STRESSED_NET_EXPECTANCY_NOT_POSITIVE'));
  assert.ok(result.blockers.includes('LOW_QUALITY_OR_UNFILTERED_TRADES_PRESENT'));
});
