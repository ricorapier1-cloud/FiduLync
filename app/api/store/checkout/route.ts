export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Marketplace checkout is not available. Use a FiduLync escrow deal instead.' },
    { status: 410 },
  );
}
