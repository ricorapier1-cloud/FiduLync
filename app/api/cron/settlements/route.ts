import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getPaystackSecretKey } from '@/lib/serverConfig';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

export const dynamic = 'force-dynamic';

function validCronRequest(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get('authorization') || '';
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authorization);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function paystackRequest(path: string, method: 'GET' | 'POST', payload?: Record<string, unknown>) {
  const secret = getPaystackSecretKey();
  if (!secret) throw new Error('Paystack is not configured.');

  const response = await fetch(`https://api.paystack.co${path}`, {
    method,
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
    signal: AbortSignal.timeout(15_000),
  });
  const result = await response.json();
  if (!response.ok || result.status !== true) throw new Error(result.message || 'Paystack request failed.');
  return result.data;
}

async function finalizeCompletedDisbursements(supabase: ReturnType<typeof getSupabaseAdmin>, dealId: string) {
  const { data: related, error } = await supabase
    .from('disbursements')
    .select('kind,status')
    .eq('deal_id', dealId);
  if (error) throw error;
  if (!related?.length || !related.every((item) => item.status === 'succeeded')) return;

  const hasRefund = related.some((item) => item.kind === 'buyer_refund');
  const hasSellerPayout = related.some((item) => item.kind === 'seller_payout');
  const { error: updateError } = await supabase
    .from('escrow_deals')
    .update({ status: hasRefund && !hasSellerPayout ? 'refunded' : 'released', updated_at: new Date().toISOString() })
    .eq('id', dealId)
    .in('status', ['funded', 'disputed', 'settling']);
  if (updateError) throw updateError;
}

async function prepareDueSettlements(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { data, error } = await supabase.rpc('queue_expired_fidulync_settlements');
  if (error) throw error;
  return Number(data) || 0;
}

async function processDisbursement(supabase: ReturnType<typeof getSupabaseAdmin>, disbursement: {
  id: string;
  deal_id: string;
  kind: string;
  amount: number;
  currency: string;
  status: string;
  provider_reference: string | null;
  audit_metadata: Record<string, unknown>;
}): Promise<boolean> {
  if (disbursement.status === 'processing') return true;

  const { data: deal, error: dealError } = await supabase
    .from('escrow_deals')
    .select('id,currency,seller_account,seller_account_number,seller_account_name,seller_bank_code,paystack_reference')
    .eq('id', disbursement.deal_id)
    .single();
  if (dealError) throw dealError;

  const providerReference = disbursement.provider_reference || `flx_${disbursement.id.replaceAll('-', '')}`;
  const { data: claimed, error: claimError } = await supabase
    .from('disbursements')
    .update({ status: 'processing', provider_reference: providerReference })
    .eq('id', disbursement.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return true;

  try {
    if (disbursement.kind === 'buyer_refund') {
      if (!deal.paystack_reference) throw new Error('Original Paystack transaction reference is missing.');
      const refund = await paystackRequest('/refund', 'POST', {
        transaction: deal.paystack_reference,
        amount: Math.round(Number(disbursement.amount) * 100),
        currency: disbursement.currency,
        merchant_note: `FiduLync escrow ${deal.id}`,
        customer_note: 'FiduLync escrow refund',
      });
      if (refund.status === 'processed' || refund.status === 'success') {
        const { error: updateError } = await supabase.from('disbursements')
          .update({ status: 'succeeded', completed_at: new Date().toISOString(), audit_metadata: { ...disbursement.audit_metadata, provider_status: refund.status } })
          .eq('id', disbursement.id)
          .eq('status', 'processing');
        if (updateError) throw updateError;
        await finalizeCompletedDisbursements(supabase, disbursement.deal_id);
      }
      return true;
    }

    if (disbursement.kind !== 'seller_payout') throw new Error('Unsupported disbursement type.');
    if (disbursement.currency !== 'NGN') throw new Error('Automated bank transfers are currently available for NGN settlements only.');
    const accountNumber = deal.seller_account_number || deal.seller_account;
    if (!accountNumber || !deal.seller_bank_code || !deal.seller_account_name) {
      throw new Error('Seller bank settlement details are incomplete.');
    }

    const recipient = await paystackRequest('/transferrecipient', 'POST', {
      type: 'nuban',
      name: deal.seller_account_name,
      account_number: accountNumber,
      bank_code: deal.seller_bank_code,
      currency: disbursement.currency,
    });
    const transfer = await paystackRequest('/transfer', 'POST', {
      source: 'balance',
      amount: Math.round(Number(disbursement.amount) * 100),
      recipient: recipient.recipient_code,
      reference: providerReference,
      reason: `FiduLync escrow ${deal.id}`,
    });

    const { error: updateError } = await supabase.from('disbursements')
      .update({ audit_metadata: { ...disbursement.audit_metadata, transfer_code: transfer.transfer_code } })
      .eq('id', disbursement.id)
      .eq('status', 'processing');
    if (updateError) throw updateError;
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Settlement provider error.';
    console.error('Escrow disbursement could not be initiated:', { disbursementId: disbursement.id, message });
    return false;
  }
}

export async function GET(request: Request) {
  if (!validCronRequest(request)) {
    return NextResponse.json({ error: 'Authorized scheduler access required.' }, { status: 401 });
  }
  if (!getPaystackSecretKey()) {
    return NextResponse.json({ error: 'Payment settlement is not configured.' }, { status: 503 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const queued = await prepareDueSettlements(supabase);
    const { data: disbursements, error } = await supabase
      .from('disbursements')
      .select('id,deal_id,kind,amount,currency,status,provider_reference,audit_metadata')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(100);
    if (error) throw error;

    const processResults = await Promise.allSettled((disbursements || []).map((item) => processDisbursement(supabase, item)));
    const failures = processResults.filter((item) => item.status === 'rejected' || !item.value).length;
    if (failures) {
      console.error('Some escrow settlement records could not be processed:', { failures });
      return NextResponse.json({ error: 'Some settlement records could not be processed.', queued_settlements: queued, failures }, { status: 503 });
    }
    return NextResponse.json({ queued_settlements: queued, processed: disbursements?.length || 0 });
  } catch (error) {
    console.error('Hourly settlement job failed:', error);
    return NextResponse.json({ error: 'Hourly settlement job failed.' }, { status: 503 });
  }
}
