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

async function getLiveProviderSnapshot(): Promise<MacroSnapshot | null> {
  const alphaVantageKey = process.env.ALPHA_VANTAGE_API_KEY?.trim();
  const fmpKey = process.env.FMP_API_KEY?.trim();
  const cotProviderUrl = process.env.COT_DATA_PROVIDER_URL?.trim();
  const cotProviderToken = process.env.COT_DATA_PROVIDER_TOKEN?.trim();
  if (!alphaVantageKey && !fmpKey && !cotProviderUrl) return null;

  const snapshot: MacroSnapshot = {
    ...SEED_SNAPSHOT,
    currencies: SEED_SNAPSHOT.currencies.map((currency) => ({ ...currency })),
    cot: SEED_SNAPSHOT.cot.map((position) => ({ ...position })),
    catalysts: SEED_SNAPSHOT.catalysts.map((catalyst) => ({ ...catalyst })),
    asOf: new Date().toISOString(),
    source: 'partial',
    cotSource: 'seed',
  };
  const providers: PromiseSettledResult<unknown>[] = await Promise.allSettled([
    ...(alphaVantageKey ? [getAlphaVantageUsdUpdates(alphaVantageKey)] : []),
    ...(fmpKey ? [getFmpCatalysts(fmpKey)] : []),
    ...(cotProviderUrl ? [getCotProvider(cotProviderUrl, cotProviderToken)] : []),
  ]);
  let hasLiveData = false;
  let resultIndex = 0;
  if (alphaVantageKey) {
    const result = providers[resultIndex++];
    if (result?.status === 'fulfilled' && isRecord(result.value)) {
      const usd = snapshot.currencies.find((currency) => currency.code === 'USD');
      if (usd) {
        const policyRate = result.value.policyRate;
        const inflation = result.value.inflation;
        if (isFiniteNumber(policyRate)) {
          usd.policyRate = policyRate;
          hasLiveData = true;
        }
        if (isFiniteNumber(inflation)) {
          usd.inflation = inflation;
          hasLiveData = true;
        }
      }
    } else if (result?.status === 'rejected') {
      console.error('Alpha Vantage unavailable; retaining seeded USD macro values:', result.reason);
    }
  }
  if (fmpKey) {
    const result = providers[resultIndex];
    if (result?.status === 'fulfilled' && Array.isArray(result.value) && result.value.every(isCatalyst)) {
      snapshot.catalysts = result.value;
      hasLiveData = true;
    } else if (result?.status === 'rejected') {
      console.error('Financial Modeling Prep unavailable; retaining seeded catalysts:', result.reason);
    }
  }
  if (cotProviderUrl) {
    const result = providers[resultIndex];
    if (result?.status === 'fulfilled' && Array.isArray(result.value) && result.value.every(isCotPosition)) {
      snapshot.cot = result.value;
      snapshot.cotSource = 'provider';
      hasLiveData = true;
    } else if (result?.status === 'rejected') {
      console.error('COT provider unavailable; retaining seeded positioning:', result.reason);
    }
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
    if (error || !data || !isRecord(data.payload)) return null;
    const parsed = parseProviderSnapshot(data.payload);
    if (!parsed || !Number.isFinite(Date.parse(data.refreshed_at))) return null;
    return {
      ...parsed,
      source: data.payload.source === 'partial' ? 'partial' : 'provider',
      cotSource: data.payload.cotSource === 'provider' ? 'provider' : 'seed',
      asOf: data.refreshed_at,
    };
  } catch {
    return null;
  }
}

export async function getMacroSnapshot(forceRefresh = false): Promise<MacroSnapshot> {
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
  return { ...SEED_SNAPSHOT, asOf: new Date().toISOString() };
}
