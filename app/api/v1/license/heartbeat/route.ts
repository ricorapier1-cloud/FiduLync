import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() { return NextResponse.json({ error: 'Commercial licence heartbeats are retired; use the private MT5 publisher gateway.' }, { status: 410, headers: { 'Cache-Control': 'no-store' } }); }
