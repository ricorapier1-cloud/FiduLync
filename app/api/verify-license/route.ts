import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      status: 'UNAVAILABLE',
      authorized: false,
      reason: 'License verification is not available until purchase-to-license provisioning is configured.',
    },
    { status: 410 },
  );
}
