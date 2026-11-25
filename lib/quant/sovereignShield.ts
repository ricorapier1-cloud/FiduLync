export type TailRiskStatus = 'NORMAL' | 'ELEVATED_VOLATILITY' | 'BLACK_SWAN_LOCKOUT';

export type SovereignShieldInput = {
  vix: number | null;
  intradayRange: number | null;
  atr20: number | null;
  spreadRatio: number | null;
  minutesToHighImpactEvent: number | null;
  minutesToRateDecision: number | null;
  cotPercentiles: Record<string, number | null>;
  rollingSevenDayDrawdownPct: number | null;
  tradesToday: number | null;
  lossesToday: number | null;
};

export type SovereignShieldResult = {
  status: TailRiskStatus;
  maxAllowedRiskPct: number;
  allowedToTrade: boolean;
  spreadBlowoutBlock: boolean;
  crowdedUnwindRisk: string[];
  blockReasons: string[];
  warnings: string[];
  dataGaps: string[];
};

export function evaluateSovereignShield(input: SovereignShieldInput): SovereignShieldResult {
  const blockReasons: string[] = [];
  const warnings: string[] = [];
  const dataGaps: string[] = [];
  let status: TailRiskStatus = 'NORMAL';
  let maxAllowedRiskPct = 1;

  if (input.vix === null || !Number.isFinite(input.vix)) dataGaps.push('CBOE VIX unavailable');
  else if (input.vix >= 28) {
    status = 'BLACK_SWAN_LOCKOUT';
    maxAllowedRiskPct = 0;
    blockReasons.push('VIX_AT_OR_ABOVE_28');
  } else if (input.vix >= 22) {
    status = 'ELEVATED_VOLATILITY';
    maxAllowedRiskPct = 0.5;
    warnings.push('VIX_ELEVATED_HALF_RISK');
  }

  if (input.intradayRange === null || input.atr20 === null || input.atr20 <= 0) dataGaps.push('Intraday range / 20-day ATR unavailable');
  else if (input.intradayRange > 2.5 * input.atr20) {
    status = 'BLACK_SWAN_LOCKOUT';
    maxAllowedRiskPct = 0;
    blockReasons.push('INTRADAY_RANGE_EXCEEDS_2_5X_ATR');
  }

  const spreadBlowoutBlock = input.spreadRatio !== null && input.spreadRatio > 2;
  if (input.spreadRatio === null) dataGaps.push('Normal session spread baseline unavailable');
  if (spreadBlowoutBlock) blockReasons.push('SPREAD_BLOWOUT_BLOCK');

  if (input.minutesToHighImpactEvent !== null && Math.abs(input.minutesToHighImpactEvent) <= 30) blockReasons.push('TIER_1_EVENT_LOCKOUT_30M');
  if (input.minutesToRateDecision !== null && Math.abs(input.minutesToRateDecision) <= 60) blockReasons.push('CENTRAL_BANK_RATE_DECISION_LOCKOUT_60M');

  const crowdedUnwindRisk = Object.entries(input.cotPercentiles)
    .filter(([, percentile]) => percentile !== null && (percentile >= 90 || percentile <= 10))
    .map(([currency, percentile]) => currency + ':' + percentile + '%ile');
  if (crowdedUnwindRisk.length) warnings.push('CROWDED_UNWIND_RISK');

  if (input.tradesToday === null || input.lossesToday === null) dataGaps.push('Authoritative daily trade/loss ledger unavailable');
  else {
    if (input.tradesToday >= 2) blockReasons.push('MAX_2_TRADES_PER_DAY');
    if (input.lossesToday >= 2) blockReasons.push('MAX_2_LOSSES_PER_DAY');
  }
  if (input.rollingSevenDayDrawdownPct === null) dataGaps.push('Authoritative rolling 7-day drawdown unavailable');
  else if (input.rollingSevenDayDrawdownPct <= -4) blockReasons.push('ROLLING_7D_DRAWDOWN_LIMIT');

  if (status === 'BLACK_SWAN_LOCKOUT') maxAllowedRiskPct = 0;
  const authoritativeLedgerUnavailable = input.tradesToday === null || input.lossesToday === null || input.rollingSevenDayDrawdownPct === null;
  if (authoritativeLedgerUnavailable) blockReasons.push('AUTHORITATIVE_ACCOUNT_RISK_LEDGER_UNAVAILABLE');
  const hardBlocked = status === 'BLACK_SWAN_LOCKOUT' || blockReasons.length > 0;
  return { status, maxAllowedRiskPct, allowedToTrade: !hardBlocked, spreadBlowoutBlock, crowdedUnwindRisk, blockReasons, warnings, dataGaps };
}
