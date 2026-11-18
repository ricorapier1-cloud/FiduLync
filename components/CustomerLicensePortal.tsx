'use client';

import { useState } from 'react';

type PortalData = {
  license: { mt5_account: number; tier: string; status: string; expires_at: string | null; created_at: string };
  masked_email: string;
  heartbeat: null | { connection_status: string; ea_name: string; balance: number; equity: number; floating_pnl: number; drawdown_pct: number; open_positions: number; updated_at: string };
  trades: Array<{ ticket: string; symbol: string; direction: string; profit_usd: number; r_multiple: number; closed_at_utc: string }>;
};

export default function CustomerLicensePortal() {
  const [account, setAccount] = useState('');
  const [license, setLicense] = useState('');
  const [data, setData] = useState<PortalData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [newAccount, setNewAccount] = useState('');
  const [requestId, setRequestId] = useState('');
  const [code, setCode] = useState('');
  const [transferMessage, setTransferMessage] = useState('');

  async function load(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setData(null);
    try {
      const response = await fetch('/api/v1/customer-portal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mt5_account: account, license_key: license }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to open your license dashboard.');
      setData(result);
    } catch (e) { setError(e instanceof Error ? e.message : 'Dashboard unavailable.'); }
    finally { setBusy(false); }
  }

  async function transfer(action: 'request' | 'confirm') {
    setBusy(true); setTransferMessage(''); setError('');
    try {
      const response = await fetch('/api/v1/license-transfer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action, license_key: license, current_mt5_account: account,
          new_mt5_account: newAccount, request_id: requestId, code,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Transfer could not be completed.');
      if (action === 'request') {
        setRequestId(result.request_id);
        setTransferMessage(`A confirmation code was sent to ${result.masked_email}. It expires in 10 minutes.`);
      } else {
        setAccount(String(result.mt5_account));
        setRequestId(''); setCode(''); setNewAccount('');
        setTransferMessage(result.message || 'Account transfer completed.');
        setData(null);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Transfer unavailable.'); }
    finally { setBusy(false); }
  }

  const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return <div className="mx-auto max-w-5xl px-4 py-10 text-slate-100 sm:px-6">
    <div className="mb-8">
      <p className="font-mono text-[10px] tracking-[.2em] text-cyan-300">ALGOLYNX / CUSTOMER ACCESS</p>
      <h1 className="mt-2 text-3xl font-semibold">My License Dashboard</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-400">View your license status and account telemetry. Access is verified against your license key and MT5 account. Never share your broker password.</p>
    </div>
    <form onSubmit={load} className="grid gap-3 rounded-xl border border-white/10 bg-[#0a111b] p-5 sm:grid-cols-[1fr_1.3fr_auto]">
      <label className="text-xs text-slate-400">MT5 account number
        <input required inputMode="numeric" value={account} onChange={e=>setAccount(e.target.value)} className="mt-2 h-11 w-full rounded border border-white/10 bg-black/30 px-3 font-mono text-sm text-white" placeholder="Your MT5 login"/>
      </label>
      <label className="text-xs text-slate-400">License key
        <input required type="password" autoComplete="off" value={license} onChange={e=>setLicense(e.target.value)} className="mt-2 h-11 w-full rounded border border-white/10 bg-black/30 px-3 font-mono text-sm text-white" placeholder="ALGOLYNX-..."/>
      </label>
      <button disabled={busy} className="mt-5 h-11 rounded bg-cyan-300 px-5 text-sm font-semibold text-slate-950 disabled:opacity-50">{busy?'VERIFYING…':'OPEN DASHBOARD'}</button>
    </form>
    {error && <p role="alert" className="mt-4 rounded border border-rose-400/20 bg-rose-400/5 p-3 text-sm text-rose-300">{error}</p>}
    {data && <>
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['LICENSE STATUS',data.license.status.toUpperCase()],
          ['PLAN',data.license.tier.replaceAll('_',' ')],
          ['BOUND MT5 ACCOUNT',String(data.license.mt5_account)],
          ['EXPIRES',data.license.expires_at?new Date(data.license.expires_at).toLocaleDateString():'LIFETIME'],
        ].map(([label,value])=><div key={label} className="rounded-xl border border-white/10 bg-[#0a111b] p-4"><p className="font-mono text-[9px] text-slate-500">{label}</p><p className="mt-2 text-sm font-semibold">{value}</p></div>)}
      </section>
      <section className="mt-5 rounded-xl border border-white/10 bg-[#0a111b] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">MT5 connection</h2><p className="mt-1 text-xs text-slate-500">Read-only telemetry · {data.heartbeat?.ea_name || 'No EA heartbeat received yet'}</p></div><span className="rounded border border-white/10 px-3 py-1 font-mono text-xs">{data.heartbeat?.connection_status || 'STANDBY'}</span></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ['BALANCE',data.heartbeat?money(data.heartbeat.balance):'—'],
            ['EQUITY',data.heartbeat?money(data.heartbeat.equity):'—'],
            ['FLOATING P&L',data.heartbeat?money(data.heartbeat.floating_pnl):'—'],
            ['DRAWDOWN',data.heartbeat?data.heartbeat.drawdown_pct.toFixed(2)+'%':'—'],
            ['OPEN POSITIONS',data.heartbeat?String(data.heartbeat.open_positions):'—'],
          ].map(([label,value])=><div key={label} className="rounded-lg bg-white/[0.03] p-3"><p className="font-mono text-[9px] text-slate-500">{label}</p><p className="mt-2 font-mono text-sm">{value}</p></div>)}
        </div>
        {data.heartbeat && <p className="mt-3 text-[10px] text-slate-500">Last update: {new Date(data.heartbeat.updated_at).toLocaleString()}</p>}
      </section>
      <section className="mt-5 rounded-xl border border-white/10 bg-[#0a111b] p-5">
        <h2 className="font-semibold">Recent closed trades</h2>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[500px] text-left text-xs"><thead className="text-slate-500"><tr>{['CLOSED UTC','SYMBOL','SIDE','P&L USD','R MULTIPLE'].map(x=><th key={x} className="pb-3 pr-4 font-mono text-[9px] font-normal">{x}</th>)}</tr></thead><tbody className="divide-y divide-white/5">{data.trades.map(t=><tr key={t.ticket+t.symbol}><td className="py-3 pr-4 text-slate-400">{new Date(t.closed_at_utc).toLocaleString('en-GB',{timeZone:'UTC'})}</td><td className="py-3 pr-4">{t.symbol}</td><td className="py-3 pr-4">{t.direction}</td><td className="py-3 pr-4">{money(t.profit_usd)}</td><td className="py-3 pr-4">{t.r_multiple.toFixed(2)}R</td></tr>)}{data.trades.length===0&&<tr><td colSpan={5} className="py-5 text-center text-slate-500">No closed trades received for this account yet.</td></tr>}</tbody></table></div>
      </section>
      <section className="mt-5 rounded-xl border border-amber-300/20 bg-[#11100c] p-5">
        <h2 className="font-semibold">Move license to another MT5 account</h2>
        <p className="mt-1 text-xs leading-5 text-slate-400">A one-time code is sent to the registered email ({data.masked_email}). A successful transfer immediately moves this license and clears the previous account heartbeat. Only transfer to an account you control.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="text-xs text-slate-400">New MT5 account number<input value={newAccount} onChange={e=>setNewAccount(e.target.value)} inputMode="numeric" className="mt-2 h-10 w-full rounded border border-white/10 bg-black/30 px-3 font-mono text-sm text-white" placeholder="New MT5 login"/></label>
          {!requestId?<button disabled={busy||!newAccount} onClick={()=>void transfer('request')} className="mt-5 rounded border border-amber-300/30 px-4 py-2 text-xs text-amber-100 disabled:opacity-40">SEND EMAIL CODE</button>:<div className="flex gap-2"><input value={code} onChange={e=>setCode(e.target.value)} inputMode="numeric" maxLength={6} placeholder="6-digit code" className="mt-5 min-w-0 rounded border border-white/10 bg-black/30 px-3 font-mono text-sm text-white"/><button disabled={busy||code.length!==6} onClick={()=>void transfer('confirm')} className="mt-5 rounded bg-amber-300 px-4 py-2 text-xs font-semibold text-black disabled:opacity-40">CONFIRM</button></div>}
        </div>
        {transferMessage&&<p className="mt-3 text-xs text-emerald-300">{transferMessage}</p>}
      </section>
    </>}
    <p className="mt-7 text-center text-[11px] text-slate-600">Protect your license key. FiduLync will never ask for your MT5 investor or master password.</p>
  </div>;
}
