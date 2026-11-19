import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function retired() {
  return NextResponse.json({ error: 'Customer telemetry is retired in Personal Quant Edition. Use the private MT5 publisher and owner supervisor pipeline.' }, { status: 410, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET() { return retired(); }
export async function POST() { return retired(); }
