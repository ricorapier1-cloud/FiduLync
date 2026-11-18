'use client';

import { useEffect, useState, type FormEvent } from 'react';

type Seat = {
  slot_type: 'LIVE' | 'DEMO'; slot_number: number; mt5_login: number | null;
  broker_server: string | null; rebind_available_at: string | null;
};
type PortalData = {
  license: { mt5_account: number | null; tier: string; status: string; expires_at: string | null; created_at: string; ea_slug: string | null };
  masked_email: string;
  heartbeat: null | { connection_status: string; ea_name: string; balance: number; equity: number; floating_pnl: number; drawdown_pct: number; open_positions: number; updated_at: string };
  trades: Array<{ ticket: string; symbol: string; direction: string; profit_usd: number; r_multiple: number; closed_at_utc: string }>;
  selected_mt5_account: number | null;
};
type Product = { slug: string; name: string; ex5_artifact_url: string | null };

const tabs = [
  { id: 'subscriptions', label: 'Subscriptions & Downloads' },
  { id: 'seats', label: 'MT5 Account Slots' },
  { id: 'telemetry', label: 'Private Telemetry & Setup' },
] as const;

export default function CustomerLicensePortal() {
  const [license, setLicense] = useState('');
  const [account, setAccount] = useState('');
  const [data, setData] = useState<PortalData | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [demoLocked, setDemoLocked] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [tab, setTab] = useState<(typeof tabs)[number]['id']>('subscriptions');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [newLogin, setNewLogin] = useState('');
  const [brokerServer, setBrokerServer] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  async function loadSeats(key: string) {
    const response = await fetch('/api/v1/license-seats', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list', license_key: key }),
      cache: 'no-store',
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not load account slots.');
    setSeats(result.slots || []);
    setDemoLocked(result.demo_locked === true);
  }

  async function load(event?: FormEvent) {
    event?.preventDefault();
    if (!license.trim()) { setError('Enter your AlgoLync license key.'); return; }
    setBusy(true); setError(''); setMessage(''); setData(null); setSeats([]);
    try {
      const response = await fetch('/api/v1/customer-portal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mt5_account: account.trim() || undefined, license_key: license.trim() }),
        cache: 'no-store',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to open your workspace.');
      setData(result);
      await loadSeats(license.trim());
      setTab('subscriptions');
      const productResponse = await fetch('/api/v1/products', { cache: 'no-store' });
      const productData = await productResponse.json();
      if (productResponse.ok) setProducts(productData.products || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Workspace unavailable.');
    } finally { setBusy(false); }
  }

  async function bindSeat(event: FormEvent) {
    event.preventDefault();
    if (!selectedSeat || !newLogin.trim()) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/v1/license-seats', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bind', license_key: license.trim(),
          slot_type: selectedSeat.slot_type, slot_number: selectedSeat.slot_number,
          current_mt5_login: selectedSeat.mt5_login ?? null,
          new_mt5_login: newLogin.trim(), broker_server: brokerServer.trim() || null,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Account slot could not be updated.');
      setMessage('MT5 account slot updated. A 72-hour re-binding cooldown now applies to this slot.');
      setSelectedSeat(null); setNewLogin(''); setBrokerServer('');
      await loadSeats(license.trim());
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Seat binding failed.'); }
    finally { setBusy(false); }
  }

  const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const product = data?.license.ea_slug ? products.find((item) => item.slug === data.license.ea_slug) : undefined;
  const remaining = (value: string | null) => {
    if (!value) return '';
    const ms = Date.parse(value) - now;
    if (ms <= 0) return 'Available now';
    const hours = Math.floor(ms / 3_600_000);
    const days = Math.floor(hours / 24);
    return days > 0 ? `${days}d ${hours % 24}h remaining` : `${hours}h ${Math.floor((ms % 3_600_000) / 60_000)}m remaining`;
  };

  return <div className="mx-auto max-w-6xl px-4 py-10 text-slate-100 sm:px-6">
    <header className="mb-8">
      <p className="font-mono text-[10px] tracking-[.2em] text-cyan-300">ALGOLYNC / CLIENT WORKSPACE</p>
      <h1 className="mt-2 text-3xl font-semibold">My License</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-400">Manage EA subscriptions, MT5 account seats, downloads and private account telemetry. Your license key is your access credential; never share it.</p>
    </header>

    <form onSubmit={load} className="grid gap-3 rounded-xl border border-white/10 bg-[#0a111b] p-5 sm:grid-cols-[1.4fr_1fr_auto]">
      <label className="text-xs text-slate-400">AlgoLync license key
        <input required type="password" autoComplete="off" value={license} onChange={(e) => setLicense(e.target.value)} className="mt-2 h-11 w-full rounded border border-white/10 bg-black/30 px-3 font-mono text-sm text-white" placeholder="ALGOLYNX-..." />
      </label>
      <label className="text-xs text-slate-400">MT5 login (optional)
        <input inputMode="numeric" value={account} onChange={(e) => setAccount(e.target.value)} className="mt-2 h-11 w-full rounded border border-white/10 bg-black/30 px-3 font-mono text-sm text-white" placeholder="Leave blank to use a bound slot" />
      </label>
      <button disabled={busy} className="mt-5 h-11 rounded bg-cyan-300 px-5 text-sm font-semibold text-slate-950 disabled:opacity-50">{busy ? 'VERIFYING…' : 'OPEN WORKSPACE'}</button>
    </form>

    {error && <p role="alert" className="mt-4 rounded border border-rose-400/20 bg-rose-400/5 p-3 text-sm text-rose-300">{error}</p>}
    {message && <p role="status" className="mt-4 rounded border border-emerald-400/20 bg-emerald-400/5 p-3 text-sm text-emerald-300">{message}</p>}

    {data && <>
      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['LICENSE STATUS', data.license.status.toUpperCase()],
          ['EA PRODUCT', data.license.ea_slug || 'Unassigned'],
          ['MT5 LOGIN', data.selected_mt5_account ? String(data.selected_mt5_account) : 'Not bound yet'],
          ['NEXT BILLING / EXPIRY', data.license.expires_at ? new Date(data.license.expires_at).toLocaleDateString() : '—'],
        ].map(([label, value]) => <div key={label} className="rounded-xl border border-white/10 bg-[#0a111b] p-4"><p className="font-mono text-[9px] text-slate-500">{label}</p><p className="mt-2 text-sm font-semibold">{value}</p></div>)}
      </div>

      <nav className="mt-7 flex flex-wrap gap-2 border-b border-white/10 pb-3" aria-label="Client workspace sections">
        {tabs.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${tab === item.id ? 'bg-cyan-300 text-slate-950' : 'border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]'}`}>{item.label}</button>)}
      </nav>

      {tab === 'subscriptions' && <section className="mt-5 rounded-xl border border-white/10 bg-[#0a111b] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="font-semibold">{product?.name || data.license.ea_slug || 'AlgoLync EA subscription'}</h2><p className="mt-1 text-xs text-slate-400">{data.license.tier.replaceAll('_', ' ')} · {data.masked_email}</p></div>
          <span className="rounded border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 font-mono text-[10px] text-emerald-200">{data.license.status.toUpperCase()}</span>
        </div>
        <p className="mt-4 text-xs leading-5 text-slate-400">Included entitlement: one live MT5 account and two demo MT5 accounts. Additional live seats depend on your subscription order.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {product?.ex5_artifact_url && <a href={product.ex5_artifact_url} className="rounded-lg bg-emerald-300 px-4 py-2.5 text-xs font-bold text-slate-950">Download EA (.ex5)</a>}
          <a href="/mql5/MacroLyncLicense.mqh" download className="rounded-lg border border-white/10 px-4 py-2.5 text-xs text-slate-200">Download MacroLyncLicense.mqh</a>
          <a href="/mql5/MacroLyncBridge.mqh" download className="rounded-lg border border-white/10 px-4 py-2.5 text-xs text-slate-200">Download MacroLyncBridge.mqh</a>
        </div>
        {!product?.ex5_artifact_url && <p className="mt-3 text-[11px] text-amber-200">The compiled EA binary is not yet published for this product. A source file is not substituted for a commercial EX5 release.</p>}
      </section>}

      {tab === 'seats' && <section className="mt-5 rounded-xl border border-white/10 bg-[#0a111b] p-5">
        <div><h2 className="font-semibold">MT5 account slots</h2><p className="mt-1 text-xs text-slate-400">Each slot is managed independently. Re-binding a populated slot starts a 72-hour cooldown.</p></div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {demoLocked && <p className="mb-3 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.04] p-3 text-xs text-cyan-100 md:col-span-2">This demo trial is permanently locked to the original MT5 demo login. Live subscriptions support self-service slot re-binding.</p>}
          {seats.map((seat) => {
            const cooldown = seat.mt5_login !== null && seat.rebind_available_at && Date.parse(seat.rebind_available_at) > now;
            return <div key={seat.slot_type + seat.slot_number} className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between"><span className="font-mono text-[10px] text-cyan-200">{seat.slot_type} SLOT {seat.slot_number}</span><span className="text-[10px] text-slate-500">{seat.mt5_login ? 'BOUND' : 'AVAILABLE'}</span></div>
              <p className="mt-3 font-mono text-lg">{seat.mt5_login || '—'}</p>
              <p className="mt-1 text-[10px] text-slate-500">{seat.broker_server || 'Broker not specified'}</p>
              {seat.rebind_available_at && seat.mt5_login && <p className={`mt-2 text-[10px] ${cooldown ? 'text-amber-300' : 'text-emerald-300'}`}>{cooldown ? 'Rebind cooldown: ' + remaining(seat.rebind_available_at) : 'Rebinding available'}</p>}
              {!demoLocked && <button type="button" disabled={Boolean(cooldown) || busy} onClick={() => { setSelectedSeat(seat); setNewLogin(''); setBrokerServer(seat.broker_server || ''); }} className="mt-4 rounded border border-cyan-300/30 px-3 py-2 text-[10px] font-semibold text-cyan-100 disabled:opacity-40">{seat.mt5_login ? 'Rebind this slot' : 'Bind MT5 login'}</button>
            </div>;
          })}
          {seats.length === 0 && <p className="text-xs text-slate-500">No account slots are configured for this license.</p>}
        </div>
        {selectedSeat && <form onSubmit={bindSeat} className="mt-5 grid gap-3 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.04] p-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><h3 className="text-sm font-semibold">{selectedSeat.mt5_login ? 'Rebind' : 'Bind'} {selectedSeat.slot_type} slot {selectedSeat.slot_number}</h3><p className="mt-1 text-[10px] text-slate-400">Current login: {selectedSeat.mt5_login || 'Unbound'}</p></div>
          <label className="text-xs text-slate-400">New MT5 login<input required inputMode="numeric" value={newLogin} onChange={(e) => setNewLogin(e.target.value)} className="mt-2 h-10 w-full rounded border border-white/10 bg-black/30 px-3 font-mono text-sm text-white" /></label>
          <label className="text-xs text-slate-400">Broker server (optional)<input value={brokerServer} onChange={(e) => setBrokerServer(e.target.value)} className="mt-2 h-10 w-full rounded border border-white/10 bg-black/30 px-3 text-sm text-white" /></label>
          <div className="flex gap-2 sm:col-span-2"><button disabled={busy} className="rounded bg-cyan-300 px-4 py-2 text-xs font-bold text-slate-950 disabled:opacity-50">{busy ? 'Saving…' : 'Confirm account slot'}</button><button type="button" onClick={() => setSelectedSeat(null)} className="rounded border border-white/10 px-4 py-2 text-xs text-slate-300">Cancel</button></div>
        </form>}
      </section>}

      {tab === 'telemetry' && <section className="mt-5 space-y-5">
        <div className="rounded-xl border border-white/10 bg-[#0a111b] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Private MT5 telemetry</h2><p className="mt-1 text-xs text-slate-500">Account-isolated view · {data.heartbeat?.ea_name || 'No EA heartbeat received yet'}</p></div><span className="rounded border border-white/10 px-3 py-1 font-mono text-xs">{data.heartbeat?.connection_status || 'STANDBY'}</span></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ['BALANCE', data.heartbeat ? money(data.heartbeat.balance) : '—'],
              ['EQUITY', data.heartbeat ? money(data.heartbeat.equity) : '—'],
              ['FLOATING P&L', data.heartbeat ? money(data.heartbeat.floating_pnl) : '—'],
              ['DRAWDOWN', data.heartbeat ? data.heartbeat.drawdown_pct.toFixed(2) + '%' : '—'],
              ['OPEN POSITIONS', data.heartbeat ? String(data.heartbeat.open_positions) : '—'],
            ].map(([label, value]) => <div key={label} className="rounded-lg bg-white/[0.03] p-3"><p className="font-mono text-[9px] text-slate-500">{label}</p><p className="mt-2 font-mono text-sm">{value}</p></div>)}
          </div>
          {data.heartbeat && <p className="mt-3 text-[10px] text-slate-500">Last update: {new Date(data.heartbeat.updated_at).toLocaleString()}</p>}
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0a111b] p-5">
          <h2 className="font-semibold">Recent closed trades</h2>
          <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[500px] text-left text-xs"><thead className="text-slate-500"><tr>{['CLOSED UTC', 'SYMBOL', 'SIDE', 'P&L USD', 'R MULTIPLE'].map((x) => <th key={x} className="pb-3 pr-4 font-mono text-[9px] font-normal">{x}</th>)}</tr></thead><tbody className="divide-y divide-white/5">{data.trades.map((trade) => <tr key={trade.ticket + trade.symbol}><td className="py-3 pr-4 text-slate-400">{new Date(trade.closed_at_utc).toLocaleString('en-GB', { timeZone: 'UTC' })}</td><td className="py-3 pr-4">{trade.symbol}</td><td className="py-3 pr-4">{trade.direction}</td><td className="py-3 pr-4">{money(trade.profit_usd)}</td><td className="py-3 pr-4">{trade.r_multiple.toFixed(2)}R</td></tr>)}{data.trades.length === 0 && <tr><td colSpan={5} className="py-5 text-center text-slate-500">No closed trades received for this account yet.</td></tr>}</tbody></table></div>
        </div>
        <div className="rounded-xl border border-amber-300/20 bg-[#11100c] p-5">
          <h2 className="font-semibold">MT5 WebRequest setup</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs leading-5 text-slate-300">
            <li>Open MetaTrader 5 → Tools → Options → Expert Advisors.</li>
            <li>Enable “Allow WebRequest for listed URL”.</li>
            <li>Add <code className="text-emerald-300">https://fidulync.vercel.app</code> to the allowlist.</li>
            <li>Restart the EA or reinitialize it after saving the setting.</li>
          </ol>
          <p className="mt-3 text-[10px] text-slate-500">Never share your MT5 master or investor password. The terminal communicates using your license key and the public HTTPS endpoint.</p>
        </div>
      </section>}
    </>}
    <p className="mt-7 text-center text-[11px] text-slate-600">Protect your license key. FiduLync will never ask for your MT5 investor or master password.</p>
  </div>;
}
