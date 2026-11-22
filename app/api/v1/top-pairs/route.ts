import { NextResponse } from 'next/server';
import { getCurrencyStrengthIndex } from '@/lib/currencyStrength';
import { isRolloverActive } from '@/lib/institutionalGuards';
import { getMacroSnapshot } from '@/lib/macroEngine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const snapshot = await getMacroSnapshot();
    const csi = getCurrencyStrengthIndex(snapshot);
    const sorted = [...csi].sort((a, b) => b.score - a.score);
    const strongest = sorted[0];
    const weakest = sorted[sorted.length - 1];

    const pair = `${strongest?.currency ?? 'USD'}${weakest?.currency ?? 'JPY'}`;
    const spread = (strongest?.score ?? 0) - (weakest?.score ?? 0);
    const rollover = isRolloverActive();

    return NextResponse.json(
      {
        divergence_pair: pair,
        strong_currency: strongest?.currency ?? 'USD',
        weak_currency: weakest?.currency ?? 'JPY',
        macro_spread: spread,
        rollover_window_active: rollover,
        timestamp_utc: new Date().toISOString(),
        disclaimer: 'Macroeconomic relative divergence context only. Not an order execution signal.',
      },
      { headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' } }
    );
  } catch (error) {
    console.error('Top pairs request failed:', error);
    return NextResponse.json(
      { error: 'Macro divergence pair data is temporarily unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store, max-age=0' } }
    );
  }
}
