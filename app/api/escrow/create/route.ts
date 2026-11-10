import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { calculateEscrowFee } from '@/lib/feeCalculator';
import { ESCROW_TERMS_VERSION } from '@/lib/escrowTerms';
import { resolvePaystackBankAccount } from '@/lib/paystackBank';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

const currencies = new Set(['NGN', 'USD', 'GBP', 'EUR', 'GHS', 'KES']);

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return NextResponse.json({ error: 'A valid escrow request is required.' }, { status: 400 });
  }
  const body = payload as Record<string, unknown>;
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const amount = Number(body.amount);
  const currency = typeof body.currency === 'string' ? body.currency.toUpperCase() : 'NGN';
  const feePayer = body.fee_payer === 'buyer' || body.fee_payer === 'seller' || body.fee_payer === 'split'
    ? body.fee_payer
    : null;
  const accountNumber = typeof body.seller_account_number === 'string' ? body.seller_account_number.trim() : '';
  const bankCode = typeof body.seller_bank_code === 'string' ? body.seller_bank_code.trim() : '';

  if (
    title.length < 2 || title.length > 120 ||
    description.length < 2 || description.length > 2000 ||
    !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000 || Math.round(amount * 100) / 100 !== amount ||
    !currencies.has(currency) ||
    !feePayer ||
    !/^\d{10}$/.test(accountNumber) ||
    !/^[a-zA-Z0-9]{2,10}$/.test(bankCode) ||
    body.terms_accepted !== true
  ) {
    return NextResponse.json({ error: 'Provide valid deal terms, bank details, and accept the Terms of Service.' }, { status: 400 });
  }

  const reference = randomBytes(18).toString('hex');
  const fee = calculateEscrowFee(amount, currency, feePayer);
  const buyerPhone = typeof body.buyer_phone === 'string' ? body.buyer_phone.trim().slice(0, 32) : '';
  const sellerPhone = typeof body.seller_phone === 'string' ? body.seller_phone.trim().slice(0, 32) : null;

  try {
    const supabase = getSupabaseAdmin();
    const accessToken = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    let creatorId: string | null = null;
    if (accessToken) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
      if (authError || !user) {
        return NextResponse.json({ error: 'Your session is invalid or expired.' }, { status: 401 });
      }
      creatorId = user.id;
    }

    const resolution = await resolvePaystackBankAccount(accountNumber, bankCode);
    if (!resolution.ok) {
      return NextResponse.json({ error: resolution.message }, { status: resolution.status });
    }

    const { error } = await supabase.from('escrow_deals').insert({
      reference,
      created_by: creatorId,
      item_name: title,
      title,
      description,
      items_goods_description: description,
      currency,
      amount,
      amount_ngn: amount,
      fee_payer: feePayer,
      platform_fee: fee.actualFee,
      buyer_fee: fee.buyerFee,
      seller_fee: fee.sellerFee,
      buyer_phone: buyerPhone,
      seller_phone: sellerPhone,
      seller_account_name: resolution.accountName,
      seller_account: accountNumber,
      seller_account_number: accountNumber,
      seller_bank_code: bankCode,
      creator_terms_accepted_at: new Date().toISOString(),
      creator_terms_version: ESCROW_TERMS_VERSION,
      status: 'pending',
    });

    if (error) {
      console.error('Escrow creation failed:', error);
      return NextResponse.json({ error: 'Unable to save the escrow deal. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, link_id: reference }, { status: 201 });
  } catch (error) {
    console.error('Escrow creation unavailable:', error);
    return NextResponse.json({ error: 'Escrow service is unavailable.' }, { status: 503 });
  }
}
