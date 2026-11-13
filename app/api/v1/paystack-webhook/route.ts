import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    const paystackSignature = req.headers.get('x-paystack-signature');
    const secret = process.env.ALGO_PRIVATE_API_KEY || process.env.PAYSTACK_SECRET_KEY || '';

    if (!secret) {
      return NextResponse.json({ error: 'Server secret missing' }, { status: 500 });
    }

    const hash = crypto.createHmac('sha512', secret).update(bodyText).digest('hex');
    if (hash !== paystackSignature) {
      return NextResponse.json({ error: 'Unauthorized webhook signature' }, { status: 401 });
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Webhook error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
