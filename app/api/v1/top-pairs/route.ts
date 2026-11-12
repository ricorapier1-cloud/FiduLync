import { NextResponse } from 'next/server';
import { getCurrencyStrengthIndex } from '@/lib/currencyStrength';
import { getTopExecutablePair, isRolloverActive } from '@/lib/institutionalGuards';
import { getMacroSnapshot } from '@/lib/macroEngine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const snapshot = await getMacroSnapshot();
    const rankings = getCurrencyStrengthIndex(snapshot).map(({ currency, score }) => ({
      currency,
      score,
    }));
    const top = getTopExecutablePair(rankings);
    if (!top) {
      return NextResponse.json(
        { error: 'Currency strength inputs are unavailable.' },
        { status: 503, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
      );
    }
    const rollover = isRolloverActive();

    return NextResponse.json({
      top_executable_pair: top.pair,
      recommended_direction: top.direction,
      rollover_blackout: rollover,
      timestamp_utc: new Date().toISOString(),
    }, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch (error) {
    console.error('Top executable pair request failed:', error);
    return NextResponse.json(
      { error: 'Top executable pair is temporarily unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    );
  }
}
