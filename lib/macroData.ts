import 'server-only';
import type { CotPosition, EconomicCatalyst, MacroCurrency, MacroSnapshot, OfficialUsMacroIndicators } from '@/types/macro';
import { fetchOfficialUsMacro } from '@/lib/officialUsMacroAdapters';
import { getSupabaseAdmin } from '@/lib/serverSupabase';
import {
  getBankOfCanadaMacroInputs,
  getBankOfEnglandPolicyRate,
  getEcbMacroInputs,
  getWorldBankG10Inflation,
  getBankOfJapanPolicyRate,
  getReserveBankOfAustraliaPolicyRate,
  getReserveBankOfNewZealandPolicyRate,
  getSwissNationalBankPolicyRate,
} from '@/lib/internationalMacro';
import { getCachedData } from '@/lib/redisCache';

export const EMPTY_SNAPSHOT: MacroSnapshot = {
  asOf: '',
  source: 'fallback',
  cotSource: 'unavailable',
  calendarSource: 'reference',
  currencies: [],
  cot: [],
  catalysts: [],
};

export function getFallbackSnapshot(): MacroSnapshot {
  // An unavailable provider must never be replaced with invented or stale levels.
  // Empty observations and an empty timestamp force downstream consumers to abstain.
  return {
    asOf: '',
    source: 'fallback',
    cotSource: 'unavailable',
    calendarSource: 'reference',
    currencies: [],
    cot: [],
    catalysts: [],
  };
}

// Structural rows let independent provider adapters populate a currency even when
// no previous snapshot exists. These zero values are internal sentinels only and
// are filtered out before any snapshot leaves this module.
function getProviderCurrencySeed(): MacroCurrency[] {
  const authorities = [
    ['USD', 'Federal Reserve'], ['EUR', 'European Central Bank'],
    ['GBP', 'Bank of England'], ['JPY', 'Bank of Japan'],
    ['CHF', 'Swiss National Bank'], ['CAD', 'Bank of Canada'],
    ['AUD', 'Reserve Bank of Australia'], ['NZD', 'Reserve Bank of New Zealand'],
    ['SEK', 'Sveriges Riksbank'], ['NOK', 'Norges Bank'],
  ] as const;
  return authorities.map(([code, centralBank]) => ({
    code, centralBank, policyRate: 0, inflation: 0,
    inflationLabel: 'Not yet verified', policyRateSource: 'reference',
    inflationSource: 'reference', stance: 'Not yet verified',
  }));
}

function mergeWithFallback(snapshot: MacroSnapshot): MacroSnapshot {
  const fallback = getFallbackSnapshot();
  const currencies = new Map(fallback.currencies.map((currency) => [currency.code, currency]));
  for (const currency of snapshot.currencies) currencies.set(currency.code, currency);
  return {
    ...fallback,
    ...snapshot,
    currencies: [...currencies.values()],
    cot: snapshot.cot,
    catalysts: snapshot.catalysts.length > 0 ? snapshot.catalysts : fallback.catalysts,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNumericRecord(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every(isFiniteNumber);
}

function isCurrency(value: unknown): value is MacroCurrency {
  return isRecord(value)
    && typeof value.code === 'string'
    && typeof value.centralBank === 'string'
    && isFiniteNumber(value.policyRate)
    && isFiniteNumber(value.inflation)
    && typeof value.inflationLabel === 'string'
    && (value.corePce === undefined || isFiniteNumber(value.corePce))
    && (value.corePceAsOf === undefined || (typeof value.corePceAsOf === 'string' && Number.isFinite(Date.parse(value.corePceAsOf))))
    && (value.cpi === undefined || isFiniteNumber(value.cpi))
    && (value.cpiAsOf === undefined || (typeof value.cpiAsOf === 'string' && Number.isFinite(Date.parse(value.cpiAsOf))))
    && (value.twoYearYield === undefined || isFiniteNumber(value.twoYearYield))
    && (value.twoYearYieldAsOf === undefined || (typeof value.twoYearYieldAsOf === 'string' && Number.isFinite(Date.parse(value.twoYearYieldAsOf))))
    && (value.twoYearYieldSource === undefined || value.twoYearYieldSource === 'provider' || value.twoYearYieldSource === 'reference')
    && (value.policyRateSource === undefined || value.policyRateSource === 'provider' || value.policyRateSource === 'reference')
    && (value.inflationSource === undefined || value.inflationSource === 'provider' || value.inflationSource === 'reference')
    && (value.policyRateProvider === undefined || ['fred', 'alpha-vantage', 'macro-provider', 'ecb', 'bank-of-canada', 'bank-of-england', 'bank-of-japan', 'reserve-bank-of-australia', 'reserve-bank-of-new-zealand', 'swiss-national-bank'].includes(String(value.policyRateProvider)))
    && (value.inflationProvider === undefined || ['fred', 'alpha-vantage', 'macro-provider', 'ecb', 'bank-of-canada', 'world-bank'].includes(String(value.inflationProvider)))
    && (value.policyRateAsOf === undefined || (typeof value.policyRateAsOf === 'string' && Number.isFinite(Date.parse(value.policyRateAsOf))))
    && (value.inflationAsOf === undefined || (typeof value.inflationAsOf === 'string' && Number.isFinite(Date.parse(value.inflationAsOf))))
    && (value.policyRateSourceUrl === undefined || (typeof value.policyRateSourceUrl === 'string' && value.policyRateSourceUrl.startsWith('https://')))
    && (value.inflationSourceUrl === undefined || (typeof value.inflationSourceUrl === 'string' && value.inflationSourceUrl.startsWith('https://')))
    && typeof value.stance === 'string';
}

function isCotPosition(value: unknown): value is CotPosition {
  return isRecord(value)
    && typeof value.market === 'string'
    && isFiniteNumber(value.netContracts)
    && isFiniteNumber(value.percentile)
    && value.percentile >= 0
    && value.percentile <= 100
    && isFiniteNumber(value.weeklyChange)
    && (value.asOf === undefined || (typeof value.asOf === 'string' && Number.isFinite(Date.parse(value.asOf))));
}

function isCatalyst(value: unknown): value is EconomicCatalyst {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.region === 'string'
    && typeof value.title === 'string'
    && typeof value.scheduledAt === 'string'
    && Number.isFinite(Date.parse(value.scheduledAt))
    && (value.impact === 'High' || value.impact === 'Medium')
    && typeof value.consensus === 'string'
    && (typeof value.actual === 'string' || value.actual === null);
}

function isUsIndicators(value: unknown): value is OfficialUsMacroIndicators {
  if (!isRecord(value) || typeof value.retrievedAt !== 'string' || !Number.isFinite(Date.parse(value.retrievedAt))
    || !Array.isArray(value.sources) || !value.sources.every((source) => typeof source === 'string')) return false;
  const numericKeys = ['cpiYearOverYearPct', 'coreCpiYearOverYearPct', 'unemploymentRatePct', 'nonfarmPayrollMonthlyChangeThousands', 'realGdpAnnualizedQuarterlyPct', 'tenYearTreasuryYieldPct', 'tenYearRealYieldPct', 'tenYearBreakevenInflationPct'];
  const dateKeys = ['cpiPeriod', 'coreCpiPeriod', 'unemploymentPeriod', 'payrollPeriod', 'realGdpPeriod', 'tenYearTreasuryYieldAsOf', 'tenYearRealYieldAsOf', 'tenYearBreakevenInflationAsOf'];
  return numericKeys.every((key) => value[key] === undefined || isFiniteNumber(value[key]))
    && dateKeys.every((key) => value[key] === undefined || typeof value[key] === 'string');
}

function parseProviderSnapshot(value: unknown): Pick<MacroSnapshot, 'currencies' | 'cot' | 'catalysts' | 'usIndicators'> | null {
  if (!isRecord(value)
    || !Array.isArray(value.currencies)
    || !Array.isArray(value.cot)
    || !Array.isArray(value.catalysts)) return null;

  if (!value.currencies.every(isCurrency) || !value.cot.every(isCotPosition) || !value.catalysts.every(isCatalyst)) return null;
  return {
    currencies: value.currencies,
    cot: value.cot,
    catalysts: value.catalysts,
  };
}

type Observation = { date: string; value: number };

async function getFredObservations(seriesId: string, apiKey: string): Promise<Observation[]> {
  const providerUrl = new URL('https://api.stlouisfed.org/fred/series/observations');
  providerUrl.searchParams.set('series_id', seriesId);
  providerUrl.searchParams.set('api_key', apiKey);
  providerUrl.searchParams.set('file_type', 'json');
  providerUrl.searchParams.set('sort_order', 'desc');
  providerUrl.searchParams.set('limit', '24');
  const response = await fetch(providerUrl, {
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`FRED returned ${response.status} for ${seriesId}.`);
  const payload: unknown = await response.json();
  if (!isRecord(payload) || !Array.isArray(payload.observations)) {
    throw new Error(`FRED returned an invalid ${seriesId} observation series.`);
  }
  return payload.observations.flatMap((item): Observation[] => {
    if (!isRecord(item) || typeof item.date !== 'string' || typeof item.value !== 'string') return [];
    const value = Number(item.value);
    return Number.isFinite(value) ? [{ date: item.date, value }] : [];
  });
}

async function getFredUsdUpdates(apiKey: string) {
  const [rateResult, pceResult, cpiResult, twoYearResult, tenYearResult, realYieldResult, breakevenResult] = await Promise.allSettled([
    getFredObservations('DFF', apiKey),
    getFredObservations('PCEPILFE', apiKey),
    getFredObservations('CPIAUCSL', apiKey),
    getFredObservations('DGS2', apiKey),
    getFredObservations('DGS10', apiKey),
    getFredObservations('DFII10', apiKey),
    getFredObservations('T10YIE', apiKey),
  ]);
  const latestYearOverYear = (observations: Observation[]) => {
    const latest = observations[0];
    if (!latest) return undefined;
    const priorYear = observations.find((item) => item.date.slice(0, 7) === `${Number(latest.date.slice(0, 4)) - 1}${latest.date.slice(4, 7)}`);
    return priorYear && priorYear.value !== 0 ? (latest.value / priorYear.value - 1) * 100 : undefined;
  };
  if (rateResult.status === 'rejected') console.warn('FRED federal funds rate is unavailable:', rateResult.reason);
  if (pceResult.status === 'rejected') console.warn('FRED Core PCE is unavailable:', pceResult.reason);
  if (cpiResult.status === 'rejected') console.warn('FRED CPI is unavailable:', cpiResult.reason);
  if (twoYearResult.status === 'rejected') console.warn('FRED 2-Year Treasury yield is unavailable:', twoYearResult.reason);
  if (tenYearResult.status === 'rejected') console.warn('FRED 10-Year Treasury yield is unavailable:', tenYearResult.reason);
  if (realYieldResult.status === 'rejected') console.warn('FRED 10-Year TIPS real yield is unavailable:', realYieldResult.reason);
  if (breakevenResult.status === 'rejected') console.warn('FRED 10-Year breakeven inflation is unavailable:', breakevenResult.reason);
  return {
    policyRate: rateResult.status === 'fulfilled' ? rateResult.value[0]?.value : undefined,
    policyRateAsOf: rateResult.status === 'fulfilled' ? rateResult.value[0]?.date : undefined,
    corePce: pceResult.status === 'fulfilled' ? latestYearOverYear(pceResult.value) : undefined,
    corePceAsOf: pceResult.status === 'fulfilled' ? pceResult.value[0]?.date : undefined,
    cpi: cpiResult.status === 'fulfilled' ? latestYearOverYear(cpiResult.value) : undefined,
    cpiAsOf: cpiResult.status === 'fulfilled' ? cpiResult.value[0]?.date : undefined,
    twoYearYield: twoYearResult.status === 'fulfilled' ? twoYearResult.value[0]?.value : undefined,
    twoYearYieldAsOf: twoYearResult.status === 'fulfilled' ? twoYearResult.value[0]?.date : undefined,
    tenYearTreasuryYieldPct: tenYearResult.status === 'fulfilled' ? tenYearResult.value[0]?.value : undefined,
    tenYearTreasuryYieldAsOf: tenYearResult.status === 'fulfilled' ? tenYearResult.value[0]?.date : undefined,
    tenYearRealYieldPct: realYieldResult.status === 'fulfilled' ? realYieldResult.value[0]?.value : undefined,
    tenYearRealYieldAsOf: realYieldResult.status === 'fulfilled' ? realYieldResult.value[0]?.date : undefined,
    tenYearBreakevenInflationPct: breakevenResult.status === 'fulfilled' ? breakevenResult.value[0]?.value : undefined,
    tenYearBreakevenInflationAsOf: breakevenResult.status === 'fulfilled' ? breakevenResult.value[0]?.date : undefined,
  };
}

async function getFrankfurterRates(): Promise<Record<string, number>> {
  const response = await fetch('https://api.frankfurter.app/latest?from=EUR', {
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Frankfurter returned ${response.status}.`);
  const payload: unknown = await response.json();
  if (!isRecord(payload) || !isRecord(payload.rates)) throw new Error('Frankfurter returned an invalid ECB benchmark payload.');
  const rates: Record<string, number> = {};
  for (const [code, value] of Object.entries(payload.rates)) {
    if (/^[A-Z]{3}$/.test(code) && typeof value === 'number' && Number.isFinite(value) && value > 0) rates[code] = value;
  }
  if (!Object.keys(rates).length) throw new Error('Frankfurter returned no usable ECB benchmark rates.');
  return rates;
}

function getFairEconomyCatalysts(): Promise<EconomicCatalyst[]> {
  return getCachedData('macro:fair-economy-calendar', async () => {
    const response = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; MacroLync/1.0)',
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`FairEconomy calendar returned ${response.status}.`);
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) throw new Error('FairEconomy calendar payload is invalid.');
    const regionMap: Record<string, string> = {
      USD: 'US', EUR: 'EU', GBP: 'UK', JPY: 'JP', CHF: 'CH',
      CAD: 'CA', AUD: 'AU', NZD: 'NZ', SEK: 'SE', NOK: 'NO',
    };
    const events = payload.flatMap((item, index): EconomicCatalyst[] => {
      if (!isRecord(item) || typeof item.currency !== 'string'
        || typeof item.title !== 'string' || typeof item.date !== 'string') return [];
      const impact = item.impact === 'High' ? 'High' : item.impact === 'Medium' ? 'Medium' : null;
      const scheduledAt = new Date(item.date);
      if (!impact || !regionMap[item.currency] || !Number.isFinite(scheduledAt.getTime())) return [];
      return [{
        id: `fair-economy-${scheduledAt.toISOString()}-${index}`,
        region: regionMap[item.currency],
        title: item.title,
        scheduledAt: scheduledAt.toISOString(),
        impact,
        consensus: typeof item.forecast === 'string' ? item.forecast : 'Pending',
        actual: typeof item.actual === 'string' && item.actual ? item.actual : null,
      }];
    });
    return events;
  }, 900);
}

async function getFinnhubCatalysts(apiKey: string): Promise<EconomicCatalyst[]> {
  const from = new Date().toISOString().slice(0, 10);
  const to = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const providerUrl = new URL('https://finnhub.io/api/v1/calendar/economic');
  providerUrl.searchParams.set('from', from);
  providerUrl.searchParams.set('to', to);
  providerUrl.searchParams.set('token', apiKey);
  const response = await fetch(providerUrl, { cache: 'no-store', signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Finnhub economic calendar returned ${response.status}.`);
  const payload: unknown = await response.json();
  if (!isRecord(payload) || !Array.isArray(payload.economicCalendar)) {
    throw new Error('Finnhub economic calendar payload is invalid.');
  }
  const regions: Record<string, string> = {
    US: 'US', EU: 'EU', GB: 'UK', JP: 'JP', AU: 'AU', CH: 'CH', CA: 'CA', NZ: 'NZ', NO: 'NO', SE: 'SE',
  };
  return payload.economicCalendar.flatMap((item, index): EconomicCatalyst[] => {
    if (!isRecord(item) || typeof item.time !== 'string' || typeof item.country !== 'string'
      || typeof item.event !== 'string') return [];
    const impactText = typeof item.impact === 'string' ? item.impact.toLowerCase() : '';
    const impact = impactText.includes('high') ? 'High' : impactText.includes('medium') ? 'Medium' : null;
    const scheduledAt = new Date(item.time);
    if (!impact || !Number.isFinite(scheduledAt.getTime()) || !regions[item.country]) return [];
    const consensus = item.estimate === null || item.estimate === undefined ? 'Pending' : String(item.estimate);
    const actual = item.actual === null || item.actual === undefined ? null : String(item.actual);
    return [{
      id: `finnhub-${scheduledAt.toISOString()}-${index}`,
      region: regions[item.country],
      title: item.event,
      scheduledAt: scheduledAt.toISOString(),
      impact,
      consensus,
      actual,
    }];
  });
}

async function getAlphaVantageObservations(functionName: 'FEDERAL_FUNDS_RATE' | 'CPI', apiKey: string): Promise<Observation[]> {
  const providerUrl = new URL('https://www.alphavantage.co/query');
  providerUrl.searchParams.set('function', functionName);
  providerUrl.searchParams.set('apikey', apiKey);
  if (functionName === 'FEDERAL_FUNDS_RATE') providerUrl.searchParams.set('interval', 'monthly');
  const response = await fetch(providerUrl, {
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Alpha Vantage returned ${response.status}.`);
  const payload: unknown = await response.json();
  if (!isRecord(payload) || !Array.isArray(payload.data)) throw new Error('Alpha Vantage observation payload is unavailable.');
  return payload.data.flatMap((item): Observation[] => {
    if (!isRecord(item) || typeof item.date !== 'string') return [];
    const value = typeof item.value === 'number' ? item.value : Number(item.value);
    return Number.isFinite(value) ? [{ date: item.date, value }] : [];
  }).sort((left, right) => Date.parse(right.date) - Date.parse(left.date));
}

async function getAlphaVantageUsdUpdates(apiKey: string) {
  const [rateResult, cpiResult] = await Promise.allSettled([
    getAlphaVantageObservations('FEDERAL_FUNDS_RATE', apiKey),
    getAlphaVantageObservations('CPI', apiKey),
  ]);
  if (rateResult.status === 'rejected') console.error('Alpha Vantage policy-rate series unavailable:', rateResult.reason);
  if (cpiResult.status === 'rejected') console.error('Alpha Vantage CPI series unavailable:', cpiResult.reason);
  const rates = rateResult.status === 'fulfilled' ? rateResult.value : [];
  const cpi = cpiResult.status === 'fulfilled' ? cpiResult.value : [];
  const policyRate = rates[0]?.value;
  const latestCpi = cpi[0];
  const priorCpi = latestCpi && cpi.find((item) => item.date.slice(0, 7) === `${Number(latestCpi.date.slice(0, 4)) - 1}${latestCpi.date.slice(4, 7)}`);
  const inflation = latestCpi && priorCpi && priorCpi.value !== 0
    ? (latestCpi.value / priorCpi.value - 1) * 100
    : undefined;
  return { policyRate, inflation };
}

async function getFmpCatalysts(apiKey: string): Promise<EconomicCatalyst[]> {
  const now = new Date();
  const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const providerUrl = new URL('https://financialmodelingprep.com/stable/economic-calendar');
  providerUrl.searchParams.set('from', now.toISOString().slice(0, 10));
  providerUrl.searchParams.set('to', end.toISOString().slice(0, 10));
  providerUrl.searchParams.set('apikey', apiKey);
  const response = await fetch(providerUrl, {
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Financial Modeling Prep returned ${response.status}.`);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error('Financial Modeling Prep calendar payload is unavailable.');
  const regions: Record<string, string> = {
    US: 'US', 'United States': 'US', 'Euro Area': 'EU', 'United Kingdom': 'UK',
    Japan: 'JP', Australia: 'AU', Switzerland: 'CH',
  };
  return payload.flatMap((item, index): EconomicCatalyst[] => {
    if (!isRecord(item)) return [];
    const scheduledAt = typeof item.date === 'string' ? new Date(item.date) : null;
    const impactText = typeof item.impact === 'string' ? item.impact.toLowerCase() : '';
    const impact = impactText.includes('high') ? 'High' : impactText.includes('medium') ? 'Medium' : null;
    const country = typeof item.country === 'string' ? item.country : '';
    const title = typeof item.event === 'string' ? item.event : '';
    if (!scheduledAt || !Number.isFinite(scheduledAt.getTime()) || !impact || !regions[country] || !title) return [];
    const consensus = item.estimate === null || item.estimate === undefined ? 'Pending' : String(item.estimate);
    const actual = item.actual === null || item.actual === undefined ? null : String(item.actual);
    return [{
      id: `fmp-${scheduledAt.toISOString()}-${index}`,
      region: regions[country],
      title,
      scheduledAt: scheduledAt.toISOString(),
      impact,
      consensus,
      actual,
    }];
  });
}

async function getCotProvider(urlValue: string, token?: string): Promise<CotPosition[]> {
  const providerUrl = new URL(urlValue);
  if (providerUrl.protocol !== 'https:') throw new Error('COT provider must use HTTPS.');
  const response = await fetch(providerUrl, {
    cache: 'no-store',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`COT provider returned ${response.status}.`);
  const payload: unknown = await response.json();
  const positions = Array.isArray(payload) ? payload : isRecord(payload) ? payload.cot : null;
  if (!Array.isArray(positions) || !positions.every(isCotPosition)) throw new Error('COT provider payload failed validation.');
  return positions;
}

async function getCftcCot(): Promise<CotPosition[]> {
  const providerUrl = new URL('https://publicreporting.cftc.gov/resource/6dca-aqww.json');
  const cutoff = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const markets = [
    'EURO FX',
    'JAPANESE YEN',
    'BRITISH POUND',
    'AUSTRALIAN DOLLAR',
    'SWISS FRANC',
    'CANADIAN DOLLAR',
    'NEW ZEALAND DOLLAR',
    'GOLD',
  ];
  const marketFilter = markets.map((market) => `market_and_exchange_names like '%${market}%'`).join(' OR ');
  providerUrl.searchParams.set('$select', [
    'report_date_as_yyyy_mm_dd',
    'market_and_exchange_names',
    'noncomm_positions_long_all',
    'noncomm_positions_short_all',
    'change_in_noncomm_long_all',
    'change_in_noncomm_short_all',
  ].join(','));
  providerUrl.searchParams.set('$where', `report_date_as_yyyy_mm_dd >= '${cutoff}' AND (${marketFilter})`);
  providerUrl.searchParams.set('$order', 'report_date_as_yyyy_mm_dd DESC');
  providerUrl.searchParams.set('$limit', '2000');

  const response = await fetch(providerUrl, {
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`CFTC returned ${response.status}.`);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error('CFTC positioning payload is unavailable.');

  const marketCodes: Array<[string, string]> = [
    ['EURO FX - CHICAGO MERCANTILE EXCHANGE', 'EUR'],
    ['JAPANESE YEN - CHICAGO MERCANTILE EXCHANGE', 'JPY'],
    ['BRITISH POUND - CHICAGO MERCANTILE EXCHANGE', 'GBP'],
    ['AUSTRALIAN DOLLAR - CHICAGO MERCANTILE EXCHANGE', 'AUD'],
    ['SWISS FRANC - CHICAGO MERCANTILE EXCHANGE', 'CHF'],
    ['CANADIAN DOLLAR - CHICAGO MERCANTILE EXCHANGE', 'CAD'],
    ['NEW ZEALAND DOLLAR - CHICAGO MERCANTILE EXCHANGE', 'NZD'],
    ['GOLD - COMMODITY EXCHANGE INC.', 'GOLD'],
  ];
  const byMarket = new Map<string, Array<{ date: string; netContracts: number; weeklyChange: number }>>();
  for (const row of payload) {
    if (!isRecord(row) || typeof row.market_and_exchange_names !== 'string'
      || typeof row.report_date_as_yyyy_mm_dd !== 'string') continue;
    const marketName = row.market_and_exchange_names.toUpperCase();
    const reportDate = row.report_date_as_yyyy_mm_dd;
    if (!Number.isFinite(Date.parse(reportDate))) continue;
    const market = marketCodes.find(([name]) => marketName === name)?.[1];
    if (!market) continue;
    const long = Number(row.noncomm_positions_long_all);
    const short = Number(row.noncomm_positions_short_all);
    if (!Number.isFinite(long) || !Number.isFinite(short)) continue;
    const changeLong = Number(row.change_in_noncomm_long_all);
    const changeShort = Number(row.change_in_noncomm_short_all);
    const position = {
      date: reportDate,
      netContracts: long - short,
      weeklyChange: (Number.isFinite(changeLong) ? changeLong : 0) - (Number.isFinite(changeShort) ? changeShort : 0),
    };
    const history = byMarket.get(market) ?? [];
    history.push(position);
    byMarket.set(market, history);
  }

  const positions = [...byMarket.entries()].flatMap(([market, history]): CotPosition[] => {
    history.sort((left, right) => Date.parse(right.date) - Date.parse(left.date));
    const latest = history[0];
    if (!latest) return [];
    const below = history.filter((item) => item.netContracts < latest.netContracts).length;
    const equal = history.filter((item) => item.netContracts === latest.netContracts).length;
    const percentile = history.length
      ? Math.round(((below + equal / 2) / history.length) * 100)
      : 50;
    return [{ market, netContracts: latest.netContracts, percentile, weeklyChange: latest.weeklyChange, asOf: latest.date }];
  });
  if (!positions.length) throw new Error('CFTC returned no supported currency or gold positions.');
  return positions;
}

async function getLiveProviderSnapshot(): Promise<MacroSnapshot | null> {
  // FRED permits personal, non-commercial research with attribution; FRED-derived inputs are kept out of external AI prompts.
  const fredApiKey = process.env.FRED_API_KEY?.trim();
  const finnhubApiKey = process.env.FINNHUB_PERSONAL_PLAN_ACTIVE === 'true' ? process.env.FINNHUB_API_KEY?.trim() : undefined;
  const alphaVantageKey = process.env.ALPHA_VANTAGE_PERSONAL_PLAN_ACTIVE === 'true' ? process.env.ALPHA_VANTAGE_API_KEY?.trim() : undefined;
  const fmpKey = process.env.FMP_PERSONAL_PLAN_ACTIVE === 'true' ? process.env.FMP_API_KEY?.trim() : undefined;
  const cotProviderUrl = process.env.COT_DATA_PROVIDER_PERSONAL_USE_ENABLED === 'true' ? process.env.COT_DATA_PROVIDER_URL?.trim() : undefined;
  const cotProviderToken = process.env.COT_DATA_PROVIDER_TOKEN?.trim();

  // Never mix an old provider observation into a newly refreshed partial snapshot.
  // If an adapter fails, that input stays unavailable; persisted snapshots are used
  // separately with their original timestamp and a strict 24-hour freshness limit.
  const snapshot: MacroSnapshot = {
    ...getFallbackSnapshot(),
    currencies: getProviderCurrencySeed(),
    cot: [],
    catalysts: [],
    cotSource: 'unavailable',
    calendarSource: 'reference',
    asOf: new Date().toISOString(),
    source: 'fallback',
  };
  const [fredResult, finnhubResult, alphaResult, fmpResult, cotResult, frankfurterResult, calendarResult, ecbResult, bocResult, boeResult, worldBankResult, bojResult, rbaResult, rbnzResult, snbResult, usMacroResult] = await Promise.allSettled([
    fredApiKey ? getFredUsdUpdates(fredApiKey) : Promise.resolve(null),
    finnhubApiKey ? getFinnhubCatalysts(finnhubApiKey) : Promise.resolve(null),
    alphaVantageKey ? getAlphaVantageUsdUpdates(alphaVantageKey) : Promise.resolve(null),
    fmpKey ? getFmpCatalysts(fmpKey) : Promise.resolve(null),
    cotProviderUrl ? getCotProvider(cotProviderUrl, cotProviderToken) : getCachedData('macro:cftc-cot', getCftcCot, 6 * 60 * 60),
    getCachedData('macro:frankfurter-reference', getFrankfurterRates, 6 * 60 * 60),
    process.env.FAIRECONOMY_PERSONAL_PLAN_ACTIVE === 'true' ? getFairEconomyCatalysts() : Promise.resolve([]),
    getEcbMacroInputs(),
    getBankOfCanadaMacroInputs(),
    getBankOfEnglandPolicyRate(),
    getWorldBankG10Inflation(),
    getBankOfJapanPolicyRate(),
    getReserveBankOfAustraliaPolicyRate(),
    getReserveBankOfNewZealandPolicyRate(),
    process.env.SNB_DATA_SOURCE_ENABLED === 'true' ? getSwissNationalBankPolicyRate() : Promise.reject(new Error('SNB data source is disabled.')),
  ]);
  let hasLiveData = false;
  if (fredResult.status === 'fulfilled' && isRecord(fredResult.value)) {
    let usd = snapshot.currencies.find((currency) => currency.code === 'USD');
    const policyRate = isFiniteNumber(fredResult.value.policyRate)
      ? fredResult.value.policyRate
      : usd?.policyRate;
    const corePce = isFiniteNumber(fredResult.value.corePce) ? fredResult.value.corePce : usd?.corePce;
    const cpi = isFiniteNumber(fredResult.value.cpi) ? fredResult.value.cpi : usd?.cpi;
    const inflation = corePce ?? cpi ?? usd?.inflation;
    if (policyRate !== undefined && inflation !== undefined) {
      if (!usd) {
        usd = {
          code: 'USD',
          centralBank: 'Federal Reserve',
          policyRate,
          inflation,
          inflationLabel: corePce !== undefined ? 'Core PCE' : 'CPI',
          stance: 'Live observations',
        };
        snapshot.currencies.push(usd);
      }
      if (isFiniteNumber(fredResult.value.policyRate)) {
        usd.policyRate = fredResult.value.policyRate;
        usd.policyRateSource = 'provider';
        usd.policyRateProvider = 'fred';
        usd.policyRateAsOf = typeof fredResult.value.policyRateAsOf === 'string' ? fredResult.value.policyRateAsOf : undefined;
        hasLiveData = true;
      }
      if (isFiniteNumber(fredResult.value.corePce)) {
        usd.inflation = fredResult.value.corePce;
        usd.inflationLabel = 'Core PCE';
        usd.corePce = fredResult.value.corePce;
        usd.corePceAsOf = typeof fredResult.value.corePceAsOf === 'string' ? fredResult.value.corePceAsOf : undefined;
        usd.inflationSource = 'provider';
        usd.inflationProvider = 'fred';
        usd.inflationAsOf = typeof fredResult.value.corePceAsOf === 'string' ? fredResult.value.corePceAsOf : undefined;
        hasLiveData = true;
      }
      if (isFiniteNumber(fredResult.value.cpi)) {
        usd.cpi = fredResult.value.cpi;
        usd.cpiAsOf = typeof fredResult.value.cpiAsOf === 'string' ? fredResult.value.cpiAsOf : undefined;
        hasLiveData = true;
      }
      if (isFiniteNumber(fredResult.value.twoYearYield)) {
        usd.twoYearYield = fredResult.value.twoYearYield;
        usd.twoYearYieldSource = 'provider';
        usd.twoYearYieldAsOf = typeof fredResult.value.twoYearYieldAsOf === 'string' ? fredResult.value.twoYearYieldAsOf : undefined;
        hasLiveData = true;
      }
      if (!isFiniteNumber(fredResult.value.corePce) && isFiniteNumber(fredResult.value.cpi)) {
        usd.inflation = fredResult.value.cpi;
        usd.inflationLabel = 'CPI';
        usd.inflationSource = 'provider';
        usd.inflationAsOf = typeof fredResult.value.cpiAsOf === 'string' ? fredResult.value.cpiAsOf : undefined;
      }
    }
  } else if (fredResult.status === 'rejected') {
    console.warn('FRED macro series unavailable; USD provider observations are unavailable:', fredResult.reason);
  }
  if (finnhubResult.status === 'rejected') {
    console.warn('Finnhub economic calendar unavailable; checking configured calendar adapters:', finnhubResult.reason);
  }
  if (frankfurterResult.status === 'fulfilled' && isNumericRecord(frankfurterResult.value)) {
    snapshot.ecbRates = frankfurterResult.value;
    hasLiveData = true;
  } else if (frankfurterResult.status === 'rejected') {
    console.warn('ECB benchmark exchange rates are unavailable:', frankfurterResult.reason);
  }
  const calendarCandidates = [
    { provider: 'fair-economy' as const, events: calendarResult.status === 'fulfilled' ? calendarResult.value : [] },
    { provider: 'finnhub' as const, events: finnhubResult.status === 'fulfilled' ? (finnhubResult.value ?? []) : [] },
    { provider: 'fmp' as const, events: fmpResult.status === 'fulfilled' ? (fmpResult.value ?? []) : [] },
  ];
  const selectedCalendar = calendarCandidates.find((candidate) => candidate.events.length > 0);
  if (selectedCalendar) {
    snapshot.catalysts = selectedCalendar.events;
    snapshot.calendarSource = 'provider';
    snapshot.calendarProvider = selectedCalendar.provider;
    hasLiveData = true;
  } else {
    snapshot.catalysts = [];
    snapshot.calendarSource = 'reference';
    snapshot.calendarProvider = undefined;
    if (calendarResult.status === 'rejected') console.warn('FairEconomy calendar unavailable; no synthetic calendar fallback is used:', calendarResult.reason);
  }
  if (ecbResult.status === 'fulfilled') {
    const eur = snapshot.currencies.find((currency) => currency.code === 'EUR');
    if (eur) {
      if (isFiniteNumber(ecbResult.value.policyRate)) {
        eur.policyRate = ecbResult.value.policyRate;
        eur.policyRateSource = 'provider';
        eur.policyRateProvider = 'ecb';
        hasLiveData = true;
      }
      if (isFiniteNumber(ecbResult.value.inflation)) {
        eur.inflation = ecbResult.value.inflation;
        eur.inflationLabel = 'HICP';
        eur.inflationSource = 'provider';
        eur.inflationProvider = 'ecb';
        hasLiveData = true;
      }
      if (isFiniteNumber(ecbResult.value.twoYearYield)) {
        eur.twoYearYield = ecbResult.value.twoYearYield;
        eur.twoYearYieldSource = 'provider';
        hasLiveData = true;
      }
    }
  } else {
    console.warn('ECB policy, HICP, or yield series is unavailable:', ecbResult.reason);
  }
  if (bocResult.status === 'fulfilled') {
    const cad = snapshot.currencies.find((currency) => currency.code === 'CAD');
    if (cad) {
      if (isFiniteNumber(bocResult.value.policyRate)) {
        cad.policyRate = bocResult.value.policyRate;
        cad.policyRateSource = 'provider';
        cad.policyRateProvider = 'bank-of-canada';
        hasLiveData = true;
      }
      if (isFiniteNumber(bocResult.value.inflation)) {
        cad.inflation = bocResult.value.inflation;
        cad.inflationLabel = 'CPI';
        cad.inflationSource = 'provider';
        cad.inflationProvider = 'bank-of-canada';
        hasLiveData = true;
      }
    }
  } else {
    console.warn('Bank of Canada Valet policy or inflation series is unavailable:', bocResult.reason);
  }
  if (boeResult.status === 'fulfilled') {
    const gbp = snapshot.currencies.find((currency) => currency.code === 'GBP');
    if (gbp) {
      gbp.policyRate = boeResult.value;
      gbp.policyRateSource = 'provider';
      gbp.policyRateProvider = 'bank-of-england';
      hasLiveData = true;
    }
  } else {
    console.warn('Bank of England official Bank Rate is unavailable:', boeResult.reason);
  }

  const officialPolicyResults: Array<{ code: string; result: PromiseSettledResult<import('@/lib/internationalMacro').OfficialPolicyObservation> }> = [
    { code: 'JPY', result: bojResult }, { code: 'AUD', result: rbaResult },
    { code: 'NZD', result: rbnzResult }, { code: 'CHF', result: snbResult },
  ];
  for (const item of officialPolicyResults) {
    if (item.result.status !== 'fulfilled') {
      console.warn(`Official ${item.code} central-bank policy-rate source unavailable:`, item.result.reason);
      continue;
    }
    const currency = snapshot.currencies.find((entry) => entry.code === item.code);
    if (!currency || !Number.isFinite(item.result.value.value)) continue;
    currency.policyRate = item.result.value.value;
    currency.policyRateSource = 'provider';
    currency.policyRateProvider = item.code === 'JPY' ? 'bank-of-japan' : item.code === 'AUD' ? 'reserve-bank-of-australia' : item.code === 'NZD' ? 'reserve-bank-of-new-zealand' : 'swiss-national-bank';
    currency.policyRateAsOf = item.result.value.asOf;
    currency.policyRateSourceUrl = item.result.value.sourceUrl;
    hasLiveData = true;
  }

  if (worldBankResult.status === 'fulfilled') {
    for (const observation of worldBankResult.value) {
      const currency = snapshot.currencies.find((item) => item.code === observation.currency);
      if (!currency || currency.inflationSource === 'provider') continue;
      currency.inflation = observation.inflation;
      currency.inflationLabel = `CPI (annual, ${observation.year})`;
      currency.inflationSource = 'provider';
      currency.inflationProvider = 'world-bank';
      currency.inflationAsOf = observation.year;
      currency.inflationSourceUrl = `https://api.worldbank.org/v2/country/${({ GBP: 'GBR', JPY: 'JPN', CHF: 'CHE', AUD: 'AUS', NZD: 'NZL', SEK: 'SWE', NOK: 'NOR' } as Record<string, string>)[observation.currency]}/indicator/FP.CPI.TOTL.ZG`;
      hasLiveData = true;
    }
  } else {
    console.warn('World Bank G10 inflation data is unavailable:', worldBankResult.reason);
  }
  if (!fredApiKey && alphaVantageKey) {
    if (alphaResult.status === 'fulfilled' && isRecord(alphaResult.value)) {
      let usd = snapshot.currencies.find((currency) => currency.code === 'USD');
      const policyRate = isFiniteNumber(alphaResult.value.policyRate)
        ? alphaResult.value.policyRate
        : usd?.policyRate;
      const inflation = isFiniteNumber(alphaResult.value.inflation)
        ? alphaResult.value.inflation
        : usd?.inflation;
      if (policyRate !== undefined && inflation !== undefined) {
        if (!usd) {
          usd = {
            code: 'USD',
            centralBank: 'Federal Reserve',
            policyRate,
            inflation,
            inflationLabel: 'CPI',
            stance: 'Live observations',
          };
          snapshot.currencies.push(usd);
        }
        if (isFiniteNumber(alphaResult.value.policyRate)) {
          usd.policyRate = alphaResult.value.policyRate;
          usd.policyRateSource = 'provider';
          usd.policyRateProvider = 'alpha-vantage';
          hasLiveData = true;
        }
        if (isFiniteNumber(alphaResult.value.inflation)) {
          usd.inflation = alphaResult.value.inflation;
          usd.cpi = alphaResult.value.inflation;
          usd.inflationLabel = 'CPI';
          usd.inflationSource = 'provider';
          usd.inflationProvider = 'alpha-vantage';
          hasLiveData = true;
        }
      }
    } else if (alphaResult.status === 'rejected') {
      console.error('Alpha Vantage unavailable; USD provider observations are unavailable:', alphaResult.reason);
    }
  }
  if (fmpResult.status === 'rejected') {
    console.error('Financial Modeling Prep calendar unavailable:', fmpResult.reason);
  }
  if (usMacroResult.status === 'fulfilled' && usMacroResult.value) {
    snapshot.usIndicators = usMacroResult.value;
    hasLiveData = true;
  } else if (usMacroResult.status === 'rejected') {
    console.warn('Official BLS/BEA macro indicators are unavailable:', usMacroResult.reason);
  }
  if (cotResult.status === 'fulfilled' && Array.isArray(cotResult.value) && cotResult.value.every(isCotPosition)) {
    snapshot.cot = cotResult.value;
    snapshot.cotSource = 'provider';
    snapshot.cotProvider = cotProviderUrl ? 'custom' : 'cftc';
    hasLiveData = true;
  } else if (cotResult.status === 'rejected') {
    console.error('COT provider unavailable; no cached positioning is substituted:', cotResult.reason);
  }
  // Never return structural seed values or mixed reference/provider rows as live inputs.
  snapshot.currencies = snapshot.currencies.filter((currency) =>
    currency.policyRateSource === 'provider' && currency.inflationSource === 'provider');

  if (hasLiveData) {
    const coreG10 = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'SEK', 'NOK'];
    const completeG10MacroCoverage = coreG10.every((code) => {
      const currency = snapshot.currencies.find((item) => item.code === code);
      return currency?.policyRateSource === 'provider' && currency.inflationSource === 'provider';
    });
    // A live calendar, COT report or reference FX rate cannot make a partial
    // macro snapshot look fully provider-verified.
    snapshot.source = completeG10MacroCoverage ? 'provider' : 'partial';
  }
  return hasLiveData ? snapshot : null;
}

async function getPersistedSnapshot(): Promise<MacroSnapshot | null> {
  if (!(process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())) return null;
  try {
    const { data, error } = await getSupabaseAdmin().from('macro_snapshot_payloads')
      .select('payload,refreshed_at')
      .eq('snapshot_key', 'global')
      .maybeSingle();
    if (error) {
      console.warn('Persisted macro snapshot lookup failed:', error);
      return null;
    }
    if (!data || !isRecord(data.payload)) return null;
    if (data.payload.source !== 'provider' && data.payload.source !== 'partial') return null;
    const parsed = parseProviderSnapshot(data.payload);
    const refreshedAt = Date.parse(data.refreshed_at);
    const snapshotAgeMs = Date.now() - refreshedAt;
    if (!parsed || !Number.isFinite(refreshedAt) || snapshotAgeMs < -5 * 60_000 || snapshotAgeMs > 24 * 60 * 60_000) return null;
    const ecbRates = isRecord(data.payload.ecbRates)
      ? Object.fromEntries(Object.entries(data.payload.ecbRates)
        .filter((entry): entry is [string, number] => /^[A-Z]{3}$/.test(entry[0])
          && isFiniteNumber(entry[1]) && entry[1] > 0))
      : undefined;
    return {
      ...parsed,
      source: data.payload.source === 'partial'
        ? 'partial'
        : data.payload.source === 'provider'
          ? 'provider'
          : 'fallback',
      cotSource: data.payload.cotSource === 'provider' ? 'provider' : 'unavailable',
      cotProvider: data.payload.cotProvider === 'cftc' || data.payload.cotProvider === 'custom' ? data.payload.cotProvider : undefined,
      calendarSource: data.payload.calendarSource === 'provider' ? 'provider' : 'reference',
      calendarProvider: ['fair-economy', 'finnhub', 'fmp', 'macro-provider'].includes(String(data.payload.calendarProvider)) ? data.payload.calendarProvider as MacroSnapshot['calendarProvider'] : undefined,
      asOf: data.refreshed_at,
      ...(ecbRates && Object.keys(ecbRates).length > 0 ? { ecbRates } : {}),
    };
  } catch (error) {
    console.warn('Persisted macro snapshot is unavailable:', error);
    return null;
  }
}

async function persistMacroSnapshot(snapshot: MacroSnapshot): Promise<void> {
  if (snapshot.source !== 'provider' && snapshot.source !== 'partial') return;
  try {
    const { error } = await getSupabaseAdmin().from('macro_snapshot_payloads').upsert({
      snapshot_key: 'global',
      payload: snapshot,
      refreshed_at: snapshot.asOf,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'snapshot_key' });
    if (error) throw error;
  } catch (error) {
    // Provider data remains usable for this request even if persistence is unavailable.
    console.warn('Macro snapshot persistence failed:', error);
  }
}

export async function loadMacroSnapshot(): Promise<MacroSnapshot> {
  const persisted = await getPersistedSnapshot();
  const endpoint = process.env.MACRO_DATA_PROVIDER_PERSONAL_USE_ENABLED === 'true' ? process.env.MACRO_DATA_PROVIDER_URL?.trim() : undefined;
  if (endpoint) {
    try {
      const providerUrl = new URL(endpoint);
      if (providerUrl.protocol !== 'https:') throw new Error('Macro provider must use HTTPS.');

      const token = process.env.MACRO_DATA_PROVIDER_TOKEN?.trim();
      const response = await fetch(providerUrl, {
        cache: 'no-store',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) throw new Error(`Macro provider returned ${response.status}.`);

      const parsed = parseProviderSnapshot(await response.json() as unknown);
      if (!parsed) throw new Error('Macro provider payload failed validation.');
      let ecbRates = persisted?.ecbRates;
      {
        try {
          ecbRates = await getCachedData('macro:frankfurter-reference', getFrankfurterRates, 6 * 60 * 60);
        } catch (error) {
          console.warn('ECB benchmark exchange rates are unavailable:', error);
        }
      }
      const providerSnapshot = mergeWithFallback({
        ...getFallbackSnapshot(),
        ...parsed,
        currencies: parsed.currencies.map((currency) => ({
          ...currency,
          policyRateSource: 'provider' as const,
          inflationSource: 'provider' as const,
          policyRateProvider: 'macro-provider' as const,
          inflationProvider: 'macro-provider' as const,
        })),
        cot: parsed.cot,
        catalysts: parsed.catalysts,
        source: 'partial',
        cotSource: parsed.cot.length > 0 ? 'provider' : 'unavailable',
        cotProvider: parsed.cot.length > 0 ? 'custom' : undefined,
        calendarSource: parsed.catalysts.length > 0 ? 'provider' : 'reference',
        calendarProvider: parsed.catalysts.length > 0 ? 'macro-provider' : undefined,
        asOf: new Date().toISOString(),
        ...(ecbRates ? { ecbRates } : {}),
      });
      const coreG10 = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'SEK', 'NOK'];
      const completeG10MacroCoverage = coreG10.every((code) => {
        const currency = providerSnapshot.currencies.find((item) => item.code === code);
        return currency?.policyRateSource === 'provider' && currency.inflationSource === 'provider';
      });
      providerSnapshot.source = completeG10MacroCoverage ? 'provider' : 'partial';
      await persistMacroSnapshot(providerSnapshot);
      return providerSnapshot;
    } catch (error) {
      console.error('Macro data provider unavailable; checking live API adapters:', error);
    }
  }

  try {
    const liveSnapshot = await getLiveProviderSnapshot();
    if (liveSnapshot) {
      const merged = mergeWithFallback(liveSnapshot);
      await persistMacroSnapshot(merged);
      return merged;
    }
  } catch (error) {
    console.error('Live macro APIs unavailable; checking the persisted snapshot:', error);
  }
  if (persisted) return mergeWithFallback(persisted);
  console.warn('No live macro source or persisted snapshot is available; serving reference macro levels.');
  return getFallbackSnapshot();
}
