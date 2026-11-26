'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MacroSnapshot } from '@/types/macro';
import type { GoldMacroContext } from '@/lib/macro/goldAndRegimeEngine';
import { getCurrencyStrengthIndex } from '@/lib/currencyStrength';
import { generatePairDossier } from '@/lib/macro/dossierEngine';
import type { IntradaySignal } from '@/lib/quant/intradaySignalEngine';

type Quote = {
  symbol: string; bid: number | null; ask: number | null; mid: number | null;
  spread: number | null; quoteTimeUtc: string | null; retrievedAtUtc: string;
  ageMs: number | null; freshness: 'LIVE' | 'STALE' | 'UNAVAILABLE';
  latencyMs: number; source: string; error: string | null;
};
type QuoteResponse = { generatedAtUtc: string; latencyMs: number; status: string; quotes: Quote[] };
type FxRow = { date: string; rates: Record<string, number> };
type JournalEntry = { id: string; timeUtc: string; symbol: string; result: 'WIN' | 'LOSS' | 'FLAT'; pnl: number; pnlUsd: number; direction: Direction; macroBiasScore: number | null; hurstRegime: string | null; vixLevel: number | null; session: 'LONDON' | 'NY' | 'OFF-SESSION'; riskPct: number | null; rMultiple: number | null; macroAlignment: 'ALIGNED' | 'COUNTER' | 'UNKNOWN'; entryContextCapturedAtUtc?: string; riskAmountUsdAtEntry?: number | null };
type Journal = { dateWAT: string; trades: number; wins: number; losses: number; netPnl: number; entries: JournalEntry[] };
type SymbolCode = string;
type Direction = 'BUY' | 'SELL';
const symbols: SymbolCode[] = ['EURUSD', 'XAUUSD', 'USDJPY'];
const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CHF', 'CAD'] as const;
const JOURNAL_KEY = 'fidulync-desk-journal-v1';
const TRADE_JOURNAL_KEY = 'fidulync-quant-trade-journal-v1';
const ENTRY_CONTEXT_KEY = 'fidulync-pending-entry-context-v1';
const FX_KEY = 'fidulync-desk-fx-v1';
const blankJournal = (dateWAT: string): Journal => ({ dateWAT, trades: 0, wins: 0, losses: 0, netPnl: 0, entries: [] });
const watDate = (date = new Date()) => { const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date); const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '00'; return part('year') + '-' + part('month') + '-' + part('day'); };
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
  const [balance, setBalance] = useState('1000');
  const [riskPct, setRiskPct] = useState('1');
  const [selected, setSelected] = useState<SymbolCode>('EURUSD');
  const [sl, setSl] = useState('20');
  const [tp, setTp] = useState('40');
  const [direction, setDirection] = useState<Direction>('BUY');
  const [technicalConfirmed, setTechnicalConfirmed] = useState(false);
  const [journal, setJournal] = useState<Journal>(() => blankJournal(''));
  const [pnlInput, setPnlInput] = useState('');
  const [resultInput, setResultInput] = useState<'WIN' | 'LOSS' | 'FLAT'>('WIN');
  const [journalSymbol, setJournalSymbol] = useState<SymbolCode>('EURUSD');
  const [entryContext, setEntryContext] = useState<Partial<JournalEntry> | null>(null);
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
  const quote = quoteFor(selected);
  const usdJpy = quoteFor('USDJPY')?.mid ?? null;
  const risk = Number(riskPct);
  const stop = Number(sl);
  const target = Number(tp);
  const account = Number(balance);
  const pipValue = selected === 'USDJPY' ? (usdJpy && usdJpy > 0 ? 1000 / usdJpy : null)
    : selected === 'XAUUSD' ? 100
      : selected.slice(3) === 'USD' ? 10
        : selected.length === 6 && fxRows.length ? (() => {
          const quoteCurrency = selected.slice(3, 6);
          const usdCross = fxRows[fxRows.length - 1].rates[quoteCurrency];
          if (!usdCross || usdCross <= 0) return null;
          return quoteCurrency === 'JPY' ? 1000 / usdCross : 10 / usdCross;
        })() : null;
  const riskAmount = account > 0 && risk > 0 ? account * risk / 100 : 0;
  const lots = pipValue && stop > 0 ? Math.floor((riskAmount / (stop * pipValue)) * 100) / 100 : 0;
  const rr = stop > 0 && target > 0 ? target / stop : 0;
  const gross = riskAmount * rr;
  const spreadUnits = quote?.spread === null || quote?.spread === undefined ? null : selected === 'XAUUSD' ? quote.spread : quote.spread / (selected.slice(3) === 'JPY' ? 0.01 : 0.0001);
  const spreadPct = spreadUnits !== null && stop > 0 ? spreadUnits / stop * 100 : null;
  const currentDateWAT = watDate(new Date(now));
  const sessionClock = new Date(now);
  const hourWAT = zonedDecimalHour(sessionClock, 'Africa/Lagos');
  const hourNewYork = zonedDecimalHour(sessionClock, 'America/New_York');
  const activeSession = hourWAT >= 8 && hourWAT < 12 ? 'LONDON' : hourNewYork >= 8 && hourNewYork < 12 ? 'NEW YORK' : 'OFF-SESSION';
  const inSession = activeSession !== 'OFF-SESSION';
  const healthyProviderCount = snapshot.providerStatus?.filter((provider) => provider.status === 'HEALTHY').length ?? 0;
  const totalProviderCount = snapshot.providerStatus?.length ?? 0;
  const locked = journal.trades >= 2 || journal.losses >= 2;
  const vixValue = goldContext?.drivers.VIXCLS.value ?? null;
  const tailRiskStatus = vixValue === null ? 'UNAVAILABLE' : vixValue >= 28 ? 'BLACK_SWAN_LOCKOUT' : vixValue >= 22 ? 'ELEVATED_VOLATILITY' : 'NORMAL';
  const riskCap = tailRiskStatus === 'UNAVAILABLE' || tailRiskStatus === 'BLACK_SWAN_LOCKOUT' ? 0 : tailRiskStatus === 'ELEVATED_VOLATILITY' ? 0.5 : 1;
  const selectedLegs = selected === 'XAUUSD' ? ['USD'] : [selected.slice(0, 3), selected.slice(3, 6)];
  const conflictingTrades = journal.entries.filter((entry) => {
    const legs = entry.symbol === 'XAUUSD' ? ['USD'] : [entry.symbol.slice(0, 3), entry.symbol.slice(3, 6)];
    return legs.some((leg) => selectedLegs.includes(leg));
  });
  const correlationPass = conflictingTrades.length === 0;
  const dossier = useMemo(() => generatePairDossier(snapshot, selected), [snapshot, selected]);
  const fxMacroPass = (dossier.confidence === 'HIGH' || dossier.confidence === 'MODERATE')
    && ((dossier.biasScore > 0 && direction === 'BUY') || (dossier.biasScore < 0 && direction === 'SELL'));
  const goldScore = goldContext?.goldBiasScore ?? null;
  const goldMacroPass = goldContext?.overallState === 'AVAILABLE'
    && ((goldContext.directionalVerdict === 'BULLISH' && direction === 'BUY')
      || (goldContext.directionalVerdict === 'BEARISH' && direction === 'SELL'));
  const macroPass = selected === 'XAUUSD' ? goldMacroPass : fxMacroPass;
  const verifiedCalendar = snapshot.calendarSource === 'provider' && Boolean(snapshot.calendarProvider);
  const nearEvent = verifiedCalendar && snapshot.catalysts.some((event) => event.impact === 'High' && Math.abs(Date.parse(event.scheduledAt) - now) <= 30 * 60_000);
  const eventPass = verifiedCalendar && !nearEvent;
  const riskPass = Number.isFinite(account) && account > 0
    && Number.isFinite(stop) && stop > 0 && Number.isFinite(target) && target > 0
    && risk > 0 && risk <= riskCap && lots >= 0.01
    && journal.trades < 2 && journal.losses < 2 && !locked
    && correlationPass && (tailRiskStatus === 'NORMAL' || tailRiskStatus === 'ELEVATED_VOLATILITY');
  const quoteIsFresh = quote?.freshness === 'LIVE' && quote.ageMs !== null && quote.ageMs <= 60_000;
  const spreadPass = quoteIsFresh && rr >= 2 && spreadPct !== null && spreadPct < 15;
  const gates = [
    { name: 'Macro alignment', pass: macroPass, detail: selected === 'XAUUSD' ? (goldScore === null ? 'Gold engine evidence unavailable' : `${goldScore} gold score · ${goldContext?.directionalVerdict} · ${direction}`) : dossier.confidence === 'INSUFFICIENT_EVIDENCE' ? 'No verified pair bias available' : `${dossier.biasScore} score · ${dossier.confidence} · ${direction}` },
    { name: 'Lagos session', pass: inSession, detail: 'London 08:00–12:00 WAT / New York 08:00–12:00 ET (DST-aware)' },
    { name: 'Tier-1 event risk', pass: eventPass, detail: !verifiedCalendar ? 'Calendar unverified; fail-closed' : nearEvent ? 'Event within ±30 minutes' : 'Verified calendar: clear' },
    { name: 'H4/H1 structure and liquidity', pass: technicalConfirmed, detail: 'Requires manual MT5 chart confirmation' },
    { name: 'Reward/risk and spread', pass: spreadPass, detail: `${rr.toFixed(2)}R · ${quoteIsFresh ? 'fresh quote' : 'quote stale/unavailable'} · spread ${spreadPct === null ? 'unavailable' : spreadPct.toFixed(1) + '% of SL'}` },
    { name: 'Daily risk & correlation circuit breaker', pass: riskPass, detail: `${correlationPass ? 'Currency legs clear' : 'BLOCKED: shared leg with ' + conflictingTrades.map((entry) => entry.symbol).join(', ')} · ${risk.toFixed(2)}% / ${riskCap.toFixed(2)}% cap · ${journal.trades}/2 trades · ${journal.losses}/2 losses · ${tailRiskStatus}` },
  ];
  const gatePassed = gates.every((gate) => gate.pass) && !locked;

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
      setEntryContext(readStorage<Partial<JournalEntry>>(ENTRY_CONTEXT_KEY));
      const cached = readStorage<Journal>(JOURNAL_KEY);
      if (cached?.dateWAT === watDate()) setJournal(cached);
      else setJournal(blankJournal(watDate()));
      const cachedFx = readStorage<{ rows: FxRow[]; retrievedAtUtc: string }>(FX_KEY);
      if (cachedFx?.rows?.length) { setFxRows(cachedFx.rows); setFxSync(cachedFx.retrievedAtUtc); setFxStatus('CACHED'); }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { if (ready) window.localStorage.setItem(JOURNAL_KEY, JSON.stringify(journal)); }, [journal, ready]);
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
  useEffect(() => {
    if (journal.dateWAT !== currentDateWAT) {
      const timer = window.setTimeout(() => setJournal(blankJournal(currentDateWAT)), 0);
      return () => window.clearTimeout(timer);
    }
  }, [journal.dateWAT, currentDateWAT]);

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


  const captureEntryContext = () => {
    const score = journalSymbol === 'XAUUSD' ? goldScore : dossier.biasScore;
    const alignment = score === null || score === undefined || score === 0 ? 'UNKNOWN'
      : ((score > 0 && direction === 'BUY') || (score < 0 && direction === 'SELL')) ? 'ALIGNED' : 'COUNTER';
    const context: Partial<JournalEntry> = {
      symbol: journalSymbol, direction,
      macroBiasScore: Number.isFinite(score) ? score : null,
      hurstRegime: goldContext?.liquidityRegime ?? snapshot.regime ?? null,
      vixLevel: Number.isFinite(vixValue) ? vixValue : null,
      session: activeSession === 'NEW YORK' ? 'NY' : activeSession,
      riskPct: Number.isFinite(risk) ? risk : null,
      riskAmountUsdAtEntry: account > 0 && risk > 0 ? account * risk / 100 : null,
      macroAlignment: alignment,
      entryContextCapturedAtUtc: new Date().toISOString(),
    };
    setEntryContext(context);
    try { window.localStorage.setItem(ENTRY_CONTEXT_KEY, JSON.stringify(context)); } catch { /* local capture remains in component state */ }
  };
  const recordTrade = () => {
    const pnl = Number(pnlInput);
    if (!pnlInput.trim() || !Number.isFinite(pnl) || locked) return;
    const timeUtc = new Date().toISOString();
    const captured = entryContext?.symbol === journalSymbol && entryContext.direction === direction ? entryContext : null;
    const macroBiasScore = captured ? captured.macroBiasScore ?? null : (journalSymbol === 'XAUUSD' ? goldScore : dossier.biasScore);
    const macroAlignment = captured?.macroAlignment ?? (macroBiasScore === null || macroBiasScore === undefined || macroBiasScore === 0
      ? 'UNKNOWN' as const
      : ((macroBiasScore > 0 && direction === 'BUY') || (macroBiasScore < 0 && direction === 'SELL'))
        ? 'ALIGNED' as const : 'COUNTER' as const);
    const riskAmountAtEntry = captured ? captured.riskAmountUsdAtEntry ?? null : (account > 0 && risk > 0 ? account * risk / 100 : null);
    const entry: JournalEntry = {
      id: `${Date.now()}-${journalSymbol}-${Math.random().toString(36).slice(2, 8)}`,
      timeUtc, symbol: journalSymbol, result: resultInput, pnl, pnlUsd: pnl, direction,
      macroBiasScore: Number.isFinite(macroBiasScore) ? macroBiasScore : null,
      hurstRegime: captured ? captured.hurstRegime ?? null : goldContext?.liquidityRegime ?? snapshot.regime ?? null,
      vixLevel: captured ? captured.vixLevel ?? null : (Number.isFinite(vixValue) ? vixValue : null),
      session: captured?.session ?? (activeSession === 'NEW YORK' ? 'NY' : activeSession),
      riskPct: captured ? captured.riskPct ?? null : (Number.isFinite(risk) ? risk : null),
      rMultiple: riskAmountAtEntry && riskAmountAtEntry > 0 ? Number((pnl / riskAmountAtEntry).toFixed(4)) : null,
      macroAlignment,
      ...(captured?.entryContextCapturedAtUtc ? { entryContextCapturedAtUtc: captured.entryContextCapturedAtUtc } : {}),
      riskAmountUsdAtEntry: riskAmountAtEntry,
    };
    try {
      const prior = readStorage<JournalEntry[]>(TRADE_JOURNAL_KEY) ?? [];
      window.localStorage.setItem(TRADE_JOURNAL_KEY, JSON.stringify([entry, ...prior.filter((item) => item.id !== entry.id)].slice(0, 5000)));
    } catch (error) {
      console.warn('Quant trade journal mirror could not be persisted:', error);
    }
    setJournal((previous) => ({
      ...previous, trades: previous.trades + 1,
      wins: previous.wins + (resultInput === 'WIN' ? 1 : 0),
      losses: previous.losses + (resultInput === 'LOSS' ? 1 : 0),
      netPnl: Number((previous.netPnl + pnl).toFixed(2)),
      entries: [entry, ...previous.entries].slice(0, 20),
    }));
    setPnlInput('');
    setEntryContext(null);
    try { window.localStorage.removeItem(ENTRY_CONTEXT_KEY); } catch { /* no-op */ }
  };
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
  const exportJournal = (format: 'json' | 'csv') => {
    const content = format === 'json'
      ? JSON.stringify({ schemaVersion: '1.0.0', timezone: 'Africa/Lagos', dateWAT: journal.dateWAT, ...journal }, null, 2)
      : [
        'time_utc,date_wat,symbol,result,pnl_usd',
        ...journal.entries.map((entry) => [entry.timeUtc, journal.dateWAT, entry.symbol, entry.result, entry.pnl]
          .map((value) => '"' + String(value).replace(/"/g, '""') + '"').join(',')),
      ].join('\\n');
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'macrolinc-trade-journal-' + journal.dateWAT + '.' + format;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return <section id="desk-terminal" className="desk-terminal scroll-mt-24" aria-label="Quantitative trading desk terminal">
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
          const rr = signal.slPips && signal.entryPrice !== null && signal.takeProfit1 !== null
            ? Math.abs(signal.takeProfit1 - signal.entryPrice) / (signal.slPips * (signal.atrUnit === 'USD' ? 1 : signal.symbol.endsWith('JPY') ? 0.01 : 0.0001))
            : 0;
          const statusClass = active ? 'desk-good' : signal.signalState === 'SHIELD_BLOCKED' ? 'desk-warning' : 'text-slate-400';
          const canLoad = active && signal.entryPrice !== null && signal.slPips !== null && signal.slPips > 0;
          return <div className="rounded border border-white/10 bg-[#0b1017] p-3 min-w-0" key={signal.symbol}>
            <div className="flex items-center justify-between gap-2"><strong className="font-mono text-xs">{signal.symbol}</strong><span className={statusClass + ' text-[10px] font-mono'}>{signal.signalState.replaceAll('_', ' ')}</span></div>
            <div className="mt-3 flex items-baseline justify-between"><b className="text-lg font-mono">{signal.direction}</b><span className="text-xs font-mono">{signal.confluenceScore}% confluence</span></div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400">
              <span>ENTRY <b className="block text-slate-100">{display(signal.entryPrice, signal.symbol === 'XAUUSD' ? 2 : signal.symbol.endsWith('JPY') ? 3 : 5)}</b></span>
              <span>STOP <b className="block text-slate-100">{display(signal.stopLoss, signal.symbol === 'XAUUSD' ? 2 : signal.symbol.endsWith('JPY') ? 3 : 5)}</b></span>
              <span>TP1 <b className="block text-slate-100">{display(signal.takeProfit1, signal.symbol === 'XAUUSD' ? 2 : signal.symbol.endsWith('JPY') ? 3 : 5)}</b></span>
              <span>TP2 <b className="block text-slate-100">{display(signal.takeProfit2, signal.symbol === 'XAUUSD' ? 2 : signal.symbol.endsWith('JPY') ? 3 : 5)}</b></span>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-400">{signal.triggerRationale}</p>
            {signal.blockers.length > 0 && <p className="mt-2 text-[10px] text-amber-300">{signal.blockers.join(' · ')}</p>}
            <p className="mt-1 text-[9px] text-slate-500">Spread baseline: {signal.spreadBaselineStatus ?? 'UNAVAILABLE'} · {signal.spreadBaselineObservations ?? 0}/20 samples</p>
            <button type="button" className="desk-record-button mt-3 w-full" disabled={!canLoad} onClick={() => {
              setSelected(signal.symbol); setJournalSymbol(signal.symbol); setDirection(signal.direction as Direction);
              setSl(String(signal.slPips)); setTp(String(signal.slPips! * 2));
              document.getElementById('desk-position-sizing')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}>LOAD INTO CALCULATOR</button>
            {signal.dataAsOfUtc && <small className="mt-2 block text-[9px] text-slate-500">OHLCV {signal.dataAsOfUtc} · {signal.session}</small>}
          </div>;
        })}
        {intradaySignals.length === 0 && <p className="macro-empty col-span-full">Signal service unavailable. No executable levels are published without verified inputs.</p>}
      </div>
      <div className="desk-syncline"><span>Signal refresh {signalSyncUtc ?? 'NOT AVAILABLE'}</span><span>Macro score ≥ +25 BUY / ≤ −25 SELL</span><span>Signals are research-only; MT5 must independently validate spread and execution</span><button type="button" onClick={() => void refreshIntradaySignals()}>REFRESH SIGNALS</button></div>
    </article>
    <div className="desk-workflow"><strong>DESK WORKFLOW</strong><span>1 Macro Bias</span><b>→</b><span>2 Position Sizing</span><b>→</b><span>3 6/6 Gate</span><b>→</b><span>4 MT5 Execution</span><b>→</b><span>5 Trade Journal</span></div>
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
      <article id="desk-position-sizing" className="desk-panel scroll-mt-24"><header><div><span className="desk-kicker">B / LIVE RISK CALCULATOR</span><h3>Position Sizing</h3></div><small>USD ACCOUNT · STANDARD LOT ESTIMATE</small></header>
        <div className="desk-form-grid">
          <label>Account balance USD<input inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} /></label>
          <label>Risk %<input inputMode="decimal" value={riskPct} onChange={(e) => setRiskPct(e.target.value)} /></label>
          <label>Instrument<select value={selected} onChange={(e) => { setSelected(e.target.value as SymbolCode); setJournalSymbol(e.target.value as SymbolCode); }}><option value="EURUSD">EUR/USD</option><option value="XAUUSD">XAU/USD</option><option value="USDJPY">USD/JPY</option>{satelliteSymbol && <option value={satelliteSymbol}>SATELLITE #1 · {satelliteSymbol}</option>}</select></label>
          <label>{selected === 'XAUUSD' ? 'Stop distance ($)' : 'Stop loss (pips)'}<input inputMode="decimal" value={sl} onChange={(e) => setSl(e.target.value)} /></label>
          <label>{selected === 'XAUUSD' ? 'Target distance ($)' : 'Take profit (pips)'}<input inputMode="decimal" value={tp} onChange={(e) => setTp(e.target.value)} /></label>
          <label>Direction<select value={direction} onChange={(e) => setDirection(e.target.value as Direction)}><option value="BUY">BUY</option><option value="SELL">SELL</option></select></label>
        </div>
        <div className="desk-calc-results"><div><span>RISK AMOUNT</span><strong>${riskAmount.toFixed(2)}</strong></div><div><span>LOT SIZE · ROUNDED DOWN</span><strong>{lots.toFixed(2)}</strong><small className="block mt-1 text-[10px] text-slate-400">{pipValue === null ? '$/PIP/LOT UNAVAILABLE' : '$' + pipValue.toFixed(2) + ' / PIP / LOT'}</small></div><div><span>REWARD / RISK</span><strong className={rr >= 2 ? 'desk-good' : 'desk-warning'}>{rr.toFixed(2)}R</strong></div><div><span>EXPECTED GROSS PROFIT</span><strong>${gross.toFixed(2)}</strong></div></div>
        <p className="desk-footnote">{selected === 'USDJPY' ? `USDJPY pip value: 1,000 / live ${display(usdJpy, 3)} = ${pipValue?.toFixed(4) ?? 'unavailable'} USD per pip per lot.` : selected === 'XAUUSD' ? 'Gold assumption: 100 oz per standard lot; $100 P/L per $1.00 price move per lot.' : 'FX assumption: $10 USD pip value per standard lot for EUR/USD and GBP/USD.'} Excludes commissions, slippage, swaps and broker contract variations. Planning estimate only: verify the broker&apos;s MT5 symbol specification and account currency; the EA&apos;s broker-native sizing is authoritative.</p>
        {risk > 1 && <p className="desk-warning-text">Risk exceeds the 1.0% governance ceiling.</p>}{lots > 0 && lots < 0.01 && <p className="desk-warning-text">Below 0.01 lot: skip, never round size up.</p>}{rr < 2 && <p className="desk-warning-text">R:R is below the required 1:2.0.</p>}
      </article>
    </div>
    <div className="desk-grid">
      <article className="desk-panel"><header><div><span className="desk-kicker">C / GOVERNANCE</span><h3>Mandatory 6/6 Pre-Trade Gate</h3></div><small>{gates.filter((gate) => gate.pass).length}/6 PASSED</small></header>
        <div className="desk-gate-list">{gates.map((gate, index) => <div className="desk-gate-row" key={gate.name}><span className={gate.pass ? 'desk-gate-pass' : 'desk-gate-fail'}>{gate.pass ? 'PASS' : 'BLOCK'}</span><div><b>{index + 1}. {gate.name}</b><small>{gate.detail}</small></div>{index === 3 && <label className="desk-check"><input type="checkbox" checked={technicalConfirmed} onChange={(e) => setTechnicalConfirmed(e.target.checked)} /> MT5 confirmed</label>}</div>)}</div>
        <div className={locked ? 'desk-lockout' : gatePassed ? 'desk-clear' : 'desk-blocked'}>{locked ? 'DAILY CIRCUIT BREAKER ACTIVE · LOCKED UNTIL 00:00 WAT' : gatePassed ? '6/6 CHECKS PASSED · MT5 EXECUTION REMAINS MANUAL' : 'GATE CLOSED · ALL SIX CONDITIONS MUST PASS'}</div>
        <p className="desk-footnote">Calendar must be verified before the event gate can pass. This checklist does not submit orders or control MT5. Local state is not a broker-enforced lockout.</p>
      </article>
      <article className="desk-panel"><header><div><span className="desk-kicker">D / DAILY RISK CONTROL</span><h3>WAT Daily Circuit Breaker</h3></div><small>{currentDateWAT}</small></header>
        <div className="desk-journal-stats"><div><span>TRADES</span><b>{journal.trades}/2</b></div><div><span>WINS</span><b>{journal.wins}</b></div><div><span>LOSSES</span><b>{journal.losses}/2</b></div><div><span>NET P&amp;L</span><b className={journal.netPnl >= 0 ? 'desk-good' : 'desk-warning'}>${journal.netPnl.toFixed(2)}</b></div></div>
        <div className="desk-form-grid desk-journal-form"><label>Result<select value={resultInput} onChange={(e) => setResultInput(e.target.value as 'WIN' | 'LOSS' | 'FLAT')}><option>WIN</option><option>LOSS</option><option>FLAT</option></select></label><label>Realized P&amp;L USD<input inputMode="decimal" value={pnlInput} onChange={(e) => setPnlInput(e.target.value)} placeholder="Closed trade P&L" /></label><label>Instrument<select value={journalSymbol} onChange={(e) => setJournalSymbol(e.target.value as SymbolCode)}>{displaySymbols.map((s) => <option key={s}>{s}</option>)}</select></label></div>
        <button className="desk-record-button" type="button" onClick={captureEntryContext}>CAPTURE ENTRY CONTEXT</button><small className="block mt-2 text-[10px] text-slate-500">{entryContext?.entryContextCapturedAtUtc ? `ENTRY CONTEXT CAPTURED ${entryContext.entryContextCapturedAtUtc}` : "Capture the current macro, VIX, session and risk state when opening a position."}</small><button className="desk-record-button" type="button" disabled={!pnlInput.trim() || !Number.isFinite(Number(pnlInput)) || locked} onClick={recordTrade}>RECORD CLOSED TRADE</button>
        <div className="flex flex-wrap gap-2 mt-3"><button className="desk-record-button" type="button" onClick={() => exportJournal('json')}>EXPORT JSON</button><button className="desk-record-button" type="button" onClick={() => exportJournal('csv')}>EXPORT CSV</button></div>
        <div className="desk-journal-list">{journal.entries.slice(0, 5).map((entry) => <div key={entry.id}><span>{entry.symbol} · {entry.result}</span><b className={entry.pnl >= 0 ? 'desk-good' : 'desk-warning'}>{entry.pnl >= 0 ? '+' : ''}${entry.pnl.toFixed(2)}</b><small>{entry.timeUtc}</small></div>)}</div>
        <p className="desk-footnote">Journal persists in this browser only. Browser storage clearing or switching devices resets it. MT5 must independently enforce the same hard limits.</p>
      </article>
    </div>
  </section>;
}
