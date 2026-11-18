/**
 * FiduLync Personal Quant Edition — deterministic risk governance primitives.
 *
 * Research signals never authorize an order. This module evaluates an EA/manual
 * proposal and returns a decision only; it has no broker or order-execution API.
 * Unknown, stale, incomplete or inconsistent inputs fail closed.
 */

export type GovernanceDecision = 'APPROVE' | 'REJECT' | 'ABSTAIN' | 'DEGRADED';
export type GovernanceRegime = 'TRENDING_EXPANSION' | 'MEAN_REVERTING' | 'HIGH_VOL_CHOP' | 'UNAVAILABLE';
export type DataHealth = 'LIVE' | 'DELAYED' | 'REFERENCE' | 'STALE' | 'UNAVAILABLE';

export type BrokerSymbolSpecification = {
  symbol: string;
  tickSize: number;
  tickValuePerLot: number;
  volumeMin: number;
  volumeMax: number;
  volumeStep: number;
  contractSize: number;
  stopLevelPoints: number;
  point: number;
  verified: boolean;
};

export type RiskProposal = {
  requestId: string;
  installationId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  bid: number;
  ask: number;
  quoteAgeMs: number;
  spreadPoints: number;
  equity: number;
  freeMargin: number;
  estimatedMargin: number;
  currentOpenRiskCash: number;
  dailyStartEquity: number;
  weeklyStartEquity: number;
  highWaterMarkEquity: number;
  consecutiveLosses: number;
  requestedRiskPct: number;
  regime: GovernanceRegime;
  marketDataHealth: DataHealth;
  macroDataHealth: DataHealth;
  modelValidated: boolean;
  executionQualityVerified: boolean;
  newsLockout: boolean;
  explicitExecutionEnablement: boolean;
  symbolSpec: BrokerSymbolSpecification;
  limits: {
    maxPerTradeRiskPct: number;
    maxPortfolioRiskPct: number;
    maxDailyDrawdownPct: number;
    maxWeeklyDrawdownPct: number;
    maxHighWaterDrawdownPct: number;
    maxMarginUsagePct: number;
    maxSpreadPoints: number;
    maxQuoteAgeMs: number;
    maxConsecutiveLosses: number;
    rewardRiskMinimum: number;
  };
};

export type RiskGovernanceResult = {
  schemaVersion: '1.0';
  requestId: string;
  decision: GovernanceDecision;
  approvedRiskPct: number;
  approvedVolume: number;
  estimatedRiskCash: number;
  estimatedRewardRisk: number | null;
  blockers: string[];
  evaluatedAt: string;
};

const finitePositive = (value: number) => Number.isFinite(value) && value > 0;
const roundVolume = (value: number, step: number) => {
  const decimals = Math.min(8, Math.max(0, (String(step).split('.')[1] ?? '').length));
  return Number(value.toFixed(decimals));
};

/** Floors volume to the broker's step. It never rounds a risk budget upward. */
export function calculateBrokerAwareVolume(args: {
  equity: number;
  riskPct: number;
  entryPrice: number;
  stopLoss: number;
  specification: BrokerSymbolSpecification;
}): { volume: number; riskCash: number; valid: boolean; reason: string | null } {
  const { equity, riskPct, entryPrice, stopLoss, specification: spec } = args;
  const numeric = [equity, riskPct, entryPrice, stopLoss, spec.tickSize, spec.tickValuePerLot,
    spec.volumeMin, spec.volumeMax, spec.volumeStep, spec.contractSize];
  if (!numeric.every(Number.isFinite) || !finitePositive(equity) || !finitePositive(riskPct)
    || riskPct > 100 || !finitePositive(entryPrice) || !finitePositive(stopLoss)
    || !finitePositive(spec.tickSize) || !finitePositive(spec.tickValuePerLot)
    || !finitePositive(spec.volumeMin) || !finitePositive(spec.volumeMax)
    || spec.volumeMax < spec.volumeMin || !finitePositive(spec.volumeStep)
    || !finitePositive(spec.contractSize) || !spec.verified) {
    return { volume: 0, riskCash: 0, valid: false, reason: 'BROKER_SPEC_OR_SIZING_INPUT_INVALID' };
  }

  const stopTicks = Math.abs(entryPrice - stopLoss) / spec.tickSize;
  if (!finitePositive(stopTicks)) {
    return { volume: 0, riskCash: 0, valid: false, reason: 'INVALID_STOP_DISTANCE' };
  }
  const riskCash = equity * riskPct / 100;
  const riskPerLot = stopTicks * spec.tickValuePerLot;
  const rawVolume = Math.min(spec.volumeMax, riskCash / riskPerLot);
  const stepped = roundVolume(Math.floor((rawVolume + Number.EPSILON) / spec.volumeStep) * spec.volumeStep, spec.volumeStep);

  if (stepped < spec.volumeMin) {
    return { volume: 0, riskCash, valid: false, reason: 'MINIMUM_VOLUME_EXCEEDS_RISK_BUDGET' };
  }
  const actualRisk = stepped * riskPerLot;
  if (!Number.isFinite(actualRisk) || actualRisk > riskCash * (1 + 1e-10)) {
    return { volume: 0, riskCash, valid: false, reason: 'ROUNDED_VOLUME_EXCEEDS_RISK_BUDGET' };
  }
  return { volume: stepped, riskCash: actualRisk, valid: true, reason: null };
}

function validateProposalShape(p: RiskProposal): string[] {
  const issues: string[] = [];
  if (!p.requestId?.trim() || !p.installationId?.trim() || !p.symbol?.trim()) issues.push('IDENTITY_FIELDS_MISSING');
  if (!['BUY', 'SELL'].includes(p.side)) issues.push('INVALID_ORDER_SIDE');
  const required = [p.entryPrice, p.stopLoss, p.takeProfit, p.bid, p.ask, p.quoteAgeMs,
    p.spreadPoints, p.equity, p.freeMargin, p.estimatedMargin, p.currentOpenRiskCash,
    p.dailyStartEquity, p.weeklyStartEquity, p.highWaterMarkEquity, p.consecutiveLosses,
    p.requestedRiskPct, p.limits.maxPerTradeRiskPct, p.limits.maxPortfolioRiskPct,
    p.limits.maxDailyDrawdownPct, p.limits.maxWeeklyDrawdownPct,
    p.limits.maxHighWaterDrawdownPct, p.limits.maxMarginUsagePct, p.limits.maxSpreadPoints,
    p.limits.maxQuoteAgeMs, p.limits.maxConsecutiveLosses, p.limits.rewardRiskMinimum];
  if (!required.every(Number.isFinite)) issues.push('NON_FINITE_OR_MISSING_NUMERIC_INPUT');
  if (!finitePositive(p.equity) || !finitePositive(p.dailyStartEquity)
    || !finitePositive(p.weeklyStartEquity) || !finitePositive(p.highWaterMarkEquity)) {
    issues.push('ACCOUNT_EQUITY_STATE_INVALID');
  }
  if (p.bid <= 0 || p.ask <= 0 || p.ask < p.bid) issues.push('INVALID_BID_ASK');
  if (p.freeMargin < 0 || p.estimatedMargin < 0 || p.currentOpenRiskCash < 0) issues.push('INVALID_ACCOUNT_EXPOSURE');
  if (p.requestedRiskPct <= 0 || p.limits.maxPerTradeRiskPct <= 0
    || p.limits.maxPortfolioRiskPct <= 0) issues.push('RISK_LIMITS_INVALID');
  if (p.limits.maxMarginUsagePct <= 0 || p.limits.maxMarginUsagePct > 100
    || p.limits.maxDailyDrawdownPct <= 0 || p.limits.maxWeeklyDrawdownPct <= 0
    || p.limits.maxHighWaterDrawdownPct <= 0 || p.limits.maxSpreadPoints <= 0
    || p.limits.maxQuoteAgeMs <= 0 || p.limits.rewardRiskMinimum <= 0) {
    issues.push('PROTECTIVE_LIMITS_INVALID');
  }
  return issues;
}

/**
 * Deterministic, fail-closed pre-trade decision. APPROVE is a short-lived
 * supervisory permission only; the EA must recheck quote, stops and local
 * protections before dispatch and attach broker-side SL/TP.
 */
export function evaluateRiskProposal(p: RiskProposal, now = Date.now()): RiskGovernanceResult {
  const blockers = validateProposalShape(p);
  const result = (decision: GovernanceDecision, volume = 0, riskCash = 0, rr: number | null = null): RiskGovernanceResult => ({
    schemaVersion: '1.0',
    requestId: typeof p.requestId === 'string' ? p.requestId : '',
    decision,
    approvedRiskPct: decision === 'APPROVE' ? p.requestedRiskPct : 0,
    approvedVolume: decision === 'APPROVE' ? volume : 0,
    estimatedRiskCash: decision === 'APPROVE' ? riskCash : 0,
    estimatedRewardRisk: rr,
    blockers: [...new Set(blockers)],
    evaluatedAt: new Date(now).toISOString(),
  });
  if (blockers.length) return result('ABSTAIN');

  if (!p.explicitExecutionEnablement) blockers.push('EXECUTION_NOT_EXPLICITLY_ENABLED');
  if (!p.modelValidated) blockers.push('MODEL_NOT_OUT_OF_SAMPLE_VALIDATED');
  if (!p.executionQualityVerified) blockers.push('EXECUTION_QUALITY_NOT_VERIFIED');
  if (!p.symbolSpec.verified) blockers.push('BROKER_SYMBOL_SPEC_NOT_VERIFIED');
  if (p.marketDataHealth !== 'LIVE') blockers.push('MARKET_DATA_NOT_LIVE');
  if (p.macroDataHealth !== 'LIVE') blockers.push('MACRO_DATA_NOT_LIVE');
  if (p.quoteAgeMs > p.limits.maxQuoteAgeMs) blockers.push('QUOTE_STALE');
  if (p.spreadPoints > p.limits.maxSpreadPoints) blockers.push('SPREAD_LIMIT_EXCEEDED');
  if (p.newsLockout) blockers.push('HIGH_IMPACT_NEWS_LOCKOUT');
  if (p.regime === 'HIGH_VOL_CHOP') blockers.push('HIGH_VOLATILITY_CHOP');
  if (p.regime === 'UNAVAILABLE') blockers.push('MARKET_REGIME_UNAVAILABLE');
  if (p.consecutiveLosses >= p.limits.maxConsecutiveLosses) blockers.push('LOSS_STREAK_LIMIT_REACHED');

  const dailyDrawdownPct = Math.max(0, (p.dailyStartEquity - p.equity) / p.dailyStartEquity * 100);
  const weeklyDrawdownPct = Math.max(0, (p.weeklyStartEquity - p.equity) / p.weeklyStartEquity * 100);
  const highWaterDrawdownPct = Math.max(0, (p.highWaterMarkEquity - p.equity) / p.highWaterMarkEquity * 100);
  if (dailyDrawdownPct >= p.limits.maxDailyDrawdownPct) blockers.push('DAILY_DRAWDOWN_LIMIT_REACHED');
  if (weeklyDrawdownPct >= p.limits.maxWeeklyDrawdownPct) blockers.push('WEEKLY_DRAWDOWN_LIMIT_REACHED');
  if (highWaterDrawdownPct >= p.limits.maxHighWaterDrawdownPct) blockers.push('HIGH_WATER_DRAWDOWN_LIMIT_REACHED');

  const stopDistance = Math.abs(p.entryPrice - p.stopLoss);
  const correctSide = p.side === 'BUY'
    ? p.stopLoss < p.entryPrice && p.takeProfit > p.entryPrice && p.entryPrice >= p.ask
    : p.stopLoss > p.entryPrice && p.takeProfit < p.entryPrice && p.entryPrice <= p.bid;
  if (!finitePositive(stopDistance) || !correctSide) blockers.push('ENTRY_OR_PROTECTIVE_STOPS_INVALID');
  const rewardRisk = stopDistance > 0 ? Math.abs(p.takeProfit - p.entryPrice) / stopDistance : null;
  if (rewardRisk === null || !Number.isFinite(rewardRisk) || rewardRisk < p.limits.rewardRiskMinimum) {
    blockers.push('REWARD_RISK_BELOW_MINIMUM');
  }
  const stopPoints = stopDistance / p.symbolSpec.point;
  if (stopPoints < p.symbolSpec.stopLevelPoints) blockers.push('BROKER_STOP_LEVEL_NOT_MET');

  const volumeResult = calculateBrokerAwareVolume({
    equity: p.equity,
    riskPct: Math.min(p.requestedRiskPct, p.limits.maxPerTradeRiskPct),
    entryPrice: p.entryPrice,
    stopLoss: p.stopLoss,
    specification: p.symbolSpec,
  });
  if (!volumeResult.valid) blockers.push(volumeResult.reason ?? 'POSITION_SIZE_INVALID');

  const nextMarginUsagePct = p.equity > 0
    ? (p.estimatedMargin / p.equity) * 100
    : Number.POSITIVE_INFINITY;
  if (p.estimatedMargin > p.freeMargin) blockers.push('INSUFFICIENT_FREE_MARGIN');
  if (nextMarginUsagePct > p.limits.maxMarginUsagePct) blockers.push('MARGIN_USAGE_LIMIT_EXCEEDED');

  const projectedPortfolioRiskPct = ((p.currentOpenRiskCash + volumeResult.riskCash) / p.equity) * 100;
  if (projectedPortfolioRiskPct > p.limits.maxPortfolioRiskPct) blockers.push('PORTFOLIO_RISK_LIMIT_EXCEEDED');

  if (blockers.length) return result('REJECT');
  return result('APPROVE', volumeResult.volume, volumeResult.riskCash, rewardRisk);
}
