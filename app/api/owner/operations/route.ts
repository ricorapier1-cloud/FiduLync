import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const OWNER_EMAIL = 'ricorapier1@gmail.com';

export async function GET(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return NextResponse.json({ error: 'Owner authentication required.' }, { status: 401 });

  try {
    const supabase = getSupabaseAdmin();
    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    if (authError || !auth.user || auth.user.email?.toLowerCase() !== OWNER_EMAIL) {
      return NextResponse.json({ error: 'Owner access denied.' }, { status: 403 });
    }

    const userId = auth.user.id;
    const { data: installations, error: installationError } = await supabase.from('mt5_installations')
      .select('id,label,status,created_at,last_seen_at,broker,server')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(20);
    if (installationError) throw installationError;

    const activeInstallations = (installations ?? []).filter((item) => item.status === 'active');
    const installationIds = activeInstallations.map((item) => item.id);
    let candleData: { id: string; bar_time: string; symbol: string; timeframe: string; broker: string; server: string } | null = null;
    let quoteData: { symbol: string; quote_time: string; broker: string; server: string } | null = null;
    if (installationIds.length) {
      const [candles, quotes] = await Promise.all([
        supabase.from('mt5_market_candles').select('id,bar_time,symbol,timeframe,broker,server')
          .in('installation_id', installationIds).order('bar_time', { ascending: false }).limit(1),
        supabase.from('mt5_market_quotes').select('symbol,quote_time,broker,server')
          .in('installation_id', installationIds).order('quote_time', { ascending: false }).limit(1),
      ]);
      if (candles.error) throw candles.error;
      if (quotes.error) throw quotes.error;
      candleData = candles.data?.[0] ?? null;
      quoteData = quotes.data?.[0] ?? null;
    }

    const now = Date.now();
    const candleAgeMs = candleData ? now - Date.parse(candleData.bar_time) : null;
    const quoteAgeMs = quoteData ? now - Date.parse(quoteData.quote_time) : null;
    const latestHeartbeat = activeInstallations
      .map((item) => item.last_seen_at ? Date.parse(item.last_seen_at) : 0)
      .reduce((latest, value) => Math.max(latest, value), 0);

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      owner: { email: OWNER_EMAIL, role: 'owner' },
      market_data: {
        active_installations: activeInstallations.length,
        total_installations: installations?.length ?? 0,
        latest_heartbeat: latestHeartbeat ? new Date(latestHeartbeat).toISOString() : null,
        latest_candle: candleData,
        latest_candle_age_minutes: candleAgeMs === null ? null : Math.max(0, Math.round(candleAgeMs / 60000)),
        latest_quote: quoteData,
        latest_quote_age_seconds: quoteAgeMs === null ? null : Math.max(0, Math.round(quoteAgeMs / 1000)),
      },
      installations: installations ?? [],
      database: { reachable: true, installation_records: installations?.length ?? 0 },
      governance: {
        audit_log: 'not_configured',
        multi_role_access: 'owner_only',
        step_up_authentication: 'not_configured',
        model_validation_registry: 'not_connected',
        portfolio_risk_telemetry: 'not_connected',
      },
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('Owner operations overview failed:', error);
    return NextResponse.json({ error: 'Operations overview is temporarily unavailable.' }, { status: 503 });
  }
}
