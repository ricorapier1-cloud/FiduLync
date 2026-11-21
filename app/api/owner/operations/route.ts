import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/serverSupabase';
import { requireOwner } from '@/lib/ownerAuth';
import { enforceDistributedRateLimit } from '@/lib/rateLimit';
import { getPersonalRiskPolicy } from '@/lib/riskPolicy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: 'Owner authentication required.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  const rate = await enforceDistributedRateLimit(request, 'owner-operations', 30, 60_000);
  if (rate.unavailable) return NextResponse.json({ error: 'Owner operations are temporarily unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  if (!rate.allowed) return NextResponse.json({ error: 'Owner operations rate limit exceeded.' }, { status: 429, headers: { 'Cache-Control': 'no-store' } });

  try {
    const supabase = getSupabaseAdmin();
    const userId = owner.id;
    const riskPolicy = getPersonalRiskPolicy();
    const { data: installations, error: installationError } = await supabase.from('mt5_installations')
      .select('id,label,status,created_at,last_seen_at,broker,server')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(20);
    if (installationError) throw installationError;

    const activeInstallations = (installations ?? []).filter((item) => item.status === 'active');
    const installationIds = activeInstallations.map((item) => item.id);
    let candleData: { id: string; bar_time: string; symbol: string; timeframe: string; broker: string; server: string } | null = null;
    let quoteData: { symbol: string; quote_time: string; broker: string; server: string } | null = null;
    let accountRisk: { account_login: number; currency: string; equity: number; margin: number; free_margin: number; open_positions: number; open_risk_cash: number; open_risk_verified: boolean; captured_at: string; consecutive_losses: number | null; loss_streak_verified: boolean; history_synced_at: string | null } | null = null;
    let riskAnchorsAvailable = false;
    let riskAnchorAgeMs: number | null = null;
    let riskAnchorSnapshotAgeMs: number | null = null;
    let latestDecision: { decision: string; symbol: string; evaluated_at: string; blockers: string[] } | null = null;
    if (installationIds.length) {
      const [candles, quotes, snapshots, anchors, decisions] = await Promise.all([
        supabase.from('mt5_market_candles').select('id,bar_time,symbol,timeframe,broker,server')
          .in('installation_id', installationIds).order('bar_time', { ascending: false }).limit(1),
        supabase.from('mt5_market_quotes').select('symbol,quote_time,broker,server')
          .in('installation_id', installationIds).order('quote_time', { ascending: false }).limit(1),
        supabase.from('mt5_account_snapshots').select('account_login,currency,equity,margin,free_margin,open_positions,open_risk_cash,open_risk_verified,captured_at,consecutive_losses,loss_streak_verified,history_synced_at')
          .in('installation_id', installationIds).order('captured_at', { ascending: false }).limit(1),
        supabase.from('mt5_risk_state').select('installation_id,account_login,updated_at,last_snapshot_at')
          .in('installation_id', installationIds).order('updated_at', { ascending: false }).limit(1),
        supabase.from('mt5_risk_decisions').select('decision,symbol,evaluated_at,blockers')
          .in('installation_id', installationIds).order('evaluated_at', { ascending: false }).limit(1),
      ]);
      if (candles.error) throw candles.error;
      if (quotes.error) throw quotes.error;
      if (snapshots.error) throw snapshots.error;
      if (anchors.error) throw anchors.error;
      if (decisions.error) throw decisions.error;
      candleData = candles.data?.[0] ?? null;
      quoteData = quotes.data?.[0] ?? null;
      accountRisk = snapshots.data?.[0] ?? null;
      const latestAnchor = anchors.data?.[0];
      riskAnchorsAvailable = Boolean(latestAnchor);
      riskAnchorAgeMs = latestAnchor ? Date.now() - Date.parse(latestAnchor.updated_at) : null;
      riskAnchorSnapshotAgeMs = latestAnchor ? Date.now() - Date.parse(latestAnchor.last_snapshot_at) : null;
      latestDecision = decisions.data?.[0] ?? null;
    }

    const now = Date.now();
    const candleAgeMs = candleData ? now - Date.parse(candleData.bar_time) : null;
    const quoteAgeMs = quoteData ? now - Date.parse(quoteData.quote_time) : null;
    const latestHeartbeat = activeInstallations
      .map((item) => item.last_seen_at ? Date.parse(item.last_seen_at) : 0)
      .reduce((latest, value) => Math.max(latest, value), 0);
    const accountSnapshotAgeMs = accountRisk ? now - Date.parse(accountRisk.captured_at) : null;
    const accountSnapshotFresh = accountSnapshotAgeMs !== null && accountSnapshotAgeMs >= 0 && accountSnapshotAgeMs <= 30_000;
    const historyAgeMs = accountRisk?.history_synced_at ? now - Date.parse(accountRisk.history_synced_at) : null;
    const lossStreakFresh = Boolean(accountRisk?.loss_streak_verified && accountRisk.consecutive_losses !== null
      && historyAgeMs !== null && historyAgeMs >= 0 && historyAgeMs <= 30_000);

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      owner: { email: owner.email, role: 'owner' },
      market_data: {
        active_installations: activeInstallations.length,
        total_installations: installations?.length ?? 0,
        latest_heartbeat: latestHeartbeat ? new Date(latestHeartbeat).toISOString() : null,
        latest_heartbeat_age_seconds: latestHeartbeat ? Math.max(0, Math.round((now - latestHeartbeat) / 1000)) : null,
        latest_candle: candleData,
        latest_candle_age_minutes: candleAgeMs === null ? null : Math.max(0, Math.round(candleAgeMs / 60000)),
        latest_quote: quoteData,
        latest_quote_age_seconds: quoteAgeMs === null ? null : Math.max(0, Math.round(quoteAgeMs / 1000)),
      },
      installations: installations ?? [],
      account_risk: {
        latest_snapshot: accountRisk,
        snapshot_age_seconds: accountSnapshotAgeMs === null ? null : Math.max(0, Math.round(accountSnapshotAgeMs / 1000)),
        snapshot_fresh: accountSnapshotFresh,
        open_risk_verified: Boolean(accountRisk?.open_risk_verified),
        risk_anchors_available: riskAnchorsAvailable,
        risk_anchors_fresh: riskAnchorAgeMs !== null && riskAnchorSnapshotAgeMs !== null
          && riskAnchorAgeMs >= 0 && riskAnchorAgeMs <= 30_000
          && riskAnchorSnapshotAgeMs >= 0 && riskAnchorSnapshotAgeMs <= 30_000,
        risk_anchor_age_seconds: riskAnchorAgeMs === null ? null : Math.max(0, Math.round(riskAnchorAgeMs / 1000)),
        loss_streak_verified: lossStreakFresh,
        latest_decision: latestDecision,
      },
      risk_policy: {
        policy_version: riskPolicy.policyVersion,
        execution_enabled: riskPolicy.executionEnabled,
        model_validated: riskPolicy.modelValidated,
        execution_quality_verified: riskPolicy.executionQualityVerified,
        max_per_trade_risk_pct: riskPolicy.maxPerTradeRiskPct,
        max_portfolio_risk_pct: riskPolicy.maxPortfolioRiskPct,
        max_daily_drawdown_pct: riskPolicy.maxDailyDrawdownPct,
        max_weekly_drawdown_pct: riskPolicy.maxWeeklyDrawdownPct,
        max_high_water_drawdown_pct: riskPolicy.maxHighWaterDrawdownPct,
        max_margin_usage_pct: riskPolicy.maxMarginUsagePct,
        max_spread_points: riskPolicy.maxSpreadPoints,
        max_spread_atr_ratio: riskPolicy.maxSpreadAtrRatio,
        max_quote_age_ms: riskPolicy.maxQuoteAgeMs,
        max_consecutive_losses: riskPolicy.maxConsecutiveLosses,
        reward_risk_minimum: riskPolicy.rewardRiskMinimum,
      },
      database: { reachable: true, installation_records: installations?.length ?? 0 },
      governance: {
        audit_log: 'decision_evidence_append_only',
        multi_role_access: 'owner_only',
        step_up_authentication: 'not_configured',
        model_validation_registry: 'configured_pending_independent_review',
        execution_quality_evidence: 'schema_ready_waiting_for_mt5_fills',
        position_snapshot_evidence: 'schema_ready_waiting_for_mt5_position_feed',
        portfolio_risk_telemetry: accountRisk && accountSnapshotFresh && accountRisk.open_risk_verified && riskAnchorsAvailable && lossStreakFresh ? 'account_open_stop_risk_connected_currency_exposure_pending' : accountRisk ? 'partial' : 'not_connected',
      },
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('Owner operations overview failed:', error);
    return NextResponse.json({ error: 'Operations overview is temporarily unavailable.' }, { status: 503 });
  }
}
