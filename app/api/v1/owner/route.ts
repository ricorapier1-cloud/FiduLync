import { NextResponse } from 'next/server';
import { getMacroUser } from '@/lib/macroAuth';
import { isMasterOwner } from '@/lib/macroAccess';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await getMacroUser(request);
    if (!user || !isMasterOwner(user)) {
      return NextResponse.json({ error: 'Owner access is required.' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const [
      { data: subscriptions, error: subscriptionsError },
      { data: keys, error: keysError },
    ] = await Promise.all([
      supabase.from('macro_subscriptions')
        .select('reference,user_id,email,status,expected_amount,currency,created_at,activated_at,updated_at')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase.from('macro_api_keys')
        .select('user_id,key_prefix,created_at,revoked_at')
        .order('created_at', { ascending: false })
        .limit(500),
    ]);
    if (subscriptionsError) throw subscriptionsError;
    if (keysError) throw keysError;

    const activeSubscriptions = (subscriptions ?? []).filter((item) => item.status === 'active');
    const userIds = [...new Set((keys ?? []).map((item) => item.user_id))];
    const { data: profiles, error: profilesError } = userIds.length
      ? await supabase.from('profiles').select('id,email').in('id', userIds)
      : { data: [], error: null };
    if (profilesError) throw profilesError;
    const emailsByUserId = new Map((profiles ?? []).map((profile) => [profile.id, profile.email]));

    return NextResponse.json({
      metrics: {
        activeSubscribers: activeSubscriptions.length,
        monthlyRecurringRevenueNgn: activeSubscriptions.reduce((sum, item) => sum + item.expected_amount / 100, 0),
        totalSubscriptions: (subscriptions ?? []).length,
      },
      subscribers: (subscriptions ?? []).map((item) => ({
        reference: item.reference,
        email: item.email,
        status: item.status,
        amountNgn: item.expected_amount / 100,
        createdAt: item.created_at,
        renewsAt: item.status === 'active' ? item.updated_at : null,
      })),
      apiKeys: (keys ?? []).map((item) => ({
        email: emailsByUserId.get(item.user_id) ?? 'Unknown account',
        prefix: item.key_prefix,
        createdAt: item.created_at,
        active: item.revoked_at === null,
      })),
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    console.error('Owner macro dashboard could not be loaded:', error);
    return NextResponse.json({ error: 'Owner dashboard data is temporarily unavailable.' }, { status: 503 });
  }
}
