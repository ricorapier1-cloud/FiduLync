import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { checkRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
  if (!checkRateLimit(ip, 15, 60000)) {
    return NextResponse.json({ success: false, error: 'Too many checkout requests.' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const email = String(body?.email || '').trim().toLowerCase();
    const mt5Account = Number(body?.mt5_account || 0);

    if (!email.includes('@') || mt5Account <= 0) {
      return NextResponse.json({ success: false, error: 'Enter a valid email and MT5 account number.' }, { status: 400 });
    }

    const paystackSecret = process.env.PAYSTACK_SECRET_KEY || '';
    const reference = `ALGO_${mt5Account}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // If Paystack live/test secret is configured, initialize real Paystack checkout
    if (paystackSecret.startsWith('sk_')) {
      const origin = req.headers.get('origin') || 'https://fidulync.vercel.app';
      const psRes = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          amount: 15000000, // NGN 150,000 in kobo (adjust currency/amount in Paystack dashboard)
          reference,
          callback_url: `${origin}/store?ref=${reference}`,
          metadata: {
            mt5_account: mt5Account,
            tier: 'INSTITUTIONAL_PRO',
          },
        }),
      });

      const psData = await psRes.json();
      if (psData?.status && psData?.data?.authorization_url) {
        return NextResponse.json({
          success: true,
          mode: 'paystack_redirect',
          authorization_url: psData.data.authorization_url,
          reference,
        });
      }
    }

    // Fallback instant provisioning when running in sandbox/unconfigured mode
    const licenseKey = `ALGOLYNX-${mt5Account}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    return NextResponse.json({
      success: true,
      mode: 'sandbox_instant',
      license_key: licenseKey,
      email,
      mt5_account: mt5Account,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Checkout initialization failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
