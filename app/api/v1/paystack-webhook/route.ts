import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isSupabaseConfigured, persistLicense, supabaseRead } from '@/lib/supabaseAdmin';
import { sendLicenseDeliveryEmail } from '@/lib/transactionalEmail';

export const dynamic = 'force-dynamic';

const PRICES: Record<string, number> = {
  'MONTHLY_NGN': 6500000,
  'MONTHLY_USD': 4900,
  'LIFETIME_NGN': 25000000,
  'LIFETIME_USD': 19900,
};

export async function POST(request: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY?.trim() ?? '';
  if (!secret.startsWith('sk_') || !isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Payment webhook is not configured.' }, { status: 503 });
  }

  const bodyText = await request.text();
  const signature = request.headers.get('x-paystack-signature') ?? '';
  const expected = createHmac('sha512', secret).update(bodyText).digest();
  const supplied = Buffer.from(signature, 'hex');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return NextResponse.json({ error: 'Unauthorized webhook signature.' }, { status: 401 });
  }

  let payload: unknown;
  try { payload = JSON.parse(bodyText); } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return NextResponse.json({ error: 'Invalid webhook payload.' }, { status: 400 });
  }

  const event = payload as Record<string, unknown>;
  if (event.event !== 'charge.success') return NextResponse.json({ status: 'ignored' }, { status: 200 });

  const data = event.data;
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return NextResponse.json({ error: 'Invalid payment event data.' }, { status: 400 });
  }
  const payment = data as Record<string, unknown>;
  const reference = typeof payment.reference === 'string' ? payment.reference : '';
  const match = /^ALGO_(MONTHLY|LIFETIME)_(NGN|USD)_([0-9]{1,20})_([A-F0-9]{32})$/.exec(reference);
  if (!match || payment.status !== 'success') {
    return NextResponse.json({ error: 'Unrecognized or unsuccessful payment.' }, { status: 400 });
  }

  const [, plan, currency, accountText] = match;
  const mt5Account = Number(accountText);
  const metadata = payment.metadata;
  const meta = typeof metadata === 'object' && metadata !== null ? metadata as Record<string, unknown> : {};
  const customer = payment.customer;
  const email = typeof customer === 'object' && customer !== null && 'email' in customer
    ? String((customer as Record<string, unknown>).email ?? '').trim().toLowerCase()
    : '';
  if (!Number.isSafeInteger(mt5Account) || mt5Account <= 0
    || Number(meta.mt5_account) !== mt5Account || meta.tier !== plan
    || payment.currency !== currency || payment.amount !== PRICES[`${plan}_${currency}`]
    || !email.includes('@')) {
    return NextResponse.json({ error: 'Payment amount, currency, or order metadata did not match.' }, { status: 400 });
  }

  try {
    const digest = createHash('sha256').update(reference).digest('hex').slice(0, 12).toUpperCase();
    const licenseKey = `ALGOLYNX-${plan === 'LIFETIME' ? 'LT' : 'MO'}-${mt5Account}-${digest}`;
    const existing = await supabaseRead<Array<{ license_key: string; mt5_account: number; tier: string; expires_at: string | null; email?: string }>>(
      'licenses',
      `license_key=eq.${encodeURIComponent(licenseKey)}&select=license_key,mt5_account,tier,expires_at,email&limit=1`
    );
    if (existing === null) throw new Error('License database is unavailable.');

    let license = existing[0];
    if (!license) {
      const expiresAt = plan === 'LIFETIME' ? null : new Date(Date.now() + 30 * 86_400_000).toISOString();
      await persistLicense({
        license_key: licenseKey,
        mt5_account: mt5Account,
        email,
        tier: plan === 'LIFETIME' ? 'INSTITUTIONAL_LIFETIME' : 'INSTITUTIONAL_MONTHLY',
        status: 'active',
        expires_at: expiresAt,
      });
      license = { license_key: licenseKey, mt5_account: mt5Account, tier: plan === 'LIFETIME' ? 'INSTITUTIONAL_LIFETIME' : 'INSTITUTIONAL_MONTHLY', expires_at: expiresAt, email };
    }

    const emailSent = await sendLicenseDeliveryEmail({
      email: license.email || email,
      licenseKey: license.license_key,
      mt5Account: license.mt5_account,
      tier: license.tier,
      expiresAt: license.expires_at,
      reference,
    }).catch((error: unknown) => {
      console.error('Webhook license email delivery failed:', error);
      return false;
    });

    return NextResponse.json({ status: 'success', email_sent: emailSent }, { status: 200 });
  } catch (error) {
    console.error('Paystack webhook provisioning failed:', error);
    return NextResponse.json({ error: 'Payment provisioning failed; retry is required.' }, { status: 503 });
  }
}
