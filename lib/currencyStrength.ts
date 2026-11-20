import type { MacroSnapshot } from '@/types/macro';

export const MAJOR_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'SEK', 'NOK'] as const;
export type MajorCurrency = (typeof MAJOR_CURRENCIES)[number];
export type CurrencyStrength = { currency: MajorCurrency; score: number; cotPercentile?: number; cotAsOf?: string };

export function getCurrencyStrengthIndex(snapshot: MacroSnapshot): CurrencyStrength[] {
  const currencies = snapshot.currencies.filter((item) =>
    MAJOR_CURRENCIES.includes(item.code as MajorCurrency)
    && item.policyRateSource === 'provider'
    && item.inflationSource === 'provider');
  if (!currencies.length) return [];
  const cot = new Map(snapshot.cot.map((item) => [item.market, item]));
  const rawScores = currencies.map((currency) => {
    const position = cot.get(currency.code);
    const positionAgeMs = position?.asOf ? Date.now() - Date.parse(position.asOf) : Number.POSITIVE_INFINITY;
    const freshPosition = position
      && Number.isFinite(positionAgeMs)
      && positionAgeMs >= 0
      && positionAgeMs <= 10 * 24 * 60 * 60_000
      ? position
      : undefined;
    return {
      currency: currency.code as MajorCurrency,
      raw: currency.policyRate * 0.45
        + (currency.policyRate - currency.inflation) * 0.45
        + (freshPosition ? ((freshPosition.percentile - 50) / 50) * 0.1 : 0),
      ...(freshPosition ? { cotPercentile: freshPosition.percentile, cotAsOf: freshPosition.asOf } : {}),
    };
  });
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
