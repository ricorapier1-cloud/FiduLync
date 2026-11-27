import {
  calculateAtr,
  calculateKaufmanEfficiencyRatio,
  estimateHurstExponent,
  type OhlcvBar,
} from '@/lib/quant/technicalConfluence';
import type { MarketRiskShieldResult } from '@/lib/quant/sovereignShield';

export type IntradaySignalState = 'ACTIVE_SETUP' | 'FORMING_PULLBACK' | 'WAIT_NO_SETUP' | 'SHIELD_BLOCKED';
export type SignalDirection = 'BUY' | 'SELL' | 'NONE';
export type IntradaySignal = {
  symbol: string;
  signalState: IntradaySignalState;
  direction: SignalDirection;
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit1: number | null;
  takeProfit2: number | null;
  slPips: number | null;
  confluenceScore: number;
  triggerRationale: string;
  macroScore: number | null;
  hurst: number | null;
  ker: number | null;
  atr14: number | null;
  atrUnit: 'PIPS' | 'USD';
  session: 'LONDON' | 'NEW_YORK' | 'CLOSED';
  dataAsOfUtc: string | null;
  blockers: string[];
  spreadBaselineStatus?: 'CONFIGURED_REFERENCE' | 'AVAILABLE' | 'UNAVAILABLE';
  spreadBaselineObservations?: number;
  spreadMultipleOfBaseline?: number | null;
  sovereignShieldStatus?: MarketRiskShieldResult['status'] | null;
  marketRiskCeilingPct?: number;
  marketShieldFlags?: string[];
  zScore: number | null;
  zScoreZone: 'DISCOUNT_PULLBACK' | 'PREMIUM_PULLBACK' | 'EXTENDED' | 'NEUTRAL' | 'UNAVAILABLE';
  hurstRegime: 'TREND_CONTINUATION' | 'MEAN_REVERSION_ONLY' | 'RANDOM_WALK_NOISE' | 'UNAVAILABLE';
  adr14: number | null;
  adrUsedPct: number | null;
  pdh: number | null;
  pdl: number | null;
  asianRangeHigh: number | null;
  asianRangeLow: number | null;
};
export type IntradaySignalInput = {
  symbol: string;
  macroScore: number | null;
  intradayBars: OhlcvBar[];
  dailyBars: OhlcvBar[];
  quoteMid: number | null;
  quoteTimestampUtc: string | null;
  vix: number | null;
  calendarVerified: boolean;
  eventMinutesAway: number | null;
  rateDecision: boolean;
  spreadMultipleOfBaseline: number | null;
  session: 'LONDON' | 'NEW_YORK' | 'CLOSED';
  nowUtc?: string;
  marketShield?: MarketRiskShieldResult;
};

const round = (value: number, digits: number) => Number(value.toFixed(digits));
const finite = (value: number | null): value is number => value !== null && Number.isFinite(value);
const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

function ema(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const alpha = 2 / (period + 1);
  let current = mean(values.slice(0, period));
  if (current === null) return null;
  for (const value of values.slice(period)) current = value * alpha + current * (1 - alpha);
  return current;
}

function vwap(bars: OhlcvBar[]): number | null {
  const window = bars.slice(-20);
  const usable = window.filter((bar) => finite(bar.volume) && bar.volume > 0);
  const volume = usable.reduce((sum, bar) => sum + (bar.volume ?? 0), 0);
  return volume > 0 ? usable.reduce((sum, bar) => sum + ((bar.high + bar.low + bar.close) / 3) * (bar.volume ?? 0), 0) / volume : null;
}

function watDateForSignal(timestamp: string): string {\n  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(timestamp));\n}\n\nfunction watHour(timestamp: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(timestamp));
  return Number(parts.find((part) => part.type === 'hour')?.value ?? -1)
    + Number(parts.find((part) => part.type === 'minute')?.value ?? 0) / 60;
}

function hourInZone(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  return Number(parts.find((part) => part.type === 'hour')?.value ?? -1)
    + Number(parts.find((part) => part.type === 'minute')?.value ?? 0) / 60;
}

export function classifyWATSession(now = new Date()): 'LONDON' | 'NEW_YORK' | 'CLOSED' {
  if (watHour(now.toISOString()) >= 8 && watHour(now.toISOString()) < 12) return 'LONDON';
  const newYorkHour = hourInZone(now, 'America/New_York');
  if (newYorkHour >= 8 && newYorkHour < 12) return 'NEW_YORK';
  return 'CLOSED';
}

export function buildIntradaySignal(input: IntradaySignalInput): IntradaySignal {
  const symbol = input.symbol.toUpperCase();
  const isGold = symbol === 'XAUUSD';
  const digits = isGold ? 2 : symbol.endsWith('JPY') ? 3 : 5;
  const pipSize = isGold ? 1 : symbol.endsWith('JPY') ? 0.01 : 0.0001;
  const now = input.nowUtc ?? new Date().toISOString();
  const blockers: string[] = [];
  const direction: SignalDirection = input.macroScore !== null && input.macroScore >= (isGold ? 20 : 25) ? 'BUY'
    : input.macroScore !== null && input.macroScore <= (isGold ? -20 : -25) ? 'SELL' : 'NONE';
  const bars = input.intradayBars;
  const daily = input.dailyBars;
  const closes = bars.map((bar) => bar.close);
  // Hurst remains unavailable to the execution desk until its estimator is independently validated.
  const hurst = estimateHurstExponent(closes);
  const ker = calculateKaufmanEfficiencyRatio(closes, 14);
  const atr = calculateAtr(daily, 14);
  const zWindow = closes.slice(-20);
  const zMean = zWindow.length === 20 ? mean(zWindow) : null;
  const zVariance = zMean === null ? null : mean(zWindow.map((value) => (value - zMean) ** 2));
  const zScore = zMean !== null && zVariance !== null && zVariance > 0 && finite(input.quoteMid)
    ? (input.quoteMid - zMean) / Math.sqrt(zVariance) : null;
  const completedDaily = daily.length >= 15 ? daily.slice(-15, -1) : [];
  const adrRanges = completedDaily.map((bar) => bar.high - bar.low).filter((value) => Number.isFinite(value) && value > 0);
  const adr14 = adrRanges.length === 14 ? mean(adrRanges) : null;
  const todayWAT = watDateForSignal(now);
  const todayBars = bars.filter((bar) => watDateForSignal(bar.timestampUtc) === todayWAT);
  const todayRange = todayBars.length ? Math.max(...todayBars.map((bar) => bar.high)) - Math.min(...todayBars.map((bar) => bar.low)) : null;
  const adrUsedPct = adr14 !== null && todayRange !== null && adr14 > 0 ? todayRange / adr14 * 100 : null;
  const priorDay = daily.length >= 2 ? daily.at(-2)! : null;
  const asianBars = bars.filter((bar) => watDateForSignal(bar.timestampUtc) === todayWAT && watHour(bar.timestampUtc) < 8);
  const asianRangeHigh = asianBars.length ? Math.max(...asianBars.map((bar) => bar.high)) : null;
  const asianRangeLow = asianBars.length ? Math.min(...asianBars.map((bar) => bar.low)) : null;
  const hurstRegime = hurst === null ? 'UNAVAILABLE' as const : hurst < 0.45 ? 'MEAN_REVERSION_ONLY' as const : hurst > 0.52 ? 'TREND_CONTINUATION' as const : 'RANDOM_WALK_NOISE' as const;
  const zScoreZone = zScore === null ? 'UNAVAILABLE' as const : Math.abs(zScore) > 2.5 ? 'EXTENDED' as const
    : direction === 'BUY' && zScore <= -1 && zScore >= -2 ? 'DISCOUNT_PULLBACK' as const
      : direction === 'SELL' && zScore >= 1 && zScore <= 2 ? 'PREMIUM_PULLBACK' as const : 'NEUTRAL' as const;
  const latest = bars.at(-1);
  const quoteAge = input.quoteTimestampUtc ? Date.parse(now) - Date.parse(input.quoteTimestampUtc) : Number.POSITIVE_INFINITY;
  const candleAge = latest ? Date.parse(now) - Date.parse(latest.timestampUtc) : Number.POSITIVE_INFINITY;
  const price = finite(input.quoteMid) && input.quoteMid > 0 ? input.quoteMid : latest?.close ?? null;
  const session = input.session;

  if (input.vix === null) blockers.push('VIX_UNAVAILABLE');
  if (input.marketShield && !input.marketShield.marketConditionsClear) blockers.push(...input.marketShield.blockReasons);
  else if (input.vix >= 32) blockers.push('VIX_BLACK_SWAN_LOCKOUT');
  if (!input.calendarVerified) blockers.push('CALENDAR_UNVERIFIED');
  if (input.eventMinutesAway !== null && Math.abs(input.eventMinutesAway) <= (input.rateDecision ? 60 : 30)) blockers.push(input.rateDecision ? 'RATE_DECISION_LOCKOUT' : 'TIER_ONE_EVENT_LOCKOUT');
  if (session === 'CLOSED') blockers.push('OUTSIDE_LONDON_NEW_YORK_WAT_WINDOWS');
  if (input.spreadMultipleOfBaseline === null) blockers.push('SPREAD_BASELINE_UNAVAILABLE');
  else if (input.spreadMultipleOfBaseline > 2) blockers.push('SPREAD_BLOWOUT_BLOCK');
  if (!finite(input.quoteMid) || !input.quoteTimestampUtc || !Number.isFinite(quoteAge) || quoteAge < -30_000 || quoteAge > 60_000) blockers.push('LIVE_BBO_UNAVAILABLE_OR_STALE');
  if (!Number.isFinite(candleAge) || candleAge < -60_000 || candleAge > 15 * 60_000) blockers.push('INTRADAY_CANDLES_STALE');
  if (direction === 'NONE') blockers.push(`MACRO_SCORE_BELOW_${isGold ? 20 : 25}_THRESHOLD`);
  if (bars.length < 60 || daily.length < 15 || !finite(ker) || !finite(atr)) blockers.push('OHLCV_HISTORY_INSUFFICIENT');
  if (finite(ker) && ker < 0.30) blockers.push('KER_BELOW_0_30');\n  if (hurst === null) blockers.push('HURST_UNAVAILABLE');\n  else if (hurst <= 0.52) blockers.push(hurst < 0.45 ? 'MEAN_REVERSION_ONLY' : 'HURST_NOT_TREND_PERSISTENT');\n  if (zScore === null) blockers.push('ZSCORE_UNAVAILABLE');\n  else if (Math.abs(zScore) > 2.5) blockers.push('ZSCORE_ENTRY_TOO_EXTENDED');\n  else if (direction !== 'NONE' && zScoreZone !== (direction === 'BUY' ? 'DISCOUNT_PULLBACK' : 'PREMIUM_PULLBACK')) blockers.push('WAIT_FOR_STATISTICAL_PULLBACK');\n  if (adrUsedPct === null) blockers.push('ADR_HISTORY_UNAVAILABLE');\n  else if (adrUsedPct >= 85) blockers.push('ADR_EXHAUSTED_WAIT_PULLBACK');

  const empty = (state: IntradaySignalState, rationale: string): IntradaySignal => ({
    symbol, signalState: state, direction: state === 'SHIELD_BLOCKED' ? 'NONE' : direction,
    entryPrice: null, stopLoss: null, takeProfit1: null, takeProfit2: null, slPips: null,
    confluenceScore: 0, triggerRationale: rationale, macroScore: input.macroScore,
    hurst, ker, atr14: atr, atrUnit: isGold ? 'USD' : 'PIPS', session,
    dataAsOfUtc: latest?.timestampUtc ?? null, blockers: [...new Set(blockers)],
    sovereignShieldStatus: input.marketShield?.status ?? null,
    marketRiskCeilingPct: input.marketShield?.maxAllowedRiskPct ?? 0,
    marketShieldFlags: input.marketShield?.blockReasons ?? [],\n    zScore, zScoreZone, hurstRegime, adr14, adrUsedPct,\n    pdh: priorDay?.high ?? null, pdl: priorDay?.low ?? null, asianRangeHigh, asianRangeLow,\n  });
  if (input.marketShield && !input.marketShield.marketConditionsClear) return empty('SHIELD_BLOCKED', 'Sovereign market-risk shield is blocking this setup.');
  if (blockers.some((item) => ['VIX_UNAVAILABLE', 'VIX_BLACK_SWAN_LOCKOUT', 'CALENDAR_UNVERIFIED', 'RATE_DECISION_LOCKOUT', 'TIER_ONE_EVENT_LOCKOUT', 'OUTSIDE_LONDON_NEW_YORK_WAT_WINDOWS', 'SPREAD_BASELINE_UNAVAILABLE', 'SPREAD_BLOWOUT_BLOCK', 'LIVE_BBO_UNAVAILABLE_OR_STALE', 'INTRADAY_CANDLES_STALE'].includes(item))) {
    return empty('SHIELD_BLOCKED', 'Sovereign Shield or live market-data gate is not clear.');
  }
  if (blockers.length) return empty('WAIT_NO_SETUP', 'Macro, OHLCV history or trend-quality confirmation is insufficient.');

  const sessionTimeZone = session === 'LONDON' ? 'Africa/Lagos' : 'America/New_York';
  const latestSessionDate = latest
    ? new Intl.DateTimeFormat('en-CA', { timeZone: sessionTimeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(latest.timestampUtc))
    : '';
  const sessionReference = bars.filter((bar) => {
    const timestamp = new Date(bar.timestampUtc);
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: sessionTimeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(timestamp);
    const hour = hourInZone(timestamp, sessionTimeZone);
    return date === latestSessionDate && hour < 8;
  });
  const prior = sessionReference.length ? sessionReference : bars.slice(-13, -1);
  const priorHigh = Math.max(...prior.map((bar) => bar.high));
  const priorLow = Math.min(...prior.map((bar) => bar.low));
  const sweptHigh = Boolean(latest && latest.high > priorHigh && latest.close < priorHigh);
  const sweptLow = Boolean(latest && latest.low < priorLow && latest.close > priorLow);
  const valueEma = ema(closes, 20);
  const valueVwap = vwap(bars);
  const valueZone = valueEma !== null && valueVwap !== null && atr !== null
    && Math.abs(price! - valueEma) <= atr * 0.18 && Math.abs(price! - valueVwap) <= atr * 0.18;
  const alignedTrigger = direction === 'BUY'
    ? (sweptLow || (valueZone && latest!.close > latest!.open))
    : (sweptHigh || (valueZone && latest!.close < latest!.open));
  const swing = direction === 'BUY' ? Math.min(...bars.slice(-12).map((bar) => bar.low))
    : Math.max(...bars.slice(-12).map((bar) => bar.high));
  const stopAtrMultiple = finite(input.vix) && input.vix >= 25 ? 1.5 : 1.35;
  const riskDistance = Math.max(atr! * stopAtrMultiple, direction === 'BUY' ? price! - swing : swing - price!);
  if (!Number.isFinite(riskDistance) || riskDistance <= 0) return empty('WAIT_NO_SETUP', 'No valid swing invalidation distance.');
  const stopLoss = direction === 'BUY' ? price! - riskDistance : price! + riskDistance;
  const takeProfit1 = direction === 'BUY' ? price! + riskDistance * 2 : price! - riskDistance * 2;
  const takeProfit2 = direction === 'BUY' ? price! + riskDistance * 3 : price! - riskDistance * 3;
  const score = Math.min(100, Math.round(25 + (Math.abs(input.macroScore ?? 0) / 100) * 20 + (ker! * 25) + (alignedTrigger ? 15 : 0)));
  const shieldCap = input.marketShield?.maxAllowedRiskPct ?? 0;
  const rationale = `${direction} Macro (${input.macroScore}) + ${sweptLow ? 'prior-session low sweep' : sweptHigh ? 'prior-session high sweep' : valueZone ? 'EMA20/VWAP value-zone pullback' : 'trend aligned'} + KER ${ker!.toFixed(2)} + ${stopAtrMultiple.toFixed(2)}x daily ATR stop · market risk ceiling ${shieldCap.toFixed(2)}% · Hurst unavailable pending validation`;
  return {
    symbol, signalState: alignedTrigger ? 'ACTIVE_SETUP' : 'FORMING_PULLBACK', direction,
    entryPrice: round(price!, digits), stopLoss: round(stopLoss, digits),
    takeProfit1: round(takeProfit1, digits), takeProfit2: round(takeProfit2, digits),
    slPips: round(riskDistance / pipSize, isGold ? 2 : 1), confluenceScore: score,
    triggerRationale: rationale, macroScore: input.macroScore, hurst, ker,
    atr14: round(atr! / pipSize, isGold ? 2 : 1), atrUnit: isGold ? 'USD' : 'PIPS',
    session, dataAsOfUtc: latest?.timestampUtc ?? null, blockers: [],
    sovereignShieldStatus: input.marketShield?.status ?? null,
    marketRiskCeilingPct: shieldCap,
    marketShieldFlags: input.marketShield?.blockReasons ?? [],\n    zScore, zScoreZone, hurstRegime, adr14, adrUsedPct,\n    pdh: priorDay?.high ?? null, pdl: priorDay?.low ?? null, asianRangeHigh, asianRangeLow,\n  };
}
