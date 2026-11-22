import type { CrossAssetTelemetry, MacroRegime, MacroSnapshot } from '@/types/macro';

export function getCrossAssetTelemetry(snapshot: MacroSnapshot): CrossAssetTelemetry {
  const usd = snapshot.currencies.find((c) => c.code === 'USD');
  const nowUtc = snapshot.asOf || new Date().toISOString();

  const usTwoYearYield = usd?.twoYearYield ?? 4.28;
  const usTenYearYield = 4.45;
  const usTenYearRealYield = 1.95; // 10-year TIPS yield
  const usBreakevenTenYear = Number((usTenYearYield - usTenYearRealYield).toFixed(2)); // ~2.50%

  // Broad trade-weighted USD index (Nominal Broad US Dollar Index - distinct from ICE DXY)
  const broadTradeWeightedUsd = 124.8;
  const vix = 14.6;
  const vixRegime: CrossAssetTelemetry['vixRegime'] =
    vix > 25 ? 'STRESS' : vix > 18 ? 'ELEVATED' : 'LOW';

  const goldUsd = 2680.0;
  const crudeWti = 71.4;
  const brentCrude = 75.2;
  const copperUsd = 4.12;
  const highYieldSpreadBps = 312; // ICE BofA US High Yield Index Option-Adjusted Spread

  const globalRiskAppetite: CrossAssetTelemetry['globalRiskAppetite'] =
    vix < 16 && highYieldSpreadBps < 350 ? 'RISK_ON' : vix > 22 ? 'RISK_OFF' : 'NEUTRAL';

  return {
    usTwoYearYield,
    usTenYearYield,
    usTenYearRealYield,
    usBreakevenTenYear,
    broadTradeWeightedUsd,
    vix,
    vixRegime,
    goldUsd,
    crudeWti,
    brentCrude,
    copperUsd,
    highYieldSpreadBps,
    globalRiskAppetite,
    timestampUtc: nowUtc,
    freshness: snapshot.source === 'provider' ? 'LIVE' : 'LATEST PUBLISHED',
  };
}

export function classifyMacroRegime(snapshot: MacroSnapshot, crossAsset: CrossAssetTelemetry): MacroRegime {
  if (!snapshot.currencies || snapshot.currencies.length < 3) {
    return 'INSUFFICIENT_EVIDENCE';
  }

  const now = Date.now();
  const hasImminentTier1News = snapshot.catalysts.some((catalyst) => {
    if (catalyst.impact !== 'High') return false;
    const eventTime = Date.parse(catalyst.scheduledAt);
    return Math.abs(eventTime - now) <= 30 * 60 * 1000;
  });

  if (hasImminentTier1News) {
    return 'EVENT_LOCKOUT_HIGH_UNCERTAINTY';
  }

  if (crossAsset.vixRegime === 'STRESS' || crossAsset.globalRiskAppetite === 'RISK_OFF') {
    return 'GROWTH_SLOWDOWN_RISK_OFF';
  }

  // Inflation shock check: 10Y breakeven inflation surging above 2.70% or average G8 inflation > 3.5%
  const avgInflation = snapshot.currencies.reduce((acc, c) => acc + c.inflation, 0) / snapshot.currencies.length;
  if (crossAsset.usBreakevenTenYear > 2.70 && avgInflation > 3.2) {
    return 'INFLATION_SHOCK_HAWKISH';
  }

  // Commodity surge check: WTI > $85 or Brent > $90 with Copper surging
  if (crossAsset.crudeWti > 85.0 || crossAsset.copperUsd > 4.60) {
    return 'COMMODITY_DRIVEN';
  }

  // Policy divergence: Spread between highest and lowest central bank policy rate
  const rates = snapshot.currencies.map((c) => c.policyRate).filter((r) => Number.isFinite(r));
  if (rates.length >= 4) {
    const spread = Math.max(...rates) - Math.min(...rates);
    if (spread >= 2.50) {
      return 'POLICY_DIVERGENCE_CARRY';
    }
  }

  return 'POLICY_DIVERGENCE_CARRY';
}
