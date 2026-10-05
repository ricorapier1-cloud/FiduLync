import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();
    const signature = req.headers.get('x-paystack-signature');
    const secretKey = process.env.PAYSTACK_SECRET_KEY || '';

    const hash = crypto.createHmac('sha512', secretKey).update(bodyText).digest('hex');

    if (hash !== signature) {
      return NextResponse.json({ error: 'Invalid Paystack Signature' }, { status: 401 });
    }

    const event = JSON.parse(bodyText);

    if (event.event === 'charge.success') {
      const data = event.data;
      const metadata = data.metadata;
      
      // Update transaction status in your production database here
      console.log('Payment verified successfully:', data.reference, metadata);
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
