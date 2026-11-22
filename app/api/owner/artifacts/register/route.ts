import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function gone() {
  return NextResponse.json(
    { error: 'EA artifact registration is retired from the MacroLync product boundary.' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  );
}
export async function POST() { return gone(); }
