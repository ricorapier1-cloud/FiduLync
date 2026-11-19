import { NextResponse } from 'next/server';
import { isSupabaseConfigured, supabaseRead, supabaseQuery } from '@/lib/supabaseAdmin';
import { enforceDistributedRateLimit } from '@/lib/rateLimit';
import { hasApprovedProductArtifact } from '@/lib/productRelease';

export const dynamic = 'force-dynamic';

type LicenseRecord = {
  license_key: string;
  status: string | null;
  tier: string | null;
  expires_at: string | null;
  email: string;
  ea_slug: string | null;
  included_live_seats: number | null;
  included_demo_seats: number | null;
  extra_live_seats: number | null;
};
type SeatRecord = {
  slot_type: 'LIVE' | 'DEMO';
  slot_number: number;
  mt5_login: number | null;
  broker_server: string | null;
  rebind_available_at: string | null;
};
type BindResult = {
  success: boolean;
  already_bound?: boolean;
  reason?: string;
  rebind_available_at?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

export async function POST(req: Request) {
  const rate = await enforceDistributedRateLimit(req, 'validate-license', 60, 60_000);
  if (rate.unavailable) return json({ valid: false, message: 'License validation is temporarily unavailable. Retry shortly.' }, 503);
  if (!rate.allowed) return json({ valid: false, message: 'Rate limit exceeded.' }, 429);
  if (!isSupabaseConfigured()) return json({ valid: false, message: 'License service is not configured.' }, 503);
  if (Number(req.headers.get('content-length') ?? 0) > 8192) return json({ valid: false, message: 'Request body exceeds 8 KB.' }, 413);

  try {
    const raw: unknown = await req.json();
    if (!isRecord(raw)) return json({ valid: false, message: 'A valid JSON object is required.' }, 400);
    const licenseKey = typeof raw.license_key === 'string' ? raw.license_key.trim().toUpperCase() : '';
    const accountRaw = raw.account_number ?? raw.account;
    const accountNumber = typeof accountRaw === 'number' ? accountRaw
      : typeof accountRaw === 'string' && /^\d{1,20}$/.test(accountRaw) ? Number(accountRaw) : NaN;
    const accountType = raw.account_type;
    const brokerServer = typeof raw.broker_server === 'string' ? raw.broker_server.trim() : null;
    const requestedEaSlug = typeof raw.ea_slug === 'string' ? raw.ea_slug.trim().toLowerCase() : null;

    if (!/^[A-Z0-9][A-Z0-9-]{15,95}$/.test(licenseKey)) return json({ valid: false, message: 'A valid license_key is required.' }, 400);
    if (!Number.isSafeInteger(accountNumber) || accountNumber <= 0) return json({ valid: false, message: 'A valid positive MT5 account number is required.' }, 400);
    if (accountType !== 'LIVE' && accountType !== 'DEMO') return json({ valid: false, message: 'account_type must be LIVE or DEMO.' }, 400);
    if (brokerServer && brokerServer.length > 128) return json({ valid: false, message: 'broker_server is too long.' }, 400);
    if (requestedEaSlug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(requestedEaSlug)) return json({ valid: false, message: 'Invalid ea_slug.' }, 400);

    const licenses = await supabaseRead<LicenseRecord[]>('licenses',
      `license_key=eq.${encodeURIComponent(licenseKey)}&select=license_key,status,tier,expires_at,email,ea_slug,included_live_seats,included_demo_seats,extra_live_seats`);
    if (!licenses) throw new Error('License database returned no result.');
    const license = licenses[0];
    if (!license) return json({ valid: false, message: 'Invalid license key.' }, 404);
    if (String(license.status || '').toLowerCase() !== 'active') return json({ valid: false, message: 'License is not active.' }, 403);
    if (license.expires_at && new Date(license.expires_at).getTime() <= Date.now()) return json({ valid: false, message: 'License has expired.' }, 403);
    if (license.tier === 'DEMO_14D' && accountType !== 'DEMO') return json({ valid: false, message: 'Demo entitlements cannot be used on live trading accounts.' }, 403);
    if (!license.ea_slug || (requestedEaSlug && requestedEaSlug !== license.ea_slug)) return json({ valid: false, message: 'This license is not entitled to the requested EA product.' }, 403);
    const products = await supabaseRead<Array<{ slug: string; is_active: boolean }>>('ea_products', `slug=eq.${encodeURIComponent(license.ea_slug)}&is_active=eq.true&select=slug,is_active`);
    if (!products) throw new Error('Product entitlement database unavailable.');
    if (!products[0]) return json({ valid: false, message: 'The licensed EA product is no longer active.' }, 403);
    if (!(await hasApprovedProductArtifact(license.ea_slug))) return json({ valid: false, message: 'The licensed EA release artifact is not approved or available.' }, 403);

    const seats = await supabaseRead<SeatRecord[]>('ea_license_seats',
      `license_key=eq.${encodeURIComponent(licenseKey)}&ea_slug=eq.${encodeURIComponent(license.ea_slug)}&select=slot_type,slot_number,mt5_login,broker_server,rebind_available_at`);
    if (!seats) throw new Error('License seat database returned no result.');
    const match = seats.find((seat) => Number(seat.mt5_login) === accountNumber);
    if (match && match.slot_type !== accountType) return json({ valid: false, message: 'The MT5 account is bound under a different account type.' }, 403);

    if (!match) {
      const result = await supabaseQuery<BindResult>('rpc/bind_algolync_seat', {
        method: 'POST',
        body: {
          p_license_key: licenseKey,
          p_account_number: accountNumber,
          p_account_type: accountType,
          p_broker_server: brokerServer,
          p_previous_account_number: null,
        },
      });
      if (!result || result.success !== true) {
        return json({ valid: false, message: result?.reason || 'The account could not be assigned to an available license seat.' }, 403);
      }
    }

    return json({
      valid: true,
      license_type: license.tier || 'ALGOLYNC_ACTIVE',
      account: accountNumber,
      account_type: accountType,
      ea_slug: license.ea_slug,
      message: 'License verified against the active server entitlement and assigned seat.',
    });
  } catch (error) {
    console.error('License validation failed:', error instanceof Error ? error.message : String(error));
    return json({ valid: false, message: 'License validation service is temporarily unavailable.' }, 503);
  }
}
