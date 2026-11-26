import {
  calculateAtr,
  calculateKaufmanEfficiencyRatio,
  estimateHurstExponent,
  type OhlcvBar,
} from '@/lib/quant/technicalConfluence';

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

function watHour(timestamp: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(timestamp));
  return Number(parts.find((part) => part.type === 'hour')?.value ?? -1)
    + Number(parts.find((part) => part.type === 'minute')?.value ?? 0) / 60;
}

export function classifyWATSession(now = new Date()): 'LONDON' | 'NEW_YORK' | 'CLOSED' {
  const hour = watHour(now.toISOString());
  if (hour >= 8 && hour < 12) return 'LONDON';
  if (hour >= 13 && hour < 17) return 'NEW_YORK';
  return 'CLOSED';
}

export function buildIntradaySignal(input: IntradaySignalInput): IntradaySignal {
  const symbol = input.symbol.toUpperCase();
  const isGold = symbol === 'XAUUSD';
  const digits = isGold ? 2 : symbol.endsWith('JPY') ? 3 : 5;
  const pipSize = isGold ? 1 : symbol.endsWith('JPY') ? 0.01 : 0.0001;
  const now = input.nowUtc ?? new Date().toISOString();
  const blockers: string[] = [];
  const direction: SignalDirection = input.macroScore !== null && input.macroScore >= 25 ? 'BUY'
    : input.macroScore !== null && input.macroScore <= -25 ? 'SELL' : 'NONE';
  const bars = input.intradayBars;
  const daily = input.dailyBars;
  const closes = bars.map((bar) => bar.close);
  const hurst = estimateHurstExponent(closes);
  const ker = calculateKaufmanEfficiencyRatio(closes, 14);
  const atr = calculateAtr(daily, 14);
  const latest = bars.at(-1);
  const quoteAge = input.quoteTimestampUtc ? Date.parse(now) - Date.parse(input.quoteTimestampUtc) : Number.POSITIVE_INFINITY;
  const price = finite(input.quoteMid) && input.quoteMid > 0 ? input.quoteMid : latest?.close ?? null;
  const session = input.session;

  if (input.vix === null) blockers.push('VIX_UNAVAILABLE');
  else if (input.vix >= 28) blockers.push('VIX_BLACK_SWAN_LOCKOUT');
  if (!input.calendarVerified) blockers.push('CALENDAR_UNVERIFIED');
  if (input.eventMinutesAway !== null && Math.abs(input.eventMinutesAway) <= (input.rateDecision ? 60 : 30)) blockers.push(input.rateDecision ? 'RATE_DECISION_LOCKOUT' : 'TIER_ONE_EVENT_LOCKOUT');
  if (session === 'CLOSED') blockers.push('OUTSIDE_LONDON_NEW_YORK_WAT_WINDOWS');
  if (input.spreadMultipleOfBaseline === null) blockers.push('SPREAD_BASELINE_UNAVAILABLE');
  else if (input.spreadMultipleOfBaseline > 2) blockers.push('SPREAD_BLOWOUT_BLOCK');
  if (!finite(input.quoteMid) || !input.quoteTimestampUtc || !Number.isFinite(quoteAge) || quoteAge < -30_000 || quoteAge > 60_000) blockers.push('LIVE_BBO_UNAVAILABLE_OR_STALE');
  if (direction === 'NONE') blockers.push('MACRO_SCORE_BELOW_25_THRESHOLD');
  if (bars.length < 60 || daily.length < 15 || !finite(hurst) || !finite(ker) || !finite(atr)) blockers.push('OHLCV_HISTORY_INSUFFICIENT');
  if (finite(hurst) && hurst <= 0.55) blockers.push('HURST_NOT_TREND_PERSISTENT');
  if (finite(ker) && ker < 0.30) blockers.push('KER_BELOW_0_30');

  const empty = (state: IntradaySignalState, rationale: string): IntradaySignal => ({
    symbol, signalState: state, direction: state === 'SHIELD_BLOCKED' ? 'NONE' : direction,
    entryPrice: null, stopLoss: null, takeProfit1: null, takeProfit2: null, slPips: null,
    confluenceScore: 0, triggerRationale: rationale, macroScore: input.macroScore,
    hurst, ker, atr14: atr, atrUnit: isGold ? 'USD' : 'PIPS', session,
    dataAsOfUtc: latest?.timestampUtc ?? null, blockers,
  });
  if (blockers.some((item) => ['VIX_UNAVAILABLE', 'VIX_BLACK_SWAN_LOCKOUT', 'CALENDAR_UNVERIFIED', 'RATE_DECISION_LOCKOUT', 'TIER_ONE_EVENT_LOCKOUT', 'OUTSIDE_LONDON_NEW_YORK_WAT_WINDOWS', 'SPREAD_BASELINE_UNAVAILABLE', 'SPREAD_BLOWOUT_BLOCK', 'LIVE_BBO_UNAVAILABLE_OR_STALE'].includes(item))) {
    return empty('SHIELD_BLOCKED', 'Sovereign Shield or live market-data gate is not clear.');
  }
  if (blockers.length) return empty('WAIT_NO_SETUP', 'Macro, OHLCV history or trend-quality confirmation is insufficient.');

  const latestWatDate = latest ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(latest.timestampUtc)) : '';
  const sessionReference = bars.filter((bar) => {
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(bar.timestampUtc));
    const hour = watHour(bar.timestampUtc);
    return date === latestWatDate && (session === 'LONDON' ? hour < 8 : hour >= 8 && hour < 12);
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
  const riskDistance = Math.max(atr! * 1.35, direction === 'BUY' ? price! - swing : swing - price!);
  if (!Number.isFinite(riskDistance) || riskDistance <= 0) return empty('WAIT_NO_SETUP', 'No valid swing invalidation distance.');
  const stopLoss = direction === 'BUY' ? price! - riskDistance : price! + riskDistance;
  const takeProfit1 = direction === 'BUY' ? price! + riskDistance * 2 : price! - riskDistance * 2;
  const takeProfit2 = direction === 'BUY' ? price! + riskDistance * 3 : price! - riskDistance * 3;
  const score = Math.min(100, Math.round(25 + (Math.abs(input.macroScore ?? 0) / 100) * 20 + (ker! * 25) + (hurst! > 0.55 ? 15 : 0) + (alignedTrigger ? 15 : 0)));
  const rationale = `${direction} Macro (${input.macroScore}) + ${sweptLow ? 'prior-session low sweep' : sweptHigh ? 'prior-session high sweep' : valueZone ? 'EMA20/VWAP value-zone pullback' : 'trend aligned'} + Hurst ${hurst!.toFixed(2)} / KER ${ker!.toFixed(2)} + 1.35x daily ATR stop`;
  return {
    symbol, signalState: alignedTrigger ? 'ACTIVE_SETUP' : 'FORMING_PULLBACK', direction,
    entryPrice: round(price!, digits), stopLoss: round(stopLoss, digits),
    takeProfit1: round(takeProfit1, digits), takeProfit2: round(takeProfit2, digits),
    slPips: round(riskDistance / pipSize, isGold ? 2 : 1), confluenceScore: score,
    triggerRationale: rationale, macroScore: input.macroScore, hurst, ker,
    atr14: round(atr! / pipSize, isGold ? 2 : 1), atrUnit: isGold ? 'USD' : 'PIPS',
    session, dataAsOfUtc: latest?.timestampUtc ?? null, blockers: [],
  };
}
