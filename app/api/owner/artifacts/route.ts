import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function gone() {
  return NextResponse.json(
    { error: 'EA artifact storage and release management are outside the MacroLync product boundary.' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  );
}
export async function GET() { return gone(); }
export async function POST() { return gone(); }
export async function DELETE() { return gone(); }
