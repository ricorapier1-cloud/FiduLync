/**
 * Official US macro adapters.
 *
 * BLS and BEA are authoritative statistical sources. These observations are
 * research context only until the corresponding release timestamps/vintages
 * are joined to an official release calendar. Never use observation periods
 * as a substitute for publication timestamps in point-in-time backtests.
 */
export type OfficialUsMacroSnapshot = {
  cpiYearOverYearPct?: number;
  cpiPeriod?: string;
  coreCpiYearOverYearPct?: number;
  coreCpiPeriod?: string;
  unemploymentRatePct?: number;
  unemploymentPeriod?: string;
  nonfarmPayrollMonthlyChangeThousands?: number;
  payrollPeriod?: string;
  realGdpAnnualizedQuarterlyPct?: number;
  realGdpPeriod?: string;
  retrievedAt: string;
  sources: string[];
};

type BLSObservation = { year: number; period: string; value: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseBlsObservations(payload: unknown, seriesId: string): BLSObservation[] {
  if (!isRecord(payload) || payload.status !== 'REQUEST_SUCCEEDED' || !Array.isArray(payload.Results && isRecord(payload.Results) ? payload.Results.series : null)) {
    throw new Error(`BLS returned an invalid response for ${seriesId}.`);
  }
  const series = (payload.Results as Record<string, unknown>).series as unknown[];
  const match = series.find((item) => isRecord(item) && item.seriesID === seriesId);
  if (!isRecord(match) || !Array.isArray(match.data)) throw new Error(`BLS series ${seriesId} is missing.`);
  const rows = match.data.flatMap((item): BLSObservation[] => {
    if (!isRecord(item) || typeof item.year !== 'string' || typeof item.period !== 'string'
      || !/^M(0[1-9]|1[0-2])$/.test(item.period) || typeof item.value !== 'string') return [];
    const year = Number(item.year);
    const value = Number(item.value.replace(/,/g, ''));
    return Number.isInteger(year) && Number.isFinite(value) ? [{ year, period: item.period, value }] : [];
  });
  return rows.sort((a, b) => b.year - a.year || b.period.localeCompare(a.period));
}

function yearOverYear(rows: BLSObservation[]): { value?: number; period?: string } {
  const latest = rows[0];
  if (!latest) return {};
  const prior = rows.find((row) => row.year === latest.year - 1 && row.period === latest.period);
  if (!prior || prior.value === 0) return { period: `${latest.year}-${latest.period}` };
  return { value: (latest.value / prior.value - 1) * 100, period: `${latest.year}-${latest.period}` };
}

export function parseBlsMacroResponse(payload: unknown): Omit<OfficialUsMacroSnapshot, 'retrievedAt' | 'sources' | 'realGdpAnnualizedQuarterlyPct' | 'realGdpPeriod'> {
  if (!isRecord(payload) || !isRecord(payload.Results) || !Array.isArray(payload.Results.series)) {
    throw new Error('BLS response has no series data.');
  }
  const find = (id: string) => parseBlsObservations(payload, id);
  const headline = yearOverYear(find('CUUR0000SA0'));
  const core = yearOverYear(find('CUUR0000SA0L1E'));
  const unemployment = find('LNS14000000')[0];
  const payroll = find('CES0000000001');
  const latestPayroll = payroll[0];
  const previousPayroll = latestPayroll && payroll.find((row) =>
    row.year === (latestPayroll.period === 'M01' ? latestPayroll.year - 1 : latestPayroll.year)
    && row.period === (latestPayroll.period === 'M01' ? 'M12' : `M${String(Number(latestPayroll.period.slice(1)) - 1).padStart(2, '0')}`));
  return {
    cpiYearOverYearPct: headline.value,
    cpiPeriod: headline.period,
    coreCpiYearOverYearPct: core.value,
    coreCpiPeriod: core.period,
    unemploymentRatePct: unemployment?.value,
    unemploymentPeriod: unemployment ? `${unemployment.year}-${unemployment.period}` : undefined,
    nonfarmPayrollMonthlyChangeThousands: latestPayroll && previousPayroll ? latestPayroll.value - previousPayroll.value : undefined,
    payrollPeriod: latestPayroll ? `${latestPayroll.year}-${latestPayroll.period}` : undefined,
  };
}

export function parseBeaRealGdpResponse(payload: unknown): { realGdpAnnualizedQuarterlyPct?: number; realGdpPeriod?: string } {
  if (!isRecord(payload) || !isRecord(payload.BEAAPI) || !isRecord(payload.BEAAPI.Results)) {
    throw new Error('BEA returned an invalid API response.');
  }
  const results = payload.BEAAPI.Results;
  if (Array.isArray(results.Error)) throw new Error('BEA reported an API error.');
  if (!Array.isArray(results.Data)) throw new Error('BEA returned no NIPA data rows.');
  const rows = results.Data.filter((item): item is Record<string, unknown> => {
    if (!isRecord(item) || String(item.LineNumber ?? '') !== '1'
      || typeof item.TimePeriod !== 'string' || !/^\d{4}Q[1-4]$/.test(item.TimePeriod)
      || typeof item.DataValue !== 'string') return false;
    return Number.isFinite(Number(item.DataValue.replace(/,/g, '').replace(/%/g, '').trim()));
  });
  rows.sort((a, b) => String(b.TimePeriod).localeCompare(String(a.TimePeriod)));
  const latest = rows[0];
  if (!latest || typeof latest.DataValue !== 'string') throw new Error('BEA real GDP series is unavailable.');
  const normalized = latest.DataValue.replace(/,/g, '').replace(/%/g, '').trim();
  const value = Number(normalized);
  if (!Number.isFinite(value)) throw new Error('BEA real GDP value is not numeric.');
  return { realGdpAnnualizedQuarterlyPct: value, realGdpPeriod: latest.TimePeriod as string };
}

export async function fetchOfficialUsMacro(): Promise<OfficialUsMacroSnapshot | null> {
  const retrievedAt = new Date().toISOString();
  const result: OfficialUsMacroSnapshot = { retrievedAt, sources: [] };
  const blsKey = process.env.BLS_API_KEY?.trim();
  const beaKey = process.env.BEA_API_KEY?.trim();
  const jobs: Array<Promise<void>> = [];

  jobs.push((async () => {
    const currentYear = new Date().getUTCFullYear();
    const body: Record<string, unknown> = {
      seriesid: ['CUUR0000SA0', 'CUSR0000SA0L1E', 'LNS14000000', 'CES0000000001'],
      startyear: String(currentYear - 2),
      endyear: String(currentYear),
    };
    if (blsKey) body.registrationkey = blsKey;
    const response = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`BLS API returned HTTP ${response.status}.`);
    const parsed = parseBlsMacroResponse(await response.json() as unknown);
    Object.assign(result, parsed);
    result.sources.push('Bureau of Labor Statistics (BLS)');
  })());

  if (beaKey) jobs.push((async () => {
    const url = new URL('https://apps.bea.gov/api/data/');
    url.searchParams.set('UserID', beaKey);
    url.searchParams.set('method', 'GetData');
    url.searchParams.set('datasetname', 'NIPA');
    url.searchParams.set('TableName', 'T10101');
    url.searchParams.set('LineNumber', '1');
    url.searchParams.set('Frequency', 'Q');
    url.searchParams.set('Year', 'LAST5');
    url.searchParams.set('ResultFormat', 'JSON');
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`BEA API returned HTTP ${response.status}.`);
    const parsed = parseBeaRealGdpResponse(await response.json() as unknown);
    Object.assign(result, parsed);
    result.sources.push('Bureau of Economic Analysis (BEA)');
  })());

  const settled = await Promise.allSettled(jobs);
  for (const item of settled) if (item.status === 'rejected') {
    console.warn('Official US macro adapter unavailable:', item.reason);
  }
  const hasValues = [
    result.cpiYearOverYearPct, result.coreCpiYearOverYearPct,
    result.unemploymentRatePct, result.nonfarmPayrollMonthlyChangeThousands,
    result.realGdpAnnualizedQuarterlyPct,
  ].some((value) => typeof value === 'number' && Number.isFinite(value));
  return hasValues ? result : null;
}
