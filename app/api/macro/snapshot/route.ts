import { NextResponse } from 'next/server';
import { getMacroSnapshot } from '@/lib/macroEngine';

export const dynamic = 'force-dynamic';

export async function GET() {
  const snapshot = await getMacroSnapshot();
  return NextResponse.json(snapshot, {
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  });
}
