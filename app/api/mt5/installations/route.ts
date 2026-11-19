import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/serverSupabase';
import { requireOwner } from '@/lib/ownerAuth';
import { enforceDistributedRateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

export async function GET(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) return json({ error: 'Owner authentication required.' }, 401);
  const rate = await enforceDistributedRateLimit(request, 'mt5-installations-read', 30, 60_000);
  if (rate.unavailable) return json({ error: 'MT5 installation service unavailable.' }, 503);
  if (!rate.allowed) return json({ error: 'MT5 installation rate limit exceeded.' }, 429);
  try {
    const { data, error } = await getSupabaseAdmin().from('mt5_installations')
      .select('id,label,status,created_at,last_seen_at,broker,server')
      .eq('user_id', owner.id).order('created_at', { ascending: false }).limit(20);
    if (error) throw error;
    return json({ installations: data ?? [] });
  } catch (error) {
    console.error('MT5 installation listing failed:', error instanceof Error ? error.message : String(error));
    return json({ error: 'Unable to list MT5 installations.' }, 503);
  }
}

export async function POST(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) return json({ error: 'Owner authentication required.' }, 401);
  const rate = await enforceDistributedRateLimit(request, 'mt5-installations-create', 10, 60_000);
  if (rate.unavailable) return json({ error: 'MT5 installation service unavailable.' }, 503);
  if (!rate.allowed) return json({ error: 'MT5 installation rate limit exceeded.' }, 429);
  if (Number(request.headers.get('content-length') ?? 0) > 8192) return json({ error: 'Request body exceeds 8 KB.' }, 413);

  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: 'A valid JSON request is required.' }, 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid request.' }, 400);
  const input = body as Record<string, unknown>;
  const label = typeof input.label === 'string' ? input.label.trim().slice(0, 80) : 'FiduLync MT5 publisher';
  const broker = typeof input.broker === 'string' ? input.broker.trim().slice(0, 100) : null;
  const server = typeof input.server === 'string' ? input.server.trim().slice(0, 120) : null;
  if (!label || (broker && broker.length > 100) || (server && server.length > 120)) return json({ error: 'Invalid installation metadata.' }, 400);

  const token = `flmt5_${randomBytes(32).toString('base64url')}`;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  try {
    const supabase = getSupabaseAdmin();
    const { count, error: countError } = await supabase.from('mt5_installations')
      .select('id', { count: 'exact', head: true }).eq('user_id', owner.id).eq('status', 'active');
    if (countError) throw countError;
    if ((count ?? 0) >= 10) return json({ error: 'Maximum of 10 active MT5 installations reached.' }, 409);

    const { data, error } = await supabase.from('mt5_installations')
      .insert({ user_id: owner.id, label, token_hash: tokenHash, status: 'active', broker, server })
      .select('id,label,created_at').single();
    if (error || !data) throw error || new Error('Installation record was not created.');

    const { error: auditError } = await supabase.from('fidulync_owner_audit').insert({
      owner_email: owner.email, action: 'MT5_INSTALLATION_CREATED', subject_id: data.id,
      metadata: { label, broker, server, token_fingerprint: tokenHash },
    });
    if (auditError) {
      await supabase.from('mt5_installations').update({ status: 'revoked' }).eq('id', data.id).eq('user_id', owner.id);
      throw new Error('Installation audit event could not be committed; the new token was revoked.');
    }

    return json({
      installation: data,
      token,
      warning: 'This token is shown once. Store it privately in the MT5 connector inputs. Revoke it immediately if exposed.',
    }, 201);
  } catch (error) {
    console.error('MT5 installation provisioning failed:', error instanceof Error ? error.message : String(error));
    return json({ error: 'Unable to provision MT5 installation. No token was issued to the browser.' }, 503);
  }
}

export async function DELETE(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) return json({ error: 'Owner authentication required.' }, 401);
  const rate = await enforceDistributedRateLimit(request, 'mt5-installations-revoke', 10, 60_000);
  if (rate.unavailable) return json({ error: 'MT5 installation service unavailable.' }, 503);
  if (!rate.allowed) return json({ error: 'MT5 installation rate limit exceeded.' }, 429);
  if (Number(request.headers.get('content-length') ?? 0) > 8192) return json({ error: 'Request body exceeds 8 KB.' }, 413);

  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: 'A valid JSON request is required.' }, 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid request.' }, 400);
  const id = typeof (body as Record<string, unknown>).installation_id === 'string'
    ? String((body as Record<string, unknown>).installation_id).trim() : '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'A valid installation_id is required.' }, 400);

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('mt5_installations')
      .update({ status: 'revoked' }).eq('id', id).eq('user_id', owner.id).eq('status', 'active')
      .select('id').maybeSingle();
    if (error) throw error;
    if (!data) return json({ error: 'Active installation was not found for this owner.' }, 404);
    const { error: auditError } = await supabase.from('fidulync_owner_audit').insert({
      owner_email: owner.email, action: 'MT5_INSTALLATION_REVOKED', subject_id: id,
      metadata: { revoked_at: new Date().toISOString() },
    });
    if (auditError) throw new Error('Installation was revoked but its audit event failed; investigate immediately.');
    return json({ revoked: true, id, status: 'revoked' });
  } catch (error) {
    console.error('MT5 installation revocation failed:', error instanceof Error ? error.message : String(error));
    return json({ error: 'Unable to confirm MT5 installation revocation.' }, 503);
  }
}
