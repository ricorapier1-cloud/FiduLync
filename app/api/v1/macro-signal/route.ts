import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Retired legacy signal endpoint. FiduLync is a macro research provider, not
 * a trade-signal or execution engine. MT5 integrations should consume the
 * authenticated read-only /api/v1/macro-context dossier instead.
 */
export async function GET() {
  return NextResponse.json({
    error: 'This legacy macro-signal endpoint has been retired.',
    replacement: '/api/v1/macro-context',
    note: 'The replacement returns evidence, confidence, provenance and event risk; it does not issue trade instructions.',
  }, {
    status: 410,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
