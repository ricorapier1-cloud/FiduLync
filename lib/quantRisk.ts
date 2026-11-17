export type RiskRegime = 'TRENDING_EXPANSION' | 'MEAN_REVERTING' | 'HIGH_VOL_CHOP' | 'UNAVAILABLE';

export type RiskGateInput = {
  regime: RiskRegime;
  marketDataVerified: boolean;
  macroDataVerified: boolean;
  executionQualityVerified: boolean;
  modelValidated: boolean;
  executionEnabled: boolean;
  newsLockout: boolean;
};

export type RiskGateResult = {
  riskPct: number;
  approved: boolean;
  blockers: string[];
  mode: 'DISABLED' | 'PILOT_TREND' | 'PILOT_MEAN_REVERSION';
};

/**
 * Fail-closed risk gate. Strategy risk remains zero until data, execution,
 * out-of-sample validation and explicit production enablement are all verified.
 * This is a permission ceiling, not a claim that a strategy is profitable.
 */
export function deriveRiskBudget(input: RiskGateInput): RiskGateResult {
  const blockers: string[] = [];
  if (!input.marketDataVerified) blockers.push('MARKET_DATA_NOT_VERIFIED');
  if (!input.macroDataVerified) blockers.push('MACRO_DATA_NOT_VERIFIED');
  if (!input.executionQualityVerified) blockers.push('EXECUTION_QUALITY_NOT_VERIFIED');
  if (!input.modelValidated) blockers.push('MODEL_NOT_OUT_OF_SAMPLE_VALIDATED');
  if (!input.executionEnabled) blockers.push('EXECUTION_NOT_EXPLICITLY_ENABLED');
  if (input.newsLockout) blockers.push('HIGH_IMPACT_NEWS_LOCKOUT');
  if (input.regime === 'HIGH_VOL_CHOP') blockers.push('HIGH_VOLATILITY_CHOP');
  if (input.regime === 'UNAVAILABLE') blockers.push('MARKET_REGIME_UNAVAILABLE');

  if (blockers.length) {
    return { riskPct: 0, approved: false, blockers, mode: 'DISABLED' };
  }
  if (input.regime === 'TRENDING_EXPANSION') {
    return { riskPct: 0.5, approved: true, blockers, mode: 'PILOT_TREND' };
  }
  if (input.regime === 'MEAN_REVERTING') {
    return { riskPct: 0.25, approved: true, blockers, mode: 'PILOT_MEAN_REVERSION' };
  }
  return {
    riskPct: 0,
    approved: false,
    blockers: ['REGIME_NOT_APPROVED'],
    mode: 'DISABLED',
  };
}

export type PositionSizeInput = {
  equity: number;
  riskPct: number;
  stopPips: number;
  pipValuePerLot: number;
  minLot: number;
  maxLot: number;
  lotStep: number;
};

export type PositionSizeResult = {
  lots: number;
  riskAmount: number;
  estimatedRiskAmount: number;
  valid: boolean;
  reason: string | null;
};

/** Broker-agnostic sizing primitive; callers must supply broker-correct pip value. */
export function calculatePositionSize(input: PositionSizeInput): PositionSizeResult {
  const values = [
    input.equity, input.riskPct, input.stopPips, input.pipValuePerLot,
    input.minLot, input.maxLot, input.lotStep,
  ];
  if (!values.every(Number.isFinite)
    || input.equity <= 0 || input.riskPct <= 0 || input.riskPct > 100
    || input.stopPips <= 0 || input.pipValuePerLot <= 0
    || input.minLot <= 0 || input.maxLot < input.minLot || input.lotStep <= 0) {
    return { lots: 0, riskAmount: 0, estimatedRiskAmount: 0, valid: false, reason: 'INVALID_SIZING_INPUT' };
  }

  const riskAmount = input.equity * input.riskPct / 100;
  const rawLots = riskAmount / (input.stopPips * input.pipValuePerLot);
  const cappedLots = Math.min(rawLots, input.maxLot);
  const steppedLots = Math.floor((cappedLots + Number.EPSILON) / input.lotStep) * input.lotStep;
  const lots = Number(steppedLots.toFixed(8));

  // Never round a minimum lot upward when that would breach the risk budget.
  if (lots < input.minLot) {
    return { lots: 0, riskAmount, estimatedRiskAmount: 0, valid: false, reason: 'MINIMUM_LOT_EXCEEDS_RISK_BUDGET' };
  }
  const estimatedRiskAmount = lots * input.stopPips * input.pipValuePerLot;
  if (estimatedRiskAmount > riskAmount * (1 + 1e-9)) {
    return { lots: 0, riskAmount, estimatedRiskAmount, valid: false, reason: 'RISK_BUDGET_BREACHED' };
  }
  return { lots, riskAmount, estimatedRiskAmount, valid: true, reason: null };
}

export function calculateBrierScore(probabilities: number[], outcomes: Array<0 | 1>): number | null {
  if (probabilities.length === 0 || probabilities.length !== outcomes.length) return null;
  if (!probabilities.every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) return null;
  return probabilities.reduce((sum, probability, index) => (
    sum + (probability - outcomes[index]) ** 2
  ), 0) / probabilities.length;
}

export function calculateNetExpectancyR(
  wins: number,
  losses: number,
  averageWinR: number,
  averageLossR: number,
  averageCostR = 0,
): number | null {
  if (![wins, losses, averageWinR, averageLossR, averageCostR].every(Number.isFinite)
    || wins < 0 || losses < 0 || wins + losses <= 0
    || averageWinR < 0 || averageLossR < 0 || averageCostR < 0) return null;
  const count = wins + losses;
  return (wins / count) * averageWinR - (losses / count) * averageLossR - averageCostR;
}
