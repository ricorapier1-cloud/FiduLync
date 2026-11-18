import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { supabaseInsert, supabaseRead } from '@/lib/supabaseAdmin';
import { getPersonalRiskPolicy } from '@/lib/riskPolicy';
import { getMacroSignal } from '@/lib/signalEngine';
import { calculateBrokerAwareVolume, evaluateRiskProposal, type RiskContext, type RiskProposal } from '@/lib/quantGovernance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Installation = { id: string; status: string };
type AccountSnapshot = {
  account_login: number; currency: string; balance: number; equity: number;
  margin: number; free_margin: number; open_positions: number; open_risk_cash: number;
  open_risk_verified: boolean; captured_at: string;
  consecutive_losses: number | null; loss_streak_verified: boolean; history_synced_at: string | null;
};
type Quote = {
  symbol: string; bid: number; ask: number; quote_time: string; spread_points: number;
  point: number | null; tick_size: number | null; tick_value: number | null; contract_size: number | null;
  volume_min: number | null; volume_max: number | null; volume_step: number | null; stop_level_points: number | null;
  margin_per_lot_buy: number | null; margin_per_lot_sell: number | null;
};
type RiskState = {
  daily_start_equity: number; weekly_start_equity: number; high_water_mark_equity: number;
  updated_at: string; last_snapshot_at: string;
};

type PriorDecision = {
  account_login: number;
  decision: 'APPROVE' | 'REDUCE' | 'REJECT' | 'ABSTAIN';
  approved_risk_pct: number;
  approved_volume: number;
  estimated_risk_cash: number;
  estimated_reward_risk: number | null;
  blockers: string[];
  evaluated_at: string;
  proposal: Record<string, unknown>;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  let idempotencyContext: { installationId: string; accountLogin: number; proposalEvidence: Record<string, unknown> } | null = null;
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
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 16_384) {
      return NextResponse.json({ error: 'Proposal payload is too large.' }, { status: 413 });
    }
    body = JSON.parse(rawBody);
  } catch {
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
    if (!checkRateLimit(`ea-supervisor:${installation.id}`, 30, 60_000)) {
      return NextResponse.json({ error: 'Installation rate limit exceeded.' }, { status: 429 });
    }
    if (proposal.installationId !== installation.id) {
      return NextResponse.json({ error: 'Proposal installation does not match its authenticated publisher.' }, { status: 403 });
    }

    const accountLogin = Number(body.account_login);
    const proposalEvidence = {
      request_id: proposal.requestId, installation_id: proposal.installationId, symbol: proposal.symbol,
      side: proposal.side, entry_price: proposal.entryPrice, stop_loss: proposal.stopLoss,
      take_profit: proposal.takeProfit, requested_risk_pct: proposal.requestedRiskPct,
    };
    idempotencyContext = { installationId: installation.id, accountLogin, proposalEvidence };
    // A retried request ID returns its original immutable decision. Reusing the
    // same ID for different inputs is a conflict, never a fresh evaluation.
    const priorDecisions = await supabaseRead<PriorDecision[]>(
      'mt5_risk_decisions',
      `select=account_login,decision,approved_risk_pct,approved_volume,estimated_risk_cash,estimated_reward_risk,blockers,evaluated_at,proposal&installation_id=eq.${installation.id}&request_id=eq.${encodeURIComponent(proposal.requestId)}&limit=1`,
    );
    if (priorDecisions === null) throw new Error('Prior decision idempotency lookup failed.');
    const prior = priorDecisions[0];
    if (prior) {
      const sameProposal = prior.account_login === accountLogin && Object.keys(proposalEvidence).every((key) => prior.proposal?.[key] === proposalEvidence[key as keyof typeof proposalEvidence]);
      if (!sameProposal) {
        return NextResponse.json({ error: 'Request ID was already used for a different proposal.' }, { status: 409 });
      }
      return NextResponse.json({
        schemaVersion: '1.0', requestId: proposal.requestId, decision: prior.decision,
        approvedRiskPct: prior.approved_risk_pct, approvedVolume: prior.approved_volume,
        estimatedRiskCash: prior.estimated_risk_cash, estimatedRewardRisk: prior.estimated_reward_risk,
        blockers: prior.blockers, evaluatedAt: prior.evaluated_at,
      }, { status: 200, headers: { 'Cache-Control': 'no-store, max-age=0', 'Idempotency-Replayed': 'true' } });
    }

    const nonceRows = await supabaseInsert('mt5_ingest_nonces', { installation_id: installation.id, nonce });
    if (!nonceRows) return NextResponse.json({ error: 'Replay protection could not be stored.' }, { status: 503 });

    const [accounts, quotes, states, macroSignal] = await Promise.all([
      supabaseRead<AccountSnapshot[]>(
        'mt5_account_snapshots',
        `select=account_login,currency,balance,equity,margin,free_margin,open_positions,open_risk_cash,open_risk_verified,captured_at,consecutive_losses,loss_streak_verified,history_synced_at&installation_id=eq.${installation.id}&account_login=eq.${accountLogin}&limit=1`,
      ),
      supabaseRead<Quote[]>(
        'mt5_market_quotes',
        `select=symbol,bid,ask,quote_time,spread_points,point,tick_size,tick_value,contract_size,volume_min,volume_max,volume_step,stop_level_points,margin_per_lot_buy,margin_per_lot_sell&installation_id=eq.${installation.id}&symbol=eq.${encodeURIComponent(proposal.symbol)}&limit=1`,
      ),
      supabaseRead<RiskState[]>(
        'mt5_risk_state',
        `select=daily_start_equity,weekly_start_equity,high_water_mark_equity,updated_at,last_snapshot_at&installation_id=eq.${installation.id}&account_login=eq.${accountLogin}&limit=1`,
      ),
      getMacroSignal(proposal.symbol, Date.now(), installation.id).catch((error) => {
        console.warn('EA supervisor macro context unavailable:', error);
        return null;
      }),
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
        policy_version: getPersonalRiskPolicy().policyVersion,
        approved_risk_pct: 0, approved_volume: 0, estimated_risk_cash: 0, estimated_reward_risk: null,
        blockers, evaluated_at: evaluatedAt,
        proposal: {
          request_id: proposal.requestId, installation_id: proposal.installationId, symbol: proposal.symbol,
          side: proposal.side, entry_price: proposal.entryPrice, stop_loss: proposal.stopLoss,
          take_profit: proposal.takeProfit, requested_risk_pct: proposal.requestedRiskPct,
        },
        context_snapshot: {
          account_snapshot_available: Boolean(account), quote_available: Boolean(quote),
          risk_anchors_available: Boolean(state),
        },
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
    const historySyncedAt = account.history_synced_at ? Date.parse(account.history_synced_at) : Number.NaN;
    const riskStateUpdatedAt = Date.parse(state.updated_at);
    const riskStateSnapshotAt = Date.parse(state.last_snapshot_at);
    const riskStateFresh = Number.isFinite(riskStateUpdatedAt) && Number.isFinite(riskStateSnapshotAt)
      && Date.now() - riskStateUpdatedAt >= 0 && Date.now() - riskStateUpdatedAt <= 30_000
      && Date.now() - riskStateSnapshotAt >= 0 && Date.now() - riskStateSnapshotAt <= 30_000
      && Math.abs(riskStateSnapshotAt - capturedAt) <= 5_000;
    const lossStreakFresh = account.loss_streak_verified && account.consecutive_losses !== null
      && Number.isSafeInteger(account.consecutive_losses) && Number.isFinite(historySyncedAt)
      && Date.now() - historySyncedAt >= 0 && Date.now() - historySyncedAt <= 30_000;
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
      consecutiveLosses: lossStreakFresh ? Number(account.consecutive_losses) : Number.NaN,
      regime: macroSignal?.regime ?? 'UNAVAILABLE',
      marketDataHealth: snapshotAgeMs >= 0 && snapshotAgeMs <= 30_000 && quoteAgeMs >= 0 && quoteAgeMs <= 30_000 && Boolean(macroSignal && macroSignal.market_data_source === 'mt5' && !macroSignal.execution_blockers.includes('MARKET_DATA_NOT_VERIFIED')) ? 'LIVE' : 'STALE',
      macroDataHealth: macroSignal && !macroSignal.execution_blockers.includes('MACRO_DATA_NOT_VERIFIED') ? 'LIVE' : 'UNAVAILABLE',
      newsLockout: macroSignal ? macroSignal.news_lockout : true,
      symbolSpec,
    };
    const unavailableBlockers: string[] = [];
    if (!sizing.valid || !Number.isFinite(estimatedMargin) || estimatedMargin <= 0) {
      unavailableBlockers.push('BROKER_SIZING_OR_MARGIN_CONTEXT_UNAVAILABLE');
    }
    if (!Number.isFinite(context.consecutiveLosses)) unavailableBlockers.push('LOSS_STREAK_CONTEXT_UNAVAILABLE');
    if (context.macroDataHealth !== 'LIVE') unavailableBlockers.push('MACRO_NEWS_CONTEXT_UNAVAILABLE');
    if (!macroSignal || macroSignal.market_data_source === 'unavailable') unavailableBlockers.push('TECHNICAL_MARKET_CONTEXT_UNAVAILABLE');
    if (snapshotAgeMs < 0 || snapshotAgeMs > 30_000) unavailableBlockers.push('ACCOUNT_SNAPSHOT_STALE');
    if (quoteAgeMs < 0 || quoteAgeMs > 30_000) unavailableBlockers.push('BROKER_QUOTE_STALE');

    const forcedBlockers = [
      ...(!account.open_risk_verified ? ['OPEN_POSITION_RISK_UNVERIFIED'] : []),
      ...(!riskStateFresh ? ['RISK_ANCHORS_STALE_OR_NOT_SYNCHRONIZED'] : []),
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
      policy_version: policy.policyVersion,
      approved_risk_pct: result.approvedRiskPct, approved_volume: result.approvedVolume,
      estimated_risk_cash: result.estimatedRiskCash, estimated_reward_risk: result.estimatedRewardRisk,
      blockers: result.blockers, evaluated_at: result.evaluatedAt,
      proposal: {
        request_id: proposal.requestId, installation_id: proposal.installationId, symbol: proposal.symbol,
        side: proposal.side, entry_price: proposal.entryPrice, stop_loss: proposal.stopLoss,
        take_profit: proposal.takeProfit, requested_risk_pct: proposal.requestedRiskPct,
      },
      context_snapshot: {
        account: {
          currency: account.currency, balance: account.balance, equity: account.equity,
          margin: account.margin, free_margin: account.free_margin, open_positions: account.open_positions,
          open_risk_cash: account.open_risk_cash, open_risk_verified: account.open_risk_verified,
          captured_at: account.captured_at, consecutive_losses: account.consecutive_losses,
          loss_streak_verified: account.loss_streak_verified, history_synced_at: account.history_synced_at,
        },
        quote: {
          bid: quote.bid, ask: quote.ask, spread_points: quote.spread_points,
          quote_time: quote.quote_time, symbol_spec: symbolSpec,
        },
        risk_anchors: {
          daily_start_equity: state.daily_start_equity, weekly_start_equity: state.weekly_start_equity,
          high_water_mark_equity: state.high_water_mark_equity, updated_at: state.updated_at,
          last_snapshot_at: state.last_snapshot_at, fresh: riskStateFresh,
        },
        calculated_margin: estimatedMargin,
        macro: macroSignal ? {
          regime: macroSignal.regime, news_lockout: macroSignal.news_lockout,
          market_data_source: macroSignal.market_data_source,
          execution_blockers: macroSignal.execution_blockers,
          timestamp_utc: macroSignal.timestamp_utc,
        } : null,
      },
    });
    if (!audit) throw new Error('Risk decision audit could not be persisted.');

    return NextResponse.json(result, { status: 200, headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    if (error instanceof Error && /duplicate key|unique constraint/i.test(error.message)) {
      // A concurrent retry can race the initial idempotency lookup. Once the
      // winning transaction commits, recover its immutable decision and replay
      // it only when installation, account and every proposal field match.
      if (idempotencyContext) {
        try {
          const { installationId, accountLogin, proposalEvidence } = idempotencyContext;
          const racedDecisions = await supabaseRead<PriorDecision[]>(
            'mt5_risk_decisions',
            `select=account_login,decision,approved_risk_pct,approved_volume,estimated_risk_cash,estimated_reward_risk,blockers,evaluated_at,proposal&installation_id=eq.${installationId}&request_id=eq.${encodeURIComponent(String(proposalEvidence.request_id))}&limit=1`,
          );
          if (racedDecisions === null) throw new Error('Concurrent idempotency recovery lookup failed.');
          const raced = racedDecisions[0];
          if (raced) {
            const sameProposal = raced.account_login === accountLogin
              && Object.keys(proposalEvidence).every((key) => raced.proposal?.[key] === proposalEvidence[key]);
            if (sameProposal) {
              return NextResponse.json({
                schemaVersion: '1.0', requestId: proposalEvidence.request_id, decision: raced.decision,
                approvedRiskPct: raced.approved_risk_pct, approvedVolume: raced.approved_volume,
                estimatedRiskCash: raced.estimated_risk_cash, estimatedRewardRisk: raced.estimated_reward_risk,
                blockers: raced.blockers, evaluatedAt: raced.evaluated_at,
              }, { status: 200, headers: { 'Cache-Control': 'no-store, max-age=0', 'Idempotency-Replayed': 'true' } });
            }
            return NextResponse.json({ error: 'Request ID was already used for a different proposal.' }, { status: 409 });
          }
        } catch (recoveryError) {
          console.error('EA supervisor concurrent idempotency recovery failed:', recoveryError);
          return NextResponse.json({ error: 'Risk supervision is temporarily unavailable. EA must abstain.' }, { status: 503 });
        }
      }
      return NextResponse.json({ error: 'Duplicate request or replay detected.' }, { status: 409 });
    }
    console.error('EA supervisor decision failed:', error);
    return NextResponse.json({ error: 'Risk supervision is temporarily unavailable. EA must abstain.' }, { status: 503 });
  }
}
