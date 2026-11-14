import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';
import { isSupabaseConfigured, supabaseQuery } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

function buildSandboxLicenseKey(mt5Account: number): string {
  return `ALGOLYNX-${mt5Account}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

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
  if (!checkRateLimit(ip, 25, 60_000)) {
    return NextResponse.json({ success: false, error: 'Too many checkout requests. Please wait.' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const email = String(body?.email ?? '').trim().toLowerCase();
    const mt5Account = Number(body?.mt5_account ?? 0);

    if (!email.includes('@') || !Number.isFinite(mt5Account) || mt5Account <= 0) {
      return NextResponse.json(
        { success: false, error: 'Enter a valid email and MT5 account login number.' },
        { status: 400 }
      );
    }

    const paystackSecret = process.env.PAYSTACK_SECRET_KEY?.trim() ?? '';
    const reference = `ALGO_${mt5Account}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    if (paystackSecret.startsWith('sk_')) {
      const origin = req.headers.get('origin') ?? 'https://fidulync.vercel.app';
      const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
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
          metadata: {
            mt5_account: mt5Account,
            tier: 'INSTITUTIONAL_PRO',
          },
        }),
      });

      const paystackData = await paystackResponse.json();
      if (paystackResponse.ok && paystackData?.status && paystackData?.data?.authorization_url) {
        return NextResponse.json({
          success: true,
          mode: 'paystack_redirect',
          authorization_url: paystackData.data.authorization_url,
          reference,
        });
      }
    }

    const licenseKey = buildSandboxLicenseKey(mt5Account);

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
      }).catch((error) => {
        console.warn('Instant license provision warning:', error);
      });
    }

    return NextResponse.json({
      success: true,
      mode: 'sandbox_instant',
      license_key: licenseKey,
      email,
      mt5_account: mt5Account,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Checkout initialization failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
