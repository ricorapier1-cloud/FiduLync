import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { isSupabaseConfigured, supabaseQuery } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    const paystackSignature = req.headers.get('x-paystack-signature') ?? '';

    const secret = process.env.PAYSTACK_SECRET_KEY?.trim() ?? '';
    if (!secret) {
      return NextResponse.json({ error: 'Server secret missing' }, { status: 500 });
    }

    const expectedSignature = crypto
      .createHmac('sha512', secret)
      .update(bodyText)
      .digest('hex');

    if (expectedSignature !== paystackSignature) {
      return NextResponse.json({ error: 'Unauthorized webhook signature' }, { status: 401 });
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    if (payload.event === 'charge.success') {
      const data = (payload.data as Record<string, unknown>) ?? {};
      const reference = String(data.reference ?? '');
      const customer = (data.customer as Record<string, unknown>) ?? {};
      const email = String(customer.email ?? '').trim().toLowerCase();
      const amount = Number(data.amount ?? 0) / 100;
      const metadata = (data.metadata as Record<string, unknown>) ?? {};
      const mt5Account = Number(metadata.mt5_account ?? 0);
      const tier = String(metadata.tier ?? 'INSTITUTIONAL_PRO');

      if (isSupabaseConfigured()) {
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
        }).catch((error) => {
          console.warn('Webhook transaction record error:', error);
        });

        if (mt5Account > 0) {
          const licenseKey = `ALGOLYNX-${mt5Account}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

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
          }).catch((error) => {
            console.warn('Webhook license provision error:', error);
          });
        }
      }
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Webhook error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
