import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isSupabaseConfigured, supabaseRead, supabaseQuery } from '@/lib/supabaseAdmin';
import { enforceDistributedRateLimit } from '@/lib/rateLimit';
import { hasApprovedProductArtifact } from '@/lib/productRelease';
import { createLicenseLease } from '@/lib/licenseLease';

export const dynamic = 'force-dynamic';
type LicenseRecord = { id: string; license_key: string; status: string | null; tier: string | null; expires_at: string | null; grace_until: string | null; email: string; ea_slug: string | null };
type SeatRecord = { slot_type: 'LIVE' | 'DEMO'; slot_number: number; mt5_login: number | string | null; broker_server: string | null; rebind_available_at: string | null };
type BindResult = { success: boolean; already_bound?: boolean; reason?: string; rebind_available_at?: string };
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }
function json(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' } }); }
function positiveLogin(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : '';
  return /^\d{1,19}$/.test(text) && BigInt(text) > 0n && BigInt(text) <= 9223372036854775807n ? text : '';
}
export async function POST(req: Request) {
  const canonical = new URL(req.url).pathname === '/api/v1/license/verify';
  const rate = await enforceDistributedRateLimit(req, 'validate-license', 60, 60_000);
  if (rate.unavailable) return json({ valid: false, message: 'License validation is temporarily unavailable. Retry shortly.' }, 503);
  if (!rate.allowed) return json({ valid: false, message: 'Rate limit exceeded.' }, 429);
  if (!isSupabaseConfigured()) return json({ valid: false, message: 'License service is not configured.' }, 503);
  const length = Number(req.headers.get('content-length') ?? 0);
  if (Number.isFinite(length) && length > 8192) return json({ valid: false, message: 'Request body exceeds 8 KB.' }, 413);
  let rawBody: string;
  try { rawBody = await req.text(); } catch { return json({ valid: false, message: 'A valid JSON object is required.' }, 400); }
  if (Buffer.byteLength(rawBody, 'utf8') > 8192) return json({ valid: false, message: 'Request body exceeds 8 KB.' }, 413);
  try {
    let raw: unknown;
    try { raw = JSON.parse(rawBody); } catch { return json({ valid: false, message: 'A valid JSON object is required.' }, 400); }
    if (!isRecord(raw)) return json({ valid: false, message: 'A valid JSON object is required.' }, 400);
    const licenseKey = typeof raw.license_key === 'string' ? raw.license_key.trim().toUpperCase() : '';
    const login = positiveLogin(canonical ? raw.mt5_login : (raw.account_number ?? raw.account));
    const modeValue = canonical ? raw.account_mode : raw.account_type;
    const mode = modeValue === 'LIVE' || modeValue === 'DEMO' ? modeValue : null;
    const broker = typeof raw.broker_server === 'string' ? raw.broker_server.trim() : null;
    const slug = typeof raw.ea_slug === 'string' ? raw.ea_slug.trim().toLowerCase() : '';
    if (!/^[A-Z0-9][A-Z0-9-]{15,95}$/.test(licenseKey)) return json({ valid: false, message: 'A valid license_key is required.' }, 400);
    if (!login) return json({ valid: false, message: 'A valid positive MT5 login is required.' }, 400);
    if (!mode) return json({ valid: false, message: 'account_mode must be LIVE or DEMO.' }, 400);
    if (broker && broker.length > 128) return json({ valid: false, message: 'broker_server is too long.' }, 400);
    if ((canonical || slug) && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return json({ valid: false, message: 'A valid ea_slug is required.' }, 400);

    const licenses = await supabaseRead<LicenseRecord[]>('licenses', `license_key=eq.${encodeURIComponent(licenseKey)}&select=id,license_key,status,tier,expires_at,grace_until,email,ea_slug&limit=1`);
    if (!licenses) throw new Error('License database returned no result.');
    const license = licenses[0];
    if (!license) return json({ valid: false, message: 'Invalid license key.' }, 404);
    const status = String(license.status ?? '').toLowerCase();
    const now = Date.now();
    const expiry = license.expires_at ? Date.parse(license.expires_at) : Number.POSITIVE_INFINITY;
    const grace = license.grace_until ? Date.parse(license.grace_until) : 0;
    const inGrace = Number.isFinite(grace) && grace > now;
    if (status !== 'active' && !(status === 'past_due' && inGrace)) return json({ valid: false, message: 'License is not active.' }, 403);
    if (license.expires_at && !Number.isFinite(expiry)) return json({ valid: false, message: 'License expiry is invalid.' }, 403);
    if (expiry <= now && !inGrace) return json({ valid: false, message: 'License has expired.' }, 403);
    if (license.tier === 'DEMO_14D' && mode !== 'DEMO') return json({ valid: false, message: 'Demo entitlements cannot be used on live trading accounts.' }, 403);
    if (!license.ea_slug || (slug && slug !== license.ea_slug)) return json({ valid: false, message: 'This license is not entitled to the requested EA product.' }, 403);
    const products = await supabaseRead<Array<{ slug: string; is_active: boolean }>>('ea_products', `slug=eq.${encodeURIComponent(license.ea_slug)}&is_active=eq.true&select=slug,is_active&limit=1`);
    if (!products) throw new Error('Product entitlement database unavailable.');
    if (!products[0]) return json({ valid: false, message: 'The licensed EA product is no longer active.' }, 403);
    if (!(await hasApprovedProductArtifact(license.ea_slug))) return json({ valid: false, message: 'The licensed EA release artifact is not approved or available.' }, 403);

    const seats = await supabaseRead<SeatRecord[]>('ea_license_seats', `license_key=eq.${encodeURIComponent(licenseKey)}&ea_slug=eq.${encodeURIComponent(license.ea_slug)}&select=slot_type,slot_number,mt5_login,broker_server,rebind_available_at`);
    if (!seats) throw new Error('License seat database returned no result.');
    const match = seats.find((seat) => String(seat.mt5_login ?? '') === login);
    if (match && match.slot_type !== mode) return json({ valid: false, message: 'The MT5 account is bound under a different account type.' }, 403);
    if (!match) {
      const bound = await supabaseQuery<BindResult>('rpc/bind_algolync_seat', { method: 'POST', body: { p_license_key: licenseKey, p_account_number: login, p_account_type: mode, p_broker_server: broker, p_previous_account_number: null } });
      if (!bound || bound.success !== true) return json({ valid: false, message: bound?.reason || 'The account could not be assigned to an available license seat.' }, 403);
    }
    const licenseHash = createHash('sha256').update(licenseKey).digest('hex');
    const lease = createLicenseLease({ sub: license.id, license_hash: licenseHash, mt5_login: login, account_mode: mode, ea_slug: license.ea_slug });
    return json({
      valid: true, license_type: license.tier || 'ALGOLYNC_ACTIVE', mt5_login: login, account_mode: mode,
      account: login, account_type: mode, ea_slug: license.ea_slug, lease_token: lease.token,
      lease_expires_at: lease.expiresAt, lease_duration_seconds: 86400,
      message: 'License, product, account mode and seat verified. A signed 24-hour heartbeat lease was issued.',
    });
  } catch (error) {
    console.error('License validation failed:', error instanceof Error ? error.message : String(error));
    return json({ valid: false, message: 'License validation service is temporarily unavailable.' }, 503);
  }
}
