import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

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
  if (!checkRateLimit(getClientIp(req), 20, 60_000)) {
    return NextResponse.json({ success: false, error: 'Too many checkout requests. Please wait.' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const email = String(body?.email || '').trim().toLowerCase();
    const currency: CurrencyCode = body?.currency === 'USD' ? 'USD' : 'NGN';
    const plan: PlanTier = body?.plan === 'LIFETIME' ? 'LIFETIME' : 'MONTHLY';
    const rawAccount = body?.mt5_account;
    const mt5Account = rawAccount === undefined || rawAccount === null || rawAccount === ''
      ? null : Number(rawAccount);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, error: 'Enter a valid subscriber email address.' }, { status: 400 });
    }
    if (mt5Account !== null && (!Number.isSafeInteger(mt5Account) || mt5Account <= 0)) {
      return NextResponse.json({ success: false, error: 'If supplied, the MT5 account number must be a valid positive integer.' }, { status: 400 });
    }

    const paystackSecret = (process.env.PAYSTACK_SECRET_KEY || '').trim();
    if (!paystackSecret.startsWith('sk_')) {
      return NextResponse.json({ success: false, error: 'Online payment is not configured yet. Please try again later.' }, { status: 503 });
    }
    if (paystackSecret.startsWith('sk_live_') && process.env.PAYSTACK_LIVE_ENABLED !== 'true') {
      return NextResponse.json({ success: false, error: 'Live payments are disabled while merchant compliance approval is pending.' }, { status: 503 });
    }

    const reference = `ALGO_${plan}_${currency}_${randomBytes(16).toString('hex').toUpperCase()}`;
    const origin = (process.env.NEXT_PUBLIC_APP_URL || 'https://fidulync.vercel.app').trim().replace(/\/+$/, '');
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
        metadata: {
          product: 'ALGOLYNX_VAULT',
          mt5_account: mt5Account,
          currency,
          tier: plan,
        },
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });

    const psData: unknown = await psRes.json();
    if (!psRes.ok || !psData || typeof psData !== 'object' || !('status' in psData)
      || (psData as { status?: unknown }).status !== true
      || !('data' in psData) || typeof (psData as { data?: unknown }).data !== 'object'
      || !(psData as { data: Record<string, unknown> }).data.authorization_url) {
      const message = psData && typeof psData === 'object' && 'message' in psData
        ? String((psData as { message?: unknown }).message) : 'Paystack checkout initialization failed.';
      return NextResponse.json({ success: false, error: message }, { status: 502 });
    }

    const data = (psData as { data: Record<string, unknown> }).data;
    return NextResponse.json({
      success: true,
      mode: 'paystack_redirect',
      authorization_url: data.authorization_url,
      reference,
      message: 'Complete payment using Paystack. Your MT5 account can be bound after purchase.',
    });
  } catch (error) {
    console.error('Paystack checkout initialization failed:', error);
    return NextResponse.json({ success: false, error: 'Checkout initialization failed. Please retry.' }, { status: 500 });
  }
}
