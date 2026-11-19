'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import BrandGlyph from '@/components/BrandGlyph';

type QuantitativeIndicators = {
  rsi14: number | null;
  alma20: number | null;
  kama10: number | null;
  hurst_exponent: number | null;
  trend_r_squared: number | null;
  adr20_pips: number | null;
  current_daily_range_adr: number | null;
  gaussian_z_score: number | null;
  kaufman_efficiency_ratio: number | null;
  adx: number | null;
};

type ResearchResult = {
  symbol: string;
  bias: 'LONG' | 'SHORT' | 'NEUTRAL';
  confluence_score: number;
  regime: string;
  atr_sl_pips: number | null;
  atr_tp_pips: number | null;
  session: string;
  killzone_active: string;
  csi_spread: number;
  max_risk_pct: number;
  risk_multiplier: number;
  correlation_group: string;
  news_lockout: boolean;
  safe_to_trade: boolean;
  ghost_score: number | null;
  ghost_allowed: boolean;
  execution_blockers: string[];
  risk_mode: string;
  market_data_source: string;
  technical_data_verified: boolean;
  macro_data_source: 'fallback' | 'provider' | 'partial';
  macro_data_verified: boolean;
  macro_data_age_minutes: number | null;
  latest_market_candle_at: string | null;
  market_candle_counts: { h1: number; h4: number; d1: number };
  quantitative_indicators: QuantitativeIndicators;
  timestamp_utc: string;
};

const instruments = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'USDCAD', 'AUDUSD', 'NZDUSD', 'EURJPY', 'GBPJPY', 'XAUUSD'];

function number(value: number | null, digits = 2, suffix = '') {
  return value === null || !Number.isFinite(value) ? '—' : `${value.toFixed(digits)}${suffix}`;
}

function ageLabel(minutes: number | null) {
  if (minutes === null || !Number.isFinite(minutes) || minutes < 0) return 'AGE UNKNOWN';
  if (minutes < 1) return 'UNDER 1 MIN';
  if (minutes < 60) return `${Math.floor(minutes)} MIN`;
  if (minutes < 1_440) return `${(minutes / 60).toFixed(1)} HRS`;
  return `${(minutes / 1_440).toFixed(1)} DAYS`;
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <article className="rounded-lg border border-white/[0.07] bg-black/20 p-3">
      <div className="font-mono text-[9px] tracking-wider text-slate-500">{label}</div>
      <div className="mt-2 font-mono text-lg font-semibold text-slate-100">{value}</div>
      {note && <div className="mt-1 text-[10px] leading-4 text-slate-500">{note}</div>}
    </article>
  );
}

export default function QuantResearchLab() {
  const [symbol, setSymbol] = useState('EURUSD');
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState('');

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/v1/macro-signal?symbol=${encodeURIComponent(symbol)}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = typeof payload === 'object' && payload !== null && 'error' in payload
          && typeof payload.error === 'string' ? payload.error : `Research request failed (${response.status}).`;
        throw new Error(message);
      }
      if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
        throw new Error('The research service returned an invalid response.');
      }
      const data = payload as ResearchResult;
      if (data.symbol !== symbol || !data.quantitative_indicators || !data.market_candle_counts) {
        throw new Error('The research response failed its schema checks.');
      }
      setResult(data);
      setRefreshedAt(new Date().toISOString());
    } catch (caught) {
      setResult(null);
      setError(caught instanceof Error ? caught.message : 'Research service is unavailable.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // Refresh is intentionally user-driven: no hidden polling or artificial live state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  const indicators = result?.quantitative_indicators;
  const verifiedTechnical = result?.technical_data_verified === true;
  const verifiedMacro = result?.macro_data_verified === true;

  return (
    <div className="min-h-screen bg-[#060b10] px-4 py-8 pb-36 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-end justify-between gap-5 border-b border-white/[0.08] pb-6">
          <div>
            <Link href="/" className="font-mono text-[10px] tracking-wider text-emerald-300 hover:underline">← BACK TO MACROLYNC</Link>
            <p className="mt-5 font-mono text-[10px] tracking-[0.2em] text-emerald-300">QUANTLYNC / PERSONAL RESEARCH WORKSTATION</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Technical &amp; quantitative research</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Multi-timeframe technical diagnostics, statistical regime analysis and macro/market data quality. Every result is tied to the data actually received.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/risk" className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs text-slate-300 hover:border-emerald-300/30"><BrandGlyph name="gauge" size={14} /> Risk planner</Link>
            <Link href="/store" className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs text-slate-300 hover:border-emerald-300/30"><BrandGlyph name="cpu" size={14} /> Personal EA Lab</Link>
          </div>
        </header>

        <section className="mt-6 grid gap-4 rounded-xl border border-white/[0.08] bg-[#0b121a] p-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <label htmlFor="quant-symbol" className="font-mono text-[9px] tracking-widest text-slate-500">RESEARCH INSTRUMENT</label>
            <select id="quant-symbol" value={symbol} onChange={(event) => setSymbol(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#060b10] px-3 font-mono text-sm text-white outline-none focus:border-emerald-300/40 sm:max-w-xs">
              {instruments.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <p className="mt-2 text-[10px] text-slate-500">XAGUSD remains deferred until broker-specific contract and margin specifications are verified.</p>
          </div>
          <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-5 text-xs font-semibold text-[#06110d] hover:bg-emerald-300 disabled:opacity-50">
            <BrandGlyph name="refresh" size={14} /> {loading ? 'ANALYSING…' : 'REFRESH RESEARCH'}
          </button>
        </section>

        {error && <div role="alert" className="mt-4 rounded-lg border border-rose-400/20 bg-rose-400/5 p-4 text-sm text-rose-200">{error}</div>}

        {result && (
          <>
            <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Data integrity status">
              <Metric label="BROKER / CANDLE DATA" value={verifiedTechnical ? 'VERIFIED' : 'UNAVAILABLE'} note={`${result.market_data_source.toUpperCase()} · H1 ${result.market_candle_counts.h1} / H4 ${result.market_candle_counts.h4} / D1 ${result.market_candle_counts.d1}`} />
              <Metric label="FUNDAMENTAL DATA" value={verifiedMacro ? 'VERIFIED' : result.macro_data_source.toUpperCase()} note={result.macro_data_age_minutes === null ? 'Observation age unavailable' : `Snapshot age ${ageLabel(result.macro_data_age_minutes)}`} />
              <Metric label="LATEST CLOSED CANDLE" value={result.latest_market_candle_at ? new Date(result.latest_market_candle_at).toISOString().replace('T', ' ').slice(0, 16) + 'Z' : 'UNAVAILABLE'} note="UTC · closed-bar calculations only" />
              <Metric label="RESEARCH RESPONSE" value={refreshedAt ? new Date(refreshedAt).toISOString().slice(11, 19) + 'Z' : '—'} note="Local refresh time · not market-data time" />
            </section>

            <section className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div className="rounded-xl border border-white/[0.08] bg-[#0b121a] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[9px] tracking-widest text-slate-500">REGIME &amp; DIRECTIONAL DIAGNOSTICS</p>
                    <h2 className="mt-1 text-xl font-semibold">{result.symbol} <span className="text-sm font-normal text-slate-400">/ {result.regime.replaceAll('_', ' ')}</span></h2>
                  </div>
                  <span className={`rounded-md border px-3 py-1.5 font-mono text-[10px] ${result.bias === 'LONG' ? 'border-emerald-300/30 text-emerald-200' : result.bias === 'SHORT' ? 'border-rose-300/30 text-rose-200' : 'border-slate-300/20 text-slate-300'}`}>{result.bias} · {result.confluence_score}</span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Metric label="RSI (14)" value={number(indicators?.rsi14 ?? null, 1)} />
                  <Metric label="ADX" value={number(indicators?.adx ?? null, 1)} />
                  <Metric label="KER" value={number(indicators?.kaufman_efficiency_ratio ?? null, 3)} />
                  <Metric label="HURST EXPONENT" value={number(indicators?.hurst_exponent ?? null, 3)} />
                  <Metric label="TREND R²" value={number(indicators?.trend_r_squared ?? null, 3)} />
                  <Metric label="GAUSSIAN Z-SCORE" value={number(indicators?.gaussian_z_score ?? null, 2)} />
                  <Metric label="ALMA (20)" value={number(indicators?.alma20 ?? null, 5)} />
                  <Metric label="KAMA (10)" value={number(indicators?.kama10 ?? null, 5)} />
                  <Metric label="ADR (20)" value={number(indicators?.adr20_pips ?? null, 1, ' pips')} />
                  <Metric label="CURRENT RANGE / ADR" value={number(indicators?.current_daily_range_adr ?? null, 2, '×')} />
                  <Metric label="ATR STOP DISTANCE" value={number(result.atr_sl_pips, 1, ' pips')} />
                  <Metric label="ATR TARGET DISTANCE" value={number(result.atr_tp_pips, 1, ' pips')} />
                </div>
                <p className="mt-4 text-[10px] leading-5 text-slate-500">Indicators are calculated from completed bars where source coverage is sufficient. A blank value means the required verified observations are not available; it is not zero.</p>
              </div>

              <div className="rounded-xl border border-white/[0.08] bg-[#0b121a] p-5">
                <p className="font-mono text-[9px] tracking-widest text-slate-500">RISK &amp; MARKET-QUALITY CONTEXT</p>
                <h2 className="mt-1 text-xl font-semibold">Research gate diagnostics</h2>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Metric label="GHOST PROTOCOL" value={result.ghost_score === null ? 'UNAVAILABLE' : `${result.ghost_score.toFixed(2)} / 1.00`} note={result.ghost_allowed ? 'Quality threshold passed' : 'Quality threshold not passed'} />
                  <Metric label="RISK MULTIPLIER" value={`${result.risk_multiplier.toFixed(2)}×`} note={`Risk mode: ${result.risk_mode}`} />
                  <Metric label="MAX RISK CEILING" value={`${result.max_risk_pct.toFixed(2)}%`} note="Policy ceiling, not a suggested lot size" />
                  <Metric label="NEWS LOCKOUT" value={result.news_lockout ? 'ACTIVE' : 'NOT TRIGGERED'} note="Depends on available verified calendar inputs" />
                  <Metric label="SESSION" value={result.session} />
                  <Metric label="KILLZONE" value={result.killzone_active} />
                </div>
                <div className="mt-4 rounded-lg border border-amber-300/15 bg-amber-300/[0.04] p-3">
                  <p className="font-mono text-[9px] tracking-widest text-amber-200">SUPERVISORY STATE / {result.safe_to_trade ? 'GATES PASSED' : 'HOLD / ABSTAIN'}</p>
                  <p className="mt-1 text-[10px] leading-5 text-slate-300">{result.execution_blockers.length ? result.execution_blockers.join(' · ') : 'No current blockers were returned. This is not broker execution approval.'}</p>
                </div>
              </div>
            </section>
          </>
        )}

        {!result && !error && <div className="mt-5 rounded-xl border border-white/[0.08] bg-[#0b121a] p-8 text-center text-sm text-slate-400">{loading ? 'Loading verified research inputs…' : 'Select an instrument and refresh to request research.'}</div>}

        <section className="mt-6 rounded-xl border border-white/[0.08] bg-[#0b121a] p-4 text-[11px] leading-5 text-slate-400">
          <div className="flex items-center gap-2 font-mono text-[9px] tracking-widest text-emerald-300"><BrandGlyph name="shield-check" size={13} /> INSTITUTIONAL DATA-INTEGRITY RULE</div>
          <p className="mt-2">FiduLync is a private research workstation. Reference exchange rates are not executable prices. Technical indicators require real broker candles; fundamental observations retain their source and release dates. No backtest, signal score or AI commentary is a calibrated probability or a promise of profitability. Missing, stale or contradictory data must remain unavailable and produce HOLD / ABSTAIN.</p>
          <p className="mt-2">Research is read-only. No order is sent, modified or closed by this page.</p>
        </section>
      </div>
    </div>
  );
}
