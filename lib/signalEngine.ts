import 'server-only';

import { getFundamentalSignal, getMacroSnapshot } from '@/lib/macroEngine';
import { getTechnicalSignal, type MarketRegime } from '@/lib/technicalEngine';
import { getCurrencyStrengthIndex, getKillzoneActive, getLiquiditySession } from '@/lib/currencyStrength';
import { getCachedData } from '@/lib/redisCache';
import type { MacroSnapshot } from '@/types/macro';

const G10 = new Set(['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'SEK', 'NOK']);
const REGION_BY_CURRENCY: Record<string, string> = {
  USD: 'US',
  EUR: 'EU',
  GBP: 'UK',
  JPY: 'JP',
  CHF: 'CH',
  CAD: 'CA',
  AUD: 'AU',
  NZD: 'NZ',
  SEK: 'SE',
  NOK: 'NO',
};
const NEWS_BLACKOUT_MS = 30 * 60 * 1_000;

export type MacroSignalPayload = {
  symbol: string;
  bias: 'LONG' | 'SHORT' | 'NEUTRAL';
  confluence_score: number;
  regime: MarketRegime;
  atr_sl_pips: number | null;
  atr_tp_pips: number | null;
  session: ReturnType<typeof getLiquiditySession>;
  killzone_active: ReturnType<typeof getKillzoneActive>;
  csi_spread: number;
  max_risk_pct: number;
  risk_multiplier: number;
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

function catalystMatchesPair(catalystRegion: string, symbol: string | undefined) {
  if (!symbol) return true;
  const currencies = [symbol.slice(0, 3), symbol.slice(3)];
  return currencies.some((currency) => REGION_BY_CURRENCY[currency] === catalystRegion);
}

export function isNewsLockout(snapshot: MacroSnapshot, now = Date.now(), symbol?: string) {
  return snapshot.catalysts.some((catalyst) => catalyst.impact === 'High'
    && catalystMatchesPair(catalyst.region, symbol)
    && Math.abs(Date.parse(catalyst.scheduledAt) - now) <= NEWS_BLACKOUT_MS);
}

function nearNewsLockoutTransition(snapshot: MacroSnapshot, now: number, symbol: string) {
  return snapshot.catalysts.some((catalyst) => catalyst.impact === 'High'
    && catalystMatchesPair(catalyst.region, symbol)
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
    const strengths = getCurrencyStrengthIndex(snapshot);
    const baseStrength = strengths.find((item) => item.currency === normalizedSymbol.slice(0, 3))?.score;
    const quoteStrength = strengths.find((item) => item.currency === normalizedSymbol.slice(3))?.score;
    const csiSpread = baseStrength !== undefined && quoteStrength !== undefined ? baseStrength - quoteStrength : 0;
    const newsLockout = isNewsLockout(snapshot, now, normalizedSymbol);
    const edgeQualified = Math.abs(csiSpread) >= 60 && Math.abs(score) >= 45;
    const bias = edgeQualified ? (score > 0 ? 'LONG' : 'SHORT') : 'NEUTRAL';
    const [base, quote] = [normalizedSymbol.slice(0, 3), normalizedSymbol.slice(3)];
    const correlationGroup = base === 'JPY' || quote === 'JPY'
      ? 'JPY_CROSS'
      : base === 'EUR' || quote === 'EUR'
        ? 'EUR_BLOC'
        : ['AUD', 'NZD', 'CAD'].includes(base) || ['AUD', 'NZD', 'CAD'].includes(quote)
          ? 'COMMODITY_FX'
          : 'USD_BLOC';
    const session = getLiquiditySession(new Date(now));
    const killzoneActive = getKillzoneActive(new Date(now));
    const maxRiskPct = newsLockout || technical.regime === 'HIGH_VOL_CHOP'
      ? 0
      : technical.regime === 'TRENDING_EXPANSION'
        ? 1
        : technical.regime === 'MEAN_REVERTING'
          ? 0.5
          : 0;

    return {
      symbol: normalizedSymbol,
      bias,
      confluence_score: score,
      regime: technical.regime,
      atr_sl_pips: technical.atr_stop_pips,
      atr_tp_pips: technical.atr_take_profit_pips,
      session,
      killzone_active: killzoneActive,
      csi_spread: csiSpread,
      max_risk_pct: maxRiskPct,
      risk_multiplier: maxRiskPct,
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
        && edgeQualified
        && maxRiskPct > 0
        && (bias === 'LONG' ? technical.execution_filter.allow_buys : technical.execution_filter.allow_sells),
      timestamp_utc: new Date(now).toISOString(),
    };
  };
  if (nearNewsLockoutTransition(snapshot, now, normalizedSymbol)) return calculateSignal();
  return getCachedData(`signal:${normalizedSymbol}`, calculateSignal, 15);
}
