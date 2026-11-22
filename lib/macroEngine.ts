import 'server-only';

import { getFallbackSnapshot, loadMacroSnapshot } from '@/lib/macroData';
import { getCachedData } from '@/lib/redisCache';
import type { MacroSnapshot } from '@/types/macro';
import { getCrossAssetTelemetry, classifyMacroRegime } from '@/lib/macro/crossAssetEngine';
import { getCountryProfiles } from '@/lib/macro/countryProfiles';
import { getProviderTelemetry } from '@/lib/macro/providerTelemetry';

export type FundamentalSignal = {
  score: number;
  policyDiffBps: number;
  realYieldDiffBps: number;
  cotPositionDiff: number;
  twoYearDiffBps: number | null;
  roroScore: number;
};

export async function getMacroSnapshot(forceRefresh = false): Promise<MacroSnapshot> {
  let snapshot: MacroSnapshot;
  try {
    snapshot = await getCachedData('macro:snapshot:v3', loadMacroSnapshot, 900, forceRefresh);
  } catch (error) {
    console.warn('Macro providers and cached snapshots are unavailable; serving reference macro levels.', error);
    snapshot = getFallbackSnapshot();
  }

  // Enrich with cross-asset telemetry, country profiles, regime classification, and provider diagnostics
  const crossAsset = getCrossAssetTelemetry(snapshot);
  const regime = classifyMacroRegime(snapshot, crossAsset);
  const countryProfiles = getCountryProfiles(snapshot);
  const providerStatus = getProviderTelemetry(snapshot);

  return {
    ...snapshot,
    crossAsset,
    regime,
    countryProfiles,
    providerStatus,
  };
}

function isFreshMacroObservation(date: string | undefined, maxAgeDays: number): boolean {
  if (!date) return false;
  const timestamp = Date.parse(date);
  const age = Date.now() - timestamp;
  return Number.isFinite(timestamp) && age >= -5 * 60_000 && age <= maxAgeDays * 86_400_000;
}

export function getFundamentalSignal(snapshot: MacroSnapshot, pair: string): FundamentalSignal | null {
  const normalizedPair = pair.toUpperCase();
  if (!/^[A-Z]{6}$/.test(normalizedPair)) return null;

  const baseCode = normalizedPair.slice(0, 3);
  const quoteCode = normalizedPair.slice(3);
  const quote = snapshot.currencies.find((currency) => currency.code === quoteCode);
  const base = baseCode === 'XAU' ? null : snapshot.currencies.find((currency) => currency.code === baseCode);
  if (!quote || !base || baseCode === 'XAU') return null;
  const verified = (currency: NonNullable<typeof base>) => currency.policyRateSource === 'provider'
    && currency.inflationSource === 'provider'
    && isFreshMacroObservation(currency.policyRateObservationDate, 180)
    && isFreshMacroObservation(currency.inflationObservationDate, currency.code === 'AUD' ? 180 : 120);
  if (!verified(base) || !verified(quote)) return null;
  const baseCot = snapshot.cot.find((position) => position.market === baseCode);
  const quoteCot = snapshot.cot.find((position) => position.market === quoteCode);
  const policyDiffBps = base
    ? Math.round((base.policyRate - quote.policyRate) * 100)
    : Math.round(-quote.policyRate * 100);
  const realYieldDiffBps = base
    ? Math.round(((base.policyRate - base.inflation) - (quote.policyRate - quote.inflation)) * 100)
    : Math.round(-(quote.policyRate - quote.inflation) * 100);
  const cotPositionDiff = baseCot && quoteCot ? Math.round(baseCot.percentile - quoteCot.percentile) : 0;
  const twoYearDiffBps = base.twoYearYieldSource === 'provider' && quote.twoYearYieldSource === 'provider'
    && isFreshMacroObservation(base.twoYearYieldObservationDate, 60)
    && isFreshMacroObservation(quote.twoYearYieldObservationDate, 60)
    && base.twoYearYield !== undefined && quote.twoYearYield !== undefined
      ? Math.round((base.twoYearYield - quote.twoYearYield) * 100) : null;
  // Cross-asset risk appetite is unavailable until synchronized market feeds exist.
  const roroScore = 0;
  const rawScore = (base.policyRate - quote.policyRate) * 12
    + ((base.policyRate - base.inflation) - (quote.policyRate - quote.inflation)) * 9
    + (twoYearDiffBps ?? 0) * 0.05
    + (baseCot && quoteCot ? cotPositionDiff * 0.18 : 0);

  return {
    score: Math.max(-100, Math.min(100, Math.round(rawScore + roroScore * 0.1))),
    policyDiffBps,
    realYieldDiffBps,
    cotPositionDiff,
    twoYearDiffBps,
    roroScore,
  };
}
