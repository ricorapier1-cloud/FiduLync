import type { RegimeBacktestCycle } from '@/types/macro';

/**
 * Historical validation is intentionally withheld until a reproducible
 * point-in-time dataset and out-of-sample return calculation are connected.
 * No synthetic cycle, win-rate, return, drawdown or sample-size figures.
 */
export const HISTORICAL_REGIME_CYCLES: RegimeBacktestCycle[] = [];

export function getRegimeValidationSummary() {
  return {
    status: 'NOT_VALIDATED' as const,
    totalCycles: 0,
    adequateSampleCycles: 0,
    winRatePct: null,
    avgReturnPct: null,
    avgDrawdownPct: null,
    cycles: HISTORICAL_REGIME_CYCLES,
    explanation: 'No certified historical results are published. Point-in-time source vintages, synchronized FX returns and reproducible out-of-sample calculations are not yet verified.',
  };
}
