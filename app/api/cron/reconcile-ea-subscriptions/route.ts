import { NextResponse } from 'next/server';
import { isSupabaseConfigured, supabaseQuery, supabaseRead } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const secret = (process.env.CRON_SECRET || '').trim();
  if (!secret) return NextResponse.json({ error: 'Cron authorization is not configured.' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'Subscription database is unavailable.' }, { status: 503 });

  try {
    const now = new Date().toISOString();
    const [cancelled, pastDue] = await Promise.all([
      supabaseRead<Array<{ license_key: string }>>(
        'ea_subscriptions',
        `cancel_at_period_end=eq.true&period_ends_at=lte.${encodeURIComponent(now)}&status=neq.REVOKED&select=license_key&limit=500`
      ),
      supabaseRead<Array<{ license_key: string }>>(
        'ea_subscriptions',
        `status=eq.PAST_DUE&grace_until=lte.${encodeURIComponent(now)}&select=license_key&limit=500`
      ),
    ]);
    const revoke = new Set([...(cancelled ?? []), ...(pastDue ?? [])].map((row) => row.license_key));
    for (const key of revoke) {
      await Promise.all([
        supabaseQuery('ea_subscriptions', {
          method: 'PATCH', query: `license_key=eq.${encodeURIComponent(key)}`,
          body: { status: 'REVOKED', updated_at: now },
        }),
        supabaseQuery('licenses', {
          method: 'PATCH', query: `license_key=eq.${encodeURIComponent(key)}`,
          body: { status: 'REVOKED', updated_at: now },
        }),
      ]);
    }
    return NextResponse.json({ success: true, revoked: revoke.size, checked_at: now });
  } catch (error) {
    console.error('Subscription lifecycle reconciliation failed:', error);
    return NextResponse.json({ success: false, error: 'Subscription reconciliation failed.' }, { status: 503 });
  }
}
