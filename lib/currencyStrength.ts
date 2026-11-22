import type { MacroSnapshot } from '@/types/macro';

export const MAJOR_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'SEK', 'NOK'] as const;
export type MajorCurrency = (typeof MAJOR_CURRENCIES)[number];
export type CurrencyStrength = { currency: MajorCurrency; score: number };

function inflationFreshnessDays(currencyCode: string): number {
  return currencyCode === 'AUD' ? 180 : 120;
}

function isFreshObservation(date: string | undefined, maxAgeDays: number): boolean {
  if (!date) return false;
  const timestamp = Date.parse(date);
  const age = Date.now() - timestamp;
  return Number.isFinite(timestamp) && age >= -5 * 60_000 && age <= maxAgeDays * 86_400_000;
}

export function getCurrencyStrengthIndex(snapshot: MacroSnapshot): CurrencyStrength[] {
  const currencies = snapshot.currencies.filter((item) =>
    MAJOR_CURRENCIES.includes(item.code as MajorCurrency)
    && item.policyRateSource === 'provider'
    && item.inflationSource === 'provider'
    && isFreshObservation(item.policyRateObservationDate, 180)
    && isFreshObservation(item.inflationObservationDate, inflationFreshnessDays(item.code)));
  if (!currencies.length) return [];
  const cot = new Map(snapshot.cot.map((item) => [item.market, item.percentile]));
  const rawScores = currencies.map((currency) => ({
    currency: currency.code as MajorCurrency,
    raw: currency.policyRate * 0.5
      + (currency.policyRate - currency.inflation) * 0.5
      + (((cot.get(currency.code) ?? 50) - 50) / 50) * 0.0,
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
  const hour = date.getUTCHours();
  if (hour >= 0 && hour < 7) return 'ASIAN_RANGE';
  if (hour >= 7 && hour < 12) return 'LONDON_KILLZONE';
  if (hour >= 12 && hour < 17) return 'NY_OVERLAP';
  return 'OFF_HOURS';
}

export function getKillzoneActive(date = new Date()): 'LONDON_OPEN' | 'NY_OVERLAP' | 'ASIAN_RANGE' | 'OFF_SESSION' {
  const session = getLiquiditySession(date);
  if (session === 'LONDON_KILLZONE') return 'LONDON_OPEN';
  if (session === 'OFF_HOURS') return 'OFF_SESSION';
  return session;
}
