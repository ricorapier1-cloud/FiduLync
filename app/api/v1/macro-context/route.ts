import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getMacroSnapshot } from '@/lib/macroEngine';
import { generatePairDossier, G8_PAIRS } from '@/lib/macro/dossierEngine';
import { getSupabaseAdmin } from '@/lib/serverSupabase';
import { getMarketQuotes } from '@/lib/marketFeeds';
import { buildGoldMacroContext } from '@/lib/macro/goldAndRegimeEngine';
import type { MacroContextPayload, MacroSymbolBias } from '@/types/desk';
import { evaluateSovereignShield } from '@/lib/quant/sovereignShield';
import { getLatestMT5Heartbeat } from '@/lib/quant/mt5Heartbeat';
import { getStrategyValidationGate } from '@/lib/quant/strategyValidationGate';
import { RESEARCH_OBJECTIVES } from '@/lib/quant/researchObjectives';
import { getPointInTimeIntegrity } from '@/lib/quant/pointInTimeIntegrity';
import { getActiveMarketSession } from '@/lib/marketSessions';

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


function isFreshCotReport(date: string | undefined, maxAgeDays = 14): boolean {
  if (!date) return false;
  const timestamp = Date.parse(date);
  const ageMs = Date.now() - timestamp;
  return Number.isFinite(timestamp) && ageMs >= -5 * 60_000 && ageMs <= maxAgeDays * 86_400_000;
}

function activeMarketSession(date = new Date()): 'LONDON' | 'NY' | 'CLOSED' {
  const session = getActiveMarketSession(date);
  return session === 'NEW_YORK' ? 'NY' : session;
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
    const [snapshot, quotes, latestHeartbeat, validationGate, pointInTimeIntegrity] = await Promise.all([
      getMacroSnapshot(),
      getMarketQuotes(),
      getLatestMT5Heartbeat(),
      getStrategyValidationGate(),
      getPointInTimeIntegrity(),
    ]);
    const goldContext = await buildGoldMacroContext(snapshot);
    const dossier = generatePairDossier(snapshot, symbol);
    const goldAvailable = goldContext.overallState === 'AVAILABLE' && goldContext.goldBiasScore !== null;
    const goldBias = goldContext.goldBiasScore;
    const goldVerdict = goldContext.directionalVerdict;
    const activeSession = activeMarketSession();
    const calendarRetrievedAtMs = snapshot.calendarRetrievedAtUtc ? Date.parse(snapshot.calendarRetrievedAtUtc) : NaN;
    const calendarCoverageEndMs = snapshot.calendarCoverageEndUtc ? Date.parse(snapshot.calendarCoverageEndUtc) : NaN;
    const calendarVerified = snapshot.calendarSource === 'provider' && Boolean(snapshot.calendarProvider)
      && Number.isFinite(calendarRetrievedAtMs)
      && Date.now() - calendarRetrievedAtMs <= 60 * 60_000
      && Date.now() - calendarRetrievedAtMs >= -30_000
      && Number.isFinite(calendarCoverageEndMs)
      && calendarCoverageEndMs >= Date.now() + 24 * 60 * 60_000;
    const highImpactWindow = calendarVerified && snapshot.catalysts.some((event) => event.impact === 'High'
      && Math.abs(Date.parse(event.scheduledAt) - Date.now()) <= 30 * 60_000);
    const newsLockoutActive = !calendarVerified || highImpactWindow || dossier.eventRiskLockout;
    const highImpactEvents = (calendarVerified ? snapshot.catalysts : []).filter((event) => event.impact === 'High')
      .map((event) => ({ event, minutes: (Date.parse(event.scheduledAt) - Date.now()) / 60_000 }))
      .filter((item) => Number.isFinite(item.minutes));
    const nearestHighImpact = [...highImpactEvents].sort((a, b) => Math.abs(a.minutes) - Math.abs(b.minutes))[0];
    const nearestRateDecision = highImpactEvents
      .filter((item) => /rate decision|interest rate|monetary policy decision|policy rate/i.test(item.event.title))
      .sort((a, b) => Math.abs(a.minutes) - Math.abs(b.minutes))[0];
    const isRateDecision = Boolean(nearestRateDecision && Math.abs(nearestRateDecision.minutes) <= 60);
    const shieldEventMinutesAway = isRateDecision ? nearestRateDecision!.minutes : nearestHighImpact?.minutes ?? null;
    const crowdedPositions = snapshot.cot
      .filter((position) => position.sampleSize !== undefined && position.sampleSize >= 52
        && position.percentile !== null && isFreshCotReport(position.reportDate))
      .map((position) => ({ symbol: position.market, percentile: position.percentile }));
    const hasFreshBrokerHeartbeat = Boolean(latestHeartbeat && latestHeartbeat.fresh);
    const governance = hasFreshBrokerHeartbeat && latestHeartbeat ? {
      tradesToday: latestHeartbeat.dailyClosedTrades,
      lossesToday: latestHeartbeat.dailyLosses,
      rollingSevenDayDrawdownPct: latestHeartbeat.rollingSevenDayDrawdownPct,
      ledgerVerified: latestHeartbeat.governanceVerified,
    } : {
      tradesToday: null,
      lossesToday: null,
      rollingSevenDayDrawdownPct: null,
      ledgerVerified: false,
    };

    const sovereignShield = evaluateSovereignShield({
      vix: goldContext.drivers.VIXCLS.state === 'HEALTHY' ? goldContext.drivers.VIXCLS.value : null,
      eventMinutesAway: shieldEventMinutesAway,
      isCentralBankRateDecision: isRateDecision,
      cotPercentiles: crowdedPositions,
      governance,
    });
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
    const signalResponse = await fetch(new URL('/api/v1/intraday-signals', request.url), {
      cache: 'no-store',
      signal: AbortSignal.timeout(25_000),
    }).catch((error) => {
      console.warn('Intraday signals are unavailable:', error);
      return null;
    });
    const signalPayload = signalResponse?.ok
      ? await signalResponse.json() as { signals?: MacroContextPayload['signals'] }
      : null;
    const intradaySignals = signalPayload?.signals ?? [];
    const selectedSignal = intradaySignals.find((item) => item.symbol === symbol) ?? null;

    const hasFreshBaseCot = snapshot.cotSource === 'provider' && snapshot.cot.some((position) => position.market === dossier.base
      && position.sampleSize !== undefined && position.sampleSize >= 52 && position.percentile !== null && isFreshCotReport(position.reportDate));
    const hasFreshQuoteCot = snapshot.cotSource === 'provider' && snapshot.cot.some((position) => position.market === dossier.quote
      && position.sampleSize !== undefined && position.sampleSize >= 52 && position.percentile !== null && isFreshCotReport(position.reportDate));
    const selectedBias = symbolBiases[symbol];
    const allowedToTrade = Boolean(validationGate.verified && pointInTimeIntegrity.status === 'VERIFIED' && sovereignShield.allowedToTrade
      && selectedBias?.biasScore !== null
      && selectedBias?.directionalVerdict !== 'INSUFFICIENT_EVIDENCE'
      && Math.abs(selectedBias?.biasScore ?? 0) >= 20
      && activeSession !== 'CLOSED' && !newsLockoutActive);
    const setupReady = selectedSignal?.signalState === 'ACTIVE_SETUP'
      && selectedSignal.direction !== 'NONE' && selectedSignal.executionDataVerified === true;
    const effectiveAllowed = allowedToTrade && setupReady;
    const deskStatus: MacroContextPayload['deskStatus'] = !effectiveAllowed ? 'LOCKOUT'
      : sovereignShield.maxAllowedRiskPct <= 0.5 ? 'HALF_RISK' : 'CLEARED';
    const deskLockoutReason = effectiveAllowed ? null
      : pointInTimeIntegrity.status !== 'VERIFIED' ? pointInTimeIntegrity.blockers[0] ?? 'POINT_IN_TIME_PROVENANCE_NOT_VERIFIED'
        : !validationGate.verified ? validationGate.blockers[0] ?? 'STRATEGY_VALIDATION_NOT_APPROVED'
          : !sovereignShield.governanceVerified ? 'MT5 account governance ledger is not connected and verified'
          : activeSession === 'CLOSED' ? 'Outside London/New York execution session'
            : newsLockoutActive ? 'Economic calendar is unavailable, stale, or inside the event-risk lockout window'
              : selectedSignal?.blockers?.[0] ?? 'No active broker-verified macro-aligned setup';
    const activeSessionWat: MacroContextPayload['activeSessionWat'] = activeSession === 'NY' ? 'NEW_YORK'
      : activeSession === 'LONDON' ? 'LONDON' : 'OFF_SESSION';

    const payload: MacroContextPayload = {
      schema_version: '1.0.0',
      generated_at_utc: new Date().toISOString(),
      timezone: 'Africa/Lagos',
      allowedToTrade: effectiveAllowed,
      deskStatus,
      maxRiskPct: effectiveAllowed ? sovereignShield.maxAllowedRiskPct : 0,
      activeSessionWat,
      deskLockoutReason,
      allowedDirection: effectiveAllowed ? selectedSignal?.direction ?? 'NONE' : 'NONE',
      stopLossDistance: effectiveAllowed ? selectedSignal?.slPips ?? null : null,
      zScore: selectedSignal?.zScore ?? null,
      hurstExponent: selectedSignal?.hurst ?? null,
      ker: selectedSignal?.ker ?? null,
      adrUsedPct: selectedSignal?.adrUsedPct ?? null,
      pdh: selectedSignal?.pdh ?? null,
      pdl: selectedSignal?.pdl ?? null,
      entryPrice: effectiveAllowed ? selectedSignal?.entryPrice ?? null : null,
      stopLoss: effectiveAllowed ? selectedSignal?.stopLoss ?? null : null,
      takeProfit1: effectiveAllowed ? selectedSignal?.takeProfit1 ?? null : null,
      takeProfit2: effectiveAllowed ? selectedSignal?.takeProfit2 ?? null : null,
      biasScore: selectedBias?.biasScore ?? null,
      directionalVerdict: selectedBias?.directionalVerdict ?? 'INSUFFICIENT_EVIDENCE',
      newsLockoutActive,
      activeSession,
      macroRiskRegime: selectedBias?.macroRiskRegime ?? 'INSUFFICIENT_EVIDENCE',
      symbols: symbolBiases,
      decisionScope: 'MACRO_GATE_ONLY',
      signals: intradaySignals,
      sovereignShield: {
        status: sovereignShield.status,
        maxAllowedRiskPct: sovereignShield.maxAllowedRiskPct,
        blockReasons: sovereignShield.blockReasons,
        crowdedUnwindRisk: sovereignShield.crowdedUnwindRisk,
        spreadBlowoutBlock: sovereignShield.spreadBlowoutBlock,
        governanceVerified: sovereignShield.governanceVerified,
      },
      symbol: dossier.symbol,
      base: dossier.base,
      quote: dossier.quote,
      macro_regime: symbol === 'XAUUSD' ? (goldContext?.liquidityRegime ?? 'INSUFFICIENT_EVIDENCE') : dossier.macroRegime,
      fundamental_bias: symbol === 'XAUUSD' ? (goldVerdict === 'BULLISH' ? 'BULLISH' : goldVerdict === 'BEARISH' ? 'BEARISH' : 'NEUTRAL') : dossier.fundamentalBias,
      decision_status: symbol === 'XAUUSD' ? (goldAvailable ? 'RESEARCH_CONTEXT_AVAILABLE' : 'INSUFFICIENT_EVIDENCE') : dossier.confidence === 'INSUFFICIENT_EVIDENCE' ? 'INSUFFICIENT_EVIDENCE' : 'RESEARCH_CONTEXT_AVAILABLE',
      bias_score: symbol === 'XAUUSD' ? (goldAvailable ? goldBias : null) : dossier.confidence === 'INSUFFICIENT_EVIDENCE' ? null : dossier.biasScore,
      confidence: symbol === 'XAUUSD' ? (goldAvailable ? 'LOW' : 'INSUFFICIENT_EVIDENCE') : dossier.confidence,
      confidence_basis: 'EVIDENCE_COMPLETENESS_NOT_WIN_PROBABILITY',
      research_objectives: RESEARCH_OBJECTIVES,
      strategy_validation: {
        status: validationGate.status,
        verified: validationGate.verified,
        approved_report_id: validationGate.approvedReportId,
        blockers: validationGate.blockers,
      },
      point_in_time_integrity: pointInTimeIntegrity,
      policy_diff_bps: symbol === 'XAUUSD' ? null : dossier.confidence === 'INSUFFICIENT_EVIDENCE' ? null : dossier.policyDiffBps,
      real_policy_rate_diff_bps: symbol === 'XAUUSD' ? null : dossier.confidence === 'INSUFFICIENT_EVIDENCE' ? null : dossier.realPolicyRateDiffBps,
      real_yield_diff_bps: null,
      two_year_yield_diff_bps: symbol === 'XAUUSD' ? null : dossier.twoYearYieldDiffBps,
      cot_percentile_diff: symbol === 'XAUUSD' || !hasFreshBaseCot || !hasFreshQuoteCot
        ? null : dossier.cotPercentileDiff,
      cross_asset_confirmation: symbol === 'XAUUSD' ? (goldContext?.liquidityRegime ?? 'INSUFFICIENT_EVIDENCE') : dossier.crossAssetConfirmation,
      live_quotes: quotes.map((quote) => {
        const timestampMs = Date.parse(quote.timestamp);
        const rawAgeMs = Date.now() - timestampMs;
        const timestampValid = Number.isFinite(timestampMs) && rawAgeMs >= -5 * 60_000;
        const ageMs = timestampValid ? Math.max(0, rawAgeMs) : null;
        const freshness = !timestampValid || ageMs === null || ageMs > 120_000
          ? 'STALE' as const : 'FRESH' as const;
        return {
          symbol: quote.symbol,
          mid: freshness === 'STALE' ? null : quote.price,
          observation_time_utc: quote.timestamp,
          age_ms: ageMs,
          freshness,
          source: quote.source,
          quote_type: 'PROVIDER_QUOTE' as const,
        };
      }),
      daily_governance: {
        state: !hasFreshBrokerHeartbeat ? 'NOT_CONNECTED_TO_SERVER'
          : latestHeartbeat?.governanceVerified ? 'VERIFIED_FROM_MT5_HEARTBEAT'
            : 'CONNECTED_GOVERNANCE_UNVERIFIED',
        trades_taken: hasFreshBrokerHeartbeat ? latestHeartbeat!.dailyClosedTrades : null,
        losses: hasFreshBrokerHeartbeat ? latestHeartbeat!.dailyLosses : null,
        rolling_7d_drawdown_pct: hasFreshBrokerHeartbeat ? latestHeartbeat!.rollingSevenDayDrawdownPct : null,
        drawdown_sample_count: hasFreshBrokerHeartbeat ? latestHeartbeat!.drawdownSampleCount : 0,
        daily_stats_time_basis: hasFreshBrokerHeartbeat ? latestHeartbeat!.dailyStatsTimeBasis : null,
        heartbeat_received_at_utc: hasFreshBrokerHeartbeat ? latestHeartbeat!.receivedAtUtc : null,
        governance_verified: Boolean(hasFreshBrokerHeartbeat && latestHeartbeat?.governanceVerified),
        locked: !hasFreshBrokerHeartbeat || !latestHeartbeat?.governanceVerified
          || (latestHeartbeat?.dailyLosses ?? 0) >= 2,
        authority: 'MT5_ACCOUNT_SIDE_ENFORCEMENT_REQUIRED',
      },
      calendar_verified: calendarVerified,
      event_risk_status: calendarVerified ? 'PROVIDER_CALENDAR' : 'UNVERIFIED_CALENDAR',
      news_lockout: newsLockoutActive,
      next_catalyst: calendarVerified && dossier.nextCatalyst ? {
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
        calendar_source: calendarVerified ? snapshot.calendarSource : 'unavailable',
        calendar_provider: calendarVerified ? snapshot.calendarProvider ?? null : null,
        calendar_retrieved_at_utc: calendarVerified ? snapshot.calendarRetrievedAtUtc ?? null : null,
        calendar_coverage_end_utc: calendarVerified ? snapshot.calendarCoverageEndUtc ?? null : null,
        cot_source: snapshot.cotSource ?? 'unavailable',
      },
      disclaimer: 'Read-only macro research. Confidence denotes evidence completeness, not a win probability. No 60–65% win rate or 1:2 realised reward-to-risk result is claimed. Trade permission remains locked until owner-approved out-of-sample validation, complete point-in-time provenance, verified MT5 account governance and broker-executable market data are present.',
    };
    return NextResponse.json(payload, { status: 200, headers });
  } catch (error) {
    console.error('Macro context query failed:', error);
    return NextResponse.json({ error: 'Macro context service is temporarily unavailable.' }, { status: 503, headers });
  }
}
