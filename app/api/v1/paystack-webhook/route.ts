import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { provisionLicenseForReference } from '@/lib/provisionLicense';
import { sendLicenseDeliveryEmail } from '@/lib/transactionalEmail';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY?.trim() ?? '';
  if (!secret.startsWith('sk_') || (secret.startsWith('sk_live_') && process.env.PAYSTACK_LIVE_ENABLED !== 'true')) {
    return NextResponse.json({ error: 'Payment webhook is not configured.' }, { status: 503 });
  }

  const rawBody = await request.text();
  const suppliedHex = request.headers.get('x-paystack-signature') ?? '';
  if (!/^[a-f0-9]{128}$/i.test(suppliedHex)) {
    return NextResponse.json({ error: 'Unauthorized webhook signature.' }, { status: 401 });
  }
  const expected = createHmac('sha512', secret).update(rawBody).digest();
  const supplied = Buffer.from(suppliedHex, 'hex');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return NextResponse.json({ error: 'Unauthorized webhook signature.' }, { status: 401 });
  }

  let payload: unknown;
  try { payload = JSON.parse(rawBody); } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return NextResponse.json({ error: 'Invalid webhook payload.' }, { status: 400 });
  }

  const event = payload as Record<string, unknown>;
  if (event.event !== 'charge.success') return NextResponse.json({ status: 'ignored' }, { status: 200 });
  const data = event.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return NextResponse.json({ error: 'Invalid payment event data.' }, { status: 400 });
  }
  const reference = typeof (data as Record<string, unknown>).reference === 'string'
    ? String((data as Record<string, unknown>).reference) : '';
  if (!reference) return NextResponse.json({ error: 'Missing payment reference.' }, { status: 400 });

  try {
    const result = await provisionLicenseForReference(reference);
    const license = result.license;
    const emailSent = await sendLicenseDeliveryEmail({
      email: license.email,
      licenseKey: license.license_key,
      mt5Account: license.mt5_account,
      tier: license.tier,
      expiresAt: license.expires_at,
      reference,
    }).catch((error: unknown) => {
      console.error('AlgoLync webhook email delivery failed:', error);
      return false;
    });

    return NextResponse.json({
      status: 'success',
      provisioned: true,
      created: result.created,
      email_sent: emailSent,
      needs_mt5_binding: license.mt5_account === null,
    }, { status: 200 });
  } catch (error) {
    console.error('AlgoLync Paystack webhook provisioning failed:', {
      reference,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Payment verified or pending; license provisioning must be retried.' }, { status: 503 });
  }
}
