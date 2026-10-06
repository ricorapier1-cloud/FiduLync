import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-paystack-signature');
    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey || !signature) {
      return NextResponse.json({ error: 'Missing security headers' }, { status: 400 });
    }

    // Verify HMAC SHA-512 Signature
    const hash = crypto
      .createHmac('sha512', secretKey)
      .update(rawBody)
      .digest('hex');

    if (hash !== signature) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    const event = JSON.parse(rawBody);

    if (event.event === 'charge.success') {
      const { reference, metadata } = event.data;
      const dealId = metadata?.deal_id;

      if (dealId) {
        // Lock deal into FUNDED state
        await supabase
          .from('escrow_deals')
          .update({ 
            status: 'FUNDED', 
            updated_at: new Date().toISOString() 
          })
          .eq('id', dealId);
      }
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
