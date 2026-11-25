import { NextResponse } from 'next/server';
import { buildGoldMacroContext } from '@/lib/macro/goldAndRegimeEngine';
import { getMacroSnapshot } from '@/lib/macroEngine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const snapshot = await getMacroSnapshot();
    const context = await buildGoldMacroContext(snapshot);
    return NextResponse.json(context, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    console.error('Gold macro context refresh failed:', error);
    return NextResponse.json({
      generatedAtUtc: new Date().toISOString(),
      overallState: 'UNAVAILABLE',
      directionalVerdict: 'INSUFFICIENT_EVIDENCE',
      goldBiasScore: null,
      evidenceCoveragePct: 0,
      error: 'Gold macro context is temporarily unavailable.',
    }, { status: 503, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  }
}
