import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { checkRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

const PRICING: Record<'NGN' | 'USD', { minorUnits: number; label: string }> = {
  NGN: { minorUnits: 15000000, label: '₦150,000 / mo' },
  USD: { minorUnits: 10000, label: '$100 / mo' },
};

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
  if (!checkRateLimit(ip, 15, 60000)) {
    return NextResponse.json({ success: false, error: 'Too many checkout requests.' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const email = String(body?.email || '').trim().toLowerCase();
    const mt5Account = Number(body?.mt5_account || 0);
    const currency = body?.currency === 'USD' ? 'USD' : 'NGN';

    if (!email.includes('@') || !Number.isFinite(mt5Account) || mt5Account <= 0) {
      return NextResponse.json({ success: false, error: 'Enter a valid email and MT5 account number.' }, { status: 400 });
    }

    const paystackSecret = (process.env.PAYSTACK_SECRET_KEY || '').trim();
    const reference = `ALGO_${currency}_${mt5Account}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

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
          amount: PRICING[currency].minorUnits,
          currency,
          reference,
          callback_url: `${origin}/store?ref=${reference}`,
          metadata: { mt5_account: mt5Account, currency, tier: 'INSTITUTIONAL_PRO' },
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
      return NextResponse.json({
        success: false,
        error: psData?.message || `Paystack ${currency} initialization rejected. Ensure ${currency} is enabled in Paystack settings.`,
      }, { status: 400 });
    }

    const licenseKey = `ALGOLYNX-${mt5Account}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    return NextResponse.json({
      success: true,
      mode: 'sandbox_instant',
      license_key: licenseKey,
      currency,
      email,
      mt5_account: mt5Account,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Checkout initialization failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
