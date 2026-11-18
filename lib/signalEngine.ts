import 'server-only';

import { getFundamentalSignal, getMacroSnapshot } from '@/lib/macroEngine';
import { getTechnicalSignal, type MarketRegime } from '@/lib/technicalEngine';
import { getCurrencyStrengthIndex, getKillzoneActive, getLiquiditySession } from '@/lib/currencyStrength';
import { getCachedData } from '@/lib/redisCache';
import type { MacroSnapshot } from '@/types/macro';
import { deriveRiskBudget } from '@/lib/quantRisk';

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
  correlation_group: 'USD_BLOC' | 'JPY_CROSS' | 'EUR_BLOC' | 'COMMODITY_FX' | 'GOLD_METALS';
  news_lockout: boolean;
  safe_to_trade: boolean;
  execution_blockers: string[];
  risk_mode: 'DISABLED' | 'PILOT_TREND' | 'PILOT_MEAN_REVERSION';
  market_data_source: 'mt5' | 'configured_provider' | 'twelve_data' | 'unavailable' | 'unknown';
  technical_data_verified: boolean;
  macro_data_source: 'fallback' | 'provider' | 'partial';
  macro_data_verified: boolean;
  macro_data_age_minutes: number | null;
  latest_market_candle_at: string | null;
  market_candle_counts: { h1: number; h4: number; d1: number };
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

export async function getMacroSignal(symbol: string, now = Date.now(), installationId?: string): Promise<MacroSignalPayload | null> {
  const normalizedSymbol = symbol.toUpperCase();
  if (!isSupportedSignalSymbol(normalizedSymbol)) return null;

  const snapshot = await getMacroSnapshot();
  const calculateSignal = async (): Promise<MacroSignalPayload> => {
    const technical = await getTechnicalSignal(normalizedSymbol, installationId);
    const fundamental = getFundamentalSignal(snapshot, normalizedSymbol);
    const baseCurrency = snapshot.currencies.find((currency) => currency.code === normalizedSymbol.slice(0, 3));
    const quoteCurrency = snapshot.currencies.find((currency) => currency.code === normalizedSymbol.slice(3));
    const verifiedPolicyInputs = Boolean(quoteCurrency
      && quoteCurrency.policyRateSource === 'provider'
      && quoteCurrency.inflationSource === 'provider'
      && (normalizedSymbol === 'XAUUSD'
        || (baseCurrency?.policyRateSource === 'provider' && baseCurrency.inflationSource === 'provider')));
    const hasComparableTwoYearYields = baseCurrency?.twoYearYield !== undefined && quoteCurrency?.twoYearYield !== undefined;
    const verifiedYieldInputs = !hasComparableTwoYearYields
      || (baseCurrency?.twoYearYieldSource === 'provider' && quoteCurrency?.twoYearYieldSource === 'provider');
    // Reference and partial macro snapshots may be useful for display, but they
    // must never create a directional signal for an EA.
    const macroSnapshotAt = Date.parse(snapshot.asOf);
    const macroAgeMs = now - macroSnapshotAt;
    const macroFresh = Number.isFinite(macroSnapshotAt) && macroAgeMs >= -5 * 60_000 && macroAgeMs <= 24 * 60 * 60_000;
    const macroDataVerified = macroFresh && snapshot.source === 'provider'
      && snapshot.cotSource === 'provider'
      && snapshot.calendarSource === 'provider'
      && verifiedPolicyInputs
      && verifiedYieldInputs;
    const score = fundamental && macroDataVerified
      ? Math.max(-100, Math.min(100, Math.round(fundamental.score * 0.6 + technical.score * 0.4)))
      : 0;
    const strengths = getCurrencyStrengthIndex(snapshot);
    const baseStrength = strengths.find((item) => item.currency === normalizedSymbol.slice(0, 3))?.score;
    const quoteStrength = strengths.find((item) => item.currency === normalizedSymbol.slice(3))?.score;
    // Gold is not a G10 currency. Model XAUUSD against the inverse USD strength
    // factor rather than treating the missing XAU currency score as zero.
    const csiSpread = !macroDataVerified ? 0 : normalizedSymbol === 'XAUUSD'
      ? -(quoteStrength ?? 0)
      : baseStrength !== undefined && quoteStrength !== undefined ? baseStrength - quoteStrength : 0;
    const newsLockout = isNewsLockout(snapshot, now, normalizedSymbol);
    const edgeQualified = technical.available && macroDataVerified
      && Math.abs(csiSpread) >= 60 && Math.abs(score) >= 45;
    const bias = edgeQualified ? (score > 0 ? 'LONG' : 'SHORT') : 'NEUTRAL';
    const [base, quote] = [normalizedSymbol.slice(0, 3), normalizedSymbol.slice(3)];
    const correlationGroup = normalizedSymbol === 'XAUUSD'
      ? 'GOLD_METALS'
      : base === 'JPY' || quote === 'JPY'
      ? 'JPY_CROSS'
      : base === 'EUR' || quote === 'EUR'
        ? 'EUR_BLOC'
        : ['AUD', 'NZD', 'CAD'].includes(base) || ['AUD', 'NZD', 'CAD'].includes(quote)
          ? 'COMMODITY_FX'
          : 'USD_BLOC';
    const session = getLiquiditySession(new Date(now));
    const killzoneActive = getKillzoneActive(new Date(now));
    const directionAllowed = bias === 'LONG'
      ? technical.execution_filter.allow_buys
      : bias === 'SHORT'
        ? technical.execution_filter.allow_sells
        : false;
    const validStops = technical.atr_stop_pips !== null && technical.atr_stop_pips > 0
      && technical.atr_take_profit_pips !== null && technical.atr_take_profit_pips > 0;
        const riskBudget = deriveRiskBudget({
      regime: technical.regime,
      marketDataVerified: technical.available,
      macroDataVerified,
      executionQualityVerified: process.env.EXECUTION_QUALITY_VALIDATED === 'true',
      modelValidated: process.env.SIGNAL_MODEL_VALIDATED === 'true',
      executionEnabled: process.env.SIGNAL_EXECUTION_ENABLED === 'true',
      newsLockout,
    });
    const executionBlockers = [...riskBudget.blockers];
    if (session === 'OFF_HOURS') executionBlockers.push('OUTSIDE_APPROVED_LIQUIDITY_SESSION');
    if (bias === 'NEUTRAL') executionBlockers.push('NO_DIRECTIONAL_CONFLUENCE');
    if (!edgeQualified) executionBlockers.push('CONFLUENCE_BELOW_RESEARCH_THRESHOLD');
    if (!validStops) executionBlockers.push('ATR_STOPS_UNAVAILABLE');
    if (!directionAllowed) executionBlockers.push('DIRECTION_BLOCKED_BY_TECHNICAL_FILTER');
    const safeToTrade = riskBudget.approved && executionBlockers.length === 0;
    const maxRiskPct = safeToTrade ? riskBudget.riskPct : 0;

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
      safe_to_trade: safeToTrade,
      execution_blockers: [...new Set(executionBlockers)],
      risk_mode: riskBudget.mode,
      market_data_source: technical.data_source,
      technical_data_verified: technical.available,
      macro_data_source: snapshot.source,
      macro_data_verified: macroDataVerified,
      macro_data_age_minutes: Number.isFinite(macroAgeMs) ? Math.max(0, Math.round(macroAgeMs / 60_000)) : null,
      latest_market_candle_at: technical.latest_candle_at,
      market_candle_counts: technical.candle_counts,
      timestamp_utc: new Date(now).toISOString(),
    };
  };
  if (nearNewsLockoutTransition(snapshot, now, normalizedSymbol)) return calculateSignal();
  return getCachedData(`signal:${installationId ?? 'active'}:${normalizedSymbol}`, calculateSignal, 15);
}
