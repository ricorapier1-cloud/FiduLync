import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getMacroSnapshot } from '@/lib/macroEngine';
import { generatePairDossier } from '@/lib/macro/dossierEngine';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.MACROLYNC_API_SECRET?.trim()
    || process.env.ALGO_PRIVATE_API_KEY?.trim();
  if (!secret || secret.length < 32) return false;

  const header = request.headers.get('authorization')?.trim() ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const macroKey = request.headers.get('x-macro-key')?.trim() ?? '';
  return safeEqual(macroKey, secret) || safeEqual(bearer, secret);
}

const headers = {
  'Cache-Control': 'no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
};

export async function GET(request: Request) {
  const secret = process.env.MACROLYNC_API_SECRET?.trim()
    || process.env.ALGO_PRIVATE_API_KEY?.trim();
  if (!secret || secret.length < 32) {
    console.error('Macro Context API disabled: a 32-character server secret is not configured.');
    return NextResponse.json({ error: 'Macro context API is not configured for authenticated access.' }, { status: 503, headers });
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers });
  }

  const ip = getClientIp(request);
  if (!checkRateLimit(ip, 30, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429, headers });
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
      bias_score: dossier.biasScore,
      confidence: dossier.confidence,
      policy_diff_bps: dossier.policyDiffBps,
      real_yield_diff_bps: dossier.realYieldDiffBps,
      two_year_yield_diff_bps: dossier.twoYearYieldDiffBps,
      cot_percentile_diff: dossier.cotPercentileDiff,
      cross_asset_confirmation: dossier.crossAssetConfirmation,
      news_lockout: dossier.eventRiskLockout,
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
