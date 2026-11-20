import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  return NextResponse.json(
    { error: 'This commercial endpoint is retired in Personal Quant Edition.' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } }
  );
}
