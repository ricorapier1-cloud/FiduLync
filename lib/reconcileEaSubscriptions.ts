import { supabaseQuery, supabaseRead } from '@/lib/supabaseAdmin';

export async function reconcileEaSubscriptions() {
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
  const keys = new Set([...(cancelled ?? []), ...(pastDue ?? [])].map((row) => row.license_key));
  for (const key of keys) {
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
  return { revoked: keys.size, checked_at: now };
}
