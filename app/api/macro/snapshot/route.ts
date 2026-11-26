import { NextResponse } from 'next/server';
import { getMacroSnapshot } from '@/lib/macroEngine';
import { Redis } from '@upstash/redis';

export const dynamic = 'force-dynamic';

let lastLocalForceRefreshAt = 0;

async function consumeManualForceRefreshSlot(): Promise<boolean> {
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
    const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
    if (url && token) {
      const result = await Redis.fromEnv().set('macro:manual-force-refresh:v1', '1', { nx: true, ex: 60 });
      return result === 'OK';
    }
  } catch (error) {
    console.warn('Persistent macro refresh throttle unavailable; using per-instance fallback.', error);
  }
  const now = Date.now();
  if (now - lastLocalForceRefreshAt < 60_000) return false;
  lastLocalForceRefreshAt = now;
  return true;
}

export async function GET(request: Request) {
  const forceRefresh = new URL(request.url).searchParams.get('force') === 'true';
  if (forceRefresh && !(await consumeManualForceRefreshSlot())) {
    return NextResponse.json({ error: 'Manual macro refresh is throttled. Retry in 60 seconds.' }, {
      status: 429,
      headers: { 'Cache-Control': 'no-store, max-age=0', 'Retry-After': '60' },
    });
  }
  const snapshot = await getMacroSnapshot(forceRefresh);
  return NextResponse.json(snapshot, {
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  });
}
