import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { validateCustomerLicense } from '@/lib/customerTelemetry';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!checkRateLimit(getClientIp(request), 15, 60_000)) {
    return NextResponse.json({ found: false, error: 'Too many lookup attempts.' }, { status: 429 });
  }
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ found: false, error: 'A valid JSON lookup request is required.' }, { status: 400 });
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ found: false, error: 'Invalid lookup request.' }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const mt5Account = Number(input.mt5_account);
  const licenseKey = typeof input.license_key === 'string' ? input.license_key.trim() : '';
  if (!email.includes('@') || !Number.isSafeInteger(mt5Account) || mt5Account <= 0) {
    return NextResponse.json({ found: false, error: 'Provide a valid subscriber email and MT5 account number.' }, { status: 400 });
  }
  try {
    if (licenseKey) {
      const valid = await validateCustomerLicense(mt5Account, licenseKey);
      return NextResponse.json({ found: valid, valid, mt5_account: mt5Account }, { status: valid ? 200 : 404, headers: { 'Cache-Control': 'no-store' } });
    }
    const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
    const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (!url || !key) throw new Error('Supabase is not configured.');
    const params = new URLSearchParams({
      email: `eq.${email}`, mt5_account: `eq.${mt5Account}`,
      status: 'eq.active', select: 'license_key,tier,expires_at', limit: '1',
    });
    const response = await fetch(`${url}/rest/v1/licenses?${params.toString()}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store',
    });
    if (!response.ok) throw new Error(`License lookup failed (${response.status}).`);
    const rows: unknown = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) return NextResponse.json({ found: false, error: 'No active license found for that email and MT5 account.' }, { status: 404 });
    const row = rows[0] as { license_key: string; tier: string; expires_at: string | null };
    if (row.expires_at && Date.parse(row.expires_at) <= Date.now()) return NextResponse.json({ found: false, error: 'This license has expired.' }, { status: 404 });
    return NextResponse.json({ found: true, license_key: row.license_key, tier: row.tier, expires_at: row.expires_at }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('License lookup unavailable:', error);
    return NextResponse.json({ found: false, error: 'License lookup service is temporarily unavailable.' }, { status: 503 });
  }
}
