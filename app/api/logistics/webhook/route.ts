export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'This legacy logistics callback is disabled. Delivery status must be updated through an authenticated integration.' },
    { status: 410 },
  );
}
