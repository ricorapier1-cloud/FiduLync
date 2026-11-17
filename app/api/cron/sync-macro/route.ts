import { NextResponse } from 'next/server';
import { getMacroSnapshot } from '@/lib/macroEngine';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization') ?? '';
  const cronSecret = process.env.CRON_SECRET?.trim() ?? '';

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized cron execution' }, { status: 401 });
  }

  const timestamp = new Date().toISOString();

  try {
    const snapshot = await getMacroSnapshot(true);
    const isFallbackOnly = snapshot.source === 'fallback';
    const provenance = snapshot.source === 'provider' && snapshot.calendarSource === 'provider'
      ? 'LIVE_PROVIDER'
      : snapshot.source === 'partial'
        ? 'PARTIAL_LIVE'
        : 'REFERENCE_FALLBACK';

    if (isFallbackOnly) {
      return NextResponse.json({
        status: 'degraded',
        message: 'No live macro provider data was available; reference values were not represented as live.',
        source: snapshot.source,
        calendarSource: snapshot.calendarSource,
        cotSource: snapshot.cotSource,
        currenciesCount: snapshot.currencies.length,
        provenance,
        timestamp,
      }, { status: 503 });
    }

    return NextResponse.json({
      status: 'success',
      message: 'Macro telemetry refresh completed.',
      source: snapshot.source,
      calendarSource: snapshot.calendarSource,
      cotSource: snapshot.cotSource,
      currenciesCount: snapshot.currencies.length,
      provenance,
      timestamp,
    }, { status: 200 });
  } catch (error) {
    console.error('Macro telemetry sync failed:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Macro telemetry synchronization failed.',
      timestamp,
    }, { status: 503 });
  }
}
