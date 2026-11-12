import 'server-only';
import type { CotPosition, EconomicCatalyst, MacroCurrency, MacroSnapshot } from '@/types/macro';
import { getSupabaseAdmin } from '@/lib/serverSupabase';
import {
  getBankOfCanadaMacroInputs,
  getBankOfEnglandPolicyRate,
  getEcbMacroInputs,
  getWorldBankG10Inflation,
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
  return {
    asOf: new Date().toISOString(),
    source: 'fallback',
    cotSource: 'unavailable',
    calendarSource: 'reference',
    currencies: [
      { code: 'USD', centralBank: 'Federal Reserve', policyRate: 3.75, inflation: 2.8, twoYearYield: 4, twoYearYieldSource: 'reference', inflationLabel: 'Core PCE', policyRateSource: 'reference', inflationSource: 'reference', stance: 'Restrictive' },
      { code: 'EUR', centralBank: 'European Central Bank', policyRate: 2.15, inflation: 2.1, inflationLabel: 'HICP', policyRateSource: 'reference', inflationSource: 'reference', stance: 'Neutral' },
      { code: 'GBP', centralBank: 'Bank of England', policyRate: 4, inflation: 2.8, inflationLabel: 'CPI', policyRateSource: 'reference', inflationSource: 'reference', stance: 'Cautious' },
      { code: 'JPY', centralBank: 'Bank of Japan', policyRate: 0.5, inflation: 3, inflationLabel: 'CPI', policyRateSource: 'reference', inflationSource: 'reference', stance: 'Normalising' },
      { code: 'AUD', centralBank: 'Reserve Bank of Australia', policyRate: 3.6, inflation: 3.4, inflationLabel: 'CPI', policyRateSource: 'reference', inflationSource: 'reference', stance: 'Restrictive' },
      { code: 'CHF', centralBank: 'Swiss National Bank', policyRate: 0, inflation: 0.2, inflationLabel: 'CPI', policyRateSource: 'reference', inflationSource: 'reference', stance: 'Accommodative' },
      { code: 'CAD', centralBank: 'Bank of Canada', policyRate: 2.25, inflation: 2.4, inflationLabel: 'CPI', policyRateSource: 'reference', inflationSource: 'reference', stance: 'Neutral' },
      { code: 'NZD', centralBank: 'Reserve Bank of New Zealand', policyRate: 2.5, inflation: 2.7, inflationLabel: 'CPI', policyRateSource: 'reference', inflationSource: 'reference', stance: 'Neutral' },
      { code: 'SEK', centralBank: 'Sveriges Riksbank', policyRate: 1.75, inflation: 1.8, inflationLabel: 'CPIF', policyRateSource: 'reference', inflationSource: 'reference', stance: 'Neutral' },
      { code: 'NOK', centralBank: 'Norges Bank', policyRate: 4, inflation: 2.4, inflationLabel: 'CPI-ATE', policyRateSource: 'reference', inflationSource: 'reference', stance: 'Restrictive' },
    ],
    cot: [],
    catalysts: [
      { id: 'us-cpi-nov', region: 'US', title: 'Consumer Price Index', scheduledAt: '2026-11-12T13:30:00.000Z', impact: 'High', consensus: '2.8% y/y', actual: null },
      { id: 'us-nfp-dec', region: 'US', title: 'Non-Farm Payrolls', scheduledAt: '2026-12-04T13:30:00.000Z', impact: 'High', consensus: '+145k', actual: null },
      { id: 'fomc-dec', region: 'US', title: 'FOMC Rate Decision', scheduledAt: '2026-12-09T19:00:00.000Z', impact: 'High', consensus: 'Hold', actual: null },
      { id: 'ecb-dec', region: 'EU', title: 'ECB Policy Decision', scheduledAt: '2026-12-17T13:15:00.000Z', impact: 'High', consensus: 'Hold', actual: null },
    ],
  };
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

function isCurrency(value: unknown): value is MacroCurrency {
  return isRecord(value)
    && typeof value.code === 'string'
    && typeof value.centralBank === 'string'
    && isFiniteNumber(value.policyRate)
    && isFiniteNumber(value.inflation)
    && typeof value.inflationLabel === 'string'
    && (value.corePce === undefined || isFiniteNumber(value.corePce))
    && (value.cpi === undefined || isFiniteNumber(value.cpi))
    && (value.twoYearYield === undefined || isFiniteNumber(value.twoYearYield))
    && (value.twoYearYieldSource === undefined || value.twoYearYieldSource === 'provider' || value.twoYearYieldSource === 'reference')
    && (value.policyRateSource === undefined || value.policyRateSource === 'provider' || value.policyRateSource === 'reference')
    && (value.inflationSource === undefined || value.inflationSource === 'provider' || value.inflationSource === 'reference')
    && typeof value.stance === 'string';
}

function isCotPosition(value: unknown): value is CotPosition {
  return isRecord(value)
    && typeof value.market === 'string'
    && isFiniteNumber(value.netContracts)
    && isFiniteNumber(value.percentile)
    && value.percentile >= 0
    && value.percentile <= 100
    && isFiniteNumber(value.weeklyChange);
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

function parseProviderSnapshot(value: unknown): Pick<MacroSnapshot, 'currencies' | 'cot' | 'catalysts'> | null {
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
  const [rateResult, pceResult, cpiResult, twoYearResult] = await Promise.allSettled([
    getFredObservations('DFF', apiKey),
    getFredObservations('PCEPILFE', apiKey),
    getFredObservations('CPIAUCSL', apiKey),
    getFredObservations('DGS2', apiKey),
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
  return {
    policyRate: rateResult.status === 'fulfilled' ? rateResult.value[0]?.value : undefined,
    corePce: pceResult.status === 'fulfilled' ? latestYearOverYear(pceResult.value) : undefined,
    cpi: cpiResult.status === 'fulfilled' ? latestYearOverYear(cpiResult.value) : undefined,
    twoYearYield: twoYearResult.status === 'fulfilled' ? twoYearResult.value[0]?.value : undefined,
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
  if (providerUrl.protocol !== 'https:' && providerUrl.protocol !== 'http:') throw new Error('Unsupported COT provider protocol.');
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
    return [{ market, netContracts: latest.netContracts, percentile, weeklyChange: latest.weeklyChange }];
  });
  if (!positions.length) throw new Error('CFTC returned no supported currency or gold positions.');
  return positions;
}

async function getLiveProviderSnapshot(cachedSnapshot: MacroSnapshot = getFallbackSnapshot()): Promise<MacroSnapshot | null> {
  const fredApiKey = process.env.FRED_API_KEY?.trim();
  const finnhubApiKey = process.env.FINNHUB_API_KEY?.trim();
  const alphaVantageKey = process.env.ALPHA_VANTAGE_API_KEY?.trim();
  const fmpKey = process.env.FMP_API_KEY?.trim();
  const cotProviderUrl = process.env.COT_DATA_PROVIDER_URL?.trim();
  const cotProviderToken = process.env.COT_DATA_PROVIDER_TOKEN?.trim();

  const snapshot: MacroSnapshot = {
    ...cachedSnapshot,
    currencies: cachedSnapshot.currencies.map((currency) => ({ ...currency })),
    cot: cachedSnapshot.cot.map((position) => ({ ...position })),
    catalysts: cachedSnapshot.catalysts.map((catalyst) => ({ ...catalyst })),
    asOf: new Date().toISOString(),
    source: cachedSnapshot.source === 'fallback' ? 'fallback' : 'partial',
  };
  const [fredResult, finnhubResult, alphaResult, fmpResult, cotResult, frankfurterResult, calendarResult, ecbResult, bocResult, boeResult, worldBankResult] = await Promise.allSettled([
    fredApiKey ? getFredUsdUpdates(fredApiKey) : Promise.resolve(null),
    finnhubApiKey ? getFinnhubCatalysts(finnhubApiKey) : Promise.resolve(null),
    alphaVantageKey ? getAlphaVantageUsdUpdates(alphaVantageKey) : Promise.resolve(null),
    fmpKey ? getFmpCatalysts(fmpKey) : Promise.resolve(null),
    cotProviderUrl ? getCotProvider(cotProviderUrl, cotProviderToken) : getCftcCot(),
    getFrankfurterRates(),
    getFairEconomyCatalysts(),
    getEcbMacroInputs(),
    getBankOfCanadaMacroInputs(),
    getBankOfEnglandPolicyRate(),
    getWorldBankG10Inflation(),
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
        hasLiveData = true;
      }
      if (isFiniteNumber(fredResult.value.corePce)) {
        usd.inflation = fredResult.value.corePce;
        usd.inflationLabel = 'Core PCE';
        usd.corePce = fredResult.value.corePce;
        usd.inflationSource = 'provider';
        hasLiveData = true;
      }
      if (isFiniteNumber(fredResult.value.cpi)) {
        usd.cpi = fredResult.value.cpi;
        usd.inflationSource = 'provider';
        hasLiveData = true;
      }
      if (isFiniteNumber(fredResult.value.twoYearYield)) {
        usd.twoYearYield = fredResult.value.twoYearYield;
        usd.twoYearYieldSource = 'provider';
        hasLiveData = true;
      }
      if (!isFiniteNumber(fredResult.value.corePce) && isFiniteNumber(fredResult.value.cpi)) {
        usd.inflation = fredResult.value.cpi;
        usd.inflationLabel = 'CPI';
        usd.inflationSource = 'provider';
      }
    }
  } else if (fredResult.status === 'rejected') {
    console.warn('FRED macro series unavailable; retaining cached USD observations:', fredResult.reason);
  }
  if (finnhubResult.status === 'rejected') {
    console.warn('Finnhub economic calendar unavailable; checking configured calendar adapters:', finnhubResult.reason);
  }
  if (frankfurterResult.status === 'fulfilled' && isRecord(frankfurterResult.value)) {
    snapshot.ecbRates = frankfurterResult.value;
    hasLiveData = true;
  } else if (frankfurterResult.status === 'rejected') {
    console.warn('ECB benchmark exchange rates are unavailable:', frankfurterResult.reason);
  }
  const providerCalendar = calendarResult.status === 'fulfilled' && calendarResult.value.length > 0
    ? calendarResult.value
    : finnhubResult.status === 'fulfilled' && finnhubResult.value?.length
      ? finnhubResult.value
      : fmpResult.status === 'fulfilled' && fmpResult.value?.length
        ? fmpResult.value
        : null;
  if (providerCalendar) {
    snapshot.catalysts = providerCalendar;
    snapshot.calendarSource = 'provider';
    hasLiveData = true;
  } else if (calendarResult.status === 'rejected') {
    console.warn('FairEconomy calendar is unavailable; using configured provider calendars or curated reference events:', calendarResult.reason);
  }
  if (ecbResult.status === 'fulfilled') {
    const eur = snapshot.currencies.find((currency) => currency.code === 'EUR');
    if (eur) {
      if (isFiniteNumber(ecbResult.value.policyRate)) {
        eur.policyRate = ecbResult.value.policyRate;
        eur.policyRateSource = 'provider';
        hasLiveData = true;
      }
      if (isFiniteNumber(ecbResult.value.inflation)) {
        eur.inflation = ecbResult.value.inflation;
        eur.inflationLabel = 'HICP';
        eur.inflationSource = 'provider';
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
        hasLiveData = true;
      }
      if (isFiniteNumber(bocResult.value.inflation)) {
        cad.inflation = bocResult.value.inflation;
        cad.inflationLabel = 'CPI';
        cad.inflationSource = 'provider';
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
      hasLiveData = true;
    }
  } else {
    console.warn('Bank of England official Bank Rate is unavailable:', boeResult.reason);
  }
  if (worldBankResult.status === 'fulfilled') {
    for (const observation of worldBankResult.value) {
      const currency = snapshot.currencies.find((item) => item.code === observation.currency);
      if (!currency || currency.inflationSource === 'provider') continue;
      currency.inflation = observation.inflation;
      currency.inflationLabel = `CPI (annual, ${observation.year})`;
      currency.inflationSource = 'provider';
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
          hasLiveData = true;
        }
        if (isFiniteNumber(alphaResult.value.inflation)) {
          usd.inflation = alphaResult.value.inflation;
          usd.cpi = alphaResult.value.inflation;
          usd.inflationLabel = 'CPI';
          usd.inflationSource = 'provider';
          hasLiveData = true;
        }
      }
    } else if (alphaResult.status === 'rejected') {
      console.error('Alpha Vantage unavailable; retaining cached USD macro values:', alphaResult.reason);
    }
  }
  if (fmpResult.status === 'rejected') {
    console.error('Financial Modeling Prep unavailable; retaining available calendar events:', fmpResult.reason);
  }
  if (cotResult.status === 'fulfilled' && Array.isArray(cotResult.value) && cotResult.value.every(isCotPosition)) {
    snapshot.cot = cotResult.value;
    snapshot.cotSource = 'provider';
    hasLiveData = true;
  } else if (cotResult.status === 'rejected') {
    console.error('COT provider unavailable; retaining cached positioning:', cotResult.reason);
  }
  if (hasLiveData) snapshot.source = 'partial';
  return hasLiveData ? snapshot : null;
}

async function getPersistedSnapshot(): Promise<MacroSnapshot | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return null;
  try {
    const { data, error } = await getSupabaseAdmin().from('macro_snapshots')
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
    if (!parsed || !Number.isFinite(Date.parse(data.refreshed_at))) return null;
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
      calendarSource: data.payload.calendarSource === 'provider' ? 'provider' : 'reference',
      asOf: data.refreshed_at,
      ...(ecbRates && Object.keys(ecbRates).length > 0 ? { ecbRates } : {}),
    };
  } catch (error) {
    console.warn('Persisted macro snapshot is unavailable:', error);
    return null;
  }
}

export async function loadMacroSnapshot(): Promise<MacroSnapshot> {
  const persisted = await getPersistedSnapshot();
  const baseline = mergeWithFallback(persisted ?? getFallbackSnapshot());
  const endpoint = process.env.MACRO_DATA_PROVIDER_URL?.trim();
  if (endpoint) {
    try {
      const providerUrl = new URL(endpoint);
      if (providerUrl.protocol !== 'https:' && providerUrl.protocol !== 'http:') throw new Error('Unsupported provider protocol.');

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
      try {
        ecbRates = await getFrankfurterRates();
      } catch (error) {
        console.warn('ECB benchmark exchange rates are unavailable:', error);
      }
      return mergeWithFallback({
        ...baseline,
        ...parsed,
        currencies: [
          ...baseline.currencies,
          ...parsed.currencies.map((currency) => ({
            ...currency,
            policyRateSource: 'provider' as const,
            inflationSource: 'provider' as const,
          })),
        ],
        cot: parsed.cot.length > 0 ? parsed.cot : baseline.cot,
        catalysts: parsed.catalysts.length > 0 ? parsed.catalysts : baseline.catalysts,
        source: 'provider',
        cotSource: 'provider',
        calendarSource: parsed.catalysts.length > 0 ? 'provider' : 'reference',
        asOf: new Date().toISOString(),
        ...(ecbRates ? { ecbRates } : {}),
      });
    } catch (error) {
      console.error('Macro data provider unavailable; checking live API adapters:', error);
    }
  }

  try {
    const liveSnapshot = await getLiveProviderSnapshot(baseline);
    if (liveSnapshot) {
      return mergeWithFallback(liveSnapshot);
    }
  } catch (error) {
    console.error('Live macro APIs unavailable; checking the persisted snapshot:', error);
  }
  if (persisted) return mergeWithFallback(persisted);
  console.warn('No live macro source or persisted snapshot is available; serving reference macro levels.');
  return getFallbackSnapshot();
}
