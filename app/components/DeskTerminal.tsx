'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MacroSnapshot } from '@/types/macro';
import type { GoldMacroContext } from '@/lib/macro/goldAndRegimeEngine';
import { getCurrencyStrengthIndex } from '@/lib/currencyStrength';
import type { IntradaySignal } from '@/lib/quant/intradaySignalEngine';
import { getActiveMarketSession, getActiveMarketSessionCloseUtc, getNextMarketSessionOpenUtc, isForexMarketWeekendClosed } from '@/lib/marketSessions';

type Quote = {
  symbol: string; bid: number | null; ask: number | null; mid: number | null;
  spread: number | null; quoteTimeUtc: string | null; retrievedAtUtc: string;
  ageMs: number | null; freshness: 'LIVE' | 'STALE' | 'UNAVAILABLE';
  latencyMs: number | null; source: string; error: string | null;
  executionGrade?: boolean; broker?: string | null; server?: string | null; accountMode?: string | null;
};
type QuoteResponse = {
  generatedAtUtc: string; latencyMs: number; status: string; quotes: Quote[];
  source?: string; executionGrade?: boolean; broker?: string | null; server?: string | null; accountMode?: string | null;
};
type FxRow = { date: string; rates: Record<string, number> };
const symbols: string[] = ['EURUSD', 'XAUUSD', 'USDJPY'];
const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CHF', 'CAD'] as const;
const FX_KEY = 'fidulync-desk-fx-v1';
function durationLabel(ms: number): string {
  const minutes = Math.max(0, Math.ceil(ms / 60_000));
  return Math.floor(minutes / 60) + 'h ' + String(minutes % 60).padStart(2, '0') + 'm';
}
function readStorage<T>(key: string): T | null {
  try { const value = window.localStorage.getItem(key); return value ? JSON.parse(value) as T : null; } catch { return null; }
}
function display(value: number | null | undefined, digits: number) { return value === null || value === undefined || !Number.isFinite(value) ? '—' : value.toFixed(digits); }
function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
function explainBlocker(code: string): string {
  const labels: Record<string, string> = {
    VIX_UNAVAILABLE: 'Volatility reference unavailable',
    VIX_BLACK_SWAN_LOCKOUT: 'Extreme volatility lockout',
    CALENDAR_UNVERIFIED: 'Economic calendar not verified',
    RATE_DECISION_LOCKOUT: 'Central-bank decision window',
    TIER_ONE_EVENT_LOCKOUT: 'High-impact news window',
    OUTSIDE_LONDON_NEW_YORK_WAT_WINDOWS: 'Outside London / New York WAT session',
    SPREAD_BASELINE_UNAVAILABLE: 'Spread reference unavailable',
    SPREAD_BLOWOUT_BLOCK: 'Spread is more than 2× normal',
    LIVE_BBO_UNAVAILABLE_OR_STALE: 'Live bid / ask is stale or unavailable',
    INTRADAY_CANDLES_STALE: 'Intraday candles are stale',
    MACRO_SCORE_BELOW_20_THRESHOLD: 'Gold macro score below threshold',
    MACRO_SCORE_BELOW_25_THRESHOLD: 'FX macro score below threshold',
    KER_BELOW_0_30: 'Price efficiency below 0.30',
    HURST_UNAVAILABLE: 'Trend regime estimate unavailable',
    HURST_NOT_TREND_PERSISTENT: 'Trend persistence not confirmed',
    MEAN_REVERSION_ONLY: 'Mean-reversion regime: trend entry disabled',
    ZSCORE_UNAVAILABLE: '20-period Z-score unavailable',
    ZSCORE_ENTRY_TOO_EXTENDED: 'Price is too extended from its mean',
    WAIT_FOR_STATISTICAL_PULLBACK: 'Wait for the statistical pullback zone',
    ADR_HISTORY_UNAVAILABLE: '14-day average range unavailable',
    ADR_EXHAUSTED_WAIT_PULLBACK: 'Daily range ≥85% of ADR: wait for pullback',
    OHLCV_HISTORY_INSUFFICIENT: 'Price history is insufficient',
  };
  return labels[code] ?? code.toLowerCase().replaceAll('_', ' ');
}

export default function DeskTerminal({ initialSnapshot, initialGoldContext, onSnapshotChange, onGoldContextChange }: { initialSnapshot: MacroSnapshot; initialGoldContext: GoldMacroContext | null; onSnapshotChange: (snapshot: MacroSnapshot) => void; onGoldContextChange: (context: GoldMacroContext | null) => void }) {
  const snapshot = initialSnapshot;
  const [goldContext, setGoldContext] = useState<GoldMacroContext | null>(initialGoldContext);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [satelliteSymbol, setSatelliteSymbol] = useState<string | null>(null);
  const [quoteStatus, setQuoteStatus] = useState('CONNECTING');
  const [latency, setLatency] = useState<number | null>(null);
  const [quoteSync, setQuoteSync] = useState<string | null>(null);
  const [accountReadToken, setAccountReadToken] = useState<string | null>(null);
  const [accountKey, setAccountKey] = useState<string | null>(null);
  const [accountMode, setAccountMode] = useState<string | null>(null);
  const [brokerIdentity, setBrokerIdentity] = useState<string | null>(null);
  const [quoteExecutionGrade, setQuoteExecutionGrade] = useState(false);
  const [signalMarketDataQuality, setSignalMarketDataQuality] = useState('NOT_CONNECTED');
  const [fxRows, setFxRows] = useState<FxRow[]>([]);
  const [fxStatus, setFxStatus] = useState('NOT SYNCED');
  const [fxSync, setFxSync] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.parse(initialSnapshot.asOf) || 0);
  const [ready, setReady] = useState(false);
  const [forceSyncing, setForceSyncing] = useState(false);
  const [quoteSource, setQuoteSource] = useState('UNAVAILABLE');

  const [intradaySignals, setIntradaySignals] = useState<IntradaySignal[]>([]);
  const [signalSyncUtc, setSignalSyncUtc] = useState<string | null>(null);
  const [manualDeskMode, setManualDeskMode] = useState(false);

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
        const response = await fetch('/api/v1/accounts', { cache: 'no-store', headers: accountReadToken ? { Authorization: 'Bearer ' + accountReadToken } : {} });
        if (!accountReadToken || !response.ok) throw new Error('Private MT5 account feed is not connected');
        const payload = await response.json() as { accounts?: Array<{ account_key: string; broker: string | null; server: string; account_mode: string }> };
        const savedKey = window.sessionStorage.getItem('macrolinc-selected-account-key');
        const selected = payload.accounts?.find((item) => item.account_key === savedKey) ?? payload.accounts?.[0];
        if (active) {
          setAccountKey(selected?.account_key ?? null);
          setAccountMode(selected?.account_mode ?? null);
          setBrokerIdentity(selected ? [selected.broker ?? 'MT5', selected.server].filter(Boolean).join(' · ') : null);
        }
      } catch {
        if (active) { setAccountKey(null); setAccountMode(null); setBrokerIdentity(null); }
      }
    };
    if (accountReadToken) void load();
    const timer = window.setInterval(() => { if (accountReadToken) void load(); }, 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [accountReadToken]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const params = new URLSearchParams();
        if (accountKey) params.set('accountKey', accountKey);
        const query = params.size ? '?' + params.toString() : '';
        const response = await fetch('/api/v1/intraday-signals' + query, {
          cache: 'no-store',
          headers: accountReadToken && accountKey ? { Authorization: 'Bearer ' + accountReadToken } : {},
        });
        if (!response.ok) throw new Error('Intraday signal feed unavailable');
        const payload = await response.json() as {
          signals?: IntradaySignal[];
          generatedAtUtc?: string;
          marketDataQuality?: { brokerMarketData?: { status?: string } };
        };
        if (active) {
          setIntradaySignals(Array.isArray(payload.signals) ? payload.signals : []);
          setSignalMarketDataQuality(payload.marketDataQuality?.brokerMarketData?.status ?? 'NOT_CONNECTED');
          setSignalSyncUtc(payload.generatedAtUtc ?? new Date().toISOString());
        }
      } catch {
        if (active) { setIntradaySignals([]); setSignalMarketDataQuality('UNAVAILABLE'); setSignalSyncUtc(null); }
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [accountKey, accountReadToken]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setManualDeskMode(window.localStorage.getItem('fidulync-manual-desk-mode-v1') === 'true');
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const toggleManualDeskMode = (enabled: boolean) => {
    setManualDeskMode(enabled);
    try { window.localStorage.setItem('fidulync-manual-desk-mode-v1', String(enabled)); }
    catch { setManualDeskMode(false); }
  };
  const activeSessionValue = getActiveMarketSession(new Date(now));
  const activeSession = activeSessionValue === 'CLOSED' ? 'OFF-SESSION'
    : activeSessionValue === 'NEW_YORK' ? 'NEW YORK' : 'LONDON';
  const nextSessionOpenUtc = getNextMarketSessionOpenUtc(new Date(now));
  const activeSessionCloseUtc = getActiveMarketSessionCloseUtc(new Date(now), activeSessionValue);
  const isForexWeekendClosed = isForexMarketWeekendClosed(new Date(now));
  const brokerExecutionDataReady = quoteExecutionGrade && signalMarketDataQuality === 'BROKER_LIVE_VERIFIED' && accountMode === 'REAL';
  const globalDeskLockout = activeSession === 'OFF-SESSION' || !brokerExecutionDataReady;
  const coverageProviders = snapshot.providerStatus ?? [];
  const healthyProviderCount = coverageProviders.filter((provider) => provider.status === 'HEALTHY' || provider.status === 'STANDBY').length;
  const totalProviderCount = coverageProviders.length;

  const refreshQuotes = useCallback(async () => {
    if (document.visibilityState === 'hidden') return;
    const params = new URLSearchParams();
    if (accountKey) params.set('accountKey', accountKey);
    if (satelliteSymbol) params.set('satellite', satelliteSymbol);
    const query = params.size ? '?' + params.toString() : '';
    const headers = accountReadToken && accountKey ? { Authorization: 'Bearer ' + accountReadToken } : {};
    const response = await fetch('/api/v1/live-quotes' + query, { cache: 'no-store', headers });
    if (!response.ok) throw new Error(`Live quote proxy HTTP ${response.status}`);
    const payload = await response.json() as QuoteResponse;
    setQuotes(payload.quotes);
    setQuoteSource(payload.source ?? 'UNAVAILABLE');
    setQuoteStatus(payload.status);
    setLatency(payload.latencyMs);
    setQuoteSync(payload.generatedAtUtc);
    setQuoteExecutionGrade(payload.executionGrade === true);
    setAccountMode(payload.accountMode ?? null);
    setBrokerIdentity(payload.broker ? [payload.broker, payload.server].filter(Boolean).join(' · ') : brokerIdentity);
  }, [accountKey, accountReadToken, brokerIdentity, satelliteSymbol]);
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
      const token = window.sessionStorage.getItem('macrolinc-account-read-token');
      if (token) setAccountReadToken(token);
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
      if (goldResult.status === 'fulfilled' && goldResult.value.ok) {
        const freshGold: unknown = await goldResult.value.json();
        if (freshGold && typeof freshGold === 'object'
          && 'overallState' in freshGold && 'drivers' in freshGold) {
          onGoldContextChange(freshGold as GoldMacroContext);
          setGoldContext(freshGold as GoldMacroContext);
        } else {
          onGoldContextChange(null);
          setGoldContext(null);
        }
      } else {
        onGoldContextChange(null);
          setGoldContext(null);
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
  const activeSatelliteSymbol = satelliteSymbol;
  const displaySymbols = activeSatelliteSymbol ? [...symbols, activeSatelliteSymbol] : symbols;
  return <section id="desk-terminal" className="desk-terminal scroll-mt-24" aria-label="Macro and fundamental research terminal">
    <div className="desk-topbar">
      <div><span className="desk-kicker">MACROLYNC / PRIVATE SYSTEMATIC RESEARCH</span><h2>MacroLync Terminal</h2></div>
      <div className="desk-top-meta"><span className={isForexWeekendClosed ? 'desk-warning' : quoteExecutionGrade ? 'desk-live' : 'desk-warning'}><i />{isForexWeekendClosed ? 'MARKET CLOSED (WEEKEND)' : quoteExecutionGrade ? 'BROKER-VERIFIED MT5 QUOTES' : accountMode === 'DEMO' ? 'DEMO MT5 DATA · NOT EXECUTION-GRADE' : quoteStatus === 'HEALTHY' ? 'PUBLIC REFERENCE BBO · NOT BROKER' : 'BROKER FEED UNAVAILABLE'}</span><span>WAT {watClock}</span><span>UTC {utcClock}</span><span className={healthyProviderCount === totalProviderCount && totalProviderCount > 0 ? 'desk-live' : 'desk-warning'}>DATA HEALTH {healthyProviderCount}/{totalProviderCount}</span><button type="button" onClick={() => void forceSync()} disabled={forceSyncing}>{forceSyncing ? 'SYNCING…' : 'FORCE SYNC'}</button></div>
    </div>
    <section className="mb-3 rounded-lg border border-red-500/30 bg-[#11151d] p-3 sm:p-4" aria-label="Desk command banner">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="desk-kicker">EXECUTIVE DESK COMMAND · AFRICA/LAGOS</span>
            <h3 className={`mt-1 text-sm font-semibold tracking-wide ${globalDeskLockout ? 'text-red-300' : 'text-amber-300'}`}>
              {activeSession === 'OFF-SESSION' ? 'STAND DOWN · OFF-SESSION LOCKOUT'
                : !brokerExecutionDataReady ? 'STAND DOWN · REAL MT5 MARKET DATA NOT VERIFIED'
                  : 'BROKER MARKET DATA VERIFIED · RESEARCH ONLY · NO EXECUTION AUTHORITY'}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded border px-2 py-1 text-[10px] font-mono ${brokerExecutionDataReady ? 'border-emerald-400/40 text-emerald-200' : 'border-red-400/40 text-red-200'}`}>
              {brokerExecutionDataReady ? 'REAL MT5 ACCOUNT + QUOTES + CANDLES VERIFIED' : 'BROKER GOVERNANCE / MARKET DATA NOT VERIFIED'}
            </span>
            <label className="flex items-center gap-2 rounded border border-white/15 px-3 py-2 text-xs text-slate-100">
              <input type="checkbox" checked={manualDeskMode} onChange={(event) => toggleManualDeskMode(event.target.checked)} />
              Manual Review Mode · no execution authority
            </label>
            <a href="/accounts" className="rounded border border-cyan-400/40 px-3 py-2 text-xs text-cyan-200 hover:bg-cyan-400/10">LINK MT5 ACCOUNT</a>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 border-t border-white/10 pt-3 sm:grid-cols-3">
          <div><span className="desk-kicker">ACTIVE WAT SESSION</span><strong className="mt-1 block text-sm text-slate-100">{activeSession === 'OFF-SESSION' ? 'OFF-SESSION' : activeSession + ' SESSION'}</strong><small className="text-slate-400">{activeSession === 'OFF-SESSION' ? 'Next session opens in ' + durationLabel(nextSessionOpenUtc - now) : 'Session closes in ' + durationLabel(activeSessionCloseUtc - now)}</small></div>
          <div><span className="desk-kicker">BROKER DATA STATUS</span><strong className="mt-1 block text-sm text-slate-100">{brokerExecutionDataReady ? 'VERIFIED REAL ACCOUNT FEED' : accountMode === 'DEMO' ? 'DEMO ONLY · NOT EXECUTION-GRADE' : 'NOT CONNECTED / NOT VERIFIED'}</strong><small className="text-slate-400">{brokerIdentity ?? 'No linked real MT5 account'}</small></div>
          <div><span className="desk-kicker">MANUAL REVIEW STATUS</span><strong className="mt-1 block text-sm text-slate-100">{manualDeskMode ? 'ON · HUMAN REVIEW ONLY' : 'OFF'}</strong><small className="text-slate-400">Does not change server lockouts or EA permissions</small></div>
        </div>
        <p className="text-xs text-slate-400">Manual Review Mode is a display/research state only. Account balances and trade history come from the linked broker account workspace. No manual journal, risk calculator, lot-size estimate or daily trade quota is used here.</p>
      </div>
    </section>
    <div className="desk-quote-grid">{displaySymbols.map((symbol) => {
      const item = quoteFor(symbol); const digits = symbol.slice(3) === 'JPY' ? 3 : symbol === 'XAUUSD' ? 2 : 5;
      return <article className="desk-quote-card" key={symbol}><span>{symbol === activeSatelliteSymbol ? 'SATELLITE #1 · ' + symbol : symbol === 'EURUSD' ? 'CORE #1 · EURUSD' : symbol === 'XAUUSD' ? 'CORE #2 · XAUUSD' : 'CORE #3 · USDJPY'}</span><strong>{display(item?.mid, digits)}</strong><small>{item?.freshness ?? 'PENDING'} · {item?.latencyMs ?? '—'} ms · {activeSession}</small><div><span>BID {display(item?.bid, digits)}</span><span>ASK {display(item?.ask, digits)}</span></div><small>SPREAD {display(item?.spread, symbol === 'XAUUSD' ? 2 : 6)} · {item?.quoteTimeUtc ?? 'NO QUOTE'}</small></article>;
    })}</div>
    <div className="desk-syncline"><span>{quoteSource} · {latency ?? '—'} ms</span><span>Retrieved {quoteSync ?? '—'}</span><span>Frankfurter DAILY REFERENCE · NOT LIVE · {fxStatus} · {fxSync ?? '—'}</span></div>
    <article className="desk-panel mt-3" aria-label="Live execution signals">
      <header><div><span className="desk-kicker">INTRADAY RESEARCH · NO EXECUTION AUTHORITY</span><h3>Macro-Aligned Intraday Setups</h3></div><small>{signalMarketDataQuality === 'BROKER_LIVE_VERIFIED' ? 'AUTHENTICATED REAL MT5 QUOTES + MT5 M5/D1 CANDLES' : 'YAHOO OHLCV + SWISSQUOTE PUBLIC BBO · REFERENCE ONLY'}</small></header>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {intradaySignals.map((signal) => {
          const active = signal.signalState === 'ACTIVE_SETUP';
          const statusClass = active ? 'desk-good' : signal.signalState === 'SHIELD_BLOCKED' ? 'desk-warning' : 'text-slate-400';
          return <div className="rounded border border-white/10 bg-[#0b1017] p-3 min-w-0" key={signal.symbol}>
            <div className="flex items-center justify-between gap-2"><strong className="font-mono text-xs">{signal.symbol}</strong><span className={statusClass + ' text-[10px] font-mono'}>{signal.signalState.replaceAll('_', ' ')}</span></div>
            <div className="mt-3 flex items-baseline justify-between"><b className="text-lg font-mono">{signal.direction}</b><span className="text-xs font-mono">{signal.confluenceScore}/100 confluence score · not a win-rate estimate</span></div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400">
              <span>ENTRY <b className="block text-slate-100">{display(signal.entryPrice, signal.symbol === 'XAUUSD' ? 2 : signal.symbol.endsWith('JPY') ? 3 : 5)}</b></span>
              <span>STOP <b className="block text-slate-100">{display(signal.stopLoss, signal.symbol === 'XAUUSD' ? 2 : signal.symbol.endsWith('JPY') ? 3 : 5)}</b></span>
              <span>TP1 <b className="block text-slate-100">{display(signal.takeProfit1, signal.symbol === 'XAUUSD' ? 2 : signal.symbol.endsWith('JPY') ? 3 : 5)}</b></span>
              <span>TP2 <b className="block text-slate-100">{display(signal.takeProfit2, signal.symbol === 'XAUUSD' ? 2 : signal.symbol.endsWith('JPY') ? 3 : 5)}</b></span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1 text-[9px]">
              <span className="rounded bg-white/5 px-2 py-1">CANDLES: {signal.candleDataSource}</span>
              <span className="rounded bg-white/5 px-2 py-1">QUOTE: {signal.quoteDataSource}</span>
              <span className="rounded bg-white/5 px-2 py-1">EXECUTION DATA: {signal.executionDataVerified ? 'BROKER VERIFIED' : 'NOT VERIFIED'}</span>
              <span className="rounded bg-white/5 px-2 py-1">Macro: {signal.direction === 'NONE' ? 'Not aligned' : 'Aligned'}</span>
              <span className="rounded bg-white/5 px-2 py-1">Z: {display(signal.zScore, 2)} · {signal.zScoreZone.replaceAll('_', ' ')}</span>
              <span className="rounded bg-white/5 px-2 py-1">H: {display(signal.hurst, 2)} · {signal.hurstRegime.replaceAll('_', ' ')}</span>
              <span className="rounded bg-white/5 px-2 py-1">KER: {display(signal.ker, 2)}</span>
              <span className="rounded bg-white/5 px-2 py-1">ADR Used: {display(signal.adrUsedPct, 0)}%</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1 text-[9px] font-mono text-slate-400">
              <span>PDH <b className="text-slate-100">{display(signal.pdh, signal.symbol === 'XAUUSD' ? 2 : signal.symbol.endsWith('JPY') ? 3 : 5)}</b></span>
              <span>PDL <b className="text-slate-100">{display(signal.pdl, signal.symbol === 'XAUUSD' ? 2 : signal.symbol.endsWith('JPY') ? 3 : 5)}</b></span>
              <span>ASIAN HIGH <b className="text-slate-100">{display(signal.asianRangeHigh, signal.symbol === 'XAUUSD' ? 2 : signal.symbol.endsWith('JPY') ? 3 : 5)}</b></span>
              <span>ASIAN LOW <b className="text-slate-100">{display(signal.asianRangeLow, signal.symbol === 'XAUUSD' ? 2 : signal.symbol.endsWith('JPY') ? 3 : 5)}</b></span>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-400">{signal.triggerRationale}</p>
             <p className="mt-1 text-[9px] font-mono text-slate-500">SOVEREIGN SHIELD {signal.sovereignShieldStatus ?? 'UNAVAILABLE'} · MARKET RISK CEILING {signal.marketRiskCeilingPct?.toFixed(2) ?? '—'}%</p>
             {signal.marketShieldFlags && signal.marketShieldFlags.length > 0 && <p className="mt-1 text-[9px] text-amber-300">SHIELD FLAGS {signal.marketShieldFlags.map(explainBlocker).join(' · ')}</p>}
            {signal.blockers.length > 0 && <p className="mt-2 text-[10px] text-amber-300">{signal.blockers.map(explainBlocker).join(' · ')}</p>}
            <p className="mt-1 text-[9px] text-slate-500">Spread guard: {signal.spreadBaselineStatus === 'AVAILABLE' ? 'OBSERVED SESSION MEDIAN' : 'LIVE BASELINE UNAVAILABLE'} · {signal.spreadBaselineObservations ?? 0} observed samples</p>
            <p className="mt-3 text-[10px] text-slate-500">Research context only. Your MT5 EA independently validates technical structure and execution.</p>
            {signal.dataAsOfUtc && <small className="mt-2 block text-[9px] text-slate-500">OHLCV {signal.dataAsOfUtc} · {signal.session}</small>}
          </div>;
        })}
        {intradaySignals.length === 0 && <p className="macro-empty col-span-full">Signal service unavailable. No executable levels are published without verified inputs.</p>}
      </div>
      <div className="desk-syncline"><span>Signal refresh {signalSyncUtc ?? 'NOT AVAILABLE'}</span><span>FX ±25 · XAUUSD ±20 directional threshold</span><span>Signals are research-only; MT5 must independently validate spread and execution</span><button type="button" onClick={() => void refreshIntradaySignals()}>REFRESH SIGNALS</button></div>
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
