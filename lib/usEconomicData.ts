import 'server-only';

export type UsEconomicIndicators = {
  realGdpGrowthAnnualizedPct?: number;
  headlineCpiYoYPct?: number;
  coreCpiYoYPct?: number;
  unemploymentRatePct?: number;
  nonfarmPayrollChangeThousands?: number;
  gdpPeriod?: string;
  headlineCpiPeriod?: string;
  coreCpiPeriod?: string;
  laborPeriod?: string;
  fetchedAt: string;
  beaAvailable: boolean;
  blsAvailable: boolean;
};

type BlsPoint = { year: string; period: string; value: number };
type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numeric(value: unknown): number | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const parsed = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

function latestMonthly(data: unknown): BlsPoint[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((item): BlsPoint[] => {
    if (!isRecord(item) || typeof item.year !== 'string' || typeof item.period !== 'string'
      || !/^M(?:0[1-9]|1[0-2])$/.test(item.period)) return [];
    const value = numeric(item.value);
    return value === undefined ? [] : [{ year: item.year, period: item.period, value }];
  }).sort((a, b) => (b.year + b.period).localeCompare(a.year + a.period));
}

function yearOverYear(points: BlsPoint[]): number | undefined {
  const latest = points[0];
  if (!latest) return undefined;
  const prior = points.find((point) => point.year === String(Number(latest.year) - 1)
    && point.period === latest.period);
  return prior && prior.value !== 0
    ? Number(((latest.value / prior.value - 1) * 100).toFixed(3))
    : undefined;
}

async function getBlsIndicators(apiKey: string): Promise<Pick<UsEconomicIndicators,
  'headlineCpiYoYPct' | 'coreCpiYoYPct' | 'unemploymentRatePct' | 'nonfarmPayrollChangeThousands'
  | 'headlineCpiPeriod' | 'coreCpiPeriod' | 'laborPeriod'>> {
  const currentYear = new Date().getUTCFullYear();
  const response = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      seriesid: ['CUSR0000SA0', 'CUSR0000SA0L1E', 'LNS14000000', 'CES0000000001'],
      startyear: String(currentYear - 2),
      endyear: String(currentYear),
      registrationkey: apiKey,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`BLS returned HTTP ${response.status}.`);
  const payload: unknown = await response.json();
  if (!isRecord(payload) || payload.status !== 'REQUEST_SUCCEEDED'
    || !isRecord(payload.Results) || !Array.isArray(payload.Results.series)) {
    const message = isRecord(payload) && Array.isArray(payload.message) ? payload.message.join('; ') : 'invalid response';
    throw new Error(`BLS request failed: ${message}.`);
  }
  const series = payload.Results.series;
  const find = (id: string) => {
    const row = series.find((item) => isRecord(item) && item.seriesID === id);
    return isRecord(row) ? latestMonthly(row.data) : [];
  };
  const headline = find('CUSR0000SA0');
  const core = find('CUSR0000SA0L1E');
  const unemployment = find('LNS14000000');
  const payroll = find('CES0000000001');
  const latestPayroll = payroll[0];
  const previousPayroll = latestPayroll ? payroll.find((point) => {
    const latestMonth = Number(latestPayroll.period.slice(1));
    return (point.year === latestPayroll.year && Number(point.period.slice(1)) === latestMonth - 1)
      || (latestMonth === 1 && Number(point.year) === Number(latestPayroll.year) - 1 && point.period === 'M12');
  }) : undefined;
  return {
    headlineCpiYoYPct: yearOverYear(headline),
    coreCpiYoYPct: yearOverYear(core),
    unemploymentRatePct: unemployment[0]?.value,
    nonfarmPayrollChangeThousands: latestPayroll && previousPayroll
      ? Number((latestPayroll.value - previousPayroll.value).toFixed(1))
      : undefined,
    headlineCpiPeriod: headline[0] ? `${headline[0].year}-${headline[0].period}` : undefined,
    coreCpiPeriod: core[0] ? `${core[0].year}-${core[0].period}` : undefined,
    laborPeriod: unemployment[0] ? `${unemployment[0].year}-${unemployment[0].period}` : undefined,
  };
}

async function getBeaGdpGrowth(apiKey: string): Promise<Pick<UsEconomicIndicators,
  'realGdpGrowthAnnualizedPct' | 'gdpPeriod'>> {
  const url = new URL('https://apps.bea.gov/api/data/');
  url.searchParams.set('UserID', apiKey);
  url.searchParams.set('method', 'GetData');
  url.searchParams.set('DataSetName', 'NIPA');
  url.searchParams.set('TableName', 'T10101');
  url.searchParams.set('Frequency', 'Q');
  const year = new Date().getUTCFullYear();
  url.searchParams.set('Year', Array.from({ length: 3 }, (_, index) => String(year - 2 + index)).join(','));
  url.searchParams.set('ResultFormat', 'JSON');
  const response = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`BEA returned HTTP ${response.status}.`);
  const payload: unknown = await response.json();
  if (!isRecord(payload) || !isRecord(payload.BEAAPI)
    || !isRecord(payload.BEAAPI.Results) || !Array.isArray(payload.BEAAPI.Results.Data)) {
    const error = isRecord(payload) && isRecord(payload.BEAAPI) && isRecord(payload.BEAAPI.Error)
      ? String(payload.BEAAPI.Error.ErrMsg ?? 'invalid response')
      : 'invalid response';
    throw new Error(`BEA GDP request failed: ${error}.`);
  }
  const rows = payload.BEAAPI.Results.Data.filter((item) => isRecord(item)
    && String(item.LineNumber) === '1'
    && typeof item.TimePeriod === 'string'
    && /^\\d{4}Q[1-4]$/.test(item.TimePeriod));
  rows.sort((a, b) => String((b as JsonRecord).TimePeriod).localeCompare(String((a as JsonRecord).TimePeriod)));
  const latest = rows[0];
  if (!isRecord(latest)) throw new Error('BEA returned no quarterly real GDP observations for NIPA table T10101.');
  const value = numeric(latest.DataValue);
  if (value === undefined) throw new Error('BEA returned a non-numeric real GDP growth value.');
  return { realGdpGrowthAnnualizedPct: value, gdpPeriod: String(latest.TimePeriod) };
}

export async function getUsEconomicIndicators(
  beaApiKey = process.env.BEA_API_KEY?.trim(),
  blsApiKey = process.env.BLS_API_KEY?.trim(),
): Promise<UsEconomicIndicators | null> {
  if (!beaApiKey && !blsApiKey) return null;
  const [beaResult, blsResult] = await Promise.allSettled([
    beaApiKey ? getBeaGdpGrowth(beaApiKey) : Promise.resolve(null),
    blsApiKey ? getBlsIndicators(blsApiKey) : Promise.resolve(null),
  ]);
  if (beaResult.status === 'rejected') console.warn('BEA GDP observations unavailable:', beaResult.reason);
  if (blsResult.status === 'rejected') console.warn('BLS labor and price observations unavailable:', blsResult.reason);
  const bea = beaResult.status === 'fulfilled' ? beaResult.value : null;
  const bls = blsResult.status === 'fulfilled' ? blsResult.value : null;
  const indicators: UsEconomicIndicators = {
    fetchedAt: new Date().toISOString(),
    beaAvailable: Boolean(bea && bea.realGdpGrowthAnnualizedPct !== undefined),
    blsAvailable: Boolean(bls && Object.values(bls).some((value) => typeof value === 'number')),
    ...(bea ?? {}),
    ...(bls ?? {}),
  };
  return indicators.beaAvailable || indicators.blsAvailable ? indicators : null;
}
