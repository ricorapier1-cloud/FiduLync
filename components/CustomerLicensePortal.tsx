'use client';

import { useEffect, useState } from 'react';

type PortalData = {
  license: { mt5_account: number; tier: string; status: string; expires_at: string | null; created_at: string; ea_slug: string | null; billing_cycle: string | null; period_ends_at: string | null; included_live_seats: number; included_demo_seats: number; extra_live_seats: number };
  masked_email: string;
  heartbeat: null | { connection_status: string; ea_name: string; balance: number; equity: number; floating_pnl: number; drawdown_pct: number; open_positions: number; updated_at: string };
  trades: Array<{ ticket: string; symbol: string; direction: string; profit_usd: number; r_multiple: number; closed_at_utc: string }>;
  seats: Array<{ id:string; slot_type:string; slot_number:number; mt5_login:number|null; broker_server:string|null; rebind_available_at:string|null }>;
};

export default function CustomerLicensePortal() {
  const [account, setAccount] = useState('');
  const [license, setLicense] = useState('');
  const [data, setData] = useState<PortalData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'subscriptions'|'seats'|'telemetry'>('subscriptions');
  const [helperBusy, setHelperBusy] = useState(false);
  const [helperMessage, setHelperMessage] = useState('');
  const [artifactBusy,setArtifactBusy]=useState(false);
  const [artifactMessage,setArtifactMessage]=useState('');
  const [slotType, setSlotType] = useState<'LIVE'|'DEMO'>('LIVE');
  const [slotNumber, setSlotNumber] = useState('1');
  const [seatCurrent, setSeatCurrent] = useState('');
  const [seatNew, setSeatNew] = useState('');
  const [brokerServer, setBrokerServer] = useState('');
  const [seatMessage, setSeatMessage] = useState('');
  const [checkoutLicenseKey, setCheckoutLicenseKey] = useState('');
  const [checkoutMessage, setCheckoutMessage] = useState('');
  const [firstLogin, setFirstLogin] = useState('');
  const [firstSlotType, setFirstSlotType] = useState<'LIVE'|'DEMO'>('LIVE');
  const [firstBroker, setFirstBroker] = useState('');
  const [firstBindBusy, setFirstBindBusy] = useState(false);

  useEffect(() => {
    const reference = new URLSearchParams(window.location.search).get('subscription_ref');
    if (!reference) return;
    let active = true;
    fetch(`/api/v1/subscriptions/verify?reference=${encodeURIComponent(reference)}`, {cache:'no-store'})
      .then(async response => {
        const result = await response.json();
        if (!response.ok || !result.success || !result.license_key) throw new Error(result.error || 'Payment verification is pending.');
        if (active) {
          setCheckoutLicenseKey(result.license_key);
          setLicense(result.license_key);
          setCheckoutMessage('Payment verified. Your subscription license has been provisioned. Bind your first MT5 account to open the workspace.');
          window.history.replaceState({}, '', '/portal');
        }
      })
      .catch(error => { if (active) setCheckoutMessage(error instanceof Error ? error.message : 'Payment verification is pending.'); });
    return () => { active = false; };
  }, []);

  async function load(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setData(null);
    try {
      const response = await fetch('/api/v1/customer-portal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mt5_account: account, license_key: license }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to open your license dashboard.');
      setData(result); setActiveTab('subscriptions');
    } catch (e) { setError(e instanceof Error ? e.message : 'Dashboard unavailable.'); }
    finally { setBusy(false); }
  }


  async function downloadEaArtifact() {
    if(!data?.license.ea_slug) { setArtifactMessage('This legacy license is not mapped to an EA.'); return; }
    setArtifactBusy(true);setArtifactMessage('');
    try {
      const seat=data.seats.find(item=>Number(item.mt5_login)===Number(account));
      const mode=seat?.slot_type==='DEMO'?'DEMO':'REAL';
      const response=await fetch('/api/v1/license/artifact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({license_key:license,mt5_login:account,account_mode:mode,ea_slug:data.license.ea_slug})});
      const result=await response.json();
      if(!response.ok||!result.download_url) throw new Error(result.error||'Artifact download denied.');
      window.location.assign(result.download_url);
      setArtifactMessage('Your short-lived authorized download link is ready.');
    } catch(error) { setArtifactMessage(error instanceof Error?error.message:'Artifact download unavailable.'); }
    finally { setArtifactBusy(false); }
  }

  async function downloadLicenseHelper() {
    if (!data?.license.ea_slug) { setHelperMessage('This legacy license is not yet mapped to an EA product. Contact support.'); return; }
    setHelperBusy(true); setHelperMessage('');
    try {
      const response = await fetch('/api/v1/license/helper', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({license_key:license,mt5_login:account,ea_slug:data.license.ea_slug}),
      });
      if (!response.ok) { const result=await response.json(); throw new Error(result.error || 'Download denied.'); }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href=url; anchor.download='MacroLyncLicense.mqh'; anchor.click();
      URL.revokeObjectURL(url); setHelperMessage('Private license helper downloaded.');
    } catch (error) { setHelperMessage(error instanceof Error ? error.message : 'Private download unavailable.'); }
    finally { setHelperBusy(false); }
  }

  async function bindFirstAccount(event: React.FormEvent) {
    event.preventDefault(); setFirstBindBusy(true); setCheckoutMessage('');
    try {
      const response=await fetch('/api/v1/license/seats',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        license_key:checkoutLicenseKey,slot_type:firstSlotType,slot_number:1,current_mt5_login:null,new_mt5_login:firstLogin,broker_server:firstBroker,
      })});
      const result=await response.json();
      if(!response.ok || result.success===false) throw new Error(result.error || 'MT5 account binding failed.');
      setAccount(firstLogin);
      const portal=await fetch('/api/v1/customer-portal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mt5_account:firstLogin,license_key:checkoutLicenseKey})});
      const portalData=await portal.json();
      if(!portal.ok) throw new Error(portalData.error || 'Account is bound, but workspace could not be loaded yet.');
      setData(portalData); setActiveTab('subscriptions');
      setCheckoutMessage('MT5 account bound successfully. Your private workspace is ready.');
    } catch(error) { setCheckoutMessage(error instanceof Error?error.message:'First account binding unavailable.'); }
    finally { setFirstBindBusy(false); }
  }

  async function bindSeat(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setSeatMessage(''); setError('');
    try {
      const response = await fetch('/api/v1/license/seats', {
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({license_key:license,slot_type:slotType,slot_number:Number(slotNumber),current_mt5_login:seatCurrent || null,new_mt5_login:seatNew,broker_server:brokerServer}),
      });
      const result = await response.json();
      if(!response.ok || result.success === false) throw new Error(result.error || 'Seat binding rejected.');
      const boundLogin=seatNew; setAccount(boundLogin);
      const refreshed = await fetch('/api/v1/customer-portal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mt5_account:boundLogin,license_key:license})});
      const portal = await refreshed.json();
      if(refreshed.ok) setData(portal);
      setSeatMessage(result.rebind_available_at ? 'Account slot updated. Rebinding is locked for 72 hours.' : 'Account slot updated.');
      setSeatCurrent(''); setSeatNew('');
    } catch(error) { setSeatMessage(error instanceof Error ? error.message : 'Seat update unavailable.'); }
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
    {checkoutMessage && <p role="status" className="mt-4 rounded-lg border border-cyan-300/20 bg-cyan-300/5 p-3 text-xs leading-5 text-cyan-100">{checkoutMessage}</p>}
    {checkoutLicenseKey && !data && (
      <section className="mt-5 rounded-xl border border-emerald-300/20 bg-[#0a111b] p-5">
        <p className="font-mono text-[10px] tracking-widest text-emerald-300">SUBSCRIPTION ACTIVE</p>
        <p className="mt-2 text-xs text-slate-400">Save your license key. It is also shown in your confirmation email when delivery is configured.</p>
        <code className="mt-3 block select-all break-all rounded bg-black/30 p-3 text-sm text-white">{checkoutLicenseKey}</code>
        <form onSubmit={bindFirstAccount} className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-slate-400">First MT5 account type<select value={firstSlotType} onChange={event=>setFirstSlotType(event.target.value as 'LIVE'|'DEMO')} className="mt-2 h-10 w-full rounded border border-white/10 bg-black/30 px-3 text-white"><option value="LIVE">Live / Real</option><option value="DEMO">Demo</option></select></label>
          <label className="text-xs text-slate-400">MT5 login<input required inputMode="numeric" value={firstLogin} onChange={event=>setFirstLogin(event.target.value)} className="mt-2 h-10 w-full rounded border border-white/10 bg-black/30 px-3 font-mono text-white" placeholder="MT5 login"/></label>
          <label className="text-xs text-slate-400 sm:col-span-2">Broker server (optional)<input value={firstBroker} onChange={event=>setFirstBroker(event.target.value)} className="mt-2 h-10 w-full rounded border border-white/10 bg-black/30 px-3 text-white" placeholder="Broker server"/></label>
          <button disabled={firstBindBusy || !firstLogin} className="h-11 rounded-lg bg-emerald-300 px-4 text-sm font-semibold text-slate-950 disabled:opacity-40 sm:col-span-2">{firstBindBusy?'Binding account…':'Bind account and open workspace'}</button>
        </form>
      </section>
    )}
    {data && <>
      <nav aria-label="Private workspace tabs" className="mt-6 grid grid-cols-3 gap-2 rounded-xl border border-white/10 bg-[#0a111b] p-2">
        {([['subscriptions','Subscriptions'],['seats','MT5 account slots'],['telemetry','Private telemetry']] as const).map(([tab,label]) =>
          <button key={tab} type="button" onClick={()=>setActiveTab(tab)} className={`rounded-lg px-2 py-3 text-[10px] font-semibold sm:text-xs ${activeTab===tab?'bg-cyan-300 text-slate-950':'text-slate-400 hover:bg-white/5'}`}>{label}</button>
        )}
      </nav>
      <section className={activeTab === 'subscriptions' ? 'mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5' : 'hidden'}>
        {[
          ['LICENSE STATUS',data.license.status.toUpperCase()],
          ['EA',data.license.ea_slug || 'Legacy license'],
          ['PLAN',data.license.billing_cycle || data.license.tier.replaceAll('_',' ')],
          ['BOUND MT5 ACCOUNT',String(data.license.mt5_account)],
          ['NEXT BILLING',data.license.period_ends_at?new Date(data.license.period_ends_at).toLocaleDateString():data.license.expires_at?new Date(data.license.expires_at).toLocaleDateString():'Not scheduled'],
        ].map(([label,value])=><div key={label} className="rounded-xl border border-white/10 bg-[#0a111b] p-4"><p className="font-mono text-[9px] text-slate-500">{label}</p><p className="mt-2 text-sm font-semibold">{label==='LICENSE STATUS'?<span className={`rounded px-2 py-1 text-[10px] ${value==='ACTIVE'?'bg-emerald-300/10 text-emerald-200':value==='PAST_DUE'?'bg-amber-300/10 text-amber-200':'bg-slate-300/10 text-slate-200'}`}>{value}</span>:value}</p></div>)}
      </section>
      <section className={activeTab === 'subscriptions' ? 'mt-4 rounded-xl border border-white/10 bg-[#0a111b] p-5' : 'hidden'}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold">License artifacts</h2><p className="mt-1 text-xs text-slate-500">Downloads are authorized against this EA license and bound MT5 account.</p></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={()=>void downloadEaArtifact()} disabled={artifactBusy || !data.license.ea_slug} className="rounded-lg bg-emerald-300 px-3 py-2 text-xs font-semibold text-slate-950 disabled:opacity-40">{artifactBusy?'Preparing…':'Download EA (.ex5)'}</button>
            <button type="button" onClick={()=>void downloadLicenseHelper()} disabled={helperBusy || !data.license.ea_slug} className="rounded-lg border border-cyan-300/30 px-3 py-2 text-xs text-cyan-200 disabled:opacity-40">{helperBusy?'Preparing…':'Download MacroLyncLicense.mqh'}</button>
          </div>
        </div>
        {helperMessage && <p role="status" className="mt-3 text-xs text-slate-400">{helperMessage}</p>}
        {artifactMessage && <p role="status" className="mt-2 text-xs text-slate-400">{artifactMessage}</p>}
      </section>
      <section className={activeTab === 'telemetry' ? 'mt-5 rounded-xl border border-white/10 bg-[#0a111b] p-5' : 'hidden'}>
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
      <section className={activeTab === 'telemetry' ? 'mt-5 rounded-xl border border-white/10 bg-[#0a111b] p-5' : 'hidden'}>
        <h2 className="font-semibold">MT5 WebRequest setup</h2>
        <ol className="mt-3 space-y-2 text-xs leading-5 text-slate-300">
          <li>1. In MT5, open Tools → Options → Expert Advisors.</li>
          <li>2. Enable “Allow WebRequest for listed URL”.</li>
          <li>3. Add <code className="text-cyan-200">https://fidulync.vercel.app</code> exactly.</li>
          <li>4. Restart the EA and verify its license heartbeat in this workspace.</li>
        </ol>
        <p className="mt-2 text-[10px] text-slate-500">Never add private API keys to the public Store or share your broker password.</p>
      </section>
      <section className={activeTab === 'telemetry' ? 'mt-5 rounded-xl border border-white/10 bg-[#0a111b] p-5' : 'hidden'}>
        <h2 className="font-semibold">Recent closed trades</h2>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[500px] text-left text-xs"><thead className="text-slate-500"><tr>{['CLOSED UTC','SYMBOL','SIDE','P&L USD','R MULTIPLE'].map(x=><th key={x} className="pb-3 pr-4 font-mono text-[9px] font-normal">{x}</th>)}</tr></thead><tbody className="divide-y divide-white/5">{data.trades.map(t=><tr key={t.ticket+t.symbol}><td className="py-3 pr-4 text-slate-400">{new Date(t.closed_at_utc).toLocaleString('en-GB',{timeZone:'UTC'})}</td><td className="py-3 pr-4">{t.symbol}</td><td className="py-3 pr-4">{t.direction}</td><td className="py-3 pr-4">{money(t.profit_usd)}</td><td className="py-3 pr-4">{t.r_multiple.toFixed(2)}R</td></tr>)}{data.trades.length===0&&<tr><td colSpan={5} className="py-5 text-center text-slate-500">No closed trades received for this account yet.</td></tr>}</tbody></table></div>
      </section>
      <section className={activeTab === 'seats' ? 'mt-5 rounded-xl border border-white/10 bg-[#0a111b] p-5' : 'hidden'}>
        <h2 className="font-semibold">MT5 account slots</h2>
        <p className="mt-1 text-xs text-slate-400">Entitlements: {data.license.included_live_seats ?? 1} live + {data.license.included_demo_seats ?? 2} demo + {data.license.extra_live_seats ?? 0} extra live seats.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">{data.seats.map(seat=><div key={seat.id} className="rounded-lg border border-white/10 bg-black/20 p-3"><p className="font-mono text-[10px] text-slate-500">{seat.slot_type} SLOT {seat.slot_number}</p><p className="mt-1 text-sm text-white">{seat.mt5_login ?? 'Unbound'}</p><p className="mt-1 text-[10px] text-slate-500">{seat.rebind_available_at ? 'Rebind after '+new Date(seat.rebind_available_at).toLocaleString() : 'Available for binding'}</p></div>)}</div>
        {data.seats.length===0 && <p className="mt-3 text-xs text-slate-500">Seat records are created automatically on first binding for eligible mapped subscriptions.</p>}
        <form onSubmit={bindSeat} className="mt-5 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2">
          <label className="text-xs text-slate-400">Slot type<select value={slotType} onChange={event=>setSlotType(event.target.value as 'LIVE'|'DEMO')} className="mt-2 h-10 w-full rounded border border-white/10 bg-black/30 px-3 text-white"><option value="LIVE">Live account</option><option value="DEMO">Demo account</option></select></label>
          <label className="text-xs text-slate-400">Slot number<input required min="1" type="number" value={slotNumber} onChange={event=>setSlotNumber(event.target.value)} className="mt-2 h-10 w-full rounded border border-white/10 bg-black/30 px-3 text-white"/></label>
          <label className="text-xs text-slate-400">Current MT5 login (blank for first bind)<input inputMode="numeric" value={seatCurrent} onChange={event=>setSeatCurrent(event.target.value)} className="mt-2 h-10 w-full rounded border border-white/10 bg-black/30 px-3 font-mono text-white" placeholder="Current slot login"/></label>
          <label className="text-xs text-slate-400">New MT5 login<input required inputMode="numeric" value={seatNew} onChange={event=>setSeatNew(event.target.value)} className="mt-2 h-10 w-full rounded border border-white/10 bg-black/30 px-3 font-mono text-white" placeholder="New login"/></label>
          <label className="text-xs text-slate-400 sm:col-span-2">Broker server (optional)<input value={brokerServer} onChange={event=>setBrokerServer(event.target.value)} className="mt-2 h-10 w-full rounded border border-white/10 bg-black/30 px-3 text-white" placeholder="Broker server name"/></label>
          <button disabled={busy || !seatNew} className="h-10 rounded-lg bg-cyan-300 px-4 text-xs font-semibold text-slate-950 disabled:opacity-40 sm:col-span-2">{busy?'Updating slot…':'Bind / Rebind account slot'}</button>
          {seatMessage && <p role="status" className="text-xs text-slate-400 sm:col-span-2">{seatMessage}</p>}
        </form>
      </section>
      <section className={activeTab === 'seats' ? 'mt-5 rounded-xl border border-cyan-300/20 bg-[#0a111b] p-5' : 'hidden'}>
        <h2 className="font-semibold">72-hour rebind protection</h2>
        <p className="mt-2 text-xs leading-5 text-slate-400">Every MT5 slot is protected by a server-side 72-hour rebind cooldown. A rebind requires the current slot login and cannot be bypassed through the legacy license-transfer route. The next eligible rebind time is displayed on each slot above.</p>
      </section>
    </>}
    <p className="mt-7 text-center text-[11px] text-slate-600">Protect your license key. FiduLync will never ask for your MT5 investor or master password.</p>
  </div>;
}
