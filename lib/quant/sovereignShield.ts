export type SovereignShieldStatus = 'NORMAL' | 'ELEVATED_VOLATILITY_HALF_RISK' | 'BLACK_SWAN_LOCKOUT' | 'DATA_UNAVAILABLE';
export type GovernanceState = {
  tradesToday: number | null;
  lossesToday: number | null;
  rollingSevenDayDrawdownPct: number | null;
  ledgerVerified: boolean;
};
export type SovereignShieldInput = {
  vix: number | null;
  intradayRangeAtrMultiple?: number | null;
  spreadMultipleOfSessionBaseline?: number | null;
  eventMinutesAway?: number | null;
  isCentralBankRateDecision?: boolean;
  cotPercentiles?: Array<{ symbol: string; percentile: number | null }>;
  governance: GovernanceState;
};
export type MarketRiskShieldInput = Omit<SovereignShieldInput, 'governance'>;
export type MarketRiskShieldResult = {
  status: SovereignShieldStatus;
  maxAllowedRiskPct: number;
  allowedToTrade: boolean;
  spreadBlowoutBlock: boolean;
  crowdedUnwindRisk: string[];
  blockReasons: string[];
};
export type SovereignShieldResult = MarketRiskShieldResult & {
  governanceVerified: boolean;
};

export function evaluateMarketRiskShield(input: MarketRiskShieldInput): MarketRiskShieldResult {
  const reasons: string[] = [];
  const vix = input.vix;
  const vixAvailable = typeof vix === 'number' && Number.isFinite(vix);
  const volatilityLock = (vixAvailable && vix >= 32)
    || (typeof input.intradayRangeAtrMultiple === 'number'
      && Number.isFinite(input.intradayRangeAtrMultiple) && input.intradayRangeAtrMultiple > 2.5);
  const elevated = !volatilityLock && vixAvailable && vix >= 22;
  const status: SovereignShieldStatus = volatilityLock ? 'BLACK_SWAN_LOCKOUT'
    : !vixAvailable ? 'DATA_UNAVAILABLE'
      : elevated ? 'ELEVATED_VOLATILITY_HALF_RISK' : 'NORMAL';
  let maxAllowedRiskPct = status === 'BLACK_SWAN_LOCKOUT' || status === 'DATA_UNAVAILABLE'
    ? 0 : status === 'ELEVATED_VOLATILITY_HALF_RISK' ? 0.5 : 1;

  if (!vixAvailable) reasons.push('VIX_UNAVAILABLE');
  if (volatilityLock) reasons.push('BLACK_SWAN_VOLATILITY_LOCKOUT');
  if (elevated) reasons.push('ELEVATED_VOLATILITY_HALF_RISK');

  const spreadBlowoutBlock = input.spreadMultipleOfSessionBaseline !== null
    && input.spreadMultipleOfSessionBaseline !== undefined
    && input.spreadMultipleOfSessionBaseline > 2;
  if (spreadBlowoutBlock) reasons.push('SPREAD_BLOWOUT_BLOCK');

  const eventWindow = input.eventMinutesAway !== null && input.eventMinutesAway !== undefined
    && Math.abs(input.eventMinutesAway) <= (input.isCentralBankRateDecision ? 60 : 30);
  if (eventWindow) reasons.push(input.isCentralBankRateDecision
    ? 'CENTRAL_BANK_RATE_DECISION_LOCKOUT' : 'TIER_ONE_EVENT_LOCKOUT');

  const crowdedUnwindRisk = (input.cotPercentiles ?? [])
    .filter((item) => item.percentile !== null && Number.isFinite(item.percentile)
      && (item.percentile >= 90 || item.percentile <= 10))
    .map((item) => item.symbol + ':' + String(item.percentile) + 'PCTL');
  if (crowdedUnwindRisk.length) {
    reasons.push('CROWDED_UNWIND_RISK');
    maxAllowedRiskPct = Math.min(maxAllowedRiskPct, 0.5);
  }

  const hardBlock = status === 'BLACK_SWAN_LOCKOUT' || status === 'DATA_UNAVAILABLE'
    || spreadBlowoutBlock || eventWindow;
  if (hardBlock) maxAllowedRiskPct = 0;

  return {
    status,
    maxAllowedRiskPct,
    allowedToTrade: !hardBlock,
    spreadBlowoutBlock,
    crowdedUnwindRisk,
    blockReasons: reasons,
  };
}

export function evaluateSovereignShield(input: SovereignShieldInput): SovereignShieldResult {
  const market = evaluateMarketRiskShield(input);
  const governance = input.governance;
  const governanceVerified = governance.ledgerVerified
    && governance.tradesToday !== null
    && governance.lossesToday !== null
    && governance.rollingSevenDayDrawdownPct !== null;
  const reasons = [...market.blockReasons];
  if (!governanceVerified) reasons.push('TRADE_GOVERNANCE_LEDGER_UNVERIFIED');
  else {
    if (governance.tradesToday! >= 2) reasons.push('MAX_TRADES_PER_DAY');
    if (governance.lossesToday! >= 2) reasons.push('MAX_LOSSES_PER_DAY');
    if (governance.rollingSevenDayDrawdownPct! <= -4) reasons.push('ROLLING_7D_DRAWDOWN_LIMIT');
  }

  const governanceBlock = !governanceVerified
    || reasons.includes('MAX_TRADES_PER_DAY')
    || reasons.includes('MAX_LOSSES_PER_DAY')
    || reasons.includes('ROLLING_7D_DRAWDOWN_LIMIT');
  const hardBlock = !market.allowedToTrade || governanceBlock;

  return {
    ...market,
    maxAllowedRiskPct: hardBlock ? 0 : market.maxAllowedRiskPct,
    allowedToTrade: !hardBlock,
    blockReasons: reasons,
    governanceVerified,
  };
}
