'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MacroSnapshot } from '@/types/macro';
import type { GoldMacroContext } from '@/lib/macro/goldAndRegimeEngine';
import { getCurrencyStrengthIndex } from '@/lib/currencyStrength';
import type { IntradaySignal } from '@/lib/quant/intradaySignalEngine';

type Quote = {
  symbol: string; bid: number | null; ask: number | null; mid: number | null;
  spread: number | null; quoteTimeUtc: string | null; retrievedAtUtc: string;
  ageMs: number | null; freshness: 'LIVE' | 'STALE' | 'UNAVAILABLE';
  latencyMs: number; source: string; error: string | null;
};
type QuoteResponse = { generatedAtUtc: string; latencyMs: number; status: string; quotes: Quote[] };
type FxRow = { date: string; rates: Record<string, number> };
const symbols: SymbolCode[] = ['EURUSD', 'GBPUSD', 'XAUUSD', 'USDJPY'];
const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CHF', 'CAD'] as const;
const FX_KEY = 'fidulync-desk-fx-v1';
function zonedDecimalHour(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  return Number(parts.find((p) => p.type === 'hour')?.value ?? 0) + Number(parts.find((p) => p.type === 'minute')?.value ?? 0) / 60;
}
function readStorage<T>(key: string): T | null {
  try { const value = window.localStorage.getItem(key); return value ? JSON.parse(value) as T : null; } catch { return null; }
}
function display(value: number | null | undefined, digits: number) { return value === null || value === undefined || !Number.isFinite(value) ? '—' : value.toFixed(digits); }
function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }

export default function DeskTerminal({ initialSnapshot, initialGoldContext, onSnapshotChange, onGoldContextChange }: { initialSnapshot: MacroSnapshot; initialGoldContext: GoldMacroContext | null; onSnapshotChange: (snapshot: MacroSnapshot) => void; onGoldContextChange: (context: GoldMacroContext | null) => void }) {
  const snapshot = initialSnapshot;
  const goldContext = initialGoldContext;
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [satelliteSymbol, setSatelliteSymbol] = useState<string | null>(null);
  const [quoteStatus, setQuoteStatus] = useState('CONNECTING');
  const [latency, setLatency] = useState<number | null>(null);
  const [quoteSync, setQuoteSync] = useState<string | null>(null);
  const [fxRows, setFxRows] = useState<FxRow[]>([]);
  const [fxStatus, setFxStatus] = useState('NOT SYNCED');
  const [fxSync, setFxSync] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.parse(initialSnapshot.asOf) || 0);
  const [ready, setReady] = useState(false);
  const [forceSyncing, setForceSyncing] = useState(false);
  const [intradaySignals, setIntradaySignals] = useState<IntradaySignal[]>([]);
  const [signalSyncUtc, setSignalSyncUtc] = useState<string | null>(null);

  const quoteFor = useCallback((symbol: string) => quotes.find((q) => q.symbol === symbol) ?? null, [quotes]);
  const refreshIntradaySignals = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/intraday-signals', { cache: 'no-store' });
      if (!response.ok) throw new Error('Intraday signal feed unavailable');
      const payload = await response.json() as { signals?: IntradaySignal[]; generatedAtUtc?: string };
      setIntradaySignals(Array.isArray(payload.signals) ? payload.signals : []);
      setSignalSyncUtc(payload.generatedAtUtc ?? new Date().toISOString());
    } catch {
      setIntradaySignals([]);
      setSignalSyncUtc(null);
    }
  }, []);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch('/api/v1/intraday-signals', { cache: 'no-store' });
        if (!response.ok) throw new Error('Intraday signal feed unavailable');
        const payload = await response.json() as { signals?: IntradaySignal[]; generatedAtUtc?: string };
        if (active) {
          setIntradaySignals(Array.isArray(payload.signals) ? payload.signals : []);
          setSignalSyncUtc(payload.generatedAtUtc ?? new Date().toISOString());
        }
      } catch {
        if (active) { setIntradaySignals([]); setSignalSyncUtc(null); }
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  const hourWAT = zonedDecimalHour(new Date(now), 'Africa/Lagos');
  const hourNewYork = zonedDecimalHour(new Date(now), 'America/New_York');
  const activeSession = hourWAT >= 8 && hourWAT < 12 ? 'LONDON' : hourNewYork >= 8 && hourNewYork < 12 ? 'NEW YORK' : 'OFF-SESSION';
  const healthyProviderCount = snapshot.providerStatus?.filter((provider) => provider.status === 'HEALTHY').length ?? 0;
  const totalProviderCount = snapshot.providerStatus?.length ?? 0;

  const refreshQuotes = useCallback(async () => {
    if (document.visibilityState === 'hidden') return;
    const query = satelliteSymbol ? '?satellite=' + encodeURIComponent(satelliteSymbol) : '';
    const response = await fetch('/api/v1/live-quotes' + query, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Live quote proxy HTTP ${response.status}`);
    const payload = await response.json() as QuoteResponse;
    setQuotes(payload.quotes);
    setQuoteStatus(payload.status);
    setLatency(payload.latencyMs);
    setQuoteSync(payload.generatedAtUtc);
  }, [satelliteSymbol]);
  const refreshFx = useCallback(async () => {
    if (document.visibilityState === 'hidden') return;
    try {
      const start = new Date(); start.setUTCDate(start.getUTCDate() - 35);
      const startDate = start.toISOString().slice(0, 10);
      const response = await fetch(`https://api.frankfurter.dev/v1/${startDate}..?base=USD&symbols=${currencies.join(',')}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Frankfurter unavailable');
      const payload = await response.json() as { rates?: Record<string, Record<string, number>> };
      const rows = Object.entries(payload.rates ?? {}).flatMap(([date, rates]) =>
        currencies.every((currency) => Number.isFinite(rates[currency]) && rates[currency] > 0) ? [{ date, rates }] : []);
      if (!rows.length) throw new Error('No valid dated reference observations');
      rows.sort((a, b) => a.date.localeCompare(b.date));
      setFxRows(rows); setFxStatus('REFERENCE DATA'); setFxSync(new Date().toISOString());
      window.localStorage.setItem(FX_KEY, JSON.stringify({ rows, retrievedAtUtc: new Date().toISOString() }));
    } catch {
      setFxStatus(fxRows.length ? 'CACHED / OFFLINE' : 'UNAVAILABLE');
    }
  }, [fxRows.length]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const cachedFx = readStorage<{ rows: FxRow[]; retrievedAtUtc: string }>(FX_KEY);
      if (cachedFx?.rows?.length) { setFxRows(cachedFx.rows); setFxSync(cachedFx.retrievedAtUtc); setFxStatus('CACHED'); }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const refreshSatellite = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/top-pairs', { cache: 'no-store' });
      if (!response.ok) throw new Error('Macro opportunity ranking unavailable');
      const payload = await response.json() as { candidates?: Array<{ symbol: string; uncrowded?: boolean }> };
      const candidate = payload.candidates?.find((item) => item.uncrowded === true && !symbols.includes(item.symbol));
      setSatelliteSymbol(candidate?.symbol ?? null);
    } catch {
      setSatelliteSymbol(null);
    }
  }, []);
  useEffect(() => {
    if (!ready) return;
    const initial = window.setTimeout(() => void refreshSatellite(), 0);
    const timer = window.setInterval(() => void refreshSatellite(), 300_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [ready, refreshSatellite]);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick(); const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!ready) return;
    let timer: number | undefined;
    const poll = () => { if (document.visibilityState === 'visible') void refreshQuotes().catch(() => setQuoteStatus('DEGRADED')); };
    const startPolling = () => { if (timer === undefined) { poll(); timer = window.setInterval(poll, 15_000); } };
    const stopPolling = () => { if (timer !== undefined) { window.clearInterval(timer); timer = undefined; } };
    const onVisibility = () => { if (document.visibilityState === 'visible') startPolling(); else stopPolling(); };
    startPolling();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', startPolling);
    return () => { stopPolling(); document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('focus', startPolling); };
  }, [ready, refreshQuotes]);
  useEffect(() => {
    if (!ready) return;
    const poll = () => { if (document.visibilityState === 'visible') void refreshFx(); };
    poll(); const timer = window.setInterval(poll, 60 * 60_000);
    const onVisibility = () => { if (document.visibilityState === 'visible') poll(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisibility); };
  }, [ready, refreshFx]);

  const strength = useMemo(() => {
    if (fxRows.length < 2) return [];
    const first = fxRows[Math.max(0, fxRows.length - 20)];
    const last = fxRows[fxRows.length - 1];
    const foreignChanges = currencies.map((currency) => {
      const start = first.rates[currency]; const end = last.rates[currency];
      return { currency, change: start > 0 && end > 0 ? (end - start) / start * 100 : null };
    });
    const usdAverage = foreignChanges.reduce((sum, item) => sum + (item.change ?? 0), 0) / foreignChanges.length;
    const rows = [{ currency: 'USD', score: clamp(5 + usdAverage * 2, 0, 10) }, ...foreignChanges.flatMap((item) =>
      item.change === null ? [] : [{ currency: item.currency, score: clamp(5 - item.change * 2, 0, 10) }])];
    return rows.map((item) => ({ ...item, score: Number(item.score.toFixed(2)) })).sort((a, b) => b.score - a.score);
  }, [fxRows]);
  const macroStrength = useMemo(() => getCurrencyStrengthIndex(snapshot), [snapshot]);
  const matrixCurrencies = Array.from(new Set([...strength.map((item) => item.currency), ...macroStrength.map((item) => item.currency)])).sort();


  const forceSync = async () => {
    setForceSyncing(true);
    try {
      const macroResponse = await fetch('/api/macro/snapshot?force=true', { cache: 'no-store' });
      if (!macroResponse.ok) throw new Error('Macro snapshot refresh HTTP ' + macroResponse.status);
      const freshSnapshot = await macroResponse.json() as MacroSnapshot;
      if (!Array.isArray(freshSnapshot.currencies) || !Array.isArray(freshSnapshot.catalysts)) {
        throw new Error('Macro snapshot response failed validation');
      }
      onSnapshotChange(freshSnapshot);
      const [goldResult, quoteResult] = await Promise.allSettled([
        fetch('/api/macro/gold-context', { cache: 'no-store' }),
        refreshQuotes(),
        refreshFx(),
      ]);
      if (quoteResult.status === 'rejected') setQuoteStatus('DEGRADED');
      if (goldResult.status === 'fulfilled') {
        const freshGold = await goldResult.value.json() as GoldMacroContext;
        onGoldContextChange(freshGold);
      } else {
        onGoldContextChange(null);
      }
      setNow(Date.now());
    } catch (error) {
      console.error('MacroLync force sync failed:', error);
      setQuoteStatus('DEGRADED');
    } finally {
      setForceSyncing(false);
    }
  };
  const watClock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(now));
  const utcClock = new Date(now).toISOString().slice(11, 19);
  const displaySymbols = [...symbols, ...(satelliteSymbol ? [satelliteSymbol] : [])];
  return <section id="desk-terminal" className="desk-terminal scroll-mt-24" aria-label="Macro and fundamental research terminal">
    <div className="desk-topbar">
      <div><span className="desk-kicker">MACROLYNC / PRIVATE SYSTEMATIC RESEARCH</span><h2>MacroLync Terminal</h2></div>
      <div className="desk-top-meta"><span className={quoteStatus === 'HEALTHY' && quotes.every((item) => item.freshness === 'LIVE' && item.ageMs !== null && item.ageMs <= 60_000) ? 'desk-live' : 'desk-warning'}><i />{quoteStatus === 'HEALTHY' && quotes.some((item) => item.freshness === 'LIVE' && item.ageMs !== null && item.ageMs <= 60_000) ? 'FRESH BBO · 15s' : quoteStatus === 'HEALTHY' ? 'STALE BBO' : quoteStatus}</span><span>WAT {watClock}</span><span>UTC {utcClock}</span><span className={healthyProviderCount === totalProviderCount && totalProviderCount > 0 ? 'desk-live' : 'desk-warning'}>DATA HEALTH {healthyProviderCount}/{totalProviderCount}</span><button type="button" onClick={() => void forceSync()} disabled={forceSyncing}>{forceSyncing ? 'SYNCING…' : 'FORCE SYNC'}</button></div>
    </div>
    <div className="desk-quote-grid">{displaySymbols.map((symbol) => {
      const item = quoteFor(symbol); const digits = symbol.slice(3) === 'JPY' ? 3 : symbol === 'XAUUSD' ? 2 : 5;
      return <article className="desk-quote-card" key={symbol}><span>{symbol === satelliteSymbol ? 'SATELLITE #1 · ' + symbol : symbol === 'EURUSD' ? 'CORE #1 · EURUSD' : symbol === 'XAUUSD' ? 'CORE #2 · XAUUSD' : 'CORE #3 · USDJPY'}</span><strong>{display(item?.mid, digits)}</strong><small>{item?.freshness ?? 'PENDING'} · {item?.latencyMs ?? '—'} ms · {activeSession}</small><div><span>BID {display(item?.bid, digits)}</span><span>ASK {display(item?.ask, digits)}</span></div><small>SPREAD {display(item?.spread, symbol === 'XAUUSD' ? 2 : 6)} · {item?.quoteTimeUtc ?? 'NO QUOTE'}</small></article>;
    })}</div>
    <div className="desk-syncline"><span>Swissquote public BBO · {latency ?? '—'} ms</span><span>Retrieved {quoteSync ?? '—'}</span><span>Frankfurter {fxStatus} · {fxSync ?? '—'}</span></div>
    <article className="desk-panel mt-3" aria-label="Live execution signals">
      <header><div><span className="desk-kicker">LIVE EXECUTION SIGNALS</span><h3>Macro-Aligned Intraday Setups</h3></div><small>5M PRICE ACTION · 1D ATR · AUTO REFRESH 60S</small></header>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {intradaySignals.map((signal) => {
          const active = signal.signalState === 'ACTIVE_SETUP';
          const statusClass = active ? 'desk-good' : signal.signalState === 'SHIELD_BLOCKED' ? 'desk-warning' : 'text-slate-400';
          return <div className="rounded border border-white/10 bg-[#0b1017] p-3 min-w-0" key={signal.symbol}>
            <div className="flex items-center justify-between gap-2"><strong className="font-mono text-xs">{signal.symbol}</strong><span className={statusClass + ' text-[10px] font-mono'}>{signal.signalState.replaceAll('_', ' ')}</span></div>
            <div className="mt-3 flex items-baseline justify-between"><b className="text-lg font-mono">{signal.direction}</b><span className="text-xs font-mono">{signal.confluenceScore}/100 confluence score</span></div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400">
              <span>ENTRY <b className="block text-slate-100">{display(signal.entryPrice, signal.symbol === 'XAUUSD' ? 2 : signal.symbol.endsWith('JPY') ? 3 : 5)}</b></span>
              <span>STOP <b className="block text-slate-100">{display(signal.stopLoss, signal.symbol === 'XAUUSD' ? 2 : signal.symbol.endsWith('JPY') ? 3 : 5)}</b></span>
              <span>TP1 <b className="block text-slate-100">{display(signal.takeProfit1, signal.symbol === 'XAUUSD' ? 2 : signal.symbol.endsWith('JPY') ? 3 : 5)}</b></span>
              <span>TP2 <b className="block text-slate-100">{display(signal.takeProfit2, signal.symbol === 'XAUUSD' ? 2 : signal.symbol.endsWith('JPY') ? 3 : 5)}</b></span>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-400">{signal.triggerRationale}</p>
            {signal.blockers.length > 0 && <p className="mt-2 text-[10px] text-amber-300">{signal.blockers.join(' · ')}</p>}
            <p className="mt-1 text-[9px] text-slate-500">Spread baseline: {signal.spreadBaselineStatus ?? 'UNAVAILABLE'} · {signal.spreadBaselineObservations ?? 0}/20 samples</p>
            <p className="mt-3 text-[10px] text-slate-500">Research context only. Your MT5 EA independently validates technical structure and execution.</p>
            {signal.dataAsOfUtc && <small className="mt-2 block text-[9px] text-slate-500">OHLCV {signal.dataAsOfUtc} · {signal.session}</small>}
          </div>;
        })}
        {intradaySignals.length === 0 && <p className="macro-empty col-span-full">Signal service unavailable. No executable levels are published without verified inputs.</p>}
      </div>
      <div className="desk-syncline"><span>Signal refresh {signalSyncUtc ?? 'NOT AVAILABLE'}</span><span>Macro score ≥ +25 BUY / ≤ −25 SELL</span><span>Signals are research-only; MT5 must independently validate spread and execution</span><button type="button" onClick={() => void refreshIntradaySignals()}>REFRESH SIGNALS</button></div>
    </article>
    <div className="desk-grid">
      <article className="desk-panel"><header><div><span className="desk-kicker">A / UNIFIED CURRENCY MATRIX</span><h3>Spot Momentum vs Fundamental Rate Strength</h3></div><small>20-DAY REFERENCE · LIVE MACRO</small></header>
        <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-xs"><thead><tr className="border-b border-white/10 text-left text-[10px] font-mono text-slate-500"><th className="py-2">CCY</th><th className="py-2">SPOT MOMENTUM / 10</th><th className="py-2">MACRO RATE / 100</th><th className="py-2">RELATION</th></tr></thead><tbody>
          {matrixCurrencies.map((currency) => {
            const spot = strength.find((item) => item.currency === currency);
            const macro = macroStrength.find((item) => item.currency === currency);
            const aligned = spot && macro ? (spot.score >= 5 && macro.score > 0) || (spot.score < 5 && macro.score < 0) : null;
            return <tr className="border-b border-white/[0.06]" key={currency}><th className="py-2 text-left font-mono text-slate-200">{currency}</th><td className="py-2 font-mono">{spot ? spot.score.toFixed(2) : '—'}</td><td className={`py-2 font-mono ${macro ? macro.score >= 0 ? 'desk-good' : 'desk-warning' : 'text-slate-500'}`}>{macro ? (macro.score > 0 ? '+' : '') + macro.score : '—'}</td><td className="py-2 font-mono text-[10px]">{aligned === null ? 'INSUFFICIENT INPUTS' : aligned ? 'ALIGNED' : 'DIVERGENCE'}</td></tr>;
          })}
        </tbody></table></div>
        <p className="desk-footnote">Spot momentum is calculated from the latest 20 available Frankfurter business-day reference observations, not executable intraday quotes. Fundamental strength uses fresh provider policy and inflation observations. Divergence flags a disagreement between price trend and rate fundamentals; neither is an entry signal.</p>
      </article>

    </div>
  </section>;
}
