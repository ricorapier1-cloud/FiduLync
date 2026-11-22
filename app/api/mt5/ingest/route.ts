import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function gone() {
  return NextResponse.json(
    { error: 'Broker market-data ingestion is outside the MacroLync product boundary. Use the read-only macro-context endpoint for fundamental research context.' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  );
}
export async function POST() { return gone(); }
