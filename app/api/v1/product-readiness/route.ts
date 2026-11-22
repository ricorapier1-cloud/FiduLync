import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    { ready: false, error: 'Commercial product readiness is retired in the private Personal Quant Edition. Use the owner-only artifact registry for your own EA research files.' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  );
}
