import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/ownerAuth';
import { supabaseInsert, supabaseRead, supabaseQuery } from '@/lib/supabaseAdmin';
import { enforceDistributedRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: 'Owner authentication required.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  const rate = await enforceDistributedRateLimit(request, 'owner-license-issue', 10, 60_000);
  if (rate.unavailable) return NextResponse.json({ error: 'Owner licensing service is unavailable.' }, { status: 503 });
  if (!rate.allowed) return NextResponse.json({ error: 'Owner licensing rate limit exceeded.' }, { status: 429 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'A valid JSON request is required.' }, { status: 400 });
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const raw = (body as Record<string, unknown>).mt5_account;
  const accountText = typeof raw === 'string' ? raw.trim() : String(raw ?? '');
  const mt5Account = /^\d{1,20}$/.test(accountText) ? Number(accountText) : Number.NaN;
  if (!Number.isSafeInteger(mt5Account) || mt5Account <= 0) {
    return NextResponse.json({ error: 'Enter a valid MT5 account login.' }, { status: 400 });
  }

  try {
    const existing = await supabaseRead<Array<{ id: string; license_key: string; mt5_account: number; tier: string; status: string; expires_at: string | null }>>(
      'licenses',
      `select=id,license_key,mt5_account,tier,status,expires_at&email=eq.${encodeURIComponent(owner.email)}&mt5_account=eq.${mt5Account}&tier=eq.OWNER_LIFETIME&status=eq.active&limit=1`
    );
    if (existing === null) throw new Error('License database is unavailable.');
    if (existing[0]) {
      return NextResponse.json({
        success: true,
        license: existing[0],
        message: 'Your existing complimentary owner lifetime license is active for this MT5 account.',
      }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
    }
    const licenseKey = `ALGOLYNX-OWNER-${randomBytes(18).toString('hex').toUpperCase()}`;
    const rows = await supabaseInsert<Array<{ id: string }>>('licenses', {
      license_key: licenseKey,
      mt5_account: mt5Account,
      email: owner.email,
      tier: 'OWNER_LIFETIME',
      status: 'active',
      expires_at: null,
    });
    if (!rows?.[0]?.id) throw new Error('License insert did not return a record.');
    let auditLogged = true;
    try {
      await supabaseInsert('fidulync_owner_audit', {
        owner_email: owner.email,
        action: 'OWNER_LIFETIME_LICENSE_ISSUED',
        subject_id: rows[0].id,
        mt5_account: mt5Account,
        metadata: { tier: 'OWNER_LIFETIME', expires_at: null, payment_required: false },
      });
    } catch (auditError) {
      auditLogged = false;
      console.error('Owner license audit insert failed:', auditError);
    }
    return NextResponse.json({
      success: true,
      license: { license_key: licenseKey, mt5_account: mt5Account, tier: 'OWNER_LIFETIME', status: 'active', expires_at: null },
      audit_logged: auditLogged,
      message: 'Complimentary owner lifetime license issued and bound to this MT5 account.',
    }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Owner lifetime license issuance failed:', error);
    return NextResponse.json({ error: 'License could not be issued. Check the owner database configuration.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}


type RevokeResult = { success: boolean; already_revoked?: boolean; reason?: string; license_id?: string; status?: string };

export async function DELETE(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: 'Owner authentication required.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  const rate = await enforceDistributedRateLimit(request, 'owner-license-revoke', 5, 60_000);
  if (rate.unavailable) return NextResponse.json({ error: 'License revocation service is unavailable.' }, { status: 503 });
  if (!rate.allowed) return NextResponse.json({ error: 'Too many revocation attempts.' }, { status: 429 });
  if (Number(request.headers.get('content-length') ?? 0) > 8192) return NextResponse.json({ error: 'Request body exceeds 8 KB.' }, { status: 413 });

  let raw: unknown;
  try { raw = await request.json(); } catch {
    return NextResponse.json({ error: 'A valid JSON request is required.' }, { status: 400 });
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const body = raw as Record<string, unknown>;
  const licenseId = typeof body.license_id === 'string' ? body.license_id.trim() : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!/^[0-9a-f-]{36}$/i.test(licenseId)) return NextResponse.json({ error: 'A valid license_id is required.' }, { status: 400 });
  if (body.confirm !== true) return NextResponse.json({ error: 'Explicit confirmation is required to revoke a license.' }, { status: 400 });
  if (reason.length < 5 || reason.length > 500) return NextResponse.json({ error: 'Provide a revocation reason between 5 and 500 characters.' }, { status: 400 });

  try {
    const result = await supabaseQuery<RevokeResult>('rpc/revoke_algolync_license', {
      method: 'POST',
      body: { p_license_id: licenseId, p_owner_email: owner.email, p_reason: reason },
    });
    if (!result) throw new Error('Revocation RPC returned no result.');
    if (result.success !== true) return NextResponse.json({ error: result.reason || 'License could not be revoked.' }, { status: 404 });
    return NextResponse.json({
      success: true,
      license_id: result.license_id,
      status: 'revoked',
      already_revoked: result.already_revoked === true,
      message: result.already_revoked ? 'License was already revoked.' : 'License revoked and owner audit event committed.',
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('Owner license revocation failed:', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'License revocation failed. No success was reported.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
