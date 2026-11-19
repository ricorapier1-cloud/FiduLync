import 'server-only';

import { getFallbackSnapshot, loadMacroSnapshot } from '@/lib/macroData';
import { getCachedData } from '@/lib/redisCache';
import type { MacroSnapshot } from '@/types/macro';

export type FundamentalSignal = {
  score: number;
  policyDiffBps: number;
  realYieldDiffBps: number;
  cotPositionDiff: number;
  twoYearDiffBps: number | null;
  roroScore: number;
};

export async function getMacroSnapshot(forceRefresh = false): Promise<MacroSnapshot> {
  try {
    const snapshot = await getCachedData('macro:snapshot', loadMacroSnapshot, 900, forceRefresh);
    if (snapshot.source === 'fallback') return getFallbackSnapshot();

    const refreshedAt = Date.parse(snapshot.asOf);
    const ageMs = Date.now() - refreshedAt;
    if (!Number.isFinite(refreshedAt) || ageMs < -5 * 60_000 || ageMs > 24 * 60 * 60_000) {
      console.warn('Macro snapshot exceeded the 24-hour freshness limit; provider data is marked unavailable.');
      return getFallbackSnapshot();
    }

    const policyProviderApproved = (provider: MacroCurrency['policyRateProvider']) => {
      if (provider === 'fred') return process.env.FRED_COMMERCIAL_USE_APPROVED === 'true';
      if (provider === 'alpha-vantage') return process.env.ALPHA_VANTAGE_COMMERCIAL_USE_APPROVED === 'true';
      if (provider === 'macro-provider') return process.env.MACRO_DATA_PROVIDER_LICENSE_APPROVED === 'true';
      if (provider === 'swiss-national-bank') return process.env.SNB_COMMERCIAL_USE_APPROVED === 'true';
      return Boolean(provider);
    };
    const inflationProviderApproved = (provider: MacroCurrency['inflationProvider']) => {
      if (provider === 'fred') return process.env.FRED_COMMERCIAL_USE_APPROVED === 'true';
      if (provider === 'alpha-vantage') return process.env.ALPHA_VANTAGE_COMMERCIAL_USE_APPROVED === 'true';
      if (provider === 'macro-provider') return process.env.MACRO_DATA_PROVIDER_LICENSE_APPROVED === 'true';
      return Boolean(provider);
    };

    const currencies = snapshot.currencies.filter((currency) =>
      currency.policyRateSource === 'provider'
      && currency.inflationSource === 'provider'
      && policyProviderApproved(currency.policyRateProvider)
      && inflationProviderApproved(currency.inflationProvider));
    const coreG10 = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'SEK', 'NOK'];
    const completeG10 = coreG10.every((code) => currencies.some((currency) => currency.code === code));

    const cotAllowed = snapshot.cotSource === 'provider'
      && (snapshot.cotProvider === 'cftc'
        || (snapshot.cotProvider === 'custom' && process.env.COT_DATA_PROVIDER_LICENSE_APPROVED === 'true'));
    const calendarAllowed = snapshot.calendarSource === 'provider' && (
      (snapshot.calendarProvider === 'fair-economy' && process.env.FAIRECONOMY_COMMERCIAL_USE_APPROVED === 'true')
      || (snapshot.calendarProvider === 'finnhub' && process.env.FINNHUB_COMMERCIAL_USE_APPROVED === 'true')
      || (snapshot.calendarProvider === 'fmp' && process.env.FMP_COMMERCIAL_USE_APPROVED === 'true')
      || (snapshot.calendarProvider === 'macro-provider' && process.env.MACRO_DATA_PROVIDER_LICENSE_APPROVED === 'true')
    );

    return {
      ...snapshot,
      source: snapshot.source === 'provider' && completeG10 ? 'provider' : 'partial',
      currencies,
      cot: cotAllowed ? snapshot.cot : [],
      cotSource: cotAllowed ? 'provider' : 'unavailable',
      cotProvider: cotAllowed ? snapshot.cotProvider : undefined,
      catalysts: calendarAllowed ? snapshot.catalysts : [],
      calendarSource: calendarAllowed ? 'provider' : 'reference',
      calendarProvider: calendarAllowed ? snapshot.calendarProvider : undefined,
      ecbRates: process.env.FRANKFURTER_COMMERCIAL_USE_APPROVED === 'true' ? snapshot.ecbRates : undefined,
    };
  } catch (error) {
    console.warn('Macro providers and cached snapshots are unavailable; no macro observations will be substituted.', error);
    return getFallbackSnapshot();
  }
}

export function getFundamentalSignal(snapshot: MacroSnapshot, pair: string): FundamentalSignal | null {
  const normalizedPair = pair.toUpperCase();
  if (!/^[A-Z]{6}$/.test(normalizedPair)) return null;

  const baseCode = normalizedPair.slice(0, 3);
  const quoteCode = normalizedPair.slice(3);
  const quote = snapshot.currencies.find((currency) => currency.code === quoteCode);
  const base = baseCode === 'XAU' ? null : snapshot.currencies.find((currency) => currency.code === baseCode);
  if (!quote || (baseCode !== 'XAU' && !base)) return null;
  const baseCotMarket = baseCode === 'XAU' ? 'GOLD' : baseCode;
  const baseCot = snapshot.cot.find((position) => position.market === baseCotMarket);
  const quoteCot = snapshot.cot.find((position) => position.market === quoteCode);
  const policyDiffBps = base
    ? Math.round((base.policyRate - quote.policyRate) * 100)
    : Math.round(-quote.policyRate * 100);
  const realYieldDiffBps = base
    ? Math.round(((base.policyRate - base.inflation) - (quote.policyRate - quote.inflation)) * 100)
    : Math.round(-(quote.policyRate - quote.inflation) * 100);
  const cotPositionDiff = Math.round((baseCot?.percentile ?? 50) - (quoteCot?.percentile ?? 50));
  const twoYearDiffBps = base?.twoYearYield !== undefined && quote.twoYearYield !== undefined
    ? Math.round((base.twoYearYield - quote.twoYearYield) * 100)
    : null;
  const riskOn = ['AUD', 'NZD', 'CAD'].reduce((sum, code) => {
    const currency = snapshot.currencies.find((item) => item.code === code);
    return sum + (currency ? currency.policyRate - currency.inflation : 0);
  }, 0) / 3;
  const riskOff = ['JPY', 'CHF'].reduce((sum, code) => {
    const currency = snapshot.currencies.find((item) => item.code === code);
    return sum + (currency ? currency.policyRate - currency.inflation : 0);
  }, 0) / 2;
  const roroScore = Math.max(-100, Math.min(100, Math.round((riskOn - riskOff) * 12)));
  const rawScore = base
    ? (base.policyRate - quote.policyRate) * 12
      + ((base.policyRate - base.inflation) - (quote.policyRate - quote.inflation)) * 9
      + (twoYearDiffBps ?? 0) * 0.05
      + cotPositionDiff * 0.18
    : (quote.policyRate - quote.inflation) * -18 + cotPositionDiff * 0.18;

  return {
    score: Math.max(-100, Math.min(100, Math.round(rawScore + roroScore * 0.1))),
    policyDiffBps,
    realYieldDiffBps,
    cotPositionDiff,
    twoYearDiffBps,
    roroScore,
  };
}
