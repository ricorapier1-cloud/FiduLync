import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/ownerAuth';
import { supabaseInsert, supabaseQuery, supabaseRead } from '@/lib/supabaseAdmin';
import { enforceDistributedRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: 'Owner authentication required.' }, { status: 401 });
  const rate = await enforceDistributedRateLimit(request, 'owner-mt5-installations-read', 30, 60_000);
  if (rate.unavailable) return NextResponse.json({ error: 'MT5 installation service is unavailable.' }, { status: 503 });
  if (!rate.allowed) return NextResponse.json({ error: 'MT5 installation rate limit exceeded.' }, { status: 429 });
  try {
    const rows = await supabaseRead<Array<{ id: string; label: string; status: string; broker: string | null; server: string | null; last_seen_at: string | null; created_at: string }>>(
      'mt5_installations',
      `select=id,label,status,broker,server,last_seen_at,created_at&user_id=eq.${owner.id}&order=created_at.desc&limit=20`
    );
    return NextResponse.json({ installations: rows ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'MT5 installation list is unavailable.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: 'Owner authentication required.' }, { status: 401 });
  const rate = await enforceDistributedRateLimit(request, 'owner-mt5-installations-create', 10, 60_000);
  if (rate.unavailable) return NextResponse.json({ error: 'MT5 installation service is unavailable.' }, { status: 503 });
  if (!rate.allowed) return NextResponse.json({ error: 'MT5 installation rate limit exceeded.' }, { status: 429 });
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'A valid JSON request is required.' }, { status: 400 });
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const input = body as Record<string, unknown>;
  const label = typeof input.label === 'string' ? input.label.trim().slice(0, 80) : 'FiduLync MT5 publisher';
  const broker = typeof input.broker === 'string' ? input.broker.trim().slice(0, 100) : null;
  const server = typeof input.server === 'string' ? input.server.trim().slice(0, 120) : null;
  const token = `flmt5_${randomBytes(32).toString('base64url')}`;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  try {
    const rows = await supabaseInsert<Array<{ id: string }>>('mt5_installations', {
      user_id: owner.id, label: label || 'FiduLync MT5 publisher', token_hash: tokenHash,
      status: 'active', broker, server,
    });
    if (!rows?.[0]?.id) throw new Error('Installation record was not created.');
    try {
      await supabaseInsert('fidulync_owner_audit', {
        owner_email: owner.email, action: 'MT5_INSTALLATION_CREATED', subject_id: rows[0].id,
        metadata: { label, broker, server },
      });
    } catch (auditError) {
      console.error('MT5 installation audit failed; revoking unlogged token:', auditError);
      await supabaseQuery('mt5_installations', { method: 'PATCH', query: `id=eq.${rows[0].id}&user_id=eq.${owner.id}`, body: { status: 'revoked' } });
      throw new Error('Installation audit failed; the token was revoked and not returned.');
    }
    return NextResponse.json({
      success: true,
      installation: { id: rows[0].id, label },
      token,
      warning: 'Copy this token now. It is shown once and cannot be recovered; revoke the installation and create a new one if lost.',
    }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('MT5 installation creation failed:', error);
    return NextResponse.json({ error: 'MT5 publisher could not be registered.' }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: 'Owner authentication required.' }, { status: 401 });
  const rate = await enforceDistributedRateLimit(request, 'owner-mt5-installations-revoke', 10, 60_000);
  if (rate.unavailable) return NextResponse.json({ error: 'MT5 installation service is unavailable.' }, { status: 503 });
  if (!rate.allowed) return NextResponse.json({ error: 'MT5 installation rate limit exceeded.' }, { status: 429 });
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'A valid JSON request is required.' }, { status: 400 });
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const id = typeof (body as Record<string, unknown>).id === 'string' ? (body as Record<string, unknown>).id as string : '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid installation ID.' }, { status: 400 });
  try {
    const rows = await supabaseQuery<Array<{ id: string }>>('mt5_installations', {
      method: 'PATCH',
      query: `id=eq.${id}&user_id=eq.${owner.id}&status=eq.active`,
      prefer: 'return=representation',
      body: { status: 'revoked' },
    });
    if (!rows?.length) return NextResponse.json({ error: 'Active installation was not found for this owner.' }, { status: 404 });
    try {
      await supabaseInsert('fidulync_owner_audit', {
        owner_email: owner.email, action: 'MT5_INSTALLATION_REVOKED', subject_id: id,
        metadata: { revoked_at: new Date().toISOString() },
      });
    } catch (auditError) {
      console.error('MT5 revocation audit insert failed:', auditError);
      return NextResponse.json({ error: 'Installation is revoked, but the audit event failed. Investigate before further administration.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json({ success: true, id, status: 'revoked' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('MT5 installation revocation failed:', error);
    return NextResponse.json({ error: 'Installation could not be revoked.' }, { status: 503 });
  }
}
