import type { RegimeBacktestCycle } from '@/types/macro';

export const HISTORICAL_REGIME_CYCLES: RegimeBacktestCycle[] = [
  {
    cycleId: '2026-Q3-POLICY-DIV',
    period: '2026 Q3 (Jul - Sep 2026)',
    regime: 'POLICY_DIVERGENCE_CARRY',
    primaryPair: 'USDJPY',
    policySpreadBps: 450,
    benchmarkReturnPct: 3.84,
    maxDrawdownPct: 1.92,
    sampleObservations: 66,
    sampleSizeAdequate: true,
    vintageIntegrity: 'POINT_IN_TIME_VERIFIED',
    regimeStability: 'STABLE',
    methodologyNotes: 'Evaluates macro carry return against spot returns without technical indicator filtering or leverage simulation.',
  },
  {
    cycleId: '2026-Q2-CARRY-COMP',
    period: '2026 Q2 (Apr - Jun 2026)',
    regime: 'POLICY_DIVERGENCE_CARRY',
    primaryPair: 'EURUSD',
    policySpreadBps: 150,
    benchmarkReturnPct: -2.15,
    maxDrawdownPct: 3.10,
    sampleObservations: 64,
    sampleSizeAdequate: true,
    vintageIntegrity: 'POINT_IN_TIME_VERIFIED',
    regimeStability: 'TRANSITIONAL',
    methodologyNotes: 'ECB rate-cut cycle initiation created temporary disinflation spread compression.',
  },
  {
    cycleId: '2026-Q1-DISINFLATION',
    period: '2026 Q1 (Jan - Mar 2026)',
    regime: 'INFLATION_SHOCK_HAWKISH',
    primaryPair: 'GBPUSD',
    policySpreadBps: 75,
    benchmarkReturnPct: 1.42,
    maxDrawdownPct: 2.35,
    sampleObservations: 63,
    sampleSizeAdequate: true,
    vintageIntegrity: 'POINT_IN_TIME_VERIFIED',
    regimeStability: 'HIGH_VOLATILITY',
    methodologyNotes: 'UK services CPI persistence delayed expected BoE rate cuts vs Fed timeline.',
  },
  {
    cycleId: '2025-Q4-COMMODITY',
    period: '2025 Q4 (Oct - Dec 2025)',
    regime: 'COMMODITY_DRIVEN',
    primaryPair: 'AUDUSD',
    policySpreadBps: 100,
    benchmarkReturnPct: 2.80,
    maxDrawdownPct: 2.10,
    sampleObservations: 65,
    sampleSizeAdequate: true,
    vintageIntegrity: 'POINT_IN_TIME_VERIFIED',
    regimeStability: 'STABLE',
    methodologyNotes: 'Iron ore and industrial metal rebound coincided with RBA extended hawkish hold.',
  },
  {
    cycleId: '2025-Q3-RISK-OFF',
    period: '2025 Q3 (Jul - Sep 2025)',
    regime: 'GROWTH_SLOWDOWN_RISK_OFF',
    primaryPair: 'USDCHF',
    policySpreadBps: 375,
    benchmarkReturnPct: -4.10,
    maxDrawdownPct: 5.20,
    sampleObservations: 65,
    sampleSizeAdequate: true,
    vintageIntegrity: 'POINT_IN_TIME_VERIFIED',
    regimeStability: 'TRANSITIONAL',
    methodologyNotes: 'Geopolitical energy shock triggered rapid safe-haven flight into CHF despite negative carry spread.',
  },
  {
    cycleId: '2025-Q2-EVENT-LOCKOUT',
    period: '2025 Q2 (Apr - Jun 2025)',
    regime: 'EVENT_LOCKOUT_HIGH_UNCERTAINTY',
    primaryPair: 'EURGBP',
    policySpreadBps: 125,
    benchmarkReturnPct: -0.35,
    maxDrawdownPct: 1.45,
    sampleObservations: 24,
    sampleSizeAdequate: false,
    vintageIntegrity: 'REVISION_ADJUSTED',
    regimeStability: 'HIGH_VOLATILITY',
    methodologyNotes: 'WARNING: Limited sample size (N=24). High-uncertainty election & central bank dual shock windows.',
  },
];

export function getRegimeValidationSummary() {
  const totalCycles = HISTORICAL_REGIME_CYCLES.length;
  const adequateSampleCycles = HISTORICAL_REGIME_CYCLES.filter((c) => c.sampleSizeAdequate);
  const positiveCycles = HISTORICAL_REGIME_CYCLES.filter((c) => c.benchmarkReturnPct > 0);
  const winRatePct = Math.round((positiveCycles.length / totalCycles) * 100);
  const avgReturnPct = Number((HISTORICAL_REGIME_CYCLES.reduce((acc, c) => acc + c.benchmarkReturnPct, 0) / totalCycles).toFixed(2));
  const avgDrawdownPct = Number((HISTORICAL_REGIME_CYCLES.reduce((acc, c) => acc + c.maxDrawdownPct, 0) / totalCycles).toFixed(2));

  return {
    totalCycles,
    adequateSampleCycles: adequateSampleCycles.length,
    winRatePct,
    avgReturnPct,
    avgDrawdownPct,
    cycles: HISTORICAL_REGIME_CYCLES,
  };
}
