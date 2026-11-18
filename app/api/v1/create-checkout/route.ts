import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { isSupabaseConfigured, supabaseInsert, supabaseQuery, supabaseRead } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

type Currency = 'NGN' | 'USD';
type Cycle = 'MONTHLY' | 'ANNUAL';
type Product = {
  slug: string; name: string; monthly_price_ngn: number; monthly_price_usd: number;
  annual_price_ngn: number; annual_price_usd: number;
  extra_seat_price_ngn: number; extra_seat_price_usd: number; is_active: boolean;
};

export async function POST(request: Request) {
  if (!checkRateLimit(getClientIp(request), 10, 60_000)) {
    return NextResponse.json({ success: false, error: 'Too many checkout attempts. Please wait.' }, { status: 429 });
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ success: false, error: 'Subscription service is unavailable.' }, { status: 503 });

  try {
    const body = await request.json() as Record<string, unknown>;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const eaSlug = typeof body.ea_slug === 'string' ? body.ea_slug.trim().toLowerCase() : '';
    const currency: Currency = body.currency === 'USD' ? 'USD' : 'NGN';
    const cycle: Cycle = body.billing_cycle === 'ANNUAL' || body.plan === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY';
    const extraSeats = [0, 1, 3, 5].includes(Number(body.extra_live_seats)) ? Number(body.extra_live_seats) : 0;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(eaSlug)) {
      return NextResponse.json({ success: false, error: 'A valid email and active EA selection are required.' }, { status: 400 });
    }

    const rows = await supabaseRead<Product[]>(
      'ea_products',
      `slug=eq.${encodeURIComponent(eaSlug)}&is_active=eq.true&select=slug,name,monthly_price_ngn,monthly_price_usd,annual_price_ngn,annual_price_usd,extra_seat_price_ngn,extra_seat_price_usd,is_active&limit=1`
    );
    const product = rows?.[0];
    if (!product) return NextResponse.json({ success: false, error: 'This EA is not available for subscription.' }, { status: 404 });

    const base = currency === 'NGN'
      ? (cycle === 'MONTHLY' ? Number(product.monthly_price_ngn) : Number(product.annual_price_ngn))
      : (cycle === 'MONTHLY' ? Number(product.monthly_price_usd) : Number(product.annual_price_usd));
    const seat = currency === 'NGN' ? Number(product.extra_seat_price_ngn) : Number(product.extra_seat_price_usd);
    const totalMajor = base + (seat * extraSeats * (cycle === 'ANNUAL' ? 10 : 1));
    const amountMinor = Math.round(totalMajor * 100);
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      return NextResponse.json({ success: false, error: 'This EA has no payable subscription price configured.' }, { status: 409 });
    }

    const secret = (process.env.PAYSTACK_SECRET_KEY || '').trim();
    if (!secret.startsWith('sk_') || (secret.startsWith('sk_live_') && process.env.PAYSTACK_LIVE_ENABLED !== 'true')) {
      return NextResponse.json({ success: false, error: 'Paystack payments are not enabled for this environment.' }, { status: 503 });
    }

    const origin = (process.env.NEXT_PUBLIC_APP_URL || 'https://fidulync.vercel.app').replace(/\\/+$/, '');
    const reference = `ALGO-${randomBytes(12).toString('hex').toUpperCase()}`;
    const interval = cycle === 'ANNUAL' ? 'annually' : 'monthly';
    const planResponse = await fetch('https://api.paystack.co/plan', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `AlgoLync · ${product.name} · ${cycle} · ${currency} · ${extraSeats} extra seats`,
        interval, amount: amountMinor, currency,
        description: `EA subscription for ${product.slug}; ${cycle.toLowerCase()} billing`,
      }),
      cache: 'no-store', signal: AbortSignal.timeout(12_000),
    });
    const planEnvelope = await planResponse.json() as { status?: boolean; message?: string; data?: { plan_code?: string } };
    const planCode = planEnvelope.data?.plan_code;
    if (!planResponse.ok || planEnvelope.status !== true || !planCode) {
      console.error('Paystack recurring plan creation failed:', planEnvelope.message);
      return NextResponse.json({ success: false, error: 'Unable to create the recurring billing plan. Please retry.' }, { status: 502 });
    }

    await supabaseInsert('ea_subscription_intents', {
      reference, email, ea_slug: eaSlug, billing_cycle: cycle, currency,
      extra_live_seats: extraSeats, amount_minor: amountMinor, paystack_plan_code: planCode, status: 'PENDING',
    });

    const initialized = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email, amount: amountMinor, currency, reference, plan: planCode,
        callback_url: `${origin}/store?ref=${encodeURIComponent(reference)}&ea=${encodeURIComponent(eaSlug)}`,
        metadata: {
          product: 'ALGOLYNX_SUBSCRIPTION', ea_slug: eaSlug, billing_cycle: cycle,
          currency, extra_live_seats: extraSeats, paystack_plan_code: planCode,
        },
      }),
      cache: 'no-store', signal: AbortSignal.timeout(12_000),
    });
    const envelope = await initialized.json() as { status?: boolean; message?: string; data?: { authorization_url?: string } };
    if (!initialized.ok || envelope.status !== true || !envelope.data?.authorization_url) {
      await supabaseQuery('ea_subscription_intents', {
        method: 'PATCH', query: `reference=eq.${encodeURIComponent(reference)}`,
        body: { status: 'INITIALIZATION_FAILED', updated_at: new Date().toISOString() },
      });
      return NextResponse.json({ success: false, error: 'Paystack checkout could not be initialized.' }, { status: 502 });
    }

    return NextResponse.json({
      success: true, mode: 'paystack_subscription', authorization_url: envelope.data.authorization_url,
      reference, amount_minor: amountMinor, currency, billing_cycle: cycle,
      extra_live_seats: extraSeats, annual_discount: cycle === 'ANNUAL' ? '2 months free' : null,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('AlgoLync subscription checkout failed:', error);
    return NextResponse.json({ success: false, error: 'Subscription checkout failed. Please retry.' }, { status: 503 });
  }
}
