import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    const paystackSignature = req.headers.get('x-paystack-signature');

    const secret = process.env.ALGO_PRIVATE_API_KEY || process.env.PAYSTACK_SECRET_KEY || '';
    if (!secret) {
      return NextResponse.json({ error: 'Server secret not configured' }, { status: 500 });
    }

    const hash = crypto
      .createHmac('sha512', secret)
      .update(bodyText)
      .digest('hex');

    if (hash !== paystackSignature) {
      return NextResponse.json({ error: 'Unauthorized webhook signature' }, { status: 401 });
    }

    const event = JSON.parse(bodyText);
    if (event.event === 'charge.success') {
      const customerEmail = event.data?.customer?.email || 'unknown';
      const amountPaid = event.data?.amount || 0;
      console.log(`[PAYSTACK] Verified payment from ${customerEmail}: ${amountPaid}`);
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
