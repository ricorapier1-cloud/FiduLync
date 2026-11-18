import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { supabaseInsert, supabaseRead } from '@/lib/supabaseAdmin';
import { getPersonalRiskPolicy } from '@/lib/riskPolicy';
import { calculateBrokerAwareVolume, evaluateRiskProposal, type RiskContext, type RiskProposal } from '@/lib/quantGovernance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Installation = { id: string; status: string };
type AccountSnapshot = {
  account_login: number; currency: string; balance: number; equity: number;
  margin: number; free_margin: number; open_positions: number; open_risk_cash: number;
  open_risk_verified: boolean; captured_at: string;
};
type Quote = {
  symbol: string; bid: number; ask: number; quote_time: string; spread_points: number;
  point: number | null; tick_size: number | null; tick_value: number | null; contract_size: number | null;\n  volume_min: number | null; volume_max: number | null; volume_step: number | null; stop_level_points: number | null;\n  margin_per_lot_buy: number | null; margin_per_lot_sell: number | null;
};
type RiskState = {
  daily_start_equity: number; weekly_start_equity: number; high_water_mark_equity: number;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  if (!checkRateLimit(getClientIp(request), 60, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
  }

  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const sentAt = Date.parse(request.headers.get('x-mt5-timestamp') ?? '');
  const nonce = request.headers.get('x-mt5-nonce') ?? '';
  if (!token.startsWith('flmt5_') || token.length < 40 || !Number.isFinite(sentAt)
    || Math.abs(Date.now() - sentAt) > 60_000 || !/^[0-9a-f-]{36}$/i.test(nonce)) {
    return NextResponse.json({ error: 'Invalid supervisor authentication envelope.' }, { status: 401 });
  }
  if (Number(request.headers.get('content-length') ?? 0) > 16_384) {
    return NextResponse.json({ error: 'Proposal payload is too large.' }, { status: 413 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'A valid JSON proposal is required.' }, { status: 400 });
  }
  if (!record(body) || !Number.isSafeInteger(body.account_login) || Number(body.account_login) <= 0
    || !record(body.proposal)) {
    return NextResponse.json({ error: 'Account login and proposal are required.' }, { status: 400 });
  }
  const p = body.proposal;
  const proposal: RiskProposal = {
    requestId: typeof p.requestId === 'string' ? p.requestId.trim() : '',
    installationId: typeof p.installationId === 'string' ? p.installationId.trim() : '',
    symbol: typeof p.symbol === 'string' ? p.symbol.trim().toUpperCase() : '',
    side: p.side === 'BUY' || p.side === 'SELL' ? p.side : 'BUY',
    entryPrice: typeof p.entryPrice === 'number' ? p.entryPrice : Number.NaN,
    stopLoss: typeof p.stopLoss === 'number' ? p.stopLoss : Number.NaN,
    takeProfit: typeof p.takeProfit === 'number' ? p.takeProfit : Number.NaN,
    requestedRiskPct: typeof p.requestedRiskPct === 'number' ? p.requestedRiskPct : Number.NaN,
  };
  if ((p.side !== 'BUY' && p.side !== 'SELL')
    || !proposal.installationId
    || !/^[A-Z0-9._-]{3,20}$/.test(proposal.symbol)
    || !/^[A-Za-z0-9_-]{8,100}$/.test(proposal.requestId)
    || !Number.isFinite(proposal.entryPrice) || !Number.isFinite(proposal.stopLoss)
    || !Number.isFinite(proposal.takeProfit) || !Number.isFinite(proposal.requestedRiskPct)) {
    return NextResponse.json({ error: 'Proposal fields are invalid.' }, { status: 400 });
  }

  try {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const installations = await supabaseRead<Installation[]>(
      'mt5_installations',
      `select=id,status&token_hash=eq.${tokenHash}&status=eq.active&limit=1`,
    );
    const installation = installations?.[0];
    if (!installation) return NextResponse.json({ error: 'Publisher token is invalid or revoked.' }, { status: 401 });
    if (proposal.installationId !== installation.id) {
      return NextResponse.json({ error: 'Proposal installation does not match its authenticated publisher.' }, { status: 403 });
    }

    const nonceRows = await supabaseInsert('mt5_ingest_nonces', { installation_id: installation.id, nonce });
    if (!nonceRows) return NextResponse.json({ error: 'Replay protection could not be stored.' }, { status: 503 });

    const accountLogin = Number(body.account_login);
    const [accounts, quotes, states] = await Promise.all([
      supabaseRead<AccountSnapshot[]>(
        'mt5_account_snapshots',
        `select=account_login,currency,balance,equity,margin,free_margin,open_positions,open_risk_cash,open_risk_verified,captured_at&installation_id=eq.${installation.id}&account_login=eq.${accountLogin}&limit=1`,
      ),
      supabaseRead<Quote[]>(
        'mt5_market_quotes',
        `select=symbol,bid,ask,quote_time,spread_points,point,tick_size,tick_value,contract_size,volume_min,volume_max,volume_step,stop_level_points,margin_per_lot_buy,margin_per_lot_sell&installation_id=eq.${installation.id}&symbol=eq.${encodeURIComponent(proposal.symbol)}&limit=1`,
      ),
      supabaseRead<RiskState[]>(
        'mt5_risk_state',
        `select=daily_start_equity,weekly_start_equity,high_water_mark_equity&installation_id=eq.${installation.id}&account_login=eq.${accountLogin}&limit=1`,
      ),
    ]);

    const account = accounts?.[0];
    const quote = quotes?.[0];
    const state = states?.[0];
    if (!account || !quote || !state) {
      const blockers = [!account ? 'ACCOUNT_SNAPSHOT_UNAVAILABLE' : !quote ? 'BROKER_QUOTE_UNAVAILABLE' : 'RISK_ANCHORS_UNAVAILABLE'];
      const evaluatedAt = new Date().toISOString();
      const abstention = {
        schemaVersion: '1.0', requestId: proposal.requestId, decision: 'ABSTAIN',
        approvedRiskPct: 0, approvedVolume: 0, estimatedRiskCash: 0,
        blockers, evaluatedAt,
      };
      const audit = await supabaseInsert('mt5_risk_decisions', {
        installation_id: installation.id, account_login: accountLogin,
        request_id: proposal.requestId, symbol: proposal.symbol, decision: 'ABSTAIN',
        approved_risk_pct: 0, approved_volume: 0, blockers, evaluated_at: evaluatedAt,
      });
      if (!audit) throw new Error('Risk abstention audit could not be persisted.');
      return NextResponse.json(abstention, { status: 200, headers: { 'Cache-Control': 'no-store' } });
    }

    const capturedAt = Date.parse(account.captured_at);
    const quoteAt = Date.parse(quote.quote_time);
    const quoteAgeMs = Date.now() - quoteAt;
    const snapshotAgeMs = Date.now() - capturedAt;
    const symbolSpec = {
      symbol: quote.symbol,
      tickSize: Number(quote.tick_size ?? 0),
      tickValuePerLot: Number(quote.tick_value ?? 0),
      volumeMin: Number(quote.volume_min ?? 0),
      volumeMax: Number(quote.volume_max ?? 0),
      volumeStep: Number(quote.volume_step ?? 0),
      contractSize: Number(quote.contract_size ?? 0),
      stopLevelPoints: Number(quote.stop_level_points ?? 0),
      point: Number(quote.point ?? 0),
      verified: Number(quote.tick_size) > 0 && Number(quote.tick_value) > 0
        && Number(quote.contract_size) > 0 && Number(quote.point) > 0
        && Number(quote.volume_min) > 0 && Number(quote.volume_max) >= Number(quote.volume_min)
        && Number(quote.volume_step) > 0 && Number(quote.stop_level_points) >= 0,
    };
    const policy = getPersonalRiskPolicy();
    const marginPerLot = proposal.side === 'BUY' ? Number(quote.margin_per_lot_buy ?? 0) : Number(quote.margin_per_lot_sell ?? 0);
    const sizing = calculateBrokerAwareVolume({
      equity: account.equity,
      riskPct: Math.min(proposal.requestedRiskPct, policy.maxPerTradeRiskPct),
      entryPrice: proposal.entryPrice,
      stopLoss: proposal.stopLoss,
      specification: symbolSpec,
    });
    const estimatedMargin = sizing.valid && marginPerLot > 0 ? sizing.volume * marginPerLot : Number.NaN;
    const context: RiskContext = {
      bid: quote.bid,
      ask: quote.ask,
      quoteAgeMs: Number.isFinite(quoteAgeMs) ? quoteAgeMs : Number.MAX_SAFE_INTEGER,
      spreadPoints: quote.spread_points,
      equity: account.equity,
      freeMargin: account.free_margin,
      usedMargin: account.margin,
      estimatedMargin,
      currentOpenRiskCash: account.open_risk_cash,
      dailyStartEquity: state.daily_start_equity,
      weeklyStartEquity: state.weekly_start_equity,
      highWaterMarkEquity: state.high_water_mark_equity,
      consecutiveLosses: Number.NaN,
      regime: 'UNAVAILABLE',
      marketDataHealth: snapshotAgeMs >= 0 && snapshotAgeMs <= 30_000 && quoteAgeMs >= 0 && quoteAgeMs <= 30_000 ? 'LIVE' : 'STALE',
      macroDataHealth: 'UNAVAILABLE',
      newsLockout: false,
      symbolSpec,
    };
    const unavailableBlockers: string[] = [];
    if (!sizing.valid || !Number.isFinite(estimatedMargin) || estimatedMargin <= 0) {
      unavailableBlockers.push('BROKER_SIZING_OR_MARGIN_CONTEXT_UNAVAILABLE');
    }
    if (!Number.isFinite(context.consecutiveLosses)) unavailableBlockers.push('LOSS_STREAK_CONTEXT_UNAVAILABLE');
    if (context.macroDataHealth !== 'LIVE') unavailableBlockers.push('MACRO_NEWS_CONTEXT_UNAVAILABLE');
    if (snapshotAgeMs < 0 || snapshotAgeMs > 30_000) unavailableBlockers.push('ACCOUNT_SNAPSHOT_STALE');
    if (quoteAgeMs < 0 || quoteAgeMs > 30_000) unavailableBlockers.push('BROKER_QUOTE_STALE');

    const forcedBlockers = [
      ...(!account.open_risk_verified ? ['OPEN_POSITION_RISK_UNVERIFIED'] : []),
      ...unavailableBlockers,
    ];
    const result = forcedBlockers.length
      ? {
          schemaVersion: '1.0' as const, requestId: proposal.requestId, decision: 'ABSTAIN' as const,
          approvedRiskPct: 0, approvedVolume: 0, estimatedRiskCash: 0, estimatedRewardRisk: null,
          blockers: forcedBlockers, evaluatedAt: new Date().toISOString(),
        }
      : evaluateRiskProposal(proposal, context, policy);

    const audit = await supabaseInsert('mt5_risk_decisions', {
      installation_id: installation.id, account_login: accountLogin,
      request_id: proposal.requestId, symbol: proposal.symbol, decision: result.decision,
      approved_risk_pct: result.approvedRiskPct, approved_volume: result.approvedVolume,
      blockers: result.blockers, evaluated_at: result.evaluatedAt,
    });
    if (!audit) throw new Error('Risk decision audit could not be persisted.');

    return NextResponse.json(result, { status: 200, headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    if (error instanceof Error && /duplicate key|unique constraint/i.test(error.message)) {
      return NextResponse.json({ error: 'Duplicate request or replay detected.' }, { status: 409 });
    }
    console.error('EA supervisor decision failed:', error);
    return NextResponse.json({ error: 'Risk supervision is temporarily unavailable. EA must abstain.' }, { status: 503 });
  }
}
