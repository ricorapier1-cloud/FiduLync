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
  requestedRiskPct: number;
};

/**
 * Trusted account/market context assembled by the server from the authenticated
 * installation, persisted MT5 telemetry and server-side data-quality checks.
 * Never accept this object from an EA or browser request body.
 */
export type RiskContext = {
  bid: number;
  ask: number;
  quoteAgeMs: number;
  spreadPoints: number;
  atrPrice: number;
  equity: number;
  freeMargin: number;
  usedMargin: number;
  estimatedMargin: number;
  currentOpenRiskCash: number;
  dailyStartEquity: number;
  weeklyStartEquity: number;
  highWaterMarkEquity: number;
  consecutiveLosses: number;
  regime: GovernanceRegime;
  marketDataHealth: DataHealth;
  macroDataHealth: DataHealth;
  newsLockout: boolean;
  symbolSpec: BrokerSymbolSpecification;
};

export type RiskPolicy = {
  /** Server-owned policy identifier; never accept this object from an EA/client. */
  policyVersion: string;
  executionEnabled: boolean;
  modelValidated: boolean;
  executionQualityVerified: boolean;
  maxPerTradeRiskPct: number;
  maxPortfolioRiskPct: number;
  maxDailyDrawdownPct: number;
  maxWeeklyDrawdownPct: number;
  maxHighWaterDrawdownPct: number;
  maxMarginUsagePct: number;
  maxSpreadPoints: number;
  maxSpreadAtrRatio: number;
  maxQuoteAgeMs: number;
  maxConsecutiveLosses: number;
  rewardRiskMinimum: number;
};

/** Reject stale, future-dated or account-snapshot-misaligned risk anchors. */
export function isRiskAnchorFresh(
  updatedAt: string,
  lastSnapshotAt: string,
  accountSnapshotAt: string,
  now = Date.now(),
  maxAgeMs = 30_000,
  alignmentToleranceMs = 5_000,
): boolean {
  const updated = Date.parse(updatedAt);
  const anchorSnapshot = Date.parse(lastSnapshotAt);
  const accountSnapshot = Date.parse(accountSnapshotAt);
  if (![updated, anchorSnapshot, accountSnapshot, now, maxAgeMs, alignmentToleranceMs].every(Number.isFinite)
    || maxAgeMs <= 0 || alignmentToleranceMs < 0) return false;
  return now - updated >= 0 && now - updated <= maxAgeMs
    && now - anchorSnapshot >= 0 && now - anchorSnapshot <= maxAgeMs
    && Math.abs(anchorSnapshot - accountSnapshot) <= alignmentToleranceMs;
}

export type ClosedBar = { high: number; low: number; close: number };

/** ATR over closed bars only. Input must be chronological and contain period + 1 bars. */
export function calculateTrueRangeAtr(bars: ClosedBar[], period = 14): number | null {
  if (!Number.isInteger(period) || period < 2 || bars.length < period + 1) return null;
  if (!bars.every((bar) => finitePositive(bar.high) && finitePositive(bar.low) && finitePositive(bar.close) && bar.high >= bar.low)) return null;
  const ranges: number[] = [];
  for (let index = 1; index < bars.length; index += 1) {
    const current = bars[index];
    const previousClose = bars[index - 1].close;
    ranges.push(Math.max(current.high - current.low, Math.abs(current.high - previousClose), Math.abs(current.low - previousClose)));
  }
  const recent = ranges.slice(-period);
  const atr = recent.reduce((sum, value) => sum + value, 0) / period;
  return finitePositive(atr) ? atr : null;
}

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
  const actualRisk = Number((stepped * riskPerLot).toFixed(8));
  if (!Number.isFinite(actualRisk) || actualRisk > riskCash * (1 + 1e-10)) {
    return { volume: 0, riskCash, valid: false, reason: 'ROUNDED_VOLUME_EXCEEDS_RISK_BUDGET' };
  }
  return { volume: stepped, riskCash: actualRisk, valid: true, reason: null };
}

function validateProposalShape(p: RiskProposal, ctx: RiskContext, policy: RiskPolicy): string[] {
  const issues: string[] = [];
  if (!p.requestId?.trim() || !p.installationId?.trim() || !p.symbol?.trim()) issues.push('IDENTITY_FIELDS_MISSING');
  if (!['BUY', 'SELL'].includes(p.side)) issues.push('INVALID_ORDER_SIDE');
  if (!['TRENDING_EXPANSION', 'MEAN_REVERTING', 'HIGH_VOL_CHOP', 'UNAVAILABLE'].includes(ctx.regime)) issues.push('INVALID_MARKET_REGIME');
  if (!['LIVE', 'DELAYED', 'REFERENCE', 'STALE', 'UNAVAILABLE'].includes(ctx.marketDataHealth)
    || !['LIVE', 'DELAYED', 'REFERENCE', 'STALE', 'UNAVAILABLE'].includes(ctx.macroDataHealth)) issues.push('INVALID_DATA_HEALTH_STATE');
  const required = [p.entryPrice, p.stopLoss, p.takeProfit, ctx.bid, ctx.ask, ctx.quoteAgeMs,
    ctx.spreadPoints, ctx.atrPrice, ctx.equity, ctx.freeMargin, ctx.usedMargin, ctx.estimatedMargin, ctx.currentOpenRiskCash,
    ctx.dailyStartEquity, ctx.weeklyStartEquity, ctx.highWaterMarkEquity, ctx.consecutiveLosses,
    p.requestedRiskPct, policy.maxPerTradeRiskPct, policy.maxPortfolioRiskPct,
    policy.maxDailyDrawdownPct, policy.maxWeeklyDrawdownPct,
    policy.maxHighWaterDrawdownPct, policy.maxMarginUsagePct, policy.maxSpreadPoints,
    policy.maxQuoteAgeMs, policy.maxConsecutiveLosses, policy.rewardRiskMinimum];
  if (!required.every(Number.isFinite)) issues.push('NON_FINITE_OR_MISSING_NUMERIC_INPUT');
  if (!finitePositive(p.entryPrice) || !finitePositive(p.stopLoss) || !finitePositive(p.takeProfit)
    || p.requestedRiskPct > 100) issues.push('PROPOSAL_PRICE_OR_RISK_INVALID');
  if (ctx.quoteAgeMs < 0 || ctx.spreadPoints < 0 || !Number.isInteger(ctx.consecutiveLosses)
    || ctx.consecutiveLosses < 0 || typeof ctx.newsLockout !== 'boolean') {
    issues.push('MARKET_OR_ACCOUNT_CONTEXT_INVALID');
  }
  if (!finitePositive(ctx.equity) || !finitePositive(ctx.dailyStartEquity)
    || !finitePositive(ctx.weeklyStartEquity) || !finitePositive(ctx.highWaterMarkEquity)) {
    issues.push('ACCOUNT_EQUITY_STATE_INVALID');
  }
  if (ctx.bid <= 0 || ctx.ask <= 0 || ctx.ask < ctx.bid) issues.push('INVALID_BID_ASK');
  if (p.symbol !== ctx.symbolSpec.symbol) issues.push('BROKER_SYMBOL_MISMATCH');
  if (!Number.isFinite(ctx.symbolSpec.stopLevelPoints) || ctx.symbolSpec.stopLevelPoints < 0
    || !finitePositive(ctx.symbolSpec.point)) issues.push('BROKER_STOP_METADATA_INVALID');
  if (ctx.freeMargin < 0 || ctx.usedMargin < 0 || ctx.estimatedMargin < 0 || ctx.currentOpenRiskCash < 0) issues.push('INVALID_ACCOUNT_EXPOSURE');
  if (p.requestedRiskPct <= 0 || policy.maxPerTradeRiskPct <= 0 || policy.maxPerTradeRiskPct > 100
    || policy.maxPortfolioRiskPct <= 0 || policy.maxPortfolioRiskPct > 100) issues.push('RISK_LIMITS_INVALID');
  if (policy.maxMarginUsagePct <= 0 || policy.maxMarginUsagePct > 100
    || policy.maxDailyDrawdownPct <= 0 || policy.maxDailyDrawdownPct > 100
    || policy.maxWeeklyDrawdownPct <= 0 || policy.maxWeeklyDrawdownPct > 100
    || policy.maxHighWaterDrawdownPct <= 0 || policy.maxHighWaterDrawdownPct > 100
    || policy.maxSpreadPoints <= 0 || policy.maxSpreadAtrRatio <= 0 || policy.maxQuoteAgeMs <= 0
    || !Number.isInteger(policy.maxConsecutiveLosses) || policy.maxConsecutiveLosses <= 0
    || policy.rewardRiskMinimum <= 0) {
    issues.push('PROTECTIVE_LIMITS_INVALID');
  }
  return issues;
}

/**
 * Deterministic, fail-closed pre-trade decision. APPROVE is a short-lived
 * supervisory permission only; the EA must recheck quote, stops and local
 * protections before dispatch and attach broker-side SL/TP.
 */
export function evaluateRiskProposal(p: RiskProposal, ctx: RiskContext, policy: RiskPolicy, now = Date.now()): RiskGovernanceResult {
  const blockers = validateProposalShape(p, ctx, policy);
  const result = (decision: GovernanceDecision, volume = 0, riskCash = 0, rr: number | null = null): RiskGovernanceResult => ({
    schemaVersion: '1.0',
    requestId: typeof p.requestId === 'string' ? p.requestId : '',
    decision,
    approvedRiskPct: decision === 'APPROVE' ? Math.min(p.requestedRiskPct, policy.maxPerTradeRiskPct) : 0,
    approvedVolume: decision === 'APPROVE' ? volume : 0,
    estimatedRiskCash: decision === 'APPROVE' ? riskCash : 0,
    estimatedRewardRisk: rr,
    blockers: [...new Set(blockers)],
    evaluatedAt: new Date(now).toISOString(),
  });
  if (blockers.length) return result('ABSTAIN');

  if (!policy.executionEnabled) blockers.push('EXECUTION_NOT_ENABLED_BY_OWNER');
  if (!policy.modelValidated) blockers.push('MODEL_NOT_OUT_OF_SAMPLE_VALIDATED');
  if (!policy.executionQualityVerified) blockers.push('EXECUTION_QUALITY_NOT_VERIFIED');
  if (!ctx.symbolSpec.verified) blockers.push('BROKER_SYMBOL_SPEC_NOT_VERIFIED');
  if (ctx.marketDataHealth !== 'LIVE') blockers.push('MARKET_DATA_NOT_LIVE');
  if (ctx.macroDataHealth !== 'LIVE') blockers.push('MACRO_DATA_NOT_LIVE');
  if (ctx.quoteAgeMs > policy.maxQuoteAgeMs) blockers.push('QUOTE_STALE');
  if (ctx.spreadPoints > policy.maxSpreadPoints) blockers.push('SPREAD_LIMIT_EXCEEDED');
  const spreadToAtrRatio = (ctx.spreadPoints * ctx.symbolSpec.point) / ctx.atrPrice;
  if (!Number.isFinite(spreadToAtrRatio) || spreadToAtrRatio > policy.maxSpreadAtrRatio) {
    blockers.push('SPREAD_TO_ATR_LIMIT_EXCEEDED');
  }
  if (ctx.newsLockout) blockers.push('HIGH_IMPACT_NEWS_LOCKOUT');
  if (ctx.regime === 'HIGH_VOL_CHOP') blockers.push('HIGH_VOLATILITY_CHOP');
  if (ctx.regime === 'UNAVAILABLE') blockers.push('MARKET_REGIME_UNAVAILABLE');
  if (ctx.consecutiveLosses >= policy.maxConsecutiveLosses) blockers.push('LOSS_STREAK_LIMIT_REACHED');

  const dataDegraded = blockers.some((item) => ['MARKET_DATA_NOT_LIVE', 'MACRO_DATA_NOT_LIVE', 'QUOTE_STALE'].includes(item));
  if (dataDegraded) return result('DEGRADED');

  const dailyDrawdownPct = Math.max(0, (ctx.dailyStartEquity - ctx.equity) / ctx.dailyStartEquity * 100);
  const weeklyDrawdownPct = Math.max(0, (ctx.weeklyStartEquity - ctx.equity) / ctx.weeklyStartEquity * 100);
  const highWaterDrawdownPct = Math.max(0, (ctx.highWaterMarkEquity - ctx.equity) / ctx.highWaterMarkEquity * 100);
  if (dailyDrawdownPct >= policy.maxDailyDrawdownPct) blockers.push('DAILY_DRAWDOWN_LIMIT_REACHED');
  if (weeklyDrawdownPct >= policy.maxWeeklyDrawdownPct) blockers.push('WEEKLY_DRAWDOWN_LIMIT_REACHED');
  if (highWaterDrawdownPct >= policy.maxHighWaterDrawdownPct) blockers.push('HIGH_WATER_DRAWDOWN_LIMIT_REACHED');

  const stopDistance = Math.abs(p.entryPrice - p.stopLoss);
  const correctSide = p.side === 'BUY'
    ? p.stopLoss < p.entryPrice && p.takeProfit > p.entryPrice && p.entryPrice >= ctx.ask
    : p.stopLoss > p.entryPrice && p.takeProfit < p.entryPrice && p.entryPrice <= ctx.bid;
  if (!finitePositive(stopDistance) || !correctSide) blockers.push('ENTRY_OR_PROTECTIVE_STOPS_INVALID');
  const rewardRisk = stopDistance > 0 ? Math.abs(p.takeProfit - p.entryPrice) / stopDistance : null;
  if (rewardRisk === null || !Number.isFinite(rewardRisk) || rewardRisk < policy.rewardRiskMinimum) {
    blockers.push('REWARD_RISK_BELOW_MINIMUM');
  }
  const stopPoints = stopDistance / ctx.symbolSpec.point;
  if (stopPoints < ctx.symbolSpec.stopLevelPoints) blockers.push('BROKER_STOP_LEVEL_NOT_MET');

  const volumeResult = calculateBrokerAwareVolume({
    equity: ctx.equity,
    riskPct: Math.min(p.requestedRiskPct, policy.maxPerTradeRiskPct),
    entryPrice: p.entryPrice,
    stopLoss: p.stopLoss,
    specification: ctx.symbolSpec,
  });
  if (!volumeResult.valid) blockers.push(volumeResult.reason ?? 'POSITION_SIZE_INVALID');

  const nextMarginUsagePct = ctx.equity > 0
    ? ((ctx.usedMargin + ctx.estimatedMargin) / ctx.equity) * 100
    : Number.POSITIVE_INFINITY;
  if (ctx.estimatedMargin > ctx.freeMargin) blockers.push('INSUFFICIENT_FREE_MARGIN');
  if (nextMarginUsagePct > policy.maxMarginUsagePct) blockers.push('MARGIN_USAGE_LIMIT_EXCEEDED');

  const projectedPortfolioRiskPct = ((ctx.currentOpenRiskCash + volumeResult.riskCash) / ctx.equity) * 100;
  if (projectedPortfolioRiskPct > policy.maxPortfolioRiskPct) blockers.push('PORTFOLIO_RISK_LIMIT_EXCEEDED');

  if (blockers.length) return result('REJECT');
  return result('APPROVE', volumeResult.volume, volumeResult.riskCash, rewardRisk);
}
