import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const OWNER_EMAIL = 'ricorapier1@gmail.com';

async function ownerFromRequest(request: Request) {
  const auth = request.headers.get('authorization') || '';
  const accessToken = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!accessToken) return null;
  const { data, error } = await getSupabaseAdmin().auth.getUser(accessToken);
  if (error || !data.user || data.user.email?.toLowerCase() !== OWNER_EMAIL) return null;
  return data.user;
}

export async function GET(request: Request) {
  try {
    const user = await ownerFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Owner access denied.' }, { status: 403 });
    const { data, error } = await getSupabaseAdmin().from('mt5_installations')
      .select('id,label,status,created_at,last_seen_at,broker,server')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(20);
    if (error) throw error;
    return NextResponse.json({ installations: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('MT5 installation listing failed:', error);
    return NextResponse.json({ error: 'Unable to list MT5 installations.' }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await ownerFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Owner access denied.' }, { status: 403 });
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || !('installation_id' in body)
      || typeof body.installation_id !== 'string') return NextResponse.json({ error: 'Installation ID required.' }, { status: 400 });
    const { data, error } = await getSupabaseAdmin().from('mt5_installations')
      .update({ status: 'revoked' }).eq('id', body.installation_id).eq('user_id', user.id)
      .select('id').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Installation not found.' }, { status: 404 });
    return NextResponse.json({ revoked: true });
  } catch (error) {
    console.error('MT5 installation revocation failed:', error);
    return NextResponse.json({ error: 'Unable to revoke MT5 installation.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const auth = request.headers.get('authorization') || '';
  const accessToken = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!accessToken) return NextResponse.json({ error: 'Owner authentication required.' }, { status: 401 });

  try {
    const supabase = getSupabaseAdmin();
    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !authData.user || authData.user.email?.toLowerCase() !== OWNER_EMAIL) {
      return NextResponse.json({ error: 'Owner access denied.' }, { status: 403 });
    }

    let body: unknown = {};
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }
    const label = typeof body === 'object' && body !== null && 'label' in body && typeof body.label === 'string'
      ? body.label.trim().slice(0, 80) : 'MT5 terminal';
    const { count, error: countError } = await supabase.from('mt5_installations')
      .select('id', { count: 'exact', head: true }).eq('user_id', authData.user.id).eq('status', 'active');
    if (countError) throw countError;
    if ((count ?? 0) >= 10) return NextResponse.json({ error: 'Maximum of 10 active MT5 installations reached.' }, { status: 409 });

    const token = `flmt5_${randomBytes(32).toString('base64url')}`;
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const { data, error } = await supabase.from('mt5_installations')
      .insert({ user_id: authData.user.id, label: label || 'MT5 terminal', token_hash: tokenHash, status: 'active' })
      .select('id,label,created_at').single();
    if (error) throw error;

    return NextResponse.json({
      installation: data,
      token,
      warning: 'This token is shown once. Store it privately in the MT5 connector inputs. Revoke it immediately if exposed.',
    }, { status: 201, headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('MT5 installation provisioning failed:', error);
    return NextResponse.json({ error: 'Unable to provision MT5 installation.' }, { status: 503 });
  }
}
