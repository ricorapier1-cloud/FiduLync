import 'server-only';

import { getFallbackSnapshot, loadMacroSnapshot } from '@/lib/macroData';
import { getCachedData } from '@/lib/redisCache';
import { isObservationFresh } from '@/lib/dataFreshness';
import type { MacroCurrency, MacroSnapshot } from '@/types/macro';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

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
      switch (provider) {
        case 'fred': return true;
        case 'alpha-vantage': return process.env.ALPHA_VANTAGE_PERSONAL_PLAN_ACTIVE === 'true';
        case 'macro-provider': return process.env.MACRO_DATA_PROVIDER_PERSONAL_USE_ENABLED === 'true';
        case 'swiss-national-bank': return process.env.SNB_PERSONAL_USE_ENABLED === 'true';
        case 'ecb':
        case 'bank-of-canada':
        case 'bank-of-england':
        case 'bank-of-japan':
        case 'reserve-bank-of-australia':
        case 'reserve-bank-of-new-zealand': return true;
        default: return false;
      }
    };
    const inflationProviderApproved = (provider: MacroCurrency['inflationProvider']) => {
      switch (provider) {
        case 'fred':
        case 'ecb':
        case 'bank-of-canada': return true;
        case 'alpha-vantage': return process.env.ALPHA_VANTAGE_PERSONAL_PLAN_ACTIVE === 'true';
        case 'macro-provider': return process.env.MACRO_DATA_PROVIDER_PERSONAL_USE_ENABLED === 'true';
        // World Bank annual CPI is useful historical context, not a current monthly inflation input.
        case 'world-bank':
        default: return false;
      }
    };

    const observationFresh = (asOf: string | undefined, maxAgeDays: number) =>
      isObservationFresh(asOf, maxAgeDays * 24 * 60 * 60_000);
    const policyRateMaxAgeDays = (provider: MacroCurrency['policyRateProvider']) =>
      provider === 'fred' ? 10 : provider === 'alpha-vantage' || provider === 'macro-provider' ? 45 : 180;
    const currencies = snapshot.currencies.filter((currency) =>
      currency.policyRateSource === 'provider'
      && currency.inflationSource === 'provider'
      && policyProviderApproved(currency.policyRateProvider)
      && inflationProviderApproved(currency.inflationProvider)
      && observationFresh(currency.policyRateAsOf, policyRateMaxAgeDays(currency.policyRateProvider))
      && observationFresh(currency.inflationAsOf, 75)
    ).map((currency) => {
      if (currency.twoYearYieldSource === 'provider' && !observationFresh(currency.twoYearYieldAsOf, 10)) {
        return { ...currency, twoYearYield: undefined, twoYearYieldSource: undefined, twoYearYieldAsOf: undefined };
      }
      return currency;
    });
    const coreG10 = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'SEK', 'NOK'];
    const completeG10 = coreG10.every((code) => currencies.some((currency) => currency.code === code));

    const cotAllowed = snapshot.cotSource === 'provider'
      && (snapshot.cotProvider === 'cftc'
        || (snapshot.cotProvider === 'custom' && process.env.COT_DATA_PROVIDER_PERSONAL_USE_ENABLED === 'true'));
    const calendarAllowed = snapshot.calendarSource === 'provider'
      && isObservationFresh(snapshot.calendarRetrievedAt, 60 * 60_000) && (
      (snapshot.calendarProvider === 'fair-economy' && process.env.FAIRECONOMY_PERSONAL_PLAN_ACTIVE === 'true')
      || (snapshot.calendarProvider === 'finnhub' && process.env.FINNHUB_PERSONAL_PLAN_ACTIVE === 'true')
      || (snapshot.calendarProvider === 'fmp' && process.env.FMP_PERSONAL_PLAN_ACTIVE === 'true')
      || (snapshot.calendarProvider === 'macro-provider' && process.env.MACRO_DATA_PROVIDER_PERSONAL_USE_ENABLED === 'true')
    );

    const cot = cotAllowed
      ? snapshot.cot.filter((position) => observationFresh(position.asOf, 21)
        && typeof position.sampleSize === 'number' && Number.isSafeInteger(position.sampleSize) && position.sampleSize >= 52)
      : [];
    const catalysts = calendarAllowed ? snapshot.catalysts : [];
    const fredMacroAllowed = Boolean(process.env.FRED_API_KEY?.trim());
    const officialStatisticsFresh = observationFresh(snapshot.usIndicators?.retrievedAt, 1);
    const fredRetrievalFresh = observationFresh(snapshot.usIndicators?.fredRetrievedAt, 1);
    const officialStatisticsAvailable = officialStatisticsFresh && Boolean(snapshot.usIndicators?.sources.some((source) =>
      source.includes('(BLS)') || source.includes('(BEA)')));
    const fredDailyPairs = [
      ['tenYearTreasuryYieldPct', 'tenYearTreasuryYieldAsOf'],
      ['tenYearRealYieldPct', 'tenYearRealYieldAsOf'],
      ['tenYearBreakevenInflationPct', 'tenYearBreakevenInflationAsOf'],
      ['usdBroadIndex', 'usdBroadIndexAsOf'],
      ['vixIndex', 'vixIndexAsOf'],
      ['sp500Index', 'sp500IndexAsOf'],
      ['wtiOilUsd', 'wtiOilAsOf'],
      ['brentOilUsd', 'brentOilAsOf'],
      ['usHighYieldSpreadPct', 'usHighYieldSpreadAsOf'],
    ] as const;
    const fredDailyFields = Object.fromEntries(fredDailyPairs.flatMap(([valueKey, dateKey]) => {
      const observedAt = snapshot.usIndicators?.[dateKey];
      const fresh = fredMacroAllowed && fredRetrievalFresh && observationFresh(observedAt, 7);
      return fresh
        ? []
        : [[valueKey, undefined], [dateKey, undefined]];
    }));
    const filteredUsIndicators = snapshot.usIndicators ? {
      ...snapshot.usIndicators,
      sources: snapshot.usIndicators.sources.filter((source) =>
        source.includes('(FRED)') ? fredMacroAllowed && fredRetrievalFresh : officialStatisticsFresh),
      cpiYearOverYearPct: officialStatisticsFresh ? snapshot.usIndicators.cpiYearOverYearPct : undefined,
      cpiPeriod: officialStatisticsFresh ? snapshot.usIndicators.cpiPeriod : undefined,
      coreCpiYearOverYearPct: officialStatisticsFresh ? snapshot.usIndicators.coreCpiYearOverYearPct : undefined,
      coreCpiPeriod: officialStatisticsFresh ? snapshot.usIndicators.coreCpiPeriod : undefined,
      unemploymentRatePct: officialStatisticsFresh ? snapshot.usIndicators.unemploymentRatePct : undefined,
      unemploymentPeriod: officialStatisticsFresh ? snapshot.usIndicators.unemploymentPeriod : undefined,
      nonfarmPayrollMonthlyChangeThousands: officialStatisticsFresh ? snapshot.usIndicators.nonfarmPayrollMonthlyChangeThousands : undefined,
      payrollPeriod: officialStatisticsFresh ? snapshot.usIndicators.payrollPeriod : undefined,
      realGdpAnnualizedQuarterlyPct: officialStatisticsFresh ? snapshot.usIndicators.realGdpAnnualizedQuarterlyPct : undefined,
      realGdpPeriod: officialStatisticsFresh ? snapshot.usIndicators.realGdpPeriod : undefined,
      ...fredDailyFields,
    } : undefined;
    const hasOfficialStatisticsValues = officialStatisticsAvailable && [
      filteredUsIndicators?.cpiYearOverYearPct,
      filteredUsIndicators?.coreCpiYearOverYearPct,
      filteredUsIndicators?.unemploymentRatePct,
      filteredUsIndicators?.nonfarmPayrollMonthlyChangeThousands,
      filteredUsIndicators?.realGdpAnnualizedQuarterlyPct,
    ].some(isFiniteNumber);
    const hasFreshFredDailyValues = fredDailyPairs.some(([valueKey]) =>
      isFiniteNumber(filteredUsIndicators?.[valueKey]));
    const usIndicators = filteredUsIndicators
      && (hasOfficialStatisticsValues || (fredMacroAllowed && hasFreshFredDailyValues))
      ? filteredUsIndicators
      : undefined;
    const hasVerifiedProviderData = currencies.length > 0 || cot.length > 0 || catalysts.length > 0 || Boolean(usIndicators);
    if (!hasVerifiedProviderData) return getFallbackSnapshot();

    return {
      ...snapshot,
      source: hasVerifiedProviderData
        ? snapshot.source === 'provider' && completeG10 ? 'provider' : 'partial'
        : 'fallback',
      currencies,
      cot,
      cotSource: cot.length > 0 ? 'provider' : 'unavailable',
      cotProvider: cot.length > 0 ? snapshot.cotProvider : undefined,
      catalysts,
      usIndicators,
      calendarSource: calendarAllowed ? 'provider' : 'reference',
      calendarProvider: calendarAllowed ? snapshot.calendarProvider : undefined,
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
  // Gold needs its own verified real-yield, central-bank demand and positioning model.
  // Do not treat XAU as a currency or reverse the USD rate proxy into a gold signal.
  if (baseCode === 'XAU') return null;
  const quote = snapshot.currencies.find((currency) => currency.code === quoteCode);
  const base = snapshot.currencies.find((currency) => currency.code === baseCode);
  if (!quote || !base) return null;

  // COT position date is not its publication timestamp. Do not use a positioning
  // percentile in a current bias until the provider supplies both release time and
  // a sufficiently large historical reference sample for each side.
  const baseCot = snapshot.cot.find((position) => position.market === baseCode);
  const quoteCot = snapshot.cot.find((position) => position.market === quoteCode);
  const qualifiedCot = (position: typeof baseCot) => Boolean(
    position
    && Number.isSafeInteger(position.sampleSize)
    && Number(position.sampleSize) >= 52
    && typeof position.publishedAt === 'string'
    && /(?:Z|[+-]\d{2}:?\d{2})$/i.test(position.publishedAt)
    && isObservationFresh(position.publishedAt, 14 * 24 * 60 * 60_000),
  );
  if (!qualifiedCot(baseCot) || !qualifiedCot(quoteCot)) return null;

  const requiredRiskCurrencies = ['AUD', 'NZD', 'CAD', 'JPY', 'CHF'];
  const riskCurrencies = requiredRiskCurrencies.map((code) =>
    snapshot.currencies.find((currency) => currency.code === code));
  if (riskCurrencies.some((currency) => !currency)) return null;

  const policyDiffBps = base
    ? Math.round((base.policyRate - quote.policyRate) * 100)
    : Math.round(-quote.policyRate * 100);
  const realYieldDiffBps = base
    ? Math.round(((base.policyRate - base.inflation) - (quote.policyRate - quote.inflation)) * 100)
    : Math.round(-(quote.policyRate - quote.inflation) * 100);
  const cotPositionDiff = Math.round(baseCot!.percentile - quoteCot!.percentile);
  const twoYearDiffBps = base?.twoYearYield !== undefined && quote.twoYearYield !== undefined
    ? Math.round((base.twoYearYield - quote.twoYearYield) * 100)
    : null;
  const riskOn = riskCurrencies
    .filter((currency) => ['AUD', 'NZD', 'CAD'].includes(currency!.code))
    .reduce((sum, currency) => sum + (currency!.policyRate - currency!.inflation), 0) / 3;
  const riskOff = riskCurrencies
    .filter((currency) => ['JPY', 'CHF'].includes(currency!.code))
    .reduce((sum, currency) => sum + (currency!.policyRate - currency!.inflation), 0) / 2;
  const roroScore = Math.max(-100, Math.min(100, Math.round((riskOn - riskOff) * 12)));
  const rawScore = (base.policyRate - quote.policyRate) * 12
    + ((base.policyRate - base.inflation) - (quote.policyRate - quote.inflation)) * 9
    + (twoYearDiffBps ?? 0) * 0.05
    + cotPositionDiff * 0.18;

  return {
    score: Math.max(-100, Math.min(100, Math.round(rawScore + roroScore * 0.1))),
    policyDiffBps,
    realYieldDiffBps,
    cotPositionDiff,
    twoYearDiffBps,
    roroScore,
  };
}
