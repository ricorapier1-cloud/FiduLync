import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FX_BUFFER_RATE = 0.005; // 0.50% cushion against cross-border fluctuations

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { buyerId, sellerId, title, baseCurrency, buyerCurrency, baseAmount } = body;

    if (!buyerId || !sellerId || !baseAmount || !baseCurrency || !buyerCurrency) {
      return NextResponse.json({ error: 'Missing required payload params' }, { status: 400 });
    }

    // 1. Fetch current exchange rate internally
    let exchangeRate = 1.0;

    if (baseCurrency !== buyerCurrency) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const fxRes = await fetch(`${baseUrl}/api/fx/rate?base=${baseCurrency}&target=${buyerCurrency}`);
      
      if (!fxRes.ok) {
        throw new Error('Unable to resolve current exchange rate');
      }

      const fxData = await fxRes.json();
      exchangeRate = fxData.rate;
    }

    // 2. Apply safety buffer and calculate total charged amount
    const effectiveRate = exchangeRate * (1 + FX_BUFFER_RATE);
    const chargedAmount = Number((baseAmount * effectiveRate).toFixed(2));

    // 3. Freeze & persist transaction snapshot in Supabase
    const { data: transaction, error } = await supabase
      .from('escrow_transactions')
      .insert({
        buyer_id: buyerId,
        seller_id: sellerId,
        title,
        base_currency: baseCurrency,
        buyer_currency: buyerCurrency,
        base_amount: baseAmount,
        locked_exchange_rate: exchangeRate,
        fx_buffer_percent: FX_BUFFER_RATE,
        effective_rate: effectiveRate,
        charged_amount: chargedAmount,
        status: 'pending',
        rate_locked_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      transactionId: transaction.id,
      paymentSummary: {
        itemPrice: `${baseAmount} ${baseCurrency}`,
        lockedRate: `1 ${baseCurrency} = ${exchangeRate.toFixed(4)} ${buyerCurrency}`,
        chargedTotal: `${chargedAmount} ${buyerCurrency}`,
        rateLockedAt: transaction.rate_locked_at,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Checkout creation failed' }, { status: 500 });
  }
}
