import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getMacroUser } from '@/lib/macroAuth';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

export const dynamic = 'force-dynamic';

const supportedPairs = new Set([
  'EURUSD', 'USDJPY', 'GBPUSD', 'AUDUSD', 'USDCHF',
  'EURGBP', 'EURJPY', 'GBPJPY', 'AUDJPY', 'XAUUSD',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function GET(request: Request) {
  try {
    const user = await getMacroUser(request);
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const supabase = getSupabaseAdmin();
    const [{ data: profile, error: profileError }, { data: keys, error: keysError }] = await Promise.all([
      supabase.from('profiles').select('email,tier_status,custom_fx_watchlist,macro_vip_expires_at').eq('id', user.id).maybeSingle(),
      supabase.from('macro_api_keys').select('key_prefix,created_at').eq('user_id', user.id).is('revoked_at', null).order('created_at', { ascending: false }).limit(1),
    ]);
    if (profileError) throw profileError;
    if (keysError) throw keysError;
    return NextResponse.json({
      email: profile?.email ?? user.email ?? null,
      tierStatus: profile?.tier_status ?? 'free',
      watchlist: profile?.custom_fx_watchlist ?? ['EURUSD'],
      vipExpiresAt: profile?.macro_vip_expires_at ?? null,
      apiKey: keys?.[0] ?? null,
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    console.error('Macro account could not be loaded:', error);
    return NextResponse.json({ error: 'Account data is temporarily unavailable.' }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getMacroUser(request);
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    let body: unknown;
    try {
      body = await request.json() as unknown;
    } catch {
      return NextResponse.json({ error: 'A valid watchlist is required.' }, { status: 400 });
    }
    const watchlist = isRecord(body) && Array.isArray(body.watchlist) ? body.watchlist : null;
    if (!watchlist || watchlist.length < 1 || watchlist.length > 10
      || !watchlist.every((pair): pair is string => typeof pair === 'string' && supportedPairs.has(pair))) {
      return NextResponse.json({ error: 'Select between 1 and 10 supported FX instruments.' }, { status: 400 });
    }
    const normalizedWatchlist = [...new Set(watchlist)];
    const { error } = await getSupabaseAdmin().from('profiles')
      .update({ custom_fx_watchlist: normalizedWatchlist })
      .eq('id', user.id);
    if (error) throw error;
    return NextResponse.json({ watchlist: normalizedWatchlist });
  } catch (error) {
    console.error('Macro watchlist could not be updated:', error);
    return NextResponse.json({ error: 'Watchlist could not be saved.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getMacroUser(request);
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const apiKey = `ml_${randomBytes(32).toString('hex')}`;
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    const supabase = getSupabaseAdmin();
    const { data: created, error: insertError } = await supabase.from('macro_api_keys')
      .insert({ user_id: user.id, key_hash: keyHash, key_prefix: apiKey.slice(0, 10) })
      .select('id,key_prefix,created_at')
      .single();
    if (insertError) throw insertError;

    const { error: revokeError } = await supabase.from('macro_api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('revoked_at', null)
      .neq('id', created.id);
    if (revokeError) {
      await supabase.from('macro_api_keys').update({ revoked_at: new Date().toISOString() }).eq('id', created.id);
      throw revokeError;
    }
    return NextResponse.json({ apiKey, key: created }, { status: 201, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    console.error('MT5 API key could not be created:', error);
    return NextResponse.json({ error: 'API key could not be generated.' }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getMacroUser(request);
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const { error } = await getSupabaseAdmin().from('macro_api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('revoked_at', null);
    if (error) throw error;
    return NextResponse.json({ status: 'revoked' });
  } catch (error) {
    console.error('MT5 API key could not be revoked:', error);
    return NextResponse.json({ error: 'API key could not be revoked.' }, { status: 503 });
  }
}