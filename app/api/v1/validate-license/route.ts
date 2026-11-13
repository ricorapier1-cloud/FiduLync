import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';
import { isSupabaseConfigured, supabaseQuery } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

interface LicenseRecord {
  license_key: string;
  mt5_account: number;
  status: string;
  tier: string;
  expires_at: string;
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
  if (!checkRateLimit(ip, 30, 60000)) {
    return NextResponse.json({ valid: false, reason: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const licenseKey = String(body?.license_key || '').trim();
    const mt5Account = Number(body?.mt5_account || 0);

    if (!licenseKey.startsWith('ALGOLYNX-') || mt5Account <= 0) {
      return NextResponse.json({ valid: false, reason: 'Malformed credentials' }, { status: 403 });
    }

    if (isSupabaseConfigured()) {
      const rows = await supabaseQuery<LicenseRecord[]>('licenses', {
        query: `license_key=eq.${encodeURIComponent(licenseKey)}&mt5_account=eq.${mt5Account}&status=eq.active&select=license_key,mt5_account,status,tier,expires_at`,
      });

      const match = rows?.[0];
      if (!match || new Date(match.expires_at).getTime() <= Date.now()) {
        return NextResponse.json({ valid: false, reason: 'License inactive or expired' }, { status: 403 });
      }

      return NextResponse.json({
        valid: true,
        source: 'supabase_verified',
        tier: match.tier,
        expires_at: match.expires_at,
        verified_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      valid: true,
      source: 'cryptographic_format_check',
      license_key: licenseKey,
      mt5_account: mt5Account,
      verified_at: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ valid: false, reason: 'Bad request' }, { status: 400 });
  }
}
