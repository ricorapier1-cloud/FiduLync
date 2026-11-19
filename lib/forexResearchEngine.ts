/**
 * Evidence-weighted FX driver model.
 *
 * It deliberately separates macro drivers from technical setup confirmation.
 * Inputs are already pair-signed standardized observations (positive = supports
 * base currency versus quote currency). Missing/stale/unverified inputs are
 * excluded, never imputed. This is a research assessment, not an order signal.
 */
export type FxDriverCategory =
  | 'RATE_PATH_REPRICING'
  | 'REAL_YIELD_DIFFERENTIAL'
  | 'MACRO_SURPRISE'
  | 'TERMS_OF_TRADE'
  | 'POSITIONING'
  | 'RISK_SENTIMENT'
  | 'FUNDING_STRESS';

export type FxDriverObservation = {
  category: FxDriverCategory;
  pairSignedZ: number;
  source: string;
  observedAt: string;
  releasedAt: string;
  verified: boolean;
  maxAgeHours: number;
};

export type FxTechnicalConfirmation = {
  trendZ: number | null;
  structureZ: number | null;
  volatilityPercentile: number | null;
  spreadToAtr: number | null;
  closedBarVerified: boolean;
};

export type FxDriverAssessment = {
  pair: string;
  macroScore: number;
  technicalScore: number | null;
  combinedScore: number;
  confidence: number;
  evidenceCoverage: number;
  directionalAgreement: number;
  dominantDrivers: FxDriverCategory[];
  excluded: Array<{ category: FxDriverCategory; reason: string }>;
  setup: 'LONG_BIAS' | 'SHORT_BIAS' | 'NO_SETUP';
  blockers: string[];
  asOf: string;
};

const WEIGHTS: Record<FxDriverCategory, number> = {
  RATE_PATH_REPRICING: 0.28,
  REAL_YIELD_DIFFERENTIAL: 0.22,
  MACRO_SURPRISE: 0.18,
  TERMS_OF_TRADE: 0.10,
  POSITIONING: 0.08,
  RISK_SENTIMENT: 0.08,
  FUNDING_STRESS: 0.06,
};

const ALL_WEIGHT = Object.values(WEIGHTS).reduce((sum, value) => sum + value, 0);

function epoch(value: string): number | null {
  if (typeof value !== 'string' || !/(Z|[+-]\d{2}:?\d{2})$/i.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Robust surprise z-score using median absolute deviation; consensus and actual must share units. */
export function robustMacroSurpriseZ(
  actual: number,
  consensus: number,
  historicalSurprises: number[],
): number | null {
  if (![actual, consensus, ...historicalSurprises].every(Number.isFinite)
    || historicalSurprises.length < 20) return null;
  const center = median(historicalSurprises);
  const mad = median(historicalSurprises.map((value) => Math.abs(value - center)));
  if (mad <= 0) return null;
  const robustSigma = 1.4826 * mad;
  return clamp((actual - consensus - center) / robustSigma, -5, 5);
}

/** Return annualized basis-point repricing of the expected policy path. */
export function ratePathRepricingZ(
  currentPathBps: number[],
  priorPathBps: number[],
  historicalChangesBps: number[],
): number | null {
  if (currentPathBps.length === 0 || currentPathBps.length !== priorPathBps.length
    || historicalChangesBps.length < 20
    || [...currentPathBps, ...priorPathBps, ...historicalChangesBps].some((v) => !Number.isFinite(v))) return null;
  const pathChange = currentPathBps.reduce((sum, value, index) => sum + value - priorPathBps[index], 0)
    / currentPathBps.length;
  const center = median(historicalChangesBps);
  const mad = median(historicalChangesBps.map((value) => Math.abs(value - center)));
  if (mad <= 0) return null;
  return clamp((pathChange - center) / (1.4826 * mad), -5, 5);
}

export function assessFxDrivers(
  pair: string,
  factors: FxDriverObservation[],
  technical: FxTechnicalConfirmation,
  asOf: string,
): FxDriverAssessment {
  const normalizedPair = pair.toUpperCase();
  const now = epoch(asOf);
  const blockers: string[] = [];
  const excluded: FxDriverAssessment['excluded'] = [];
  if (!/^[A-Z]{6}$/.test(normalizedPair) || normalizedPair.slice(0, 3) === normalizedPair.slice(3)
    || now === null) {
    return {
      pair: normalizedPair, macroScore: 0, technicalScore: null, combinedScore: 0,
      confidence: 0, evidenceCoverage: 0, directionalAgreement: 0,
      dominantDrivers: [], excluded: [], setup: 'NO_SETUP',
      blockers: ['INVALID_PAIR_OR_AS_OF'], asOf,
    };
  }

  const latestByCategory = new Map<FxDriverCategory, FxDriverObservation>();
  for (const factor of factors) {
    const observed = epoch(factor.observedAt);
    const released = epoch(factor.releasedAt);
    let reason = '';
    if (!factor.verified || typeof factor.source !== 'string' || !factor.source.trim() || !(factor.category in WEIGHTS)) reason = 'UNVERIFIED_SOURCE';
    else if (observed === null || released === null) reason = 'TIMEZONE_AWARE_TIMESTAMPS_REQUIRED';
    else if (released > now || observed > now) reason = 'LOOKAHEAD_INPUT';
    else if (observed < released) reason = 'OBSERVATION_PRECEDES_RELEASE';
    else if (!Number.isFinite(factor.pairSignedZ) || !Number.isFinite(factor.maxAgeHours) || factor.maxAgeHours <= 0) reason = 'INVALID_FACTOR_VALUE_OR_FRESHNESS';
    else if (now - observed > factor.maxAgeHours * 3_600_000) reason = 'STALE_FACTOR';
    if (reason) {
      excluded.push({ category: factor.category, reason });
      continue;
    }
    const prior = latestByCategory.get(factor.category);
    if (!prior || epoch(prior.observedAt)! < observed!) latestByCategory.set(factor.category, factor);
  }

  const valid = [...latestByCategory.values()];
  const presentWeight = valid.reduce((sum, item) => sum + WEIGHTS[item.category], 0);
  const weighted = valid.reduce((sum, item) => sum + clamp(item.pairSignedZ, -5, 5) * WEIGHTS[item.category], 0);
  const macroScore = presentWeight > 0 ? clamp((weighted / presentWeight) * 20, -100, 100) : 0;
  const directionalWeight = valid.reduce((sum, item) => sum + WEIGHTS[item.category] * Math.sign(item.pairSignedZ), 0);
  const nonZeroWeight = valid.reduce((sum, item) => sum + (item.pairSignedZ === 0 ? 0 : WEIGHTS[item.category]), 0);
  const agreement = nonZeroWeight > 0 ? Math.abs(directionalWeight) / nonZeroWeight : 0;
  const coverage = presentWeight / ALL_WEIGHT;

  const technicalValues = [technical.trendZ, technical.structureZ];
  const technicalValid = technical.closedBarVerified
    && technicalValues.every((value) => value !== null && Number.isFinite(value))
    && technical.volatilityPercentile !== null && Number.isFinite(technical.volatilityPercentile)
    && technical.volatilityPercentile >= 0 && technical.volatilityPercentile <= 1
    && technical.spreadToAtr !== null && Number.isFinite(technical.spreadToAtr) && technical.spreadToAtr >= 0;
  const technicalScore = technicalValid
    ? clamp(((technical.trendZ! * 0.55) + (technical.structureZ! * 0.45)) * 20, -100, 100)
    : null;

  const combinedScore = technicalScore === null
    ? macroScore
    : clamp(macroScore * 0.65 + technicalScore * 0.35, -100, 100);
  const confidence = clamp(coverage * agreement * (technicalScore === null ? 0.75 : 1), 0, 1);
  const dominantDrivers = [...valid]
    .sort((a, b) => Math.abs(b.pairSignedZ) * WEIGHTS[b.category] - Math.abs(a.pairSignedZ) * WEIGHTS[a.category])
    .slice(0, 3).map((item) => item.category);

  if (coverage < 0.60) blockers.push('INSUFFICIENT_MACRO_DRIVER_COVERAGE');
  if (agreement < 0.55) blockers.push('MACRO_DRIVER_DISAGREEMENT');
  if (technicalScore === null) blockers.push('VERIFIED_CLOSED_BAR_TECHNICAL_CONFIRMATION_MISSING');
  if (technical.volatilityPercentile !== null && technical.volatilityPercentile >= 0.95) blockers.push('EXTREME_VOLATILITY_LOCKOUT');
  if (technical.spreadToAtr !== null && technical.spreadToAtr > 0.12) blockers.push('SPREAD_COST_TOO_HIGH_RELATIVE_TO_ATR');

  const aligned = technicalScore !== null && Math.sign(macroScore) === Math.sign(technicalScore)
    && Math.abs(macroScore) >= 35 && Math.abs(technicalScore) >= 25;
  if (!aligned) blockers.push('MACRO_TECHNICAL_ALIGNMENT_MISSING');
  if (confidence < 0.45) blockers.push('EVIDENCE_CONFIDENCE_TOO_LOW');

  const setup = blockers.length === 0 && aligned
    ? combinedScore > 0 ? 'LONG_BIAS' : 'SHORT_BIAS'
    : 'NO_SETUP';

  return {
    pair: normalizedPair, macroScore: Math.round(macroScore),
    technicalScore: technicalScore === null ? null : Math.round(technicalScore),
    combinedScore: Math.round(combinedScore), confidence: Number(confidence.toFixed(3)),
    evidenceCoverage: Number(coverage.toFixed(3)),
    directionalAgreement: Number(agreement.toFixed(3)),
    dominantDrivers, excluded, setup, blockers, asOf: new Date(now).toISOString(),
  };
}
