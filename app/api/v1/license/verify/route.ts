import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isSupabaseConfigured, supabaseRead } from '@/lib/supabaseAdmin';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

function signLease(payload: Record<string, unknown>, secret: string) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const body = encode(payload);
  const input = header + '.' + body;
  return input + '.' + createHmac('sha256', secret).update(input).digest('base64url');
}

export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' };
  if (!checkRateLimit(getClientIp(request), 60, 60_000)) {
    return NextResponse.json({ valid: false, error: 'Rate limit exceeded.' }, { status: 429, headers });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ valid: false, error: 'License authority is unavailable.' }, { status: 503, headers });
  }
  const secret = process.env.ALGOLYNC_LEASE_SIGNING_SECRET?.trim() ?? '';
  if (secret.length < 32) {
    return NextResponse.json({ valid: false, error: 'License lease signing is not configured.' }, { status: 503, headers });
  }

  try {
    const body = await request.json();
    const licenseKey = String(body?.license_key ?? '').trim().toUpperCase();
    const mt5Login = Number(body?.mt5_login ?? body?.mt5_account ?? 0);
    const accountMode = String(body?.account_mode ?? '').toUpperCase();
    const eaSlug = String(body?.ea_slug ?? '').trim().toLowerCase();
    if (!licenseKey || !Number.isSafeInteger(mt5Login) || mt5Login <= 0
      || !['DEMO', 'REAL'].includes(accountMode) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(eaSlug)) {
      return NextResponse.json({ valid: false, error: 'license_key, positive mt5_login, account_mode and ea_slug are required.' }, { status: 400, headers });
    }

    if (licenseKey.startsWith('ALGOLYNX-DEMO-')) {
      if (accountMode !== 'DEMO') return NextResponse.json({ valid: false, error: 'Demo licenses cannot authorize real accounts.' }, { status: 403, headers });
      const demos = await supabaseRead<Array<{ license_key: string; ea_slug: string; mt5_login: number; expires_at: string }>>(
        'ea_demo_trials',
        `license_key=eq.${encodeURIComponent(licenseKey)}&mt5_login=eq.${mt5Login}&ea_slug=eq.${encodeURIComponent(eaSlug)}&select=license_key,ea_slug,mt5_login,expires_at&limit=1`
      );
      const demo = demos?.[0];
      if (!demo || new Date(demo.expires_at).getTime() <= Date.now()) {
        return NextResponse.json({ valid: false, error: 'Demo license is invalid, expired, or bound to another account/EA.' }, { status: 403, headers });
      }
      const now = Math.floor(Date.now() / 1000);
      const leaseExpires = now + 24 * 60 * 60;
      const lease = signLease({ iss: 'fidulync', sub: licenseKey, ea: eaSlug, login: mt5Login, mode: 'DEMO', iat: now, exp: leaseExpires }, secret);
      return NextResponse.json({ valid: true, license_type: 'DEMO_TRIAL', lease_token: lease, lease_expires_unix: leaseExpires, lease_expires_at: new Date(leaseExpires * 1000).toISOString() }, { headers });
    }

    const records = await supabaseRead<Array<Record<string, unknown>>>(
      'licenses',
      `license_key=eq.${encodeURIComponent(licenseKey)}&select=license_key,status,expires_at,grace_until,ea_slug,mt5_account,included_live_seats,included_demo_seats,extra_live_seats&limit=1`
    );
    const license = records?.[0];
    if (!license) return NextResponse.json({ valid: false, error: 'License not found.' }, { status: 404, headers });
    const status = String(license.status ?? '').toUpperCase();
    const expiresAt = license.expires_at ? new Date(String(license.expires_at)).getTime() : null;
    const graceUntil = license.grace_until ? new Date(String(license.grace_until)).getTime() : null;
    if (!['ACTIVE', 'PAST_DUE'].includes(status) || (expiresAt !== null && expiresAt <= Date.now() && !(status === 'PAST_DUE' && graceUntil && graceUntil > Date.now()))) {
      return NextResponse.json({ valid: false, error: 'License is inactive or expired.' }, { status: 403, headers });
    }
    if (String(license.ea_slug ?? '') !== eaSlug) return NextResponse.json({ valid: false, error: 'This license is not entitled to the requested EA.' }, { status: 403, headers });

    const seats = await supabaseRead<Array<{ slot_type: string; mt5_login: number | null }>>(
      'ea_license_seats',
      `license_key=eq.${encodeURIComponent(licenseKey)}&mt5_login=eq.${mt5Login}&select=slot_type,mt5_login&limit=1`
    );
    let bound = seats?.some((seat) => Number(seat.mt5_login) === mt5Login && seat.slot_type === (accountMode === 'REAL' ? 'LIVE' : 'DEMO')) ?? false;
    if (!bound) {
      const legacy = await supabaseRead<Array<{ account_number: number; account_type: string }>>(
        'license_bound_accounts',
        `license_key=eq.${encodeURIComponent(licenseKey)}&account_number=eq.${mt5Login}&select=account_number,account_type&limit=1`
      );
      bound = legacy?.some((row) => row.account_type === (accountMode === 'REAL' ? 'LIVE' : 'DEMO')) ?? false;
    }
    if (!bound) return NextResponse.json({ valid: false, error: 'MT5 account is not bound to an entitled seat.' }, { status: 403, headers });

    const now = Math.floor(Date.now() / 1000);
    const leaseExpires = now + 24 * 60 * 60;
    const lease = signLease({ iss: 'fidulync', sub: licenseKey, ea: eaSlug, login: mt5Login, mode: accountMode, iat: now, exp: leaseExpires }, secret);
    return NextResponse.json({ valid: true, license_type: status, lease_token: lease, lease_expires_at: new Date(leaseExpires * 1000).toISOString() }, { headers });
  } catch (error) {
    console.error('License verification failed:', error);
    return NextResponse.json({ valid: false, error: 'License verification is temporarily unavailable.' }, { status: 503, headers });
  }
}
