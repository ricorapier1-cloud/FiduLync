import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    const signature = req.headers.get('x-paystack-signature');
    const secret = process.env.PAYSTACK_SECRET_KEY || '';

    // Verify webhook signature from Paystack for security
    const hash = crypto.createHmac('sha512', secret).update(bodyText).digest('hex');
    if (signature && hash !== signature) {
      return NextResponse.json({ error: 'Invalid authorization signature' }, { status: 401 });
    }

    const event = JSON.parse(bodyText);

    // Handle successful subscription ($5/mo) or one-time Algolync Store EA purchase
    if (event.event === 'charge.success') {
      const data = event.data;
      const customerEmail = data.customer.email;
      const amountPaid = data.amount / 100; // converted from kobo/cents
      const metadata = data.metadata || {};
      const mt5AccountNumber = metadata.mt5_account || 'UNBOUND';

      console.log(`[Paystack] Payment successful: ${amountPaid} for ${customerEmail} (MT5: ${mt5AccountNumber})`);

      // Generate secure automated license key for Algolync Store / Terminal Pro
      const licenseKey = 'ALGOLYNX-' + crypto.createHash('sha256').update(customerEmail + mt5AccountNumber + Date.now()).digest('hex').substring(0, 16).toUpperCase();

      // Here you would normally store the licenseKey in Supabase or Upstash Redis
      // bound to mt5AccountNumber and active until subscription expiry.

      return NextResponse.json({ 
        status: 'success', 
        message: 'License provisioned successfully', 
        license_key: licenseKey,
        mt5_account: mt5AccountNumber 
      }, { status: 200 });
    }

    return NextResponse.json({ status: 'ignored_event' }, { status: 200 });
  } catch (error) {
    console.error('[Paystack Webhook Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
