import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const result = await requireUser(request);
  if ('response' in result) return result.response;

  try {
    const { data, error } = await result.supabase
      .from('escrow_deals')
      .select('reference,item_name,title,description,amount,currency,status,created_at,funded_at,inspection_deadline')
      .or(`created_by.eq.${result.user.id},buyer_id.eq.${result.user.id},seller_id.eq.${result.user.id}`)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    return NextResponse.json({ deals: data ?? [] }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('Unable to load the authenticated user escrow history:', error);
    return NextResponse.json({ error: 'Unable to load your transaction history.' }, { status: 503 });
  }
}
