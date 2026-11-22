import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  return NextResponse.json(
    { error: 'Broker market-data and account telemetry ingestion are outside the MacroLync product boundary. MT5 EAs own broker-side data and risk management.' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  );
}
