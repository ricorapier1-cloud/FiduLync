'use client';

import { useCallback, useEffect, useState } from 'react';

type Heartbeat = {
  mt5_account: number; ea_name: string; balance: number; equity: number;
  floating_pnl: number; drawdown_pct: number; open_positions: number;
  status: string; updated_at: string; connection_status: 'ONLINE' | 'STANDBY';
};
type Trade = {
  ticket: string; symbol: string; direction: 'LONG' | 'SHORT';
  entry_price: number; exit_price: number; profit_usd: number;
  r_multiple: number; confluence_score: number; regime: string; closed_at_utc: string;
};

function money(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
}

export default function LiveAccountMonitor() {
  const [account, setAccount] = useState('');
  const [license, setLicense] = useState('');
  const [bound, setBound] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [heartbeat, setHeartbeat] = useState<Heartbeat | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [lastRefresh, setLastRefresh] = useState('');

  const refresh = useCallback(async () => {
    if (!bound || !account || !license) return;
    try {
      const params = new URLSearchParams({ mt5_account: account, license_key: license });
      const [hbRes, tradeRes] = await Promise.all([
        fetch('/api/v1/ea-heartbeat?' + params.toString(), { cache: 'no-store' }),
        fetch('/api/v1/trade-log?' + params.toString(), { cache: 'no-store' }),
      ]);
      const [hbData, tradeData] = await Promise.all([hbRes.json(), tradeRes.json()]);
      if (!hbRes.ok || !tradeRes.ok) throw new Error(hbData.error || tradeData.error || 'Account telemetry is unavailable.');
      setHeartbeat(hbData.heartbeat ?? null);
      setTrades(Array.isArray(tradeData.trades) ? tradeData.trades : []);
      setLastRefresh(new Date().toISOString());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load account telemetry.');
      setHeartbeat(null);
      setTrades([]);
    }
  }, [bound, account, license]);

  async function bindAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{1,20}$/.test(account.trim()) || !license.trim()) {
      setError('Enter a valid MT5 account number and license key.');
      return;
    }
    setLoading(true);
    setError('');
    setBound(true);
    try {
      const params = new URLSearchParams({ mt5_account: account.trim(), license_key: license.trim() });
      const response = await fetch('/api/v1/ea-heartbeat?' + params.toString(), { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Account verification failed.');
      await refresh();
    } catch (e) {
      setBound(false);
      setError(e instanceof Error ? e.message : 'Account verification failed.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!bound) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(timer);
  }, [bound, refresh]);

  return (
    <section className="mt-11 rounded-xl border border-cyan-400/15 bg-[#080d14] p-5 shadow-[0_20px_70px_rgba(0,0,0,.25)] sm:p-6" aria-labelledby="live-account-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[9px] tracking-[0.18em] text-cyan-300/70">ACCOUNT TELEMETRY / PRIVATE VIEW</div>
          <h2 id="live-account-heading" className="mt-1 text-lg font-semibold text-slate-100">Live Account Monitor</h2>
          <p className="mt-1 text-xs text-slate-500">Read-only MT5 telemetry. Never enter broker passwords.</p>
        </div>
        <span className={'rounded border px-2.5 py-1 font-mono text-[9px] ' + (heartbeat?.connection_status === 'ONLINE' ? 'border-emerald-400/30 text-emerald-300' : 'border-amber-400/30 text-amber-300')}>
          {heartbeat?.connection_status ?? (bound ? 'STANDBY' : 'NOT BOUND')}
        </span>
      </div>
      <form onSubmit={bindAccount} className="mt-5 grid gap-3 sm:grid-cols-[1fr_1.3fr_auto]">
        <label className="text-[9px] font-mono tracking-wide text-slate-500">MT5 ACCOUNT NUMBER
          <input value={account} onChange={e => setAccount(e.target.value)} inputMode="numeric" autoComplete="off" className="mt-1.5 h-10 w-full rounded-md border border-white/10 bg-black/30 px-3 font-mono text-xs text-slate-100 outline-none focus:border-cyan-300/40" placeholder="MT5 login" />
        </label>
        <label className="text-[9px] font-mono tracking-wide text-slate-500">LICENSE KEY
          <input value={license} onChange={e => setLicense(e.target.value)} type="password" autoComplete="off" className="mt-1.5 h-10 w-full rounded-md border border-white/10 bg-black/30 px-3 font-mono text-xs text-slate-100 outline-none focus:border-cyan-300/40" placeholder="Your customer license key" />
        </label>
        <button disabled={loading} className="mt-4 h-10 self-end rounded-md border border-cyan-300/30 bg-cyan-300/10 px-4 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/15 disabled:opacity-50">{loading ? 'VERIFYING…' : 'BIND ACCOUNT'}</button>
      </form>
      {error && <p role="alert" className="mt-3 text-xs text-rose-300">{error}</p>}
      {bound && <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ['BALANCE', money(heartbeat?.balance)], ['EQUITY', money(heartbeat?.equity)],
          ['FLOATING P&L', money(heartbeat?.floating_pnl)],
          ['DAILY DRAWDOWN', heartbeat ? heartbeat.drawdown_pct.toFixed(2) + '%' : '—'],
          ['OPEN POSITIONS', heartbeat ? String(heartbeat.open_positions) : '—'],
        ].map(([label, value]) => <div key={label} className="rounded-md border border-white/[0.07] bg-white/[0.02] p-3">
          <div className="font-mono text-[8px] tracking-wide text-slate-500">{label}</div>
          <div className="mt-2 font-mono text-sm text-slate-100">{value}</div>
        </div>)}
      </div>}
      <div className="mt-5 border-t border-white/[0.07] pt-4">
        <div className="flex justify-between gap-3"><h3 className="font-mono text-[9px] tracking-[0.15em] text-slate-400">ACCOUNT-ISOLATED RECENT TRADES</h3><span className="text-[9px] text-slate-600">{lastRefresh ? 'UPDATED ' + new Date(lastRefresh).toLocaleTimeString() : ''}</span></div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left font-mono text-[9px]">
            <thead className="text-slate-600"><tr>{['CLOSED UTC','SYMBOL','SIDE','P&L USD','R MULTIPLE'].map(x => <th key={x} className="pb-2 pr-3 font-normal">{x}</th>)}</tr></thead>
            <tbody className="divide-y divide-white/[0.05]">
              {trades.map(t => <tr key={t.ticket + t.symbol} className="text-slate-300">
                <td className="py-2 pr-3 text-slate-500">{new Date(t.closed_at_utc).toLocaleString('en-GB',{timeZone:'UTC'})}</td>
                <td className="py-2 pr-3">{t.symbol}</td><td className="py-2 pr-3">{t.direction}</td>
                <td className={'py-2 pr-3 ' + (t.profit_usd >= 0 ? 'text-emerald-300' : 'text-rose-300')}>{money(t.profit_usd)}</td>
                <td className="py-2 pr-3">{t.r_multiple.toFixed(2)}R</td>
              </tr>)}
              {trades.length === 0 && <tr><td colSpan={5} className="py-5 text-center text-slate-600">No account trades recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
