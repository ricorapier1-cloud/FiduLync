import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { isSupabaseConfigured, supabaseQuery, supabaseRead } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!checkRateLimit(ip, 5, 60 * 60_000)) {
    return NextResponse.json({ success: false, error: 'Demo limit reached for this network. Try again later.' }, { status: 429 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: false, error: 'Demo provisioning is temporarily unavailable.' }, { status: 503 });
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const eaSlug = typeof body.ea_slug === 'string' ? body.ea_slug.trim().toLowerCase() : '';
    const loginText = String(body.mt5_login ?? body.mt5_account ?? '').trim();
    const mt5Login = /^\d{1,20}$/.test(loginText) ? Number(loginText) : Number.NaN;

    if (!EMAIL.test(email) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(eaSlug)
      || !Number.isSafeInteger(mt5Login) || mt5Login <= 0) {
      return NextResponse.json({ success: false, error: 'Enter a valid email, EA selection and actual MT5 demo login.' }, { status: 400 });
    }

    const products = await supabaseRead<Array<{ slug: string; name: string; demo_days: number; ex5_artifact_url: string | null; is_active: boolean }>>(
      'ea_products',
      `slug=eq.${encodeURIComponent(eaSlug)}&is_active=eq.true&select=slug,name,demo_days,ex5_artifact_url,is_active&limit=1`
    );
    const product = products?.[0];
    if (!product) return NextResponse.json({ success: false, error: 'This EA is not currently available for demo.' }, { status: 404 });
    if (!product.ex5_artifact_url) {
      return NextResponse.json({ success: false, error: 'The compiled EX5 demo artifact has not passed release approval yet. Demo activation is disabled until it is published.' }, { status: 409 });
    }

    const days = Math.min(30, Math.max(1, Number(product.demo_days) || 14));
    const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();
    const licenseKey = `ALGOLYNX-DEMO-${randomBytes(5).toString('hex').toUpperCase()}`;

    const provisioned = await supabaseQuery<Record<string, unknown>>('rpc/provision_ea_demo_trial', {
      method: 'POST',
      body: {
        p_email: email,
        p_ea_slug: eaSlug,
        p_mt5_login: mt5Login,
        p_license_key: licenseKey,
        p_expires_at: expiresAt,
      },
    });

    const result = Array.isArray(provisioned) ? provisioned[0] : provisioned;
    if (!result || result.success !== true) throw new Error('Demo trial provisioning did not return a confirmed record.');

    return NextResponse.json({
      success: true,
      license_key: licenseKey,
      ea_slug: eaSlug,
      account_mode: 'DEMO',
      mt5_login: mt5Login,
      expires_at: expiresAt,
      download_url: product.ex5_artifact_url,
      message: `Your ${days}-day demo license is active and locked to this EA and MT5 demo login.`,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Demo provisioning failed.';
    if (/duplicate key|unique constraint|already exists/i.test(message)) {
      return NextResponse.json({ success: false, error: 'A demo has already been claimed for this email and EA, or this MT5 login has already used a demo.' }, { status: 409 });
    }
    if (/artifact/i.test(message)) return NextResponse.json({ success: false, error: 'No release-approved EX5 artifact is available yet.' }, { status: 409 });
    console.error('AlgoLync demo provisioning failed:', error);
    return NextResponse.json({ success: false, error: 'Demo provisioning failed. No demo key was issued.' }, { status: 503 });
  }
}
