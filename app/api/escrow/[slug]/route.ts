import { NextResponse } from 'next/server';
import { normalizeEscrowFees } from '@/lib/feeCalculator';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

export const dynamic = 'force-dynamic';

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

    const amount = Number(deal.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      console.error('Escrow details contain an invalid deal amount:', slug);
      return NextResponse.json({ error: 'Escrow deal terms are unavailable.' }, { status: 503 });
    }

    const fees = normalizeEscrowFees(amount, deal.currency, deal.fee_payer, {
      platformFee: deal.platform_fee,
      buyerFee: deal.buyer_fee,
      sellerFee: deal.seller_fee,
    });
    const fundedAt = deal.funded_at && Number.isFinite(Date.parse(deal.funded_at))
      ? deal.funded_at
      : null;
    const storedDeadline = deal.inspection_deadline && Number.isFinite(Date.parse(deal.inspection_deadline))
      ? deal.inspection_deadline
      : null;
    const inspectionDeadline = storedDeadline || (fundedAt
      ? new Date(Date.parse(fundedAt) + 48 * 60 * 60 * 1000).toISOString()
      : null);

    return NextResponse.json({
      deal: {
        reference: deal.reference,
        title: deal.item_name || deal.title,
        description: deal.description,
        amount,
        currency: deal.currency,
        fee_payer: deal.fee_payer === 'buyer' || deal.fee_payer === 'seller' || deal.fee_payer === 'split'
          ? deal.fee_payer
          : 'buyer',
        platform_fee: fees.actualFee,
        buyer_fee: fees.buyerFee,
        seller_fee: fees.sellerFee,
        status: deal.status,
        payment_initiated: Boolean(deal.paystack_reference),
        funded_at: fundedAt,
        inspection_deadline: inspectionDeadline,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Escrow details request failed:', error);
    return NextResponse.json({ error: 'Unable to load escrow details.' }, { status: 503 });
  }
}
