'use client';

import { useCallback, useEffect, useState } from 'react';

type Frame = {
  timeframe: string; symbol: string | null; bars: number; last_close: number | null;
  ema20: number | null; ema50: number | null; atr14: number | null; rsi14: number | null;
  bias: string; last_bar_at: string | null; age_minutes: number | null; fresh: boolean;
  broker: string | null; server: string | null;
};
type Pair = {
  pair: string;
  quote: { symbol: string; bid: number; ask: number; quote_time: string; spread_points: number; point: number; broker: string; server: string; age_seconds: number; fresh: boolean } | null;
  frames: Record<string, Frame>;
  multi_timeframe_bias: string;
  data_complete: boolean;
  data_fresh: boolean;
  spread_atr_ratio: number | null;
  spread_within_guard: boolean;
  readiness: string;
};
type Intelligence = {
  generated_at: string; active_installations: number; pairs: Pair[];
  macro: { regime_label: string; top_long: string; top_short: string; policy_spread: number; provenance: string; csi_scores: Record<string, unknown>; recorded_at: string; age_hours: number; fresh: boolean } | null;
  guardrails: { max_spread_points: number; max_spread_atr_ratio: number; quote_max_age_seconds: number };
  execution_enabled: false; disclaimer: string;
};
type Props = { accessToken: string };

function tone(value: string) {
  if (['BULLISH', 'BEARISH', 'RESEARCH_READY'].includes(value)) return 'text-emerald-200 border-emerald-300/20 bg-emerald-300/10';
  if (['MIXED', 'SPREAD_GUARD', 'STALE_OR_MISSING_FEED'].includes(value)) return 'text-amber-100 border-amber-300/20 bg-amber-300/10';
  return 'text-slate-300 border-white/10 bg-white/[0.04]';
}
function label(value: string) { return value.replaceAll('_', ' ').toLowerCase(); }
function number(value: number | null, digits = 4) { return value === null || !Number.isFinite(value) ? '—' : value.toFixed(digits); }
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-white/[0.09] bg-[#0c131c] p-4 sm:p-5"><h3 className="mb-4 text-sm font-semibold text-white">{title}</h3>{children}</section>;
}

export default function OwnerTradingDesk({ accessToken }: Props) {
  const [data, setData] = useState<Intelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/owner/market-intelligence', {
        headers: { Authorization: 'Bearer ' + accessToken },
        cache: 'no-store',
      });
      const body = await response.json() as Intelligence & { error?: string };
      if (!response.ok) throw new Error(body.error || 'Market intelligence request failed.');
      setData(body);
      setUpdatedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Market intelligence is unavailable.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { void refresh(); }, [refresh]);

  return <div className="space-y-5">
    <Panel title="Institutional trading desk">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-xs leading-5 text-slate-400">Multi-timeframe technical state for the core USD-major universe and gold. The desk reports observed broker data, not invented live prices or guaranteed trading signals.</p><p className="mt-2 text-[10px] text-slate-500">Last refresh: {updatedAt || 'Not yet refreshed'} · {data?.active_installations ?? 0} active MT5 connector(s)</p></div>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200 disabled:opacity-50">{loading ? 'Refreshing…' : 'Refresh market desk'}</button>
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg border border-rose-300/20 bg-rose-300/5 p-3 text-xs text-rose-200">{error}</p>}
      {loading && !data && <p className="mt-5 text-xs text-slate-400">Loading owner-authorized broker observations…</p>}
    </Panel>

    <div className="grid gap-3 md:grid-cols-2">
      <Panel title="Fundamental / macro regime">
        {data?.macro ? <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2"><span className="text-lg font-semibold text-white">{data.macro.regime_label || 'Unclassified'}</span><span className={'rounded-full border px-2 py-1 text-[10px] '+(data.macro.fresh?'text-emerald-200 border-emerald-300/20 bg-emerald-300/10':'text-amber-100 border-amber-300/20 bg-amber-300/10')}>{data.macro.fresh?'Fresh snapshot':'Stale snapshot'}</span></div>
          <div className="grid grid-cols-2 gap-2"><div className="rounded-lg bg-black/20 p-3"><div className="text-[9px] uppercase text-slate-500">Top relative strength</div><div className="mt-1 text-sm text-emerald-200">{data.macro.top_long || '—'}</div></div><div className="rounded-lg bg-black/20 p-3"><div className="text-[9px] uppercase text-slate-500">Top relative weakness</div><div className="mt-1 text-sm text-rose-200">{data.macro.top_short || '—'}</div></div></div>
          <p className="text-[10px] leading-5 text-slate-500">Source: {data.macro.provenance || 'Not recorded'} · captured {new Date(data.macro.recorded_at).toLocaleString()} · {data.macro.age_hours}h old</p>
          <details className="rounded-lg border border-white/[0.07] p-3"><summary className="cursor-pointer text-[10px] text-slate-400">Currency strength scores (raw source snapshot)</summary><pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[10px] text-slate-400">{JSON.stringify(data.macro.csi_scores, null, 2)}</pre></details>
        </div> : <p className="text-xs leading-5 text-slate-500">No macro snapshot has been recorded yet. Fundamental conclusions remain unavailable until the source pipeline produces timestamped, attributable data.</p>}
      </Panel>
      <Panel title="Research and risk gates">
        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between gap-3"><span className="text-slate-400">Maximum spread</span><span className="font-mono text-slate-200">{data?.guardrails.max_spread_points ?? '—'} points</span></div>
          <div className="flex items-center justify-between gap-3"><span className="text-slate-400">Maximum spread / ATR</span><span className="font-mono text-slate-200">{data?.guardrails.max_spread_atr_ratio ?? '—'}</span></div>
          <div className="flex items-center justify-between gap-3"><span className="text-slate-400">Quote freshness limit</span><span className="font-mono text-slate-200">{data?.guardrails.quote_max_age_seconds ?? '—'} sec</span></div>
          <div className="flex items-center justify-between gap-3"><span className="text-slate-400">Broker execution</span><span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-[10px] text-amber-100">Disabled · fail closed</span></div>
          <p className="border-t border-white/[0.07] pt-3 text-[10px] leading-5 text-slate-500">A research-ready label means minimum history, quote freshness and spread guards passed. It does not mean a strategy has positive expectancy or has passed out-of-sample validation.</p>
        </div>
      </Panel>
    </div>

    <Panel title="Pair intelligence matrix">
      <p className="mb-4 text-[10px] leading-5 text-slate-500">EMA(20/50), ATR(14), RSI(14) and directional state are calculated from closed broker candles. All three timeframes must have adequate history before multi-timeframe alignment is treated as complete.</p>
      <div className="grid gap-3 xl:grid-cols-2">
        {(data?.pairs ?? []).map((pair) => <article key={pair.pair} className="rounded-xl border border-white/[0.08] bg-black/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><div className="text-base font-semibold tracking-wide text-white">{pair.pair}</div><span className={'rounded-full border px-2 py-1 text-[9px] uppercase '+tone(pair.readiness)}>{label(pair.readiness)}</span></div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {['D1','H4','H1'].map((tf) => <div key={tf} className="rounded-lg bg-white/[0.03] p-2"><div className="text-[9px] text-slate-500">{tf}</div><div className={'mt-1 text-[10px] font-semibold '+(pair.frames[tf]?.bias==='BULLISH'?'text-emerald-200':pair.frames[tf]?.bias==='BEARISH'?'text-rose-200':'text-slate-300')}>{pair.frames[tf]?.bias ? label(pair.frames[tf].bias) : 'no data'}</div><div className="mt-1 text-[9px] text-slate-500">{pair.frames[tf]?.bars ?? 0} bars</div></div>)}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[10px]"><div className="text-slate-500">Bid / ask <span className="float-right font-mono text-slate-300">{pair.quote ? number(pair.quote.bid, pair.pair==='USDJPY'?3:5)+' / '+number(pair.quote.ask,pair.pair==='USDJPY'?3:5) : '—'}</span></div><div className="text-slate-500">Spread <span className="float-right font-mono text-slate-300">{pair.quote ? number(pair.quote.spread_points,1)+' pts' : '—'}</span></div><div className="text-slate-500">H1 ATR(14) <span className="float-right font-mono text-slate-300">{number(pair.frames.H1?.atr14, pair.pair==='USDJPY'?3:5)}</span></div><div className="text-slate-500">H1 RSI(14) <span className="float-right font-mono text-slate-300">{number(pair.frames.H1?.rsi14,1)}</span></div><div className="text-slate-500">Spread / ATR <span className="float-right font-mono text-slate-300">{pair.spread_atr_ratio===null?'—':(pair.spread_atr_ratio*100).toFixed(2)+'%'}</span></div><div className="text-slate-500">Quote age <span className="float-right font-mono text-slate-300">{pair.quote?pair.quote.age_seconds+'s':'—'}</span></div></div>
          <div className="mt-3 flex items-center justify-between border-t border-white/[0.07] pt-3 text-[10px]"><span className="text-slate-500">MTF alignment</span><span className={'font-semibold '+tone(pair.multi_timeframe_bias)}>{label(pair.multi_timeframe_bias)}</span></div>
        </article>)}
      </div>
      {!data?.pairs?.length && !loading && <p className="text-xs text-slate-500">No pair observations are available yet.</p>}
    </Panel>
    <p className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-[10px] leading-5 text-slate-500">{data?.disclaimer ?? 'Research only. No broker orders are placed, modified or closed.'}</p>
  </div>;
}
