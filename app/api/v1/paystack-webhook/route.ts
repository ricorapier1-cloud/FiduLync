import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { isSupabaseConfigured, supabaseQuery } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    const signature = req.headers.get('x-paystack-signature');
    const secret = process.env.PAYSTACK_SECRET_KEY || process.env.ALGO_PRIVATE_API_KEY || '';

    if (!secret) {
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    const expectedHash = crypto.createHmac('sha512', secret).update(bodyText).digest('hex');
    if (expectedHash !== signature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(bodyText);
    if (payload.event === 'charge.success') {
      const data = payload.data || {};
      const email = String(data.customer?.email || '').toLowerCase();
      const reference = String(data.reference || '');
      const amount = Number(data.amount || 0) / 100;
      const mt5Account = Number(data.metadata?.mt5_account || 0);
      const licenseKey = `ALGOLYNX-${mt5Account || 'PRO'}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

      if (isSupabaseConfigured()) {
        await supabaseQuery('transactions', {
          method: 'POST',
          prefer: 'resolution=ignore-duplicates',
          body: { reference, email, mt5_account: mt5Account || null, amount, status: 'success' },
        });

        if (mt5Account > 0) {
          await supabaseQuery('licenses', {
            method: 'POST',
            body: {
              license_key: licenseKey,
              mt5_account: mt5Account,
              email,
              tier: 'INSTITUTIONAL_PRO',
              status: 'active',
            },
          });
        }
      }
    }

    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Webhook processing failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
