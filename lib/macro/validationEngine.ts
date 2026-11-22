import type { RegimeBacktestCycle } from '@/types/macro';

/**
 * No point-in-time historical observation store and reproducible return
 * calculation pipeline are currently wired into this workbench. Therefore
 * there are intentionally no performance records or computed KPIs here.
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
    explanation: 'Historical performance is not published because point-in-time source vintages, historical currency returns, and a reproducible out-of-sample calculation pipeline have not yet been verified.',
    requirements: [
      'Point-in-time macroeconomic observations with original release timestamps and vintage history.',
      'Synchronized historical FX returns and instrument calendars.',
      'Chronological signal construction using only information available at each historical timestamp.',
      'Out-of-sample and walk-forward evaluation with transaction-cost assumptions stated separately.',
      'Reproducible drawdown, uncertainty, sample-size, and sensitivity calculations.',
    ],
  };
}
