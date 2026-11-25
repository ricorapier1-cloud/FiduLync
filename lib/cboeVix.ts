import 'server-only';
import type { CboeVixData } from '@/types/macro';

type CboeVixResult = {
  source: 'CBOE';
  value: number;
  observationDate: string;
  retrievedAtUtc: string;
  freshness: 'LATEST PUBLISHED' | 'STALE';
  history: Array<{ date: string; value: number }>;
};

function normalizeDate(raw: string): string | null {
  const value = raw.trim().replace(/^"|"$/g, '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date.toISOString().slice(0, 10)
    : null;
}

/** Official Cboe daily VIX close history; this is not an intraday VIX feed. */
export async function getCboeVixHistory(): Promise<CboeVixResult> {
  const response = await fetch('https://cdn-api.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv', {
    cache: 'no-store',
    headers: { Accept: 'text/csv' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error('Cboe VIX history returned HTTP ' + response.status + '.');
  const csv = await response.text();
  const [headerLine, ...dataLines] = csv.trim().split(/\r?\n/);
  if (!headerLine || !dataLines.length) throw new Error('Cboe VIX history returned an empty CSV file.');
  const headers = headerLine.split(',').map((item) => item.trim().replace(/^"|"$/g, '').toUpperCase());
  const dateIndex = headers.indexOf('DATE');
  const closeIndex = headers.indexOf('CLOSE');
  if (dateIndex < 0 || closeIndex < 0) throw new Error('Cboe VIX CSV schema is missing DATE or CLOSE.');
  const observations = dataLines.flatMap((line): Array<{ date: string; value: number }> => {
    const cells = line.split(',');
    const date = normalizeDate(cells[dateIndex] ?? '');
    const value = Number((cells[closeIndex] ?? '').trim().replace(/^"|"$/g, ''));
    return date && Number.isFinite(value) && value > 0 ? [{ date, value }] : [];
  }).sort((left, right) => left.date.localeCompare(right.date));
  const latest = observations.at(-1);
  if (!latest) throw new Error('Cboe VIX CSV contained no valid daily close observations.');
  const retrievedAtUtc = new Date().toISOString();
  const ageMs = Date.now() - Date.parse(latest.date + 'T23:59:59Z');
  if (ageMs < -5 * 60_000) throw new Error('Cboe VIX observation date is in the future.');
  return {
    source: 'CBOE',
    value: latest.value,
    observationDate: latest.date,
    retrievedAtUtc,
    freshness: ageMs <= 7 * 24 * 60 * 60 * 1000 ? 'LATEST PUBLISHED' : 'STALE',
    history: observations.slice(-65),
  };
}
