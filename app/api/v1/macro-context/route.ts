import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getMacroSnapshot } from '@/lib/macroEngine';
import { generatePairDossier } from '@/lib/macro/dossierEngine';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

async function authenticate(request: Request): Promise<string | null> {
  const authorization = request.headers.get('authorization')?.trim() ?? '';
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const candidate = (request.headers.get('x-macro-key')?.trim() || bearer).trim();
  if (!candidate) return null;

  // Installation credentials are random, one-time-issued flmt5_ tokens.
  // Only their SHA-256 hashes are stored in Supabase.
  if (candidate.startsWith('flmt5_')) {
    if (candidate.length < 40) return null;
    const tokenHash = createHash('sha256').update(candidate).digest('hex');
    const { data, error } = await getSupabaseAdmin()
      .from('mt5_installations')
      .select('id')
      .eq('token_hash', tokenHash)
      .eq('status', 'active')
      .maybeSingle();
    if (error) throw error;
    return data?.id ? `installation:${data.id}` : null;
  }

  const secret = process.env.MACROLYNC_API_SECRET?.trim()
    || process.env.ALGO_PRIVATE_API_KEY?.trim();
  if (!secret || secret.length < 32 || !safeEqual(candidate, secret)) return null;
  return `service:${createHash('sha256').update(secret).digest('hex').slice(0, 16)}`;
}

async function consumePersistentRateLimit(key: string, limit: number): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const keyHash = createHash('sha256').update(key).digest('hex');
  const { data, error } = await getSupabaseAdmin().rpc('consume_api_rate_limit', {
    p_key_hash: keyHash,
    p_limit: limit,
    p_window_seconds: 60,
  });
  if (error) throw error;
  if (!data || typeof data !== 'object') throw new Error('Rate-limit service returned an invalid response.');
  const result = data as Record<string, unknown>;
  return {
    allowed: result.allowed === true,
    retryAfterSeconds: Number.isInteger(result.retry_after_seconds)
      ? Math.max(1, Number(result.retry_after_seconds))
      : 60,
  };
}

const headers = {
  'Cache-Control': 'no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
};

export async function GET(request: Request) {
  let identity: string | null;
  try {
    identity = await authenticate(request);
  } catch (error) {
    console.error('Macro Context authentication store unavailable:', error);
    return NextResponse.json({ error: 'Authentication service is temporarily unavailable.' }, { status: 503, headers });
  }

  if (!identity) {
    const secret = process.env.MACROLYNC_API_SECRET?.trim() || process.env.ALGO_PRIVATE_API_KEY?.trim();
    const status = !secret || secret.length < 32 ? 503 : 401;
    return NextResponse.json(
      { error: status === 503 ? 'Macro context API is not configured for authenticated access.' : 'Unauthorized.' },
      { status, headers }
    );
  }

  const ip = request.headers.get('x-real-ip')?.trim()
    || request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()
    || 'unknown';
  try {
    const [ipLimit, identityLimit] = await Promise.all([
      consumePersistentRateLimit(`ip:${ip}`, 60),
      consumePersistentRateLimit(identity, 30),
    ]);
    if (!ipLimit.allowed || !identityLimit.allowed) {
      const retryAfter = Math.max(ipLimit.allowed ? 0 : ipLimit.retryAfterSeconds, identityLimit.allowed ? 0 : identityLimit.retryAfterSeconds);
      return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429, headers: { ...headers, 'Retry-After': String(retryAfter) } });
    }
  } catch (error) {
    console.error('Macro Context rate-limit store unavailable:', error);
    return NextResponse.json({ error: 'Request protection service is temporarily unavailable.' }, { status: 503, headers });
  }

  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get('symbol') ?? searchParams.get('pair') ?? 'EURUSD').trim().toUpperCase();
  if (!/^[A-Z]{6}$/.test(symbol) && symbol !== 'XAUUSD') {
    return NextResponse.json({ error: 'Invalid symbol. Use a six-character FX pair or XAUUSD.' }, { status: 400, headers });
  }

  try {
    const snapshot = await getMacroSnapshot();
    const dossier = generatePairDossier(snapshot, symbol);
    return NextResponse.json({
      symbol: dossier.symbol,
      base: dossier.base,
      quote: dossier.quote,
      macro_regime: dossier.macroRegime,
      fundamental_bias: dossier.fundamentalBias,
      decision_status: dossier.confidence === 'INSUFFICIENT_EVIDENCE' ? 'INSUFFICIENT_EVIDENCE' : 'RESEARCH_CONTEXT_AVAILABLE',
      bias_score: dossier.confidence === 'INSUFFICIENT_EVIDENCE' ? null : dossier.biasScore,
      confidence: dossier.confidence,
      policy_diff_bps: dossier.confidence === 'INSUFFICIENT_EVIDENCE' ? null : dossier.policyDiffBps,
      real_yield_diff_bps: dossier.confidence === 'INSUFFICIENT_EVIDENCE' ? null : dossier.realYieldDiffBps,
      two_year_yield_diff_bps: dossier.twoYearYieldDiffBps,
      cot_percentile_diff: snapshot.cotSource === 'provider' ? dossier.cotPercentileDiff : null,
      cross_asset_confirmation: dossier.crossAssetConfirmation,
      calendar_verified: snapshot.calendarSource === 'provider',
      event_risk_status: snapshot.calendarSource === 'provider' ? 'PROVIDER_CALENDAR' : 'UNVERIFIED_CALENDAR',
      news_lockout: dossier.eventRiskLockout || snapshot.calendarSource !== 'provider',
      next_catalyst: dossier.nextCatalyst ? {
        title: dossier.nextCatalyst.title,
        scheduled_at_utc: dossier.nextCatalyst.scheduledAt,
        region: dossier.nextCatalyst.region,
        impact: dossier.nextCatalyst.impact,
        lockout_active: dossier.nextCatalyst.lockoutActive,
      } : null,
      invalidation_triggers: dossier.invalidationTriggers,
      provenance: {
        as_of_utc: snapshot.asOf,
        source_mode: snapshot.source,
        calendar_source: snapshot.calendarSource,
        cot_source: snapshot.cotSource,
      },
      disclaimer: 'Read-only macroeconomic intelligence. No technical analysis or broker order execution.',
    }, { status: 200, headers });
  } catch (error) {
    console.error('Macro context query failed:', error);
    return NextResponse.json({ error: 'Macro context service is temporarily unavailable.' }, { status: 503, headers });
  }
}
