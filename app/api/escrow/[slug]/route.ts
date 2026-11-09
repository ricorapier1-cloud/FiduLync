import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const supabase = getSupabaseAdmin();
    const { data: deal, error } = await supabase
      .from('escrow_deals')
      .select('reference,item_name,title,description,amount,currency,fee_payer,platform_fee,buyer_fee,seller_fee,status,funded_at,inspection_deadline,paystack_reference,created_at')
      .eq('reference', slug)
      .maybeSingle();

    if (error) throw error;
    if (!deal) return NextResponse.json({ error: 'Escrow deal not found.' }, { status: 404 });

    return NextResponse.json({
      deal: {
        reference: deal.reference,
        title: deal.item_name || deal.title,
        description: deal.description,
        amount: Number(deal.amount),
        currency: deal.currency,
        fee_payer: deal.fee_payer,
        platform_fee: Number(deal.platform_fee),
        buyer_fee: Number(deal.buyer_fee),
        seller_fee: Number(deal.seller_fee),
        status: deal.status,
        payment_initiated: Boolean(deal.paystack_reference),
        funded_at: deal.funded_at,
        inspection_deadline: deal.inspection_deadline,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Escrow details request failed:', error);
    return NextResponse.json({ error: 'Unable to load escrow details.' }, { status: 503 });
  }
}
