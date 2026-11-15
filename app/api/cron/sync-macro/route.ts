import { NextResponse } from 'next/server';
import { getMacroSnapshot } from '@/lib/macroEngine';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization') ?? '';
  const cronSecret = process.env.CRON_SECRET?.trim() ?? '';

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized cron execution' }, { status: 401 });
  }

  const timestamp = new Date().toISOString();

  try {
    const snapshot = await getMacroSnapshot(true);
    return NextResponse.json({
      status: 'success',
      message: 'Macro telemetry synchronized successfully in background',
      source: snapshot.source,
      currenciesCount: snapshot.currencies.length,
      provenance: snapshot.currencies.length >= 11 ? 'LIVE' : 'PARTIAL',
      timestamp,
    }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Telemetry sync warning';
    return NextResponse.json({
      status: 'success_with_fallback',
      warning: message,
      timestamp,
    }, { status: 200 });
  }
}
