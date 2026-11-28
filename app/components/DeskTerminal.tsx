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
const symbols: string[] = ['EURUSD', 'XAUUSD', 'USDJPY'];
const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CHF', 'CAD'] as const;
const FX_KEY = 'fidulync-desk-fx-v1';
function zonedDecimalHour(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  return Number(parts.find((p) => p.type === 'hour')?.value ?? 0) + Number(parts.find((p) => p.type === 'minute')?.value ?? 0) / 60;
}
function nextWATSessionOpen(nowMs: number): number {
  const shifted = new Date(nowMs + 60 * 60_000);
  const year = shifted.getUTCFullYear(), month = shifted.getUTCMonth(), day = shifted.getUTCDate();
  const minuteOfDay = shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
  const targetDay = new Date(Date.UTC(year, month, day));
  let targetHour = minuteOfDay < 8 * 60 ? 8 : minuteOfDay < 13 * 60 ? 13 : 8;
  if (minuteOfDay >= 17 * 60) targetDay.setUTCDate(targetDay.getUTCDate() + 1);
  while (targetDay.getUTCDay() === 0 || targetDay.getUTCDay() === 6) { targetDay.setUTCDate(targetDay.getUTCDate() + 1); targetHour = 8; }
  return Date.UTC(targetDay.getUTCFullYear(), targetDay.getUTCMonth(), targetDay.getUTCDate(), targetHour - 1, 0, 0);
}
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
  const [fxRows, setFxRows] = useState<FxRow[]>([]);
  const [fxStatus, setFxStatus] = useState('NOT SYNCED');
  const [fxSync, setFxSync] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.parse(initialSnapshot.asOf) || 0);
  const [ready, setReady] = useState(false);
  const [forceSyncing, setForceSyncing] = useState(false);
  const [ticketSymbol, setTicketSymbol] = useState<'EURUSD' | 'USDJPY' | 'XAUUSD'>('EURUSD');
  const [ticketBalance, setTicketBalance] = useState<number | null>(null);
  const [ticketBalanceInput, setTicketBalanceInput] = useState('');
  const [balanceSaveMessage, setBalanceSaveMessage] = useState<string | null>(null);
  const [balanceHydrated, setBalanceHydrated] = useState(false);
  const [manualClosedTradesPnl, setManualClosedTradesPnl] = useState<number | null>(null);
  const [ledgerPnlHydrated, setLedgerPnlHydrated] = useState(false);

  const [intradaySignals, setIntradaySignals] = useState<IntradaySignal[]>([]);
  const [signalSyncUtc, setSignalSyncUtc] = useState<string | null>(null);
  const [manualDeskMode, setManualDeskMode] = useState(false);
  const [manualLedger, setManualLedger] = useState<{ date: string; trades: number; losses: number; legs: string[] }>({ date: '', trades: 0, losses: 0, legs: [] });

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
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      try {
        const savedMode = window.localStorage.getItem('fidulync-manual-desk-mode-v1') === 'true';
        const raw = window.localStorage.getItem('fidulync-manual-desk-ledger-v1');
        const saved = raw ? JSON.parse(raw) as { date?: string; trades?: number; losses?: number; legs?: string[] } : null;
        setManualDeskMode(savedMode);
        setManualLedger(saved?.date === today ? { date: today, trades: Math.min(2, Math.max(0, saved.trades ?? 0)), losses: Math.min(2, Math.max(0, saved.losses ?? 0)), legs: Array.isArray(saved.legs) ? saved.legs : [] } : { date: today, trades: 0, losses: 0, legs: [] });
      } catch { setManualDeskMode(false); setManualLedger({ date: today, trades: 0, losses: 0, legs: [] }); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const saveManualLedger = (next: typeof manualLedger) => {
    setManualLedger(next);
    try { window.localStorage.setItem('fidulync-manual-desk-ledger-v1', JSON.stringify(next)); } catch { setManualDeskMode(false); }
  };
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem('macrolinc-manual-account-balance-v1');
        const saved = raw ? JSON.parse(raw) as { balance?: number } : null;
        if (saved && typeof saved.balance === 'number' && Number.isFinite(saved.balance) && saved.balance > 0) {
          setTicketBalance(saved.balance);
          setTicketBalanceInput(String(saved.balance));
        }
      } catch {
        setTicketBalance(null);
        setTicketBalanceInput('');
      } finally {
        setBalanceHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem('fidulync-manual-trades-history-v1');
        if (!raw) {
          setManualClosedTradesPnl(0);
        } else {
          const trades = JSON.parse(raw) as Array<{ profit?: number }>;
          if (!Array.isArray(trades) || trades.some((trade) => typeof trade.profit !== 'number' || !Number.isFinite(trade.profit))) {
            setManualClosedTradesPnl(null);
          } else {
            setManualClosedTradesPnl(trades.reduce((sum, trade) => sum + (trade.profit ?? 0), 0));
          }
        }
      } catch {
        setManualClosedTradesPnl(null);
      } finally {
        setLedgerPnlHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const currentManualEquity = balanceHydrated && ledgerPnlHydrated && manualDeskMode
    && ticketBalance !== null && manualClosedTradesPnl !== null
    ? ticketBalance + manualClosedTradesPnl : null;
  const saveTicketBalance = () => {
    const value = Number(ticketBalanceInput);
    if (!manualDeskMode) {
      setBalanceSaveMessage('Enable Verified Manual Desk Mode before saving a manually attested balance.');
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      setTicketBalance(null);
      setBalanceSaveMessage('Enter a valid positive account balance.');
      return;
    }
    try {
      window.localStorage.setItem('macrolinc-manual-account-balance-v1', JSON.stringify({ balance: value, currency: 'USD', savedAtUtc: new Date().toISOString(), source: 'USER_ATTESTED_MANUAL' }));
      setTicketBalance(value);
      setBalanceSaveMessage('User-attested manual balance saved in this browser.');
    } catch {
      setTicketBalance(null);
      setBalanceSaveMessage('Browser storage unavailable. Balance remains unverified.');
    }
  };
  const balanceVerified = balanceHydrated && ledgerPnlHydrated && manualDeskMode && ticketBalance !== null && Number.isFinite(ticketBalance) && ticketBalance > 0 && manualClosedTradesPnl !== null && currentManualEquity !== null && currentManualEquity > 0;

  const toggleManualDeskMode = (enabled: boolean) => {
    setManualDeskMode(enabled);
    try { window.localStorage.setItem('fidulync-manual-desk-mode-v1', String(enabled)); } catch { setManualDeskMode(false); }
  };
  const hourWAT = zonedDecimalHour(new Date(now), 'Africa/Lagos');
  const watDay = new Date(now + 60 * 60_000).getUTCDay();
  const isWeekdayWAT = watDay >= 1 && watDay <= 5;
  const activeSession = !isWeekdayWAT ? 'OFF-SESSION' : hourWAT >= 8 && hourWAT < 12 ? 'LONDON' : hourWAT >= 13 && hourWAT < 17 ? 'NEW YORK' : 'OFF-SESSION';
  const isForexWeekendClosed = (() => {
    const utcDay = new Date(now).getUTCDay();
    const utcHour = new Date(now).getUTCHours();
    return (utcDay === 5 && utcHour >= 22) || utcDay === 6 || (utcDay === 0 && utcHour < 22);
  })();
  const globalDeskLockout = activeSession === 'OFF-SESSION' || !balanceVerified || (manualDeskMode && (manualLedger.trades >= 2 || manualLedger.losses >= 2));
  const coverageProviders = snapshot.providerStatus ?? [];
  const healthyProviderCount = coverageProviders.filter((provider) => provider.status === 'HEALTHY' || provider.status === 'STANDBY').length;
  const totalProviderCount = coverageProviders.length;

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
  const activeSatelliteSymbol = satelliteSymbol ?? 'GBPUSD';
  const displaySymbols = [...symbols, activeSatelliteSymbol];
  return <section id="desk-terminal" className="desk-terminal scroll-mt-24" aria-label="Macro and fundamental research terminal">
    <div className="desk-topbar">
      <div><span className="desk-kicker">MACROLYNC / PRIVATE SYSTEMATIC RESEARCH</span><h2>MacroLync Terminal</h2></div>
      <div className="desk-top-meta"><span className={isForexWeekendClosed ? 'desk-warning' : quoteStatus === 'HEALTHY' && quotes.some((item) => item.freshness === 'LIVE' && item.ageMs !== null && item.ageMs <= 60_000) ? 'desk-live' : 'desk-warning'}><i />{isForexWeekendClosed ? 'MARKET CLOSED (WEEKEND)' : quoteStatus === 'HEALTHY' && quotes.some((item) => item.freshness === 'LIVE' && item.ageMs !== null && item.ageMs <= 60_000) ? 'FRESH BBO · 15s' : quoteStatus === 'HEALTHY' ? 'STALE BBO' : 'FEED UNAVAILABLE'}</span><span>WAT {watClock}</span><span>UTC {utcClock}</span><span className={healthyProviderCount === totalProviderCount && totalProviderCount > 0 ? 'desk-live' : 'desk-warning'}>DATA HEALTH {healthyProviderCount}/{totalProviderCount}</span><button type="button" onClick={() => void forceSync()} disabled={forceSyncing}>{forceSyncing ? 'SYNCING…' : 'FORCE SYNC'}</button></div>
    </div>
        {/* 1. Mobile-First "3-Number Execution Ticket" (Zero-Ambiguity Top Command Bar) */}
    <section className="mb-4 rounded-xl border border-teal-500/40 bg-[#070d14] p-4 text-xs font-mono shadow-lg" aria-label="3-Number Execution Ticket">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-teal-900/40 pb-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-teal-400 animate-pulse" />
            <h3 className="text-sm font-extrabold tracking-wider text-white uppercase">
              3-Number Execution Ticket · Institutional Command Bar
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className={`px-2.5 py-1 rounded font-bold border ${activeSession === 'LONDON' || activeSession === 'NEW YORK'  ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300' : 'bg-rose-950/80 border-rose-700 text-rose-300'}`}>
              WAT SESSION: {activeSession === 'LONDON' ? 'LONDON 08:00–12:00 WAT' : (activeSession === 'NEW YORK' ) ? 'NEW YORK 13:00–17:00 WAT' : 'OFF-SESSION LOCKOUT'}
            </span>
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-slate-300">
              <span>BAL:</span>
              {balanceVerified ? <strong className="text-emerald-300">{ticketBalance?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> : <strong className="text-amber-300">NOT SET (ENTER REAL BALANCE)</strong>}
              <span>USD</span>
            </div>
          </div>
        </div>

        {/* 1. Allowed Desk Universe & Approved Direction Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {[
            {
              sym: 'EURUSD' as const,
              name: 'EUR/USD Primary Core',
              dir: globalDeskLockout ? 'STAND DOWN' : (intradaySignals.find((s) => s.symbol === 'EURUSD')?.direction === 'SELL' ? 'SELL ONLY' : intradaySignals.find((s) => s.symbol === 'EURUSD')?.direction === 'BUY' ? 'BUY ONLY' : 'STAND DOWN'),
              cls: intradaySignals.find((s) => s.symbol === 'EURUSD')?.direction === 'SELL' ? 'text-amber-300 border-amber-600/50 bg-amber-950/20' : intradaySignals.find((s) => s.symbol === 'EURUSD')?.direction === 'BUY' ? 'text-emerald-300 border-emerald-600/50 bg-emerald-950/20' : 'text-slate-400 border-slate-800 bg-slate-950/40',
            },
            {
              sym: 'USDJPY' as const,
              name: 'USD/JPY Primary Core',
              dir: globalDeskLockout ? 'STAND DOWN' : (intradaySignals.find((s) => s.symbol === 'USDJPY')?.direction === 'BUY' ? 'BUY ONLY' : intradaySignals.find((s) => s.symbol === 'USDJPY')?.direction === 'SELL' ? 'SELL ONLY' : 'STAND DOWN'),
              cls: intradaySignals.find((s) => s.symbol === 'USDJPY')?.direction === 'BUY' ? 'text-emerald-300 border-emerald-600/50 bg-emerald-950/20' : intradaySignals.find((s) => s.symbol === 'USDJPY')?.direction === 'SELL' ? 'text-amber-300 border-amber-600/50 bg-amber-950/20' : 'text-slate-400 border-slate-800 bg-slate-950/40',
            },
            {
              sym: 'XAUUSD' as const,
              name: 'XAU/USD Macro-Hedge',
              dir: globalDeskLockout ? 'STAND DOWN' : (intradaySignals.find((s) => s.symbol === 'XAUUSD')?.direction === 'BUY' ? 'BUY ONLY (HALF-RISK HEDGE)' : intradaySignals.find((s) => s.symbol === 'XAUUSD')?.direction === 'SELL' ? 'SELL ONLY (HALF-RISK HEDGE)' : 'HALF-RISK HEDGE / GATED'),
              cls: 'text-amber-200 border-amber-500/50 bg-amber-950/20',
            },
          ].map((item) => (
            <button
              key={item.sym}
              type="button"
              onClick={() => setTicketSymbol(item.sym)}
              className={`p-2.5 rounded-lg border text-left transition flex items-center justify-between ${ticketSymbol === item.sym ? 'ring-2 ring-teal-400 ' + item.cls : item.cls + ' opacity-80 hover:opacity-100'}`}
            >
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">{item.name}</div>
                <div className="text-xs font-extrabold mt-0.5">{item.sym === 'EURUSD' ? `EUR/USD: ${item.dir}` : item.sym === 'USDJPY' ? `USD/JPY: ${item.dir}` : `XAU/USD: ${item.dir}`}</div>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${ticketSymbol === item.sym ? 'bg-teal-400 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>
                {ticketSymbol === item.sym ? 'ACTIVE' : 'SELECT'}
              </span>
            </button>
          ))}
        </div>

        {/* Selected Instrument: 2. Exact Lot Size & 3. Invalidation & Targets Grid */}
        {(() => {
          const selectedSig = intradaySignals.find((s) => s.symbol === ticketSymbol);
          const digits = ticketSymbol === 'USDJPY' ? 3 : ticketSymbol === 'XAUUSD' ? 2 : 5;
          const liveAsk = quoteFor(ticketSymbol)?.ask ?? null;
          const isVixHigh = goldContext?.drivers.VIXCLS.state === 'HEALTHY' && (goldContext.drivers.VIXCLS.value ?? 0) >= 25;
          const isVixLockout = goldContext?.drivers.VIXCLS.state === 'HEALTHY' && (goldContext.drivers.VIXCLS.value ?? 0) >= 32;
          const isCircuitBreaker = manualDeskMode && (manualLedger.trades >= 2 || manualLedger.losses >= 2);
          const stopDistancePips = selectedSig?.slPips
            ?? (selectedSig?.entryPrice != null && selectedSig?.stopLoss != null
              ? Math.abs(selectedSig.entryPrice - selectedSig.stopLoss) * (ticketSymbol === 'USDJPY' ? 100 : ticketSymbol === 'XAUUSD' ? 10 : 10_000)
              : null);
          const isSizingEvidenceComplete = balanceVerified && !globalDeskLockout && !isVixLockout
            && liveAsk !== null && liveAsk > 0 && stopDistancePips !== null && stopDistancePips > 0
            && ticketSymbol !== 'XAUUSD';

          let riskCap = globalDeskLockout || isVixLockout ? 0.0 : isVixHigh ? 0.5 : 1.0;
          if (ticketSymbol === 'XAUUSD') riskCap = Math.min(riskCap, 0.5);
          if (!isSizingEvidenceComplete) riskCap = 0;

          const dollarRisk = balanceVerified && currentManualEquity !== null && riskCap > 0 ? currentManualEquity * (riskCap / 100) : 0;
          let calculatedLots = 0.00;
          if (isSizingEvidenceComplete && riskCap > 0 && stopDistancePips !== null) {
            const pipValueUsd = ticketSymbol === 'USDJPY' ? 1000 / liveAsk! : 10;
            calculatedLots = Math.floor((dollarRisk / (stopDistancePips * pipValueUsd)) * 100) / 100;
          }

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
              {/* Number 2: Exact 0.01-Rounded Lot Size */}
              <div className="p-3 rounded-lg border border-teal-500/30 bg-[#09111c] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-teal-400 uppercase font-bold tracking-wider">
                      2. EXACT 0.01-ROUNDED LOT SIZE
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${riskCap > 0 ? 'bg-teal-950 border border-teal-700 text-teal-300' : 'bg-rose-950 text-rose-300'}`}>
                      {riskCap > 0 && isSizingEvidenceComplete ? `${riskCap.toFixed(1)}% RISK CAP` : '0.0% LOCKOUT'}
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-white">
                      {calculatedLots > 0 ? calculatedLots.toFixed(2) : '0.00'}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">Standard Lots</span>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex flex-wrap justify-between gap-1">
                  <span>Dollar Risk: <strong className="text-slate-200">${dollarRisk.toFixed(2)}</strong></span>
                  <span>Stop: <strong className="text-slate-200">{stopDistancePips === null ? '—' : stopDistancePips.toFixed(1) + ' pips'}</strong></span>
                  {ticketSymbol === 'USDJPY' && <span>Pip Val: <strong className="text-slate-200">{liveAsk !== null && liveAsk > 0 ? '$' + (1000 / liveAsk).toFixed(2) : 'UNAVAILABLE'}</strong></span>}
                  {!balanceVerified && <span className="w-full text-amber-300">ENTER REAL ACCOUNT BALANCE TO COMPUTE LOTS</span>}
                  {ticketSymbol === 'XAUUSD' && <span className="w-full text-amber-300">LOT SIZING LOCKED · BROKER CONTRACT SPECIFICATION REQUIRED</span>}
                  {balanceVerified && !isSizingEvidenceComplete && ticketSymbol !== 'XAUUSD' && <span className="w-full text-amber-300">LOT SIZING LOCKED · LIVE PRICE / VALID STOP UNAVAILABLE</span>}
                </div>
              </div>

              {/* Number 3: Exact Invalidation & Targets */}
              <div className="p-3 rounded-lg border border-slate-800 bg-[#09111c] space-y-2">
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider border-b border-slate-800 pb-1">
                  3. EXACT INVALIDATION &amp; TARGETS ({ticketSymbol})
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div>
                    <span className="text-[10px] text-slate-500 block">ENTRY ZONE</span>
                    <strong className="text-white block font-mono">
                      {selectedSig?.entryPrice ? display(selectedSig.entryPrice, digits) : 'AWAITING SETUP'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">STOP (1.35x ATR)</span>
                    <strong className="text-rose-400 block font-mono">
                      {selectedSig?.stopLoss ? display(selectedSig.stopLoss, digits) : '—'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">TP1 (2.0R)</span>
                    <strong className="text-emerald-400 block font-mono">
                      {selectedSig?.takeProfit1 ? display(selectedSig.takeProfit1, digits) : '—'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">TP2 (3.0R)</span>
                    <strong className="text-emerald-300 block font-mono">
                      {selectedSig?.takeProfit2 ? display(selectedSig.takeProfit2, digits) : '—'}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </section>

    <section className={`mb-3 rounded-lg border p-3 sm:p-4 ${manualDeskMode ? 'border-amber-400/40 bg-[#17170f]' : 'border-red-500/40 bg-[#1b1114]'}`} aria-label="Desk command banner">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><span className="desk-kicker">EXECUTIVE DESK COMMAND · AFRICA/LAGOS</span><h3 className={`mt-1 text-sm font-semibold tracking-wide ${!globalDeskLockout ? 'text-amber-300' : 'text-red-300'}`}>{!balanceVerified ? 'STAND DOWN · BALANCE NOT VERIFIED (0.0% RISK)' : activeSession === 'OFF-SESSION' ? 'STAND DOWN · OFF-SESSION LOCKOUT (0.0% RISK)' : manualLedger.trades >= 2 || manualLedger.losses >= 2 ? 'STAND DOWN · DAILY CIRCUIT BREAKER (0.0% RISK)' : 'MANUAL DESK · REVIEW ONLY'}</h3></div>
          <div className="flex flex-wrap items-center gap-2">{!manualDeskMode && <span className="rounded border border-red-400/40 px-2 py-1 text-[10px] font-mono text-red-200">ACCOUNT GOVERNANCE UNVERIFIED</span>}<label className="flex items-center gap-2 rounded border border-white/15 px-3 py-2 text-xs text-slate-100"><input type="checkbox" checked={manualDeskMode} onChange={(event) => toggleManualDeskMode(event.target.checked)} /> Manual Desk Mode (Browser Ledger Verified)</label></div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
          <label className="text-xs text-slate-300" htmlFor="manual-account-balance">Real starting balance (USD)</label>
          <input id="manual-account-balance" type="number" min="0.01" step="0.01" value={ticketBalanceInput} onChange={(event) => setTicketBalanceInput(event.target.value)} placeholder="Enter real $" className="w-36 rounded border border-white/15 bg-slate-950 px-3 py-2 text-xs text-white" />
          <button type="button" onClick={saveTicketBalance} disabled={!manualDeskMode || !ticketBalanceInput.trim()} className="rounded border border-amber-400/40 px-3 py-2 text-xs text-amber-200 disabled:opacity-40">SAVE &amp; LOCK REAL BALANCE</button>
          <span className="text-[10px] text-slate-400">{balanceVerified ? 'USER-ATTESTED · BROWSER LOCAL' : 'BALANCE NOT VERIFIED'}</span>
          {balanceSaveMessage && <span role="status" className="text-[10px] text-amber-200">{balanceSaveMessage}</span>}
        </div>
        <p className="text-xs text-slate-300">{manualDeskMode ? 'Manual mode uses this browser’s local ledger and a user-attested balance; it is not an authenticated MT5 account statement and does not authorize automated EA calls.' : 'No authenticated MT5 account ledger is connected. Enable Verified Manual Desk Mode and save your actual starting balance, or connect the read-only MT5 account publisher.'}</p>
        <div className="grid grid-cols-1 gap-3 border-t border-white/10 pt-3 sm:grid-cols-4">
          <div><span className="desk-kicker">ACTIVE WAT SESSION</span><strong className="mt-1 block text-sm text-slate-100">{activeSession === 'OFF-SESSION' ? 'OFF-SESSION DEAD ZONE' : activeSession + ' EXECUTION'}</strong><small className="text-slate-400">{activeSession === 'OFF-SESSION' ? 'Next session opens in ' + durationLabel(nextWATSessionOpen(now) - now) : 'Session closes in ' + durationLabel((activeSession === 'LONDON' ? 12 : 17) * 60 * 60_000 - (hourWAT * 60 * 60_000))}</small></div>
          <div><span className="desk-kicker">TODAY’S APPROVED PLAYBOOK</span><strong className="mt-1 block text-sm text-slate-100">{manualDeskMode && activeSession !== 'OFF-SESSION' ? 'MANUAL REVIEW PERMITTED' : 'NO EXECUTION CLEARED'}</strong><small className="text-slate-400">{intradaySignals.filter((item) => item.signalState === 'ACTIVE_SETUP').length ? intradaySignals.filter((item) => item.signalState === 'ACTIVE_SETUP').map((item) => item.direction + ' ' + item.symbol).join(' · ') : 'Wait for a fully validated macro-aligned setup'}</small></div>
          <div><span className="desk-kicker">DAILY RISK BUDGET · WAT</span><strong className="mt-1 block text-sm text-slate-100">Trades: {manualDeskMode ? manualLedger.trades + '/2' : 'UNVERIFIED'} · Losses: {manualDeskMode ? manualLedger.losses + '/2' : 'UNVERIFIED'}</strong><small className="text-slate-400">Locked currency legs: {manualDeskMode ? manualLedger.legs.join(', ') || 'None' : 'UNVERIFIED'}</small></div>
          <div><span className="desk-kicker">CURRENT MANUAL EQUITY</span><strong className="mt-1 block text-sm text-slate-100">{currentManualEquity === null ? 'NOT VERIFIED' : currentManualEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USD'}</strong><small className="text-slate-400">Starting balance + recorded closed-trade net P&amp;L</small></div>
        </div>
        {manualDeskMode && <div className="flex flex-wrap gap-2 text-xs"><button type="button" disabled={manualLedger.trades >= 2} onClick={() => saveManualLedger({ ...manualLedger, trades: manualLedger.trades + 1 })} className="rounded border border-white/20 px-3 py-2 disabled:opacity-40">LOG TRADE</button><button type="button" disabled={manualLedger.losses >= 2} onClick={() => saveManualLedger({ ...manualLedger, losses: manualLedger.losses + 1 })} className="rounded border border-white/20 px-3 py-2 disabled:opacity-40">LOG LOSS</button>{['USD','EUR','GBP','JPY','AUD','CHF','CAD'].map((leg) => <button key={leg} type="button" disabled={manualLedger.legs.includes(leg)} onClick={() => saveManualLedger({ ...manualLedger, legs: [...manualLedger.legs, leg] })} className="rounded border border-white/20 px-2 py-2 disabled:opacity-40">LOCK {leg}</button>)}</div>}
      </div>
    </section>
    <div className="desk-quote-grid">{displaySymbols.map((symbol) => {
      const item = quoteFor(symbol); const digits = symbol.slice(3) === 'JPY' ? 3 : symbol === 'XAUUSD' ? 2 : 5;
      return <article className="desk-quote-card" key={symbol}><span>{symbol === activeSatelliteSymbol ? 'SATELLITE #1 · ' + symbol : symbol === 'EURUSD' ? 'CORE #1 · EURUSD' : symbol === 'XAUUSD' ? 'CORE #2 · XAUUSD' : 'CORE #3 · USDJPY'}</span><strong>{display(item?.mid, digits)}</strong><small>{item?.freshness ?? 'PENDING'} · {item?.latencyMs ?? '—'} ms · {activeSession}</small><div><span>BID {display(item?.bid, digits)}</span><span>ASK {display(item?.ask, digits)}</span></div><small>SPREAD {display(item?.spread, symbol === 'XAUUSD' ? 2 : 6)} · {item?.quoteTimeUtc ?? 'NO QUOTE'}</small></article>;
    })}</div>
    <div className="desk-syncline"><span>Swissquote public BBO · {latency ?? '—'} ms</span><span>Retrieved {quoteSync ?? '—'}</span><span>Frankfurter {fxStatus} · {fxSync ?? '—'}</span></div>
    <article className="desk-panel mt-3" aria-label="Live execution signals">
      <header><div><span className="desk-kicker">LIVE INTRADAY RESEARCH</span><h3>Macro-Aligned Intraday Setups</h3></div><small>5M PRICE ACTION · 1D ATR · AUTO REFRESH 60S</small></header>
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
            <div className="mt-2 flex flex-wrap gap-1 text-[9px]">
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
                  {!balanceVerified && <span className="w-full text-amber-300">ENTER REAL ACCOUNT BALANCE TO COMPUTE LOTS</span>}
                  {ticketSymbol === 'XAUUSD' && <span className="w-full text-amber-300">LOT SIZING LOCKED · BROKER CONTRACT SPECIFICATION REQUIRED</span>}
                  {balanceVerified && !isSizingEvidenceComplete && ticketSymbol !== 'XAUUSD' && <span className="w-full text-amber-300">LOT SIZING LOCKED · LIVE PRICE / VALID STOP UNAVAILABLE</span>}
                </div>
              </div>

              {/* Number 3: Exact Invalidation & Targets */}
              <div className="p-3 rounded-lg border border-slate-800 bg-[#09111c] space-y-2">
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider border-b border-slate-800 pb-1">
                  3. EXACT INVALIDATION &amp; TARGETS ({ticketSymbol})
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div>
                    <span className="text-[10px] text-slate-500 block">ENTRY ZONE</span>
                    <strong className="text-white block font-mono">
                      {selectedSig?.entryPrice ? display(selectedSig.entryPrice, digits) : 'AWAITING SETUP'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">STOP (1.35x ATR)</span>
                    <strong className="text-rose-400 block font-mono">
                      {selectedSig?.stopLoss ? display(selectedSig.stopLoss, digits) : '—'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">TP1 (2.0R)</span>
                    <strong className="text-emerald-400 block font-mono">
                      {selectedSig?.takeProfit1 ? display(selectedSig.takeProfit1, digits) : '—'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">TP2 (3.0R)</span>
                    <strong className="text-emerald-300 block font-mono">
                      {selectedSig?.takeProfit2 ? display(selectedSig.takeProfit2, digits) : '—'}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </section>

    <section className={`mb-3 rounded-lg border p-3 sm:p-4 ${manualDeskMode ? 'border-amber-400/40 bg-[#17170f]' : 'border-red-500/40 bg-[#1b1114]'}`} aria-label="Desk command banner">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><span className="desk-kicker">EXECUTIVE DESK COMMAND · AFRICA/LAGOS</span><h3 className={`mt-1 text-sm font-semibold tracking-wide ${manualDeskMode && activeSession !== 'OFF-SESSION' && manualLedger.trades < 2 && manualLedger.losses < 2 ? 'text-amber-300' : 'text-red-300'}`}>{manualDeskMode && activeSession !== 'OFF-SESSION' && manualLedger.trades < 2 && manualLedger.losses < 2 ? 'MANUAL DESK · REVIEW ONLY' : 'STAND DOWN · LOCKOUT ACTIVE'}</h3></div>
          <div className="flex flex-wrap items-center gap-2">{!manualDeskMode && <span className="rounded border border-red-400/40 px-2 py-1 text-[10px] font-mono text-red-200">ACCOUNT GOVERNANCE UNVERIFIED</span>}<label className="flex items-center gap-2 rounded border border-white/15 px-3 py-2 text-xs text-slate-100"><input type="checkbox" checked={manualDeskMode} onChange={(event) => toggleManualDeskMode(event.target.checked)} /> Manual Desk Mode (Browser Ledger Verified)</label></div>
        </div>
        <p className="text-xs text-slate-300">{manualDeskMode ? 'Manual mode uses this browser’s local ledger; it is not an authenticated MT5 account statement and does not authorize automated EA calls.' : 'No authenticated MT5 account ledger is connected. Manual execution remains locked until Browser Ledger Verified mode is explicitly enabled.'}</p>
        <div className="grid grid-cols-1 gap-3 border-t border-white/10 pt-3 sm:grid-cols-3">
          <div><span className="desk-kicker">ACTIVE WAT SESSION</span><strong className="mt-1 block text-sm text-slate-100">{activeSession === 'OFF-SESSION' ? 'OFF-SESSION DEAD ZONE' : activeSession + ' EXECUTION'}</strong><small className="text-slate-400">{activeSession === 'OFF-SESSION' ? 'Next session opens in ' + durationLabel(nextWATSessionOpen(now) - now) : 'Session closes in ' + durationLabel((activeSession === 'LONDON' ? 12 : 17) * 60 * 60_000 - (hourWAT * 60 * 60_000))}</small></div>
          <div><span className="desk-kicker">TODAY’S APPROVED PLAYBOOK</span><strong className="mt-1 block text-sm text-slate-100">{manualDeskMode && activeSession !== 'OFF-SESSION' ? 'MANUAL REVIEW PERMITTED' : 'NO EXECUTION CLEARED'}</strong><small className="text-slate-400">{intradaySignals.filter((item) => item.signalState === 'ACTIVE_SETUP').length ? intradaySignals.filter((item) => item.signalState === 'ACTIVE_SETUP').map((item) => item.direction + ' ' + item.symbol).join(' · ') : 'Wait for a fully validated macro-aligned setup'}</small></div>
          <div><span className="desk-kicker">DAILY RISK BUDGET · WAT</span><strong className="mt-1 block text-sm text-slate-100">Trades: {manualDeskMode ? manualLedger.trades + '/2' : 'UNVERIFIED'} · Losses: {manualDeskMode ? manualLedger.losses + '/2' : 'UNVERIFIED'}</strong><small className="text-slate-400">Locked currency legs: {manualDeskMode ? manualLedger.legs.join(', ') || 'None' : 'UNVERIFIED'}</small></div>
        </div>
        {manualDeskMode && <div className="flex flex-wrap gap-2 text-xs"><button type="button" disabled={manualLedger.trades >= 2} onClick={() => saveManualLedger({ ...manualLedger, trades: manualLedger.trades + 1 })} className="rounded border border-white/20 px-3 py-2 disabled:opacity-40">LOG TRADE</button><button type="button" disabled={manualLedger.losses >= 2} onClick={() => saveManualLedger({ ...manualLedger, losses: manualLedger.losses + 1 })} className="rounded border border-white/20 px-3 py-2 disabled:opacity-40">LOG LOSS</button>{['USD','EUR','GBP','JPY','AUD','CHF','CAD'].map((leg) => <button key={leg} type="button" disabled={manualLedger.legs.includes(leg)} onClick={() => saveManualLedger({ ...manualLedger, legs: [...manualLedger.legs, leg] })} className="rounded border border-white/20 px-2 py-2 disabled:opacity-40">LOCK {leg}</button>)}</div>}
      </div>
    </section>
    <div className="desk-quote-grid">{displaySymbols.map((symbol) => {
      const item = quoteFor(symbol); const digits = symbol.slice(3) === 'JPY' ? 3 : symbol === 'XAUUSD' ? 2 : 5;
      return <article className="desk-quote-card" key={symbol}><span>{symbol === activeSatelliteSymbol ? 'SATELLITE #1 · ' + symbol : symbol === 'EURUSD' ? 'CORE #1 · EURUSD' : symbol === 'XAUUSD' ? 'CORE #2 · XAUUSD' : 'CORE #3 · USDJPY'}</span><strong>{display(item?.mid, digits)}</strong><small>{item?.freshness ?? 'PENDING'} · {item?.latencyMs ?? '—'} ms · {activeSession}</small><div><span>BID {display(item?.bid, digits)}</span><span>ASK {display(item?.ask, digits)}</span></div><small>SPREAD {display(item?.spread, symbol === 'XAUUSD' ? 2 : 6)} · {item?.quoteTimeUtc ?? 'NO QUOTE'}</small></article>;
    })}</div>
    <div className="desk-syncline"><span>Swissquote public BBO · {latency ?? '—'} ms</span><span>Retrieved {quoteSync ?? '—'}</span><span>Frankfurter {fxStatus} · {fxSync ?? '—'}</span></div>
    <article className="desk-panel mt-3" aria-label="Live execution signals">
      <header><div><span className="desk-kicker">LIVE INTRADAY RESEARCH</span><h3>Macro-Aligned Intraday Setups</h3></div><small>5M PRICE ACTION · 1D ATR · AUTO REFRESH 60S</small></header>
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
            <div className="mt-2 flex flex-wrap gap-1 text-[9px]">
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
            <p className="mt-1 text-[9px] text-slate-500">Spread guard: {signal.spreadBaselineStatus === 'CONFIGURED_REFERENCE' ? 'CONFIGURED REFERENCE' : signal.spreadBaselineStatus ?? 'UNAVAILABLE'} · {signal.spreadBaselineObservations ?? 0} observed samples</p>
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
        </div>
        {manualDeskMode && <div className="flex flex-wrap gap-2 text-xs"><button type="button" disabled={manualLedger.trades >= 2} onClick={() => saveManualLedger({ ...manualLedger, trades: manualLedger.trades + 1 })} className="rounded border border-white/20 px-3 py-2 disabled:opacity-40">LOG TRADE</button><button type="button" disabled={manualLedger.losses >= 2} onClick={() => saveManualLedger({ ...manualLedger, losses: manualLedger.losses + 1 })} className="rounded border border-white/20 px-3 py-2 disabled:opacity-40">LOG LOSS</button>{['USD','EUR','GBP','JPY','AUD','CHF','CAD'].map((leg) => <button key={leg} type="button" disabled={manualLedger.legs.includes(leg)} onClick={() => saveManualLedger({ ...manualLedger, legs: [...manualLedger.legs, leg] })} className="rounded border border-white/20 px-2 py-2 disabled:opacity-40">LOCK {leg}</button>)}</div>}
      </div>
    </section>
    <div className="desk-quote-grid">{displaySymbols.map((symbol) => {
      const item = quoteFor(symbol); const digits = symbol.slice(3) === 'JPY' ? 3 : symbol === 'XAUUSD' ? 2 : 5;
      return <article className="desk-quote-card" key={symbol}><span>{symbol === activeSatelliteSymbol ? 'SATELLITE #1 · ' + symbol : symbol === 'EURUSD' ? 'CORE #1 · EURUSD' : symbol === 'XAUUSD' ? 'CORE #2 · XAUUSD' : 'CORE #3 · USDJPY'}</span><strong>{display(item?.mid, digits)}</strong><small>{item?.freshness ?? 'PENDING'} · {item?.latencyMs ?? '—'} ms · {activeSession}</small><div><span>BID {display(item?.bid, digits)}</span><span>ASK {display(item?.ask, digits)}</span></div><small>SPREAD {display(item?.spread, symbol === 'XAUUSD' ? 2 : 6)} · {item?.quoteTimeUtc ?? 'NO QUOTE'}</small></article>;
    })}</div>
    <div className="desk-syncline"><span>Swissquote public BBO · {latency ?? '—'} ms</span><span>Retrieved {quoteSync ?? '—'}</span><span>Frankfurter {fxStatus} · {fxSync ?? '—'}</span></div>
    <article className="desk-panel mt-3" aria-label="Live execution signals">
      <header><div><span className="desk-kicker">LIVE INTRADAY RESEARCH</span><h3>Macro-Aligned Intraday Setups</h3></div><small>5M PRICE ACTION · 1D ATR · AUTO REFRESH 60S</small></header>
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
            <div className="mt-2 flex flex-wrap gap-1 text-[9px]">
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
                  {!balanceVerified && <span className="w-full text-amber-300">ENTER REAL ACCOUNT BALANCE TO COMPUTE LOTS</span>}
                  {ticketSymbol === 'XAUUSD' && <span className="w-full text-amber-300">LOT SIZING LOCKED · BROKER CONTRACT SPECIFICATION REQUIRED</span>}
                  {balanceVerified && !isSizingEvidenceComplete && ticketSymbol !== 'XAUUSD' && <span className="w-full text-amber-300">LOT SIZING LOCKED · LIVE PRICE / VALID STOP UNAVAILABLE</span>}
                </div>
              </div>

              {/* Number 3: Exact Invalidation & Targets */}
              <div className="p-3 rounded-lg border border-slate-800 bg-[#09111c] space-y-2">
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider border-b border-slate-800 pb-1">
                  3. EXACT INVALIDATION &amp; TARGETS ({ticketSymbol})
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div>
                    <span className="text-[10px] text-slate-500 block">ENTRY ZONE</span>
                    <strong className="text-white block font-mono">
                      {selectedSig?.entryPrice ? display(selectedSig.entryPrice, digits) : 'AWAITING SETUP'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">STOP (1.35x ATR)</span>
                    <strong className="text-rose-400 block font-mono">
                      {selectedSig?.stopLoss ? display(selectedSig.stopLoss, digits) : '—'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">TP1 (2.0R)</span>
                    <strong className="text-emerald-400 block font-mono">
                      {selectedSig?.takeProfit1 ? display(selectedSig.takeProfit1, digits) : '—'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">TP2 (3.0R)</span>
                    <strong className="text-emerald-300 block font-mono">
                      {selectedSig?.takeProfit2 ? display(selectedSig.takeProfit2, digits) : '—'}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </section>

    <section className={`mb-3 rounded-lg border p-3 sm:p-4 ${manualDeskMode ? 'border-amber-400/40 bg-[#17170f]' : 'border-red-500/40 bg-[#1b1114]'}`} aria-label="Desk command banner">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><span className="desk-kicker">EXECUTIVE DESK COMMAND · AFRICA/LAGOS</span><h3 className={`mt-1 text-sm font-semibold tracking-wide ${manualDeskMode && activeSession !== 'OFF-SESSION' && manualLedger.trades < 2 && manualLedger.losses < 2 ? 'text-amber-300' : 'text-red-300'}`}>{manualDeskMode && activeSession !== 'OFF-SESSION' && manualLedger.trades < 2 && manualLedger.losses < 2 ? 'MANUAL DESK · REVIEW ONLY' : 'STAND DOWN · LOCKOUT ACTIVE'}</h3></div>
          <div className="flex flex-wrap items-center gap-2">{!manualDeskMode && <span className="rounded border border-red-400/40 px-2 py-1 text-[10px] font-mono text-red-200">ACCOUNT GOVERNANCE UNVERIFIED</span>}<label className="flex items-center gap-2 rounded border border-white/15 px-3 py-2 text-xs text-slate-100"><input type="checkbox" checked={manualDeskMode} onChange={(event) => toggleManualDeskMode(event.target.checked)} /> Manual Desk Mode (Browser Ledger Verified)</label></div>
        </div>
        <p className="text-xs text-slate-300">{manualDeskMode ? 'Manual mode uses this browser’s local ledger; it is not an authenticated MT5 account statement and does not authorize automated EA calls.' : 'No authenticated MT5 account ledger is connected. Manual execution remains locked until Browser Ledger Verified mode is explicitly enabled.'}</p>
        <div className="grid grid-cols-1 gap-3 border-t border-white/10 pt-3 sm:grid-cols-3">
          <div><span className="desk-kicker">ACTIVE WAT SESSION</span><strong className="mt-1 block text-sm text-slate-100">{activeSession === 'OFF-SESSION' ? 'OFF-SESSION DEAD ZONE' : activeSession + ' EXECUTION'}</strong><small className="text-slate-400">{activeSession === 'OFF-SESSION' ? 'Next session opens in ' + durationLabel(nextWATSessionOpen(now) - now) : 'Session closes in ' + durationLabel((activeSession === 'LONDON' ? 12 : 17) * 60 * 60_000 - (hourWAT * 60 * 60_000))}</small></div>
          <div><span className="desk-kicker">TODAY’S APPROVED PLAYBOOK</span><strong className="mt-1 block text-sm text-slate-100">{manualDeskMode && activeSession !== 'OFF-SESSION' ? 'MANUAL REVIEW PERMITTED' : 'NO EXECUTION CLEARED'}</strong><small className="text-slate-400">{intradaySignals.filter((item) => item.signalState === 'ACTIVE_SETUP').length ? intradaySignals.filter((item) => item.signalState === 'ACTIVE_SETUP').map((item) => item.direction + ' ' + item.symbol).join(' · ') : 'Wait for a fully validated macro-aligned setup'}</small></div>
          <div><span className="desk-kicker">DAILY RISK BUDGET · WAT</span><strong className="mt-1 block text-sm text-slate-100">Trades: {manualDeskMode ? manualLedger.trades + '/2' : 'UNVERIFIED'} · Losses: {manualDeskMode ? manualLedger.losses + '/2' : 'UNVERIFIED'}</strong><small className="text-slate-400">Locked currency legs: {manualDeskMode ? manualLedger.legs.join(', ') || 'None' : 'UNVERIFIED'}</small></div>
        </div>
        {manualDeskMode && <div className="flex flex-wrap gap-2 text-xs"><button type="button" disabled={manualLedger.trades >= 2} onClick={() => saveManualLedger({ ...manualLedger, trades: manualLedger.trades + 1 })} className="rounded border border-white/20 px-3 py-2 disabled:opacity-40">LOG TRADE</button><button type="button" disabled={manualLedger.losses >= 2} onClick={() => saveManualLedger({ ...manualLedger, losses: manualLedger.losses + 1 })} className="rounded border border-white/20 px-3 py-2 disabled:opacity-40">LOG LOSS</button>{['USD','EUR','GBP','JPY','AUD','CHF','CAD'].map((leg) => <button key={leg} type="button" disabled={manualLedger.legs.includes(leg)} onClick={() => saveManualLedger({ ...manualLedger, legs: [...manualLedger.legs, leg] })} className="rounded border border-white/20 px-2 py-2 disabled:opacity-40">LOCK {leg}</button>)}</div>}
      </div>
    </section>
    <div className="desk-quote-grid">{displaySymbols.map((symbol) => {
      const item = quoteFor(symbol); const digits = symbol.slice(3) === 'JPY' ? 3 : symbol === 'XAUUSD' ? 2 : 5;
      return <article className="desk-quote-card" key={symbol}><span>{symbol === activeSatelliteSymbol ? 'SATELLITE #1 · ' + symbol : symbol === 'EURUSD' ? 'CORE #1 · EURUSD' : symbol === 'XAUUSD' ? 'CORE #2 · XAUUSD' : 'CORE #3 · USDJPY'}</span><strong>{display(item?.mid, digits)}</strong><small>{item?.freshness ?? 'PENDING'} · {item?.latencyMs ?? '—'} ms · {activeSession}</small><div><span>BID {display(item?.bid, digits)}</span><span>ASK {display(item?.ask, digits)}</span></div><small>SPREAD {display(item?.spread, symbol === 'XAUUSD' ? 2 : 6)} · {item?.quoteTimeUtc ?? 'NO QUOTE'}</small></article>;
    })}</div>
    <div className="desk-syncline"><span>Swissquote public BBO · {latency ?? '—'} ms</span><span>Retrieved {quoteSync ?? '—'}</span><span>Frankfurter {fxStatus} · {fxSync ?? '—'}</span></div>
    <article className="desk-panel mt-3" aria-label="Live execution signals">
      <header><div><span className="desk-kicker">LIVE INTRADAY RESEARCH</span><h3>Macro-Aligned Intraday Setups</h3></div><small>5M PRICE ACTION · 1D ATR · AUTO REFRESH 60S</small></header>
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
            <div className="mt-2 flex flex-wrap gap-1 text-[9px]">
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
            <p className="mt-1 text-[9px] text-slate-500">Spread guard: {signal.spreadBaselineStatus === 'CONFIGURED_REFERENCE' ? 'CONFIGURED REFERENCE' : signal.spreadBaselineStatus ?? 'UNAVAILABLE'} · {signal.spreadBaselineObservations ?? 0} observed samples</p>
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
