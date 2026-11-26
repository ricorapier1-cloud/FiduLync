import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Authorization' };
function authorized(request: Request): boolean {
  const expected = process.env.MT5_ACCOUNT_READ_TOKEN?.trim() ?? '';
  const header = request.headers.get('authorization')?.trim() ?? '';
  const candidate = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return expected.length >= 32 && a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'A valid private account-read token is required.' }, { status: 401, headers });
  try {
    const supabase = getSupabaseAdmin();
    const { data: accounts, error: accountError } = await supabase.from('mt5_account_snapshots')
      .select('account_key,account_login,broker,server,currency,leverage,account_mode,balance,equity,margin,free_margin,margin_level,positions,observed_at,received_at')
      .order('received_at', { ascending: false }).limit(10);
    if (accountError) throw accountError;
    const keys = (accounts ?? []).map((item) => item.account_key);
    let deals: Record<string, unknown>[] = [];
    if (keys.length) {
      const { data, error } = await supabase.from('mt5_account_deals')
        .select('account_key,deal_ticket,order_ticket,position_id,symbol,side,entry_type,volume,price,profit,commission,swap,fee,deal_time_utc,magic,comment')
        .in('account_key', keys).order('deal_time_utc', { ascending: false }).limit(500);
      if (error) throw error;
      deals = (data ?? []) as Record<string, unknown>[];
    }
    const generatedAtUtc = new Date().toISOString();
    return NextResponse.json({
      status: accounts?.length ? 'CONNECTED' : 'AWAITING_FIRST_SYNC',
      generatedAtUtc,
      accounts: accounts ?? [],
      deals,
    }, { status: 200, headers });
  } catch (error) {
    console.error('MT5 account read failed:', error);
    return NextResponse.json({ error: 'Private account data is temporarily unavailable.' }, { status: 503, headers });
  }
}
