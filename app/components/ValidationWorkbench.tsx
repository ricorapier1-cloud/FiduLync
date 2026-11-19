'use client';

import { useEffect, useState } from 'react';
import { createClient, type Session } from '@supabase/supabase-js';
import Link from 'next/link';
import {
  applyExecutionCostStress, calculateTradeMetrics, evaluateWalkForward, monteCarloBootstrap,
  type CostedTrade, type NetTrade, type WalkForwardFold,
} from '@/lib/validationEngine';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
}) : null;

type Result = {
  metrics: ReturnType<typeof calculateTradeMetrics>;
  monteCarlo: ReturnType<typeof monteCarloBootstrap>;
  walkForward: ReturnType<typeof evaluateWalkForward> | null;
  costStress: ReturnType<typeof applyExecutionCostStress> | null;
};

function pretty(value: number | null | undefined, digits = 2) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—';
}

export default function ValidationWorkbench() {
  const [session, setSession] = useState<Session | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [tradesJson, setTradesJson] = useState('');
  const [foldsJson, setFoldsJson] = useState('');
  const [costsJson, setCostsJson] = useState('');
  const [stressJson, setStressJson] = useState('{"spread": 1.5, "slippage": 2, "commission": 1.25, "swap": 1.5}');
  const [result, setResult] = useState<Result | null>(null);
  const [message, setMessage] = useState('No dataset loaded. Import actual, closed trade outcomes to begin.');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const verify = async (current: Session | null) => {
      if (!current) { if (active) { setSession(null); setAuthorized(false); setAuthChecked(true); } return; }
      try {
        const response = await fetch('/api/owner/verify', {
          headers: { Authorization: 'Bearer ' + current.access_token }, cache: 'no-store',
        });
        if (active) { setSession(current); setAuthorized(response.ok); setAuthChecked(true); }
      } catch {
        if (active) { setSession(null); setAuthorized(false); setAuthChecked(true); }
      }
    };
    if (!supabase) { setAuthChecked(true); return; }
    void supabase.auth.getSession().then(({ data }) => verify(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => { void verify(next); });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  async function loadFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setMessage('File exceeds the 2 MB limit.'); return; }
    try {
      const text = await file.text();
      setTradesJson(text);
      setResult(null);
      setMessage('File loaded locally. Validate the contents before running the research checks.');
    } catch {
      setMessage('Could not read the selected file.');
    }
  }

  function runValidation() {
    setBusy(true); setMessage('');
    try {
      const raw: unknown = JSON.parse(tradesJson);
      if (!Array.isArray(raw) || raw.length < 30 || raw.length > 5000) {
        throw new Error('Provide a JSON array containing 30–5,000 actual closed-trade outcomes.');
      }
      const trades = raw as NetTrade[];
      const metrics = calculateTradeMetrics(trades);
      if (!metrics) throw new Error('Trade records must contain finite netR values.');
      const monteCarlo = monteCarloBootstrap(trades, { iterations: 5000, seed: 20261119 });
      let walkForward: Result['walkForward'] = null;
      if (foldsJson.trim()) {
        const folds = JSON.parse(foldsJson) as WalkForwardFold[];
        if (!Array.isArray(folds)) throw new Error('Walk-forward input must be a JSON array of chronological folds.');
        walkForward = evaluateWalkForward(folds);
      }
      let costStress: Result['costStress'] = null;
      if (costsJson.trim()) {
        const costed = JSON.parse(costsJson) as CostedTrade[];
        const stress = JSON.parse(stressJson) as { spread: number; slippage: number; commission: number; swap: number };
        if (!Array.isArray(costed)) throw new Error('Costed trade input must be a JSON array.');
        costStress = applyExecutionCostStress(costed, stress);
        if (!costStress) throw new Error('Cost stress input is invalid. Costs must be non-negative and multipliers must be at least 1.');
      }
      setResult({ metrics, monteCarlo, walkForward, costStress });
      setMessage('Analysis completed locally. Imported trades remain user-supplied and are not broker-verified.');
    } catch (error) {
      setResult(null);
      setMessage(error instanceof Error ? error.message : 'Validation could not be completed.');
    } finally { setBusy(false); }
  }

  if (!authChecked) return <div className="mx-auto max-w-3xl px-4 py-20 text-sm text-slate-400">Verifying private owner session…</div>;
  if (!authorized || !session) return <div className="mx-auto max-w-3xl px-4 py-20 text-slate-100"><h1 className="text-xl font-semibold">Private owner access required</h1><p className="mt-2 text-sm text-slate-400">Sign in to the owner console before using the validation workbench.</p><Link href="/owner" className="mt-4 inline-block text-sm text-emerald-300 underline">Open owner sign-in</Link></div>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-32 text-slate-100 sm:px-6">
      <header className="border-b border-white/10 pb-5">
        <Link href="/research" className="font-mono text-[10px] text-emerald-300 hover:underline">← QUANT RESEARCH LAB</Link>
        <p className="mt-5 font-mono text-[10px] tracking-[0.2em] text-cyan-200">STAGE 06 / STRATEGY VALIDATION</p>
        <h1 className="mt-2 text-3xl font-semibold">Validation workbench</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Run net-R performance analysis, seeded bootstrap resampling, chronological walk-forward checks and execution-cost stress on actual closed trades. All calculations run locally in this browser; imported trade records are not uploaded or saved.</p>
      </header>

      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-[#0b121a] p-5">
          <h2 className="text-lg font-semibold">Closed-trade outcomes</h2>
          <p className="mt-2 text-xs leading-5 text-slate-500">Paste a JSON array with netR (net result in risk multiples). For WFA, include timezone-aware closedAt timestamps. Outcomes must already include spread, commission, swap and slippage.</p>
          <input type="file" accept=".json,application/json" onChange={(event) => void loadFile(event.target.files?.[0])} className="mt-4 block w-full text-xs text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:text-slate-200" />
          <textarea rows={12} value={tradesJson} onChange={(event) => setTradesJson(event.target.value)} placeholder={'[\n  {"netR": 1.2, "closedAt": "2026-01-05T10:00:00Z"},\n  {"netR": -1.0, "closedAt": "2026-01-06T12:00:00Z"}\n]'} className="mt-4 w-full rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-xs leading-5 text-white" />
          <button type="button" onClick={runValidation} disabled={busy || !tradesJson.trim()} className="mt-3 h-11 w-full rounded-lg bg-emerald-300 px-4 text-sm font-semibold text-[#06110d] disabled:opacity-50">{busy ? 'Calculating…' : 'Run validation analytics'}</button>
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-white/10 bg-[#0b121a] p-5">
            <h2 className="text-lg font-semibold">Optional walk-forward folds</h2>
            <p className="mt-2 text-xs leading-5 text-slate-500">Three or more chronological folds. Each fold requires timestamped in-sample and OOS trades inside its declared date windows, with at least 30 OOS trades per fold.</p>
            <textarea rows={8} value={foldsJson} onChange={(event) => setFoldsJson(event.target.value)} placeholder="Paste an array of WalkForwardFold objects…" className="mt-3 w-full rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-xs leading-5 text-white" />
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0b121a] p-5">
            <h2 className="text-lg font-semibold">Optional execution-cost stress</h2>
            <p className="mt-2 text-xs leading-5 text-slate-500">Provide grossR and separate spreadCostR, slippageCostR, commissionCostR and swapCostR per trade. Multipliers are scenario assumptions, not measured broker conditions.</p>
            <textarea rows={5} value={costsJson} onChange={(event) => setCostsJson(event.target.value)} placeholder="Paste costed trade records…" className="mt-3 w-full rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-xs leading-5 text-white" />
            <label className="mt-3 block text-xs text-slate-400">Stress multipliers JSON
              <input value={stressJson} onChange={(event) => setStressJson(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 font-mono text-xs text-white" />
            </label>
          </div>
        </div>
      </section>

      {message && <p role="status" aria-live="polite" className="mt-5 rounded-lg border border-white/10 bg-black/20 p-3 text-xs leading-5 text-slate-300">{message}</p>}

      {result && (
        <section className="mt-6 space-y-5">
          <div className="rounded-xl border border-white/10 bg-[#0b121a] p-5">
            <div className="font-mono text-[9px] tracking-widest text-emerald-300">OBSERVED CLOSED-TRADE METRICS</div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              {[
                ['Trades', String(result.metrics?.trades ?? 0)],
                ['Expectancy', pretty(result.metrics?.expectancyR) + ' R'],
                ['Win rate', pretty((result.metrics?.winRate ?? 0) * 100) + '%'],
                ['Profit factor', pretty(result.metrics?.profitFactor)],
                ['Maximum drawdown', pretty(result.metrics?.maxDrawdownR) + ' R'],
                ['Net result', pretty(result.metrics?.totalR) + ' R'],
              ].map(([label, value]) => <div key={label} className="rounded-lg border border-white/[0.07] bg-black/20 p-3"><div className="text-[9px] text-slate-500">{label}</div><div className="mt-2 text-lg font-semibold tabular-nums">{value}</div></div>)}
            </div>
          </div>
          {result.monteCarlo && <div className="rounded-xl border border-white/10 bg-[#0b121a] p-5">
            <div className="font-mono text-[9px] tracking-widest text-cyan-200">SEEDED BOOTSTRAP / 5,000 RESAMPLED PATHS</div>
            <p className="mt-2 text-xs text-slate-500">Resamples observed trade R-multiples with replacement. It does not generate market prices or prove future performance.</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-black/20 p-3"><div className="text-[9px] text-slate-500">Ending equity P05 / P50 / P95</div><div className="mt-2 text-sm font-semibold">{pretty(result.monteCarlo.endingEquityR.p05)} / {pretty(result.monteCarlo.endingEquityR.p50)} / {pretty(result.monteCarlo.endingEquityR.p95)} R</div></div>
              <div className="rounded-lg bg-black/20 p-3"><div className="text-[9px] text-slate-500">Maximum DD P50 / P95 / P99</div><div className="mt-2 text-sm font-semibold">{pretty(result.monteCarlo.maxDrawdownPct.p50)} / {pretty(result.monteCarlo.maxDrawdownPct.p95)} / {pretty(result.monteCarlo.maxDrawdownPct.p99)}%</div></div>
              <div className="rounded-lg bg-black/20 p-3"><div className="text-[9px] text-slate-500">Ruin threshold probability</div><div className="mt-2 text-sm font-semibold">{pretty(result.monteCarlo.ruinProbability * 100)}%</div></div>
            </div>
          </div>}
          {result.walkForward && <div className="rounded-xl border border-white/10 bg-[#0b121a] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Walk-forward evidence</h2><span className={result.walkForward.eligible ? 'font-mono text-xs text-emerald-200' : 'font-mono text-xs text-amber-200'}>{result.walkForward.eligible ? 'STRUCTURAL CHECKS PASSED' : 'NOT ELIGIBLE'}</span></div>
            <p className="mt-2 text-xs text-slate-400">{result.walkForward.foldCount} folds · aggregate OOS expectancy {pretty(result.walkForward.aggregateOos?.expectancyR)} R</p>
            {result.walkForward.blockers.length > 0 && <p className="mt-3 text-xs leading-5 text-amber-200">{result.walkForward.blockers.join(' · ')}</p>}
          </div>}
          {result.costStress && <div className="rounded-xl border border-white/10 bg-[#0b121a] p-5">
            <h2 className="text-lg font-semibold">Execution-cost stress result</h2>
            <p className="mt-3 text-xs text-slate-400">Baseline expectancy: {pretty(result.costStress.baseline.expectancyR)} R · stressed expectancy: {pretty(result.costStress.stressed.expectancyR)} R · stressed profit factor: {pretty(result.costStress.stressed.profitFactor)}</p>
          </div>}
        </section>
      )}
      <p className="mt-6 rounded-lg border border-amber-300/15 bg-amber-300/[0.04] p-3 text-[10px] leading-5 text-amber-100">Important: this workbench performs statistical checks on the data you supply. It does not authenticate broker history, verify strategy code, reconstruct tick-level fills, guarantee out-of-sample independence or approve an EA for live trading. Do not use unverified or synthetic trade outcomes as evidence.</p>
    </div>
  );
}
