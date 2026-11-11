import 'server-only';
import type { CotPosition, EconomicCatalyst, MacroCurrency, MacroSnapshot } from '@/types/macro';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

export const SEED_SNAPSHOT: MacroSnapshot = {
  asOf: '2026-11-10T00:00:00.000Z',
  source: 'seed',
  cotSource: 'seed',
  currencies: [
    { code: 'USD', centralBank: 'Federal Reserve', policyRate: 3.75, inflation: 2.8, inflationLabel: 'Core PCE', stance: 'Restrictive' },
    { code: 'EUR', centralBank: 'European Central Bank', policyRate: 2.15, inflation: 2.1, inflationLabel: 'HICP', stance: 'Neutral' },
    { code: 'GBP', centralBank: 'Bank of England', policyRate: 4.0, inflation: 2.8, inflationLabel: 'CPI', stance: 'Cautious' },
    { code: 'JPY', centralBank: 'Bank of Japan', policyRate: 0.5, inflation: 3.0, inflationLabel: 'CPI', stance: 'Normalising' },
    { code: 'AUD', centralBank: 'Reserve Bank of Australia', policyRate: 3.6, inflation: 3.4, inflationLabel: 'CPI', stance: 'Restrictive' },
    { code: 'CHF', centralBank: 'Swiss National Bank', policyRate: 0.0, inflation: 0.2, inflationLabel: 'CPI', stance: 'Accommodative' },
  ],
  cot: [
    { market: 'EUR', netContracts: 108_400, percentile: 87, weeklyChange: 12_600 },
    { market: 'JPY', netContracts: -76_200, percentile: 18, weeklyChange: -8_900 },
    { market: 'GBP', netContracts: 22_100, percentile: 61, weeklyChange: 4_300 },
    { market: 'AUD', netContracts: -41_800, percentile: 29, weeklyChange: -5_100 },
    { market: 'CHF', netContracts: -12_700, percentile: 38, weeklyChange: 1_800 },
    { market: 'GOLD', netContracts: 184_600, percentile: 94, weeklyChange: 17_200 },
  ],
  catalysts: [
    { id: 'us-cpi-nov', region: 'US', title: 'Consumer Price Index', scheduledAt: '2026-11-12T13:30:00.000Z', impact: 'High', consensus: '2.8% y/y', actual: null },
    { id: 'us-nfp-dec', region: 'US', title: 'Non-Farm Payrolls', scheduledAt: '2026-12-04T13:30:00.000Z', impact: 'High', consensus: '+145k', actual: null },
    { id: 'fomc-dec', region: 'US', title: 'FOMC Rate Decision', scheduledAt: '2026-12-09T19:00:00.000Z', impact: 'High', consensus: 'Hold', actual: null },
    { id: 'ecb-dec', region: 'EU', title: 'ECB Policy Decision', scheduledAt: '2026-12-17T13:15:00.000Z', impact: 'High', consensus: 'Hold', actual: null },
    { id: 'uk-retail-nov', region: 'UK', title: 'Retail Sales', scheduledAt: '2026-11-20T07:00:00.000Z', impact: 'Medium', consensus: '+0.2% m/m', actual: null },
  ],
};

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

async function getAlphaVantageObservations(functionName: 'FEDERAL_FUNDS_RATE' | 'CPI', apiKey: string): Promise<Observation[]> {
  const providerUrl = new URL('https://www.alphavantage.co/query');
  providerUrl.searchParams.set('function', functionName);
  providerUrl.searchParams.set('apikey', apiKey);
  if (functionName === 'FEDERAL_FUNDS_RATE') providerUrl.searchParams.set('interval', 'monthly');
  const response = await fetch(providerUrl, {
    next: { revalidate: 21_600 },
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
    next: { revalidate: 21_600 },
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
    const consensus = item.estimate === null || item.estimate === undefined ? '—' : String(item.estimate);
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
    next: { revalidate: 21_600 },
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
    next: { revalidate: 21_600 },
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

async function getLiveProviderSnapshot(): Promise<MacroSnapshot | null> {
  const alphaVantageKey = process.env.ALPHA_VANTAGE_API_KEY?.trim();
  const fmpKey = process.env.FMP_API_KEY?.trim();
  const cotProviderUrl = process.env.COT_DATA_PROVIDER_URL?.trim();
  const cotProviderToken = process.env.COT_DATA_PROVIDER_TOKEN?.trim();

  const snapshot: MacroSnapshot = {
    ...SEED_SNAPSHOT,
    currencies: SEED_SNAPSHOT.currencies.map((currency) => ({ ...currency })),
    cot: SEED_SNAPSHOT.cot.map((position) => ({ ...position })),
    catalysts: SEED_SNAPSHOT.catalysts.map((catalyst) => ({ ...catalyst })),
    asOf: new Date().toISOString(),
    source: 'partial',
    cotSource: 'seed',
  };
  const [alphaResult, fmpResult, cotResult] = await Promise.allSettled([
    alphaVantageKey ? getAlphaVantageUsdUpdates(alphaVantageKey) : Promise.resolve(null),
    fmpKey ? getFmpCatalysts(fmpKey) : Promise.resolve(null),
    cotProviderUrl ? getCotProvider(cotProviderUrl, cotProviderToken) : getCftcCot(),
  ]);
  let hasLiveData = false;
  if (alphaVantageKey) {
    if (alphaResult.status === 'fulfilled' && isRecord(alphaResult.value)) {
      const usd = snapshot.currencies.find((currency) => currency.code === 'USD');
      if (usd) {
        const policyRate = alphaResult.value.policyRate;
        const inflation = alphaResult.value.inflation;
        if (isFiniteNumber(policyRate)) {
          usd.policyRate = policyRate;
          hasLiveData = true;
        }
        if (isFiniteNumber(inflation)) {
          usd.inflation = inflation;
          hasLiveData = true;
        }
      }
    } else if (alphaResult.status === 'rejected') {
      console.error('Alpha Vantage unavailable; retaining seeded USD macro values:', alphaResult.reason);
    }
  }
  if (fmpKey) {
    if (fmpResult.status === 'fulfilled' && Array.isArray(fmpResult.value) && fmpResult.value.every(isCatalyst)) {
      snapshot.catalysts = fmpResult.value;
      hasLiveData = true;
    } else if (fmpResult.status === 'rejected') {
      console.error('Financial Modeling Prep unavailable; retaining seeded catalysts:', fmpResult.reason);
    }
  }
  if (cotResult.status === 'fulfilled' && Array.isArray(cotResult.value) && cotResult.value.every(isCotPosition)) {
    snapshot.cot = cotResult.value;
    snapshot.cotSource = 'provider';
    hasLiveData = true;
  } else if (cotResult.status === 'rejected') {
    console.error('COT provider unavailable; retaining seeded positioning:', cotResult.reason);
  }
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
    const parsed = parseProviderSnapshot(data.payload);
    if (!parsed || !Number.isFinite(Date.parse(data.refreshed_at))) return null;
    return {
      ...parsed,
      source: data.payload.source === 'partial' ? 'partial' : 'provider',
      cotSource: data.payload.cotSource === 'provider' ? 'provider' : 'seed',
      asOf: data.refreshed_at,
    };
  } catch (error) {
    console.warn('Persisted macro snapshot is unavailable:', error);
    return null;
  }
}

export async function loadMacroSnapshot(forceRefresh = false): Promise<MacroSnapshot> {
  if (!forceRefresh) {
    const persisted = await getPersistedSnapshot();
    if (persisted && Date.now() - Date.parse(persisted.asOf) <= 8 * 24 * 60 * 60 * 1000) return persisted;
  }
  const endpoint = process.env.MACRO_DATA_PROVIDER_URL?.trim();
  if (endpoint) {
    try {
      const providerUrl = new URL(endpoint);
      if (providerUrl.protocol !== 'https:' && providerUrl.protocol !== 'http:') throw new Error('Unsupported provider protocol.');

      const token = process.env.MACRO_DATA_PROVIDER_TOKEN?.trim();
      const response = await fetch(providerUrl, {
        next: { revalidate: 1_800 },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) throw new Error(`Macro provider returned ${response.status}.`);

      const parsed = parseProviderSnapshot(await response.json() as unknown);
      if (!parsed) throw new Error('Macro provider payload failed validation.');
      return { ...parsed, source: 'provider', cotSource: 'provider', asOf: new Date().toISOString() };
    } catch (error) {
      console.error('Macro data provider unavailable; checking live API adapters:', error);
    }
  }

  try {
    const liveSnapshot = await getLiveProviderSnapshot();
    if (liveSnapshot) return liveSnapshot;
  } catch (error) {
    console.error('Live macro APIs unavailable; using the seed snapshot:', error);
  }
  throw new Error('No live macro provider returned a valid snapshot.');
}
