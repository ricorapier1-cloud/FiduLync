import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    { error: 'Customer account binding is not part of the private Personal Quant Edition. Register your own trusted MT5 terminal in the Owner Console.' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST() {
  return NextResponse.json(
    { error: 'Customer account binding is not part of the private Personal Quant Edition. Register your own trusted MT5 terminal in the Owner Console.' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  );
}
