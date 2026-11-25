import { NextRequest, NextResponse } from 'next/server';

const RETIRED_API_PATHS = new Set([
  '/api/v1/create-checkout',
  '/api/v1/customer-portal',
  '/api/v1/paystack-webhook',
  '/api/v1/provision-demo-license',
  '/api/v1/validate-license',
  '/api/v1/license-bind',
  '/api/v1/license-transfer',
  '/api/v1/lookup-license',
  '/api/v1/verify-payment',
  '/api/v1/bind-account',
  '/api/v1/ea-heartbeat',
  '/api/v1/trade-log',
  '/api/v1/dispatch-alert',
  '/api/v1/roro',
  '/api/v1/macro-signal',
  '/api/v1/market-data/ingest',
  '/api/mt5/ingest',
  '/api/owner/licenses',
]);

/**
 * FiduLync is a private macro research terminal, not an EA storefront,
 * subscription, payment, customer-account, trade-ledger or signal service.
 * Keep legacy endpoints inert even if their old route handlers remain in git.
 */
export function proxy(request: NextRequest) {
  if (!RETIRED_API_PATHS.has(request.nextUrl.pathname)) return NextResponse.next();

  return NextResponse.json({
    error: 'This endpoint has been retired.',
    product: 'FiduLync Macro Research',
    replacement: request.nextUrl.pathname === '/api/v1/macro-signal'
      ? '/api/v1/macro-context'
      : null,
    note: 'FiduLync provides sourced macroeconomic research context only. It does not sell EAs, manage customer licenses, process payments, or route trades.',
  }, {
    status: 410,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

export const config = {
  matcher: [
    '/api/v1/create-checkout',
    '/api/v1/customer-portal',
    '/api/v1/paystack-webhook',
    '/api/v1/provision-demo-license',
    '/api/v1/validate-license',
    '/api/v1/license-bind',
    '/api/v1/license-transfer',
    '/api/v1/lookup-license',
    '/api/v1/verify-payment',
    '/api/v1/bind-account',
    '/api/v1/ea-heartbeat',
    '/api/v1/trade-log',
    '/api/v1/dispatch-alert',
    '/api/v1/roro',
    '/api/v1/macro-signal',
    '/api/v1/market-data/ingest',
    '/api/mt5/ingest',
    '/api/owner/licenses',
  ],
};
