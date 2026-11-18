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
  positions: { snapshot_id: string | null; captured_at: string | null; complete: boolean; positions: number | null; floating_profit: number | null; status: string };
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
        <Stat title="Position snapshot" value={data.positions.complete?String(data.positions.positions):'Awaiting'} detail={data.positions.captured_at?new Date(data.positions.captured_at).toLocaleString():'No complete snapshot received'}/>
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
          <div className="mt-4 space-y-3 text-xs"><div className="flex justify-between gap-3"><span className="text-slate-500">Positions in snapshot</span><span className="font-mono text-slate-200">{data.positions.positions??'—'}</span></div><div className="flex justify-between gap-3"><span className="text-slate-500">Floating P/L</span><span className="font-mono text-slate-200">{data.positions.floating_profit===null?'—':data.positions.floating_profit.toFixed(2)}</span></div><div className="flex justify-between gap-3"><span className="text-slate-500">Captured at</span><span className="font-mono text-slate-200">{data.positions.captured_at?new Date(data.positions.captured_at).toLocaleString():'—'}</span></div></div>
          <p className="mt-4 text-[10px] leading-5 text-slate-500">Position snapshots are waiting for the MT5 publisher integration. Missing snapshots must never be interpreted as a flat account.</p>
        </section>
      </div>
      <p className="rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-3 text-[10px] leading-5 text-amber-100">{data.note} Execution is disabled.</p>
    </>}
  </div>;
}
