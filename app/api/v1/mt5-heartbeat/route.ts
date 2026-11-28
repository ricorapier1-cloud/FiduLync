import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { recordMT5Heartbeat, isFreshMT5Timestamp } from '@/lib/quant/mt5Heartbeat';
import { evaluateSovereignShield } from '@/lib/quant/sovereignShield';
import { getMacroSnapshot } from '@/lib/macroEngine';
import { buildGoldMacroContext } from '@/lib/macro/goldAndRegimeEngine';
import { getStrategyValidationGate } from '@/lib/quant/strategyValidationGate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

function authenticate(request: Request): boolean {
  const authorization = request.headers.get('authorization')?.trim() ?? '';
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const candidate = (request.headers.get('x-macro-key')?.trim() || bearer).trim();
  if (!candidate) return false;

  const validTokens = [
    process.env.MACRO_API_TOKEN?.trim(),
    process.env.MT5_ACCOUNT_INGEST_TOKEN?.trim(),
    process.env.MACROLYNC_API_SECRET?.trim(),
    process.env.ALGO_PRIVATE_API_KEY?.trim(),
  ].filter((token): token is string => Boolean(token && token.length >= 32));

  // Production must never accept an arbitrary length-only token.
  return validTokens.some((valid) => safeEqual(candidate, valid));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  if (!authenticate(request)) {
    return NextResponse.json({ error: 'Unauthorized MT5 heartbeat request.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }
  if (!isRecord(body)) {
    return NextResponse.json({ error: 'Missing heartbeat payload.' }, { status: 400 });
  }

  const login = typeof body.login === 'string' ? body.login.trim() : '';
  const server = typeof body.server === 'string' ? body.server.trim() : '';
  const broker = typeof body.broker === 'string' ? body.broker.trim() : null;
  const timestampUtc = typeof body.timestampUtc === 'string' ? body.timestampUtc.trim() : '';
  const accountEquity = typeof body.accountEquity === 'number' && Number.isFinite(body.accountEquity)
    ? body.accountEquity : null;
  const accountBalance = typeof body.accountBalance === 'number' && Number.isFinite(body.accountBalance)
    ? body.accountBalance : null;
  const dailyClosedTrades = typeof body.dailyClosedTrades === 'number'
    && Number.isSafeInteger(body.dailyClosedTrades) ? body.dailyClosedTrades : null;
  const dailyLosses = typeof body.dailyLosses === 'number'
    && Number.isSafeInteger(body.dailyLosses) ? body.dailyLosses : null;
  const dailyStatsTimeBasis = body.dailyStatsTimeBasis;
  const liveBrokerSpread = typeof body.liveBrokerSpread === 'number'
    && Number.isFinite(body.liveBrokerSpread) && body.liveBrokerSpread >= 0
    ? body.liveBrokerSpread : null;
  const spreadSymbol = typeof body.spreadSymbol === 'string' ? body.spreadSymbol.trim().toUpperCase() : null;

  let openCurrencyLegs: string[] | null = null;
  if (body.openCurrencyLegs !== undefined && body.openCurrencyLegs !== null) {
    if (!Array.isArray(body.openCurrencyLegs)
      || !body.openCurrencyLegs.every((item) => typeof item === 'string' && /^[A-Z0-9._-]{3,16}$/.test(item))) {
      return NextResponse.json({ error: 'openCurrencyLegs must be an array of valid broker symbols.' }, { status: 422 });
    }
    openCurrencyLegs = body.openCurrencyLegs as string[];
  }

  if (!login || login.length > 32 || !server || server.length > 128
    || accountEquity === null || accountEquity <= 0
    || accountBalance === null || accountBalance <= 0
    || dailyClosedTrades === null || dailyClosedTrades < 0
    || dailyLosses === null || dailyLosses < 0 || dailyLosses > dailyClosedTrades
    || dailyStatsTimeBasis !== 'BROKER_SERVER_DAY'
    || !timestampUtc || !isFreshMT5Timestamp(timestampUtc)
    || (spreadSymbol !== null && !/^[A-Z0-9._-]{3,16}$/.test(spreadSymbol))) {
    return NextResponse.json({
      error: 'Incomplete or invalid MT5 heartbeat. Require broker identity, positive equity/balance, explicit daily counts, broker-day basis and a fresh timezone-aware UTC timestamp.',
    }, { status: 422 });
  }

  let stored;
  try {
    stored = await recordMT5Heartbeat({
      login,
      server,
      broker,
      accountEquity,
      accountBalance,
      dailyClosedTrades,
      dailyLosses,
      dailyStatsTimeBasis: 'BROKER_SERVER_DAY',
      openCurrencyLegs,
      liveBrokerSpread,
      spreadSymbol,
      timestampUtc,
      accountKey: typeof body.accountKey === 'string' ? body.accountKey : undefined,
    });
  } catch (error) {
    console.error('MT5 heartbeat persistence rejected:', error);
    return NextResponse.json({
      error: 'MT5 heartbeat could not be durably verified. Governance remains locked.',
    }, { status: 503 });
  }

  const [snapshot, validationGate] = await Promise.all([getMacroSnapshot(), getStrategyValidationGate()]);
  const goldContext = await buildGoldMacroContext(snapshot);
  const vix = goldContext.drivers.VIXCLS.state === 'HEALTHY' ? goldContext.drivers.VIXCLS.value : null;
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
  const newsLockoutActive = !calendarVerified || highImpactWindow;

  const sovereignShield = evaluateSovereignShield({
    vix,
    governance: {
      tradesToday: stored.dailyClosedTrades,
      lossesToday: stored.dailyLosses,
      rollingSevenDayDrawdownPct: stored.rollingSevenDayDrawdownPct,
      ledgerVerified: stored.governanceVerified,
    },
  });

  const dailyLimitReached = stored.dailyLosses >= 2 || stored.dailyClosedTrades >= 2;
  const drawdownLimitReached = stored.rollingSevenDayDrawdownPct !== null
    && stored.rollingSevenDayDrawdownPct <= -4.0;
  const killSwitchActive = !stored.governanceVerified
    || !validationGate.verified
    || dailyLimitReached
    || drawdownLimitReached
    || (vix !== null && vix >= 32.0)
    || newsLockoutActive
    || sovereignShield.status === 'BLACK_SWAN_LOCKOUT';

  const killSwitchReason = !stored.governanceVerified
    ? 'Seven-day MT5 equity history is not yet complete and verified'
    : !validationGate.verified ? (validationGate.blockers[0] ?? 'Strategy has no owner-approved out-of-sample validation')
      : stored.dailyLosses >= 2 ? 'Daily loss limit reached (broker server day)'
      : stored.dailyClosedTrades >= 2 ? 'Daily maximum trade count reached (broker server day)'
        : drawdownLimitReached ? 'Verified seven-day peak-to-trough equity drawdown limit breached'
          : newsLockoutActive ? 'Economic calendar is unavailable or a high-impact event is inside the lockout window'
            : vix !== null && vix >= 32.0 ? 'VIX Black Swan Lockout (VIX >= 32.0)'
              : sovereignShield.blockReasons[0] ?? null;

  const deskStatus = killSwitchActive || !sovereignShield.allowedToTrade ? 'LOCKOUT'
    : sovereignShield.maxAllowedRiskPct <= 0.5 ? 'HALF_RISK' : 'CLEARED';

  return NextResponse.json({
    status: 'HEARTBEAT_PERSISTED',
    receivedAtUtc: stored.receivedAtUtc,
    deskStatus,
    allowedDirection: 'NONE',
    maxRiskPct: killSwitchActive ? 0 : sovereignShield.maxAllowedRiskPct,
    stopLossDistance: null,
    newsLockoutActive,
    killSwitchActive,
    killSwitchReason,
    openLegsCount: stored.openCurrencyLegs?.length ?? null,
    accountGovernance: {
      dailyClosedTrades: stored.dailyClosedTrades,
      dailyLosses: stored.dailyLosses,
      dailyStatsTimeBasis: stored.dailyStatsTimeBasis,
      rollingSevenDayDrawdownPct: stored.rollingSevenDayDrawdownPct,
      drawdownSampleCount: stored.drawdownSampleCount,
      drawdownCoverageComplete: stored.drawdownCoverageComplete,
      governanceVerified: stored.governanceVerified,
      strategyValidationStatus: validationGate.status,
      strategyValidationBlockers: validationGate.blockers,
      allowedToTrade: !killSwitchActive && sovereignShield.allowedToTrade && validationGate.verified,
    },
  });
}
