import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { checkRateLimit } from '@/lib/rateLimit';
import { isSupabaseConfigured, supabaseQuery } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'active',
    endpoint: '/api/v1/create-checkout',
    description: 'AlgoLync MT5 Cloud Gate checkout and license initialization gateway.',
    methods: ['GET', 'POST'],
  });
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
  if (!checkRateLimit(ip, 20, 60000)) {
    return NextResponse.json({ success: false, error: 'Too many checkout requests. Please wait.' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const email = String(body?.email || '').trim().toLowerCase();
    const mt5Account = Number(body?.mt5_account || 0);

    if (!email.includes('@') || mt5Account <= 0) {
      return NextResponse.json({ success: false, error: 'Enter a valid email and MT5 account login number.' }, { status: 400 });
    }

    const paystackSecret = process.env.PAYSTACK_SECRET_KEY || '';
    const reference = `ALGO_${mt5Account}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

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
          amount: 15000000,
          reference,
          callback_url: `${origin}/store?ref=${reference}`,
          metadata: { mt5_account: mt5Account, tier: 'INSTITUTIONAL_PRO' },
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

    const licenseKey = `ALGOLYNX-${mt5Account}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    if (isSupabaseConfigured()) {
      await supabaseQuery('licenses', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates',
        body: {
          license_key: licenseKey,
          mt5_account: mt5Account,
          email,
          tier: 'INSTITUTIONAL_PRO',
          status: 'active',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        },
      }).catch((e) => console.warn('Instant license provision record warning:', e));
    }

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
