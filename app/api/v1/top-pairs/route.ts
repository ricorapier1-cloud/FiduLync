import { NextResponse } from 'next/server';
import { getCurrencyStrengthIndex } from '@/lib/currencyStrength';
import { getTopRelativeValueCandidate, isRolloverActive } from '@/lib/institutionalGuards';
import { getMacroSnapshot } from '@/lib/macroEngine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const snapshot = await getMacroSnapshot();
    const candidate = snapshot.source === 'fallback'
      ? null
      : getTopRelativeValueCandidate(getCurrencyStrengthIndex(snapshot));
    const rollover = isRolloverActive();

    return NextResponse.json({
      candidate,
      candidate_status: candidate ? 'MACRO_RESEARCH_CANDIDATE' : 'UNAVAILABLE',
      macro_source: snapshot.source,
      macro_as_of: snapshot.asOf || null,
      rollover_watch_active: rollover,
      execution_eligibility: 'NOT_EVALUATED',
      reason: 'Relative macro strength is research context only. This endpoint does not validate broker quotes, technical structure, spreads, account exposure, margin or trade risk.',
      timestamp_utc: new Date().toISOString(),
    }, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch (error) {
    console.error('Top macro candidate request failed:', error);
    return NextResponse.json(
      { error: 'Macro relative-value research is temporarily unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store, max-age=0' } }
    );
  }
}
