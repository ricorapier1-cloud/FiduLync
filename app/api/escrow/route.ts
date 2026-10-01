import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, amount, currency = 'NGN', description, sellerEmail, sellerPhone } = body;

    // 1. Validation
    if (!title || !amount || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Valid title and amount are required.' }, { status: 400 });
    }

    const parsedAmount = Number(amount);
    // Paystack expects amount in lowest subunit (Kobo/Cents)
    const paystackAmount = Math.round(parsedAmount * 100); 

    // 2. Initialize Paystack Transaction
    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: sellerEmail || 'customer@fidulync.com',
        amount: paystackAmount,
        currency: currency.toUpperCase(),
        metadata: {
          title,
          description,
          sellerPhone,
        },
      }),
    });

    const paystackData = await paystackRes.json();

    if (!paystackRes.ok || !paystackData.status) {
      console.error('Paystack API Error:', paystackData);
      return NextResponse.json(
        { error: paystackData.message || 'Failed to initialize Paystack transaction.' },
        { status: 500 }
      );
    }

    // 3. Store Escrow in Supabase
    const { data: escrow, error: dbError } = await supabase
      .from('escrows')
      .insert([
        {
          title,
          amount: parsedAmount,
          currency: currency.toUpperCase(),
          description,
          seller_email: sellerEmail,
          seller_phone: sellerPhone,
          paystack_ref: paystackData.data.reference,
          status: 'pending',
        },
      ])
      .select()
      .single();

    if (dbError) {
      console.error('Supabase DB Error:', dbError);
      return NextResponse.json({ error: 'Failed to save escrow record.' }, { status: 500 });
    }

    // 4. Return success response with authorization URL
    return NextResponse.json({
      success: true,
      checkoutUrl: paystackData.data.authorization_url,
      reference: paystackData.data.reference,
      id: escrow.id,
    });

  } catch (err: any) {
    console.error('Server Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
