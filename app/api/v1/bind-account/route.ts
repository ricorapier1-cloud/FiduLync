import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function retired() {
  return NextResponse.json({
    success: false,
    error: 'The legacy account-binding endpoint is retired. Use the authenticated /portal workspace and its seat manager.',
    replacement: '/api/v1/license-seats',
  }, { status: 410, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET() { return retired(); }
export async function POST() { return retired(); }
