import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, amount, metadata, callbackUrl } = body;
    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      return NextResponse.json({ error: 'PAYSTACK_SECRET_KEY is not configured' }, { status: 500 });
    }

    const payload = {
      email,
      amount: Math.round(Number(amount) * 100), // Kobo / Cents conversion
      callback_url: callbackUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'https://fidulync.vercel.app'}/dashboard`,
      metadata: metadata || {},
    };

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!data.status) {
      return NextResponse.json({ error: data.message || 'Payment initialization failed' }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server Error' }, { status: 500 });
  }
}
