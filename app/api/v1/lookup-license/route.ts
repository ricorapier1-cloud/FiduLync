import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { validateCustomerLicense } from '@/lib/customerTelemetry';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return NextResponse.json({ error: 'Customer licence lookup is retired in Personal Quant Edition.' }, { status: 410, headers: { 'Cache-Control': 'no-store' } });

  const ip = getClientIp(request);
  if (!checkRateLimit(ip, 15, 60_000)) {
    return NextResponse.json(
      { valid: false, error: 'Too many account verification attempts.' },
      { status: 429, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { valid: false, error: 'A valid JSON verification request is required.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { valid: false, error: 'Invalid verification request.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const input = body as Record<string, unknown>;
  const rawAccount = input.mt5_account;
  const accountText = typeof rawAccount === 'string' ? rawAccount.trim() : String(rawAccount ?? '');
  const mt5Account = /^\d{1,20}$/.test(accountText) ? Number(accountText) : Number.NaN;
  const licenseKey = typeof input.license_key === 'string' ? input.license_key.trim() : '';

  if (!Number.isSafeInteger(mt5Account) || mt5Account <= 0 || !licenseKey || licenseKey.length > 128) {
    return NextResponse.json(
      { valid: false, error: 'A valid MT5 account number and license key are required.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const valid = await validateCustomerLicense(mt5Account, licenseKey);
    return NextResponse.json(
      valid
        ? { found: true, valid: true, mt5_account: mt5Account, license_key: licenseKey, download_url: '/downloads/AlgoLync_EA_README.txt', message: 'License verified. The installation guide is ready.' }
        : { found: false, valid: false, error: 'License does not authorize this MT5 account.' },
      {
        status: valid ? 200 : 401,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    );
  } catch (error) {
    console.error('Customer account license verification failed:', error);
    return NextResponse.json(
      { valid: false, error: 'License verification is temporarily unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
