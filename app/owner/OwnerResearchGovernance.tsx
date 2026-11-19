'use client';

import { useCallback, useEffect, useState } from 'react';

type Model = {
  id: number; model_key: string; model_version: string; market_scope: string[]; timeframe_scope: string[];
  status: string; evidence: Record<string, unknown>; validation_metrics: Record<string, unknown>;
  reviewer_id: string | null; reviewed_at: string | null; created_at: string; updated_at: string;
};
type ResearchData = {
  generated_at: string;
  models: Model[];
  model_summary: { total: number; pending: number; in_review: number; approved: number; rejected: number };
  execution: { events_30d: number; fills_with_slippage: number; average_absolute_slippage_points: number | null; p95_latency_ms: number | null; latest_event_at: string | null; evidence_verified: boolean; status: string };
  positions: { snapshot_id: string | null; captured_at: string | null; complete: boolean; fresh: boolean; age_seconds: number | null; positions: Array<{ ticket: number; symbol: string; side: string; volume: number; entry: number; stop_loss: number | null; take_profit: number | null; floating_profit: number | null }> | null; position_count: number | null; expected_positions: number | null; floating_profit: number | null; currency_exposure_units: Array<{ currency: string; net_units: number; gross_units: number; positions: number }> | null; exposure_unresolved_symbols: string[] | null; exposure_basis: string; status: string; account_currency: string | null; account_snapshot_age_seconds: number | null; account_currency_conversion_complete: boolean; account_currency_exposure: Array<{ currency: string; net_units: number; gross_units: number; account_currency: string; net_account_currency: number | null; gross_account_currency: number | null; conversion_path: string[] | null; conversion_verified: boolean }> | null; gross_exposure_account_currency: number | null; net_exposure_account_currency: number | null; one_percent_parallel_currency_shock_estimate: number | null; conversion_status: string };
  cross_asset: { symbols: Record<string,string>; timeframe: string; maximum_lead_lag_bars: number; minimum_overlapping_returns: number; observations: Array<{ symbol: string; asset: string; lead_asset_bars: number; correlation: number; overlapping_returns: number }>; status: string; note: string };
  correlation: { timeframe: string; minimum_overlapping_returns: number; cluster_threshold_absolute_correlation: number; pairs: Array<{ symbol_a: string; symbol_b: string; correlation: number; overlapping_returns: number }>; clusters: string[][]; status: string };
  portfolio_stress: { one_percent_parallel_currency_shock_account_currency: number | null; interpretation: string; correlation_clusters: string[][]; status: string };
  execution_enabled: false; note: string;
};
type Props = { accessToken: string };

function Tag({ value }: { value: string }) {
  const positive = value === 'APPROVED' || value === 'SNAPSHOT_CAPTURED';
  const tone = positive ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : value === 'REJECTED' ? 'border-rose-300/20 bg-rose-300/10 text-rose-200' : 'border-amber-300/20 bg-amber-300/10 text-amber-100';
  return <span className={'rounded-full border px-2 py-1 text-[9px] uppercase '+tone}>{value.replaceAll('_',' ')}</span>;
}
function Stat({ title, value, detail }: { title: string; value: string; detail: string }) {
  return <div className="rounded-xl border border-white/[0.08] bg-[#0a1017] p-4"><div className="text-[9px] uppercase tracking-wider text-slate-500">{title}</div><div className="mt-2 text-xl font-semibold text-slate-100">{value}</div><div className="mt-1 text-[10px] leading-4 text-slate-500">{detail}</div></div>;
}

export default function OwnerResearchGovernance({ accessToken }: Props) {
  const [data, setData] = useState<ResearchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/owner/research-governance', { headers: { Authorization: 'Bearer '+accessToken }, cache: 'no-store' });
      const body = await response.json() as ResearchData & { error?: string };
      if (!response.ok) throw new Error(body.error || 'Research evidence could not be loaded.');
      setData(body);
    } catch (err) { setError(err instanceof Error ? err.message : 'Research evidence unavailable.'); }
    finally { setLoading(false); }
  }, [accessToken]);
  useEffect(() => { const task = Promise.resolve().then(() => refresh()); return () => { void task; }; }, [refresh]);

  return <div className="space-y-5">
    <section className="rounded-2xl border border-white/[0.09] bg-[#0c131c] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-white">Quant research governance</h2><p className="mt-1 text-xs leading-5 text-slate-500">Model provenance, evidence review, execution-quality telemetry and broker position snapshots.</p></div><button onClick={() => void refresh()} disabled={loading} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200 disabled:opacity-50">{loading?'Refreshing…':'Refresh evidence'}</button></div>
      {error && <p role="alert" className="mt-4 text-xs text-rose-200">{error}</p>}
      {loading && !data && <p className="mt-4 text-xs text-slate-400">Loading evidence records…</p>}
    </section>
    {data && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat title="Registered models" value={String(data.model_summary.total)} detail="Versioned model records"/>
        <Stat title="Approved models" value={String(data.model_summary.approved)} detail="Independent approval status only"/>
        <Stat title="Execution events / 30d" value={String(data.execution.events_30d)} detail={data.execution.fills_with_slippage+' fills with slippage data'}/>
        <Stat title="Position snapshot" value={data.positions.complete?String(data.positions.position_count):'Awaiting'} detail={data.positions.fresh?'Fresh · '+data.positions.age_seconds+'s old':data.positions.captured_at?'Stale or incomplete · '+new Date(data.positions.captured_at).toLocaleString():'No complete snapshot received'}/>
      </div>
      <section className="rounded-2xl border border-white/[0.09] bg-[#0c131c] p-5">
        <h3 className="text-sm font-semibold text-white">Model registry</h3>
        <p className="mt-1 text-[10px] leading-5 text-slate-500">A model remains non-approved until the dataset and code fingerprints, validation report and independent reviewer requirements are satisfied.</p>
        <div className="mt-4 space-y-3">
          {data.models.length ? data.models.map((model) => <article key={model.id} className="rounded-xl border border-white/[0.08] bg-black/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><div className="text-xs font-semibold text-slate-100">{model.model_key} · {model.model_version}</div><Tag value={model.status}/></div>
            <div className="mt-2 text-[10px] text-slate-500">Markets: {(model.market_scope ?? []).join(', ') || 'Not scoped'} · Timeframes: {(model.timeframe_scope ?? []).join(', ') || 'Not scoped'}</div>
            <div className="mt-2 text-[10px] text-slate-500">Created {new Date(model.created_at).toLocaleString()} · {model.reviewed_at?'Reviewed '+new Date(model.reviewed_at).toLocaleString():'No review recorded'}</div>
            {Object.keys(model.validation_metrics ?? {}).length>0 && <details className="mt-3"><summary className="cursor-pointer text-[10px] text-slate-400">Validation metrics</summary><pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[10px] text-slate-500">{JSON.stringify(model.validation_metrics,null,2)}</pre></details>}
          </article>) : <p className="text-xs text-slate-500">No model records have been registered yet.</p>}
        </div>
      </section>
      <section className="rounded-2xl border border-white/[0.09] bg-[#0c131c] p-5">
        <h3 className="text-sm font-semibold text-white">Intermarket lead-lag research</h3>
        <p className="mt-1 text-[10px] leading-5 text-slate-500">Optional broker-fed DXY, oil and S&P 500 H1 data. Positive lead bars means the cross-asset return is shifted earlier than the FX-pair return. Minimum 30 aligned returns.</p>
        <div className="mt-3"><Tag value={data.cross_asset.status}/></div>
        <div className="mt-3 flex flex-wrap gap-2">{Object.entries(data.cross_asset.symbols).map(([asset,symbol])=><span key={asset} className="rounded-lg border border-white/[0.08] bg-black/20 px-2 py-1 text-[9px] text-slate-300">{asset}: {symbol}</span>)}</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{data.cross_asset.observations.slice(0,12).map((item,index)=><div key={item.symbol+'-'+item.asset+'-'+item.lead_asset_bars+'-'+index} className="rounded-lg bg-black/20 p-2"><div className="text-[9px] text-slate-400">{item.asset} → {item.symbol}</div><div className="mt-1 font-mono text-[11px] text-slate-200">ρ {item.correlation.toFixed(3)} · lead {item.lead_asset_bars}h</div><div className="text-[9px] text-slate-600">n={item.overlapping_returns}</div></div>)}</div>
        <p className="mt-3 text-[9px] leading-4 text-amber-100">{data.cross_asset.note} It is not a causal forecast or an EA execution filter.</p>
      </section>
      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-2xl border border-white/[0.09] bg-[#0c131c] p-5">
          <h3 className="text-sm font-semibold text-white">Execution-quality evidence</h3>
          <div className="mt-3"><Tag value={data.execution.status}/></div>
          <div className="mt-4 space-y-3 text-xs"><div className="flex justify-between gap-3"><span className="text-slate-500">Average absolute slippage</span><span className="font-mono text-slate-200">{data.execution.average_absolute_slippage_points===null?'—':data.execution.average_absolute_slippage_points.toFixed(2)+' pts'}</span></div><div className="flex justify-between gap-3"><span className="text-slate-500">P95 observed latency</span><span className="font-mono text-slate-200">{data.execution.p95_latency_ms===null?'—':data.execution.p95_latency_ms+' ms'}</span></div><div className="flex justify-between gap-3"><span className="text-slate-500">Latest event</span><span className="font-mono text-slate-200">{data.execution.latest_event_at?new Date(data.execution.latest_event_at).toLocaleString():'—'}</span></div></div>
          <p className="mt-4 text-[10px] leading-5 text-slate-500">Observed samples are not yet independently reviewed or verified against a minimum sample-size policy.</p>
        </section>
        <section className="rounded-2xl border border-white/[0.09] bg-[#0c131c] p-5">
          <h3 className="text-sm font-semibold text-white">Open-position evidence</h3>
          <div className="mt-3"><Tag value={data.positions.status}/></div>
          <div className="mt-4 space-y-3 text-xs"><div className="flex justify-between gap-3"><span className="text-slate-500">Positions in snapshot</span><span className="font-mono text-slate-200">{data.positions.position_count??'—'}</span></div><div className="flex justify-between gap-3"><span className="text-slate-500">Floating P/L</span><span className="font-mono text-slate-200">{data.positions.floating_profit===null?'—':data.positions.floating_profit.toFixed(2)}</span></div><div className="flex justify-between gap-3"><span className="text-slate-500">Captured at</span><span className="font-mono text-slate-200">{data.positions.captured_at?new Date(data.positions.captured_at).toLocaleString():'—'}</span></div></div>
          {data.positions.complete && data.positions.positions && data.positions.positions.length > 0 && <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-[10px]"><thead className="text-slate-500"><tr><th className="py-2">Symbol / side</th><th>Lots</th><th>Entry</th><th>SL / TP</th><th>Floating P/L</th></tr></thead><tbody>{data.positions.positions.map((position) => <tr key={position.ticket} className="border-t border-white/[0.06] text-slate-300"><td className="py-2">{position.symbol} <span className={position.side==='BUY'?'text-emerald-200':'text-rose-200'}>{position.side}</span></td><td>{position.volume}</td><td>{position.entry}</td><td>{position.stop_loss??'—'} / {position.take_profit??'—'}</td><td>{position.floating_profit===null?'—':position.floating_profit.toFixed(2)}</td></tr>)}</tbody></table></div>}
          {data.positions.complete && <div className="mt-4 border-t border-white/[0.07] pt-3"><h4 className="text-[10px] font-semibold text-slate-300">Currency exposure · native units</h4><p className="mt-1 text-[9px] text-slate-500">{data.positions.exposure_basis}</p><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">{(data.positions.currency_exposure_units??[]).map((item) => <div key={item.currency} className="rounded-lg bg-black/20 p-2"><div className="text-[9px] text-slate-500">{item.currency} · {item.positions} exposure legs</div><div className="mt-1 font-mono text-[10px] text-slate-200">Net {item.net_units.toLocaleString(undefined,{maximumFractionDigits:2})}</div><div className="font-mono text-[9px] text-slate-500">Gross {item.gross_units.toLocaleString(undefined,{maximumFractionDigits:2})}</div></div>)}{data.positions.account_currency_exposure && <div className="col-span-full mt-2 rounded-lg border border-white/[0.07] bg-black/20 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-[10px] font-semibold text-slate-200">Broker-quote converted exposure · {data.positions.account_currency}</h4><Tag value={data.positions.conversion_status}/></div><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3"><div><div className="text-[9px] text-slate-500">Gross converted exposure</div><div className="font-mono text-[11px] text-slate-200">{data.positions.gross_exposure_account_currency?.toLocaleString(undefined,{maximumFractionDigits:2})??'—'}</div></div><div><div className="text-[9px] text-slate-500">Net converted exposure</div><div className="font-mono text-[11px] text-slate-200">{data.positions.net_exposure_account_currency?.toLocaleString(undefined,{maximumFractionDigits:2})??'—'}</div></div><div><div className="text-[9px] text-slate-500">1% parallel shock proxy</div><div className="font-mono text-[11px] text-slate-200">{data.positions.one_percent_parallel_currency_shock_estimate?.toLocaleString(undefined,{maximumFractionDigits:2})??'—'}</div></div></div><div className="mt-2 space-y-1">{data.positions.account_currency_exposure.map((item)=><div key={item.currency} className="flex flex-wrap justify-between gap-2 text-[9px] text-slate-500"><span>{item.currency} → {item.account_currency} · {item.conversion_path?.join(' / ')??'No fresh FX path'}</span><span className="font-mono text-slate-300">{item.net_account_currency===null?'Unconverted':item.net_account_currency.toLocaleString(undefined,{maximumFractionDigits:2})}</span></div>)}</div></div>}</div>{(data.positions.exposure_unresolved_symbols??[]).length>0 && <p className="mt-2 text-[9px] text-amber-100">Exposure metadata unavailable: {data.positions.exposure_unresolved_symbols?.join(', ')}</p>}</div>}
          <p className="mt-4 text-[10px] leading-5 text-slate-500">A zero-position snapshot is explicitly recorded as complete. A complete snapshot older than 15 seconds is marked stale. A missing or partial snapshot is never interpreted as a flat account. Currency figures are native exposure units, not converted account-currency risk.</p>
        </section>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-2xl border border-white/[0.09] bg-[#0c131c] p-5">
          <h3 className="text-sm font-semibold text-white">Broker-aligned correlation</h3>
          <p className="mt-1 text-[10px] leading-5 text-slate-500">Closed H1 log-return correlations from aligned timestamps on the same MT5 installation, broker and server. Clusters use absolute correlation ≥ 0.75 and at least 30 overlapping returns.</p>
          <div className="mt-3"><Tag value={data.correlation.status}/></div>
          <div className="mt-3 flex flex-wrap gap-2">{data.correlation.clusters.map((cluster,index)=><span key={index} className="rounded-lg border border-white/[0.08] bg-black/20 px-2 py-1 text-[9px] text-slate-300">{cluster.join(' · ')}</span>)}</div>
          <div className="mt-3 space-y-2">{data.correlation.pairs.slice(0,8).map((pair)=><div key={pair.symbol_a+'-'+pair.symbol_b} className="flex justify-between gap-3 text-[10px]"><span className="text-slate-400">{pair.symbol_a} / {pair.symbol_b}</span><span className="font-mono text-slate-200">{pair.correlation.toFixed(3)} · n={pair.overlapping_returns}</span></div>)}</div>
        </section>
        <section className="rounded-2xl border border-white/[0.09] bg-[#0c131c] p-5">
          <h3 className="text-sm font-semibold text-white">Portfolio stress proxy</h3>
          <div className="mt-3"><Tag value={data.portfolio_stress.status}/></div>
          <div className="mt-3 text-xl font-semibold text-slate-100">{data.portfolio_stress.one_percent_parallel_currency_shock_account_currency===null?'—':data.portfolio_stress.one_percent_parallel_currency_shock_account_currency.toLocaleString(undefined,{maximumFractionDigits:2})+' '+(data.positions.account_currency??'')}</div>
          <p className="mt-2 text-[10px] leading-5 text-slate-500">{data.portfolio_stress.interpretation}</p>
          <p className="mt-2 text-[9px] leading-4 text-amber-100">This is a linear currency-exposure approximation, not VaR, expected shortfall, stop-loss risk or a full nonlinear scenario engine.</p>
        </section>
      </div>
      <p className="rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-3 text-[10px] leading-5 text-amber-100">{data.note} Execution is disabled.</p>
    </>}
  </div>;
}
