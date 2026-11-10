import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { ESCROW_TERMS_VERSION } from '@/lib/escrowTerms';
import { normalizeEscrowFees } from '@/lib/feeCalculator';
import { getAppOrigin, getPaystackSecretKey } from '@/lib/serverConfig';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

const currencies = new Set(['NGN', 'USD', 'GBP', 'EUR', 'GHS', 'KES']);

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let email: unknown;
  let termsAccepted: unknown;
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'A valid checkout request is required.' }, { status: 400 });
    }
    ({ email, terms_accepted: termsAccepted } = body as { email?: unknown; terms_accepted?: unknown });
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Enter a valid payment email address.' }, { status: 400 });
  }
  if (termsAccepted !== true) {
    return NextResponse.json({ error: 'Accept the Terms of Service before funding this deal.' }, { status: 400 });
  }

  const secretKey = getPaystackSecretKey();
  if (!secretKey) {
    return NextResponse.json({ error: 'Payment processing is not configured.' }, { status: 503 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: deal, error } = await supabase
      .from('escrow_deals')
      .select('reference,item_name,title,amount,currency,fee_payer,buyer_fee,platform_fee,status,paystack_reference')
      .eq('reference', slug)
      .maybeSingle();

    if (error) throw error;
    if (!deal) return NextResponse.json({ error: 'Escrow deal not found.' }, { status: 404 });
    if (deal.status !== 'pending') return NextResponse.json({ error: 'This deal is no longer available for funding.' }, { status: 409 });
    if (!currencies.has(deal.currency)) return NextResponse.json({ error: 'This deal uses an unsupported payment currency.' }, { status: 400 });
    if (deal.paystack_reference) return NextResponse.json({ error: 'Payment is already being initialized for this deal.' }, { status: 409 });

    const amount = Number(deal.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      console.error('Paystack checkout received an invalid stored escrow amount:', slug);
      return NextResponse.json({ error: 'Escrow deal terms are unavailable.' }, { status: 503 });
    }
    const fees = normalizeEscrowFees(amount, deal.currency, deal.fee_payer, {
      platformFee: deal.platform_fee,
      buyerFee: deal.buyer_fee,
    });
    const total = fees.total;

    const paymentReference = `flx_${randomBytes(16).toString('hex')}`;
    const { data: claimedDeal, error: claimError } = await supabase
      .from('escrow_deals')
      .update({
        paystack_reference: paymentReference,
        buyer_email: email,
        buyer_terms_accepted_at: new Date().toISOString(),
        buyer_terms_version: ESCROW_TERMS_VERSION,
      })
      .eq('reference', slug)
      .eq('status', 'pending')
      .is('paystack_reference', null)
      .select('reference')
      .maybeSingle();

    if (claimError) throw claimError;
    if (!claimedDeal) return NextResponse.json({ error: 'Payment is already being initialized for this deal.' }, { status: 409 });

    const clearPaymentClaim = async () => {
      const { data: clearedClaim, error: clearError } = await supabase.from('escrow_deals')
        .update({ paystack_reference: null, buyer_email: null })
        .eq('reference', slug)
        .eq('paystack_reference', paymentReference)
        .eq('status', 'pending')
        .select('reference')
        .maybeSingle();
      if (clearError) {
        console.error('Could not release failed Paystack checkout claim:', clearError);
        return false;
      }
      return Boolean(clearedClaim);
    };

    const baseUrl = getAppOrigin(request);
    let paystackResponse: Response;
    try {
      paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
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
            platform_fee: fees.actualFee,
          },
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      const released = await clearPaymentClaim();
      console.error('Paystack checkout initialization request failed:', error);
      return NextResponse.json({
        error: released
          ? error instanceof Error && error.name === 'TimeoutError'
            ? 'Payment checkout timed out before it could be started. No payment was taken; please try again.'
            : 'Unable to reach the payment provider. No payment was taken; please try again.'
          : 'Checkout status is uncertain. Please contact support before trying again.',
      }, { status: 503 });
    }

    let result: unknown;
    try {
      result = await paystackResponse.json();
    } catch (error) {
      const released = await clearPaymentClaim();
      console.error('Paystack returned an unreadable checkout response:', error);
      return NextResponse.json({
        error: released
          ? 'Payment provider returned an invalid response. No payment was taken; please try again.'
          : 'Checkout status is uncertain. Please contact support before trying again.',
      }, { status: 502 });
    }

    const resultRecord = result && typeof result === 'object'
      ? result as Record<string, unknown>
      : {};
    const resultData = resultRecord.data && typeof resultRecord.data === 'object'
      ? resultRecord.data as Record<string, unknown>
      : {};
    const authorizationUrl = typeof resultData.authorization_url === 'string'
      ? resultData.authorization_url
      : '';
    let checkoutUrl: URL | null = null;
    try {
      checkoutUrl = new URL(authorizationUrl);
    } catch {
      checkoutUrl = null;
    }
    if (
      !paystackResponse.ok ||
      resultRecord.status !== true ||
      checkoutUrl?.protocol !== 'https:' ||
      checkoutUrl.hostname !== 'checkout.paystack.com'
    ) {
      const released = await clearPaymentClaim();
      const providerMessage = typeof resultRecord.message === 'string' && resultRecord.message.length <= 200
        ? resultRecord.message
        : 'Payment provider could not initialize checkout.';
      return NextResponse.json({
        error: released ? providerMessage : 'Checkout status is uncertain. Please contact support before trying again.',
      }, { status: 502 });
    }

    return NextResponse.json({ authorization_url: checkoutUrl.toString() });
  } catch (error) {
    console.error('Paystack escrow initialization failed:', error);
    return NextResponse.json({ error: 'Unable to initialize escrow payment.' }, { status: 503 });
  }
}
