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
    const hasLiveMacroData = snapshot.source === 'provider' || snapshot.source === 'partial';
    const hasLiveCalendar = snapshot.calendarSource === 'provider';
    const provenance = !hasLiveMacroData
      ? 'REFERENCE_FALLBACK'
      : hasLiveCalendar
        ? 'LIVE_PROVIDER'
        : 'LIVE_MACRO_CALENDAR_UNAVAILABLE';
    const status = !hasLiveMacroData
      ? 'degraded'
      : snapshot.source === 'partial' || !hasLiveCalendar
        ? 'partial'
        : 'success';

    if (!hasLiveMacroData) {
      return NextResponse.json({
        status,
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
      status,
      message: status === 'partial'
        ? 'Live macro observations refreshed. The economic calendar remains unavailable or incomplete.'
        : 'Live macro observations refreshed with a verified provider calendar.',
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
