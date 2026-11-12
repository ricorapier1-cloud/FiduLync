import { NextResponse } from 'next/server';
import { getCurrencyStrengthIndex } from '@/lib/currencyStrength';
import { getTopExecutablePair, isRolloverActive } from '@/lib/institutionalGuards';
import { getMacroSnapshot } from '@/lib/macroEngine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const snapshot = await getMacroSnapshot();
    const top = getTopExecutablePair(getCurrencyStrengthIndex(snapshot));
    const rollover = isRolloverActive();

    return NextResponse.json(
      {
        top_executable_pair: top.pair,
        recommended_direction: top.direction,
        csi_spread: top.spread,
        base_currency: top.base,
        quote_currency: top.quote,
        excluded_illiquid: ['NOK', 'SEK'],
        rollover_blackout: rollover,
        safe_to_trade: !rollover && top.spread >= 60,
        timestamp_utc: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' } }
    );
  } catch (error) {
    console.error('Top pairs request failed:', error);
    return NextResponse.json(
      { error: 'Top pair data is temporarily unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store, max-age=0' } }
    );
  }
}
