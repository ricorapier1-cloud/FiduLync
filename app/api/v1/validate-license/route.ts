import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() { return NextResponse.json({ valid: false, message: 'Customer product licensing is retired in Personal Quant Edition; use the private MT5 publisher and owner supervisor connection.' }, { status: 410, headers: { 'Cache-Control': 'no-store' } }); }
