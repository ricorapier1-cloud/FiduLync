import 'server-only';

import { createHash } from 'node:crypto';
import type { MacroSnapshot } from '@/types/macro';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

type ObservationRow = {
  provider: string;
  series_id: string;
  region_code: string;
  observation_period: string;
  value: number;
  unit: string;
  observation_at: string;
  released_at: null;
  retrieved_at: string;
  vintage_at: null;
  revision_at: null;
  source_url: string;
  source_hash: string;
};

function toObservationPeriod(value: string | undefined): string | null {
  if (!value) return null;
  const quarter = /^(\d{4})Q([1-4])$/.exec(value);
  if (quarter) return `${quarter[1]}-${String((Number(quarter[2]) - 1) * 3 + 1).padStart(2, '0')}-01`;
  const month = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (month) return `${month[1]}-${month[2]}-01`;
  if (/^\d{4}$/.test(value)) return `${value}-01-01`;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : null;
}

function sourceUrl(provider: string): string {
  const urls: Record<string, string> = {
    FRED: 'https://fred.stlouisfed.org/',
    BLS: 'https://www.bls.gov/data/',
    BEA: 'https://apps.bea.gov/api/',
    ECB: 'https://data.ecb.europa.eu/',
    BIS: 'https://data.bis.org/',
    'Bank of England': 'https://www.bankofengland.co.uk/boeapps/database/',
    'Bank of Canada': 'https://www.bankofcanada.ca/valet/',
    'World Bank': 'https://data.worldbank.org/',
    CFTC: 'https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm',
  };
  return urls[provider] ?? 'https://www.cftc.gov/';
}

function makeRow(
  provider: string,
  seriesId: string,
  regionCode: string,
  observationDate: string | undefined,
  value: number | undefined,
  unit: string,
  retrievedAt: string,
): ObservationRow | null {
  const period = toObservationPeriod(observationDate);
  if (!period || typeof value !== 'number' || !Number.isFinite(value)) return null;
  const observationAt = `${period}T00:00:00.000Z`;
  const sourceHash = createHash('sha256')
    .update([provider, seriesId, regionCode, period, String(value)].join('|'))
    .digest('hex');
  return {
    provider,
    series_id: seriesId,
    region_code: regionCode,
    observation_period: period,
    value,
    unit,
    observation_at: observationAt,
    // Provider release timestamps are not supplied by every adapter. Keep them NULL
    // rather than misrepresenting retrieval time as the official release time.
    released_at: null,
    retrieved_at: retrievedAt,
    vintage_at: null,
    revision_at: null,
    source_url: sourceUrl(provider),
    source_hash: sourceHash,
  };
}

export async function persistMacroObservations(snapshot: MacroSnapshot): Promise<number> {
  if (!(process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())) return 0;

  const retrievedAt = new Date().toISOString();
  const rows: ObservationRow[] = [];
  const add = (
    provider: string | undefined,
    series: string,
    code: string,
    date: string | undefined,
    value: number | undefined,
    unit = 'percent',
  ) => {
    if (!provider) return;
    const row = makeRow(provider, series, code, date, value, unit, retrievedAt);
    if (row) rows.push(row);
  };

  for (const currency of snapshot.currencies) {
    add(currency.policyRateSource === 'provider' ? currency.policyRateProvider : undefined,
      'POLICY_RATE', currency.code, currency.policyRateObservationDate, currency.policyRate);
    add(currency.inflationSource === 'provider' ? currency.inflationProvider : undefined,
      'INFLATION_YOY', currency.code, currency.inflationObservationDate, currency.inflation);
    add(currency.gdpSource === 'provider' ? currency.gdpProvider ?? 'BEA' : undefined,
      'REAL_GDP_GROWTH_YOY', currency.code, currency.gdpObservationDate, currency.gdpGrowthYoY);
    add(currency.unemploymentSource === 'provider' ? currency.unemploymentProvider ?? 'BLS' : undefined,
      'UNEMPLOYMENT_RATE', currency.code, currency.unemploymentObservationDate, currency.unemploymentRate);
    add(currency.wageGrowthSource === 'provider' ? currency.wageGrowthProvider ?? 'BLS' : undefined,
      'WAGE_GROWTH_YOY', currency.code, currency.wageGrowthObservationDate, currency.wageGrowthYoY);
    const yieldProvider = currency.code === 'EUR' ? 'ECB' : currency.code === 'USD' ? 'FRED' : undefined;
    add(currency.twoYearYieldSource === 'provider' ? yieldProvider : undefined,
      'SOVEREIGN_2Y_YIELD', currency.code, currency.twoYearYieldObservationDate, currency.twoYearYield);
  }

  const cotProvider = process.env.COT_DATA_PROVIDER_LICENSE_APPROVED === 'true'
    && process.env.COT_DATA_PROVIDER_URL?.trim() ? 'Custom COT provider' : 'CFTC';
  for (const position of snapshot.cot) {
    add(cotProvider, 'COT_NONCOMMERCIAL_NET', position.market, position.reportDate,
      position.netContracts, 'contracts');
  }

  if (!rows.length) return 0;
  try {
    const { error } = await getSupabaseAdmin().from('macro_observations')
      .upsert(rows, { onConflict: 'source_hash' });
    if (error) throw error;
    return rows.length;
  } catch (error) {
    console.error('Normalized macro observation persistence failed:', error);
    return 0;
  }
}
