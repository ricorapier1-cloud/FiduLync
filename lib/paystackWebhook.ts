import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { normalizeEscrowFees } from '@/lib/feeCalculator';
import { encryptMacroApiKey, generateMacroApiKey } from '@/lib/macroKeys';
import { getPaystackSecretKey } from '@/lib/serverConfig';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

type PaystackEvent = {
  event?: string;
  data?: {
    reference?: string;
    status?: string;
    amount?: number;
    currency?: string;
    paid_at?: string;
    transaction?: { reference?: string } | string | number;
    customer?: { email?: string; customer_code?: string };
    subscription?: { subscription_code?: string; next_payment_date?: string };
    subscription_code?: string;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function handleMacroSubscriptionEvent(event: PaystackEvent) {
  const data = event.data;
  const reference = typeof data?.reference === 'string' ? data.reference : '';
  const subscriptionCode = data?.subscription?.subscription_code ?? data?.subscription_code;
  const supabase = getSupabaseAdmin();
  let lookup = reference.startsWith('macro_')
    ? await supabase.from('macro_subscriptions')
      .select('reference,user_id,email,expected_amount,paystack_subscription_code,last_charge_reference')
      .eq('reference', reference)
      .maybeSingle()
    : { data: null, error: null };
  if (lookup.error) throw lookup.error;
  if (!lookup.data && subscriptionCode) {
    lookup = await supabase.from('macro_subscriptions')
      .select('reference,user_id,email,expected_amount,paystack_subscription_code,last_charge_reference')
      .eq('paystack_subscription_code', subscriptionCode)
      .maybeSingle();
  }
  if (lookup.error) throw lookup.error;
  if (!lookup.data) return NextResponse.json({ status: 'ignored' });

  const subscription = lookup.data;
  if (event.event === 'charge.success') {
    const customerEmail = data?.customer?.email?.trim().toLowerCase();
    if (!reference || data?.status !== 'success'
      || Number(data.amount) !== Number(subscription.expected_amount)
      || data.currency !== 'NGN'
      || (customerEmail && customerEmail !== subscription.email.trim().toLowerCase())) {
      console.error('Paystack VIP charge did not match the stored subscription:', subscription.reference);
      return NextResponse.json({ error: 'Payment details do not match this subscription.' }, { status: 400 });
    }
    const now = new Date();
    const nextPayment = data.subscription?.next_payment_date;
    const paidAt = data.paid_at && Number.isFinite(Date.parse(data.paid_at))
      ? Date.parse(data.paid_at)
      : now.getTime();
    const expiresAt = nextPayment && Number.isFinite(Date.parse(nextPayment))
      ? nextPayment
      : new Date(paidAt + 31 * 24 * 60 * 60 * 1000).toISOString();

    const { data: activeKey, error: keyLookupError } = await supabase.from('macro_api_keys')
      .select('id,encrypted_key')
      .eq('user_id', subscription.user_id)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (keyLookupError) throw keyLookupError;
    if (!activeKey?.encrypted_key) {
      const apiKey = generateMacroApiKey();
      const { data: createdKey, error: keyInsertError } = await supabase.from('macro_api_keys')
        .insert({
          user_id: subscription.user_id,
          key_hash: createHash('sha256').update(apiKey).digest('hex'),
          key_prefix: apiKey.slice(0, 10),
          encrypted_key: encryptMacroApiKey(apiKey),
        })
        .select('id')
        .single();
      if (keyInsertError) throw keyInsertError;
      if (activeKey) {
        const { error: revokeError } = await supabase.from('macro_api_keys')
          .update({ revoked_at: now.toISOString() })
          .eq('id', activeKey.id);
        if (revokeError) throw revokeError;
      }
      if (!createdKey) throw new Error('The automatic MT5 license key was not created.');
    }

    const { error: profileError } = await supabase.from('profiles').update({
      tier_status: 'vip_active',
      macro_vip_expires_at: expiresAt,
    }).eq('id', subscription.user_id);
    if (profileError) throw profileError;

    const subscriptionUpdate: {
      status: 'active';
      paystack_subscription_code: string | null;
      paystack_customer_code: string | null;
      last_charge_reference: string;
      updated_at: string;
      activated_at?: string;
    } = {
      status: 'active',
      paystack_subscription_code: subscriptionCode ?? subscription.paystack_subscription_code,
      paystack_customer_code: data.customer?.customer_code ?? null,
      last_charge_reference: reference || subscription.reference,
      updated_at: now.toISOString(),
    };
    if (subscription.last_charge_reference !== reference) subscriptionUpdate.activated_at = now.toISOString();
    const { error: subscriptionError } = await supabase.from('macro_subscriptions')
      .update(subscriptionUpdate)
      .eq('reference', subscription.reference);
    if (subscriptionError) throw subscriptionError;
    return NextResponse.json({ status: 'success' });
  }

  if (event.event === 'invoice.payment_failed' || event.event === 'subscription.disable') {
    const { error: subscriptionError } = await supabase.from('macro_subscriptions').update({
      status: event.event === 'subscription.disable' ? 'cancelled' : 'past_due',
      updated_at: new Date().toISOString(),
    }).eq('reference', subscription.reference);
    if (subscriptionError) throw subscriptionError;
    const { error: profileError } = await supabase.from('profiles').update({
      tier_status: 'free',
      macro_vip_expires_at: null,
    }).eq('id', subscription.user_id);
    if (profileError) throw profileError;
    return NextResponse.json({ status: 'success' });
  }

  return NextResponse.json({ status: 'ignored' });
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
  const hasMacroSubscriptionCode = typeof event.data?.subscription?.subscription_code === 'string'
    || typeof event.data?.subscription_code === 'string';
  if (reference?.startsWith('macro_') || hasMacroSubscriptionCode) {
    try {
      return await handleMacroSubscriptionEvent(event);
    } catch (error) {
      console.error('Paystack VIP subscription processing failed:', error);
      return NextResponse.json({ error: 'Subscription processing failed.' }, { status: 503 });
    }
  }
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
