import type { CrossAssetTelemetry, MacroRegime, MacroSnapshot } from '@/types/macro';

/**
 * The app has no verified live adapters for the full cross-asset basket yet.
 * Never manufacture market levels or classify a regime from constants.
 */
export function getCrossAssetTelemetry(snapshot: MacroSnapshot): CrossAssetTelemetry {
  const usd = snapshot.currencies.find((currency) => currency.code === 'USD');
  const verifiedTwoYear = usd?.twoYearYieldSource === 'provider' ? usd.twoYearYield : null;
  return {
    usTwoYearYield: verifiedTwoYear ?? 0,
    usTenYearYield: 0,
    usTenYearRealYield: 0,
    usBreakevenTenYear: 0,
    broadTradeWeightedUsd: 0,
    vix: 0,
    vixRegime: 'LOW',
    goldUsd: 0,
    crudeWti: 0,
    brentCrude: 0,
    copperUsd: 0,
    highYieldSpreadBps: 0,
    globalRiskAppetite: 'NEUTRAL',
    timestampUtc: snapshot.asOf || '',
    freshness: 'UNAVAILABLE',
  };
}

function isFreshObservation(date: string | undefined, maxAgeDays: number): boolean {
  if (!date) return false;
  const timestamp = Date.parse(date);
  const age = Date.now() - timestamp;
  return Number.isFinite(timestamp) && age >= -5 * 60_000 && age <= maxAgeDays * 86_400_000;
}

export function classifyMacroRegime(snapshot: MacroSnapshot, _crossAsset: CrossAssetTelemetry): MacroRegime {
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
      && isFreshObservation(currency.inflationObservationDate, 120));
  if (verified.length < 4) return 'INSUFFICIENT_EVIDENCE';

  const rates = verified.map((currency) => currency!.policyRate);
  const dispersion = Math.max(...rates) - Math.min(...rates);
  const inflation = verified.map((currency) => currency!.inflation);
  if (inflation.every(Number.isFinite) && inflation.reduce((sum, value) => sum + value, 0) / inflation.length >= 3.5) {
    return 'INFLATION_SHOCK_HAWKISH';
  }
  return dispersion >= 2.5 ? 'POLICY_DIVERGENCE_CARRY' : 'INSUFFICIENT_EVIDENCE';
}
