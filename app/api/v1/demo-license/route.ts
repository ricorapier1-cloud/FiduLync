import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isSupabaseConfigured, supabaseInsert, supabaseRead } from '@/lib/supabaseAdmin';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store, max-age=0' };
  if (!checkRateLimit(getClientIp(request), 8, 60 * 60_000)) {
    return NextResponse.json({ success: false, error: 'Demo request limit reached. Try again later.' }, { status: 429, headers });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: false, error: 'Demo licensing is temporarily unavailable.' }, { status: 503, headers });
  }
  try {
    const body = await request.json();
    const email = String(body?.email ?? '').trim().toLowerCase();
    const eaSlug = String(body?.ea_slug ?? '').trim().toLowerCase();
    const mt5Login = Number(body?.mt5_login ?? body?.mt5_account ?? 0);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(eaSlug)
      || !Number.isSafeInteger(mt5Login) || mt5Login <= 0) {
      return NextResponse.json({ success: false, error: 'A valid email, EA and positive demo MT5 login are required.' }, { status: 400, headers });
    }

    const products = await supabaseRead<Array<{ slug: string; is_active: boolean; demo_days: number; ex5_artifact_url: string | null }>>(
      'ea_products',
      `slug=eq.${encodeURIComponent(eaSlug)}&select=slug,is_active,demo_days,ex5_artifact_url&limit=1`
    );
    const product = products?.[0];
    if (!product || !product.is_active) return NextResponse.json({ success: false, error: 'This EA is not currently available for demo.' }, { status: 404, headers });
    if (!product.ex5_artifact_url) return NextResponse.json({ success: false, error: 'The verified compiled .ex5 demo artifact has not been published yet. No demo key was created.' }, { status: 409, headers });

    const emailTrials = await supabaseRead<Array<{ id: string }>>('ea_demo_trials', `email=eq.${encodeURIComponent(email)}&ea_slug=eq.${encodeURIComponent(eaSlug)}&select=id&limit=1`);
    const loginTrials = await supabaseRead<Array<{ id: string }>>('ea_demo_trials', `mt5_login=eq.${mt5Login}&select=id&limit=1`);
    if (emailTrials?.length || loginTrials?.length) {
      return NextResponse.json({ success: false, error: 'A free demo has already been issued for this email/EA or MT5 login.' }, { status: 409, headers });
    }

    const licenseKey = `ALGOLYNX-DEMO-${randomBytes(5).toString('hex').toUpperCase()}`;
    const expiresAt = new Date(Date.now() + product.demo_days * 86_400_000).toISOString();
    await supabaseInsert('ea_demo_trials', {
      email, ea_slug: eaSlug, mt5_login: mt5Login, license_key: licenseKey, expires_at: expiresAt,
    });
    return NextResponse.json({
      success: true, license_key: licenseKey, ea_slug: eaSlug, account_mode: 'DEMO',
      mt5_login: mt5Login, expires_at: expiresAt, download_url: product.ex5_artifact_url,
    }, { status: 201, headers });
  } catch (error) {
    console.error('Demo license provisioning failed:', error);
    return NextResponse.json({ success: false, error: 'Demo could not be provisioned. A duplicate email or MT5 login may already be registered.' }, { status: 409, headers });
  }
}
