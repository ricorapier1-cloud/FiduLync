import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { isSupabaseConfigured, persistLicense } from '@/lib/supabaseAdmin';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!checkRateLimit(ip, 20)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const eaSlug = String(body.ea_slug || 'generic').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const mt5Account = Number(body.mt5_account) || Math.floor(1000000 + Math.random() * 9000000);

    if (!email) {
      return NextResponse.json({ error: 'Valid email address is required to provision demo license.' }, { status: 400 });
    }

    const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const cleanSlug = eaSlug.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
    const licenseKey = `ALGO-DEMO-${cleanSlug}-${randomSuffix}`;
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(); // 14-day demo

    if (isSupabaseConfigured()) {
      await persistLicense({
        license_key: licenseKey,
        mt5_account: mt5Account,
        email,
        tier: 'DEMO_14D',
        status: 'ACTIVE',
        expires_at: expiresAt,
      });
    }

    return NextResponse.json({
      success: true,
      license_key: licenseKey,
      ea_slug: eaSlug,
      account_type: 'DEMO',
      mt5_account: mt5Account,
      expires_at: expiresAt,
      message: 'Demo license successfully provisioned. 1 Live + 2 Demo accounts entitlement active.',
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to provision demo license' }, { status: 500 });
  }
}
