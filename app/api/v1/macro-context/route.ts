import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getMacroSnapshot } from '@/lib/macroEngine';
import { generatePairDossier } from '@/lib/macro/dossierEngine';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

function constantTimeEqual(candidate: string, expected: string): boolean {
  const candidateBytes = Buffer.from(candidate, 'utf8');
  const expectedBytes = Buffer.from(expected, 'utf8');
  if (candidateBytes.length !== expectedBytes.length || expectedBytes.length === 0) return false;
  return timingSafeEqual(candidateBytes, expectedBytes);
}

function getExpectedSecret(): string | null {
  const secret = process.env.MACROLYNC_API_SECRET?.trim()
    || process.env.ALGO_PRIVATE_API_KEY?.trim();
  return secret && secret.length >= 32 ? secret : null;
}

function isAuthorized(request: Request, expectedSecret: string): boolean {
  const macroKey = request.headers.get('x-macro-key')?.trim() ?? '';
  const authorization = request.headers.get('authorization')?.trim() ?? '';
  const bearerToken = authorization.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : '';

  return constantTimeEqual(macroKey, expectedSecret)
    || constantTimeEqual(bearerToken, expectedSecret);
}

const noStoreHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
};

export async function GET(request: Request) {
  const expectedSecret = getExpectedSecret();
  if (!expectedSecret) {
    console.error('Macro context API unavailable: no valid server authentication secret is configured.');
    return NextResponse.json(
      { error: 'Macro context API is not configured for authenticated access.' },
      { status: 503, headers: noStoreHeaders }
    );
  }

  if (!isAuthorized(request, expectedSecret)) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide a valid x-macro-key or Bearer token.' },
      { status: 401, headers: noStoreHeaders }
    );
  }

  const ip = getClientIp(request);
  if (!checkRateLimit(ip, 30, 60_000)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Maximum 30 requests per minute.' },
      { status: 429, headers: noStoreHeaders }
    );
  }

  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get('symbol') ?? searchParams.get('pair') ?? 'EURUSD').trim().toUpperCase();

  if (!/^[A-Z]{6}$/.test(symbol) && symbol !== 'XAUUSD') {
    return NextResponse.json(
      { error: 'Invalid currency pair or symbol format. Must be a 6-character G8 pair (e.g., EURUSD) or XAUUSD.' },
      { status: 400, headers: noStoreHeaders }
    );
  }

  try {
    const snapshot = await getMacroSnapshot();
    const dossier = generatePairDossier(snapshot, symbol);

    const payload = {
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
      disclaimer: 'Read-only macroeconomic intelligence context. No technical trade execution or broker order routing.',
    };

    return NextResponse.json(payload, { status: 200, headers: noStoreHeaders });
  } catch (error) {
    console.error('Macro context query failed:', error);
    return NextResponse.json(
      { error: 'Macro context service is temporarily unavailable.' },
      { status: 503, headers: noStoreHeaders }
    );
  }
}
