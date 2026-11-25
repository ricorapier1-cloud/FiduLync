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
};

function isFresh(date: string | undefined, maxAgeDays: number): boolean {
  if (!date) return false;
  const timestamp = Date.parse(date);
  const age = Date.now() - timestamp;
  return Number.isFinite(timestamp) && age >= -5 * 60_000 && age <= maxAgeDays * 86_400_000;
}

function readiness(calendarVerified: boolean, eventLockout: boolean): Candidate['tradeReadiness'] {
  if (eventLockout) return 'BLOCKED_EVENT_LOCKOUT';
  return calendarVerified ? 'AWAIT_TECHNICAL_CONFIRMATION' : 'BLOCKED_CALENDAR_UNAVAILABLE';
}

export async function GET() {
  try {
    const [snapshot, gold] = await Promise.all([getMacroSnapshot(), buildGoldMacroContext()]);
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
        const optional = [
          dossier.twoYearYieldDiffBps !== null,
          Boolean(snapshot.cot.find((item) => item.market === dossier.base) && snapshot.cot.find((item) => item.market === dossier.quote)),
        ];
        return {
          symbol: dossier.symbol,
          direction: dossier.fundamentalBias.includes('BULLISH') ? 'BUY' : 'SELL',
          macroScore: dossier.biasScore,
          confidence: dossier.confidence === 'HIGH' ? 'HIGH' : 'MODERATE',
          evidenceCoveragePct: Math.round((essential.filter(Boolean).length + optional.filter(Boolean).length) / 6 * 100),
          regime: dossier.macroRegime,
          supportingEvidence: dossier.supportingEvidence.filter((item) => !item.startsWith('No verified')).slice(0, 3),
          contradictingEvidence: dossier.contradictingEvidence.filter((item) => !item.startsWith('No verified')).slice(0, 2),
          nextCatalyst: dossier.nextCatalyst,
          eventRiskLockout: dossier.eventRiskLockout,
          eventRiskVerified: snapshot.calendarSource === 'provider',
          tradeReadiness: readiness(snapshot.calendarSource === 'provider', dossier.eventRiskLockout),
        };
      });

    const goldEventLockout = snapshot.catalysts.some((event) => event.impact === 'High'
      && event.region === 'US' && Math.abs(Date.parse(event.scheduledAt) - Date.now()) <= 30 * 60 * 1000);
    const nextGoldEvent = snapshot.catalysts.filter((event) => event.region === 'US' && Date.parse(event.scheduledAt) >= Date.now())
      .sort((left, right) => Date.parse(left.scheduledAt) - Date.parse(right.scheduledAt))[0];
    const goldCandidate: Omit<Candidate, 'rank'> | null = gold.overallState === 'AVAILABLE'
      && gold.goldBiasScore !== null && Math.abs(gold.goldBiasScore) >= 20
      && (gold.directionalVerdict === 'BULLISH' || gold.directionalVerdict === 'BEARISH')
      ? {
        symbol: 'XAUUSD',
        direction: gold.directionalVerdict === 'BULLISH' ? 'BUY' : 'SELL',
        macroScore: gold.goldBiasScore,
        confidence: gold.evidenceCoveragePct >= 100 ? 'MODERATE' : 'LOW',
        evidenceCoveragePct: gold.evidenceCoveragePct,
        regime: gold.liquidityRegime,
        supportingEvidence: gold.supportingEvidence.slice(0, 3),
        contradictingEvidence: gold.contradictingEvidence.slice(0, 2),
        nextCatalyst: nextGoldEvent ? { title: nextGoldEvent.title, scheduledAt: nextGoldEvent.scheduledAt, impact: nextGoldEvent.impact } : null,
        eventRiskLockout: goldEventLockout,
        eventRiskVerified: snapshot.calendarSource === 'provider',
        tradeReadiness: readiness(snapshot.calendarSource === 'provider', goldEventLockout),
      } : null;

    const candidates = [...fx, ...(goldCandidate ? [goldCandidate] : [])].map((candidate, index) => ({ ...candidate, rank: index + 1 }));
    return NextResponse.json({
      schemaVersion: '1.1.0',
      generatedAtUtc: new Date().toISOString(),
      snapshotAsOfUtc: snapshot.asOf,
      dataSourceState: snapshot.source,
      status: candidates.length ? 'CANDIDATES_AVAILABLE' : 'NO_QUALIFIED_CANDIDATES',
      candidates,
      methodology: 'Screens the supported G8 FX cross universe and independent XAU/USD macro engine. FX candidates require fresh provider policy and inflation evidence; COT and yield inputs increase evidence coverage. Gold uses official Treasury history, CBOE VIX, CFTC positioning and optional approved FRED credit-spread evidence. Scores rank relative macro evidence; they are not calibrated win probabilities.',
      disclaimer: 'Research shortlist only. A candidate is not an entry signal. Verify event risk, broker quotes, technical structure, spread, session and EA-enforced account risk before any trade.',
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    console.error('Macro opportunity ranking failed:', error);
    return NextResponse.json({ status: 'UNAVAILABLE', candidates: [], error: 'Macro opportunity ranking is temporarily unavailable.' }, {
      status: 503, headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  }
}
