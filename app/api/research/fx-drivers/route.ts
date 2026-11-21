import { NextResponse } from 'next/server';
import { assessFxDrivers, type FxDriverObservation, type FxTechnicalConfirmation } from '@/lib/forexResearchEngine';
import { getTechnicalSignal } from '@/lib/technicalEngine';

export const dynamic = 'force-dynamic';

const ALLOWED_PAIRS = new Set([
  'EURUSD', 'USDJPY', 'GBPUSD', 'AUDUSD', 'NZDUSD',
  'USDCAD', 'USDCHF', 'EURJPY', 'GBPJPY', 'AUDJPY', 'XAUUSD',
]);

/**
 * Institutional FX research endpoint.
 *
 * The current provider set does not yet supply release-timestamped policy-path
 * repricing, matched-maturity real-yield histories, consensus surprise vintages,
 * a validated terms-of-trade model, COT publication timestamps, pair-calibrated
 * risk betas, or cross-currency funding basis. Therefore no macro factor is
 * fabricated or inferred from a proxy. The engine is called with the verified
 * evidence actually available (currently none of those seven factor classes).
 * This intentionally returns NO_SETUP until the evidence adapters are complete.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pair = (searchParams.get('pair') ?? '').toUpperCase();
  if (!ALLOWED_PAIRS.has(pair)) {
    return NextResponse.json({ error: 'Unsupported research pair.' }, { status: 400 });
  }

  const technical = await getTechnicalSignal(pair);
  const factors: FxDriverObservation[] = [];
  const confirmation: FxTechnicalConfirmation = {
    trendZ: technical.available ? technical.gaussian_z_score : null,
    // R-squared is a fit statistic, not a standardized structure z-score.
    // Keep structure and execution-cost inputs unavailable until properly measured.
    structureZ: null,
    volatilityPercentile: null,
    spreadToAtr: null,
    closedBarVerified: Boolean(
      technical.available
      && technical.latest_candle_at
      && Number.isFinite(Date.parse(technical.latest_candle_at))
      && Date.parse(technical.latest_candle_at) <= Date.now(),
    ),
  };
  const assessment = assessFxDrivers(pair, factors, confirmation, new Date().toISOString());

  return NextResponse.json({
    assessment,
    technical: {
      available: technical.available,
      source: technical.data_source,
      latestClosedBarAt: technical.latest_candle_at,
      candleCounts: technical.candle_counts,
      regime: technical.regime,
    },
    evidence: {
      suppliedFactorCount: factors.length,
      requiredFactorClasses: 7,
      unavailable: [
        { category: 'RATE_PATH_REPRICING', reason: 'No point-in-time OIS or policy-futures path history is connected.' },
        { category: 'REAL_YIELD_DIFFERENTIAL', reason: 'No matched-maturity, cross-currency real-yield time series is connected.' },
        { category: 'MACRO_SURPRISE', reason: 'No release-timestamped consensus, actual, and historical-vintage surprise series is connected.' },
        { category: 'TERMS_OF_TRADE', reason: 'No validated pair-specific terms-of-trade model is connected.' },
        { category: 'POSITIONING', reason: 'COT observation dates are available, but the release timestamp needed for point-in-time use is not preserved.' },
        { category: 'RISK_SENTIMENT', reason: 'No pair-calibrated risk-beta model with point-in-time inputs is validated.' },
        { category: 'FUNDING_STRESS', reason: 'No FX swap-point, cross-currency-basis, or equivalent funding-stress feed is connected.' },
      ],
      technicalBlockers: [
        'A standardized market-structure score is not yet produced.',
        'A verified volatility percentile and broker spread-to-ATR measurement are not yet joined.',
      ],
    },
    researchOnly: true,
    executionEnabled: false,
    asOf: assessment.asOf,
  }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
