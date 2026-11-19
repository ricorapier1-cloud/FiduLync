export interface NormalizedCsiItem {
  currency: string;
  score: number;
}

const LIQUID_G8 = new Set(['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD']);

export function isRolloverActive(date: Date = new Date()): boolean {
  const totalMins = date.getUTCHours() * 60 + date.getUTCMinutes();
  // Approximate UTC rollover watch window. Broker-specific rollover remains authoritative.
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
            score: typeof val === 'number' ? val : Number((val as Record<string, unknown>)?.score),
          }))
        : [];

  const byCurrency = new Map<string, NormalizedCsiItem>();
  for (const item of arr) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    const currency = String(rec.currency ?? rec.code ?? rec.symbol ?? '').toUpperCase().trim();
    const score = Number(rec.score ?? rec.strength ?? rec.value);
    if (!LIQUID_G8.has(currency) || !Number.isFinite(score)) continue;
    byCurrency.set(currency, { currency, score });
  }
  return [...byCurrency.values()];
}

export function getTopRelativeValueCandidate(rawRankings: unknown): {
  pair: string;
  direction: 'LONG';
  spread: number;
  base: string;
  quote: string;
} | null {
  const normalized = normalizeCsiPayload(rawRankings);
  if (normalized.length < 2) return null;

  const sorted = [...normalized].sort((a, b) => b.score - a.score);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];
  const spread = strongest.score - weakest.score;
  if (!Number.isFinite(spread) || spread <= 0) return null;

  return {
    pair: `${strongest.currency}${weakest.currency}`,
    direction: 'LONG',
    spread: Math.round(spread),
    base: strongest.currency,
    quote: weakest.currency,
  };
}
