import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { isSupabaseConfigured, persistLicense, supabaseRead } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const PRICES: Record<string, number> = {
  'MONTHLY_NGN': 6500000,
  'MONTHLY_USD': 4900,
  'LIFETIME_NGN': 25000000,
  'LIFETIME_USD': 19900,
};

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'no-store, max-age=0' };
  if (!checkRateLimit(getClientIp(request), 10, 60_000)) {
    return NextResponse.json({ success: false, error: 'Too many payment verification attempts.' }, { status: 429, headers });
  }

  const reference = new URL(request.url).searchParams.get('reference')?.trim() ?? '';
  const match = /^ALGO_(MONTHLY|LIFETIME)_(NGN|USD)_([0-9]{1,20})_([A-F0-9]{32})$/.exec(reference);
  if (!match) return NextResponse.json({ success: false, error: 'Invalid payment reference.' }, { status: 400, headers });

  const [, plan, currency, accountText] = match;
  const mt5Account = Number(accountText);
  if (!Number.isSafeInteger(mt5Account) || mt5Account <= 0) {
    return NextResponse.json({ success: false, error: 'Invalid MT5 account in payment reference.' }, { status: 400, headers });
  }

  const secret = process.env.PAYSTACK_SECRET_KEY?.trim() ?? '';
  if (!secret.startsWith('sk_') || !isSupabaseConfigured()) {
    return NextResponse.json({ success: false, error: 'Payment verification is not configured.' }, { status: 503, headers });
  }

  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) {
      return NextResponse.json({ success: false, error: 'Payment provider verification is temporarily unavailable.' }, { status: 503, headers });
    }

    const result: unknown = await response.json();
    if (typeof result !== 'object' || result === null || !('status' in result) || !('data' in result)) {
      return NextResponse.json({ success: false, error: 'Invalid payment provider response.' }, { status: 502, headers });
    }
    const envelope = result as { status?: unknown; data?: Record<string, unknown> };
    const payment = envelope.data;
    if (envelope.status !== true || !payment || payment.status !== 'success'
      || payment.reference !== reference
      || payment.currency !== currency
      || payment.amount !== PRICES[`${plan}_${currency}`]) {
      return NextResponse.json({ success: false, error: 'Payment has not been verified as successful.' }, { status: 402, headers });
    }

    const metadata = payment.metadata;
    const meta = typeof metadata === 'object' && metadata !== null ? metadata as Record<string, unknown> : {};
    const metadataAccount = Number(meta.mt5_account);
    const tier = meta.tier;
    const customer = payment.customer;
    const customerEmail = typeof customer === 'object' && customer !== null && 'email' in customer
      ? String((customer as Record<string, unknown>).email ?? '').trim().toLowerCase()
      : '';

    if (metadataAccount !== mt5Account || tier !== plan || !customerEmail.includes('@')) {
      return NextResponse.json({ success: false, error: 'Payment metadata does not match this order.' }, { status: 400, headers });
    }

    const digest = createHash('sha256').update(reference).digest('hex').slice(0, 12).toUpperCase();
    const licenseKey = `ALGOLYNX-${plan === 'LIFETIME' ? 'LT' : 'MO'}-${mt5Account}-${digest}`;
    const existing = await supabaseRead<Array<{ license_key: string; mt5_account: number; tier: string; expires_at: string | null }>>(
      'licenses',
      `license_key=eq.${encodeURIComponent(licenseKey)}&select=license_key,mt5_account,tier,expires_at&limit=1`
    );
    if (existing === null) {
      return NextResponse.json({ success: false, error: 'License storage is temporarily unavailable.' }, { status: 503, headers });
    }

    let license = existing[0];
    if (!license) {
      const expiresAt = plan === 'LIFETIME' ? null : new Date(Date.now() + 30 * 86_400_000).toISOString();
      await persistLicense({
        license_key: licenseKey,
        mt5_account: mt5Account,
        email: customerEmail,
        tier: plan === 'LIFETIME' ? 'INSTITUTIONAL_LIFETIME' : 'INSTITUTIONAL_MONTHLY',
        status: 'active',
        expires_at: expiresAt,
      });
      license = { license_key: licenseKey, mt5_account: mt5Account, tier: plan === 'LIFETIME' ? 'INSTITUTIONAL_LIFETIME' : 'INSTITUTIONAL_MONTHLY', expires_at: expiresAt };
    }

    return NextResponse.json({
      success: true,
      license_key: license.license_key,
      mt5_account: license.mt5_account,
      tier: license.tier,
      expires_at: license.expires_at,
      download_url: '/downloads/AlgoLync_EA_README.txt',
    }, { status: 200, headers });
  } catch (error) {
    console.error('Paystack verification or license provisioning failed:', error);
    return NextResponse.json({ success: false, error: 'Payment was received or verification attempted, but license provisioning needs retry.' }, { status: 503, headers });
  }
}
