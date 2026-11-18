import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!checkRateLimit(getClientIp(request), 60)) {
    return NextResponse.json({ valid: false, message: 'Rate limit exceeded.' }, { status: 429 });
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const licenseKey = typeof body.license_key === 'string' ? body.license_key.trim().toUpperCase() : '';
    const eaSlug = typeof body.ea_slug === 'string' ? body.ea_slug.trim().toLowerCase() : '';
    const accountNumber = Number(body.account_number ?? body.account ?? 0);
    const accountMode = body.account_type === 'DEMO' ? 'DEMO' : body.account_type === 'LIVE' || body.account_type === 'REAL' ? 'REAL' : '';

    if (!licenseKey || !eaSlug || !Number.isSafeInteger(accountNumber) || accountNumber <= 0 || !accountMode) {
      return NextResponse.json({
        valid: false,
        message: 'license_key, ea_slug, valid account_number and account_type (LIVE or DEMO) are required.',
      }, { status: 400 });
    }

    const endpoint = new URL('/api/v1/license/verify', request.url);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({
        license_key: licenseKey, ea_slug: eaSlug,
        mt5_login: String(accountNumber), account_mode: accountMode,
      }),
      cache: 'no-store',
    });
    const result = await response.json() as { valid?: boolean; license_type?: string; message?: string; error?: string };
    return NextResponse.json({
      valid: result.valid === true,
      license_type: result.license_type,
      account: accountNumber,
      message: result.message || result.error || 'License validation failed.',
    }, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Legacy license validation adapter failed:', error);
    return NextResponse.json({ valid: false, message: 'License validation service is temporarily unavailable.' }, { status: 503 });
  }
}
