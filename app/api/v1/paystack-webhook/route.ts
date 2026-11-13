import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    const paystackSignature = req.headers.get('x-paystack-signature');

    const secret = process.env.ALGO_PRIVATE_API_KEY || process.env.PAYSTACK_SECRET_KEY || '';
    const hash = crypto
      .createHmac('sha512', secret)
      .update(bodyText)
      .digest('hex');

    if (hash !== paystackSignature) {
      return NextResponse.json({ error: 'Unauthorized webhook signature' }, { status: 401 });
    }

    const event = JSON.parse(bodyText);
    if (event.event === 'charge.success') {
      // Successful charge: Process license key generation and account binding
      const customerEmail = event.data.customer.email;
      const amountPaid = event.data.amount;
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
