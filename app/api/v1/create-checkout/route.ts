import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { checkRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

type PlanTier = 'MONTHLY' | 'LIFETIME';
type CurrencyCode = 'NGN' | 'USD';

const PRICING: Record<PlanTier, Record<CurrencyCode, { minorUnits: number; label: string }>> = {
  MONTHLY: {
    NGN: { minorUnits: 6500000, label: '₦65,000 / mo' },
    USD: { minorUnits: 4900, label: '$49 / mo' },
  },
  LIFETIME: {
    NGN: { minorUnits: 25000000, label: '₦250,000 Lifetime' },
    USD: { minorUnits: 19900, label: '$199 Lifetime' },
  },
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
    const currency: CurrencyCode = body?.currency === 'USD' ? 'USD' : 'NGN';
    const plan: PlanTier = body?.plan === 'LIFETIME' ? 'LIFETIME' : 'MONTHLY';

    if (!email.includes('@') || !Number.isFinite(mt5Account) || mt5Account <= 0) {
      return NextResponse.json({ success: false, error: 'Enter a valid email and MT5 account number.' }, { status: 400 });
    }

    const paystackSecret = (process.env.PAYSTACK_SECRET_KEY || '').trim();
    const reference = `ALGO_${plan}_${currency}_${mt5Account}_${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

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
          amount: PRICING[plan][currency].minorUnits,
          currency,
          reference,
          callback_url: `${origin}/store?ref=${reference}`,
          metadata: { mt5_account: mt5Account, currency, tier: plan },
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

    const licenseKey = `ALGOLYNX-${plan === 'LIFETIME' ? 'LT' : 'MO'}-${mt5Account}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    return NextResponse.json({
      success: true,
      mode: 'sandbox_instant',
      license_key: licenseKey,
      download_url: '/downloads/AlgoLync_EA_README.txt',
      plan,
      currency,
      email,
      mt5_account: mt5Account,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Checkout initialization failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
