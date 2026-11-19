import { NextResponse } from 'next/server';
import { isSupabaseConfigured, supabaseQuery, supabaseRead } from '@/lib/supabaseAdmin';
import { enforceDistributedRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

type LicenseRecord = {
  license_key: string;
  status: string | null;
  tier: string | null;
  expires_at: string | null;
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
  bound_at: string | null;
  rebind_available_at: string | null;
};
type BindResult = {
  success: boolean;
  already_bound?: boolean;
  rebound?: boolean;
  reason?: string;
  rebind_available_at?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
function validLicenseKey(value: string): boolean {
  return /^[A-Z0-9][A-Z0-9-]{15,95}$/.test(value);
}

async function readLicense(licenseKey: string): Promise<LicenseRecord | null> {
  const rows = await supabaseRead<LicenseRecord[]>('licenses',
    `license_key=eq.${encodeURIComponent(licenseKey)}&select=license_key,status,tier,expires_at,ea_slug,included_live_seats,included_demo_seats,extra_live_seats`);
  if (!rows) throw new Error('License database unavailable.');
  return rows[0] ?? null;
}

export async function GET(req: Request) {
  const rate = await enforceDistributedRateLimit(req, 'bind-account-read', 30, 60_000);
  if (rate.unavailable) return json({ success: false, error: 'Account binding service unavailable.' }, 503);
  if (!rate.allowed) return json({ success: false, error: 'Rate limit exceeded.' }, 429);
  if (!isSupabaseConfigured()) return json({ success: false, error: 'Licensing service is not configured.' }, 503);

  const authorization = req.headers.get('authorization') ?? '';
  const token = /^Bearer\s+(.+)$/i.exec(authorization)?.[1]?.trim() ?? '';
  const licenseKey = token.toUpperCase();
  if (!validLicenseKey(licenseKey)) return json({ success: false, error: 'A valid license_key is required.' }, 400);

  try {
    const license = await readLicense(licenseKey);
    if (!license) return json({ success: false, error: 'License key not found.' }, 404);
    if (String(license.status || '').toLowerCase() !== 'active'
      || (license.expires_at && new Date(license.expires_at).getTime() <= Date.now())
      || !license.ea_slug) return json({ success: false, error: 'License is inactive, expired, or missing product entitlement.' }, 403);

    const products = await supabaseRead<Array<{ slug: string; is_active: boolean }>>('ea_products', `slug=eq.${encodeURIComponent(license.ea_slug)}&is_active=eq.true&select=slug,is_active`);
    if (!products) throw new Error('Product entitlement database unavailable.');
    if (!products[0]) return json({ success: false, error: 'The licensed EA product is no longer active.' }, 403);
    const seats = await supabaseRead<SeatRecord[]>('ea_license_seats',
      `license_key=eq.${encodeURIComponent(licenseKey)}&ea_slug=eq.${encodeURIComponent(license.ea_slug)}&select=slot_type,slot_number,mt5_login,broker_server,bound_at,rebind_available_at&order=slot_type.asc,slot_number.asc`);
    if (!seats) throw new Error('Seat database unavailable.');
    const live = seats.filter((seat) => seat.slot_type === 'LIVE');
    const demo = seats.filter((seat) => seat.slot_type === 'DEMO');
    const liveLimit = (license.included_live_seats ?? 1) + (license.extra_live_seats ?? 0);
    const demoLimit = license.included_demo_seats ?? 2;
    return json({
      success: true,
      ea_slug: license.ea_slug,
      available_live_slots: Math.max(0, liveLimit - live.filter((seat) => seat.mt5_login !== null).length),
      available_demo_slots: Math.max(0, demoLimit - demo.filter((seat) => seat.mt5_login !== null).length),
      bound_accounts: seats.filter((seat) => seat.mt5_login !== null).map((seat) => ({
        account_number: seat.mt5_login,
        account_type: seat.slot_type,
        broker_server: seat.broker_server,
        bound_at: seat.bound_at,
        rebind_available_at: seat.rebind_available_at,
      })),
    });
  } catch (error) {
    console.error('Account binding lookup failed:', error instanceof Error ? error.message : String(error));
    return json({ success: false, error: 'Account binding service is temporarily unavailable.' }, 503);
  }
}

export async function POST(req: Request) {
  const rate = await enforceDistributedRateLimit(req, 'bind-account-write', 12, 60_000);
  if (rate.unavailable) return json({ success: false, error: 'Account binding service unavailable.' }, 503);
  if (!rate.allowed) return json({ success: false, error: 'Rate limit exceeded.' }, 429);
  if (!isSupabaseConfigured()) return json({ success: false, error: 'Licensing service is not configured.' }, 503);
  if (Number(req.headers.get('content-length') ?? 0) > 8192) return json({ success: false, error: 'Request body exceeds 8 KB.' }, 413);

  try {
    const raw: unknown = await req.json();
    if (!isRecord(raw)) return json({ success: false, error: 'A valid JSON object is required.' }, 400);
    const licenseKey = typeof raw.license_key === 'string' ? raw.license_key.trim().toUpperCase() : '';
    const accountRaw = raw.account_number;
    const accountNumber = typeof accountRaw === 'number' ? accountRaw
      : typeof accountRaw === 'string' && /^\d{1,20}$/.test(accountRaw) ? Number(accountRaw) : NaN;
    const accountType = raw.account_type;
    const brokerServer = typeof raw.broker_server === 'string' ? raw.broker_server.trim() : null;
    const previousRaw = raw.previous_account_number;
    const previousAccount = previousRaw === undefined || previousRaw === null || previousRaw === ''
      ? null : typeof previousRaw === 'number' ? previousRaw
      : typeof previousRaw === 'string' && /^\d{1,20}$/.test(previousRaw) ? Number(previousRaw) : NaN;

    if (!validLicenseKey(licenseKey)) return json({ success: false, error: 'A valid license_key is required.' }, 400);
    if (!Number.isSafeInteger(accountNumber) || accountNumber <= 0) return json({ success: false, error: 'A valid positive account_number is required.' }, 400);
    if (accountType !== 'LIVE' && accountType !== 'DEMO') return json({ success: false, error: 'account_type must be LIVE or DEMO.' }, 400);
    if (brokerServer && brokerServer.length > 128) return json({ success: false, error: 'broker_server is too long.' }, 400);
    if (previousAccount !== null && (!Number.isSafeInteger(previousAccount) || previousAccount <= 0 || previousAccount === accountNumber)) {
      return json({ success: false, error: 'previous_account_number must be a different valid account number.' }, 400);
    }

    const license = await readLicense(licenseKey);
    if (!license) return json({ success: false, error: 'License key not found.' }, 404);
    if (String(license.status || '').toLowerCase() !== 'active'
      || (license.expires_at && new Date(license.expires_at).getTime() <= Date.now())
      || !license.ea_slug) return json({ success: false, error: 'License is inactive, expired, or missing product entitlement.' }, 403);
    if (license.tier === 'DEMO_14D' && accountType !== 'DEMO') return json({ success: false, error: 'Demo entitlements cannot be bound to live accounts.' }, 403);

    const products = await supabaseRead<Array<{ slug: string; is_active: boolean }>>('ea_products', `slug=eq.${encodeURIComponent(license.ea_slug)}&is_active=eq.true&select=slug,is_active`);
    if (!products) throw new Error('Product entitlement database unavailable.');
    if (!products[0]) return json({ success: false, error: 'The licensed EA product is no longer active.' }, 403);
    const result = await supabaseQuery<BindResult>('rpc/bind_algolync_seat', {
      method: 'POST',
      body: {
        p_license_key: licenseKey,
        p_account_number: accountNumber,
        p_account_type: accountType,
        p_broker_server: brokerServer,
        p_previous_account_number: previousAccount,
      },
    });
    if (!result) throw new Error('Seat-binding database returned no result.');
    if (result.success !== true) return json({ success: false, error: result.reason || 'Seat assignment was rejected.' }, 409);

    return json({
      success: true,
      already_bound: result.already_bound === true,
      rebound: result.rebound === true,
      account_number: accountNumber,
      account_type: accountType,
      rebind_available_at: result.rebind_available_at ?? null,
      message: result.rebound ? 'MT5 seat successfully re-bound.' : result.already_bound ? 'This MT5 account is already bound.' : 'MT5 account successfully bound.',
    });
  } catch (error) {
    console.error('Account binding operation failed:', error instanceof Error ? error.message : String(error));
    return json({ success: false, error: 'Account binding could not be completed. Retry shortly.' }, 503);
  }
}
