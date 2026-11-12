export interface NormalizedCsiItem {
  currency: string;
  score: number;
}

export function isRolloverActive(date: Date = new Date()): boolean {
  const totalMins = date.getUTCHours() * 60 + date.getUTCMinutes();
  // 20:45 UTC (1245 mins) to 22:15 UTC (1335 mins) NY close liquidity drought
  return totalMins >= 1245 && totalMins <= 1335;
}

export function normalizeCsiPayload(raw: unknown): NormalizedCsiItem[] {
  const arr = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).rankings)
      ? ((raw as Record<string, unknown>).rankings as unknown[])
      : raw && typeof raw === 'object'
        ? Object.entries(raw as Record<string, unknown>).map(([currency, val]) => ({
            currency,
            score: typeof val === 'number' ? val : Number((val as Record<string, unknown>)?.score ?? 0),
          }))
        : [];

  return arr
    .map((item) => {
      const rec = item as Record<string, unknown>;
      const currency = String(rec.currency ?? rec.code ?? rec.symbol ?? '').toUpperCase().trim();
      const score = Number(rec.score ?? rec.strength ?? rec.value ?? 0);
      return { currency, score };
    })
    .filter((x) => x.currency.length === 3 && !Number.isNaN(x.score));
}

export function getTopExecutablePair(rawRankings: unknown): {
  pair: string;
  direction: 'LONG' | 'SHORT';
  spread: number;
  base: string;
  quote: string;
} {
  const normalized = normalizeCsiPayload(rawRankings);
  // Exclude illiquid Scandinavian currencies (NOK, SEK) from automated execution pairing
  const liquidG8 = normalized.filter((item) => !['NOK', 'SEK'].includes(item.currency));

  if (liquidG8.length < 2) {
    return { pair: 'USDJPY', direction: 'LONG', spread: 0, base: 'USD', quote: 'JPY' };
  }

  const sorted = [...liquidG8].sort((a, b) => b.score - a.score);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];
  const spread = Math.round(strongest.score - weakest.score);

  return {
    pair: `${strongest.currency}${weakest.currency}`,
    direction: 'LONG',
    spread,
    base: strongest.currency,
    quote: weakest.currency,
  };
}
