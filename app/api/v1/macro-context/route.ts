import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getMacroSnapshot } from '@/lib/macroEngine';
import { generatePairDossier, G8_PAIRS } from '@/lib/macro/dossierEngine';
import { getSupabaseAdmin } from '@/lib/serverSupabase';
import { getMarketQuotes } from '@/lib/marketFeeds';
import { buildGoldMacroContext } from '@/lib/macro/goldAndRegimeEngine';
import type { MacroContextPayload, MacroSymbolBias } from '@/types/desk';

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

  // The private macro bridge uses a dedicated read-only service credential.
  // Legacy per-installation/license tokens are intentionally no longer accepted.
  const secret = process.env.MACRO_API_TOKEN?.trim()
    || process.env.MACROLYNC_API_SECRET?.trim()
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

function hourInZone(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return hour + minute / 60;
}

function activeMarketSession(date = new Date()): 'LONDON' | 'NY' | 'CLOSED' {
  const watHour = hourInZone(date, 'Africa/Lagos');
  if (watHour >= 8 && watHour < 12) return 'LONDON';
  const nyHour = hourInZone(date, 'America/New_York');
  if (nyHour >= 8 && nyHour < 12) return 'NY';
  return 'CLOSED';
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
    const secret = process.env.MACRO_API_TOKEN?.trim()
      || process.env.MACROLYNC_API_SECRET?.trim()
      || process.env.ALGO_PRIVATE_API_KEY?.trim();
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
  if (!G8_PAIRS.includes(symbol as typeof G8_PAIRS[number])) {
    return NextResponse.json({ error: 'Invalid symbol. Use a six-character FX pair or XAUUSD.' }, { status: 400, headers });
  }

  try {
    const [snapshot, quotes] = await Promise.all([getMacroSnapshot(), getMarketQuotes()]);
    const goldContext = await buildGoldMacroContext(snapshot);
    const dossier = generatePairDossier(snapshot, symbol);
    const goldAvailable = goldContext.overallState === 'AVAILABLE' && goldContext.goldBiasScore !== null;
    const goldBias = goldContext.goldBiasScore;
    const goldVerdict = goldContext.directionalVerdict;
    const activeSession = activeMarketSession();
    const highImpactWindow = snapshot.catalysts.some((event) => event.impact === 'High'
      && Math.abs(Date.parse(event.scheduledAt) - Date.now()) <= 30 * 60_000);
    const newsLockoutActive = snapshot.calendarSource !== 'provider' || !snapshot.calendarProvider || highImpactWindow || dossier.eventRiskLockout;
    const symbolBiases: Record<string, MacroSymbolBias> = Object.fromEntries(G8_PAIRS.map((candidate) => {
      if (candidate === 'XAUUSD') {
        const available = goldContext.goldBiasScore !== null
          && goldContext.directionalVerdict !== 'INSUFFICIENT_EVIDENCE';
        return [candidate, {
          biasScore: available ? goldContext.goldBiasScore : null,
          directionalVerdict: available ? goldContext.directionalVerdict : 'INSUFFICIENT_EVIDENCE',
          macroRiskRegime: goldContext.liquidityRegime,
          confidence: available ? (goldContext.evidenceCoveragePct >= 100 ? 'MODERATE' : 'LOW') : 'INSUFFICIENT_EVIDENCE',
        }];
      }
      const item = generatePairDossier(snapshot, candidate);
      const available = item.confidence !== 'INSUFFICIENT_EVIDENCE';
      return [candidate, {
        biasScore: available ? item.biasScore : null,
        directionalVerdict: !available ? 'INSUFFICIENT_EVIDENCE'
          : item.fundamentalBias.includes('BULLISH') ? 'BULLISH'
            : item.fundamentalBias.includes('BEARISH') ? 'BEARISH' : 'NEUTRAL',
        macroRiskRegime: item.macroRegime,
        confidence: item.confidence,
      }];
    }));
    const selectedBias = symbolBiases[symbol];
    const allowedToTrade = Boolean(selectedBias?.biasScore !== null
      && selectedBias?.directionalVerdict !== 'INSUFFICIENT_EVIDENCE'
      && Math.abs(selectedBias?.biasScore ?? 0) >= 20
      && activeSession !== 'CLOSED' && !newsLockoutActive);
    const payload: MacroContextPayload = {
      schema_version: '1.0.0',
      generated_at_utc: new Date().toISOString(),
      timezone: 'Africa/Lagos',
      allowedToTrade,
      biasScore: selectedBias?.biasScore ?? null,
      directionalVerdict: selectedBias?.directionalVerdict ?? 'INSUFFICIENT_EVIDENCE',
      newsLockoutActive,
      activeSession,
      macroRiskRegime: selectedBias?.macroRiskRegime ?? 'INSUFFICIENT_EVIDENCE',
      symbols: symbolBiases,
      decisionScope: 'MACRO_GATE_ONLY',
      symbol: dossier.symbol,
      base: dossier.base,
      quote: dossier.quote,
      macro_regime: symbol === 'XAUUSD' ? (goldContext?.liquidityRegime ?? 'INSUFFICIENT_EVIDENCE') : dossier.macroRegime,
      fundamental_bias: symbol === 'XAUUSD' ? (goldVerdict === 'BULLISH' ? 'BULLISH' : goldVerdict === 'BEARISH' ? 'BEARISH' : 'NEUTRAL') : dossier.fundamentalBias,
      decision_status: symbol === 'XAUUSD' ? (goldAvailable ? 'RESEARCH_CONTEXT_AVAILABLE' : 'INSUFFICIENT_EVIDENCE') : dossier.confidence === 'INSUFFICIENT_EVIDENCE' ? 'INSUFFICIENT_EVIDENCE' : 'RESEARCH_CONTEXT_AVAILABLE',
      bias_score: symbol === 'XAUUSD' ? (goldAvailable ? goldBias : null) : dossier.confidence === 'INSUFFICIENT_EVIDENCE' ? null : dossier.biasScore,
      confidence: symbol === 'XAUUSD' ? (goldAvailable ? 'LOW' : 'INSUFFICIENT_EVIDENCE') : dossier.confidence,
      policy_diff_bps: symbol === 'XAUUSD' ? null : dossier.confidence === 'INSUFFICIENT_EVIDENCE' ? null : dossier.policyDiffBps,
      real_policy_rate_diff_bps: symbol === 'XAUUSD' ? null : dossier.confidence === 'INSUFFICIENT_EVIDENCE' ? null : dossier.realPolicyRateDiffBps,
      real_yield_diff_bps: null,
      two_year_yield_diff_bps: symbol === 'XAUUSD' ? null : dossier.twoYearYieldDiffBps,
      cot_percentile_diff: symbol === 'XAUUSD' ? null : snapshot.cotSource === 'provider'
        && snapshot.cot.some((position) => position.market === dossier.base)
        && snapshot.cot.some((position) => position.market === dossier.quote)
          ? dossier.cotPercentileDiff : null,
      cross_asset_confirmation: symbol === 'XAUUSD' ? (goldContext?.liquidityRegime ?? 'INSUFFICIENT_EVIDENCE') : dossier.crossAssetConfirmation,
      live_quotes: quotes.map((quote) => {
        const ageMs = Math.max(0, Date.now() - Date.parse(quote.timestamp));
        const providerQuote = quote.source === 'finnhub' || quote.source === 'mt5';
        const freshness = providerQuote
          ? ageMs <= 120_000 ? 'FRESH' as const : 'STALE' as const
          : 'REFERENCE' as const;
        return {
          symbol: quote.symbol,
          mid: freshness === 'STALE' ? null : quote.price,
          observation_time_utc: quote.timestamp,
          age_ms: Number.isFinite(ageMs) ? ageMs : null,
          freshness,
          source: quote.source,
          quote_type: providerQuote ? 'PROVIDER_QUOTE' as const : 'REFERENCE_RATE' as const,
        };
      }),
      daily_governance: {
        state: 'NOT_CONNECTED_TO_SERVER',
        trades_taken: null,
        losses: null,
        locked: null,
        authority: 'MT5_ACCOUNT_SIDE_ENFORCEMENT_REQUIRED',
      },
      calendar_verified: snapshot.calendarSource === 'provider' && Boolean(snapshot.calendarProvider),
      event_risk_status: snapshot.calendarSource === 'provider' ? 'PROVIDER_CALENDAR' : 'UNVERIFIED_CALENDAR',
      news_lockout: newsLockoutActive,
      next_catalyst: snapshot.calendarSource === 'provider' && dossier.nextCatalyst ? {
        title: dossier.nextCatalyst.title,
        scheduled_at_utc: dossier.nextCatalyst.scheduledAt,
        region: dossier.nextCatalyst.region,
        impact: dossier.nextCatalyst.impact,
        lockout_active: dossier.nextCatalyst.lockoutActive,
      } : null,
      invalidation_triggers: symbol === 'XAUUSD' ? (goldContext?.invalidationTriggers ?? []) : dossier.invalidationTriggers,
      provenance: {
        as_of_utc: snapshot.asOf,
        source_mode: snapshot.source,
        calendar_source: snapshot.calendarSource ?? 'unavailable',
        calendar_provider: snapshot.calendarProvider ?? null,
        cot_source: snapshot.cotSource ?? 'unavailable',
      },
      disclaimer: 'Read-only macroeconomic intelligence. No technical analysis or broker order execution.',
    };
    return NextResponse.json(payload, { status: 200, headers });
  } catch (error) {
    console.error('Macro context query failed:', error);
    return NextResponse.json({ error: 'Macro context service is temporarily unavailable.' }, { status: 503, headers });
  }
}
