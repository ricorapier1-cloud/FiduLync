export type SovereignShieldStatus = 'NORMAL' | 'ELEVATED_VOLATILITY' | 'BLACK_SWAN_LOCKOUT';
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
export type SovereignShieldResult = {
  status: SovereignShieldStatus;
  maxAllowedRiskPct: number;
  allowedToTrade: boolean;
  spreadBlowoutBlock: boolean;
  crowdedUnwindRisk: string[];
  blockReasons: string[];
  governanceVerified: boolean;
};

export function evaluateSovereignShield(input: SovereignShieldInput): SovereignShieldResult {
  const reasons: string[] = [];
  const vix = input.vix;
  const volatilityLock = (vix !== null && vix >= 28)
    || (input.intradayRangeAtrMultiple !== null && input.intradayRangeAtrMultiple !== undefined && input.intradayRangeAtrMultiple > 2.5);
  const elevated = !volatilityLock && vix !== null && vix >= 22;
  const status: SovereignShieldStatus = volatilityLock ? 'BLACK_SWAN_LOCKOUT' : elevated ? 'ELEVATED_VOLATILITY' : 'NORMAL';
  let maxAllowedRiskPct = status === 'BLACK_SWAN_LOCKOUT' ? 0 : status === 'ELEVATED_VOLATILITY' ? 0.5 : 1;

  if (vix === null) reasons.push('VIX_UNAVAILABLE');
  if (volatilityLock) reasons.push('BLACK_SWAN_VOLATILITY_LOCKOUT');
  if (elevated) reasons.push('ELEVATED_VOLATILITY_HALF_RISK');

  const spreadBlowoutBlock = input.spreadMultipleOfSessionBaseline !== null
    && input.spreadMultipleOfSessionBaseline !== undefined
    && input.spreadMultipleOfSessionBaseline > 2;
  if (spreadBlowoutBlock) reasons.push('SPREAD_BLOWOUT_BLOCK');

  const eventWindow = input.eventMinutesAway !== null && input.eventMinutesAway !== undefined
    && Math.abs(input.eventMinutesAway) <= (input.isCentralBankRateDecision ? 60 : 30);
  if (eventWindow) reasons.push(input.isCentralBankRateDecision ? 'CENTRAL_BANK_RATE_DECISION_LOCKOUT' : 'TIER_ONE_EVENT_LOCKOUT');

  const crowdedUnwindRisk = (input.cotPercentiles ?? [])
    .filter((item) => item.percentile !== null && (item.percentile >= 90 || item.percentile <= 10))
    .map((item) => item.symbol + ':' + String(item.percentile) + 'PCTL');
  if (crowdedUnwindRisk.length) reasons.push('CROWDED_UNWIND_RISK');

  const governance = input.governance;
  const governanceVerified = governance.ledgerVerified
    && governance.tradesToday !== null
    && governance.lossesToday !== null
    && governance.rollingSevenDayDrawdownPct !== null;
  if (!governanceVerified) reasons.push('TRADE_GOVERNANCE_LEDGER_UNVERIFIED');
  else {
    if (governance.tradesToday! >= 2) reasons.push('MAX_TRADES_PER_DAY');
    if (governance.lossesToday! >= 2) reasons.push('MAX_LOSSES_PER_DAY');
    if (governance.rollingSevenDayDrawdownPct! <= -4) reasons.push('ROLLING_7D_DRAWDOWN_LIMIT');
  }

  const hardBlock = status === 'BLACK_SWAN_LOCKOUT'
    || spreadBlowoutBlock
    || eventWindow
    || !governanceVerified
    || reasons.includes('MAX_TRADES_PER_DAY')
    || reasons.includes('MAX_LOSSES_PER_DAY')
    || reasons.includes('ROLLING_7D_DRAWDOWN_LIMIT');
  if (hardBlock) maxAllowedRiskPct = 0;

  return {
    status,
    maxAllowedRiskPct,
    allowedToTrade: !hardBlock,
    spreadBlowoutBlock,
    crowdedUnwindRisk,
    blockReasons: reasons,
    governanceVerified,
  };
}
