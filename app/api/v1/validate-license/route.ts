import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { license_key, mt5_account } = body;

    if (!license_key || !mt5_account) {
      return NextResponse.json({ valid: false, error: 'Missing license key or MT5 account number' }, { status: 400 });
    }

    // In production, check your database (Supabase / Upstash Redis) 
    // to verify if license_key matches mt5_account and subscription is active.
    // For automated demonstration: keys starting with 'ALGOLYNX-' are valid.
    const isValid = license_key.startsWith('ALGOLYNX-');

    if (isValid) {
      return NextResponse.json({
        valid: true,
        message: 'License verified successfully. Subscription active.',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days validity preview
      }, { status: 200 });
    } else {
      return NextResponse.json({ valid: false, error: 'Invalid or expired license key.' }, { status: 403 });
    }
  } catch (err: any) {
    return NextResponse.json({ valid: false, error: err.message }, { status: 500 });
  }
}
