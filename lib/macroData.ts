import 'server-only';
import type { CotPosition, EconomicCatalyst, MacroCurrency, MacroSnapshot, TreasuryYieldData } from '@/types/macro';
import { getSupabaseAdmin } from '@/lib/serverSupabase';
import {
  getBankOfCanadaMacroInputs,
  getBankOfEnglandPolicyRate,
  getEcbMacroInputs,
  getWorldBankG10Inflation,
  getRiksbankPolicyRate,
  getNorgesBankPolicyRate,
} from '@/lib/internationalMacro';
import { getCachedData } from '@/lib/redisCache';
import { persistMacroObservations } from '@/lib/macro/observationPersistence';
import { getTreasuryYieldData } from '@/lib/treasuryData';

export const EMPTY_SNAPSHOT: MacroSnapshot = {
  asOf: '',
  source: 'fallback',
  cotSource: 'unavailable',
  calendarSource: 'unavailable',
  currencies: [],
  cot: [],
  catalysts: [],
};

export function getFallbackSnapshot(): MacroSnapshot {
  return {
    asOf: new Date().toISOString(),
    source: 'fallback',
    cotSource: 'unavailable',
    calendarSource: 'unavailable',
    currencies: [
      { code: 'USD', centralBank: 'Federal Reserve', policyRate: 0, inflation: 0, twoYearYield: 0, twoYearYieldSource: 'reference', inflationLabel: 'Core PCE', policyRateSource: 'reference', inflationSource: 'reference', stance: 'Awaiting Provider Feed' },
      { code: 'EUR', centralBank: 'European Central Bank', policyRate: 0, inflation: 0, inflationLabel: 'HICP', policyRateSource: 'reference', inflationSource: 'reference', stance: 'Awaiting Provider Feed' },
      { code: 'GBP', centralBank: 'Bank of England', policyRate: 0, inflation: 0, inflationLabel: 'CPI', policyRateSource: 'reference', inflationSource: 'reference', stance: 'Awaiting Provider Feed' },
      { code: 'JPY', centralBank: 'Bank of Japan', policyRate: 0, inflation: 0, inflationLabel: 'CPI', policyRateSource: 'reference', inflationSource: 'reference', stance: 'Awaiting Provider Feed' },
      { code: 'AUD', centralBank: 'Reserve Bank of Australia', policyRate: 0, inflation: 0, inflationLabel: 'CPI', policyRateSource: 'reference', inflationSource: 'reference', stance: 'Awaiting Provider Feed' },
      { code: 'CHF', centralBank: 'Swiss National Bank', policyRate: 0, inflation: 0, inflationLabel: 'CPI', policyRateSource: 'reference', inflationSource: 'reference', stance: 'Awaiting Provider Feed' },
      { code: 'CAD', centralBank: 'Bank of Canada', policyRate: 0, inflation: 0, inflationLabel: 'CPI', policyRateSource: 'reference', inflationSource: 'reference', stance: 'Awaiting Provider Feed' },
      { code: 'NZD', centralBank: 'Reserve Bank of New Zealand', policyRate: 0, inflation: 0, inflationLabel: 'CPI', policyRateSource: 'reference', inflationSource: 'reference', stance: 'Awaiting Provider Feed' },
      { code: 'SEK', centralBank: 'Sveriges Riksbank', policyRate: 0, inflation: 0, inflationLabel: 'CPIF', policyRateSource: 'reference', inflationSource: 'reference', stance: 'Awaiting Provider Feed' },
      { code: 'NOK', centralBank: 'Norges Bank', policyRate: 0, inflation: 0, inflationLabel: 'CPI-ATE', policyRateSource: 'reference', inflationSource: 'reference', stance: 'Awaiting Provider Feed' },
      { code: 'XAU', centralBank: 'Global Reserve Asset', policyRate: 0, inflation: 0, twoYearYield: 0, twoYearYieldSource: 'reference', inflationLabel: 'Real Yield Proxy', policyRateSource: 'reference', inflationSource: 'reference', stance: 'Sovereign Hedge' },
    ],
    cot: [],
    // No fabricated or stale economic events in reference/offline mode.
    catalysts: [],
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

function filterCurrentCatalysts(catalysts: EconomicCatalyst[]): EconomicCatalyst[] {
  const now = Date.now();
  const earliest = now - 60 * 60 * 1000;
  const latest = now + 45 * 24 * 60 * 60 * 1000;
  return catalysts.filter((event) => {
    const scheduledAt = Date.parse(event.scheduledAt);
    return Number.isFinite(scheduledAt) && scheduledAt >= earliest && scheduledAt <= latest;
  });
}

function isFreshProviderObservation(date: string | undefined, maxAgeDays: number): boolean {
  if (!date) return false;
  const timestamp = Date.parse(date);
  const age = Date.now() - timestamp;
  return Number.isFinite(timestamp) && age >= -5 * 60_000 && age <= maxAgeDays * 86_400_000;
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
    && (value.policyRateObservationDate === undefined || typeof value.policyRateObservationDate === 'string')
    && (value.policyRateProvider === undefined || typeof value.policyRateProvider === 'string')
    && (value.inflationObservationDate === undefined || typeof value.inflationObservationDate === 'string')
    && (value.inflationProvider === undefined || typeof value.inflationProvider === 'string')
    && (value.twoYearYieldObservationDate === undefined || typeof value.twoYearYieldObservationDate === 'string')
    && (value.gdpObservationDate === undefined || typeof value.gdpObservationDate === 'string')
    && (value.unemploymentObservationDate === undefined || typeof value.unemploymentObservationDate === 'string')
    && (value.wageGrowthObservationDate === undefined || typeof value.wageGrowthObservationDate === 'string')
    && (value.gdpProvider === undefined || typeof value.gdpProvider === 'string')
    && (value.unemploymentProvider === undefined || typeof value.unemploymentProvider === 'string')
    && (value.wageGrowthProvider === undefined || typeof value.wageGrowthProvider === 'string')
    && (value.gdpSource === undefined || value.gdpSource === 'provider' || value.gdpSource === 'reference')
    && (value.unemploymentSource === undefined || value.unemploymentSource === 'provider' || value.unemploymentSource === 'reference')
    && (value.wageGrowthSource === undefined || value.wageGrowthSource === 'provider' || value.wageGrowthSource === 'reference')
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

function parseProviderSnapshot(value: unknown): Pick<MacroSnapshot, 'currencies' | 'cot' | 'catalysts' | 'energyMarkets' | 'usTreasury'> | null {
  if (!isRecord(value)
    || !Array.isArray(value.currencies)
    || !Array.isArray(value.cot)
    || !Array.isArray(value.catalysts)) return null;

  if (!value.currencies.every(isCurrency) || !value.cot.every(isCotPosition) || !value.catalysts.every(isCatalyst)) return null;
  return {
    currencies: value.currencies,
    cot: value.cot,
    catalysts: value.catalysts,
    ...(isRecord(value.energyMarkets) && isRecord(value.energyMarkets.wti) && isRecord(value.energyMarkets.brent)
      && isFiniteNumber(value.energyMarkets.wti.valueUsdPerBarrel) && isFiniteNumber(value.energyMarkets.brent.valueUsdPerBarrel)
      && typeof value.energyMarkets.wti.observationDate === 'string' && typeof value.energyMarkets.brent.observationDate === 'string'
      && value.energyMarkets.wti.source === 'EIA' && value.energyMarkets.brent.source === 'EIA'
      && isFiniteNumber(value.energyMarkets.brentWtiSpreadUsd)
      ? { energyMarkets: value.energyMarkets as unknown as MacroSnapshot['energyMarkets'] } : {}),
    ...(isRecord(value.usTreasury)
      && value.usTreasury.source === 'US TREASURY'
      && typeof value.usTreasury.observationDate === 'string'
      && typeof value.usTreasury.retrievedAtUtc === 'string'
      && ['nominal2YPct', 'nominal3MPct', 'nominal10YPct', 'real10YPct', 'twoYearTenYearSpreadBps', 'twoYearThreeMonthSpreadBps', 'breakevenTenYearPct'].every((key) => isFiniteNumber(value.usTreasury[key]))
      && (value.usTreasury.freshness === 'LATEST PUBLISHED' || value.usTreasury.freshness === 'STALE')
      ? { usTreasury: value.usTreasury as unknown as TreasuryYieldData } : {}),
  };
}

type EiaOilObservation = { period: string; value: number };

async function getEiaOilSeries(seriesId: 'PET.RWTC.D' | 'PET.RBRTE.D', apiKey: string): Promise<EiaOilObservation> {
  const url = new URL('https://api.eia.gov/v2/seriesid/' + seriesId);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('length', '30');
  url.searchParams.set('sort[0][column]', 'period');
  url.searchParams.set('sort[0][direction]', 'desc');
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error('EIA returned ' + response.status + ' for ' + seriesId + '.');
  const payload: unknown = await response.json();
  if (!isRecord(payload) || !isRecord(payload.response) || !Array.isArray(payload.response.data)) throw new Error('EIA returned an invalid ' + seriesId + ' response.');
  const observations = payload.response.data.flatMap((row): EiaOilObservation[] => {
    if (!isRecord(row) || typeof row.period !== 'string') return [];
    const value = typeof row.value === 'number' ? row.value : Number(row.value);
    return /^\d{4}-\d{2}-\d{2}$/.test(row.period) && Number.isFinite(value) && value > 0 ? [{ period: row.period, value }] : [];
  }).sort((a, b) => b.period.localeCompare(a.period));
  const latest = observations[0];
  if (!latest) throw new Error('EIA returned no usable daily observation for ' + seriesId + '.');
  const ageDays = (Date.now() - Date.parse(latest.period)) / 86_400_000;
  if (!Number.isFinite(ageDays) || ageDays < -1 || ageDays > 10) throw new Error('EIA latest observation is stale or invalid for ' + seriesId + ': ' + latest.period);
  return latest;
}

async function getEiaEnergyMarkets(apiKey: string): Promise<NonNullable<MacroSnapshot['energyMarkets']>> {
  const results = await Promise.all([getEiaOilSeries('PET.RWTC.D', apiKey), getEiaOilSeries('PET.RBRTE.D', apiKey)]);
  const wti = results[0]; const brent = results[1]; const retrievedAtUtc = new Date().toISOString();
  return {
    wti: { valueUsdPerBarrel: wti.value, observationDate: wti.period, retrievedAtUtc, source: 'EIA', freshness: 'LATEST PUBLISHED' },
    brent: { valueUsdPerBarrel: brent.value, observationDate: brent.period, retrievedAtUtc, source: 'EIA', freshness: 'LATEST PUBLISHED' },
    brentWtiSpreadUsd: Number((brent.value - wti.value).toFixed(2)),
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
    getFredObservations('DFF', apiKey), getFredObservations('PCEPILFE', apiKey),
    getFredObservations('CPIAUCSL', apiKey), getFredObservations('DGS2', apiKey),
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
    policyRateObservationDate: rateResult.status === 'fulfilled' ? rateResult.value[0]?.date : undefined,
    corePce: pceResult.status === 'fulfilled' ? latestYearOverYear(pceResult.value) : undefined,
    corePceObservationDate: pceResult.status === 'fulfilled' ? pceResult.value[0]?.date : undefined,
    cpi: cpiResult.status === 'fulfilled' ? latestYearOverYear(cpiResult.value) : undefined,
    cpiObservationDate: cpiResult.status === 'fulfilled' ? cpiResult.value[0]?.date : undefined,
    twoYearYield: twoYearResult.status === 'fulfilled' ? twoYearResult.value[0]?.value : undefined,
    twoYearYieldObservationDate: twoYearResult.status === 'fulfilled' ? twoYearResult.value[0]?.date : undefined,
  };
}

function blsPeriodDate(year: string, period: string): string | undefined {
  if (!/^M(0[1-9]|1[0-2])$/.test(period)) return undefined;
  return `${year}-${period.slice(1)}`;
}

async function getBlsUsdUpdates(apiKey: string) {
  const currentYear = new Date().getUTCFullYear();
  const response = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      seriesid: ['CUSR0000SA0', 'CUUR0000SA0', 'LNS14000000', 'CES0500000003'],
      startyear: String(currentYear - 2),
      endyear: String(currentYear),
      registrationkey: apiKey,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`BLS returned ${response.status}.`);
  const payload: unknown = await response.json();
  if (!isRecord(payload) || payload.status !== 'REQUEST_SUCCEEDED' || !isRecord(payload.Results) || !Array.isArray(payload.Results.series)) {
    throw new Error('BLS returned an unsuccessful or invalid response.');
  }

  const seriesMap = new Map<string, Observation[]>();
  for (const rawSeries of payload.Results.series) {
    if (!isRecord(rawSeries) || typeof rawSeries.seriesID !== 'string' || !Array.isArray(rawSeries.data)) continue;
    const observations = rawSeries.data.flatMap((raw): Observation[] => {
      if (!isRecord(raw) || typeof raw.year !== 'string' || typeof raw.period !== 'string' || typeof raw.value !== 'string') return [];
      const date = blsPeriodDate(raw.year, raw.period);
      const value = Number(raw.value);
      return date && Number.isFinite(value) ? [{ date, value }] : [];
    }).sort((a, b) => b.date.localeCompare(a.date));
    seriesMap.set(rawSeries.seriesID, observations);
  }

  const cpi = (seriesMap.get('CUSR0000SA0')?.length ? seriesMap.get('CUSR0000SA0') : seriesMap.get('CUUR0000SA0')) ?? [];
  const unemployment = seriesMap.get('LNS14000000') ?? [];
  const wages = seriesMap.get('CES0500000003') ?? [];
  const yoy = (items: Observation[]) => {
    const latest = items[0];
    if (!latest) return undefined;
    const prior = items.find((item) => item.date.slice(0, 4) === String(Number(latest.date.slice(0, 4)) - 1)
      && item.date.slice(5, 7) === latest.date.slice(5, 7));
    return prior && prior.value !== 0 ? (latest.value / prior.value - 1) * 100 : undefined;
  };
  return {
    inflation: yoy(cpi),
    inflationObservationDate: cpi[0]?.date,
    unemploymentRate: unemployment[0]?.value,
    unemploymentObservationDate: unemployment[0]?.date,
    wageGrowthYoY: yoy(wages),
    wageGrowthObservationDate: wages[0]?.date,
  };
}

async function getBeaRealGdpYoY(apiKey: string) {
  const currentYear = new Date().getUTCFullYear();
  const url = new URL('https://apps.bea.gov/api/data/');
  url.searchParams.set('UserID', apiKey);
  url.searchParams.set('method', 'GetData');
  url.searchParams.set('datasetname', 'NIPA');
  url.searchParams.set('TableName', 'T10106');
  url.searchParams.set('Frequency', 'Q');
  url.searchParams.set('Year', Array.from({ length: 6 }, (_, index) => String(currentYear - 5 + index)).join(','));
  url.searchParams.set('ResultFormat', 'JSON');
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`BEA returned ${response.status}.`);
  const payload: unknown = await response.json();
  if (!isRecord(payload) || !isRecord(payload.BEAAPI) || !isRecord(payload.BEAAPI.Results)
    || !Array.isArray(payload.BEAAPI.Results.Data)) throw new Error('BEA returned an invalid NIPA response.');
  const rows = payload.BEAAPI.Results.Data.flatMap((raw): Array<{ period: string; value: number }> => {
    if (!isRecord(raw) || String(raw.LineNumber) !== '1' || typeof raw.TimePeriod !== 'string'
      || typeof raw.DataValue !== 'string' || !/^\d{4}Q[1-4]$/.test(raw.TimePeriod)) return [];
    const value = Number(raw.DataValue.replace(/,/g, ''));
    return Number.isFinite(value) ? [{ period: raw.TimePeriod, value }] : [];
  }).sort((a, b) => a.period.localeCompare(b.period));
  const latest = rows.at(-1);
  if (!latest) throw new Error('BEA returned no usable real GDP observations.');
  const yearAgo = rows.find((item) => item.period === `${Number(latest.period.slice(0, 4)) - 1}${latest.period.slice(4)}`);
  return {
    gdpGrowthYoY: yearAgo && yearAgo.value !== 0 ? (latest.value / yearAgo.value - 1) * 100 : undefined,
    gdpObservationDate: latest.period,
  };
}

function parseBisCsvRow(line: string): string[] {
  const cells: string[] = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(value.trim()); value = '';
    } else value += char;
  }
  cells.push(value.trim());
  return cells;
}

async function fetchBisCsv(url: URL): Promise<Array<Record<string, string>>> {
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`BIS Data Portal returned ${response.status}.`);
  const text = (await response.text()).replace(/^\uFEFF/, '').trim();
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) throw new Error('BIS Data Portal returned no observation rows.');
  const headers = parseBisCsvRow(lines[0]);
  return lines.slice(1).flatMap((line) => {
    const cells = parseBisCsvRow(line);
    if (cells.length !== headers.length) return [];
    return [Object.fromEntries(headers.map((header, index) => [header, cells[index]]))];
  });
}

async function getBisG8MacroInputs() {
  const startPolicy = new Date(Date.now() - 120 * 24 * 60 * 60 * 1_000).toISOString().slice(0, 10);
  const startCpi = `${new Date().getUTCFullYear() - 2}-01-01`;
  const policyDailyUrl = new URL('https://stats.bis.org/api/v2/data/dataflow/BIS/WS_CBPOL/1.0/D.');
  policyDailyUrl.searchParams.set('startPeriod', startPolicy);
  policyDailyUrl.searchParams.set('format', 'csvfile');
  const policyMonthlyUrl = new URL('https://stats.bis.org/api/v2/data/dataflow/BIS/WS_CBPOL/1.0/M.');
  policyMonthlyUrl.searchParams.set('startPeriod', startPolicy);
  policyMonthlyUrl.searchParams.set('format', 'csvfile');
  const cpiUrl = new URL('https://stats.bis.org/api/v2/data/dataflow/BIS/WS_LONG_CPI/1.0/M..771');
  cpiUrl.searchParams.set('startPeriod', startCpi);
  cpiUrl.searchParams.set('format', 'csvfile');

  const [dailyResult, monthlyResult, cpiResult] = await Promise.allSettled([
    fetchBisCsv(policyDailyUrl), fetchBisCsv(policyMonthlyUrl), fetchBisCsv(cpiUrl),
  ]);
  const currencyMap: Record<string, string> = {
    US: 'USD', XM: 'EUR', GB: 'GBP', JP: 'JPY',
    CH: 'CHF', CA: 'CAD', AU: 'AUD', NZ: 'NZD', SE: 'SEK', NO: 'NOK',
  };
  const policies = [
    ...(dailyResult.status === 'fulfilled' ? dailyResult.value : []),
    ...(monthlyResult.status === 'fulfilled' ? monthlyResult.value : []),
  ];
  const inflationRows = cpiResult.status === 'fulfilled' ? cpiResult.value : [];
  const latest = new Map<string, { policyRate?: number; policyDate?: string; inflation?: number; inflationDate?: string }>();
  for (const row of policies) {
    const code = currencyMap[row.REF_AREA];
    const date = row.TIME_PERIOD;
    const value = Number(row.OBS_VALUE);
    if (!code || !date || !Number.isFinite(value)) continue;
    const current = latest.get(code) ?? {};
    if (!current.policyDate || date > current.policyDate) {
      latest.set(code, { ...current, policyRate: value, policyDate: date });
    }
  }
  for (const row of inflationRows) {
    const code = currencyMap[row.REF_AREA];
    const date = row.TIME_PERIOD;
    const value = Number(row.OBS_VALUE);
    if (!code || !date || !Number.isFinite(value)) continue;
    const current = latest.get(code) ?? {};
    if (!current.inflationDate || date > current.inflationDate) {
      latest.set(code, { ...current, inflation: value, inflationDate: date });
    }
  }
  const result = [...latest.entries()].map(([code, values]) => ({ code, ...values }));
  if (result.length === 0) {
    const reasons = [dailyResult, monthlyResult, cpiResult].filter((item) => item.status === 'rejected')
      .map((item) => item.status === 'rejected' ? String(item.reason) : '');
    throw new Error(`BIS did not return usable G8 observations. ${reasons.join('; ')}`);
  }
  return result;
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
      if (!isRecord(item)) return [];
      const code = typeof item.country === 'string' ? item.country : typeof item.currency === 'string' ? item.currency : '';
      if (!code || typeof item.title !== 'string' || typeof item.date !== 'string') return [];
      const impact = item.impact === 'High' ? 'High' : item.impact === 'Medium' ? 'Medium' : null;
      const scheduledAt = new Date(item.date);
      if (!impact || !regionMap[code] || !Number.isFinite(scheduledAt.getTime())) return [];
      return [{
        id: `fair-economy-${scheduledAt.toISOString()}-${index}`,
        region: regionMap[code],
        title: item.title,
        scheduledAt: scheduledAt.toISOString(),
        impact,
        consensus: typeof item.forecast === 'string' && item.forecast ? item.forecast : 'TBD',
        actual: typeof item.actual === 'string' && item.actual ? item.actual : null,
        previous: typeof item.previous === 'string' && item.previous ? item.previous : undefined,
      }];
    });
    return events;
  }, 7200);
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
  return { policyRate, policyRateObservationDate: rates[0]?.date, inflation, inflationObservationDate: latestCpi?.date };
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
  // COT is a weekly publication. Cache successful provider responses for six hours
  // to reduce repeated upstream load and smooth over intermittent CFTC latency.
  return getCachedData('macro:cftc-cot-v1', async () => {
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
    signal: AbortSignal.timeout(20_000),
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
    return [{ market, netContracts: latest.netContracts, percentile, weeklyChange: latest.weeklyChange, reportDate: latest.date, freshness: 'LATEST PUBLISHED' }];
  });
  if (!positions.length) throw new Error('CFTC returned no supported currency or gold positions.');
  return positions;
  }, 6 * 60 * 60);
}

async function getLiveProviderSnapshot(cachedSnapshot: MacroSnapshot = getFallbackSnapshot()): Promise<MacroSnapshot | null> {
  const fredApiKey = process.env.FRED_DATA_STORAGE_PERMISSION_APPROVED === 'true' ? process.env.FRED_API_KEY?.trim() : undefined;
  const finnhubApiKey = process.env.FINNHUB_COMMERCIAL_USE_APPROVED === 'true' ? process.env.FINNHUB_API_KEY?.trim() : undefined;
  const alphaVantageKey = process.env.ALPHA_VANTAGE_COMMERCIAL_USE_APPROVED === 'true' ? process.env.ALPHA_VANTAGE_API_KEY?.trim() : undefined;
  const fmpKey = process.env.FMP_COMMERCIAL_USE_APPROVED === 'true' ? process.env.FMP_API_KEY?.trim() : undefined;
  const cotProviderUrl = process.env.COT_DATA_PROVIDER_LICENSE_APPROVED === 'true' ? process.env.COT_DATA_PROVIDER_URL?.trim() : undefined;
  const cotProviderToken = process.env.COT_DATA_PROVIDER_TOKEN?.trim();
  const eiaApiKey = process.env.EIA_API_KEY?.trim();

  const snapshot: MacroSnapshot = {
    ...cachedSnapshot,
    currencies: cachedSnapshot.currencies.map((currency) => ({ ...currency })),
    cot: cachedSnapshot.cot.map((position) => ({ ...position })),
    catalysts: cachedSnapshot.catalysts.map((catalyst) => ({ ...catalyst })),
    asOf: new Date().toISOString(),
    source: cachedSnapshot.source === 'fallback' ? 'fallback' : 'partial',
  };
  const [fredResult, finnhubResult, alphaResult, fmpResult, cotResult, frankfurterResult, calendarResult, ecbResult, bocResult, boeResult, worldBankResult, blsResult, beaResult, bisResult, riksbankResult, norgesBankResult, eiaResult, treasuryResult] = await Promise.allSettled([
    fredApiKey ? getFredUsdUpdates(fredApiKey) : Promise.resolve(null),
    finnhubApiKey ? getFinnhubCatalysts(finnhubApiKey) : Promise.resolve(null),
    alphaVantageKey ? getAlphaVantageUsdUpdates(alphaVantageKey) : Promise.resolve(null),
    fmpKey ? getFmpCatalysts(fmpKey) : Promise.resolve(null),
    cotProviderUrl ? getCotProvider(cotProviderUrl, cotProviderToken) : getCftcCot(),
    getFrankfurterRates(),
    process.env.FAIRECONOMY_COMMERCIAL_USE_APPROVED === 'true' ? getFairEconomyCatalysts() : Promise.resolve([]),
    getEcbMacroInputs(),
    getBankOfCanadaMacroInputs(),
    getBankOfEnglandPolicyRate(),
    getWorldBankG10Inflation(),
    process.env.BLS_API_KEY?.trim() ? getBlsUsdUpdates(process.env.BLS_API_KEY.trim()) : Promise.resolve(null),
    process.env.BEA_API_KEY?.trim() ? getBeaRealGdpYoY(process.env.BEA_API_KEY.trim()) : Promise.resolve(null),
    getBisG8MacroInputs(),
    getRiksbankPolicyRate(),
    getNorgesBankPolicyRate(),
    eiaApiKey ? getEiaEnergyMarkets(eiaApiKey) : Promise.resolve(null),
    getCachedData('macro:us-treasury-yields-v1', getTreasuryYieldData, 60 * 60),
  ]);
  let hasLiveData = false;
  if (eiaResult.status === 'fulfilled' && eiaResult.value) { snapshot.energyMarkets = eiaResult.value; }
  else if (eiaResult.status === 'rejected') console.warn('EIA crude oil spot observations are unavailable:', eiaResult.reason);
  if (treasuryResult.status === 'fulfilled') snapshot.usTreasury = treasuryResult.value;
  else if (treasuryResult.status === 'rejected') console.warn('Official U.S. Treasury yield observations are unavailable:', treasuryResult.reason);
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
        usd.policyRateProvider = 'FRED';
        usd.policyRateObservationDate = typeof fredResult.value.policyRateObservationDate === 'string' ? fredResult.value.policyRateObservationDate : undefined;
        hasLiveData = true;
      }
      if (isFiniteNumber(fredResult.value.corePce)) {
        usd.inflation = fredResult.value.corePce;
        usd.inflationLabel = 'Core PCE';
        usd.corePce = fredResult.value.corePce;
        usd.inflationSource = 'provider';
        usd.inflationObservationDate = typeof fredResult.value.corePceObservationDate === 'string' ? fredResult.value.corePceObservationDate : undefined;
        usd.inflationProvider = 'FRED';
        hasLiveData = true;
      }
      if (isFiniteNumber(fredResult.value.cpi)) {
        usd.cpi = fredResult.value.cpi;
        usd.inflationSource = 'provider';
        usd.inflationObservationDate = typeof fredResult.value.cpiObservationDate === 'string' ? fredResult.value.cpiObservationDate : undefined;
        usd.inflationProvider = 'FRED';
        hasLiveData = true;
      }
      if (isFiniteNumber(fredResult.value.twoYearYield)) {
        usd.twoYearYield = fredResult.value.twoYearYield;
        usd.twoYearYieldSource = 'provider';
        usd.twoYearYieldObservationDate = typeof fredResult.value.twoYearYieldObservationDate === 'string' ? fredResult.value.twoYearYieldObservationDate : undefined;
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
  const providerCalendar = filterCurrentCatalysts(
    calendarResult.status === 'fulfilled' && calendarResult.value.length > 0
      ? calendarResult.value
      : finnhubResult.status === 'fulfilled' && finnhubResult.value?.length
        ? finnhubResult.value
        : fmpResult.status === 'fulfilled' && fmpResult.value?.length
          ? fmpResult.value
          : [],
  );
  if (providerCalendar.length > 0) {
    snapshot.catalysts = providerCalendar;
    snapshot.calendarSource = 'provider';
    hasLiveData = true;
  } else {
    snapshot.catalysts = [];
    snapshot.calendarSource = 'unavailable';
    if (calendarResult.status === 'rejected') {
      console.warn('Economic calendar is unavailable; no provider-backed events will be displayed:', calendarResult.reason);
    }
  }
  if (ecbResult.status === 'fulfilled') {
    const eur = snapshot.currencies.find((currency) => currency.code === 'EUR');
    if (eur) {
      if (isFiniteNumber(ecbResult.value.policyRate)) {
        eur.policyRate = ecbResult.value.policyRate;
        eur.policyRateSource = 'provider';
        eur.policyRateObservationDate = ecbResult.value.policyRateObservationDate;
        eur.policyRateProvider = 'ECB';
        hasLiveData = true;
      }
      if (isFiniteNumber(ecbResult.value.inflation)) {
        eur.inflation = ecbResult.value.inflation;
        eur.inflationLabel = 'HICP';
        eur.inflationSource = 'provider';
        eur.inflationObservationDate = ecbResult.value.inflationObservationDate;
        eur.inflationProvider = 'ECB';
        hasLiveData = true;
      }
      if (isFiniteNumber(ecbResult.value.twoYearYield)) {
        eur.twoYearYield = ecbResult.value.twoYearYield;
        eur.twoYearYieldSource = 'provider';
        eur.twoYearYieldObservationDate = ecbResult.value.twoYearYieldObservationDate;
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
        cad.policyRateObservationDate = bocResult.value.policyRateObservationDate;
        cad.policyRateProvider = 'Bank of Canada';
        hasLiveData = true;
      }
      if (isFiniteNumber(bocResult.value.inflation)) {
        cad.inflation = bocResult.value.inflation;
        cad.inflationLabel = 'CPI';
        cad.inflationSource = 'provider';
        cad.inflationObservationDate = bocResult.value.inflationObservationDate;
        cad.inflationProvider = 'Bank of Canada';
        hasLiveData = true;
      }
    }
  } else {
    console.warn('Bank of Canada Valet policy or inflation series is unavailable:', bocResult.reason);
  }
  if (boeResult.status === 'fulfilled') {
    const gbp = snapshot.currencies.find((currency) => currency.code === 'GBP');
    if (gbp) {
      gbp.policyRate = boeResult.value.value;
      gbp.policyRateSource = 'provider';
      gbp.policyRateObservationDate = boeResult.value.date;
      gbp.policyRateProvider = 'Bank of England';
      hasLiveData = true;
    }
  } else {
    console.warn('Bank of England official Bank Rate is unavailable:', boeResult.reason);
  }
  if (riksbankResult.status === 'fulfilled') {
    const sek = snapshot.currencies.find((currency) => currency.code === 'SEK');
    if (sek && isFiniteNumber(riksbankResult.value.value)) {
      sek.policyRate = riksbankResult.value.value;
      sek.policyRateSource = 'provider';
      sek.policyRateObservationDate = riksbankResult.value.date;
      sek.policyRateProvider = 'Sveriges Riksbank';
      hasLiveData = true;
    }
  } else {
    console.warn('Sveriges Riksbank policy rate is unavailable:', riksbankResult.reason);
  }
  if (norgesBankResult.status === 'fulfilled') {
    const nok = snapshot.currencies.find((currency) => currency.code === 'NOK');
    if (nok && isFiniteNumber(norgesBankResult.value.value)) {
      nok.policyRate = norgesBankResult.value.value;
      nok.policyRateSource = 'provider';
      nok.policyRateObservationDate = norgesBankResult.value.date;
      nok.policyRateProvider = 'Norges Bank';
      hasLiveData = true;
    }
  } else {
    console.warn('Norges Bank policy rate is unavailable:', norgesBankResult.reason);
  }
  if (worldBankResult.status === 'fulfilled') {
    for (const observation of worldBankResult.value) {
      const currency = snapshot.currencies.find((item) => item.code === observation.currency);
      if (!currency || currency.inflationSource === 'provider') continue;
      currency.inflation = observation.inflation;
      currency.inflationLabel = `CPI (annual, ${observation.year})`;
      currency.inflationSource = 'provider';
      currency.inflationObservationDate = observation.observationDate || observation.year;
      currency.inflationProvider = 'World Bank';
      hasLiveData = true;
    }
  } else {
    console.warn('World Bank G10 inflation data is unavailable:', worldBankResult.reason);
  }
  if (blsResult.status === 'fulfilled' && isRecord(blsResult.value)) {
    const usd = snapshot.currencies.find((currency) => currency.code === 'USD');
    if (usd) {
      if (isFiniteNumber(blsResult.value.inflation) && usd.inflationSource !== 'provider') {
        usd.inflation = blsResult.value.inflation;
        usd.inflationLabel = 'CPI-U (annual)';
        usd.inflationSource = 'provider';
        usd.inflationObservationDate = typeof blsResult.value.inflationObservationDate === 'string' ? blsResult.value.inflationObservationDate : undefined;
        usd.inflationProvider = 'BLS';
        hasLiveData = true;
      }
      if (isFiniteNumber(blsResult.value.unemploymentRate)) {
        usd.unemploymentRate = blsResult.value.unemploymentRate;
        usd.unemploymentSource = 'provider';
        usd.unemploymentProvider = 'BLS';
        usd.unemploymentObservationDate = typeof blsResult.value.unemploymentObservationDate === 'string' ? blsResult.value.unemploymentObservationDate : undefined;
        hasLiveData = true;
      }
      if (isFiniteNumber(blsResult.value.wageGrowthYoY)) {
        usd.wageGrowthYoY = blsResult.value.wageGrowthYoY;
        usd.wageGrowthSource = 'provider';
        usd.wageGrowthProvider = 'BLS';
        usd.wageGrowthObservationDate = typeof blsResult.value.wageGrowthObservationDate === 'string' ? blsResult.value.wageGrowthObservationDate : undefined;
        hasLiveData = true;
      }
    }
  } else if (blsResult.status === 'rejected') {
    console.warn('BLS CPI, unemployment or wage data unavailable:', blsResult.reason);
  }
  if (beaResult.status === 'fulfilled' && isRecord(beaResult.value)) {
    const usd = snapshot.currencies.find((currency) => currency.code === 'USD');
    if (usd && isFiniteNumber(beaResult.value.gdpGrowthYoY)) {
      usd.gdpGrowthYoY = beaResult.value.gdpGrowthYoY;
      usd.gdpSource = 'provider';
      usd.gdpProvider = 'BEA';
      usd.gdpObservationDate = typeof beaResult.value.gdpObservationDate === 'string' ? beaResult.value.gdpObservationDate : undefined;
      hasLiveData = true;
    }
  } else if (beaResult.status === 'rejected') {
    console.warn('BEA real GDP data unavailable:', beaResult.reason);
  }
  if (bisResult.status === 'fulfilled') {
    for (const observation of bisResult.value) {
      const currency = snapshot.currencies.find((item) => item.code === observation.code);
      if (!currency) continue;
      if (isFiniteNumber(observation.policyRate)
        && observation.policyDate
        && (!currency.policyRateObservationDate || Date.parse(observation.policyDate) > Date.parse(currency.policyRateObservationDate))) {
        currency.policyRate = observation.policyRate;
        currency.policyRateSource = 'provider';
        currency.policyRateProvider = 'BIS';
        currency.policyRateObservationDate = observation.policyDate;
        hasLiveData = true;
      }
      if (isFiniteNumber(observation.inflation)
        && observation.inflationDate
        && (!currency.inflationObservationDate || Date.parse(observation.inflationDate) > Date.parse(currency.inflationObservationDate))) {
        currency.inflation = observation.inflation;
        currency.inflationLabel = 'CPI annual change';
        currency.inflationSource = 'provider';
        currency.inflationProvider = 'BIS';
        currency.inflationObservationDate = observation.inflationDate;
        hasLiveData = true;
      }
    }
  } else {
    console.warn('BIS G8 policy-rate and CPI observations are unavailable:', bisResult.reason);
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
          usd.policyRateObservationDate = typeof alphaResult.value.policyRateObservationDate === 'string' ? alphaResult.value.policyRateObservationDate : undefined;
          hasLiveData = true;
        }
        if (isFiniteNumber(alphaResult.value.inflation)) {
          usd.inflation = alphaResult.value.inflation;
          usd.cpi = alphaResult.value.inflation;
          usd.inflationLabel = 'CPI';
          usd.inflationSource = 'provider';
          usd.inflationObservationDate = typeof alphaResult.value.inflationObservationDate === 'string' ? alphaResult.value.inflationObservationDate : undefined;
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
  if (hasLiveData) {
    const coreG10 = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'SEK', 'NOK'];
    const completeG10MacroCoverage = coreG10.every((code) => {
      const currency = snapshot.currencies.find((item) => item.code === code);
      return currency?.policyRateSource === 'provider'
        && currency.inflationSource === 'provider'
        && isFreshProviderObservation(currency.policyRateObservationDate, 180)
        && isFreshProviderObservation(currency.inflationObservationDate, currency.code === 'AUD' ? 180 : 120);
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
    if (!parsed || !Number.isFinite(Date.parse(data.refreshed_at))) return null;
    const persistedCatalysts = filterCurrentCatalysts(parsed.catalysts);
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
      catalysts: data.payload.calendarSource === 'provider' ? persistedCatalysts : [],
      calendarSource: data.payload.calendarSource === 'provider' && persistedCatalysts.length > 0 ? 'provider' : 'unavailable',
      ...(parsed.energyMarkets ? { energyMarkets: parsed.energyMarkets } : {}),
      asOf: data.refreshed_at,
      ...(ecbRates && Object.keys(ecbRates).length > 0 ? { ecbRates } : {}),
    };
  } catch (error) {
    console.warn('Persisted macro snapshot is unavailable:', error);
    return null;
  }
}

async function persistMacroSnapshot(snapshot: MacroSnapshot): Promise<void> {
  if (!(process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())) return;
  const refreshedAt = snapshot.asOf && Number.isFinite(Date.parse(snapshot.asOf))
    ? snapshot.asOf
    : new Date().toISOString();
  try {
    const { error } = await getSupabaseAdmin().from('macro_snapshot_payloads').upsert({
      snapshot_key: 'global',
      payload: snapshot,
      refreshed_at: refreshedAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'snapshot_key' });
    if (error) throw error;
    await persistMacroObservations(snapshot);
  } catch (error) {
    // Persistence failure must not turn a valid live provider response into a failed refresh.
    console.error('Macro snapshot persistence failed:', error);
  }
}

export async function loadMacroSnapshot(): Promise<MacroSnapshot> {
  const persisted = await getPersistedSnapshot();
  const baseline = mergeWithFallback(persisted ?? getFallbackSnapshot());
  const endpoint = process.env.MACRO_DATA_PROVIDER_LICENSE_APPROVED === 'true' ? process.env.MACRO_DATA_PROVIDER_URL?.trim() : undefined;
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
      const providerCatalysts = filterCurrentCatalysts(parsed.catalysts);
      let ecbRates = persisted?.ecbRates;
      try {
        ecbRates = await getFrankfurterRates();
      } catch (error) {
        console.warn('ECB benchmark exchange rates are unavailable:', error);
      }
      const merged = mergeWithFallback({
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
        catalysts: providerCatalysts,
        source: 'provider',
        cotSource: 'provider',
        calendarSource: providerCatalysts.length > 0 ? 'provider' : 'unavailable',
        asOf: new Date().toISOString(),
        ...(ecbRates ? { ecbRates } : {}),
      });
      await persistMacroSnapshot(merged);
      return merged;
    } catch (error) {
      console.error('Macro data provider unavailable; checking live API adapters:', error);
    }
  }

  try {
    const liveSnapshot = await getLiveProviderSnapshot(baseline);
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
