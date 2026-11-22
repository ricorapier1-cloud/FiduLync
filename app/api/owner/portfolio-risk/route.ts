import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function gone() {
  return NextResponse.json(
    { error: 'Portfolio trade-risk aggregation is outside the MacroLync product boundary. Independent MT5 EAs own broker-side risk management.' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  );
}
export async function GET() { return gone(); }
