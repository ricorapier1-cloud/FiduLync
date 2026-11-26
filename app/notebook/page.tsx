'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

type Session = 'LONDON' | 'NY' | 'OFF-SESSION';
type JournalTrade = {
  id: string; timeUtc: string; symbol: string; direction: 'BUY' | 'SELL';
  macroBiasScore: number | null; hurstRegime: string | null; vixLevel: number | null;
  session: Session; riskPct: number | null; rMultiple: number | null; pnlUsd: number;
  macroAlignment: 'ALIGNED' | 'COUNTER' | 'UNKNOWN';
};
const KEY = 'fidulync-quant-trade-journal-v1';
const DESK_KEY = 'fidulync-desk-journal-v1';
const money = (v: number) => (v < 0 ? '-$' : '$') + Math.abs(v).toFixed(2);
const num = (v: unknown): number | null => { const parsed = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN; return Number.isFinite(parsed) ? parsed : null; };
const csvCell = (v: unknown) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) { const ch = text[i];
    if (ch === '"' && quoted && text[i + 1] === '"') { cell += '"'; i++; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  row.push(cell); if (row.some(Boolean)) rows.push(row);
  const headers = (rows.shift() ?? []).map(x => x.trim());
  return rows.map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''])));
}
function normalize(raw: Record<string, unknown>): JournalTrade | null {
  const pnlUsd = Number(raw.pnlUsd ?? raw.pnl);
  const symbol = String(raw.symbol ?? '').toUpperCase();
  if (!symbol || !Number.isFinite(pnlUsd)) return null;
  const direction = raw.direction === 'SELL' ? 'SELL' : 'BUY';
  const sessionRaw = String(raw.session ?? 'OFF-SESSION').toUpperCase();
  const alignmentRaw = String(raw.macroAlignment ?? 'UNKNOWN').toUpperCase();
  return {
    id: String(raw.id ?? crypto.randomUUID()), timeUtc: String(raw.timeUtc ?? new Date().toISOString()),
    symbol, direction, macroBiasScore: num(raw.macroBiasScore), hurstRegime: typeof raw.hurstRegime === 'string' ? raw.hurstRegime : null,
    vixLevel: num(raw.vixLevel), session: sessionRaw === 'LONDON' ? 'LONDON' : sessionRaw === 'NY' || sessionRaw === 'NEW YORK' ? 'NY' : 'OFF-SESSION',
    riskPct: num(raw.riskPct), rMultiple: num(raw.rMultiple), pnlUsd,
    macroAlignment: alignmentRaw === 'ALIGNED' ? 'ALIGNED' : alignmentRaw === 'COUNTER' || alignmentRaw === 'COUNTER-MACRO' ? 'COUNTER' : 'UNKNOWN',
  };
}
function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="rounded-xl border border-white/10 bg-[#0c121a] p-4"><div className="text-[10px] tracking-[.16em] text-slate-500">{label}</div><div className="mt-2 text-xl font-semibold text-slate-100">{value}</div>{hint && <div className="mt-1 text-[10px] text-slate-500">{hint}</div>}</div>;
}
export default function TradeJournalPage() {
  const [trades, setTrades] = useState<JournalTrade[]>([]);
  const [ready, setReady] = useState(false);
  const [symbol, setSymbol] = useState('EURUSD');
  const [direction, setDirection] = useState<'BUY' | 'SELL'>('BUY');
  const [pnl, setPnl] = useState('');
  const [riskPct, setRiskPct] = useState('1');
  const [rMultiple, setRMultiple] = useState('');
  const [session, setSession] = useState<Session>('LONDON');
  const [biasScore, setBiasScore] = useState('');
  const [hurst, setHurst] = useState('');
  const [vix, setVix] = useState('');
  const [alignment, setAlignment] = useState<'ALIGNED' | 'COUNTER' | 'UNKNOWN'>('UNKNOWN');
  const [capital, setCapital] = useState('10000');
  const [filterSymbol, setFilterSymbol] = useState('ALL');
  const [filterOutcome, setFilterOutcome] = useState('ALL');
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    try {
      const main = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
      const desk = JSON.parse(localStorage.getItem(DESK_KEY) ?? '{"entries":[]}') as { entries?: Record<string, unknown>[] };
      const imported = Array.isArray(main) ? main as Record<string, unknown>[] : [];
      const fromDesk = Array.isArray(desk.entries) ? desk.entries : [];
      const merged = new Map<string, JournalTrade>();
      [...imported, ...fromDesk].forEach(raw => { const item = normalize(raw); if (item) merged.set(item.id, item); });
      setTrades([...merged.values()].sort((a,b) => b.timeUtc.localeCompare(a.timeUtc)));
    } catch { setTrades([]); }
    setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(KEY, JSON.stringify(trades)); }, [trades, ready]);

  const ordered = useMemo(() => [...trades].sort((a,b) => a.timeUtc.localeCompare(b.timeUtc)), [trades]);
  const stats = useMemo(() => {
    const count = trades.length, wins = trades.filter(t => t.pnlUsd > 0), losses = trades.filter(t => t.pnlUsd < 0);
    const grossProfit = wins.reduce((s,t)=>s+t.pnlUsd,0), grossLoss = Math.abs(losses.reduce((s,t)=>s+t.pnlUsd,0));
    const net = trades.reduce((s,t)=>s+t.pnlUsd,0), totalR = trades.reduce((s,t)=>s+(t.rMultiple ?? 0),0);
    let equity = Number(capital), peak = equity, maxDd = 0;
    ordered.forEach(t => { equity += t.pnlUsd; peak = Math.max(peak,equity); if (peak > 0) maxDd = Math.max(maxDd,(peak-equity)/peak*100); });
    let streak = 0, streakType = '';
    for (let i=ordered.length-1;i>=0;i--) { const type=ordered[i].pnlUsd>0?'WIN':ordered[i].pnlUsd<0?'LOSS':'FLAT'; if(type==='FLAT') break; if(!streakType) streakType=type; if(type!==streakType) break; streak++; }
    return {count,wins:wins.length,losses:losses.length,net,grossProfit,grossLoss,pf:grossLoss>0?grossProfit/grossLoss:null,winRate:count?wins.length/count*100:0,totalR,expectancy:count?net/count:0,expectancyR:count?totalR/count:0,maxDd,streak,streakType};
  }, [trades, ordered, capital]);
  const filtered = trades.filter(t => (filterSymbol==='ALL'||t.symbol===filterSymbol) && (filterOutcome==='ALL'||(filterOutcome==='WIN'?t.pnlUsd>0:filterOutcome==='LOSS'?t.pnlUsd<0:t.pnlUsd===0)));
  const groups = useMemo(() => {
    const calc = (label: string, subset: JournalTrade[]) => ({label,n:subset.length,pnl:subset.reduce((s,t)=>s+t.pnlUsd,0),win:subset.length?subset.filter(t=>t.pnlUsd>0).length/subset.length*100:0,avgR:subset.length?subset.reduce((s,t)=>s+(t.rMultiple??0),0)/subset.length:0});
    const instruments = ['EURUSD','XAUUSD','USDJPY','SATELLITE'];
    const instrumentRows = instruments.map(k=>calc(k,trades.filter(t=>k==='SATELLITE'?!['EURUSD','XAUUSD','USDJPY'].includes(t.symbol):t.symbol===k)));
    const sessionRows = (['LONDON','NY'] as const).map(k=>calc(k==='NY'?'NEW YORK':'LONDON',trades.filter(t=>t.session===k)));
    const macroRows = (['ALIGNED','COUNTER'] as const).map(k=>calc(k==='ALIGNED'?'ALIGNED':'COUNTER-MACRO',trades.filter(t=>t.macroAlignment===k)));
    return [...instrumentRows,...sessionRows,...macroRows];
  }, [trades]);
  const resetForm = () => { setEditing(null); setPnl(''); setRMultiple(''); setBiasScore(''); setHurst(''); setVix(''); };
  const saveTrade = (e: FormEvent) => {
    e.preventDefault(); const pnlValue=Number(pnl), rValue=rMultiple.trim()?Number(rMultiple):null;
    if (!Number.isFinite(pnlValue) || (rValue!==null&&!Number.isFinite(rValue))) return;
    const existing=trades.find(t=>t.id===editing);
    const item: JournalTrade = { id: editing ?? crypto.randomUUID(), timeUtc: existing?.timeUtc ?? new Date().toISOString(), symbol, direction,
      pnlUsd:pnlValue, riskPct:Number(riskPct)||null, rMultiple:rValue, session, macroBiasScore:biasScore.trim()?Number(biasScore):null,
      hurstRegime:hurst.trim()||null, vixLevel:vix.trim()?Number(vix):null, macroAlignment:alignment };
    setTrades(prev=>[item,...prev.filter(t=>t.id!==item.id)].sort((a,b)=>b.timeUtc.localeCompare(a.timeUtc)));
    resetForm(); setMessage('Trade saved locally.');
  };
  const editTrade = (t: JournalTrade) => { setEditing(t.id); setSymbol(t.symbol);setDirection(t.direction);setPnl(String(t.pnlUsd));setRiskPct(t.riskPct===null?'':String(t.riskPct));setRMultiple(t.rMultiple===null?'':String(t.rMultiple));setSession(t.session);setBiasScore(t.macroBiasScore===null?'':String(t.macroBiasScore));setHurst(t.hurstRegime??'');setVix(t.vixLevel===null?'':String(t.vixLevel));setAlignment(t.macroAlignment);window.scrollTo({top:0,behavior:'smooth'}); };
  const exportJson = () => download('fidulync-trade-journal.json',JSON.stringify({schemaVersion:'1.0.0',timezone:'Africa/Lagos',exportedAtUtc:new Date().toISOString(),trades},null,2),'application/json');
  const exportCsv = () => { const headers=Object.keys(trades[0]??{id:'',timeUtc:'',symbol:'',direction:'',macroBiasScore:'',hurstRegime:'',vixLevel:'',session:'',riskPct:'',rMultiple:'',pnlUsd:'',macroAlignment:''}); download('fidulync-trade-journal.csv',[headers.join(','),...trades.map(t=>headers.map(h=>csvCell((t as unknown as Record<string,unknown>)[h])).join(','))].join('\n'),'text/csv'); };
  const importFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file=e.target.files?.[0]; if(!file)return; const raw=await file.text();
    try { const parsed=file.name.toLowerCase().endsWith('.csv')?parseCsv(raw):JSON.parse(raw) as unknown;
      const rows=Array.isArray(parsed)?parsed:(parsed&&typeof parsed==='object'&&Array.isArray((parsed as {trades?:unknown[]}).trades)?(parsed as {trades:unknown[]}).trades:[]);
      const normalized=rows.map(x=>normalize(x as Record<string,unknown>)).filter((x):x is JournalTrade=>x!==null);
      if(!normalized.length)throw new Error('No valid trade records found');
      setTrades(prev=>{const map=new Map(prev.map(t=>[t.id,t]));normalized.forEach(t=>map.set(t.id,t));return [...map.values()].sort((a,b)=>b.timeUtc.localeCompare(a.timeUtc));});
      setMessage('Imported '+normalized.length+' trade records.');
    } catch { setMessage('Import failed: file format or trade fields are invalid.'); } e.target.value='';
  };
  return <div className="macro-page pb-36 sm:pb-12">
    <div className="macro-statusline mono"><span><span className="macro-pulse macro-pulse-live" /> QUANT TRADE JOURNAL / LOCAL PRIVATE LEDGER</span><span className="text-[10px] text-slate-500">UTC RECORDS · WAT OPERATING CONTEXT</span></div>
    <section className="macro-intro"><div><span className="eyebrow">PERFORMANCE GOVERNANCE</span><h1>Quant Trade Journal.<br/><span>Measure the edge.</span></h1><p>Closed-trade ledger, risk-normalized outcomes and attribution analytics. Desk records are synchronized through this browser's local storage; no trade data is transmitted to a server.</p></div><div className="macro-intro-meta mono"><span>LEDGER / {trades.length} RECORDS</span><span className="macro-provenance">P&amp;L is user-recorded. Missing macro or regime observations remain null rather than being fabricated.</span></div></section>
    <section className="mt-6"><div className="flex flex-wrap items-end justify-between gap-3 mb-3"><div><span className="eyebrow">01 / PERFORMANCE SUMMARY</span><h2 className="text-lg font-semibold text-slate-100">Institutional KPIs</h2></div><label className="text-[10px] text-slate-500">STARTING EQUITY USD<input className="ml-2 w-28 rounded border border-white/10 bg-[#0c1016] p-2 text-slate-200" value={capital} onChange={e=>setCapital(e.target.value)} inputMode="decimal"/></label></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><Metric label="NET P&amp;L" value={money(stats.net)} hint={Number(capital)>0?(stats.net/Number(capital)*100).toFixed(2)+'% of starting equity':'Set starting equity'}/><Metric label="TOTAL R GAINED" value={stats.totalR.toFixed(2)+'R'}/><Metric label="WIN RATE" value={stats.winRate.toFixed(1)+'%'} hint={stats.wins+' wins / '+stats.losses+' losses'}/><Metric label="PROFIT FACTOR" value={stats.pf===null?'—':stats.pf.toFixed(2)}/><Metric label="EXPECTANCY" value={money(stats.expectancy)+' / trade'} hint={stats.expectancyR.toFixed(2)+'R per trade'}/><Metric label="MAX DRAWDOWN" value={stats.maxDd.toFixed(2)+'%'} hint="Peak-to-trough equity drawdown"/><Metric label="CURRENT STREAK" value={stats.streak?stats.streak+' '+stats.streakType:'—'} hint="Most recent consecutive outcomes"/><Metric label="GROSS PROFIT / LOSS" value={money(stats.grossProfit)+' / '+money(-stats.grossLoss)}/></div>
    </section>
    <section className="mt-8 grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,.8fr)] gap-5">
      <div className="macro-panel p-5"><span className="eyebrow">02 / TRADE CAPTURE</span><h2 className="text-lg font-semibold text-slate-100 mb-4">{editing?'Edit closed trade':'Record closed trade'}</h2>
        <form onSubmit={saveTrade} className="grid grid-cols-2 gap-3 text-xs">
          <label className="text-slate-400">Instrument<select className="macro-select-wrap w-full mt-1 p-2 bg-[#0c1016]" value={symbol} onChange={e=>setSymbol(e.target.value)}>{['EURUSD','XAUUSD','USDJPY','GBPUSD','AUDUSD','USDCAD','USDCHF','NZDUSD'].map(x=><option key={x}>{x}</option>)}</select></label>
          <label className="text-slate-400">Direction<select className="w-full mt-1 p-2 bg-[#0c1016] border border-white/10 rounded" value={direction} onChange={e=>setDirection(e.target.value as 'BUY'|'SELL')}><option>BUY</option><option>SELL</option></select></label>
          <label className="text-slate-400">Realized P&amp;L USD<input required className="w-full mt-1 p-2 bg-[#0c1016] border border-white/10 rounded" value={pnl} onChange={e=>setPnl(e.target.value)} type="number" step="any"/></label>
          <label className="text-slate-400">R-multiple<input className="w-full mt-1 p-2 bg-[#0c1016] border border-white/10 rounded" value={rMultiple} onChange={e=>setRMultiple(e.target.value)} type="number" step="any" placeholder="Optional"/></label>
          <label className="text-slate-400">Risk %<input className="w-full mt-1 p-2 bg-[#0c1016] border border-white/10 rounded" value={riskPct} onChange={e=>setRiskPct(e.target.value)} type="number" step="any"/></label>
          <label className="text-slate-400">Session<select className="w-full mt-1 p-2 bg-[#0c1016] border border-white/10 rounded" value={session} onChange={e=>setSession(e.target.value as Session)}><option value="LONDON">London</option><option value="NY">New York</option><option value="OFF-SESSION">Off-session</option></select></label>
          <label className="text-slate-400">Macro bias score<input className="w-full mt-1 p-2 bg-[#0c1016] border border-white/10 rounded" value={biasScore} onChange={e=>setBiasScore(e.target.value)} type="number" step="any" placeholder="Unknown"/></label>
          <label className="text-slate-400">Hurst / regime<input className="w-full mt-1 p-2 bg-[#0c1016] border border-white/10 rounded" value={hurst} onChange={e=>setHurst(e.target.value)} placeholder="Unknown"/></label>
          <label className="text-slate-400">VIX level<input className="w-full mt-1 p-2 bg-[#0c1016] border border-white/10 rounded" value={vix} onChange={e=>setVix(e.target.value)} type="number" step="any" placeholder="Unknown"/></label>
          <label className="text-slate-400">Macro alignment<select className="w-full mt-1 p-2 bg-[#0c1016] border border-white/10 rounded" value={alignment} onChange={e=>setAlignment(e.target.value as typeof alignment)}><option value="UNKNOWN">Unknown</option><option value="ALIGNED">Aligned</option><option value="COUNTER">Counter-macro</option></select></label>
          <div className="col-span-2 flex flex-wrap gap-2 pt-2"><button className="macro-record-button rounded border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-emerald-200" type="submit">{editing?'Save changes':'Record trade'}</button>{editing&&<button type="button" onClick={resetForm} className="rounded border border-white/10 px-4 py-2 text-slate-300">Cancel</button>}</div>
        </form>{message&&<p className="mt-3 text-xs text-emerald-300" role="status">{message}</p>}
      </div>
      <div className="macro-panel p-5"><span className="eyebrow">03 / DATA OPERATIONS</span><h2 className="text-lg font-semibold text-slate-100 mb-4">Ledger controls</h2><div className="space-y-3 text-xs text-slate-300"><button onClick={exportCsv} className="w-full rounded border border-white/10 p-3 text-left hover:border-emerald-400/40">Export CSV <span className="float-right text-slate-500">Download ledger</span></button><button onClick={exportJson} className="w-full rounded border border-white/10 p-3 text-left hover:border-emerald-400/40">Export JSON <span className="float-right text-slate-500">Full-fidelity backup</span></button><label className="block rounded border border-white/10 p-3 cursor-pointer">Import JSON / CSV<input className="block mt-2 text-[10px]" type="file" accept=".json,.csv,application/json,text/csv" onChange={importFile}/></label><p className="text-[10px] text-slate-500">Imports merge by trade ID. Keep regular exports: local browser storage is not cloud backup.</p></div></div>
    </section>
    <section className="mt-8"><div className="mb-3"><span className="eyebrow">04 / EDGE ATTRIBUTION</span><h2 className="text-lg font-semibold text-slate-100">Where performance is generated</h2></div><div className="overflow-x-auto rounded-xl border border-white/10"><table className="w-full text-xs"><thead className="bg-white/[.04] text-slate-400"><tr>{['Segment','Trades','Net P&L','Win rate','Average R'].map(x=><th key={x} className="p-3 text-left">{x}</th>)}</tr></thead><tbody>{groups.map(g=><tr key={g.label} className="border-t border-white/[.07]"><td className="p-3 text-slate-200">{g.label}</td><td className="p-3">{g.n}</td><td className="p-3">{money(g.pnl)}</td><td className="p-3">{g.win.toFixed(1)}%</td><td className="p-3">{g.avgR.toFixed(2)}R</td></tr>)}</tbody></table></div></section>
    <section className="mt-8"><div className="flex flex-wrap items-end justify-between gap-3 mb-3"><div><span className="eyebrow">05 / AUDITABLE LEDGER</span><h2 className="text-lg font-semibold text-slate-100">Closed trades</h2></div><div className="flex gap-2"><select className="rounded border border-white/10 bg-[#0c1016] p-2 text-xs" value={filterSymbol} onChange={e=>setFilterSymbol(e.target.value)}><option value="ALL">All instruments</option>{[...new Set(trades.map(t=>t.symbol))].map(x=><option key={x}>{x}</option>)}</select><select className="rounded border border-white/10 bg-[#0c1016] p-2 text-xs" value={filterOutcome} onChange={e=>setFilterOutcome(e.target.value)}><option value="ALL">All outcomes</option><option value="WIN">Wins</option><option value="LOSS">Losses</option><option value="FLAT">Flat</option></select></div></div>
      <div className="overflow-x-auto rounded-xl border border-white/10"><table className="w-full min-w-[850px] text-xs"><thead className="bg-white/[.04] text-slate-400"><tr>{['Time (UTC)','Instrument','Side','Session','Macro','R','P&L','Actions'].map(x=><th key={x} className="p-3 text-left">{x}</th>)}</tr></thead><tbody>{filtered.map(t=><tr key={t.id} className="border-t border-white/[.07]"><td className="p-3 text-slate-400">{t.timeUtc}</td><td className="p-3 text-slate-200">{t.symbol}</td><td className="p-3">{t.direction}</td><td className="p-3">{t.session}</td><td className="p-3">{t.macroAlignment}</td><td className="p-3">{t.rMultiple===null?'—':t.rMultiple.toFixed(2)+'R'}</td><td className={'p-3 '+(t.pnlUsd>=0?'text-emerald-300':'text-rose-300')}>{money(t.pnlUsd)}</td><td className="p-3"><button onClick={()=>editTrade(t)} className="mr-3 text-cyan-300">Edit</button><button onClick={()=>setTrades(prev=>prev.filter(x=>x.id!==t.id))} className="text-rose-300">Delete</button></td></tr>)}{filtered.length===0&&<tr><td colSpan={8} className="p-8 text-center text-slate-500">No trades match this filter.</td></tr>}</tbody></table></div>
    </section>
  </div>;
}
