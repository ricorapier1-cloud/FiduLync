import type { MacroSnapshot } from '@/types/macro';

export const MAJOR_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'SEK', 'NOK'] as const;
export type MajorCurrency = (typeof MAJOR_CURRENCIES)[number];
export type CurrencyStrength = {
  currency: MajorCurrency;
  score: number;
  policyRateAsOf: string;
  inflationAsOf: string;
};

const MAX_POLICY_AGE_MS = 180 * 24 * 60 * 60_000;
const MAX_INFLATION_AGE_MS = 900 * 24 * 60 * 60_000;

function validObservationDate(value: string | undefined, now: number, maxAgeMs: number): boolean {
  if (!value) return false;
  const timestamp = Date.parse(value);
  const age = now - timestamp;
  return Number.isFinite(timestamp) && age >= 0 && age <= maxAgeMs;
}

function zScores(values: number[]): number[] {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const standardDeviation = Math.sqrt(variance);
  return standardDeviation > 0
    ? values.map((value) => (value - mean) / standardDeviation)
    : values.map(() => 0);
}

/**
 * Descriptive cross-sectional policy/real-rate context only.
 * It is not a return forecast or an FX signal. COT is intentionally excluded:
 * the stored COT date is the position observation date, not its publication time.
 */
export function getCurrencyStrengthIndex(snapshot: MacroSnapshot, now = Date.now()): CurrencyStrength[] {
  const currencies = snapshot.currencies.filter((item) =>
    MAJOR_CURRENCIES.includes(item.code as MajorCurrency)
    && item.policyRateSource === 'provider'
    && item.inflationSource === 'provider'
    && Number.isFinite(item.policyRate)
    && Number.isFinite(item.inflation)
    && validObservationDate(item.policyRateAsOf, now, MAX_POLICY_AGE_MS)
    && validObservationDate(item.inflationAsOf, now, MAX_INFLATION_AGE_MS));
  if (currencies.length < 3) return [];

  const policyZ = zScores(currencies.map((currency) => currency.policyRate));
  const realRateZ = zScores(currencies.map((currency) => currency.policyRate - currency.inflation));
  return currencies.map((currency, index) => ({
    currency: currency.code as MajorCurrency,
    score: Math.round(Math.max(-100, Math.min(100, ((policyZ[index] + realRateZ[index]) / 2) * 35))),
    policyRateAsOf: currency.policyRateAsOf!,
    inflationAsOf: currency.inflationAsOf!,
  })).sort((left, right) => right.score - left.score || left.currency.localeCompare(right.currency));
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
