import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const licenseKey = String(body?.license_key || '').trim();
    const mt5Account = Number(body?.mt5_account || 0);

    if (!licenseKey.startsWith('ALGOLYNX-') || mt5Account <= 0) {
      return NextResponse.json({ valid: false, reason: 'Invalid key format or account' }, { status: 403 });
    }

    return NextResponse.json(
      {
        valid: true,
        license_key: licenseKey,
        mt5_account: mt5Account,
        verified_at: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ valid: false, reason: 'Malformed request payload' }, { status: 400 });
  }
}
