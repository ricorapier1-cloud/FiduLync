import 'server-only';

import { getFallbackSnapshot, loadMacroSnapshot, purgeFREDStorageArtifacts, sanitizeMacroSnapshotPermissions } from '@/lib/macroData';
import { deleteCachedData, getCachedData } from '@/lib/redisCache';
import type { MacroSnapshot } from '@/types/macro';
import { getCrossAssetTelemetry, classifyMacroRegime } from '@/lib/macro/crossAssetEngine';
import { getCountryProfiles } from '@/lib/macro/countryProfiles';
import { getProviderTelemetry } from '@/lib/macro/providerTelemetry';

export type FundamentalSignal = {
  score: number;
  policyDiffBps: number;
  realYieldDiffBps: number;
  cotPositionDiff: number | null;
  twoYearDiffBps: number | null;
  roroScore: number | null;
};

let fredPermissionCleanup: Promise<void> | null = null;

export async function getMacroSnapshot(forceRefresh = false): Promise<MacroSnapshot> {
  let snapshot: MacroSnapshot;
  const fredStorageAllowed = process.env.FRED_DATA_STORAGE_PERMISSION_APPROVED?.trim().toLowerCase() !== 'false';
  const cacheKey = fredStorageAllowed ? 'macro:snapshot:v5:fred' : 'macro:snapshot:v5:no-fred';
  try {
    snapshot = await getCachedData(cacheKey, async () => sanitizeMacroSnapshotPermissions(await loadMacroSnapshot()), 900, forceRefresh);
    if (!fredStorageAllowed) {
      if (!fredPermissionCleanup) {
        fredPermissionCleanup = Promise.all([
          deleteCachedData('macro:snapshot:v3'),
          deleteCachedData('macro:snapshot:v4:fred'),
          deleteCachedData('macro:snapshot:v4:no-fred'),
          deleteCachedData('macro:snapshot:v5:fred'),
          ...['DFII10', 'T10YIE', 'DGS2', 'DTB3', 'BAMLH0A0HYM2', 'VIXCLS'].map((seriesId) => deleteCachedData(`xau:fred:${seriesId}:v1`)),
          purgeFREDStorageArtifacts(snapshot),
        ]).then(() => undefined).catch((error) => {
          console.error('FRED storage permission cleanup could not be completed:', error);
        });
      }
      await fredPermissionCleanup;
    }
  } catch (error) {
    console.warn('Macro providers and cached snapshots are unavailable; returning an unavailable state.', error);
    snapshot = getFallbackSnapshot();
  }

  // Enrich with cross-asset telemetry, country profiles, regime classification, and provider diagnostics
  const crossAsset = getCrossAssetTelemetry(snapshot);
  const regime = classifyMacroRegime(snapshot);
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
  const baseCotRaw = snapshot.cot.find((position) => position.market === baseCode);
  const quoteCotRaw = snapshot.cot.find((position) => position.market === quoteCode);
  const baseCot = baseCotRaw && baseCotRaw.sampleSize !== undefined && baseCotRaw.sampleSize >= 52
    && baseCotRaw.percentile !== null && isFreshMacroObservation(baseCotRaw.reportDate, 14) ? baseCotRaw : undefined;
  const quoteCot = quoteCotRaw && quoteCotRaw.sampleSize !== undefined && quoteCotRaw.sampleSize >= 52
    && quoteCotRaw.percentile !== null && isFreshMacroObservation(quoteCotRaw.reportDate, 14) ? quoteCotRaw : undefined;
  const policyDiffBps = base
    ? Math.round((base.policyRate - quote.policyRate) * 100)
    : Math.round(-quote.policyRate * 100);
  const realYieldDiffBps = base
    ? Math.round(((base.policyRate - base.inflation) - (quote.policyRate - quote.inflation)) * 100)
    : Math.round(-(quote.policyRate - quote.inflation) * 100);
  const cotPositionDiff = baseCot && quoteCot && baseCot.percentile !== null && quoteCot.percentile !== null
    ? Math.round(baseCot.percentile - quoteCot.percentile) : null;
  const twoYearDiffBps = base.twoYearYieldSource === 'provider' && quote.twoYearYieldSource === 'provider'
    && isFreshMacroObservation(base.twoYearYieldObservationDate, 60)
    && isFreshMacroObservation(quote.twoYearYieldObservationDate, 60)
    && base.twoYearYield !== undefined && quote.twoYearYield !== undefined
      ? Math.round((base.twoYearYield - quote.twoYearYield) * 100) : null;
  // Cross-asset risk appetite remains unavailable until synchronized market feeds exist.
  const roroScore = null;
  const rawScore = (base.policyRate - quote.policyRate) * 12
    + ((base.policyRate - base.inflation) - (quote.policyRate - quote.inflation)) * 9
    + (twoYearDiffBps ?? 0) * 0.05
    + (cotPositionDiff !== null ? cotPositionDiff * 0.18 : 0);

  return {
    score: Math.max(-100, Math.min(100, Math.round(rawScore))),
    policyDiffBps,
    realYieldDiffBps,
    cotPositionDiff,
    twoYearDiffBps,
    roroScore,
  };
}
