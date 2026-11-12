import { NextResponse } from 'next/server';
import { getRoroSentiment } from '@/lib/roroEngine';

export const dynamic = 'force-dynamic';

export async function GET() {
  const roro = await getRoroSentiment();
  return NextResponse.json(roro, {
    headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' },
  });
}
