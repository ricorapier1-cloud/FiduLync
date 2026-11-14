import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
  if (!checkRateLimit(ip, 15, 60000)) {
    return NextResponse.json({ found: false, error: 'Too many lookup attempts.' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const email = String(body?.email || '').trim().toLowerCase();
    const mt5Account = Number(body?.mt5_account || 0);

    if (!email.includes('@') || !Number.isFinite(mt5Account) || mt5Account <= 0) {
      return NextResponse.json({ found: false, error: 'Provide both your subscriber email and MT5 account number.' }, { status: 400 });
    }

    const supaUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
    const supaKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

    if (supaUrl && supaKey) {
      const res = await fetch(
        `${supaUrl}/rest/v1/licenses?email=eq.${encodeURIComponent(email)}&mt5_account=eq.${mt5Account}&status=eq.active&select=license_key,tier,expires_at&limit=1`,
        {
          headers: {
            apikey: supaKey,
            Authorization: `Bearer ${supaKey}`,
          },
        }
      );

      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) {
          return NextResponse.json({
            found: true,
            license_key: rows[0].license_key,
            tier: rows[0].tier,
            expires_at: rows[0].expires_at,
            download_url: '/downloads/AlgoLync_EA_README.txt',
          });
        }
      }
    }

    return NextResponse.json({
      found: false,
      error: 'No active license found for that email and MT5 account combination.',
    }, { status: 404 });
  } catch {
    return NextResponse.json({ found: false, error: 'Lookup service unavailable.' }, { status: 500 });
  }
}
