import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
  if (!checkRateLimit(ip, 20, 60000)) {
    return NextResponse.json({ valid: false, reason: 'Rate limit exceeded. Slow down.' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const licenseKey = String(body?.license_key || '').trim();
    const mt5Account = Number(body?.mt5_account || 0);

    if (!licenseKey.startsWith('ALGOLYNX-') || mt5Account <= 0) {
      return NextResponse.json({ valid: false, reason: 'Invalid license format or MT5 account' }, { status: 403 });
    }

    // Institutional verification payload
    return NextResponse.json(
      {
        valid: true,
        license_key: licenseKey,
        mt5_account: mt5Account,
        tier: 'INSTITUTIONAL_PRO',
        verified_at: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ valid: false, reason: 'Malformed request payload' }, { status: 400 });
  }
}
