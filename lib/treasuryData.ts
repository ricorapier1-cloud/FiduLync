import 'server-only';
import type { TreasuryYieldData } from '@/types/macro';

type YieldRow = { date: string; values: Record<string, number> };

function parseXmlNumber(entry: string, field: string): number | null {
  const expression = new RegExp('<(?:[A-Za-z0-9_]+:)?' + field + '\\b[^>]*>([^<]*)<\\/(?:[A-Za-z0-9_]+:)?' + field + '>', 'i');
  const match = entry.match(expression);
  if (!match || !match[1].trim()) return null;
  const value = Number(match[1].trim());
  return Number.isFinite(value) ? value : null;
}

function parseTreasuryRows(xml: string, fields: string[]): YieldRow[] {
  const entries = xml.match(/<entry\b[^>]*>[\s\S]*?<\/entry>/gi) ?? [];
  return entries.flatMap((entry): YieldRow[] => {
    const dateMatch = entry.match(/<(?:[A-Za-z0-9_]+:)?NEW_DATE\b[^>]*>([^<]+)<\/(?:[A-Za-z0-9_]+:)?NEW_DATE>/i);
    const date = dateMatch?.[1]?.slice(0, 10);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
    const values: Record<string, number> = {};
    for (const field of fields) {
      const value = parseXmlNumber(entry, field);
      if (value !== null) values[field] = value;
    }
    return [{ date, values }];
  }).sort((a, b) => b.date.localeCompare(a.date));
}

async function fetchTreasuryRows(dataset: 'daily_treasury_yield_curve' | 'daily_treasury_real_yield_curve', fields: string[]): Promise<YieldRow[]> {
  const year = new Date().getUTCFullYear();
  const url = new URL('https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml');
  url.searchParams.set('data', dataset);
  url.searchParams.set('field_tdr_date_value', String(year));
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: 'application/atom+xml, application/xml, text/xml' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error('U.S. Treasury ' + dataset + ' returned HTTP ' + response.status + '.');
  const xml = await response.text();
  if (!xml.includes('<feed') && !xml.includes(':feed')) throw new Error('U.S. Treasury returned an invalid XML feed.');
  const rows = parseTreasuryRows(xml, fields);
  if (!rows.length) throw new Error('U.S. Treasury returned no usable observations for ' + dataset + '.');
  return rows;
}

/** Daily official Treasury par nominal and TIPS real yields; not intraday quotes. */
export async function getTreasuryYieldData(): Promise<TreasuryYieldData> {
  const retrievedAtUtc = new Date().toISOString();
  const [nominalRows, realRows] = await Promise.all([
    fetchTreasuryRows('daily_treasury_yield_curve', ['BC_2YEAR', 'BC_3MONTH', 'BC_10YEAR']),
    fetchTreasuryRows('daily_treasury_real_yield_curve', ['BC_10YEAR']),
  ]);
  const realByDate = new Map(realRows.map((row) => [row.date, row.values.BC_10YEAR]));
  const matched = nominalRows.find((row) =>
    row.values.BC_2YEAR !== undefined
    && row.values.BC_3MONTH !== undefined
    && row.values.BC_10YEAR !== undefined
    && realByDate.has(row.date)
  );
  if (!matched) throw new Error('No same-day nominal and real Treasury yield observations are available.');
  const nominal2Y = matched.values.BC_2YEAR;
  const nominal3M = matched.values.BC_3MONTH;
  const nominal10Y = matched.values.BC_10YEAR;
  const real10Y = realByDate.get(matched.date);
  if (real10Y === undefined || ![nominal2Y, nominal3M, nominal10Y, real10Y].every(Number.isFinite)) {
    throw new Error('Treasury yield observations failed numeric validation.');
  }
  const ageMs = Date.now() - Date.parse(matched.date + 'T23:59:59Z');
  if (ageMs < -5 * 60_000) throw new Error('Treasury observation date is in the future.');
  return {
    source: 'US TREASURY',
    observationDate: matched.date,
    retrievedAtUtc,
    nominal2YPct: nominal2Y,
    nominal3MPct: nominal3M,
    nominal10YPct: nominal10Y,
    real10YPct: real10Y,
    twoYearTenYearSpreadBps: Math.round((nominal10Y - nominal2Y) * 100),
    twoYearThreeMonthSpreadBps: Math.round((nominal2Y - nominal3M) * 100),
    breakevenTenYearPct: Number((nominal10Y - real10Y).toFixed(3)),
    freshness: ageMs <= 7 * 24 * 60 * 60 * 1000 ? 'LATEST PUBLISHED' : 'STALE',
  };
}
