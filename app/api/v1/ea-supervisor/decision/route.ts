import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  return NextResponse.json(
    { error: 'The EA approval and risk-decision service has been retired. Each independent MT5 EA owns its own trading decisions and broker-side risk controls. Use the read-only fundamental macro-context endpoint for research context only.' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  );
}
