import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function gone() {
  return NextResponse.json(
    { error: 'Broker and reference quote aggregation is retired from the macro-only research interface. Use source-attributed macro observations.' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  );
}
export async function GET() { return gone(); }
