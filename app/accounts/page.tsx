'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Deal = {
  account_key: string; deal_ticket: string; position_id: string | null; symbol: string; side: string; entry_type: string;
  volume: number; price: number; profit: number; commission: number; swap: number; fee: number;
  deal_time_server: string; magic: string | null; comment: string | null;
};
type Position = {
  ticket: string; positionId: string | null; symbol: string; side: string; volume: number; openPrice: number;
  currentPrice: number; profit: number; swap: number; stopLoss: number | null;
  takeProfit: number | null; openedAtServer: string; magic: string | null; comment: string | null;
};
type Account = {
  account_key: string; account_login: string; broker: string | null; server: string;
  currency: string; leverage: number; account_mode: string; balance: number; equity: number;
  margin: number; free_margin: number; margin_level: number | null; positions: Position[];
  observed_at: string; received_at: string;
};
type Payload = { status: string; generatedAtUtc: string; accounts: Account[]; deals: Deal[] };

const money = (value: number, currency: string) => new Intl.NumberFormat(undefined, {
  style: 'currency', currency, maximumFractionDigits: 2,
}).format(value);
const dateTime = (value: string) => new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Africa/Lagos',
}).format(new Date(value));
const netDeal = (deal: Deal) => Number(deal.profit) + Number(deal.commission) + Number(deal.swap) + Number(deal.fee);
const closesPosition = (deal: Deal) => ['OUT','OUT_BY','INOUT'].includes(deal.entry_type);

export default function AccountsPage() {
  const [token, setToken] = useState('');
  const [payload, setPayload] = useState<Payload | null>(null);
  const [status, setStatus] = useState<'DISCONNECTED'|'CONNECTING'|'CONNECTED'|'ERROR'>('DISCONNECTED');
  const [message, setMessage] = useState('');
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [selectedAccountKey, setSelectedAccountKey] = useState('');

  const refresh = useCallback(async (credential: string) => {
    setStatus('CONNECTING');
    try {
      const response = await fetch('/api/v1/accounts', {
        cache: 'no-store', headers: { Authorization: 'Bearer ' + credential },
      });
      const data = await response.json() as Payload & { error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Account service unavailable.');
      setPayload(data);
      setSelectedAccountKey((current) => current || data.accounts[0]?.account_key || '');
      setLastRefresh(new Date().toISOString());
      setStatus('CONNECTED');
      setMessage(data.status === 'AWAITING_FIRST_SYNC' ? 'Access verified. Waiting for the first MT5 publisher sync.' : '');
    } catch (error) {
      setStatus('ERROR');
      setMessage(error instanceof Error ? error.message : 'Could not retrieve private account data.');
    }
  }, []);

  useEffect(() => {
    const saved = window.sessionStorage.getItem('macrolinc-account-read-token');
    if (saved) {
      setToken(saved);
      void refresh(saved);
    }
  }, [refresh]);

  useEffect(() => {
    if (status !== 'CONNECTED' || !token) return;
    const timer = window.setInterval(() => void refresh(token), 30_000);
    return () => window.clearInterval(timer);
  }, [status, token, payload?.accounts.length, refresh]);

  const selected = payload?.accounts.find((account) => account.account_key === selectedAccountKey) ?? payload?.accounts[0] ?? null;
  const selectedDeals = useMemo(() => selected
    ? (payload?.deals ?? []).filter((deal) => deal.account_key === selected.account_key)
    : [], [payload?.deals, selected]);
  const closedTrades = useMemo(() => {
    if (!selected) return [];
    const openIds = new Set(selected.positions.map((position) => position.positionId).filter((value): value is string => Boolean(value)));
    const groups = new Map<string, Deal[]>();
    selectedDeals.forEach((deal) => {
      if (!deal.position_id) return;
      const current = groups.get(deal.position_id) ?? [];
      current.push(deal);
      groups.set(deal.position_id, current);
    });
    return [...groups.entries()].flatMap(([positionId, items]) => {
      if (openIds.has(positionId) || !items.some((deal) => deal.entry_type === 'IN') || !items.some(closesPosition)) return [];
      const entry = items.find((deal) => deal.entry_type === 'IN' && (deal.side === 'BUY' || deal.side === 'SELL'));
      if (!entry) return [];
      const exit = items.filter(closesPosition).sort((left, right) => right.deal_time_server.localeCompare(left.deal_time_server))[0];
      if (!exit) return [];
      return [{
        positionId,
        symbol: entry.symbol,
        side: entry.side,
        volume: items.filter((deal) => deal.entry_type === 'IN').reduce((sum, deal) => sum + Number(deal.volume), 0),
        net: items.reduce((sum, deal) => sum + netDeal(deal), 0),
        closedAt: exit.deal_time_server,
        magic: entry.magic,
      }];
    }).sort((left, right) => right.closedAt.localeCompare(left.closedAt));
  }, [selected, selectedDeals]);
  const analytics = useMemo(() => {
    const values = closedTrades.map((trade) => trade.net);
    const wins = values.filter((value) => value > 0);
    const losses = values.filter((value) => value < 0);
    const grossWin = wins.reduce((sum, value) => sum + value, 0);
    const grossLoss = Math.abs(losses.reduce((sum, value) => sum + value, 0));
    return {
      count: values.length,
      net: values.reduce((sum, value) => sum + value, 0),
      winRate: values.length ? wins.length / values.length * 100 : null,
      profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
    };
  }, [closedTrades]);

  const connect = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = token.trim();
    if (value.length < 32) { setMessage('Enter the private account-read token configured in Vercel.'); return; }
    window.sessionStorage.setItem('macrolinc-account-read-token', value);
    void refresh(value);
  };
  const disconnect = () => {
    window.sessionStorage.removeItem('macrolinc-account-read-token');
    setToken('');
    setPayload(null);
    setSelectedAccountKey('');
    setStatus('DISCONNECTED');
    setMessage('Private account view disconnected in this browser tab.');
  };

  const observedAge = selected ? Math.max(0, Date.now() - Date.parse(selected.observed_at)) : null;
  const freshness = observedAge === null ? 'NO DATA' : observedAge <= 90_000 ? 'FRESH' : observedAge <= 300_000 ? 'DELAYED' : 'STALE';

  return (
    <div className="macro-page pb-24">
      <div className="macro-statusline mono">
        <span><span className="macro-pulse" /> PRIVATE PORTFOLIO INTELLIGENCE</span>
        <span className="macro-status-right">READ-ONLY · MT5</span>
      </div>
      <section className="macro-intro" aria-labelledby="accounts-title">
        <div>
          <span className="eyebrow">ACCOUNT &amp; PERFORMANCE INTELLIGENCE</span>
          <h1 id="accounts-title">Portfolio &amp; Accounts.<br /><span>Broker evidence, not manual entries.</span></h1>
          <p>Connect an MT5 terminal publisher to review account equity, open exposure and broker-reported closed-trade history alongside your macro research.</p>
        </div>
        <div className="macro-intro-meta mono">
          <span>CONNECTION STATUS</span>
          <span className={status === 'CONNECTED' ? 'text-emerald-300' : status === 'ERROR' ? 'text-amber-300' : 'text-slate-400'}>{status}</span>
          {selected && <span className="text-slate-500">{freshness} · {observedAge === null ? '—' : Math.round(observedAge / 1000) + 's'} old</span>}
        </div>
      </section>

      <section className="macro-section">
        <div className="macro-section-heading">
          <div><span className="eyebrow">PRIVATE DATA ACCESS</span><h2>Connect your account view</h2></div>
          {status === 'CONNECTED' && <button type="button" className="macro-refresh" onClick={disconnect}>DISCONNECT VIEW</button>}
        </div>
        <div className="macro-panel p-5">
          <form onSubmit={connect} className="flex flex-col gap-3 sm:flex-row">
            <label className="flex-1 text-xs text-slate-400">
              Private account-read token
              <input type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)}
                placeholder="Paste MT5_ACCOUNT_READ_TOKEN (32+ characters)"
                className="mt-2 w-full rounded-lg border border-white/10 bg-[#080c12] px-3 py-3 font-mono text-xs text-slate-100 outline-none focus:border-emerald-400/50" />
            </label>
            <button type="submit" disabled={status === 'CONNECTING'} className="self-end rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-5 py-3 text-xs font-semibold text-emerald-300 disabled:opacity-50">
              {status === 'CONNECTING' ? 'CONNECTING…' : 'CONNECT ACCOUNT VIEW'}
            </button>
          </form>
          {message && <p role="status" className="mt-3 text-xs text-amber-300">{message}</p>}
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">The read token is kept in this browser tab's session storage only. It is not a broker password. Never paste your IC Markets master or investor password here.</p>
        </div>
      </section>

      {selected ? <>
        <section className="macro-section">
          <div className="macro-section-heading">
            <div><span className="eyebrow">BROKER ACCOUNT SNAPSHOT</span><h2>{selected.broker || 'MT5'} · {selected.server}</h2></div>
            <span className="macro-section-note mono">{selected.account_mode} · {selected.currency} · 1:{selected.leverage}</span>
          </div>
          {(payload?.accounts.length ?? 0) > 1 && <label className="mb-3 block text-xs text-slate-400">Connected MT5 account
            <select value={selected.account_key} onChange={(event) => setSelectedAccountKey(event.target.value)} className="mt-2 block w-full rounded-lg border border-white/10 bg-[#080c12] px-3 py-2 text-slate-100">
              {payload?.accounts.map((account) => <option key={account.account_key} value={account.account_key}>{account.broker || 'MT5'} · {account.server} · {account.account_login} · {account.account_mode}</option>)}
            </select>
          </label>}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              ['BALANCE', money(Number(selected.balance), selected.currency)],
              ['EQUITY', money(Number(selected.equity), selected.currency)],
              ['FLOATING P/L', money(selected.positions.reduce((sum, position) => sum + Number(position.profit) + Number(position.swap), 0), selected.currency)],
              ['FREE MARGIN', money(Number(selected.free_margin), selected.currency)],
              ['MARGIN USED', money(Number(selected.margin), selected.currency)],
              ['MARGIN LEVEL', selected.margin_level === null ? '—' : Number(selected.margin_level).toFixed(1) + '%'],
            ].map(([label, value]) => <div key={label} className="macro-panel p-4"><span className="macro-kpi-label">{label}</span><strong className="mt-2 block break-all font-mono text-lg text-slate-100">{value}</strong></div>)}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <div className="macro-panel p-4"><span className="macro-kpi-label">OPEN POSITIONS</span><strong className="mt-2 block font-mono text-xl text-slate-100">{selected.positions.length}</strong></div>
            <div className="macro-panel p-4"><span className="macro-kpi-label">CLOSED POSITIONS SYNCED</span><strong className="mt-2 block font-mono text-xl text-slate-100">{analytics.count}</strong></div>
            <div className="macro-panel p-4"><span className="macro-kpi-label">WIN RATE · CLOSED POSITIONS</span><strong className="mt-2 block font-mono text-xl text-slate-100">{analytics.winRate === null ? '—' : analytics.winRate.toFixed(1) + '%'}</strong></div>
            <div className="macro-panel p-4"><span className="macro-kpi-label">PROFIT FACTOR · CLOSED POSITIONS</span><strong className="mt-2 block font-mono text-xl text-slate-100">{analytics.profitFactor === null ? '—' : analytics.profitFactor.toFixed(2)}</strong></div>
          </div>
          <p className="mt-3 text-[10px] text-slate-500">Account login {selected.account_login} · observed {dateTime(selected.observed_at)} WAT · received {dateTime(selected.received_at)} WAT. Trade-level P&L aggregates entry and exit deal costs by position identifier; no assumed starting balance or synthetic history.</p>
        </section>

        <section className="macro-section">
          <div className="macro-section-heading"><div><span className="eyebrow">LIVE ACCOUNT EXPOSURE</span><h2>Open positions</h2></div><span className="macro-section-note mono">BROKER-REPORTED</span></div>
          <div className="macro-panel overflow-x-auto">
            {selected.positions.length ? <table className="w-full min-w-[720px] text-xs">
              <thead className="text-left text-[10px] text-slate-500"><tr><th className="p-3">SYMBOL</th><th className="p-3">SIDE</th><th className="p-3">VOLUME</th><th className="p-3">OPEN</th><th className="p-3">CURRENT</th><th className="p-3">FLOATING P/L</th><th className="p-3">OPENED · BROKER SERVER</th></tr></thead>
              <tbody>{selected.positions.map((position) => <tr key={position.ticket} className="border-t border-white/[0.06]">
                <td className="p-3 font-mono text-slate-100">{position.symbol}</td><td className="p-3">{position.side}</td><td className="p-3 font-mono">{position.volume}</td><td className="p-3 font-mono">{position.openPrice}</td><td className="p-3 font-mono">{position.currentPrice}</td><td className={'p-3 font-mono ' + (position.profit >= 0 ? 'text-emerald-300' : 'text-amber-300')}>{money(position.profit + position.swap, selected.currency)}</td><td className="p-3 text-slate-400">{position.openedAtServer}</td>
              </tr>)}</tbody>
            </table> : <p className="p-5 text-xs text-slate-500">No open positions reported by the latest account snapshot.</p>}
          </div>
        </section>

        <section className="macro-section">
          <div className="macro-section-heading"><div><span className="eyebrow">EXECUTION RECORD</span><h2>Recent closed trades</h2></div><span className="macro-section-note mono">RECONCILED BY POSITION IDENTIFIER</span></div>
          <div className="macro-panel overflow-x-auto">
            {closedTrades.length ? <table className="w-full min-w-[760px] text-xs">
              <thead className="text-left text-[10px] text-slate-500"><tr><th className="p-3">CLOSED · BROKER SERVER</th><th className="p-3">SYMBOL</th><th className="p-3">SIDE</th><th className="p-3">VOLUME</th><th className="p-3">NET TRADE P/L · {selected.currency}</th><th className="p-3">MAGIC / EA</th><th className="p-3">POSITION ID</th></tr></thead>
              <tbody>{closedTrades.slice(0,100).map((trade) => <tr key={trade.positionId} className="border-t border-white/[0.06]">
                <td className="p-3 text-slate-400">{trade.closedAt}</td><td className="p-3 font-mono text-slate-100">{trade.symbol}</td><td className="p-3">{trade.side}</td><td className="p-3 font-mono">{trade.volume}</td><td className={'p-3 font-mono ' + (trade.net >= 0 ? 'text-emerald-300' : 'text-amber-300')}>{money(trade.net, selected.currency)}</td><td className="p-3 font-mono">{trade.magic || '—'}</td><td className="p-3 font-mono">{trade.positionId}</td>
              </tr>)}</tbody>
            </table> : <p className="p-5 text-xs text-slate-500">No fully reconciled closed-position history has arrived yet.</p>}
            {selectedDeals.length >= 500 && <p className="p-3 text-[10px] text-amber-300">History sync reached the 500-deal batch cap. This view represents the latest synchronized records only; older history requires additional batches and is not assumed complete.</p>}
          </div>
        </section>
      </> : <section className="macro-section">
        <div className="macro-panel p-6">
          <span className="eyebrow">AWAITING MT5 PUBLISHER</span>
          <h2 className="mt-2 text-lg font-semibold text-slate-100">Your broker account is not connected yet.</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">Set the two private Vercel environment tokens, install the read-only publisher in MT5, allow the MacroLync domain in MT5 WebRequest settings and start the publisher. The dashboard will populate after its first successful sync.</p>
          <a href="/MacroLyncAccountPublisher.mq5" download className="mt-4 inline-flex rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-300">DOWNLOAD MT5 ACCOUNT PUBLISHER</a>
          <p className="mt-4 text-[11px] leading-relaxed text-slate-500">This connector transmits account metadata, positions and deal history only. It cannot open, modify or close orders. It never reads or transmits your broker password.</p>
        </div>
      </section>}

      {lastRefresh && <p className="mt-6 text-right text-[10px] text-slate-500">Dashboard refresh {dateTime(lastRefresh)} WAT · auto-refresh every 30 seconds while connected</p>}
    </div>
  );
}
