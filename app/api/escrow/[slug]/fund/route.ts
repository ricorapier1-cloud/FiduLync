import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

const currencies = new Set(['NGN', 'USD', 'GBP', 'EUR', 'GHS', 'KES']);

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let email: unknown;
  try {
    ({ email } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Enter a valid payment email address.' }, { status: 400 });
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: 'Payment processing is not configured.' }, { status: 503 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: deal, error } = await supabase
      .from('escrow_deals')
      .select('reference,item_name,title,amount,currency,buyer_fee,platform_fee,status,paystack_reference')
      .eq('reference', slug)
      .maybeSingle();

    if (error) throw error;
    if (!deal) return NextResponse.json({ error: 'Escrow deal not found.' }, { status: 404 });
    if (deal.status !== 'pending') return NextResponse.json({ error: 'This deal is no longer available for funding.' }, { status: 409 });
    if (!currencies.has(deal.currency)) return NextResponse.json({ error: 'This deal uses an unsupported payment currency.' }, { status: 400 });
    if (deal.paystack_reference) return NextResponse.json({ error: 'Payment is already being initialized for this deal.' }, { status: 409 });

    const total = Number(deal.amount) + Number(deal.buyer_fee);
    if (!Number.isFinite(total) || total <= 0) throw new Error('Stored deal amount is invalid.');

    const paymentReference = `flx_${randomBytes(16).toString('hex')}`;
    const { data: claimedDeal, error: claimError } = await supabase
      .from('escrow_deals')
      .update({ paystack_reference: paymentReference, buyer_email: email })
      .eq('reference', slug)
      .eq('status', 'pending')
      .is('paystack_reference', null)
      .select('reference')
      .maybeSingle();

    if (claimError) throw claimError;
    if (!claimedDeal) return NextResponse.json({ error: 'Payment is already being initialized for this deal.' }, { status: 409 });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: Math.round(total * 100),
        currency: deal.currency,
        reference: paymentReference,
        callback_url: `${baseUrl}/pay/${encodeURIComponent(slug)}?payment=return`,
        metadata: {
          escrow_reference: deal.reference,
          item_name: deal.item_name || deal.title,
          platform_fee: Number(deal.platform_fee),
        },
      }),
    });

    const result = await paystackResponse.json();
    if (!paystackResponse.ok || result.status !== true || !result.data?.authorization_url) {
      await supabase.from('escrow_deals')
        .update({ paystack_reference: null, buyer_email: null })
        .eq('reference', slug)
        .eq('paystack_reference', paymentReference);
      return NextResponse.json({ error: result.message || 'Payment provider could not initialize checkout.' }, { status: 502 });
    }

    return NextResponse.json({ authorization_url: result.data.authorization_url });
  } catch (error) {
    console.error('Paystack escrow initialization failed:', error);
    return NextResponse.json({ error: 'Unable to initialize escrow payment.' }, { status: 503 });
  }
}
