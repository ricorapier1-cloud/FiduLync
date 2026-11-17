import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/ownerAuth';
import { supabaseInsert, supabaseRead } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: 'Owner authentication required.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });

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
