import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    { error: 'Technical signal generation has been retired. Use the read-only fundamental macro-context API; technical decisions belong inside independent MT5 EAs.' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  );
}
