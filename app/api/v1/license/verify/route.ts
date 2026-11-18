import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { isSupabaseConfigured, supabaseRead } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

type LicenseRow = {
  license_key: string; status: string | null; expires_at: string | null; grace_until: string | null;
  ea_slug: string | null; account_mode: string | null; mt5_account: number | null;
};

function signLease(payload: Record<string, unknown>, secret: string) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const body = encode(payload);
  const input = `${header}.${body}`;
  const signature = createHmac('sha256', secret).update(input).digest('base64url');
  return `${input}.${signature}`;
}

export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' };
  if (!checkRateLimit(getClientIp(request), 30, 60_000)) {
    return NextResponse.json({ valid: false, error: 'Rate limit exceeded.' }, { status: 429, headers });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ valid: false, error: 'License service is unavailable.' }, { status: 503, headers });
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const licenseKey = typeof body.license_key === 'string' ? body.license_key.trim().toUpperCase() : '';
    const eaSlug = typeof body.ea_slug === 'string' ? body.ea_slug.trim().toLowerCase() : '';
    const loginText = String(body.mt5_login ?? '').trim();
    const mt5Login = /^\d{1,20}$/.test(loginText) ? Number(loginText) : Number.NaN;
    const accountMode = body.account_mode === 'DEMO' ? 'DEMO' : body.account_mode === 'REAL' ? 'REAL' : '';

    if (!/^ALGOLYNX-[A-Z0-9-]{8,100}$/.test(licenseKey) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(eaSlug)
      || !Number.isSafeInteger(mt5Login) || mt5Login <= 0 || !accountMode) {
      return NextResponse.json({ valid: false, error: 'license_key, ea_slug, mt5_login and account_mode (DEMO or REAL) are required.' }, { status: 400, headers });
    }

    const licenses = await supabaseRead<LicenseRow[]>(
      'licenses',
      `license_key=eq.${encodeURIComponent(licenseKey)}&select=license_key,status,expires_at,grace_until,ea_slug,account_mode,mt5_account,tier&limit=1`
    );
    const license = licenses?.[0];
    if (!license || license.ea_slug !== eaSlug) {
      return NextResponse.json({ valid: false, error: 'License not found for this EA.' }, { status: 404, headers });
    }

    const now = Date.now();
    const status = String(license.status || '').toUpperCase();
    const expiry = license.expires_at ? Date.parse(license.expires_at) : Number.POSITIVE_INFINITY;
    const grace = license.grace_until ? Date.parse(license.grace_until) : 0;
    const active = status === 'ACTIVE' && expiry > now;
    const graceActive = status === 'PAST_DUE' && grace > now;
    if (!active && !graceActive) {
      return NextResponse.json({ valid: false, error: 'License is expired, revoked or outside its payment grace period.' }, { status: 403, headers });
    }

    let accountAuthorized = false;
    if (license.tier === 'DEMO_TRIAL' || licenseKey.startsWith('ALGOLYNX-DEMO-')) {
      if (accountMode !== 'DEMO') {
        return NextResponse.json({ valid: false, error: 'DEMO licenses are restricted to MT5 demo accounts.' }, { status: 403, headers });
      }
      const trials = await supabaseRead<Array<{ mt5_login: number; ea_slug: string; expires_at: string }>>(
        'ea_demo_trials',
        `license_key=eq.${encodeURIComponent(licenseKey)}&ea_slug=eq.${encodeURIComponent(eaSlug)}&mt5_login=eq.${mt5Login}&select=mt5_login,ea_slug,expires_at&limit=1`
      );
      accountAuthorized = Boolean(trials?.[0] && Date.parse(trials[0].expires_at) > now);
    } else {
      if (accountMode === 'DEMO' && String(license.account_mode || 'REAL').toUpperCase() === 'REAL') {
        // A live subscription includes demo slots, but must have a specifically bound DEMO seat.
      }
      const slotType = accountMode === 'DEMO' ? 'DEMO' : 'LIVE';
      const seats = await supabaseRead<Array<{ mt5_login: number }>>(
        'ea_license_seats',
        `license_key=eq.${encodeURIComponent(licenseKey)}&ea_slug=eq.${encodeURIComponent(eaSlug)}&slot_type=eq.${slotType}&mt5_login=eq.${mt5Login}&select=mt5_login&limit=1`
      );
      accountAuthorized = Boolean(seats?.length) || Number(license.mt5_account) === mt5Login;
    }

    if (!accountAuthorized) {
      return NextResponse.json({ valid: false, error: 'This MT5 login is not bound to an entitled account slot.' }, { status: 403, headers });
    }

    const secret = (process.env.LICENSE_LEASE_SIGNING_SECRET || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (secret.length < 32) {
      return NextResponse.json({ valid: false, error: 'License lease signing is not configured.' }, { status: 503, headers });
    }
    const issuedAt = Math.floor(now / 1000);
    const expiresAt = issuedAt + 24 * 60 * 60;
    const leaseToken = signLease({
      iss: 'fidulync-license-gate', sub: licenseKey,
      ea_slug: eaSlug, mt5_login: mt5Login, account_mode: accountMode,
      iat: issuedAt, exp: expiresAt,
    }, secret);

    return NextResponse.json({
      valid: true, license_type: license.tier || 'SUBSCRIPTION',
      ea_slug: eaSlug, mt5_login: mt5Login, account_mode: accountMode,
      lease_token: leaseToken, lease_expires_unix: expiresAt,
      server_utc: new Date().toISOString(),
      message: 'License verified. The signed 24-hour lease permits existing EA management during transient connectivity loss.',
    }, { status: 200, headers });
  } catch (error) {
    console.error('AlgoLync cloud license verification failed:', error);
    return NextResponse.json({ valid: false, error: 'License verification is temporarily unavailable.' }, { status: 503, headers });
  }
}
