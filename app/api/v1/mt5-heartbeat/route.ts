import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { recordMT5Heartbeat } from '@/lib/quant/mt5Heartbeat';
import { evaluateSovereignShield } from '@/lib/quant/sovereignShield';
import { getMacroSnapshot } from '@/lib/macroEngine';
import { buildGoldMacroContext } from '@/lib/macro/goldAndRegimeEngine';

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
  ].filter((token): token is string => Boolean(token && token.length >= 16));

  if (validTokens.length === 0) {
    // If no secret configured in dev/testing, allow if token length >= 16
    return candidate.length >= 16;
  }

  return validTokens.some((valid) => safeEqual(candidate, valid));
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

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Missing heartbeat payload.' }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const accountEquity = typeof payload.accountEquity === 'number' && Number.isFinite(payload.accountEquity)
    ? payload.accountEquity : null;
  const accountBalance = typeof payload.accountBalance === 'number' && Number.isFinite(payload.accountBalance)
    ? payload.accountBalance : null;
  const dailyClosedTrades = typeof payload.dailyClosedTrades === 'number' && Number.isInteger(payload.dailyClosedTrades) && payload.dailyClosedTrades >= 0
    ? payload.dailyClosedTrades : 0;
  const dailyLosses = typeof payload.dailyLosses === 'number' && Number.isInteger(payload.dailyLosses) && payload.dailyLosses >= 0
    ? payload.dailyLosses : 0;
  const liveBrokerSpread = typeof payload.liveBrokerSpread === 'number' && Number.isFinite(payload.liveBrokerSpread) && payload.liveBrokerSpread >= 0
    ? payload.liveBrokerSpread : 0;
  const timestampUtc = typeof payload.timestampUtc === 'string' && payload.timestampUtc.trim().length > 0
    ? payload.timestampUtc.trim() : new Date().toISOString();

  let openCurrencyLegs: string[] = [];
  if (Array.isArray(payload.openCurrencyLegs)) {
    openCurrencyLegs = payload.openCurrencyLegs.filter((item): item is string => typeof item === 'string' && item.length <= 5);
  } else if (typeof payload.openCurrencyLegs === 'string') {
    openCurrencyLegs = payload.openCurrencyLegs.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  }

  if (accountEquity === null || accountBalance === null) {
    return NextResponse.json({
      error: 'Invalid broker state: accountEquity and accountBalance must be valid numbers.',
    }, { status: 422 });
  }

  const stored = recordMT5Heartbeat({
    accountEquity,
    accountBalance,
    dailyClosedTrades,
    dailyLosses,
    openCurrencyLegs,
    liveBrokerSpread,
    timestampUtc,
    accountKey: typeof payload.accountKey === 'string' ? payload.accountKey : undefined,
    login: typeof payload.login === 'string' ? payload.login : undefined,
    server: typeof payload.server === 'string' ? payload.server : undefined,
    broker: typeof payload.broker === 'string' ? payload.broker : undefined,
  });

  // Evaluate governance and kill-switch
  const snapshot = await getMacroSnapshot();
  const goldContext = await buildGoldMacroContext(snapshot);
  const vix = goldContext.drivers.VIXCLS.state === 'HEALTHY' ? goldContext.drivers.VIXCLS.value : null;

  const rollingDrawdownPct = accountBalance > 0
    ? Math.min(0, ((accountEquity - accountBalance) / accountBalance) * 100)
    : 0;

  const sovereignShield = evaluateSovereignShield({
    vix,
    governance: {
      tradesToday: dailyClosedTrades,
      lossesToday: dailyLosses,
      rollingSevenDayDrawdownPct: rollingDrawdownPct,
      ledgerVerified: true,
    },
  });

  // Independent killswitch conditions
  const killSwitchActive = dailyLosses >= 2
    || dailyClosedTrades >= 2
    || rollingDrawdownPct <= -4.0
    || (vix !== null && vix >= 32.0)
    || sovereignShield.status === 'BLACK_SWAN_LOCKOUT';

  const killSwitchReason = killSwitchActive
    ? dailyLosses >= 2 ? 'Daily loss limit reached (2 losses today)'
      : dailyClosedTrades >= 2 ? 'Daily maximum trade count reached (2 trades taken today)'
        : rollingDrawdownPct <= -4.0 ? 'Sovereign Shield drawdown floor breached (-4.0% drawdown limit)'
          : vix !== null && vix >= 32.0 ? 'VIX Black Swan Lockout (VIX >= 32.0)'
            : 'Sovereign Shield Lockout Active'
    : null;

  const deskStatus = killSwitchActive || !sovereignShield.allowedToTrade ? 'LOCKOUT'
    : sovereignShield.maxAllowedRiskPct <= 0.5 ? 'HALF_RISK' : 'CLEARED';

  return NextResponse.json({
    status: 'HEARTBEAT_ACCEPTED',
    receivedAtUtc: stored.receivedAtUtc,
    deskStatus,
    allowedDirection: killSwitchActive ? 'NONE' : 'STAND_BY',
    maxRiskPct: killSwitchActive ? 0.0 : sovereignShield.maxAllowedRiskPct,
    stopLossDistance: null,
    newsLockoutActive: sovereignShield.blockReasons.includes('CALENDAR_EVENT_WINDOW_ACTIVE'),
    killSwitchActive,
    killSwitchReason,
    openLegsCount: openCurrencyLegs.length,
    accountGovernance: {
      dailyClosedTrades,
      dailyLosses,
      drawdownPct: Number(rollingDrawdownPct.toFixed(2)),
      governanceVerified: true,
      allowedToTrade: !killSwitchActive && sovereignShield.allowedToTrade,
    },
  });
}
