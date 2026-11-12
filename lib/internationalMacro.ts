import 'server-only';

import { getCachedData } from '@/lib/redisCache';

type Observation = { date: string; value: number };
export type WorldBankInflation = { currency: string; inflation: number; year: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function latestYearOverYear(observations: Observation[]) {
  const latest = observations[0];
  if (!latest) return undefined;
  const yearAgo = observations.find((item) =>
    item.date.slice(0, 7) === `${Number(latest.date.slice(0, 4)) - 1}${latest.date.slice(4, 7)}`);
  return yearAgo && yearAgo.value !== 0 ? (latest.value / yearAgo.value - 1) * 100 : undefined;
}

function parseCsvRow(row: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < row.length; index += 1) {
    const character = row[index];
    if (character === '"' && quoted && row[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      cells.push(cell);
      cell = '';
    } else {
      cell += character;
    }
  }
  cells.push(cell);
  return cells;
}

async function getEcbSeries(series: string): Promise<number | undefined> {
  const url = new URL(`https://data-api.ecb.europa.eu/service/data/${series.replace('.', '/')}`);
  url.searchParams.set('lastNObservations', '1');
  url.searchParams.set('format', 'csvdata');
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`ECB returned ${response.status} for ${series}.`);
  const rows = (await response.text()).trim().split(/\r?\n/);
  const valueColumn = parseCsvRow(rows[0] ?? '').indexOf('OBS_VALUE');
  const value = Number(parseCsvRow(rows.at(-1) ?? '')[valueColumn]);
  if (valueColumn < 0 || !Number.isFinite(value)) {
    throw new Error(`ECB returned no usable observation for ${series}.`);
  }
  return value;
}

export async function getEcbMacroInputs() {
  const [policyResult, inflationResult, yieldResult] = await Promise.allSettled([
    getEcbSeries('FM.D.U2.EUR.4F.KR.MRR_FR.LEV'),
    getEcbSeries('ICP.M.U2.N.000000.4.ANR'),
    getEcbSeries('YC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_2Y'),
  ]);
  if (policyResult.status === 'rejected') console.warn('ECB policy rate is unavailable:', policyResult.reason);
  if (inflationResult.status === 'rejected') console.warn('ECB HICP is unavailable:', inflationResult.reason);
  if (yieldResult.status === 'rejected') console.warn('ECB 2-year benchmark yield is unavailable:', yieldResult.reason);
  return {
    policyRate: policyResult.status === 'fulfilled' ? policyResult.value : undefined,
    inflation: inflationResult.status === 'fulfilled' ? inflationResult.value : undefined,
    twoYearYield: yieldResult.status === 'fulfilled' ? yieldResult.value : undefined,
  };
}

function formatBankOfEnglandDate(date: Date) {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = date.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
  return `${day}/${month}/${date.getUTCFullYear()}`;
}

export async function getBankOfEnglandPolicyRate() {
  const url = new URL('https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp');
  url.searchParams.set('csv.x', 'show');
  url.searchParams.set('Datefrom', formatBankOfEnglandDate(new Date(Date.now() - 14 * 24 * 60 * 60 * 1_000)));
  url.searchParams.set('Dateto', formatBankOfEnglandDate(new Date()));
  url.searchParams.set('SeriesCodes', 'IUDBEDR');
  url.searchParams.set('CSVF', 'TN');
  url.searchParams.set('UsingCodes', 'Y');
  url.searchParams.set('VPD', 'Y');
  url.searchParams.set('VFD', 'N');
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Bank of England returned ${response.status} for official Bank Rate.`);
  const rows = (await response.text()).trim().split(/\r?\n/);
  const valueColumn = parseCsvRow(rows[0] ?? '').indexOf('IUDBEDR');
  for (const row of rows.slice(1).reverse()) {
    const value = Number(parseCsvRow(row)[valueColumn]);
    if (valueColumn >= 0 && Number.isFinite(value)) return value;
  }
  throw new Error('Bank of England returned no usable official Bank Rate observation.');
}

async function getBankOfCanadaObservations(series: string): Promise<Observation[]> {
  const url = new URL(`https://www.bankofcanada.ca/valet/observations/${series}/json`);
  url.searchParams.set('recent', '24');
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Bank of Canada Valet returned ${response.status} for ${series}.`);
  const payload: unknown = await response.json();
  if (!isRecord(payload) || !Array.isArray(payload.observations)) {
    throw new Error(`Bank of Canada Valet returned invalid ${series} observations.`);
  }
  return payload.observations.flatMap((item): Observation[] => {
    if (!isRecord(item) || typeof item.d !== 'string' || !isRecord(item[series])) return [];
    const value = Number(item[series].v);
    return Number.isFinite(value) ? [{ date: item.d, value }] : [];
  }).sort((left, right) => right.date.localeCompare(left.date));
}

export async function getBankOfCanadaMacroInputs() {
  const [policyResult, cpiResult] = await Promise.allSettled([
    getBankOfCanadaObservations('V39079'),
    getBankOfCanadaObservations('V41690973'),
  ]);
  if (policyResult.status === 'rejected') {
    console.warn('Bank of Canada policy rate is unavailable:', policyResult.reason);
  }
  if (cpiResult.status === 'rejected') {
    console.warn('Bank of Canada CPI is unavailable:', cpiResult.reason);
  }
  const policy = policyResult.status === 'fulfilled' ? policyResult.value : [];
  const cpi = cpiResult.status === 'fulfilled' ? cpiResult.value : [];
  return {
    policyRate: policy[0]?.value,
    inflation: latestYearOverYear(cpi),
  };
}

async function getWorldBankInflation(countryCode: string, currency: string): Promise<WorldBankInflation> {
  return getCachedData(`macro:worldbank-inflation:${countryCode}`, async () => {
    const url = new URL(`https://api.worldbank.org/v2/country/${countryCode}/indicator/FP.CPI.TOTL.ZG`);
    url.searchParams.set('format', 'json');
    url.searchParams.set('per_page', '10');
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`World Bank returned ${response.status} for ${countryCode} CPI.`);
    const payload: unknown = await response.json();
    if (!Array.isArray(payload) || !Array.isArray(payload[1])) {
      throw new Error(`World Bank returned invalid ${countryCode} CPI data.`);
    }
    const observation = payload[1].find((item) =>
      isRecord(item) && typeof item.date === 'string' && typeof item.value === 'number' && Number.isFinite(item.value));
    if (!isRecord(observation) || typeof observation.date !== 'string'
      || typeof observation.value !== 'number' || !Number.isFinite(observation.value)) {
      throw new Error(`World Bank returned no usable ${countryCode} CPI observation.`);
    }
    return { currency, inflation: observation.value, year: observation.date };
  }, 86_400);
}

export async function getWorldBankG10Inflation(): Promise<WorldBankInflation[]> {
  const countries: Array<[string, string]> = [
    ['GBR', 'GBP'], ['JPN', 'JPY'], ['CHE', 'CHF'], ['AUS', 'AUD'],
    ['NZL', 'NZD'], ['SWE', 'SEK'], ['NOR', 'NOK'],
  ];
  const results = await Promise.allSettled(countries.map(([country, currency]) =>
    getWorldBankInflation(country, currency)));
  return results.flatMap((result, index) => {
    if (result.status === 'fulfilled') return [result.value];
    console.warn(`World Bank annual CPI is unavailable for ${countries[index][1]}:`, result.reason);
    return [];
  });
}
