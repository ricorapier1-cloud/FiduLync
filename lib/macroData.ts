import type { CotPosition, EconomicCatalyst, MacroCurrency, MacroSnapshot } from '@/types/macro';

export const SEED_SNAPSHOT: MacroSnapshot = {
  asOf: '2026-11-10T00:00:00.000Z',
  source: 'seed',
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

export async function getMacroSnapshot(): Promise<MacroSnapshot> {
  const endpoint = process.env.MACRO_DATA_PROVIDER_URL?.trim();
  if (!endpoint) return { ...SEED_SNAPSHOT, asOf: new Date().toISOString() };

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
    return { ...parsed, source: 'provider', asOf: new Date().toISOString() };
  } catch (error) {
    console.error('Macro data provider unavailable; using the seed snapshot:', error);
    return { ...SEED_SNAPSHOT, asOf: new Date().toISOString() };
  }
}
