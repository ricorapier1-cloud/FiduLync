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

    const [models, executions, manifests] = await Promise.all([
      supabase.from('quant_model_registry')
        .select('id,model_key,model_version,market_scope,timeframe_scope,status,evidence,validation_metrics,reviewer_id,reviewed_at,created_at,updated_at')
        .order('created_at', { ascending: false }).limit(50),
      ids.length ? supabase.from('mt5_execution_quality_events')
        .select('event_id,event_type,symbol,side,requested_price,fill_price,volume,spread_points,slippage_points,latency_ms,broker_code,event_time,evidence_hash')
        .in('installation_id', ids).gte('event_time', new Date(Date.now() - 30 * 86400000).toISOString())
        .order('event_time', { ascending: false }).limit(500)
        : Promise.resolve({ data: [], error: null }),
      ids.length ? supabase.from('mt5_position_snapshot_manifests')
        .select('installation_id,account_login,snapshot_id,captured_at,expected_positions,complete')
        .in('installation_id', ids).eq('complete', true)
        .order('captured_at', { ascending: false }).limit(1)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (models.error) throw models.error;
    if (executions.error) throw executions.error;
    if (manifests.error) throw manifests.error;

    const executionRows = executions.data ?? [];
    const fills = executionRows.filter((row) => row.event_type === 'fill' && typeof row.slippage_points === 'number');
    const slippage = fills.map((row) => Math.abs(Number(row.slippage_points))).sort((a, b) => a - b);
    const latency = executionRows.map((row) => row.latency_ms).filter((value): value is number => typeof value === 'number').sort((a, b) => a - b);
    const latestManifest = manifests.data?.[0] ?? null;
    const positionResult = latestManifest ? await supabase.from('mt5_open_position_snapshots')
      .select('snapshot_id,captured_at,position_ticket,symbol,side,volume,price_open,stop_loss,take_profit,profit_account_currency,contract_size,base_currency,quote_currency,snapshot_complete')
      .eq('installation_id', latestManifest.installation_id)
      .eq('account_login', latestManifest.account_login)
      .eq('snapshot_id', latestManifest.snapshot_id)
      .order('position_ticket', { ascending: true }) : { data: [], error: null };
    if (positionResult.error) throw positionResult.error;
    const latestSnapshotRows = positionResult.data ?? [];
    const expectedPositions = Number(latestManifest?.expected_positions ?? -1);
    const completePositionSnapshot = Boolean(latestManifest?.complete)
      && expectedPositions >= 0 && latestSnapshotRows.length === expectedPositions
      && latestSnapshotRows.every((row) => row.snapshot_complete);
    const positionAgeSeconds = latestManifest?.captured_at
      ? Math.round((Date.now() - Date.parse(latestManifest.captured_at)) / 1000) : null;
    const positionFresh = completePositionSnapshot && positionAgeSeconds !== null
      && positionAgeSeconds >= 0 && positionAgeSeconds <= 15;
    const exposureMap = new Map<string, { currency: string; net_units: number; gross_units: number; positions: number }>();
    const unresolvedExposure: string[] = [];
    if (completePositionSnapshot) {
      for (const position of latestSnapshotRows) {
        const base = typeof position.base_currency === 'string' ? position.base_currency : '';
        const quote = typeof position.quote_currency === 'string' ? position.quote_currency : '';
        const contract = Number(position.contract_size);
        const volume = Number(position.volume);
        const price = Number(position.price_open);
        if (!base || !quote || !Number.isFinite(contract) || contract <= 0 || !Number.isFinite(volume)
          || volume <= 0 || !Number.isFinite(price) || price <= 0) {
          unresolvedExposure.push(String(position.symbol));
          continue;
        }
        const direction = position.side === 'BUY' ? 1 : -1;
        const baseUnits = direction * volume * contract;
        const quoteUnits = -direction * volume * contract * price;
        for (const [currency, signedUnits] of [[base, baseUnits], [quote, quoteUnits]] as const) {
          const current = exposureMap.get(currency) ?? { currency, net_units: 0, gross_units: 0, positions: 0 };
          current.net_units += signedUnits;
          current.gross_units += Math.abs(signedUnits);
          current.positions += 1;
          exposureMap.set(currency, current);
        }
      }
    }
    const currencyExposure = [...exposureMap.values()].sort((a, b) => b.gross_units - a.gross_units);
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
        snapshot_id: completePositionSnapshot ? latestManifest.snapshot_id : null,
        captured_at: completePositionSnapshot ? latestManifest.captured_at : null,
        expected_positions: latestManifest ? expectedPositions : null,
        complete: completePositionSnapshot,
        fresh: positionFresh,
        age_seconds: positionAgeSeconds,
        positions: completePositionSnapshot ? latestSnapshotRows.map((row) => ({
          ticket: row.position_ticket, symbol: row.symbol, side: row.side, volume: row.volume,
          entry: row.price_open, stop_loss: row.stop_loss, take_profit: row.take_profit,
          floating_profit: row.profit_account_currency,
        })) : null,
        position_count: completePositionSnapshot ? latestSnapshotRows.length : null,
        floating_profit: completePositionSnapshot ? latestSnapshotRows.reduce((sum, row) => sum + Number(row.profit_account_currency ?? 0), 0) : null,
        currency_exposure_units: completePositionSnapshot ? currencyExposure : null,
        exposure_unresolved_symbols: completePositionSnapshot ? unresolvedExposure : null,
        exposure_basis: 'Native currency units derived from broker contract size and entry price; not converted into account-currency risk.',
        status: !completePositionSnapshot ? 'AWAITING_COMPLETE_MT5_POSITION_SNAPSHOT'
          : positionFresh ? 'SNAPSHOT_CAPTURED' : 'STALE_POSITION_SNAPSHOT',
      },
      execution_enabled: false,
      note: 'Evidence capture does not equal independent validation. This endpoint cannot approve a model or enable broker execution.',
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('Owner research governance failed:', error);
    return NextResponse.json({ error: 'Research governance evidence is temporarily unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
