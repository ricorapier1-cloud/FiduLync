'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MacroSnapshot } from '@/types/macro';
import { generatePairDossier } from '@/lib/macro/dossierEngine';

type Quote = {
  symbol: string; bid: number | null; ask: number | null; mid: number | null;
  spread: number | null; quoteTimeUtc: string | null; retrievedAtUtc: string;
  ageMs: number | null; freshness: 'LIVE' | 'STALE' | 'UNAVAILABLE';
  latencyMs: number; source: string; error: string | null;
};
type QuoteResponse = { generatedAtUtc: string; latencyMs: number; status: string; quotes: Quote[] };
type FxRow = { date: string; rates: Record<string, number> };
type JournalEntry = { id: string; timeUtc: string; symbol: string; result: 'WIN' | 'LOSS' | 'FLAT'; pnl: number };
type Journal = { dateWAT: string; trades: number; wins: number; losses: number; netPnl: number; entries: JournalEntry[] };
type SymbolCode = 'EURUSD' | 'GBPUSD' | 'XAUUSD' | 'USDJPY';
type Direction = 'BUY' | 'SELL';
const symbols: SymbolCode[] = ['EURUSD', 'GBPUSD', 'XAUUSD', 'USDJPY'];
const currencies = ['EUR', 'GBP', 'JPY', 'AUD', 'CHF', 'CAD'] as const;
const JOURNAL_KEY = 'fidulync-desk-journal-v1';
const FX_KEY = 'fidulync-desk-fx-v1';
const blankJournal = (dateWAT: string): Journal => ({ dateWAT, trades: 0, wins: 0, losses: 0, netPnl: 0, entries: [] });
const watDate = (date = new Date()) => { const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date); const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '00'; return part('year') + '-' + part('month') + '-' + part('day'); };
function watDecimalHour(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  return Number(parts.find((p) => p.type === 'hour')?.value ?? 0) + Number(parts.find((p) => p.type === 'minute')?.value ?? 0) / 60;
}
function readStorage<T>(key: string): T | null {
  try { const value = window.localStorage.getItem(key); return value ? JSON.parse(value) as T : null; } catch { return null; }
}
function display(value: number | null | undefined, digits: number) { return value === null || value === undefined || !Number.isFinite(value) ? '—' : value.toFixed(digits); }
function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }

export default function DeskTerminal({ initialSnapshot }: { initialSnapshot: MacroSnapshot }) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quoteStatus, setQuoteStatus] = useState('CONNECTING');
  const [latency, setLatency] = useState<number | null>(null);
  const [quoteSync, setQuoteSync] = useState<string | null>(null);
  const [fxRows, setFxRows] = useState<FxRow[]>([]);
  const [fxStatus, setFxStatus] = useState('NOT SYNCED');
  const [fxSync, setFxSync] = useState<string | null>(null);
  const [now, setNow] = useState(0);
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
  const [ready, setReady] = useState(false);
  const [forceSyncing, setForceSyncing] = useState(false);

  const quoteFor = useCallback((symbol: string) => quotes.find((q) => q.symbol === symbol) ?? null, [quotes]);
  const quote = quoteFor(selected);
  const usdJpy = quoteFor('USDJPY')?.mid ?? null;
  const risk = Number(riskPct);
  const stop = Number(sl);
  const target = Number(tp);
  const account = Number(balance);
  const pipValue = selected === 'USDJPY' ? (usdJpy && usdJpy > 0 ? 1000 / usdJpy : null) : selected === 'XAUUSD' ? 100 : 10;
  const riskAmount = account > 0 && risk > 0 ? account * risk / 100 : 0;
  const lots = pipValue && stop > 0 ? Math.floor((riskAmount / (stop * pipValue)) * 100) / 100 : 0;
  const rr = stop > 0 && target > 0 ? target / stop : 0;
  const gross = riskAmount * rr;
  const spreadUnits = quote?.spread === null || quote?.spread === undefined ? null : selected === 'XAUUSD' ? quote.spread : quote.spread / (selected === 'USDJPY' ? 0.01 : 0.0001);
  const spreadPct = spreadUnits !== null && stop > 0 ? spreadUnits / stop * 100 : null;
  const currentDateWAT = watDate(new Date(now));
  const hourWAT = watDecimalHour(new Date(now));
  const inSession = (hourWAT >= 8 && hourWAT < 12) || (hourWAT >= 13 && hourWAT < 17);
  const locked = journal.trades >= 2 || journal.losses >= 2;
  const dossier = useMemo(() => generatePairDossier(initialSnapshot, selected), [initialSnapshot, selected]);
  const macroPass = (dossier.confidence === 'HIGH' || dossier.confidence === 'MODERATE')
    && ((dossier.biasScore > 0 && direction === 'BUY') || (dossier.biasScore < 0 && direction === 'SELL'));
  const verifiedCalendar = initialSnapshot.calendarSource === 'provider';
  const nearEvent = verifiedCalendar && initialSnapshot.catalysts.some((event) => event.impact === 'High' && Math.abs(Date.parse(event.scheduledAt) - now) <= 30 * 60_000);
  const eventPass = verifiedCalendar && !nearEvent;
  const riskPass = Number.isFinite(account) && account > 0
    && Number.isFinite(stop) && stop > 0 && Number.isFinite(target) && target > 0
    && risk > 0 && risk <= 1 && lots >= 0.01
    && journal.trades < 2 && journal.losses < 2 && !locked;
  const quoteIsFresh = quote?.freshness === 'LIVE' && quote.ageMs !== null && quote.ageMs <= 60_000;
  const spreadPass = quoteIsFresh && rr >= 2 && spreadPct !== null && spreadPct < 15;
  const gates = [
    { name: 'Macro alignment', pass: macroPass, detail: dossier.confidence === 'INSUFFICIENT_EVIDENCE' ? 'No verified pair bias available' : `${dossier.biasScore} score · ${direction}` },
    { name: 'Lagos session', pass: inSession, detail: 'London 08:00–12:00 / New York 13:00–17:00 WAT' },
    { name: 'Tier-1 event risk', pass: eventPass, detail: !verifiedCalendar ? 'Calendar unverified; fail-closed' : nearEvent ? 'Event within ±30 minutes' : 'Verified calendar: clear' },
    { name: 'H4/H1 structure and liquidity', pass: technicalConfirmed, detail: 'Requires manual MT5 chart confirmation' },
    { name: 'Reward/risk and spread', pass: spreadPass, detail: `${rr.toFixed(2)}R · ${quoteIsFresh ? 'fresh quote' : 'quote stale/unavailable'} · spread ${spreadPct === null ? 'unavailable' : spreadPct.toFixed(1) + '% of SL'}` },
    { name: 'Daily risk circuit breaker', pass: riskPass, detail: `${risk.toFixed(2)}% · ${lots.toFixed(2)} lots · ${journal.trades}/2 trades · ${journal.losses}/2 losses` },
  ];
  const gatePassed = gates.every((gate) => gate.pass) && !locked;

  const refreshQuotes = useCallback(async () => {
    if (document.visibilityState === 'hidden') return;
    const response = await fetch('/api/v1/live-quotes', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Live quote proxy HTTP ${response.status}`);
    const payload = await response.json() as QuoteResponse;
    setQuotes(payload.quotes);
    setQuoteStatus(payload.status);
    setLatency(payload.latencyMs);
    setQuoteSync(payload.generatedAtUtc);
  }, []);
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

  const recordTrade = () => {
    const pnl = Number(pnlInput);
    if (!pnlInput.trim() || !Number.isFinite(pnl) || locked) return;
    setJournal((previous) => ({
      ...previous, trades: previous.trades + 1,
      wins: previous.wins + (resultInput === 'WIN' ? 1 : 0),
      losses: previous.losses + (resultInput === 'LOSS' ? 1 : 0),
      netPnl: Number((previous.netPnl + pnl).toFixed(2)),
      entries: [{ id: `${Date.now()}-${previous.entries.length}`, timeUtc: new Date().toISOString(), symbol: journalSymbol, result: resultInput, pnl }, ...previous.entries].slice(0, 20),
    }));
    setPnlInput('');
  };
  const forceSync = async () => {
    setForceSyncing(true);
    try { await refreshQuotes(); await refreshFx(); } catch { setQuoteStatus('DEGRADED'); }
    finally { setForceSyncing(false); }
  };
  const watClock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(now));
  const utcClock = new Date(now).toISOString().slice(11, 19);

  return <section id="desk-terminal" className="desk-terminal scroll-mt-24" aria-label="Quantitative trading desk terminal">
    <div className="desk-topbar">
      <div><span className="desk-kicker">FIDULYNC / SYSTEMATIC FX & COMMODITIES</span><h2>Quantitative Desk Terminal</h2></div>
      <div className="desk-top-meta"><span className={quoteStatus === 'HEALTHY' ? 'desk-live' : 'desk-warning'}><i />{quoteStatus === 'HEALTHY' && quotes.some((item) => item.freshness === 'LIVE' && item.ageMs !== null && item.ageMs <= 60_000) ? 'FRESH BBO · 15s' : quoteStatus === 'HEALTHY' ? 'STALE BBO' : quoteStatus}</span><span>WAT {watClock}</span><span>UTC {utcClock}</span><button type="button" onClick={() => void forceSync()} disabled={forceSyncing}>{forceSyncing ? 'SYNCING…' : 'FORCE SYNC'}</button></div>
    </div>
    <div className="desk-quote-grid">{symbols.map((symbol) => {
      const item = quoteFor(symbol); const digits = symbol === 'USDJPY' ? 3 : symbol === 'XAUUSD' ? 2 : 5;
      return <article className="desk-quote-card" key={symbol}><span>{symbol}</span><strong>{display(item?.mid, digits)}</strong><small>{item?.freshness ?? 'PENDING'} · {item?.latencyMs ?? '—'} ms</small><div><span>BID {display(item?.bid, digits)}</span><span>ASK {display(item?.ask, digits)}</span></div><small>SPREAD {display(item?.spread, symbol === 'XAUUSD' ? 2 : 6)} · {item?.quoteTimeUtc ?? 'NO QUOTE'}</small></article>;
    })}</div>
    <div className="desk-syncline"><span>Swissquote public BBO · {latency ?? '—'} ms</span><span>Retrieved {quoteSync ?? '—'}</span><span>Frankfurter {fxStatus} · {fxSync ?? '—'}</span></div>
    <div className="desk-workflow"><strong>DESK WORKFLOW</strong><span>1 Macro Bias</span><b>→</b><span>2 Position Sizing</span><b>→</b><span>3 6/6 Gate</span><b>→</b><span>4 MT5 Execution</span><b>→</b><span>5 Trade Journal</span></div>
    <div className="desk-grid">
      <article className="desk-panel"><header><div><span className="desk-kicker">01 / RELATIVE PERFORMANCE</span><h3>20-Day Currency Strength</h3></div><small>{strength.length ? 'DAILY REFERENCE RATES' : 'INSUFFICIENT HISTORY'}</small></header>
        {strength.length ? strength.map((item) => <div className="desk-strength-row" key={item.currency}><b>{item.currency}</b><span><i style={{ width: `${item.score * 10}%` }} /></span><strong>{item.score.toFixed(2)}</strong></div>) : <p className="desk-empty">Awaiting dated FX reference observations. Reference rates are not executable prices.</p>}
        <p className="desk-footnote">Scores compare the latest 20 available business-day observations with USD. They are reference-rate strength estimates, not intraday market momentum.</p>
      </article>
      <article className="desk-panel"><header><div><span className="desk-kicker">02 / LIVE RISK CALCULATOR</span><h3>Position Sizing</h3></div><small>IC MARKETS · STANDARD LOT ASSUMPTIONS</small></header>
        <div className="desk-form-grid">
          <label>Account balance USD<input inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} /></label>
          <label>Risk %<input inputMode="decimal" value={riskPct} onChange={(e) => setRiskPct(e.target.value)} /></label>
          <label>Instrument<select value={selected} onChange={(e) => { setSelected(e.target.value as SymbolCode); setJournalSymbol(e.target.value as SymbolCode); }}><option value="EURUSD">EUR/USD</option><option value="GBPUSD">GBP/USD</option><option value="XAUUSD">XAU/USD</option><option value="USDJPY">USD/JPY</option></select></label>
          <label>{selected === 'XAUUSD' ? 'Stop distance ($)' : 'Stop loss (pips)'}<input inputMode="decimal" value={sl} onChange={(e) => setSl(e.target.value)} /></label>
          <label>{selected === 'XAUUSD' ? 'Target distance ($)' : 'Take profit (pips)'}<input inputMode="decimal" value={tp} onChange={(e) => setTp(e.target.value)} /></label>
          <label>Direction<select value={direction} onChange={(e) => setDirection(e.target.value as Direction)}><option value="BUY">BUY</option><option value="SELL">SELL</option></select></label>
        </div>
        <div className="desk-calc-results"><div><span>RISK AMOUNT</span><strong>${riskAmount.toFixed(2)}</strong></div><div><span>LOT SIZE · ROUNDED DOWN</span><strong>{lots.toFixed(2)}</strong></div><div><span>REWARD / RISK</span><strong className={rr >= 2 ? 'desk-good' : 'desk-warning'}>{rr.toFixed(2)}R</strong></div><div><span>EXPECTED GROSS PROFIT</span><strong>${gross.toFixed(2)}</strong></div></div>
        <p className="desk-footnote">{selected === 'USDJPY' ? `USDJPY pip value: 1,000 / live ${display(usdJpy, 3)} = ${pipValue?.toFixed(4) ?? 'unavailable'} USD per pip per lot.` : selected === 'XAUUSD' ? 'Gold assumption: 100 oz per standard lot; $100 P/L per $1.00 price move per lot.' : 'FX assumption: $10 USD pip value per standard lot for EUR/USD and GBP/USD.'} Excludes commissions, slippage, swaps and broker contract variations.</p>
        {risk > 1 && <p className="desk-warning-text">Risk exceeds the 1.0% governance ceiling.</p>}{lots > 0 && lots < 0.01 && <p className="desk-warning-text">Below 0.01 lot: skip, never round size up.</p>}{rr < 2 && <p className="desk-warning-text">R:R is below the required 1:2.0.</p>}
      </article>
    </div>
    <div className="desk-grid">
      <article className="desk-panel"><header><div><span className="desk-kicker">03 / GOVERNANCE</span><h3>Mandatory 6/6 Pre-Trade Gate</h3></div><small>{gates.filter((gate) => gate.pass).length}/6 PASSED</small></header>
        <div className="desk-gate-list">{gates.map((gate, index) => <div className="desk-gate-row" key={gate.name}><span className={gate.pass ? 'desk-gate-pass' : 'desk-gate-fail'}>{gate.pass ? 'PASS' : 'BLOCK'}</span><div><b>{index + 1}. {gate.name}</b><small>{gate.detail}</small></div>{index === 3 && <label className="desk-check"><input type="checkbox" checked={technicalConfirmed} onChange={(e) => setTechnicalConfirmed(e.target.checked)} /> MT5 confirmed</label>}</div>)}</div>
        <div className={locked ? 'desk-lockout' : gatePassed ? 'desk-clear' : 'desk-blocked'}>{locked ? 'DAILY CIRCUIT BREAKER ACTIVE · LOCKED UNTIL 00:00 WAT' : gatePassed ? '6/6 CHECKS PASSED · MT5 EXECUTION REMAINS MANUAL' : 'GATE CLOSED · ALL SIX CONDITIONS MUST PASS'}</div>
        <p className="desk-footnote">Calendar must be verified before the event gate can pass. This checklist does not submit orders or control MT5. Local state is not a broker-enforced lockout.</p>
      </article>
      <article className="desk-panel"><header><div><span className="desk-kicker">04 / DAILY RISK CONTROL</span><h3>WAT Daily Circuit Breaker</h3></div><small>{currentDateWAT}</small></header>
        <div className="desk-journal-stats"><div><span>TRADES</span><b>{journal.trades}/2</b></div><div><span>WINS</span><b>{journal.wins}</b></div><div><span>LOSSES</span><b>{journal.losses}/2</b></div><div><span>NET P&amp;L</span><b className={journal.netPnl >= 0 ? 'desk-good' : 'desk-warning'}>${journal.netPnl.toFixed(2)}</b></div></div>
        <div className="desk-form-grid desk-journal-form"><label>Result<select value={resultInput} onChange={(e) => setResultInput(e.target.value as 'WIN' | 'LOSS' | 'FLAT')}><option>WIN</option><option>LOSS</option><option>FLAT</option></select></label><label>Realized P&amp;L USD<input inputMode="decimal" value={pnlInput} onChange={(e) => setPnlInput(e.target.value)} placeholder="Closed trade P&L" /></label><label>Instrument<select value={journalSymbol} onChange={(e) => setJournalSymbol(e.target.value as SymbolCode)}>{symbols.map((s) => <option key={s}>{s}</option>)}</select></label></div>
        <button className="desk-record-button" type="button" disabled={!pnlInput.trim() || !Number.isFinite(Number(pnlInput)) || locked} onClick={recordTrade}>RECORD CLOSED TRADE</button>
        <div className="desk-journal-list">{journal.entries.slice(0, 5).map((entry) => <div key={entry.id}><span>{entry.symbol} · {entry.result}</span><b className={entry.pnl >= 0 ? 'desk-good' : 'desk-warning'}>{entry.pnl >= 0 ? '+' : ''}${entry.pnl.toFixed(2)}</b><small>{entry.timeUtc}</small></div>)}</div>
        <p className="desk-footnote">Journal persists in this browser only. Browser storage clearing or switching devices resets it. MT5 must independently enforce the same hard limits.</p>
      </article>
    </div>
    <article className="desk-panel desk-bridge"><header><div><span className="desk-kicker">05 / V2 PYTHON + MT5 BRIDGE</span><h3>Typed Context Preview</h3></div><small>READ-ONLY JSON</small></header>
      <p>V2 will pass server-verified macro context and quote provenance to the Python VPS adapter. MT5 must independently validate the daily lockout and account-level risk before execution.</p>
      <pre>{JSON.stringify({ schemaVersion: '1.0.0', generatedAtUtc: new Date(now).toISOString(), timezone: 'Africa/Lagos', quotes: quotes.map((q) => ({ symbol: q.symbol, bid: q.bid, ask: q.ask, mid: q.mid, spread: q.spread, quoteTimeUtc: q.quoteTimeUtc, freshness: q.freshness, source: q.source })), pairBias: { symbol: selected, score: dossier.confidence === 'INSUFFICIENT_EVIDENCE' ? null : dossier.biasScore, confidence: dossier.confidence }, newsLockout: { calendarVerified: verifiedCalendar, active: !eventPass }, dailyGovernance: { dateWAT: journal.dateWAT, trades: journal.trades, losses: journal.losses, locked, authority: 'LOCAL_BROWSER_ONLY' } }, null, 2)}</pre>
      <p className="desk-footnote">This is a browser-side preview. The authenticated /api/v1/macro-context endpoint remains the server-side EA bridge.</p>
    </article>
  </section>;
}
