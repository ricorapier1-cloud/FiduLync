import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/ownerAuth';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: 'Owner authentication required.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });

  try {
    const supabase = getSupabaseAdmin();
    const { data: installs, error: installError } = await supabase.from('mt5_installations')
      .select('id').eq('user_id', owner.id).eq('status', 'active').limit(20);
    if (installError) throw installError;
    const ids = (installs ?? []).map((item) => item.id as string);

    const [models, executions, positions] = await Promise.all([
      supabase.from('quant_model_registry')
        .select('id,model_key,model_version,market_scope,timeframe_scope,status,evidence,validation_metrics,reviewer_id,reviewed_at,created_at,updated_at')
        .order('created_at', { ascending: false }).limit(50),
      ids.length ? supabase.from('mt5_execution_quality_events')
        .select('event_id,event_type,symbol,side,requested_price,fill_price,volume,spread_points,slippage_points,latency_ms,broker_code,event_time,evidence_hash')
        .in('installation_id', ids).gte('event_time', new Date(Date.now() - 30 * 86400000).toISOString())
        .order('event_time', { ascending: false }).limit(500)
        : Promise.resolve({ data: [], error: null }),
      ids.length ? supabase.from('mt5_open_position_snapshots')
        .select('snapshot_id,captured_at,position_ticket,symbol,side,volume,profit_account_currency,snapshot_complete')
        .in('installation_id', ids).eq('snapshot_complete', true)
        .order('captured_at', { ascending: false }).limit(500)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (models.error) throw models.error;
    if (executions.error) throw executions.error;
    if (positions.error) throw positions.error;

    const executionRows = executions.data ?? [];
    const fills = executionRows.filter((row) => row.event_type === 'fill' && typeof row.slippage_points === 'number');
    const slippage = fills.map((row) => Math.abs(Number(row.slippage_points))).sort((a, b) => a - b);
    const latency = executionRows.map((row) => row.latency_ms).filter((value): value is number => typeof value === 'number').sort((a, b) => a - b);
    const latestPosition = positions.data?.[0];
    const latestSnapshotRows = latestPosition
      ? (positions.data ?? []).filter((row) => row.snapshot_id === latestPosition.snapshot_id)
      : [];
    const completePositionSnapshot = latestSnapshotRows.length > 0 && latestSnapshotRows.every((row) => row.snapshot_complete);
    const modelRows = models.data ?? [];

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      models: modelRows,
      model_summary: {
        total: modelRows.length,
        pending: modelRows.filter((row) => row.status === 'PENDING').length,
        in_review: modelRows.filter((row) => row.status === 'IN_REVIEW').length,
        approved: modelRows.filter((row) => row.status === 'APPROVED').length,
        rejected: modelRows.filter((row) => row.status === 'REJECTED').length,
      },
      execution: {
        events_30d: executionRows.length,
        fills_with_slippage: fills.length,
        average_absolute_slippage_points: slippage.length ? slippage.reduce((sum, value) => sum + value, 0) / slippage.length : null,
        p95_latency_ms: latency.length ? latency[Math.min(latency.length - 1, Math.ceil(latency.length * 0.95) - 1)] : null,
        latest_event_at: executionRows[0]?.event_time ?? null,
        evidence_verified: false,
        status: executionRows.length ? 'EVIDENCE_CAPTURED_PENDING_REVIEW' : 'AWAITING_MT5_FILLS',
      },
      positions: {
        snapshot_id: completePositionSnapshot ? latestPosition.snapshot_id : null,
        captured_at: completePositionSnapshot ? latestPosition.captured_at : null,
        complete: completePositionSnapshot,
        positions: completePositionSnapshot ? latestSnapshotRows.length : null,
        floating_profit: completePositionSnapshot ? latestSnapshotRows.reduce((sum, row) => sum + Number(row.profit_account_currency ?? 0), 0) : null,
        status: completePositionSnapshot ? 'SNAPSHOT_CAPTURED' : 'AWAITING_COMPLETE_MT5_POSITION_SNAPSHOT',
      },
      execution_enabled: false,
      note: 'Evidence capture does not equal independent validation. This endpoint cannot approve a model or enable broker execution.',
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('Owner research governance failed:', error);
    return NextResponse.json({ error: 'Research governance evidence is temporarily unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
