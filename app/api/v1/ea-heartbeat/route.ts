import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';
import { isSupabaseConfigured, supabaseQuery } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
  if (!checkRateLimit(ip, 60, 60000)) {
    return NextResponse.json({ ok: false, error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const mt5Account = Number(body?.mt5_account || 0);
    const licenseKey = String(body?.license_key || '').trim();

    if (mt5Account <= 0 || !licenseKey.startsWith('ALGOLYNX-')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized EA telemetry' }, { status: 401 });
    }

    if (isSupabaseConfigured()) {
      await supabaseQuery('ea_heartbeats', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates',
        body: {
          mt5_account: mt5Account,
          license_key: licenseKey,
          balance: Number(body?.balance || 0),
          equity: Number(body?.equity || 0),
          drawdown_pct: Number(body?.drawdown_pct || 0),
          open_positions: Number(body?.open_positions || 0),
          vps_ping_ms: Number(body?.vps_ping_ms || 0),
          updated_at: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json({ ok: true, server_utc: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid telemetry payload' }, { status: 400 });
  }
}
