import { NextResponse } from 'next/server';
import { getMacroSnapshot } from '@/lib/macroEngine';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const forceRefresh = new URL(request.url).searchParams.get('force') === 'true';
  const snapshot = await getMacroSnapshot(forceRefresh);
  return NextResponse.json(snapshot, {
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  });
}
