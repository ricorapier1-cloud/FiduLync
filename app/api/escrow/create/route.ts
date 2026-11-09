import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { calculateEscrowFee } from '@/lib/feeCalculator';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

const currencies = new Set(['NGN', 'USD', 'GBP', 'EUR', 'GHS', 'KES']);

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const amount = Number(body.amount);
  const currency = typeof body.currency === 'string' ? body.currency.toUpperCase() : 'NGN';
  const feePayer = body.fee_payer === 'buyer' || body.fee_payer === 'seller' || body.fee_payer === 'split'
    ? body.fee_payer
    : null;
  const accountName = typeof body.seller_account_name === 'string' ? body.seller_account_name.trim() : '';
  const accountNumber = typeof body.seller_account_number === 'string' ? body.seller_account_number.trim() : '';
  const bankCode = typeof body.seller_bank_code === 'string' ? body.seller_bank_code.trim() : '';

  if (
    title.length < 2 || title.length > 120 ||
    description.length < 2 || description.length > 2000 ||
    !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000 || Math.round(amount * 100) / 100 !== amount ||
    !currencies.has(currency) ||
    !feePayer ||
    accountName.length < 2 || accountName.length > 100 ||
    !/^\d{10}$/.test(accountNumber) ||
    !/^[a-zA-Z0-9]{2,10}$/.test(bankCode)
  ) {
    return NextResponse.json({ error: 'Please provide valid deal terms and seller settlement details.' }, { status: 400 });
  }

  const reference = randomBytes(18).toString('hex');
  const fee = calculateEscrowFee(amount, currency, feePayer);
  const buyerPhone = typeof body.buyer_phone === 'string' ? body.buyer_phone.trim().slice(0, 32) : '';
  const sellerPhone = typeof body.seller_phone === 'string' ? body.seller_phone.trim().slice(0, 32) : null;

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('escrow_deals').insert({
      reference,
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
      seller_account_name: accountName,
      seller_account: accountNumber,
      seller_account_number: accountNumber,
      seller_bank_code: bankCode,
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
