import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, amount, metadata, callbackUrl } = body;
    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      const mockRef = 'fid_' + Math.random().toString(36).substring(2, 10);
      return NextResponse.json({
        status: true,
        data: {
          authorization_url: `https://checkout.paystack.com/mock-gateway-${mockRef}`,
          reference: mockRef,
        },
      });
    }

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: Math.round(Number(amount) * 100),
        callback_url: callbackUrl || 'https://fidulync.vercel.app/dashboard',
        metadata,
      }),
    });

    const data = await paystackRes.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Payment initialization failed' }, { status: 500 });
  }
}
