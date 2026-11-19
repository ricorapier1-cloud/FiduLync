import { NextResponse } from 'next/server';
import { enforceDistributedRateLimit, getClientIp } from '@/lib/rateLimit';
import { isSupabaseConfigured, supabaseQuery, supabaseRead } from '@/lib/supabaseAdmin';
import { hasApprovedProductArtifact } from '@/lib/productRelease';
import { verifyLicenseLease } from '@/lib/licenseLease';

export const dynamic = 'force-dynamic';
type LicenseRow = { id: string; license_key: string; status: string | null; expires_at: string | null; grace_until: string | null; ea_slug: string | null };
type SeatRow = { slot_type: 'LIVE' | 'DEMO'; mt5_login: string | number | null };
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }
function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' } });
}
function finiteMetric(value: unknown, min: number, max: number): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

export async function POST(request: Request) {
  const rate = await enforceDistributedRateLimit(request, 'license-heartbeat', 120, 60_000);
  if (rate.unavailable) return json({ accepted: false, error: 'Heartbeat service is temporarily unavailable.' }, 503);
  if (!rate.allowed) return json({ accepted: false, error: 'Heartbeat rate limit exceeded.' }, 429);
  if (!isSupabaseConfigured()) return json({ accepted: false, error: 'Heartbeat database is not configured.' }, 503);

  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const claims = verifyLicenseLease(token);
  if (!claims) return json({ accepted: false, error: 'A valid, unexpired signed license lease is required.' }, 401);

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 8192) return json({ accepted: false, error: 'Request body exceeds 8 KB.' }, 413);

  try {
    let raw: unknown;
    try { raw = await request.json(); } catch { return json({ accepted: false, error: 'A valid JSON object is required.' }, 400); }
    if (!isRecord(raw)) return json({ accepted: false, error: 'A valid JSON object is required.' }, 400);

    const balance = finiteMetric(raw.balance, -1_000_000_000_000, 1_000_000_000_000);
    const equity = finiteMetric(raw.equity, -1_000_000_000_000, 1_000_000_000_000);
    const drawdown = finiteMetric(raw.drawdown_pct, 0, 1000);
    const floatingPnl = finiteMetric(raw.floating_pnl, -1_000_000_000_000, 1_000_000_000_000);
    const openPositions = finiteMetric(raw.open_positions, 0, 5000);
    const ping = finiteMetric(raw.vps_ping_ms, 0, 120_000);
    if (balance === null || equity === null || drawdown === null
      || floatingPnl === null || openPositions === null || ping === null) {
      return json({ accepted: false, error: 'Heartbeat metrics are missing or outside accepted numeric limits.' }, 400);
    }

    const licenses = await supabaseRead<LicenseRow[]>('licenses',
      `id=eq.${encodeURIComponent(claims.sub)}&select=id,license_key,status,expires_at,grace_until,ea_slug&limit=1`);
    if (!licenses) throw new Error('License lookup failed.');
    const license = licenses[0];
    if (!license || license.ea_slug !== claims.ea_slug) return json({ accepted: false, error: 'License entitlement no longer matches this lease.' }, 403);

    const status = String(license.status ?? '').toLowerCase();
    const now = Date.now();
    const expiry = license.expires_at ? Date.parse(license.expires_at) : Number.POSITIVE_INFINITY;
    const grace = license.grace_until ? Date.parse(license.grace_until) : 0;
    const inGrace = Number.isFinite(grace) && grace > now;
    if ((status !== 'active' && !(status === 'past_due' && inGrace)) || (expiry <= now && !inGrace)) {
      return json({ accepted: false, error: 'License is inactive or expired.' }, 403);
    }

    const seats = await supabaseRead<SeatRow[]>('ea_license_seats',
      `license_key=eq.${encodeURIComponent(license.license_key)}&ea_slug=eq.${encodeURIComponent(claims.ea_slug)}&mt5_login=eq.${encodeURIComponent(claims.mt5_login)}&slot_type=eq.${claims.account_mode}&select=slot_type,mt5_login&limit=1`);
    if (!seats) throw new Error('License seat verification failed.');
    if (!seats[0]) return json({ accepted: false, error: 'This MT5 account is no longer bound to the license.' }, 403);
    if (!(await hasApprovedProductArtifact(claims.ea_slug))) return json({ accepted: false, error: 'The licensed EA artifact is no longer approved.' }, 403);

    const eaName = typeof raw.ea_name === 'string' && raw.ea_name.trim()
      ? raw.ea_name.trim().slice(0, 100) : claims.ea_slug;
    const stored = await supabaseQuery<Array<{ id: string }>>('ea_heartbeats', {
      method: 'POST',
      query: 'on_conflict=mt5_account',
      prefer: 'resolution=merge-duplicates,return=representation',
      body: {
        mt5_account: claims.mt5_login,
        license_key: license.license_key,
        balance,
        equity,
        drawdown_pct: drawdown,
        floating_pnl: floatingPnl,
        open_positions: Math.trunc(openPositions),
        vps_ping_ms: Math.trunc(ping),
        ea_name: eaName,
        status: 'ONLINE',
        client_ip: getClientIp(request) || null,
        updated_at: new Date().toISOString(),
      },
    });
    if (!Array.isArray(stored) || stored.length !== 1) throw new Error('Heartbeat was not durably stored.');
    return json({ accepted: true, status: 'ONLINE', ea_slug: claims.ea_slug, mt5_login: claims.mt5_login, lease_expires_at: new Date(claims.exp * 1000).toISOString() });
  } catch (error) {
    console.error('AlgoLync license heartbeat failed:', error instanceof Error ? error.message : String(error));
    return json({ accepted: false, error: 'Heartbeat could not be persisted. Retry shortly.' }, 503);
  }
}
