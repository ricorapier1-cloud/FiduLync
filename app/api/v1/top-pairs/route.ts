import { NextResponse } from 'next/server';
import * as sourceMod from '@/lib/currencyStrength';
import { getTopExecutablePair, isRolloverActive } from '@/lib/institutionalGuards';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const loader = (sourceMod as Record<string, unknown>)['getCurrencyStrengthIndex'];
    const rawData = typeof loader === 'function' ? await (loader as () => Promise<unknown>)() : [];
    const top = getTopExecutablePair(rawData);
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      {
        top_executable_pair: 'USDJPY',
        recommended_direction: 'LONG',
        rollover_blackout: isRolloverActive(),
        fallback: true,
        error: message,
      },
      { status: 200 }
    );
  }
}
