import type { MacroSnapshot } from '@/types/macro';

export const MAJOR_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'SEK', 'NOK'] as const;
export type MajorCurrency = (typeof MAJOR_CURRENCIES)[number];
export type CurrencyStrength = { currency: MajorCurrency; score: number };

const CORE_FX_UNIVERSE: readonly MajorCurrency[] = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD'];

function inflationFreshnessDays(currencyCode: string): number {
  return currencyCode === 'AUD' ? 180 : 120;
}

function isFreshObservation(date: string | undefined, maxAgeDays: number): boolean {
  if (!date || !/(?:Z|[+-]\d{2}:?\d{2})$|^\d{4}-\d{2}(?:-\d{2})?$/.test(date)) return false;
  const timestamp = Date.parse(date);
  const age = Date.now() - timestamp;
  return Number.isFinite(timestamp) && age >= -5 * 60_000 && age <= maxAgeDays * 86_400_000;
}

function hourInZone(date: Date, timeZone: string): number {
  const part = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date).find((part) => part.type === 'hour')?.value;
  return part ? Number(part) : NaN;
}

/**
 * Cross-sectional macro strength is unavailable unless every core traded FX
 * currency has a fresh policy-rate and monthly inflation observation.
 * This is a descriptive factor score, not a probability of winning a trade.
 */
export function getCurrencyStrengthIndex(snapshot: MacroSnapshot): CurrencyStrength[] {
  const byCode = new Map<string, MacroSnapshot['currencies'][number]>();
  for (const item of snapshot.currencies) {
    if (byCode.has(item.code)) return [];
    byCode.set(item.code, item);
  }

  const currencies = CORE_FX_UNIVERSE.map((code) => byCode.get(code));
  if (currencies.some((item) => !item
    || item.policyRateSource !== 'provider'
    || item.inflationSource !== 'provider'
    || !isFreshObservation(item.policyRateObservationDate, 180)
    || !isFreshObservation(item.inflationObservationDate, inflationFreshnessDays(item.code)))) {
    return [];
  }

  const rawScores = currencies.map((currency) => ({
    currency: currency!.code as MajorCurrency,
    raw: currency!.policyRate * 0.5
      + (currency!.policyRate - currency!.inflation) * 0.5,
  }));
  const mean = rawScores.reduce((total, item) => total + item.raw, 0) / rawScores.length;
  const maxDeviation = Math.max(...rawScores.map((item) => Math.abs(item.raw - mean)), 0.01);
  return rawScores
    .map(({ currency, raw }) => ({
      currency,
      score: Math.round(Math.max(-100, Math.min(100, ((raw - mean) / maxDeviation) * 100))),
    }))
    .sort((left, right) => right.score - left.score || left.currency.localeCompare(right.currency));
}

export function getLiquiditySession(date = new Date()): 'ASIAN_RANGE' | 'LONDON_KILLZONE' | 'NY_OVERLAP' | 'OFF_HOURS' {
  // Session windows use IANA zones so US/UK daylight-saving changes do not
  // shift the displayed market session by an hour.
  const watHour = hourInZone(date, 'Africa/Lagos');
  const newYorkHour = hourInZone(date, 'America/New_York');
  const tokyoHour = hourInZone(date, 'Asia/Tokyo');
  if (watHour >= 8 && watHour < 12) return 'LONDON_KILLZONE';
  if (newYorkHour >= 8 && newYorkHour < 12) return 'NY_OVERLAP';
  if (tokyoHour >= 9 && tokyoHour < 15) return 'ASIAN_RANGE';
  return 'OFF_HOURS';
}

export function getKillzoneActive(date = new Date()): 'LONDON_OPEN' | 'NY_OVERLAP' | 'ASIAN_RANGE' | 'OFF_SESSION' {
  const session = getLiquiditySession(date);
  if (session === 'LONDON_KILLZONE') return 'LONDON_OPEN';
  if (session === 'OFF_HOURS') return 'OFF_SESSION';
  return session;
}
