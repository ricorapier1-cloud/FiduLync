import type {
  ConfidenceLevel,
  FundamentalBias,
  
  MacroSnapshot,
  PairDossier,
} from '@/types/macro';
import { getCrossAssetTelemetry, classifyMacroRegime } from '@/lib/macro/crossAssetEngine';
import { getCountryProfiles } from '@/lib/macro/countryProfiles';

export const G8_PAIRS = [
  'EURUSD', 'USDJPY', 'GBPUSD', 'AUDUSD', 'NZDUSD', 'USDCAD', 'USDCHF',
  'EURJPY', 'GBPJPY', 'AUDJPY', 'CADJPY', 'CHFJPY', 'NZDJPY',
  'EURGBP', 'EURAUD', 'EURCAD', 'EURCHF', 'EURNZD',
  'GBPAUD', 'GBPCAD', 'GBPCHF', 'GBPNZD',
  'AUDCAD', 'AUDCHF', 'AUDNZD',
  'CADCHF', 'NZDCAD', 'NZDCHF',
  'XAUUSD',
] as const;

function isFreshObservation(date: string | undefined, maxAgeDays: number): boolean {
  if (!date) return false;
  const timestamp = Date.parse(date);
  const age = Date.now() - timestamp;
  return Number.isFinite(timestamp) && age >= -5 * 60_000 && age <= maxAgeDays * 86_400_000;
}

function inflationFreshnessDays(currencyCode: string): number {
  return currencyCode === 'AUD' ? 180 : 120;
}

export function generatePairDossier(snapshot: MacroSnapshot, symbol: string): PairDossier {
  const normSymbol = symbol.trim().toUpperCase();
  const isGold = normSymbol === 'XAUUSD';
  const base = isGold ? 'XAU' : normSymbol.slice(0, 3);
  const quote = isGold ? 'USD' : normSymbol.slice(3, 6);

  const crossAsset = getCrossAssetTelemetry(snapshot);
  const macroRegime = classifyMacroRegime(snapshot, crossAsset);
  const profiles = getCountryProfiles(snapshot);

  const baseProfile = isGold ? null : profiles.find((p) => p.currency === base);
  const quoteProfile = profiles.find((p) => p.currency === quote);

  const baseCcy = snapshot.currencies.find((c) => c.code === base);
  const quoteCcy = snapshot.currencies.find((c) => c.code === quote);
  const baseCot = snapshot.cot.find((c) => c.market === (isGold ? 'GOLD' : base));
  const quoteCot = snapshot.cot.find((c) => c.market === quote);

  // Missing data detection and penalty
  let missingComponents = 0;
  if (!quoteCcy) missingComponents += 2;
  if (!isGold && !baseCcy) missingComponents += 2;
  if (!baseCot) missingComponents += 1;
  if (!quoteCot) missingComponents += 1;

  const quoteVerified = quoteCcy?.policyRateSource === 'provider' && quoteCcy.inflationSource === 'provider'
    && isFreshObservation(quoteCcy.policyRateObservationDate, 180)
    && isFreshObservation(quoteCcy.inflationObservationDate, inflationFreshnessDays(quoteCcy.code));
  const baseVerified = isGold
    ? false
    : baseCcy?.policyRateSource === 'provider' && baseCcy.inflationSource === 'provider'
      && isFreshObservation(baseCcy.policyRateObservationDate, 180)
      && isFreshObservation(baseCcy.inflationObservationDate, inflationFreshnessDays(baseCcy.code));
  const essentialEvidenceVerified = quoteVerified && baseVerified;
  let confidence: ConfidenceLevel = 'INSUFFICIENT_EVIDENCE';
  if (essentialEvidenceVerified && missingComponents === 0) confidence = 'HIGH';
  else if (essentialEvidenceVerified && missingComponents <= 2) confidence = 'MODERATE';
  else if (essentialEvidenceVerified) confidence = 'LOW';

  // Rate differentials
  const basePolicy = isGold ? 0.0 : (baseCcy?.policyRate ?? 3.5);
  const quotePolicy = quoteCcy?.policyRate ?? 4.75;
  const policyDiffBps = essentialEvidenceVerified ? Math.round((basePolicy - quotePolicy) * 100) : 0;

  const baseInflation = isGold ? 0.0 : (baseCcy?.inflation ?? 2.5);
  const quoteInflation = quoteCcy?.inflation ?? 2.8;
  const baseReal = isGold ? -crossAsset.usTenYearRealYield : (basePolicy - baseInflation);
  const quoteReal = quotePolicy - quoteInflation;
  const realPolicyRateDiffBps = essentialEvidenceVerified ? Math.round((baseReal - quoteReal) * 100) : 0;

  const base2Y = !isGold && baseCcy?.twoYearYieldSource === 'provider' && isFreshObservation(baseCcy.twoYearYieldObservationDate, 60)
    ? baseCcy.twoYearYield ?? null : null;
  const quote2Y = quoteCcy?.twoYearYieldSource === 'provider' && isFreshObservation(quoteCcy.twoYearYieldObservationDate, 60)
    ? quoteCcy.twoYearYield ?? null : null;
  const twoYearYieldDiffBps = base2Y !== null && quote2Y !== null
    ? Math.round((base2Y - quote2Y) * 100)
    : null;

  const baseCotPct = baseCot?.percentile ?? 50;
  const quoteCotPct = quoteCot?.percentile ?? 50;
  const cotPercentileDiff = baseCot && quoteCot ? Math.round(baseCotPct - quoteCotPct) : 0;

  // Directional scoring uses only sourced policy, inflation, sovereign-yield and COT observations.
  // Country-profile baseline assumptions and hardcoded cross-asset constants are excluded.
  let rawScore = 0;
  if (essentialEvidenceVerified) {
    const policyImpact = (policyDiffBps / 100) * 14;
    const realYieldImpact = (realYieldDiffBps / 100) * 16;
    const twoYearImpact = twoYearYieldDiffBps === null ? 0 : (twoYearYieldDiffBps / 100) * 10;
    const cotImpact = (baseCot && quoteCot) ? (cotPercentileDiff / 100) * 12 : 0;
    rawScore = Math.round(policyImpact + realYieldImpact + twoYearImpact + cotImpact);
  }

  // Apply penalty factor for missing components
  const penaltyMultiplier = Math.max(0.2, 1.0 - (missingComponents * 0.18));
  const biasScore = Math.max(-100, Math.min(100, Math.round(rawScore * penaltyMultiplier)));

  let fundamentalBias: FundamentalBias = 'NEUTRAL';
  if (confidence === 'INSUFFICIENT_EVIDENCE') {
    fundamentalBias = 'NEUTRAL';
  } else if (biasScore >= 55) {
    fundamentalBias = 'STRONG_BULLISH';
  } else if (biasScore >= 20) {
    fundamentalBias = 'BULLISH';
  } else if (biasScore <= -55) {
    fundamentalBias = 'STRONG_BEARISH';
  } else if (biasScore <= -20) {
    fundamentalBias = 'BEARISH';
  }

  // Supporting and contradicting evidence
  const supporting: string[] = [];
  const contradicting: string[] = [];

  if (policyDiffBps > 0) {
    supporting.push(`Base currency holds a ${policyDiffBps} bps nominal policy rate premium.`);
  } else if (policyDiffBps < 0) {
    contradicting.push(`Base currency suffers a ${Math.abs(policyDiffBps)} bps nominal policy rate discount.`);
  }

  if (realYieldDiffBps > 0) {
    supporting.push(`Real interest rate differential favors base currency by ${realYieldDiffBps} bps.`);
  } else if (realYieldDiffBps < 0) {
    contradicting.push(`Real interest rate differential favors quote currency by ${Math.abs(realYieldDiffBps)} bps.`);
  }

  if (twoYearYieldDiffBps !== null) {
    if (twoYearYieldDiffBps > 0) {
      supporting.push(`2-Year sovereign bond yield spread confirms carry demand (+${twoYearYieldDiffBps} bps).`);
    } else {
      contradicting.push(`2-Year sovereign yield spread disfavors base currency (${twoYearYieldDiffBps} bps).`);
    }
  }

  if (baseCotPct > 75) {
    contradicting.push(`Speculative positioning on ${base} is crowded (${baseCotPct}%ile); vulnerable to unwind.`);
  } else if (baseCotPct < 25) {
    supporting.push(`Speculative short positioning on ${base} is exhausted (${baseCotPct}%ile); short-covering potential.`);
  }

  // Cross-asset confirmation
  const crossAssetConfirmation = 'UNAVAILABLE — verified cross-asset observations are not yet connected to this dossier.';

  // Upcoming catalysts
  const now = Date.now();
  const relevantRegions = new Set([base, quote, 'US', 'EU', 'UK', 'JP', 'CH', 'CA', 'AU', 'NZ']);
  const upcoming = snapshot.catalysts
    .filter((c) => relevantRegions.has(c.region) && Date.parse(c.scheduledAt) >= now)
    .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));

  const nextCatalyst = upcoming[0] ? {
    title: upcoming[0].title,
    scheduledAt: upcoming[0].scheduledAt,
    region: upcoming[0].region,
    impact: upcoming[0].impact,
    lockoutActive: Math.abs(Date.parse(upcoming[0].scheduledAt) - now) <= 30 * 60 * 1000,
  } : null;

  const eventRiskLockout = nextCatalyst?.lockoutActive ?? false;

  // Invalidation triggers
  const invalidationTriggers: string[] = [
    `Unexpected central bank policy rate change or forward guidance shift by ${baseProfile?.centralBank ?? base}.`,
    `Tier-1 inflation print diverging more than 40 bps from consensus for ${quoteProfile?.country ?? quote}.`,
    `Rapid expansion of sovereign yield curve spread violating the ${policyDiffBps} bps nominal threshold.`,
    `Global risk sentiment regime flipping to ${crossAsset.globalRiskAppetite === 'RISK_ON' ? 'STRESS / RISK-OFF' : 'RISK-ON'}.`,
  ];

  // Scenarios
  const bullProb = confidence === 'INSUFFICIENT_EVIDENCE' ? 0 : biasScore > 0 ? Math.min(75, 45 + Math.round(biasScore / 3)) : Math.max(15, 30 + Math.round(biasScore / 3));
  const bearProb = confidence === 'INSUFFICIENT_EVIDENCE' ? 0 : biasScore < 0 ? Math.min(75, 45 + Math.round(Math.abs(biasScore) / 3)) : Math.max(15, 30 - Math.round(biasScore / 3));
  const neutralProb = confidence === 'INSUFFICIENT_EVIDENCE' ? 0 : Math.max(15, 100 - bullProb - bearProb);

  const scenarios = {
    bullish: {
      probabilityPct: bullProb,
      title: `${base} Relative Strength Expansion`,
      catalysts: [
        `Central bank stance remains more restrictive than markets price.`,
        `Real yield differential expands in favor of ${base}.`,
      ],
    },
    bearish: {
      probabilityPct: bearProb,
      title: `${quote} Dominance / Carry Drawdown`,
      catalysts: [
        `Disinflation acceleration in ${base} prompts accelerated rate cuts.`,
        `Capital flight into ${quote} safe-haven or high-yield assets.`,
      ],
    },
    neutral: {
      probabilityPct: neutralProb,
      title: 'Range-Bound Equilibrium',
      catalysts: [
        `Central banks maintain balanced pause; no policy divergence catalyst.`,
        `Offsetting macro data releases prevent structural directional trend.`,
      ],
    },
  };

  const summary = confidence === 'INSUFFICIENT_EVIDENCE'
    ? 'INSUFFICIENT EVIDENCE — NO RELIABLE CONCLUSION. Both currencies require provider-sourced policy-rate and inflation observations before a directional macro assessment is permitted.'
    : `${normSymbol} fundamental bias is ${fundamentalBias.replace('_', ' ')} (${biasScore > 0 ? '+' : ''}${biasScore}/100) under the ${macroRegime.replace(/_/g, ' ')} regime with ${confidence} confidence.`;

  return {
    symbol: normSymbol,
    base,
    quote,
    macroRegime,
    fundamentalBias,
    biasScore,
    confidence,
    policyDiffBps,
    realYieldDiffBps,
    twoYearYieldDiffBps,
    cotPercentileDiff,
    crossAssetConfirmation,
    summary,
    supportingEvidence: supporting.length ? supporting : ['No verified supporting observations available.'],
    contradictingEvidence: contradicting.length ? contradicting : ['No verified contradicting observations available.'],
    scenarios,
    invalidationTriggers,
    nextCatalyst,
    eventRiskLockout,
  };
}
