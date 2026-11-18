import { NextResponse } from 'next/server';
import { getClientIp, checkRateLimit } from '@/lib/rateLimit';
import { getCustomerHeartbeat, getCustomerTrades, validateCustomerLicense } from '@/lib/customerTelemetry';
import { supabaseRead } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

type LicenseRow = {
  license_key: string; mt5_account: number | null; email: string; tier: string;
  status: string; expires_at: string | null; created_at: string; ea_slug: string | null;
  included_live_seats: number; included_demo_seats: number; extra_live_seats: number;
};

export async function POST(request: Request) {
  if (!checkRateLimit(getClientIp(request), 20, 60_000)) {
    return NextResponse.json({ error: 'Too many dashboard requests. Please wait.' }, { status: 429 });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'A valid JSON request is required.' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid dashboard request.' }, { status: 400 });
  const input = body as Record<string, unknown>;
  const licenseKey = typeof input.license_key === 'string' ? input.license_key.trim().toUpperCase() : '';
  const accountText = String(input.mt5_account ?? '').trim();
  const requestedAccount = accountText === '' ? null : /^\d{1,20}$/.test(accountText) ? Number(accountText) : Number.NaN;
  if (!/^ALGOLYNX-[A-Z0-9-]{8,100}$/.test(licenseKey)
    || (requestedAccount !== null && (!Number.isSafeInteger(requestedAccount) || requestedAccount <= 0))) {
    return NextResponse.json({ error: 'Enter a valid license key and, optionally, an MT5 account login.' }, { status: 400 });
  }

  try {
    const rows = await supabaseRead<LicenseRow[]>(
      'licenses',
      `license_key=eq.${encodeURIComponent(licenseKey)}&select=license_key,mt5_account,email,tier,status,expires_at,created_at,ea_slug,included_live_seats,included_demo_seats,extra_live_seats&limit=1`
    );
    const row = rows?.[0];
    if (!row) return NextResponse.json({ error: 'License not found.' }, { status: 404 });

    const seats = await supabaseRead<Array<{ mt5_login: number; slot_type: string }>>(
      'ea_license_seats',
      `license_key=eq.${encodeURIComponent(licenseKey)}&select=mt5_login,slot_type&order=slot_type.asc`
    );
    const fallbackAccount = row.mt5_account ?? seats?.find((seat) => seat.mt5_login)?.mt5_login ?? null;
    const account = requestedAccount ?? (fallbackAccount === null ? null : Number(fallbackAccount));
    if (account !== null && !await validateCustomerLicense(account, licenseKey)) {
      return NextResponse.json({ error: 'This license does not authorize that MT5 account.' }, { status: 401 });
    }
    const [heartbeat, trades] = account === null
      ? [null, []]
      : await Promise.all([getCustomerHeartbeat(account, licenseKey), getCustomerTrades(account, licenseKey)]);
    const { email, ...license } = row;
    return NextResponse.json({
      license: { ...license, mt5_account: account },
      masked_email: email.replace(/^(.).+(@.*)$/, '$1••••$2'),
      heartbeat, trades, selected_mt5_account: account,
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('Customer license dashboard failed:', error);
    return NextResponse.json({ error: 'Customer dashboard is temporarily unavailable.' }, { status: 503 });
  }
}
