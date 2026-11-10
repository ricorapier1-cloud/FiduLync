import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { normalizeEscrowFees } from '@/lib/feeCalculator';
import { getPaystackSecretKey } from '@/lib/serverConfig';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

type PaystackEvent = {
  event?: string;
  data?: {
    reference?: string;
    status?: string;
    amount?: number;
    currency?: string;
    transaction?: { reference?: string } | string | number;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function handlePaystackWebhook(request: Request) {
  const secret = getPaystackSecretKey();
  const signature = request.headers.get('x-paystack-signature');
  if (!secret) {
    return NextResponse.json({ error: 'Payment webhook processing is not configured.' }, { status: 503 });
  }
  if (!signature || !/^[a-f\d]{128}$/i.test(signature)) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
  }

  const maximumBodyBytes = 1_048_576;
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maximumBodyBytes) {
    return NextResponse.json({ error: 'Webhook payload is too large.' }, { status: 413 });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch (error) {
    console.error('Paystack webhook body could not be read:', error);
    return NextResponse.json({ error: 'Webhook body could not be read.' }, { status: 400 });
  }
  if (Buffer.byteLength(rawBody, 'utf8') > maximumBodyBytes) {
    return NextResponse.json({ error: 'Webhook payload is too large.' }, { status: 413 });
  }

  const digest = createHmac('sha512', secret).update(rawBody).digest('hex');
  if (!timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(digest, 'hex'))) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid webhook body.' }, { status: 400 });
  }

  if (!isRecord(payload) || typeof payload.event !== 'string' || !isRecord(payload.data)) {
    return NextResponse.json({ error: 'Webhook body must include a valid event and data object.' }, { status: 400 });
  }
  const event = payload as PaystackEvent;
  const reference = typeof event.data?.reference === 'string' ? event.data.reference : undefined;
  const refundTransaction = event.event === 'refund.processed' || event.event === 'refund.failed'
    ? event.data?.transaction
    : undefined;
  const relatedReferenceValue = typeof refundTransaction === 'string'
    ? refundTransaction
    : isRecord(refundTransaction)
      ? refundTransaction.reference
      : undefined;
  const relatedReference = typeof relatedReferenceValue === 'string' ? relatedReferenceValue : undefined;
  if (!reference?.startsWith('flx_') && !relatedReference?.startsWith('flx_')) {
    return NextResponse.json({ status: 'ignored' });
  }

  try {
    const supabase = getSupabaseAdmin();

    if (event.event === 'charge.success') {
      const { data: deal, error } = await supabase
        .from('escrow_deals')
        .select('id,amount,currency,fee_payer,buyer_fee,status')
        .eq('paystack_reference', reference)
        .maybeSingle();

      if (error) throw error;
      if (!deal) return NextResponse.json({ error: 'Escrow payment reference not found.' }, { status: 404 });

      const amount = Number(deal.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        console.error('Paystack webhook found invalid escrow terms:', reference);
        return NextResponse.json({ error: 'Escrow payment terms are unavailable.' }, { status: 503 });
      }
      const fees = normalizeEscrowFees(amount, deal.currency, deal.fee_payer, { buyerFee: deal.buyer_fee });
      const expectedAmount = Math.round(fees.total * 100);
      if (
        event.data?.status !== 'success' ||
        Number(event.data.amount) !== expectedAmount ||
        event.data.currency !== deal.currency
      ) {
        console.error('Paystack charge details do not match escrow terms:', { reference, currency: event.data?.currency });
        return NextResponse.json({ error: 'Payment details do not match this escrow.' }, { status: 400 });
      }

      if (deal.status === 'funded') return NextResponse.json({ status: 'already_processed' });
      if (deal.status !== 'pending') return NextResponse.json({ error: 'Escrow is not awaiting payment.' }, { status: 409 });

      const fundedAt = new Date();
      const { data: updated, error: updateError } = await supabase
        .from('escrow_deals')
        .update({
          status: 'funded',
          funded_at: fundedAt.toISOString(),
          inspection_deadline: new Date(fundedAt.getTime() + 48 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', deal.id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();

      if (updateError) throw updateError;
      if (!updated) return NextResponse.json({ status: 'already_processed' });
      return NextResponse.json({ status: 'success' });
    }

    if (event.event === 'transfer.success' || event.event === 'transfer.failed') {
      const { data: payout, error } = await supabase
        .from('disbursements')
        .select('id,deal_id,kind')
        .eq('provider_reference', reference)
        .eq('status', 'processing')
        .maybeSingle();

      if (error) throw error;
      if (!payout) return NextResponse.json({ status: 'already_processed' });

      const succeeded = event.event === 'transfer.success' && event.data?.status === 'success';
      const { error: payoutError } = await supabase
        .from('disbursements')
        .update({ status: succeeded ? 'succeeded' : 'failed', completed_at: succeeded ? new Date().toISOString() : null })
        .eq('id', payout.id)
        .eq('status', 'processing');
      if (payoutError) throw payoutError;

      if (succeeded) {
        const { data: related, error: relatedError } = await supabase
          .from('disbursements')
          .select('kind,status')
          .eq('deal_id', payout.deal_id);
        if (relatedError) throw relatedError;
        if (related?.length && related.every((item) => item.status === 'succeeded')) {
          const hasRefund = related.some((item) => item.kind === 'buyer_refund');
          const hasSellerPayout = related.some((item) => item.kind === 'seller_payout');
          const { error: dealError } = await supabase
            .from('escrow_deals')
            .update({ status: hasRefund && !hasSellerPayout ? 'refunded' : 'released', updated_at: new Date().toISOString() })
            .eq('id', payout.deal_id)
            .in('status', ['funded', 'disputed', 'settling']);
          if (dealError) throw dealError;
        }
      } else {
        console.error('Paystack transfer failed for disbursement:', payout.id);
      }
    }

    if (event.event === 'refund.processed' || event.event === 'refund.failed') {
      const transaction = event.data?.transaction;
      const transactionReference = typeof transaction === 'string'
        ? transaction
        : isRecord(transaction) && typeof transaction.reference === 'string'
          ? transaction.reference || reference
          : reference;
      if (!transactionReference) return NextResponse.json({ status: 'ignored' });
      const { data: deal, error: dealError } = await supabase
        .from('escrow_deals')
        .select('id')
        .eq('paystack_reference', transactionReference)
        .maybeSingle();
      if (dealError) throw dealError;
      if (deal) {
        const succeeded = event.event === 'refund.processed' && event.data?.status !== 'failed';
        const { data: refund, error: refundError } = await supabase
          .from('disbursements')
          .select('id')
          .eq('deal_id', deal.id)
          .eq('kind', 'buyer_refund')
          .eq('status', 'processing')
          .maybeSingle();
        if (refundError) throw refundError;
        if (refund) {
          const { error: updateError } = await supabase
            .from('disbursements')
            .update({ status: succeeded ? 'succeeded' : 'failed', completed_at: succeeded ? new Date().toISOString() : null })
            .eq('id', refund.id)
            .eq('status', 'processing');
          if (updateError) throw updateError;

          if (succeeded) {
            const { data: related, error: relatedError } = await supabase
              .from('disbursements')
              .select('kind,status')
              .eq('deal_id', deal.id);
            if (relatedError) throw relatedError;
            if (related?.length && related.every((item) => item.status === 'succeeded')) {
              const hasSellerPayout = related.some((item) => item.kind === 'seller_payout');
              const hasRefund = related.some((item) => item.kind === 'buyer_refund');
              const { error: updateDealError } = await supabase
                .from('escrow_deals')
                .update({ status: hasRefund && !hasSellerPayout ? 'refunded' : 'released', updated_at: new Date().toISOString() })
                .eq('id', deal.id)
                .in('status', ['funded', 'disputed', 'settling']);
              if (updateDealError) throw updateDealError;
            }
          }
        }
      }
    }

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error('Paystack webhook processing failed:', error);
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 503 });
  }
}
