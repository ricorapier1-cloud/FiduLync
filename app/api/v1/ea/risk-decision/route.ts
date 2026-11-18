import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { getPersonalRiskPolicy } from '@/lib/riskPolicy';
import { supabaseInsert, supabaseRead } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Installation = { id: string; status: 'active' | 'revoked' };
type AccountSnapshot = {
  installation_id: string;
  account_login: number;
  currency: string;
  balance: number;
  equity: number;
  margin: number;
  free_margin: number;
  margin_level: number | null;
  open_positions: number;
  open_risk_cash: number;
  open_risk_verified: boolean;
  captured_at: string;
  broker: string | null;
  server: string | null;
};
type Quote = {
  symbol: string;
  bid: number;
  ask: number;
  quote_time: string;
  spread_points: number;
  point: number | null;
  tick_size: number | null;
  tick_value: number | null;
  contract_size: number | null;
  volume_min: number | null;
  volume_max: number | null;
  volume_step: number | null;
  stop_level_points: number | null;
  margin_per_lot_buy: number | null;
  margin_per_lot_sell: number | null;
};
type PriorDecision = {
  request_id: string;
  decision: string;
  approved_risk_pct: number;
  approved_volume: number;
  estimated_risk_cash: number;
  estimated_reward_risk: number | null;
  blockers: string[];
  evaluated_at: string;
  policy_version: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
function noStore() {
  return { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' };
}

/**
 * MT5 supervisory decision endpoint.
 *
 * This service is deliberately fail-closed. The current account snapshot schema
 * does not persist independently maintained daily/weekly start equity or an
 * account high-water mark. Until that state is implemented and verified, this
 * endpoint records ABSTAIN and never grants an EA permission to trade.
 */
export async function POST(request: Request) {
  if (!checkRateLimit(getClientIp(request), 60, 60_000)) {
    return NextResponse.json({ error: 'Risk-decision rate limit exceeded.' }, { status: 429, headers: noStore() });
  }

  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\\s+/i, '').trim();
  const sentAt = Date.parse(request.headers.get('x-mt5-timestamp') ?? '');
  const nonce = request.headers.get('x-mt5-nonce') ?? '';
  if (!/^flmt5_[A-Za-z0-9_-]{40,}$/.test(token)
    || !Number.isFinite(sentAt)
    || Math.abs(Date.now() - sentAt) > 60_000
    || !/^[0-9a-f-]{36}$/i.test(nonce)) {
    return NextResponse.json({ error: 'Invalid or expired MT5 authentication envelope.' }, { status: 401, headers: noStore() });
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 16_384) {
    return NextResponse.json({ error: 'Risk proposal is too large.' }, { status: 413, headers: noStore() });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'A valid JSON risk proposal is required.' }, { status: 400, headers: noStore() });
  }
  if (!isRecord(body)) {
    return NextResponse.json({ error: 'Risk proposal must be a JSON object.' }, { status: 400, headers: noStore() });
  }

  const requestId = typeof body.request_id === 'string' ? body.request_id.trim() : '';
  const symbol = typeof body.symbol === 'string' ? body.symbol.trim().toUpperCase() : '';
  const side = typeof body.side === 'string' ? body.side.trim().toUpperCase() : '';
  const entryPrice = body.entry_price;
  const stopLoss = body.stop_loss;
  const takeProfit = body.take_profit;
  const requestedRiskPct = body.requested_risk_pct;

  if (!/^[A-Za-z0-9._:-]{8,100}$/.test(requestId)
    || !/^[A-Z0-9._-]{3,20}$/.test(symbol)
    || !['BUY', 'SELL'].includes(side)
    || !isFiniteNumber(entryPrice) || entryPrice <= 0
    || !isFiniteNumber(stopLoss) || stopLoss <= 0
    || !isFiniteNumber(takeProfit) || takeProfit <= 0
    || !isFiniteNumber(requestedRiskPct) || requestedRiskPct <= 0 || requestedRiskPct > 100) {
    return NextResponse.json({ error: 'Risk proposal fields are invalid.' }, { status: 400, headers: noStore() });
  }

  try {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const installations = await supabaseRead<Installation[]>(
      'mt5_installations',
      `select=id,status&token_hash=eq.${tokenHash}&status=eq.active&limit=1`,
    );
    const installation = installations?.[0];
    if (!installation) {
      return NextResponse.json({ error: 'Publisher token is invalid or revoked.' }, { status: 401, headers: noStore() });
    }

    // A retry of the same request ID returns the original immutable decision.
    const prior = await supabaseRead<PriorDecision[]>(
      'mt5_risk_decisions',
      `select=request_id,decision,approved_risk_pct,approved_volume,estimated_risk_cash,estimated_reward_risk,blockers,evaluated_at,policy_version&installation_id=eq.${installation.id}&request_id=eq.${encodeURIComponent(requestId)}&limit=1`,
    );
    if (prior?.[0]) {
      return NextResponse.json({ ok: true, replay: true, ...prior[0] }, { headers: noStore() });
    }

    // Consume the nonce before accessing account data. Unique-key conflicts reject replay.
    await supabaseInsert('mt5_ingest_nonces', { installation_id: installation.id, nonce });

    const [accounts, quotes] = await Promise.all([
      supabaseRead<AccountSnapshot[]>(
        'mt5_account_snapshots',
        `select=installation_id,account_login,currency,balance,equity,margin,free_margin,margin_level,open_positions,open_risk_cash,open_risk_verified,captured_at,broker,server&installation_id=eq.${installation.id}&order=captured_at.desc&limit=1`,
      ),
      supabaseRead<Quote[]>(
        'mt5_market_quotes',
        `select=symbol,bid,ask,quote_time,spread_points,point,tick_size,tick_value,contract_size,volume_min,volume_max,volume_step,stop_level_points,margin_per_lot_buy,margin_per_lot_sell&installation_id=eq.${installation.id}&symbol=eq.${encodeURIComponent(symbol)}&limit=1`,
      ),
    ]);
    const account = accounts?.[0];
    const quote = quotes?.[0];
    if (!account) {
      return NextResponse.json({
        ok: true, decision: 'ABSTAIN', request_id: requestId, approved_risk_pct: 0, approved_volume: 0,
        blockers: ['ACCOUNT_SNAPSHOT_UNAVAILABLE'],
        message: 'Publish a fresh MT5 account snapshot before requesting supervision.',
      }, { headers: noStore() });
    }

    const now = new Date();
    const blockers: string[] = [];
    const accountAgeMs = now.getTime() - Date.parse(account.captured_at);
    if (!Number.isFinite(accountAgeMs) || accountAgeMs < 0 || accountAgeMs > 30_000) blockers.push('ACCOUNT_SNAPSHOT_STALE');
    if (!account.open_risk_verified) blockers.push('OPEN_RISK_NOT_VERIFIED');
    if (!quote) blockers.push('BROKER_QUOTE_UNAVAILABLE');

    let quoteAgeMs = Number.POSITIVE_INFINITY;
    if (quote) {
      quoteAgeMs = now.getTime() - Date.parse(quote.quote_time);
      if (!Number.isFinite(quoteAgeMs) || quoteAgeMs < 0 || quoteAgeMs > 2_000) blockers.push('BROKER_QUOTE_STALE');
      if (quote.symbol !== symbol) blockers.push('BROKER_SYMBOL_MISMATCH');
      if (![quote.point, quote.tick_size, quote.tick_value, quote.volume_min, quote.volume_max, quote.volume_step,
        quote.stop_level_points].every((value) => typeof value === 'number' && Number.isFinite(value) && value > 0)) {
        blockers.push('BROKER_SYMBOL_SPEC_INCOMPLETE');
      }
    }

    // Daily/weekly baselines and HWM are not currently persisted by the publisher.
    // Substituting current equity would erase drawdown history, so abstain instead.
    blockers.push('ACCOUNT_RISK_BASELINES_UNAVAILABLE');
    const policy = getPersonalRiskPolicy();
    blockers.push('EXECUTION_DISABLED_BY_SERVER_POLICY');

    const decision = blockers.includes('ACCOUNT_SNAPSHOT_STALE') || blockers.includes('BROKER_QUOTE_STALE')
      || blockers.includes('BROKER_QUOTE_UNAVAILABLE') ? 'DEGRADED' : 'ABSTAIN';
    const evaluatedAt = now.toISOString();
    const contextSnapshot = {
      account_login: account.account_login,
      account_currency: account.currency,
      account_equity: account.equity,
      account_balance: account.balance,
      margin: account.margin,
      free_margin: account.free_margin,
      open_positions: account.open_positions,
      open_risk_cash: account.open_risk_cash,
      open_risk_verified: account.open_risk_verified,
      account_captured_at: account.captured_at,
      account_age_ms: Number.isFinite(accountAgeMs) ? accountAgeMs : null,
      quote: quote ?? null,
      quote_age_ms: Number.isFinite(quoteAgeMs) ? quoteAgeMs : null,
      blockers,
    };
    const proposal = {
      request_id: requestId, installation_id: installation.id, symbol, side,
      entry_price: entryPrice, stop_loss: stopLoss, take_profit: takeProfit,
      requested_risk_pct: requestedRiskPct,
    };

    const inserted = await supabaseInsert<PriorDecision[]>('mt5_risk_decisions', {
      installation_id: installation.id,
      account_login: account.account_login,
      request_id: requestId,
      symbol,
      decision,
      approved_risk_pct: 0,
      approved_volume: 0,
      blockers,
      evaluated_at: evaluatedAt,
      policy_version: policy.policyVersion,
      estimated_risk_cash: 0,
      estimated_reward_risk: null,
      proposal,
      context_snapshot: contextSnapshot,
    });
    if (!inserted?.length) throw new Error('Risk decision audit record was not persisted.');

    return NextResponse.json({
      ok: true, replay: false, request_id: requestId, decision,
      approved_risk_pct: 0, approved_volume: 0, estimated_risk_cash: 0,
      blockers, evaluated_at: evaluatedAt, policy_version: policy.policyVersion,
      expires_at: null,
      message: 'No trade authorization issued. Risk baselines and demo validation are incomplete.',
    }, { headers: noStore() });
  } catch (error) {
    if (error instanceof Error && /duplicate key|unique constraint/i.test(error.message)) {
      return NextResponse.json({ error: 'Replay detected. Use a new nonce and request ID.' }, { status: 409, headers: noStore() });
    }
    console.error('EA risk supervision failed:', error);
    return NextResponse.json({ error: 'Risk supervision is temporarily unavailable; EA must remain idle.' }, { status: 503, headers: noStore() });
  }
}
