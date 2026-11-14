import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { isSupabaseConfigured, supabaseQuery } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    const paystackSignature = req.headers.get('x-paystack-signature');
    const secret = process.env.PAYSTACK_SECRET_KEY || process.env.ALGO_PRIVATE_API_KEY || '';

    if (!secret) {
      return NextResponse.json({ error: 'Server secret missing' }, { status: 500 });
    }

    const hash = crypto.createHmac('sha512', secret).update(bodyText).digest('hex');
    if (hash !== paystackSignature) {
      return NextResponse.json({ error: 'Unauthorized webhook signature' }, { status: 401 });
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    if (payload.event === 'charge.success') {
      const data = (payload.data as Record<string, unknown>) || {};
      const reference = String(data.reference || '');
      const customer = (data.customer as Record<string, unknown>) || {};
      const email = String(customer.email || '').toLowerCase();
      const amount = Number(data.amount || 0) / 100;
      const metadata = (data.metadata as Record<string, unknown>) || {};
      const mt5Account = Number(metadata.mt5_account || 0);
      const tier = String(metadata.tier || 'INSTITUTIONAL_PRO');

      if (isSupabaseConfigured()) {
        const licenseKey = `ALGOLYNX-${mt5Account || 'PRO'}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

        await supabaseQuery('transactions', {
          method: 'POST',
          prefer: 'resolution=merge-duplicates',
          body: {
            reference,
            email,
            mt5_account: mt5Account || null,
            amount,
            status: 'paid',
            created_at: new Date().toISOString(),
          },
        }).catch((e) => console.warn('Webhook transaction record error:', e));

        if (mt5Account > 0) {
          await supabaseQuery('licenses', {
            method: 'POST',
            prefer: 'resolution=merge-duplicates',
            body: {
              license_key: licenseKey,
              mt5_account: mt5Account,
              email,
              tier,
              status: 'active',
              created_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            },
          }).catch((e) => console.warn('Webhook license provision error:', e));
        }
      }
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Webhook error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
