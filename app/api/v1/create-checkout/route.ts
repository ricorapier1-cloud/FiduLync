import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { getEaBySlug } from '@/lib/eaCatalog';

export const dynamic = 'force-dynamic';

type PlanTier = 'MONTHLY' | 'LIFETIME';
type CurrencyCode = 'NGN' | 'USD';

export async function POST(req: Request) {
  if (!checkRateLimit(getClientIp(req), 20, 60_000)) {
    return NextResponse.json({ success: false, error: 'Too many checkout requests. Please wait.' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const email = String(body?.email || '').trim().toLowerCase();
    const currency: CurrencyCode = body?.currency === 'USD' ? 'USD' : 'NGN';
    const plan: PlanTier = body?.plan === 'LIFETIME' ? 'LIFETIME' : 'MONTHLY';
    const eaSlug = String(body?.ea_slug || 'eridam-nexus-pro').trim();
    const ea = getEaBySlug(eaSlug);

    const rawAccount = body?.mt5_account;
    const mt5Account = rawAccount === undefined || rawAccount === null || rawAccount === ''
      ? null : Number(rawAccount);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, error: 'Enter a valid subscriber email address.' }, { status: 400 });
    }
    if (mt5Account !== null && (!Number.isSafeInteger(mt5Account) || mt5Account <= 0)) {
      return NextResponse.json({ success: false, error: 'If supplied, the MT5 account number must be a valid positive integer.' }, { status: 400 });
    }

    // Dynamic pricing lookup based on EA catalog
    let amountInMinorUnits = 6500000; // default ₦65,000 NGN

    if (currency === 'NGN') {
      const priceNgn = plan === 'MONTHLY' ? (ea?.monthlyPriceNgn ?? 65000) : (ea?.lifetimePriceNgn ?? 250000);
      amountInMinorUnits = priceNgn * 100;
    } else {
      const priceUsd = plan === 'MONTHLY' ? (ea?.monthlyPriceUsd ?? 49) : (ea?.lifetimePriceUsd ?? 199);
      amountInMinorUnits = priceUsd * 100;
    }

    const paystackSecret = (process.env.PAYSTACK_SECRET_KEY || '').trim();
    if (!paystackSecret.startsWith('sk_')) {
      return NextResponse.json({ success: false, error: 'Online payment is not configured yet. Please try again later.' }, { status: 503 });
    }
    if (paystackSecret.startsWith('sk_live_') && process.env.PAYSTACK_LIVE_ENABLED !== 'true') {
      return NextResponse.json({ success: false, error: 'Live payments are disabled while merchant compliance approval is pending.' }, { status: 503 });
    }

    const shortSlug = eaSlug.split('-')[0].toUpperCase();
    const reference = `ALGO_${shortSlug}_${plan}_${currency}_${randomBytes(8).toString('hex').toUpperCase()}`;
    const origin = (process.env.NEXT_PUBLIC_APP_URL || 'https://fidulync.vercel.app').trim().replace(/\/+$/, '');

    const psRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: amountInMinorUnits,
        currency,
        reference,
        callback_url: `${origin}/store?ref=${reference}&ea=${encodeURIComponent(eaSlug)}`,
        metadata: {
          product: 'ALGOLYNX_VAULT',
          ea_slug: eaSlug,
          ea_name: ea ? ea.name : 'AlgoLync Strategy',
          mt5_account: mt5Account,
          currency,
          tier: plan,
          max_live_slots: 1,
          max_demo_slots: 2,
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
      ea_name: ea ? ea.name : 'AlgoLync Strategy',
      amount_minor: amountInMinorUnits,
      currency,
      message: 'Complete payment using Paystack. 1 Live + 2 Demo MT5 accounts included free.',
    });
  } catch (error) {
    console.error('Paystack checkout initialization failed:', error);
    return NextResponse.json({ success: false, error: 'Checkout initialization failed. Please retry.' }, { status: 500 });
  }
}
