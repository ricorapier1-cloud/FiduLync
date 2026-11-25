import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Demo licensing is retired. FiduLync is a private macro-research terminal;
 * it does not provision EA licenses or customer MT5 accounts.
 */
export async function POST() {
  return NextResponse.json({
    error: 'This endpoint has been retired.',
    product: 'FiduLync Macro Research',
    note: 'No EA licenses or customer accounts are provisioned by this application.',
  }, {
    status: 410,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
