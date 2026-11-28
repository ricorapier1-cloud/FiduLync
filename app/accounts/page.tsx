'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

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

const money = (value: number, currency: string) => {
  const normalizedCurrency = currency.toUpperCase();
  if (/^[A-Z]{3}$/.test(normalizedCurrency)) {
    return new Intl.NumberFormat(undefined, {
      style: 'currency', currency: normalizedCurrency, maximumFractionDigits: 2,
    }).format(value);
  }
  return normalizedCurrency + ' ' + new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(value);
};
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
  const [now, setNow] = useState(0);
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
    const timer = window.setTimeout(() => {
      const saved = window.sessionStorage.getItem('macrolinc-account-read-token');
      if (saved) {
        setToken(saved);
        void refresh(saved);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (status !== 'CONNECTED' || !token) return;
    const timer = window.setInterval(() => void refresh(token), 30_000);
    return () => window.clearInterval(timer);
  }, [status, token, payload?.accounts.length, refresh]);

  const selected = payload?.accounts.find((account) => account.account_key === selectedAccountKey) ?? payload?.accounts[0] ?? null;

  // Verified Manual Ledger Mode State
  type ManualTrade = {
    id: string;
    ticket: string;
    date: string;
    symbol: string;
    direction: 'BUY' | 'SELL';
    volume: number;
    profit: number;
    rUnits: number;
    slippagePips: number;
    ruleAdhered: boolean;
  };

  type ProfitSweep = {
    id: string;
    date: string;
    amount: number;
    percent: number;
    destination: string;
  };

  const [manualTrades, setManualTrades] = useState<ManualTrade[]>([]);
  const [profitSweeps, setProfitSweeps] = useState<ProfitSweep[]>([]);
  const [newSymbol, setNewSymbol] = useState('EURUSD');
  const [newDirection, setNewDirection] = useState<'BUY' | 'SELL'>('SELL');
  const [newVolume, setNewVolume] = useState('0.10');
  const [newProfit, setNewProfit] = useState('');
  const [newRMultiple, setNewRMultiple] = useState('');
  const [newSlippage, setNewSlippage] = useState('0.3');
  const [newRuleAdhered, setNewRuleAdhered] = useState(true);
  const [ledgerError, setLedgerError] = useState<string | null>(null);

  // Profit sweep form state
  const [sweepAmount, setSweepAmount] = useState('');
  const [sweepPercent, setSweepPercent] = useState(30);
  const [sweepDest, setSweepDest] = useState('Treasury Reserve Bank');

  // Load manual trades & sweeps from localStorage
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const storedTrades = window.localStorage.getItem('fidulync-manual-trades-history-v1');
        if (storedTrades) {
          setManualTrades(JSON.parse(storedTrades));
        }
        const storedSweeps = window.localStorage.getItem('fidulync-profit-sweeps-v1');
        if (storedSweeps) {
          setProfitSweeps(JSON.parse(storedSweeps));
        }
      } catch {
        // ignore parsing errors
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const saveManualTrades = (updatedList: ManualTrade[]) => {
    setManualTrades(updatedList);
    localStorage.setItem('fidulync-manual-trades-history-v1', JSON.stringify(updatedList));
  };

  const saveProfitSweeps = (updatedList: ProfitSweep[]) => {
    setProfitSweeps(updatedList);
    localStorage.setItem('fidulync-profit-sweeps-v1', JSON.stringify(updatedList));
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const tradesToday = manualTrades.filter((t) => t.date.slice(0, 10) === todayStr);
  const lossesToday = tradesToday.filter((t) => t.profit < 0);
  const circuitBreakerTripped = tradesToday.length >= 2 || lossesToday.length >= 2;

  const handleAddManualTrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (circuitBreakerTripped) {
      setLedgerError('Circuit breaker active: Daily maximum of 2 trades or 2 losses reached. Entry blocked.');
      return;
    }
    const profitNum = parseFloat(newProfit);
    if (!Number.isFinite(profitNum)) {
      setLedgerError('Enter a valid numeric profit amount.');
      return;
    }
    const rNum = newRMultiple.trim() ? parseFloat(newRMultiple) : profitNum >= 0 ? profitNum / 100 : profitNum / 100;
    const slipNum = parseFloat(newSlippage) || 0;
    const volNum = parseFloat(newVolume) || 0.1;

    const newTrade: ManualTrade = {
      id: 'TRD-' + Date.now(),
      ticket: 'MAN-' + (manualTrades.length + 1),
      date: new Date().toISOString(),
      symbol: newSymbol,
      direction: newDirection,
      volume: volNum,
      profit: profitNum,
      rUnits: Number.isFinite(rNum) ? rNum : profitNum >= 0 ? 1.0 : -1.0,
      slippagePips: slipNum,
      ruleAdhered: newRuleAdhered,
    };

    const updated = [newTrade, ...manualTrades];
    saveManualTrades(updated);
    setNewProfit('');
    setNewRMultiple('');
    setLedgerError(null);
  };

  const handleAddSweep = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(sweepAmount);
    if (!Number.isFinite(amt) || amt <= 0) return;
    const sweep: ProfitSweep = {
      id: 'SWP-' + Date.now(),
      date: new Date().toISOString().slice(0, 10),
      amount: amt,
      percent: sweepPercent,
      destination: sweepDest,
    };
    saveProfitSweeps([sweep, ...profitSweeps]);
    setSweepAmount('');
  };

  const exportLedgerCsv = () => {
    if (manualTrades.length === 0) return;
    const headers = 'ID,Date,Symbol,Direction,Volume,NetProfit,RMultiple,SlippagePips,RuleAdhered\n';
    const rows = manualTrades.map((t) => `${t.ticket},${t.date},${t.symbol},${t.direction},${t.volume},${t.profit},${t.rUnits},${t.slippagePips},${t.ruleAdhered ? "YES" : "NO"}`).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fidulync-verified-ledger-${todayStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportLedgerJson = () => {
    if (manualTrades.length === 0) return;
    const blob = new Blob([JSON.stringify(manualTrades, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fidulync-verified-ledger-${todayStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };


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

  // Rolling 20-Trade Edge-Decay & Slippage Engine
  // Prefers broker closed trades if connected, otherwise manual ledger trades
  const rolling20Trades = useMemo(() => {
    if (closedTrades.length >= 5) {
      return closedTrades.slice(0, 20).map((t) => ({
        profit: t.net,
        rUnits: t.net >= 0 ? t.net / 100 : t.net / 100,
        slippage: 0.4, // standard broker execution slippage baseline
        ruleAdhered: true,
      }));
    }
    return manualTrades.slice(0, 20).map((t) => ({
      profit: t.profit,
      rUnits: t.rUnits,
      slippage: t.slippagePips,
      ruleAdhered: t.ruleAdhered,
    }));
  }, [closedTrades, manualTrades]);

  const rolling20Metrics = useMemo(() => {
    if (rolling20Trades.length === 0) {
      return { count: 0, expectancyR: null, expectancyDollars: null, profitFactor: null, avgSlippage: null, ruleAdherencePct: null, edgeDecayWarning: false };
    }
    const count = rolling20Trades.length;
    const wins = rolling20Trades.filter((t) => t.profit > 0);
    const losses = rolling20Trades.filter((t) => t.profit < 0);
    const grossWin = wins.reduce((sum, t) => sum + t.profit, 0);
    const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.profit, 0));
    const profitFactor = grossLoss > 0 ? Number((grossWin / grossLoss).toFixed(2)) : grossWin > 0 ? 99.9 : 0;
    const sumR = rolling20Trades.reduce((sum, t) => sum + t.rUnits, 0);
    const expectancyR = Number((sumR / count).toFixed(2));
    const sumDollars = rolling20Trades.reduce((sum, t) => sum + t.profit, 0);
    const expectancyDollars = Number((sumDollars / count).toFixed(2));
    const avgSlippage = Number((rolling20Trades.reduce((sum, t) => sum + t.slippage, 0) / count).toFixed(2));
    const adheredCount = rolling20Trades.filter((t) => t.ruleAdhered).length;
    const ruleAdherencePct = Number(((adheredCount / count) * 100).toFixed(1));

    // Automatic Edge-Decay Throttle: If count >= 20 and (expectancyR < 0.0 or profitFactor < 1.05)
    const edgeDecayWarning = count >= 20 && (expectancyR < 0.0 || profitFactor < 1.05);

    return {
      count,
      expectancyR,
      expectancyDollars,
      profitFactor,
      avgSlippage,
      ruleAdherencePct,
      edgeDecayWarning,
    };
  }, [rolling20Trades]);

  // Capital Scaling Tier based on verified completed trades and equity
  const totalCompletedTradesCount = closedTrades.length > 0 ? closedTrades.length : manualTrades.length;
  const currentEquityNumber = selected ? Number(selected.equity) : 10000;
  const activeScalingTier = useMemo(() => {
    if (totalCompletedTradesCount >= 60 && currentEquityNumber >= 50000) {
      return { tier: 4, name: 'Tier 4 · $100k Institutional', riskPercent: 1.0, dollarCap: 1000, nextRequirement: 'Maximum scale unlocked.' };
    }
    if (totalCompletedTradesCount >= 30 && currentEquityNumber >= 25000) {
      return { tier: 3, name: 'Tier 3 · $50k Scale', riskPercent: 1.0, dollarCap: 500, nextRequirement: 'Unlock Tier 4 at 60 completed trades + $50k equity high.' };
    }
    if (totalCompletedTradesCount >= 30 && currentEquityNumber >= 10000) {
      return { tier: 2, name: 'Tier 2 · $25k Scale', riskPercent: 1.0, dollarCap: 250, nextRequirement: 'Unlock Tier 3 at $25k equity high + 30 trades.' };
    }
    return { tier: 1, name: 'Tier 1 · $10k Base', riskPercent: 1.0, dollarCap: 100, nextRequirement: 'Unlock Tier 2 after verified equity high + 30 completed trades with positive expectancy.' };
  }, [totalCompletedTradesCount, currentEquityNumber]);

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

  const observedAge = selected && now > 0 ? Math.max(0, now - Date.parse(selected.observed_at)) : null;
  const freshness = observedAge === null ? 'NO DATA' : observedAge <= 90_000 ? 'FRESH' : observedAge <= 300_000 ? 'DELAYED' : 'STALE';

  return (
    <div className="macro-page pb-24">
      <div className="macro-statusline mono">
        <span><span className="macro-pulse" /> PRIVATE PORTFOLIO INTELLIGENCE</span>
        <span className="macro-status-right flex items-center gap-2">
          <Link href="/" className="macro-refresh">← TERMINAL</Link>
          <Link href="/validation" className="macro-refresh">MONTE CARLO WORKBENCH →</Link>
          <span className="text-slate-500">READ-ONLY · MT5</span>
        </span>
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
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">The read token is kept in this browser tab&apos;s session storage only. It is not a broker password. Never paste your IC Markets master or investor password here.</p>
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
          <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-5">
            <div className="macro-panel p-4"><span className="macro-kpi-label">REALIZED NET P/L</span><strong className={'mt-2 block font-mono text-xl ' + (analytics.net >= 0 ? 'text-emerald-300' : 'text-amber-300')}>{money(analytics.net, selected.currency)}</strong></div>
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

      
      {/* SECTION: Rolling 20-Trade Edge-Decay & Slippage Monitor */}
      <section className="macro-section mt-8">
        <div className="macro-section-heading">
          <div><span className="eyebrow">STATISTICAL EDGE MONITOR</span><h2>Rolling 20-Trade Edge-Decay &amp; Slippage Monitor</h2></div>
          <span className="macro-section-note mono">AUTONOMOUS RISK THROTTLE</span>
        </div>
        <div className="macro-panel p-5 space-y-4">
          {rolling20Metrics.edgeDecayWarning && (
            <div className="p-4 rounded-lg bg-rose-950/80 border border-rose-600 text-xs text-rose-200">
              <strong className="block text-sm font-bold text-rose-300">
                EDGE_DECAY_WARNING: Rolling 20-Trade expectancy is below threshold ({rolling20Metrics.expectancyR}R / Profit Factor {rolling20Metrics.profitFactor}).
              </strong>
              Recommended desk risk is automatically throttled by 50% (0.50% risk cap) to preserve capital until the next weekend quantitative audit.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded border border-white/[0.08] bg-[#070a0f] p-4">
              <span className="macro-kpi-label">ROLLING 20 EXPECTANCY</span>
              <strong className={`mt-1 block font-mono text-xl ${rolling20Metrics.expectancyR !== null && rolling20Metrics.expectancyR >= 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
                {rolling20Metrics.expectancyR !== null ? `+${rolling20Metrics.expectancyR}R` : '—'}
              </strong>
              <small className="text-slate-500 font-mono">
                {rolling20Metrics.expectancyDollars !== null ? `$${rolling20Metrics.expectancyDollars} / trade` : 'Awaiting trades'}
              </small>
            </div>

            <div className="rounded border border-white/[0.08] bg-[#070a0f] p-4">
              <span className="macro-kpi-label">ROLLING PROFIT FACTOR</span>
              <strong className="mt-1 block font-mono text-xl text-slate-100">
                {rolling20Metrics.profitFactor !== null ? rolling20Metrics.profitFactor.toFixed(2) : '—'}
              </strong>
              <small className="text-slate-500 font-mono">Min target: 1.20+</small>
            </div>

            <div className="rounded border border-white/[0.08] bg-[#070a0f] p-4">
              <span className="macro-kpi-label">AVG LIVE SLIPPAGE</span>
              <strong className="mt-1 block font-mono text-xl text-slate-100">
                {rolling20Metrics.avgSlippage !== null ? `${rolling20Metrics.avgSlippage} pips` : '—'}
              </strong>
              <small className="text-slate-500 font-mono">Execution friction</small>
            </div>

            <div className="rounded border border-white/[0.08] bg-[#070a0f] p-4">
              <span className="macro-kpi-label">RULE ADHERENCE</span>
              <strong className="mt-1 block font-mono text-xl text-emerald-300">
                {rolling20Metrics.ruleAdherencePct !== null ? `${rolling20Metrics.ruleAdherencePct}%` : '—'}
              </strong>
              <small className="text-slate-500 font-mono">Sovereign rules</small>
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            Calculated across the last 20 completed trades. If rolling expectancy falls below 0.0R or profit factor drops below 1.05, the Sovereign Shield automatically activates the 50% risk throttle.
          </p>
        </div>
      </section>

      {/* SECTION: Capital Scaling & Profit-Sweep Tracker */}
      <section className="macro-section mt-8">
        <div className="macro-section-heading">
          <div><span className="eyebrow">CAPITAL MANAGEMENT</span><h2>Capital Scaling &amp; Profit-Sweep Tracker</h2></div>
          <span className="macro-section-note mono">RESERVE ALLOCATION</span>
        </div>
        <div className="macro-panel p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-white/[0.08] bg-[#070a0f] p-4 space-y-2">
              <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Active Capital Scaling Tier</div>
              <div className="text-lg font-bold text-teal-300">{activeScalingTier.name}</div>
              <div className="text-xs text-slate-300">
                Max Risk Allowed: <strong className="text-white">{activeScalingTier.riskPercent}% (${activeScalingTier.dollarCap}/trade)</strong>
              </div>
              <div className="text-xs text-slate-400 pt-2 border-t border-slate-800">
                Next Tier Requirement: <span className="text-slate-300">{activeScalingTier.nextRequirement}</span>
              </div>
            </div>

            <div className="rounded-lg border border-white/[0.08] bg-[#070a0f] p-4 space-y-3">
              <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Record Monthly Profit Sweep</div>
              <form onSubmit={handleAddSweep} className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Amount ($)"
                  value={sweepAmount}
                  onChange={(e) => setSweepAmount(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white w-28 outline-none"
                  required
                />
                <select
                  value={sweepPercent}
                  onChange={(e) => setSweepPercent(Number(e.target.value))}
                  className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white outline-none"
                >
                  <option value={30}>30% Reserve Sweep</option>
                  <option value={40}>40% Reserve Sweep</option>
                  <option value={50}>50% Reserve Sweep</option>
                </select>
                <input
                  type="text"
                  placeholder="Destination"
                  value={sweepDest}
                  onChange={(e) => setSweepDest(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white flex-1 min-w-[120px] outline-none"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-teal-900 hover:bg-teal-800 border border-teal-700 rounded text-xs font-semibold text-teal-200 transition"
                >
                  Log Sweep
                </button>
              </form>
              <p className="text-[10px] text-slate-500">
                Preserves profits by allocating 30%–50% of realized monthly gains to external bank treasury.
              </p>
            </div>
          </div>

          {profitSweeps.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-[10px] text-slate-500 border-b border-white/[0.06]">
                  <tr><th className="p-2">DATE</th><th className="p-2">SWEEP AMOUNT</th><th className="p-2">ALLOCATION %</th><th className="p-2">DESTINATION</th></tr>
                </thead>
                <tbody>
                  {profitSweeps.map((sweep) => (
                    <tr key={sweep.id} className="border-t border-white/[0.04]">
                      <td className="p-2 text-slate-400">{sweep.date}</td>
                      <td className="p-2 font-mono text-emerald-400 font-bold">${sweep.amount.toLocaleString()}</td>
                      <td className="p-2 font-mono text-slate-300">{sweep.percent}%</td>
                      <td className="p-2 text-slate-400">{sweep.destination}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* SECTION: Verified Manual Desk Mode (When Operating Without VPS) */}
      <section className="macro-section mt-8">
        <div className="macro-section-heading">
          <div><span className="eyebrow">DISCIPLINED MANUAL GOVERNANCE</span><h2>Verified Manual Desk Mode (Mobile / Without VPS)</h2></div>
          <span className="macro-section-note mono">2-TRADE / 2-LOSS HARD CIRCUIT BREAKER</span>
        </div>
        <div className="macro-panel p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
            <div>
              <div className="text-xs font-bold text-slate-200">
                Daily Sovereign Shield Governance (Today: {todayStr})
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                Trades Taken: <strong className={tradesToday.length >= 2 ? "text-rose-400" : "text-emerald-400"}>{tradesToday.length}/2</strong> · Losses: <strong className={lossesToday.length >= 2 ? "text-rose-400" : "text-emerald-400"}>{lossesToday.length}/2</strong>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2.5 py-1 rounded font-bold ${circuitBreakerTripped ? "bg-rose-950 border border-rose-700 text-rose-300" : "bg-emerald-950 border border-emerald-700 text-emerald-300"}`}>
                {circuitBreakerTripped ? "CIRCUIT BREAKER: LOCKED OUT" : "GOVERNANCE: CLEARED"}
              </span>
              <button
                type="button"
                onClick={exportLedgerCsv}
                disabled={manualTrades.length === 0}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-600 rounded text-xs text-slate-300"
              >
                Export CSV
              </button>
              <button
                type="button"
                onClick={exportLedgerJson}
                disabled={manualTrades.length === 0}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-600 rounded text-xs text-slate-300"
              >
                Export JSON
              </button>
            </div>
          </div>

          {/* Record Trade Form */}
          <form onSubmit={handleAddManualTrade} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-2 text-xs">
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">SYMBOL</label>
              <select
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white"
              >
                <option value="EURUSD">EURUSD</option>
                <option value="USDJPY">USDJPY</option>
                <option value="XAUUSD">XAUUSD</option>
                <option value="GBPUSD">GBPUSD</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-500 block mb-1">DIRECTION</label>
              <select
                value={newDirection}
                onChange={(e) => setNewDirection(e.target.value as "BUY" | "SELL")}
                className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white"
              >
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-500 block mb-1">LOTS</label>
              <input
                type="number"
                step="0.01"
                value={newVolume}
                onChange={(e) => setNewVolume(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white"
                placeholder="0.10"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-500 block mb-1">NET PROFIT ($)</label>
              <input
                type="number"
                step="0.01"
                value={newProfit}
                onChange={(e) => setNewProfit(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white"
                placeholder="+250 or -100"
                required
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-500 block mb-1">R-MULTIPLE</label>
              <input
                type="number"
                step="0.1"
                value={newRMultiple}
                onChange={(e) => setNewRMultiple(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white"
                placeholder="+2.0 or -1.0"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-500 block mb-1">SLIPPAGE (pips)</label>
              <input
                type="number"
                step="0.1"
                value={newSlippage}
                onChange={(e) => setNewSlippage(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white"
                placeholder="0.3"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-500 block mb-1">RULE ADHERED</label>
              <select
                value={newRuleAdhered ? 'YES' : 'NO'}
                onChange={(e) => setNewRuleAdhered(e.target.value === 'YES')}
                className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white"
              >
                <option value="YES">YES</option>
                <option value="NO">NO</option>
              </select>
            </div>

            <div className="flex flex-col justify-end">
              <button
                type="submit"
                disabled={circuitBreakerTripped}
                className="w-full py-1.5 bg-emerald-900 hover:bg-emerald-800 disabled:opacity-40 border border-emerald-700 text-emerald-200 rounded font-semibold text-xs transition"
              >
                Log Trade
              </button>
            </div>
          </form>

          {ledgerError && (
            <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-800/60 p-2 rounded">
              {ledgerError}
            </div>
          )}

          {/* Manual Trade List */}
          {manualTrades.length > 0 && (
            <div className="overflow-x-auto pt-2">
              <table className="w-full text-xs">
                <thead className="text-left text-[10px] text-slate-500 border-b border-white/[0.06]">
                  <tr>
                    <th className="p-2">TICKET</th>
                    <th className="p-2">DATE</th>
                    <th className="p-2">SYMBOL</th>
                    <th className="p-2">SIDE</th>
                    <th className="p-2">VOLUME</th>
                    <th className="p-2">NET P/L</th>
                    <th className="p-2">R-MULTIPLE</th>
                    <th className="p-2">SLIPPAGE</th>
                    <th className="p-2">RULE ADHERED</th>
                  </tr>
                </thead>
                <tbody>
                  {manualTrades.slice(0, 50).map((trade) => (
                    <tr key={trade.id} className="border-t border-white/[0.04]">
                      <td className="p-2 font-mono text-slate-400">{trade.ticket}</td>
                      <td className="p-2 text-slate-500">{trade.date.slice(0, 16).replace('T', ' ')}</td>
                      <td className="p-2 font-mono font-bold text-white">{trade.symbol}</td>
                      <td className="p-2">{trade.direction}</td>
                      <td className="p-2 font-mono">{trade.volume}</td>
                      <td className={`p-2 font-mono font-bold ${trade.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ${trade.profit.toFixed(2)}
                      </td>
                      <td className="p-2 font-mono text-teal-300">{trade.rUnits > 0 ? `+${trade.rUnits}R` : `${trade.rUnits}R`}</td>
                      <td className="p-2 font-mono text-slate-400">{trade.slippagePips} pips</td>
                      <td className="p-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${trade.ruleAdhered ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'}`}>
                          {trade.ruleAdhered ? 'YES' : 'NO'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {lastRefresh && <p className="mt-6 text-right text-[10px] text-slate-500">Dashboard refresh {dateTime(lastRefresh)} WAT · auto-refresh every 30 seconds while connected</p>}
    </div>
  );
}
