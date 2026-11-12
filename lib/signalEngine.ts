import 'server-only';

import { getFundamentalSignal, getMacroSnapshot } from '@/lib/macroEngine';
import { getTechnicalSignal, type MarketRegime } from '@/lib/technicalEngine';
import { getLiquiditySession } from '@/lib/currencyStrength';
import { getCachedData } from '@/lib/redisCache';
import type { MacroSnapshot } from '@/types/macro';

const G10 = new Set(['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'SEK', 'NOK']);
const TIER_ONE_EVENT = /\b(nfp|non[-\s]?farm|payrolls?|employment|unemployment|consumer price|cpi|pce|inflation|fomc|federal open market|ecb|european central bank|boe|bank of england|rate decision|interest rate|monetary policy|gdp|gross domestic product|retail sales)\b/i;
const NEWS_BLACKOUT_MS = 30 * 60 * 1_000;

export type MacroSignalPayload = {
  symbol: string;
  bias: 'LONG' | 'SHORT' | 'NEUTRAL';
  confluence_score: number;
  regime: MarketRegime;
  atr_sl_pips: number | null;
  atr_tp_pips: number | null;
  session: ReturnType<typeof getLiquiditySession>;
  correlation_group: 'USD_BLOC' | 'JPY_CROSS' | 'EUR_BLOC' | 'COMMODITY_FX';
  news_lockout: boolean;
  safe_to_trade: boolean;
  timestamp_utc: string;
};

export function isSupportedSignalSymbol(symbol: string) {
  if (symbol === 'XAUUSD') return true;
  if (!/^[A-Z]{6}$/.test(symbol)) return false;
  const base = symbol.slice(0, 3);
  const quote = symbol.slice(3);
  return base !== quote && G10.has(base) && G10.has(quote);
}

export function isNewsLockout(snapshot: MacroSnapshot, now = Date.now()) {
  return snapshot.catalysts.some((catalyst) => catalyst.impact === 'High'
    && TIER_ONE_EVENT.test(`${catalyst.title} ${catalyst.region}`)
    && Math.abs(Date.parse(catalyst.scheduledAt) - now) <= NEWS_BLACKOUT_MS);
}

function nearNewsLockoutTransition(snapshot: MacroSnapshot, now: number) {
  return snapshot.catalysts.some((catalyst) => catalyst.impact === 'High'
    && TIER_ONE_EVENT.test(`${catalyst.title} ${catalyst.region}`)
    && Math.abs(Math.abs(Date.parse(catalyst.scheduledAt) - now) - NEWS_BLACKOUT_MS) <= 15_000);
}

export async function getMacroSignal(symbol: string, now = Date.now()): Promise<MacroSignalPayload | null> {
  const normalizedSymbol = symbol.toUpperCase();
  if (!isSupportedSignalSymbol(normalizedSymbol)) return null;

  const snapshot = await getMacroSnapshot();
  const calculateSignal = async (): Promise<MacroSignalPayload> => {
    const technical = await getTechnicalSignal(normalizedSymbol);
    const fundamental = getFundamentalSignal(snapshot, normalizedSymbol);
    const baseCurrency = snapshot.currencies.find((currency) => currency.code === normalizedSymbol.slice(0, 3));
    const quoteCurrency = snapshot.currencies.find((currency) => currency.code === normalizedSymbol.slice(3));
    const verifiedPolicyInputs = Boolean(quoteCurrency
      && quoteCurrency.policyRateSource === 'provider'
      && quoteCurrency.inflationSource === 'provider'
      && (normalizedSymbol.startsWith('XAU')
        || (baseCurrency?.policyRateSource === 'provider' && baseCurrency.inflationSource === 'provider')));
    const score = fundamental
      ? Math.max(-100, Math.min(100, Math.round(fundamental.score * 0.6 + technical.score * 0.4)))
      : 0;
    const bias = score >= 20 ? 'LONG' : score <= -20 ? 'SHORT' : 'NEUTRAL';
    const newsLockout = isNewsLockout(snapshot, now);
    const [base, quote] = [normalizedSymbol.slice(0, 3), normalizedSymbol.slice(3)];
    const correlationGroup = base === 'JPY' || quote === 'JPY'
      ? 'JPY_CROSS'
      : base === 'EUR' || quote === 'EUR'
        ? 'EUR_BLOC'
        : ['AUD', 'NZD', 'CAD'].includes(base) || ['AUD', 'NZD', 'CAD'].includes(quote)
          ? 'COMMODITY_FX'
          : 'USD_BLOC';
    const session = getLiquiditySession(new Date(now));

    return {
      symbol: normalizedSymbol,
      bias,
      confluence_score: score,
      regime: technical.regime,
      atr_sl_pips: technical.atr_stop_pips,
      atr_tp_pips: technical.atr_take_profit_pips,
      session,
      correlation_group: correlationGroup,
      news_lockout: newsLockout,
      safe_to_trade: Boolean(fundamental)
        && technical.available
        && verifiedPolicyInputs
        && snapshot.calendarSource === 'provider'
        && !newsLockout
        && technical.regime !== 'HIGH_VOL_CHOP'
        && session !== 'OFF_HOURS'
        && bias !== 'NEUTRAL'
        && technical.atr_stop_pips !== null && technical.atr_stop_pips > 0
        && technical.atr_take_profit_pips !== null && technical.atr_take_profit_pips > 0
        && (bias === 'LONG' ? technical.execution_filter.allow_buys : technical.execution_filter.allow_sells),
      timestamp_utc: new Date(now).toISOString(),
    };
  };
  if (nearNewsLockoutTransition(snapshot, now)) return calculateSignal();
  return getCachedData(`signal:${normalizedSymbol}`, calculateSignal, 15);
}
