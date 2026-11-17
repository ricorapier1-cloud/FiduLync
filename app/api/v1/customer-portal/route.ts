import { NextResponse } from 'next/server';
import { getClientIp, checkRateLimit } from '@/lib/rateLimit';
import { getCustomerHeartbeat, getCustomerTrades, validateCustomerLicense } from '@/lib/customerTelemetry';
import { supabaseRead } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!checkRateLimit(getClientIp(request), 20, 60_000)) {
    return NextResponse.json({ error: 'Too many dashboard requests. Please wait.' }, { status: 429 });
  }
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'A valid JSON request is required.' }, { status: 400 });
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid dashboard request.' }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  const accountText = typeof input.mt5_account === 'string' ? input.mt5_account.trim() : String(input.mt5_account ?? '');
  const mt5Account = /^\d{1,20}$/.test(accountText) ? Number(accountText) : Number.NaN;
  const licenseKey = typeof input.license_key === 'string' ? input.license_key.trim() : '';
  if (!Number.isSafeInteger(mt5Account) || mt5Account <= 0 || !licenseKey || licenseKey.length > 128) {
    return NextResponse.json({ error: 'Enter a valid MT5 account and license key.' }, { status: 400 });
  }
  try {
    if (!await validateCustomerLicense(mt5Account, licenseKey)) {
      return NextResponse.json({ error: 'This license does not authorize that MT5 account.' }, { status: 401 });
    }
    const rows = await supabaseRead<Array<{ license_key: string; mt5_account: number; email: string; tier: string; status: string; expires_at: string | null; created_at: string; ea_slug: string | null; billing_cycle: string | null; included_live_seats: number; included_demo_seats: number; extra_live_seats: number }>>(
      'licenses',
      `license_key=eq.${encodeURIComponent(licenseKey)}&mt5_account=eq.${mt5Account}&select=license_key,mt5_account,email,tier,status,expires_at,created_at,ea_slug,billing_cycle,included_live_seats,included_demo_seats,extra_live_seats&limit=1`
    );
    if (!rows?.[0]) return NextResponse.json({ error: 'License details are temporarily unavailable.' }, { status: 503 });
    const [heartbeat, trades, seats] = await Promise.all([
      getCustomerHeartbeat(mt5Account, licenseKey),
      getCustomerTrades(mt5Account, licenseKey),
      supabaseRead<Array<{id:string;slot_type:string;slot_number:number;mt5_login:number|null;broker_server:string|null;rebind_available_at:string|null}>>('ea_license_seats', `license_key=eq.${encodeURIComponent(licenseKey)}&select=id,slot_type,slot_number,mt5_login,broker_server,rebind_available_at&order=slot_type.asc,slot_number.asc`),
    ]);
    const { email, ...license } = rows[0];
    return NextResponse.json({
      license,
      masked_email: email.replace(/^(.).+(@.*)$/, '$1••••$2'),
      heartbeat,
      trades,
      seats: seats || [],
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('Customer license dashboard failed:', error);
    return NextResponse.json({ error: 'Customer dashboard is temporarily unavailable.' }, { status: 503 });
  }
}
