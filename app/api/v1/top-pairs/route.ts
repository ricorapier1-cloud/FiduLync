import { NextResponse } from 'next/server';
import { getMacroSnapshot } from '@/lib/macroEngine';
import { generatePairDossier } from '@/lib/macro/dossierEngine';

const SCREENED_PAIRS = ['EURUSD', 'USDJPY', 'GBPUSD', 'AUDUSD', 'NZDUSD', 'USDCAD', 'USDCHF', 'EURJPY', 'GBPJPY', 'AUDJPY'] as const;

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const snapshot = await getMacroSnapshot();
    const candidates = SCREENED_PAIRS
      .map((symbol) => generatePairDossier(snapshot, symbol))
      .filter((dossier) =>
        (dossier.confidence === 'HIGH' || dossier.confidence === 'MODERATE')
        && Math.abs(dossier.biasScore) >= 20
        && dossier.macroRegime !== 'INSUFFICIENT_EVIDENCE'
        && snapshot.calendarSource === 'provider'
        && !dossier.eventRiskLockout
      )
      .sort((left, right) => {
        const confidenceRank = (value: string) => value === 'HIGH' ? 2 : value === 'MODERATE' ? 1 : 0;
        return confidenceRank(right.confidence) - confidenceRank(left.confidence)
          || Math.abs(right.biasScore) - Math.abs(left.biasScore);
      })
      .slice(0, 5)
      .map((dossier, index) => ({
        rank: index + 1,
        symbol: dossier.symbol,
        direction: dossier.fundamentalBias.includes('BULLISH') ? 'BUY' : 'SELL',
        macroScore: dossier.biasScore,
        confidence: dossier.confidence,
        regime: dossier.macroRegime,
        supportingEvidence: dossier.supportingEvidence.filter((item) => !item.startsWith('No verified')).slice(0, 3),
        contradictingEvidence: dossier.contradictingEvidence.filter((item) => !item.startsWith('No verified')).slice(0, 2),
        nextCatalyst: dossier.nextCatalyst,
        eventRiskLockout: dossier.eventRiskLockout,
        eventRiskVerified: true,
      }));

    return NextResponse.json({
      schemaVersion: '1.0.0',
      generatedAtUtc: new Date().toISOString(),
      snapshotAsOfUtc: snapshot.asOf,
      dataSourceState: snapshot.source,
      status: candidates.length ? 'CANDIDATES_AVAILABLE' : 'NO_QUALIFIED_CANDIDATES',
      candidates,
      methodology: 'Provider-sourced policy and inflation observations, freshness-gated yield differentials, a verified provider calendar and recent CFTC positioning where available. Rank is a relative macro score, not a calibrated win probability or trade signal.',
      disclaimer: 'Research shortlist only. Confirm live broker quotes, technical structure, event risk and EA risk controls before any trade.',
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    console.error('Macro opportunity ranking failed:', error);
    return NextResponse.json({
      status: 'UNAVAILABLE',
      candidates: [],
      error: 'Macro opportunity ranking is temporarily unavailable.',
    }, { status: 503, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  }
}
