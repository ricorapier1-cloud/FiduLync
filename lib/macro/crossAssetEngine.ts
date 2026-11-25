import type { CrossAssetTelemetry, MacroRegime, MacroSnapshot } from '@/types/macro';

/**
 * Populate only independently sourced observations attached to the snapshot.
 * Unsupported cross-asset inputs remain null; never infer regimes from placeholders.
 */
export function getCrossAssetTelemetry(snapshot: MacroSnapshot): CrossAssetTelemetry {
  const usd = snapshot.currencies.find((currency) => currency.code === 'USD');
  const verifiedTwoYear = usd?.twoYearYieldSource === 'provider' ? usd.twoYearYield : null;
  const treasury = snapshot.usTreasury?.freshness === 'LATEST PUBLISHED' ? snapshot.usTreasury : undefined;
  const wti = snapshot.energyMarkets?.wti.freshness === 'LATEST PUBLISHED' ? snapshot.energyMarkets.wti.valueUsdPerBarrel : null;
  const brent = snapshot.energyMarkets?.brent.freshness === 'LATEST PUBLISHED' ? snapshot.energyMarkets.brent.valueUsdPerBarrel : null;
  return {
    usTwoYearYield: treasury?.nominal2YPct ?? verifiedTwoYear ?? null,
    usTenYearYield: treasury?.nominal10YPct ?? null,
    usTenYearRealYield: treasury?.real10YPct ?? null,
    usBreakevenTenYear: treasury?.breakevenTenYearPct ?? null,
    broadTradeWeightedUsd: null,
    vix: null,
    vixRegime: 'UNAVAILABLE',
    goldUsd: null,
    crudeWti: wti,
    brentCrude: brent,
    copperUsd: null,
    highYieldSpreadBps: null,
    globalRiskAppetite: 'UNAVAILABLE',
    timestampUtc: treasury?.observationDate ?? snapshot.asOf ?? '',
    freshness: treasury ? 'LATEST PUBLISHED' : wti !== null || brent !== null ? 'LATEST PUBLISHED' : 'UNAVAILABLE',
  };
}

function inflationFreshnessDays(currencyCode: string): number {
  return currencyCode === 'AUD' ? 180 : 120;
}

function isFreshObservation(date: string | undefined, maxAgeDays: number): boolean {
  if (!date) return false;
  const timestamp = Date.parse(date);
  const age = Date.now() - timestamp;
  return Number.isFinite(timestamp) && age >= -5 * 60_000 && age <= maxAgeDays * 86_400_000;
}

export function classifyMacroRegime(snapshot: MacroSnapshot): MacroRegime {
  const highImpactSoon = snapshot.catalysts.some((event) => {
    if (event.impact !== 'High') return false;
    const time = Date.parse(event.scheduledAt);
    return Number.isFinite(time) && Math.abs(time - Date.now()) <= 30 * 60 * 1000;
  });
  if (highImpactSoon) return 'EVENT_LOCKOUT_HIGH_UNCERTAINTY';

  const g8 = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD'];
  const verified = g8.map((code) => snapshot.currencies.find((currency) => currency.code === code))
    .filter((currency) => currency?.policyRateSource === 'provider' && currency.inflationSource === 'provider'
      && isFreshObservation(currency.policyRateObservationDate, 180)
      && isFreshObservation(currency.inflationObservationDate, inflationFreshnessDays(currency.code)));
  if (verified.length < 4) return 'INSUFFICIENT_EVIDENCE';

  const rates = verified.map((currency) => currency!.policyRate);
  const dispersion = Math.max(...rates) - Math.min(...rates);
  return dispersion >= 2.5 ? 'POLICY_DIVERGENCE_CARRY' : 'INSUFFICIENT_EVIDENCE';
}
