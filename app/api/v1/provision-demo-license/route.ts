import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { isSupabaseConfigured, persistLicense, supabaseRead } from '@/lib/supabaseAdmin';
import { enforceDistributedRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

type DemoRequest = {
  ea_slug?: unknown;
  email?: unknown;
  mt5_account?: unknown;
};

export async function POST(req: Request) {
  const rate = await enforceDistributedRateLimit(req, 'provision-demo-license', 5, 60 * 60_000);
  if (rate.unavailable) return NextResponse.json({ success: false, error: 'Demo provisioning is temporarily unavailable.' }, { status: 503 });
  if (!rate.allowed) return NextResponse.json({ success: false, error: 'Demo request limit reached. Try again later.' }, { status: 429 });
  if (!isSupabaseConfigured()) return NextResponse.json({ success: false, error: 'License database is not configured.' }, { status: 503 });

  try {
    const raw: unknown = await req.json();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return NextResponse.json({ success: false, error: 'A valid JSON object is required.' }, { status: 400 });
    }
    const body = raw as DemoRequest;
    const eaSlug = typeof body.ea_slug === 'string' ? body.ea_slug.trim().toLowerCase() : 'eridam-nexus-pro';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(eaSlug)) return NextResponse.json({ success: false, error: 'Invalid AlgoLync product selection.' }, { status: 400 });
    const products = await supabaseRead<Array<{ slug: string; category: string; is_active: boolean }>>('ea_products', `slug=eq.${encodeURIComponent(eaSlug)}&is_active=eq.true&select=slug,category,is_active`);
    if (!products) throw new Error('Product catalogue database unavailable.');
    if (!products[0] || !products[0].is_active || products[0].category === 'SANDBOX') return NextResponse.json({ success: false, error: 'Select an eligible active AlgoLync EA product.' }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return NextResponse.json({ success: false, error: 'A valid email address is required.' }, { status: 400 });
    }

    const accountRaw = body.mt5_account;
    const mt5Account = accountRaw === undefined || accountRaw === null || accountRaw === ''
      ? null : typeof accountRaw === 'number' ? accountRaw
      : typeof accountRaw === 'string' && /^\d{1,20}$/.test(accountRaw) ? Number(accountRaw) : NaN;
    if (mt5Account !== null && (!Number.isSafeInteger(mt5Account) || mt5Account <= 0)) {
      return NextResponse.json({ success: false, error: 'mt5_account must be a valid positive integer when supplied.' }, { status: 400 });
    }

    const randomSuffix = randomBytes(16).toString('hex').toUpperCase();
    const cleanSlug = eaSlug.replace(/[^a-z0-9]/g, '').slice(0, 10).toUpperCase();
    const licenseKey = `ALGO-DEMO-${cleanSlug}-${randomSuffix}`;
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const persisted = await persistLicense({
      license_key: licenseKey,
      mt5_account: mt5Account,
      email,
      tier: 'DEMO_14D',
      status: 'active',
      expires_at: expiresAt,
      ea_slug: eaSlug,
      included_live_seats: 0,
      included_demo_seats: 2,
      extra_live_seats: 0,
    });
    if (!persisted) throw new Error('License persistence did not return a database result.');

    return NextResponse.json({
      success: true,
      license_key: licenseKey,
      ea_slug: eaSlug,
      account_type: 'DEMO',
      mt5_account: mt5Account,
      expires_at: expiresAt,
      included_live_seats: 0,
      included_demo_seats: 2,
      message: '14-day demo entitlement provisioned and persisted.',
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('Demo license provisioning failed:', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ success: false, error: 'Demo license could not be provisioned. Retry shortly.' }, { status: 503 });
  }
}
