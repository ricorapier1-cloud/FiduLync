import { NextResponse } from 'next/server';
import { isSupabaseConfigured, supabaseQuery } from '@/lib/supabaseAdmin';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

const DEMO_LICENSE_KEYS = new Set([
  'ALGOLYNX-FREE-TEST',
  'ALGOLYNX-NEXUS-DEMO',
  'ALGOLYNX-VELOCITY-DEMO',
]);

export async function GET(request: Request) {
  const ip = getClientIp(request);
  if (!checkRateLimit(ip, 30, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded. Maximum 30 requests per minute.' }, { status: 429 });
  }

  return NextResponse.json({
    status: 'active',
    endpoint: '/api/v1/validate-license',
    description: 'MT5 Expert Advisor Cloud Authorization and WebRequest verification gate.',
    methods: ['GET', 'POST'],
  });
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!checkRateLimit(ip, 30, 60_000)) {
    return NextResponse.json(
      { valid: false, reason: 'Rate limit exceeded. Maximum 30 requests per minute.' },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ valid: false, reason: 'Malformed request payload.' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ valid: false, reason: 'Malformed request payload.' }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const licenseKey = typeof record.license_key === 'string' ? record.license_key.trim() : '';
  const rawAccount = record.mt5_account;
  const mt5Account = typeof rawAccount === 'number'
    ? rawAccount
    : typeof rawAccount === 'string' && /^\d+$/.test(rawAccount.trim())
      ? Number(rawAccount.trim())
      : Number.NaN;

  if (!/^ALGOLYNX-[A-Z0-9-]{3,80}$/.test(licenseKey)
    || !Number.isSafeInteger(mt5Account) || mt5Account <= 0) {
    return NextResponse.json(
      { valid: false, reason: 'Invalid key format or account number.' },
      { status: 403 }
    );
  }

  // Explicit demo artifacts remain available for sandbox testing only.
  if (process.env.ENABLE_DEMO_LICENSES === 'true' && DEMO_LICENSE_KEYS.has(licenseKey)) {
    return NextResponse.json({
      valid: true,
      message: 'AlgoLync sandbox demo artifact verified.',
      license_key: licenseKey,
      mt5_account: mt5Account,
      tier: 'SANDBOX_DEMO',
      expires_at: null,
      verified_at: new Date().toISOString(),
    }, { status: 200 });
  }

  // Fail closed: a syntactically valid key is not proof of ownership.
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { valid: false, reason: 'License verification is temporarily unavailable.' },
      { status: 503 }
    );
  }

  try {
    const records = await supabaseQuery<Array<{
      license_key: string;
      mt5_account: number;
      status: string;
      tier: string;
      expires_at: string | null;
    }>>('licenses', {
      query: `license_key=eq.${encodeURIComponent(licenseKey)}&mt5_account=eq.${mt5Account}&select=license_key,mt5_account,status,tier,expires_at&limit=1`,
    });

    if (!records) {
      return NextResponse.json(
        { valid: false, reason: 'License verification is temporarily unavailable.' },
        { status: 503 }
      );
    }

    if (records.length === 0) {
      return NextResponse.json(
        { valid: false, reason: 'License key not found for this MT5 account number.' },
        { status: 403 }
      );
    }

    const license = records[0];
    const expiry = license.expires_at ? Date.parse(license.expires_at) : null;
    const expired = expiry !== null && (!Number.isFinite(expiry) || expiry < Date.now());

    if (license.status !== 'active' || expired) {
      return NextResponse.json(
        { valid: false, reason: expired ? 'License key has expired.' : 'License key is inactive.' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      valid: true,
      message: 'Institutional license verified and active.',
      license_key: license.license_key,
      mt5_account: license.mt5_account,
      tier: license.tier || 'INSTITUTIONAL_PRO',
      expires_at: license.expires_at,
      verified_at: new Date().toISOString(),
    }, { status: 200 });
  } catch (error) {
    console.error('Supabase license verification failed:', error);
    return NextResponse.json(
      { valid: false, reason: 'License verification is temporarily unavailable.' },
      { status: 503 }
    );
  }
}
