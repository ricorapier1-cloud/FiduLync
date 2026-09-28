import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get('x-paystack-signature');
    const secret = process.env.PAYSTACK_SECRET_KEY || '';

    const expectedSignature = crypto
      .createHmac('sha512', secret)
      .update(body)
      .digest('hex');

    if (!signature || signature !== expectedSignature) {
      return NextResponse.json({ message: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(body);

    if (event.event === 'charge.success') {
      const transactionId = event.data?.metadata?.transaction_id;

      if (transactionId) {
        const { error } = await supabase
          .from('transactions')
          .update({
            status: 'funds_in_escrow',
            paystack_reference: event.data.reference,
            updated_at: new Date().toISOString(),
          })
          .eq('id', transactionId);

        if (error) {
          console.error('Database update error:', error);
        }
      }
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
