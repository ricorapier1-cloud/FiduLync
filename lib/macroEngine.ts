import 'server-only';

import { SEED_SNAPSHOT, loadMacroSnapshot } from '@/lib/macroData';
import { getCachedData } from '@/lib/redisCache';
import type { MacroSnapshot } from '@/types/macro';

export type FundamentalSignal = {
  score: number;
  policyDiffBps: number;
  realYieldDiffBps: number;
  cotPositionDiff: number;
};

export async function getMacroSnapshot(forceRefresh = false): Promise<MacroSnapshot> {
  try {
    return await getCachedData('macro:snapshot', () => loadMacroSnapshot(forceRefresh), 3_600, forceRefresh);
  } catch (error) {
    console.warn('Macro providers and cached snapshots are unavailable; serving the illustrative baseline.', error);
    return { ...SEED_SNAPSHOT, asOf: new Date().toISOString() };
  }
}

export function getFundamentalSignal(snapshot: MacroSnapshot, pair: string): FundamentalSignal | null {
  const normalizedPair = pair.toUpperCase();
  if (!/^[A-Z]{6}$/.test(normalizedPair)) return null;

  const baseCode = normalizedPair.slice(0, 3);
  const quoteCode = normalizedPair.slice(3);
  const quote = snapshot.currencies.find((currency) => currency.code === quoteCode);
  const base = baseCode === 'XAU' ? null : snapshot.currencies.find((currency) => currency.code === baseCode);
  if (!quote || (baseCode !== 'XAU' && !base)) return null;

  const baseCotMarket = baseCode === 'XAU' ? 'GOLD' : baseCode;
  const baseCot = snapshot.cot.find((position) => position.market === baseCotMarket);
  const quoteCot = snapshot.cot.find((position) => position.market === quoteCode);
  const policyDiffBps = base
    ? Math.round((base.policyRate - quote.policyRate) * 100)
    : Math.round(-quote.policyRate * 100);
  const realYieldDiffBps = base
    ? Math.round(((base.policyRate - base.inflation) - (quote.policyRate - quote.inflation)) * 100)
    : Math.round(-(quote.policyRate - quote.inflation) * 100);
  const cotPositionDiff = Math.round((baseCot?.percentile ?? 50) - (quoteCot?.percentile ?? 50));
  const rawScore = base
    ? (base.policyRate - quote.policyRate) * 12
      + ((base.policyRate - base.inflation) - (quote.policyRate - quote.inflation)) * 9
      + cotPositionDiff * 0.18
    : (quote.policyRate - quote.inflation) * -18 + cotPositionDiff * 0.18;

  return {
    score: Math.max(-100, Math.min(100, Math.round(rawScore))),
    policyDiffBps,
    realYieldDiffBps,
    cotPositionDiff,
  };
}
