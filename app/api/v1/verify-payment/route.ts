import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { provisionLicenseForReference } from '@/lib/provisionLicense';
import { sendLicenseDeliveryEmail } from '@/lib/transactionalEmail';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'no-store, max-age=0' };
  if (!checkRateLimit(getClientIp(request), 10, 60_000)) {
    return NextResponse.json({ success: false, error: 'Too many payment verification attempts.' }, { status: 429, headers });
  }

  const reference = new URL(request.url).searchParams.get('reference')?.trim() ?? '';
  if (!reference) return NextResponse.json({ success: false, error: 'Payment reference is required.' }, { status: 400, headers });

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
      console.error('AlgoLync license email delivery failed:', error);
      return false;
    });

    return NextResponse.json({
      success: true,
      license_key: license.license_key,
      mt5_account: license.mt5_account,
      needs_mt5_binding: license.mt5_account === null,
      email: license.email,
      tier: license.tier,
      expires_at: license.expires_at,
      email_sent: emailSent,
      email_notice: emailSent ? undefined : 'Your license is created. Save this key; email delivery is not currently available.',
      download_url: '/downloads/AlgoLync_EA_README.txt',
      idempotent_replay: !result.created,
    }, { status: 200, headers });
  } catch (error) {
    console.error('AlgoLync payment verification or provisioning failed:', {
      reference,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({
      success: false,
      error: 'Payment could not be fully provisioned yet. Retry verification; the payment reference is safe to reuse.',
    }, { status: 503, headers });
  }
}
