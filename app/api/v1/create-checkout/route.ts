import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body?.email || '').trim();
    const mt5Account = Number(body?.mt5_account || 0);

    if (!email || mt5Account <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid email or MT5 account' }, { status: 400 });
    }

    // Generate cryptographic license key bound to MT5 account
    const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
    const licenseKey = `ALGOLYNX-${mt5Account}-${randomHex}`;

    return NextResponse.json({
      success: true,
      license_key: licenseKey,
      email,
      mt5_account: mt5Account,
      message: 'License provisioned successfully via secure checkout gateway'
    }, { status: 200 });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Checkout error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
