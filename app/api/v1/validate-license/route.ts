import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { license_key, mt5_account } = body;

    if (!license_key || !mt5_account) {
      return NextResponse.json({ valid: false, error: 'Missing license key or MT5 account number' }, { status: 400 });
    }

    // Algolync Store license validation rule: keys must start with 'ALGOLYNX-'
    const isValid = typeof license_key === 'string' && license_key.startsWith('ALGOLYNX-');

    if (isValid) {
      return NextResponse.json({
        valid: true,
        message: 'Algolync License verified successfully. Terminal execution authorized.',
        account: mt5_account,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }, { status: 200 });
    } else {
      return NextResponse.json({ valid: false, error: 'Invalid or expired Algolync license key.' }, { status: 403 });
    }
  } catch (error) {
    return NextResponse.json(
      { valid: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
