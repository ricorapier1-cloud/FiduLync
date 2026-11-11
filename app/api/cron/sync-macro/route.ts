import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getMacroSnapshot } from '@/lib/macroData';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

export const dynamic = 'force-dynamic';

function isAuthorized(request: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  const provided = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!expected || !provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json({ error: 'Macro sync is not configured.' }, { status: 503 });
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const snapshot = await getMacroSnapshot(true);
    if (snapshot.cotSource !== 'provider') {
      return NextResponse.json({ error: 'No live CFTC/COT data was returned; stored snapshot was not changed.' }, { status: 503 });
    }
    const { error } = await getSupabaseAdmin().from('macro_snapshots').upsert({
      snapshot_key: 'global',
      payload: snapshot,
      refreshed_at: snapshot.asOf,
    }, { onConflict: 'snapshot_key' });
    if (error) throw error;
    return NextResponse.json({ status: 'success', source: snapshot.source, refreshedAt: snapshot.asOf });
  } catch (error) {
    console.error('Scheduled macro refresh failed:', error);
    return NextResponse.json({ error: 'Macro refresh failed.' }, { status: 503 });
  }
}