import { RESEARCH_OBJECTIVES } from './researchObjectives';

/**
 * FiduLync seven-stage research pipeline primitives.
 * These functions validate and classify supplied observations; they never invent missing market data.
 */

export type FeedState = 'HEALTHY' | 'DEGRADED' | 'STALE' | 'CIRCUIT_OPEN' | 'UNAVAILABLE';
export type RegimeState = 'TRENDING' | 'MEAN_REVERTING' | 'HIGH_VOLATILITY_EVENT_LOCKOUT' | 'RISK_OFF' | 'UNCLASSIFIED';

export type FeedHealthInput = {
  lastObservedAt: string | null;
  now: string;
  maxAgeMs: number;
  consecutiveFailures: number;
  circuitFailureThreshold: number;
  configured: boolean;
};

export type FeedHealth = {
  state: FeedState;
  ageMs: number | null;
  eligibleForResearch: boolean;
  reason: string;
};

export type PointInTimeObservation = {
  source: string;
  seriesId: string;
  observationAt: string;
  releasedAt: string;
  retrievedAt: string;
  value: number;
  revisionAt?: string | null;
  vintageAt?: string | null;
};

function finiteDate(value: string): number | null {
  if (typeof value !== 'string' || !/(Z|[+-]\d{2}:?\d{2})$/i.test(value)) return null;
  const epoch = Date.parse(value);
  return Number.isFinite(epoch) ? epoch : null;
}

export function normalizeUtcTimestamp(value: string): string | null {
  const epoch = finiteDate(value);
  return epoch === null ? null : new Date(epoch).toISOString();
}

export function validatePointInTimeObservation(
  observation: PointInTimeObservation,
  asOf: string,
): { valid: boolean; reason: string } {
  const asOfMs = finiteDate(asOf);
  const observationMs = finiteDate(observation.observationAt);
  const releaseMs = finiteDate(observation.releasedAt);
  const retrievedMs = finiteDate(observation.retrievedAt);
  const revisionMs = observation.revisionAt ? finiteDate(observation.revisionAt) : null;
  const vintageMs = observation.vintageAt ? finiteDate(observation.vintageAt) : null;

  if (!observation.source.trim() || !observation.seriesId.trim()) return { valid: false, reason: 'SOURCE_OR_SERIES_MISSING' };
  if (![asOfMs, observationMs, releaseMs, retrievedMs].every((v) => v !== null)) return { valid: false, reason: 'TIMESTAMP_MUST_INCLUDE_TIMEZONE' };
  if (!Number.isFinite(observation.value)) return { valid: false, reason: 'NON_FINITE_OBSERVATION' };
  if (releaseMs! > asOfMs!) return { valid: false, reason: 'LOOKAHEAD_RELEASE' };
  if (retrievedMs! > asOfMs!) return { valid: false, reason: 'RETRIEVED_AFTER_AS_OF' };
  if (observationMs! > releaseMs!) return { valid: false, reason: 'OBSERVATION_AFTER_RELEASE' };
  if (retrievedMs! < releaseMs!) return { valid: false, reason: 'RETRIEVED_BEFORE_RELEASE' };
  if (observation.vintageAt && (vintageMs === null || vintageMs > asOfMs!)) return { valid: false, reason: 'VINTAGE_NOT_YET_KNOWN' };
  if (observation.revisionAt && (revisionMs === null || revisionMs > asOfMs!)) return { valid: false, reason: 'REVISION_NOT_YET_KNOWN' };
  return { valid: true, reason: 'POINT_IN_TIME_VALID' };
}

export function assessFeedHealth(input: FeedHealthInput): FeedHealth {
  if (!input.configured) return { state: 'UNAVAILABLE', ageMs: null, eligibleForResearch: false, reason: 'FEED_NOT_CONFIGURED' };
  if (!Number.isSafeInteger(input.maxAgeMs) || input.maxAgeMs <= 0
    || !Number.isSafeInteger(input.circuitFailureThreshold) || input.circuitFailureThreshold < 1
    || !Number.isSafeInteger(input.consecutiveFailures) || input.consecutiveFailures < 0) {
    return { state: 'UNAVAILABLE', ageMs: null, eligibleForResearch: false, reason: 'INVALID_FEED_POLICY' };
  }
  if (input.consecutiveFailures >= input.circuitFailureThreshold) {
    return { state: 'CIRCUIT_OPEN', ageMs: null, eligibleForResearch: false, reason: 'UPSTREAM_FAILURE_THRESHOLD_REACHED' };
  }
  const nowMs = finiteDate(input.now);
  const observedMs = input.lastObservedAt ? finiteDate(input.lastObservedAt) : null;
  if (nowMs === null || observedMs === null || observedMs > nowMs) {
    return { state: 'UNAVAILABLE', ageMs: null, eligibleForResearch: false, reason: 'OBSERVATION_TIMESTAMP_INVALID_OR_MISSING' };
  }
  const ageMs = nowMs - observedMs;
  if (ageMs > input.maxAgeMs) return { state: 'STALE', ageMs, eligibleForResearch: false, reason: 'FEED_AGE_EXCEEDED' };
  if (input.consecutiveFailures > 0) return { state: 'DEGRADED', ageMs, eligibleForResearch: false, reason: 'UPSTREAM_FAILURES_PRESENT' };
  return { state: 'HEALTHY', ageMs, eligibleForResearch: true, reason: 'FRESH_OBSERVATION' };
}

export type RegimeInputs = {
  hurst: number | null;
  kaufmanEfficiencyRatio: number | null;
  zScore: number | null;
  atrPercentile: number | null;
  volatilityClusterScore: number | null;
  policyRiskOff: boolean | null;
  eventLockout: boolean | null;
  inputsVerified: boolean;
};

export function classifyMarketRegime(input: RegimeInputs): RegimeState {
  if (!input.inputsVerified) return 'UNCLASSIFIED';
  if (input.eventLockout === true || (input.atrPercentile !== null && input.atrPercentile >= 0.95)) {
    return 'HIGH_VOLATILITY_EVENT_LOCKOUT';
  }
  if (input.policyRiskOff === true) return 'RISK_OFF';
  const metrics = [input.hurst, input.kaufmanEfficiencyRatio, input.zScore, input.atrPercentile, input.volatilityClusterScore];
  if (metrics.some((value) => value === null || !Number.isFinite(value))) return 'UNCLASSIFIED';
  if (input.hurst! >= 0.58 && input.kaufmanEfficiencyRatio! >= 0.35
    && input.volatilityClusterScore! < 0.85) return 'TRENDING';
  if (input.hurst! <= 0.45 && Math.abs(input.zScore!) >= 1
    && input.atrPercentile! < 0.90) return 'MEAN_REVERTING';
  return 'UNCLASSIFIED';
}

export function pearsonCorrelation(left: number[], right: number[]): number | null {
  if (left.length !== right.length || left.length < 3
    || [...left, ...right].some((value) => !Number.isFinite(value))) return null;
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const mx = mean(left), my = mean(right);
  let covariance = 0, vx = 0, vy = 0;
  for (let i = 0; i < left.length; i += 1) {
    const dx = left[i] - mx, dy = right[i] - my;
    covariance += dx * dy; vx += dx * dx; vy += dy * dy;
  }
  const denominator = Math.sqrt(vx * vy);
  return denominator > 0 ? covariance / denominator : null;
}

/** OLS residual spread only. This is not a cointegration test or a stationarity claim. */
export function regressionSpread(left: number[], right: number[]): { hedgeRatio: number; intercept: number; residuals: number[] } | null {
  if (left.length !== right.length || left.length < 20
    || [...left, ...right].some((value) => !Number.isFinite(value))) return null;
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const mx = mean(left), my = mean(right);
  let covariance = 0, variance = 0;
  for (let i = 0; i < left.length; i += 1) {
    covariance += (left[i] - mx) * (right[i] - my);
    variance += (right[i] - my) ** 2;
  }
  if (variance <= 0) return null;
  const hedgeRatio = covariance / variance;
  const intercept = mx - hedgeRatio * my;
  return { hedgeRatio, intercept, residuals: left.map((value, index) => value - intercept - hedgeRatio * right[index]) };
}

export type ValidationEvidence = {
  inSampleTrades: number;
  outOfSampleTrades: number;
  outOfSampleExpectancyR: number | null;
  maxDrawdownPct: number | null;
  spreadStressApplied: boolean;
  slippageStressApplied: boolean;
  commissionStressApplied: boolean;
  walkForwardFolds: number;
  untouchedOos: boolean;
};

export function assessValidationEvidence(evidence: ValidationEvidence): { eligible: boolean; blockers: string[] } {
  const blockers: string[] = [];
  if (!Number.isSafeInteger(evidence.inSampleTrades) || evidence.inSampleTrades < 1) blockers.push('INSUFFICIENT_IN_SAMPLE_TRADES');
  if (!Number.isSafeInteger(evidence.outOfSampleTrades) || evidence.outOfSampleTrades < 30) blockers.push('INSUFFICIENT_OOS_TRADES');
  if (evidence.outOfSampleExpectancyR === null || !Number.isFinite(evidence.outOfSampleExpectancyR)) blockers.push('OOS_EXPECTANCY_UNAVAILABLE');
  if (evidence.maxDrawdownPct === null || !Number.isFinite(evidence.maxDrawdownPct) || evidence.maxDrawdownPct < 0) blockers.push('DRAWDOWN_EVIDENCE_UNAVAILABLE');
  if (!evidence.spreadStressApplied) blockers.push('SPREAD_STRESS_MISSING');
  if (!evidence.slippageStressApplied) blockers.push('SLIPPAGE_STRESS_MISSING');
  if (!evidence.commissionStressApplied) blockers.push('COMMISSION_STRESS_MISSING');
  if (!Number.isSafeInteger(evidence.walkForwardFolds) || evidence.walkForwardFolds < 3) blockers.push('INSUFFICIENT_WALK_FORWARD_FOLDS');
  if (!evidence.untouchedOos) blockers.push('OOS_NOT_UNTOUCHED');
  return { eligible: blockers.length === 0, blockers };
}


export type MacroResearchEvidence = {
  pointInTimeReleaseVintagesVerified: boolean;
  synchronizedHistoricalObservationsVerified: boolean;
  sourcePermissionsVerified: boolean;
  untouchedOutOfSampleVerified: boolean;
  walkForwardFolds: number;
  spreadStressApplied: boolean;
  slippageStressApplied: boolean;
  commissionStressApplied: boolean;
  swapStressApplied: boolean;
  parameterSensitivityCompleted: boolean;
  multiRegimeCoverageVerified: boolean;
};

/**
 * MacroLync validates the research-data and methodology chain only.
 * It does not calculate or display broker-trade performance or authorize orders.
 */
export function assessMacroResearchEvidence(evidence: MacroResearchEvidence): {
  eligible: boolean;
  status: 'NOT_VALIDATED' | 'INSUFFICIENT_EVIDENCE' | 'READY_FOR_INDEPENDENT_TRADE_VALIDATION';
  blockers: string[];
  objectives: typeof RESEARCH_OBJECTIVES;
} {
  const blockers: string[] = [];
  if (!evidence.pointInTimeReleaseVintagesVerified) blockers.push('POINT_IN_TIME_RELEASE_VINTAGES_UNVERIFIED');
  if (!evidence.synchronizedHistoricalObservationsVerified) blockers.push('SYNCHRONIZED_HISTORICAL_OBSERVATIONS_UNVERIFIED');
  if (!evidence.sourcePermissionsVerified) blockers.push('SOURCE_PERMISSIONS_UNVERIFIED');
  if (!evidence.untouchedOutOfSampleVerified) blockers.push('MACRO_OUT_OF_SAMPLE_NOT_UNTOUCHED');
  if (!Number.isSafeInteger(evidence.walkForwardFolds) || evidence.walkForwardFolds < 3) blockers.push('MACRO_WALK_FORWARD_REQUIRES_THREE_OR_MORE_FOLDS');
  if (!evidence.spreadStressApplied) blockers.push('SPREAD_STRESS_NOT_APPLIED');
  if (!evidence.slippageStressApplied) blockers.push('SLIPPAGE_STRESS_NOT_APPLIED');
  if (!evidence.commissionStressApplied) blockers.push('COMMISSION_STRESS_NOT_APPLIED');
  if (!evidence.swapStressApplied) blockers.push('SWAP_STRESS_NOT_APPLIED');
  if (!evidence.parameterSensitivityCompleted) blockers.push('PARAMETER_SENSITIVITY_NOT_COMPLETED');
  if (!evidence.multiRegimeCoverageVerified) blockers.push('MULTI_REGIME_COVERAGE_UNVERIFIED');
  const eligible = blockers.length === 0;
  return {
    eligible,
    status: eligible ? 'READY_FOR_INDEPENDENT_TRADE_VALIDATION'
      : blockers.some((blocker) => blocker.includes('UNVERIFIED') || blocker.includes('NOT_UNTOUCHED'))
        ? 'NOT_VALIDATED' : 'INSUFFICIENT_EVIDENCE',
    blockers,
    objectives: RESEARCH_OBJECTIVES,
  };
}
