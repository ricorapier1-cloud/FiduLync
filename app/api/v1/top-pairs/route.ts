import { NextResponse } from 'next/server';
import { getMacroSnapshot } from '@/lib/macroEngine';
import { G8_PAIRS, generatePairDossier } from '@/lib/macro/dossierEngine';
import { buildGoldMacroContext } from '@/lib/macro/goldAndRegimeEngine';

export const dynamic = 'force-dynamic';

type Candidate = {
  rank: number;
  symbol: string;
  direction: 'BUY' | 'SELL';
  macroScore: number;
  confidence: 'HIGH' | 'MODERATE' | 'LOW';
  evidenceCoveragePct: number;
  regime: string;
  supportingEvidence: string[];
  contradictingEvidence: string[];
  nextCatalyst: { title: string; scheduledAt: string; impact: 'High' | 'Medium' } | null;
  eventRiskLockout: boolean;
  eventRiskVerified: boolean;
  tradeReadiness: 'AWAIT_TECHNICAL_CONFIRMATION' | 'BLOCKED_CALENDAR_UNAVAILABLE' | 'BLOCKED_EVENT_LOCKOUT';
  uncrowded: boolean;
  baseCrowdingPercentile: number | null;
  quoteCrowdingPercentile: number | null;
};

function isFresh(date: string | undefined, maxAgeDays: number): boolean {
  if (!date) return false;
  const timestamp = Date.parse(date);
  const age = Date.now() - timestamp;
  return Number.isFinite(timestamp) && age >= -5 * 60_000 && age <= maxAgeDays * 86_400_000;
}

function readiness(calendarVerified: boolean, eventLockout: boolean): Candidate['tradeReadiness'] {
  if (!calendarVerified) return 'BLOCKED_CALENDAR_UNAVAILABLE';
  if (eventLockout) return 'BLOCKED_EVENT_LOCKOUT';
  return 'AWAIT_TECHNICAL_CONFIRMATION';
}

export async function GET() {
  try {
    const snapshot = await getMacroSnapshot();
    const calendarRetrievedAtMs = snapshot.calendarRetrievedAtUtc ? Date.parse(snapshot.calendarRetrievedAtUtc) : NaN;
    const calendarCoverageEndMs = snapshot.calendarCoverageEndUtc ? Date.parse(snapshot.calendarCoverageEndUtc) : NaN;
    const calendarVerified = snapshot.calendarSource === 'provider' && Boolean(snapshot.calendarProvider)
      && Number.isFinite(calendarRetrievedAtMs) && Date.now() - calendarRetrievedAtMs <= 60 * 60_000
      && Date.now() - calendarRetrievedAtMs >= -30_000
      && Number.isFinite(calendarCoverageEndMs) && calendarCoverageEndMs >= Date.now() + 24 * 60 * 60_000;
    const highImpactEvents = calendarVerified ? snapshot.catalysts.filter((event) => event.impact === 'High') : [];
    const gold = await buildGoldMacroContext(snapshot).catch((error) => {
      console.warn('Gold opportunity input unavailable; continuing with FX candidates:', error);
      return null;
    });
    const fx = G8_PAIRS.filter((symbol) => symbol !== 'XAUUSD')
      .map((symbol) => generatePairDossier(snapshot, symbol))
      .filter((dossier) => (dossier.confidence === 'HIGH' || dossier.confidence === 'MODERATE')
        && Math.abs(dossier.biasScore) >= 20
        && dossier.macroRegime !== 'INSUFFICIENT_EVIDENCE')
      .sort((left, right) => {
        const rank = (value: string) => value === 'HIGH' ? 2 : value === 'MODERATE' ? 1 : 0;
        return rank(right.confidence) - rank(left.confidence) || Math.abs(right.biasScore) - Math.abs(left.biasScore);
      })
      .slice(0, 5)
      .map((dossier): Omit<Candidate, 'rank'> => {
        const base = snapshot.currencies.find((item) => item.code === dossier.base);
        const quote = snapshot.currencies.find((item) => item.code === dossier.quote);
        const essential = [
          base?.policyRateSource === 'provider' && isFresh(base.policyRateObservationDate, 180),
          base?.inflationSource === 'provider' && isFresh(base.inflationObservationDate, dossier.base === 'AUD' ? 180 : 120),
          quote?.policyRateSource === 'provider' && isFresh(quote.policyRateObservationDate, 180),
          quote?.inflationSource === 'provider' && isFresh(quote.inflationObservationDate, dossier.quote === 'AUD' ? 180 : 120),
        ];
        const baseCotPosition = snapshot.cot.find((item) => item.market === dossier.base && item.sampleSize !== undefined
          && item.sampleSize >= 52 && item.percentile !== null && isFresh(item.reportDate, 14));
        const quoteCotPosition = snapshot.cot.find((item) => item.market === dossier.quote && item.sampleSize !== undefined
          && item.sampleSize >= 52 && item.percentile !== null && isFresh(item.reportDate, 14));
        const hasFreshBaseCot = Boolean(baseCotPosition);
        const hasFreshQuoteCot = Boolean(quoteCotPosition);
        const baseCrowdingPercentile = baseCotPosition?.percentile ?? null;
        const quoteCrowdingPercentile = quoteCotPosition?.percentile ?? null;
        const uncrowded = baseCrowdingPercentile !== null && quoteCrowdingPercentile !== null
          && baseCrowdingPercentile > 10 && baseCrowdingPercentile < 90
          && quoteCrowdingPercentile > 10 && quoteCrowdingPercentile < 90;
        const optional = [dossier.twoYearYieldDiffBps !== null, hasFreshBaseCot && hasFreshQuoteCot];
        return {
          symbol: dossier.symbol,
          uncrowded,
          baseCrowdingPercentile,
          quoteCrowdingPercentile,
          direction: dossier.fundamentalBias.includes('BULLISH') ? 'BUY' : 'SELL',
          macroScore: dossier.biasScore,
          confidence: dossier.confidence === 'HIGH' ? 'HIGH' : 'MODERATE',
          evidenceCoveragePct: Math.round((essential.filter(Boolean).length + optional.filter(Boolean).length) / 6 * 100),
          regime: dossier.macroRegime,
          supportingEvidence: dossier.supportingEvidence.filter((item) => !item.startsWith('No verified')).slice(0, 3),
          contradictingEvidence: dossier.contradictingEvidence.filter((item) => !item.startsWith('No verified')).slice(0, 2),
          nextCatalyst: dossier.nextCatalyst,
          eventRiskLockout: dossier.eventRiskLockout,
          eventRiskVerified: calendarVerified,
          tradeReadiness: readiness(calendarVerified, dossier.eventRiskLockout),
        };
      });

    const goldEventLockout = !calendarVerified || highImpactEvents.some((event) =>
      Math.abs(Date.parse(event.scheduledAt) - Date.now()) <= 30 * 60 * 1000);
    const nextGoldEvent = highImpactEvents.filter((event) => Date.parse(event.scheduledAt) >= Date.now())
      .sort((left, right) => Date.parse(left.scheduledAt) - Date.parse(right.scheduledAt))[0];
    const goldCandidate: Omit<Candidate, 'rank'> | null = gold && gold.overallState === 'AVAILABLE'
      && gold.goldBiasScore !== null && Math.abs(gold.goldBiasScore) >= 20
      && (gold.directionalVerdict === 'BULLISH' || gold.directionalVerdict === 'BEARISH')
      ? {
        symbol: 'XAUUSD',
        uncrowded: false,
        baseCrowdingPercentile: null,
        quoteCrowdingPercentile: null,
        direction: gold.directionalVerdict === 'BULLISH' ? 'BUY' : 'SELL',
        macroScore: gold.goldBiasScore,
        confidence: gold.evidenceCoveragePct >= 80 ? 'MODERATE' : 'LOW',
        evidenceCoveragePct: gold.evidenceCoveragePct,
        regime: gold.liquidityRegime,
        supportingEvidence: gold.supportingEvidence.slice(0, 3),
        contradictingEvidence: gold.contradictingEvidence.slice(0, 2),
        nextCatalyst: nextGoldEvent ? { title: nextGoldEvent.title, scheduledAt: nextGoldEvent.scheduledAt, impact: nextGoldEvent.impact } : null,
        eventRiskLockout: goldEventLockout,
        eventRiskVerified: calendarVerified,
        tradeReadiness: readiness(calendarVerified, goldEventLockout),
      } : null;

    // Reserve one slot for independently evidenced XAU/USD whenever its
    // dedicated gold engine has sufficient coverage; rank all shown candidates
    // by evidence confidence and directional magnitude.
    const shortlist = [...fx.slice(0, goldCandidate ? 4 : 5), ...(goldCandidate ? [goldCandidate] : [])]
      .sort((left, right) => {
        const rank = (value: Candidate['confidence']) => value === 'HIGH' ? 3 : value === 'MODERATE' ? 2 : 1;
        return rank(right.confidence) - rank(left.confidence)
          || Math.abs(right.macroScore) - Math.abs(left.macroScore)
          || right.evidenceCoveragePct - left.evidenceCoveragePct;
      })
      .slice(0, 5);
    const candidates = shortlist.map((candidate, index) => ({ ...candidate, rank: index + 1 }));
    return NextResponse.json({
      schemaVersion: '1.1.0',
      generatedAtUtc: new Date().toISOString(),
      snapshotAsOfUtc: snapshot.asOf,
      dataSourceState: snapshot.source,
      status: candidates.length ? 'CANDIDATES_AVAILABLE' : 'NO_QUALIFIED_CANDIDATES',
      candidates,
      methodology: 'Screens the supported G8 FX cross universe and independent XAU/USD macro engine. FX candidates require fresh provider policy and inflation evidence; COT and yield inputs increase evidence coverage. Gold uses official Treasury history, CBOE VIX, CFTC positioning and optional approved FRED credit-spread evidence. Scores rank relative macro evidence; they are not a calibrated win probability.',
      disclaimer: 'Research shortlist only. A candidate is not an entry signal. Verify event risk, broker quotes, technical structure, spread, session and EA-enforced account risk before any trade.',
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    console.error('Macro opportunity ranking failed:', error);
    return NextResponse.json({ status: 'UNAVAILABLE', candidates: [], error: 'Macro opportunity ranking is temporarily unavailable.' }, {
      status: 503, headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  }
}
