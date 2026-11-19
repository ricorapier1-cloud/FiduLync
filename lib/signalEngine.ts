import 'server-only';

import { getFundamentalSignal, getMacroSnapshot } from '@/lib/macroEngine';
import { getTechnicalSignal, type MarketRegime } from '@/lib/technicalEngine';
import { getCurrencyStrengthIndex, getKillzoneActive, getLiquiditySession } from '@/lib/currencyStrength';
import { getCachedData } from '@/lib/redisCache';
import type { MacroSnapshot } from '@/types/macro';
import { calculateGhostProtocol, deriveRiskBudget } from '@/lib/quantRisk';
import { getPersonalRiskPolicy } from '@/lib/riskPolicy';
import { getMarketQuotes } from '@/lib/marketFeeds';

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
  ghost_score: number | null;
  ghost_allowed: boolean;
  execution_blockers: string[];
  risk_mode: 'DISABLED' | 'PILOT_TREND' | 'PILOT_MEAN_REVERSION';
  market_data_source: 'mt5' | 'configured_provider' | 'twelve_data' | 'unavailable' | 'unknown';
  technical_data_verified: boolean;
  macro_data_source: 'fallback' | 'provider' | 'partial';
  macro_data_verified: boolean;
  macro_data_age_minutes: number | null;
  latest_market_candle_at: string | null;
  market_candle_counts: { h1: number; h4: number; d1: number };
  quantitative_indicators: { rsi14: number | null; alma20: number | null; kama10: number | null; hurst_exponent: number | null; trend_r_squared: number | null; adr20_pips: number | null; current_daily_range_adr: number | null; gaussian_z_score: number | null; kaufman_efficiency_ratio: number | null; adx: number | null };
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
    const marketQuotes = await getMarketQuotes(installationId).catch((error) => {
      console.warn(`Ghost Protocol broker quote check unavailable for ${normalizedSymbol}:`, error);
      return [];
    });
    const brokerQuote = marketQuotes.find((quote) => quote.symbol === normalizedSymbol);
    const quoteTimestamp = brokerQuote ? Date.parse(brokerQuote.timestamp) : Number.NaN;
    const quoteAgeMs = now - quoteTimestamp;
    const brokerQuoteFresh = Boolean(installationId) && technical.data_source === 'mt5'
      && brokerQuote !== undefined
      && brokerQuote.source === 'mt5'
      && Number.isFinite(quoteTimestamp)
      && quoteAgeMs >= -5 * 60_000 && quoteAgeMs <= 120_000
      && typeof brokerQuote.bid === 'number' && typeof brokerQuote.ask === 'number'
      && brokerQuote.bid > 0 && brokerQuote.ask >= brokerQuote.bid
      && typeof brokerQuote.spread_points === 'number' && brokerQuote.spread_points >= 0
      && typeof brokerQuote.point === 'number' && brokerQuote.point > 0;
    const pipSize = normalizedSymbol.endsWith('JPY') ? 0.01 : normalizedSymbol.startsWith('XAU') ? 0.1 : 0.0001;
    const stopMultiplier = technical.regime === 'TRENDING_EXPANSION' ? 1.75 : 1.5;
    const atrPips = technical.atr_stop_pips !== null ? technical.atr_stop_pips / stopMultiplier : Number.NaN;
    const spreadPrice = brokerQuoteFresh && brokerQuote
      ? (brokerQuote.spread_points ?? Number.NaN) * (brokerQuote.point ?? Number.NaN)
      : Number.NaN;
    const spreadAtrRatio = atrPips > 0 ? spreadPrice / (atrPips * pipSize) : Number.NaN;
    const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
    const ker = technical.kaufman_efficiency_ratio ?? Number.NaN;
    const adx = technical.adx ?? Number.NaN;
    const rSquared = technical.trend_r_squared ?? Number.NaN;
    const hurst = technical.hurst_exponent ?? Number.NaN;
    const trendStructureStrength = [ker, adx, rSquared, hurst].every(Number.isFinite)
      ? clamp01(ker * 0.30 + clamp01(adx / 40) * 0.25 + clamp01(rSquared) * 0.25 + clamp01(Math.abs(hurst - 0.5) / 0.25) * 0.20)
      : Number.NaN;
    const personalRiskPolicy = getPersonalRiskPolicy();
    const ghost = calculateGhostProtocol({
      quoteFresh: brokerQuoteFresh,
      trendStructureStrength,
      atrExpansionRatio: technical.atr_expansion_ratio ?? Number.NaN,
      spreadPoints: brokerQuoteFresh && brokerQuote ? brokerQuote.spread_points ?? Number.NaN : Number.NaN,
      spreadAtrRatio,
      maxSpreadPoints: personalRiskPolicy.maxSpreadPoints,
      maxSpreadAtrRatio: personalRiskPolicy.maxSpreadAtrRatio,
    });
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
    const cotMarkets = normalizedSymbol === 'XAUUSD'
      ? ['GOLD']
      : [normalizedSymbol.slice(0, 3), normalizedSymbol.slice(3)].filter((code) => code !== 'USD');
    const cotFresh = cotMarkets.length > 0 && cotMarkets.every((market) => {
      const position = snapshot.cot.find((item) => item.market === market);
      const observedAt = position?.asOf ? Date.parse(position.asOf) : Number.NaN;
      const age = now - observedAt;
      return Number.isFinite(observedAt) && age >= -5 * 60_000 && age <= 14 * 24 * 60 * 60_000;
    });
    const macroDataVerified = macroFresh && snapshot.source !== 'fallback'
      && snapshot.cotSource === 'provider'
      && snapshot.calendarSource === 'provider'
      && verifiedPolicyInputs
      && verifiedYieldInputs
      && cotFresh;
    const score = fundamental && macroDataVerified
      ? Math.max(-100, Math.min(100, Math.round(fundamental.score * 0.6 + technical.score * 0.4)))
      : 0;
    const freshCot = snapshot.cot.filter((position) => {
      const observedAt = position.asOf ? Date.parse(position.asOf) : Number.NaN;
      const age = now - observedAt;
      return Number.isFinite(observedAt) && age >= -5 * 60_000 && age <= 14 * 24 * 60 * 60_000;
    });
    const strengths = getCurrencyStrengthIndex({ ...snapshot, cot: freshCot });
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
      executionQualityVerified: ghost.allowed && process.env.EXECUTION_QUALITY_VALIDATED === 'true',
      modelValidated: process.env.SIGNAL_MODEL_VALIDATED === 'true',
      executionEnabled: process.env.SIGNAL_EXECUTION_ENABLED === 'true',
      newsLockout,
    });
    const executionBlockers = [...riskBudget.blockers, ...ghost.blockers];
    if (session === 'OFF_HOURS') executionBlockers.push('OUTSIDE_APPROVED_LIQUIDITY_SESSION');
    if (bias === 'NEUTRAL') executionBlockers.push('NO_DIRECTIONAL_CONFLUENCE');
    if (!edgeQualified) executionBlockers.push('CONFLUENCE_BELOW_RESEARCH_THRESHOLD');
    if (!validStops) executionBlockers.push('ATR_STOPS_UNAVAILABLE');
    if (!directionAllowed) executionBlockers.push('DIRECTION_BLOCKED_BY_TECHNICAL_FILTER');
    const safeToTrade = riskBudget.approved && ghost.allowed && executionBlockers.length === 0;
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
      ghost_score: ghost.score,
      ghost_allowed: ghost.allowed,
      execution_blockers: [...new Set(executionBlockers)],
      risk_mode: riskBudget.mode,
      market_data_source: technical.data_source,
      technical_data_verified: technical.available,
      macro_data_source: snapshot.source,
      macro_data_verified: macroDataVerified,
      macro_data_age_minutes: Number.isFinite(macroAgeMs) ? Math.max(0, Math.round(macroAgeMs / 60_000)) : null,
      latest_market_candle_at: technical.latest_candle_at,
      market_candle_counts: technical.candle_counts,
      quantitative_indicators: {
        rsi14: technical.rsi14, alma20: technical.alma20, kama10: technical.kama10,
        hurst_exponent: technical.hurst_exponent, trend_r_squared: technical.trend_r_squared,
        adr20_pips: technical.adr20_pips, current_daily_range_adr: technical.current_daily_range_adr,
        gaussian_z_score: technical.gaussian_z_score, kaufman_efficiency_ratio: technical.kaufman_efficiency_ratio,
        adx: technical.adx,
      },
      timestamp_utc: new Date(now).toISOString(),
    };
  };
  if (nearNewsLockoutTransition(snapshot, now, normalizedSymbol)) return calculateSignal();
  return getCachedData(`signal:${installationId ?? 'active'}:${normalizedSymbol}`, calculateSignal, 15);
}
