import { NextResponse } from 'next/server';
import { getMacroBrief } from '@/lib/aiBrief';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await getMacroBrief(), {
      headers: { 'Cache-Control': 'private, max-age=3600, stale-while-revalidate=300' },
    });
  } catch (error) {
    console.error('Macro desk brief request failed:', error);
    return NextResponse.json({ error: 'Macro desk brief is temporarily unavailable.' }, { status: 503 });
  }
}
