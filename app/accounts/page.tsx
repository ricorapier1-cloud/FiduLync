'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Deal = {
  account_key: string;
  deal_ticket: string;
  position_id: string | null;
  symbol: string;
  side: string;
  entry_type: string;
  volume: number;
  price: number;
  profit: number;
  commission: number;
  swap: number;
  fee: number;
  deal_time_server: string;
  magic: string | null;
  comment: string | null;
};

type Position = {
  ticket: string;
  positionId: string | null;
  symbol: string;
  side: string;
  volume: number;
  openPrice: number;
  currentPrice: number;
  profit: number;
  swap: number;
  stopLoss: number | null;
  takeProfit: number | null;
  openedAtServer: string;
  magic: string | null;
  comment: string | null;
};

type Account = {
  account_key: string;
  account_login: string;
  broker: string | null;
  server: string;
  currency: string;
  leverage: number;
  account_mode: string;
  balance: number;
  equity: number;
  margin: number;
  free_margin: number;
  margin_level: number | null;
  positions: Position[];
  observed_at: string;
  received_at: string;
};

type Payload = {
  status: string;
  generatedAtUtc: string;
  accounts: Account[];
  deals: Deal[];
  error?: string;
};

type MarketDataStatus = {
  quoteStatus: string;
  quoteExecutionGrade: boolean;
  quoteUpdatedAtUtc: string | null;
  candleStatus: string;
  timestampBasis: string | null;
  serverUtcOffsetMinutes: number | null;
  timestampCaveat: string | null;
  candleExecutionGrade: boolean;
  latestCandleUtc: string | null;
  executionGrade: boolean;
  reason: string | null;
};

type ClosedTrade = {
  positionId: string;
  symbol: string;
  side: string;
  volume: number;
  net: number;
  closedAtServer: string;
  magic: string | null;
};

const money = (value: number, currency: string) => {
  const normalized = currency.toUpperCase();
  if (/^[A-Z]{3}$/.test(normalized)) {
    return new Intl.NumberFormat(undefined, {
      style: 'currency', currency: normalized, maximumFractionDigits: 2,
    }).format(value);
  }
  return normalized + ' ' + new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
};

const number = (value: number | null | undefined, digits = 2) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? '—'
    : new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(value);

const utcToWat = (value: string | null | undefined) => {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Africa/Lagos',
  }).format(new Date(value));
};

const netDeal = (deal: Deal) =>
  Number(deal.profit) + Number(deal.commission) + Number(deal.swap) + Number(deal.fee);

const closesPosition = (deal: Deal) => ['OUT', 'OUT_BY', 'INOUT'].includes(deal.entry_type);

export default function AccountsPage() {
  const [token, setToken] = useState('');
  const [payload, setPayload] = useState<Payload | null>(null);
  const [status, setStatus] = useState<'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR'>('DISCONNECTED');
  const [message, setMessage] = useState('');
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [selectedAccountKey, setSelectedAccountKey] = useState('');
  const [marketData, setMarketData] = useState<MarketDataStatus | null>(null);
  const [marketDataError, setMarketDataError] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  const refresh = useCallback(async (credential: string, preferredAccountKey = '') => {
    if (!credential.trim()) return;
    setStatus((current) => current === 'CONNECTED' ? current : 'CONNECTING');
    try {
      const response = await fetch('/api/v1/accounts', {
        cache: 'no-store',
        headers: { Authorization: 'Bearer ' + credential.trim() },
      });
      const data = await response.json() as Payload;
      if (!response.ok) throw new Error(data.error ?? 'Account service unavailable.');
      const selectedKey = data.accounts?.some((account) => account.account_key === preferredAccountKey)
        ? preferredAccountKey
        : data.accounts?.[0]?.account_key ?? '';
      setPayload(data);
      setSelectedAccountKey(selectedKey);
      setLastRefresh(new Date().toISOString());
      setStatus('CONNECTED');
      setMessage(data.status === 'AWAITING_FIRST_SYNC'
        ? 'Read access verified. Waiting for the first MT5 publisher sync.'
        : data.accounts?.length ? '' : 'No MT5 account snapshot has been received yet.');
    } catch (error) {
      setStatus('ERROR');
      setMessage(error instanceof Error ? error.message : 'Could not retrieve private account data.');
    }
  }, []);

  const refreshMarketData = useCallback(async (credential: string, accountKey: string) => {
    if (!credential || !accountKey) {
      setMarketData(null);
      return;
    }
    try {
      const headers = { Authorization: 'Bearer ' + credential };
      const quoteUrl = '/api/v1/live-quotes?accountKey=' + encodeURIComponent(accountKey);
      const candleUrl = '/api/v1/intraday-candles?symbol=EURUSD&accountKey=' + encodeURIComponent(accountKey);
      const [quoteResponse, candleResponse] = await Promise.all([
        fetch(quoteUrl, { cache: 'no-store', headers }),
        fetch(candleUrl, { cache: 'no-store', headers }),
      ]);
      const [quotes, candles] = await Promise.all([
        quoteResponse.json() as Promise<{
          status?: string; executionGrade?: boolean; latestQuoteUtc?: string; executionGradeReason?: string;
        }>,
        candleResponse.json() as Promise<{
          status?: string; executionGrade?: boolean; latestBarUtc?: string; executionGradeReason?: string;
          timestampProvenance?: { timeBasis?: string | null; serverUtcOffsetMinutes?: number | null; historicalOffsetCaveat?: string };
        }>,
      ]);
      const quoteExecutionGrade = quoteResponse.ok && quotes.executionGrade === true;
      const candleExecutionGrade = candleResponse.ok && candles.executionGrade === true;
      setMarketData({
        quoteStatus: quotes.status ?? (quoteResponse.ok ? 'UNKNOWN' : 'UNAVAILABLE'),
        quoteExecutionGrade,
        quoteUpdatedAtUtc: quotes.latestQuoteUtc ?? null,
        candleStatus: candles.status ?? (candleResponse.ok ? 'UNKNOWN' : 'UNAVAILABLE'),
        candleExecutionGrade,
        latestCandleUtc: candles.latestBarUtc ?? null,
        timestampBasis: candles.timestampProvenance?.timeBasis ?? null,
        serverUtcOffsetMinutes: candles.timestampProvenance?.serverUtcOffsetMinutes ?? null,
        timestampCaveat: candles.timestampProvenance?.historicalOffsetCaveat ?? null,
        executionGrade: quoteExecutionGrade && candleExecutionGrade,
        reason: quotes.executionGradeReason ?? candles.executionGradeReason ?? null,
      });
      setMarketDataError(null);
    } catch {
      setMarketDataError('Private MT5 market-data status could not be retrieved.');
      setMarketData({
        quoteStatus: 'UNAVAILABLE', quoteExecutionGrade: false, quoteUpdatedAtUtc: null,
        candleStatus: 'UNAVAILABLE', candleExecutionGrade: false, latestCandleUtc: null,
        timestampBasis: null, serverUtcOffsetMinutes: null, timestampCaveat: null,
        executionGrade: false, reason: 'Publisher or private market-data service is unavailable.',
      });
    }
  }, []);

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedToken = window.sessionStorage.getItem('macrolinc-account-read-token') ?? '';
      const savedAccountKey = window.sessionStorage.getItem('macrolinc-selected-account-key') ?? '';
      if (savedToken) {
        setToken(savedToken);
        void refresh(savedToken, savedAccountKey);
      }
      if (savedAccountKey) setSelectedAccountKey(savedAccountKey);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    if (selectedAccountKey) window.sessionStorage.setItem('macrolinc-selected-account-key', selectedAccountKey);
  }, [selectedAccountKey]);

  useEffect(() => {
    if (!token || status !== 'CONNECTED') return;
    const timer = window.setInterval(() => void refresh(token, selectedAccountKey), 30_000);
    return () => window.clearInterval(timer);
  }, [token, status, selectedAccountKey, refresh]);

  useEffect(() => {
    if (!token || !selectedAccountKey || status !== 'CONNECTED') {
      setMarketData(null);
      return;
    }
    void refreshMarketData(token, selectedAccountKey);
    const timer = window.setInterval(() => void refreshMarketData(token, selectedAccountKey), 15_000);
    return () => window.clearInterval(timer);
  }, [token, selectedAccountKey, status, refreshMarketData]);

  const selected = payload?.accounts.find((account) => account.account_key === selectedAccountKey) ?? payload?.accounts[0] ?? null;
  const selectedDeals = useMemo(() => selected
    ? (payload?.deals ?? []).filter((deal) => deal.account_key === selected.account_key)
    : [], [payload?.deals, selected]);

  const closedTrades = useMemo<ClosedTrade[]>(() => {
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
      const entry = items.find((deal) => deal.entry_type === 'IN' && ['BUY', 'SELL'].includes(deal.side));
      const exit = items.filter(closesPosition)
        .sort((left, right) => right.deal_time_server.localeCompare(left.deal_time_server))[0];
      if (!entry || !exit) return [];
      return [{
        positionId,
        symbol: entry.symbol,
        side: entry.side,
        volume: items.filter((deal) => deal.entry_type === 'IN').reduce((sum, deal) => sum + Number(deal.volume), 0),
        net: items.reduce((sum, deal) => sum + netDeal(deal), 0),
        closedAtServer: exit.deal_time_server,
        magic: entry.magic,
      }];
    }).sort((left, right) => right.closedAtServer.localeCompare(left.closedAtServer));
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

  const accountAgeMs = selected && now > 0 ? now - Date.parse(selected.received_at) : null;
  const accountFresh = accountAgeMs !== null && Number.isFinite(accountAgeMs)
    && accountAgeMs >= -30_000 && accountAgeMs <= 60_000;

  const saveToken = () => {
    const value = token.trim();
    if (value.length < 32) {
      setMessage('The account-read token must be at least 32 characters.');
      setStatus('ERROR');
      return;
    }
    window.sessionStorage.setItem('macrolinc-account-read-token', value);
    void refresh(value, selectedAccountKey);
  };

  const disconnect = () => {
    window.sessionStorage.removeItem('macrolinc-account-read-token');
    window.sessionStorage.removeItem('macrolinc-selected-account-key');
    setToken('');
    setPayload(null);
    setSelectedAccountKey('');
    setMarketData(null);
    setStatus('DISCONNECTED');
    setMessage('Private account data disconnected from this browser session.');
  };

  return (
    <main className="min-h-screen bg-[#070b12] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-300">MacroLync · Private Account Data</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">MT5 Account Link</h1>
            <p className="mt-1 text-sm text-slate-400">Read-only broker snapshots, positions, closed trades and market-data integrity.</p>
          </div>
          <Link href="/desk" className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">
            Return to Desk
          </Link>
        </div>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Private account-read credential</h2>
              <p className="mt-1 text-xs leading-5 text-slate-400">Use the value of Vercel <code>MT5_ACCOUNT_READ_TOKEN</code>. It is stored in this browser session only.</p>
            </div>
            <span className={'rounded-full px-3 py-1 text-xs font-mono ' + (status === 'CONNECTED' ? 'bg-emerald-500/10 text-emerald-300' : status === 'ERROR' ? 'bg-rose-500/10 text-rose-300' : 'bg-slate-800 text-slate-300')}>
              {status}
            </span>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="password"
              autoComplete="off"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Paste MT5_ACCOUNT_READ_TOKEN"
              className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
            />
            <button onClick={saveToken} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
              Save & Connect
            </button>
            <button onClick={disconnect} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">
              Disconnect
            </button>
          </div>
          {message && <p className="mt-3 text-sm text-amber-200">{message}</p>}
          {lastRefresh && <p className="mt-2 text-xs text-slate-500">Account API last refreshed: {utcToWat(lastRefresh)} WAT</p>}
        </section>

        <section className="mt-6 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.035] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.18em] text-cyan-300">Live MT5 market-data connection</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-100">Install the read-only account publisher</h2>
            </div>
            <a href="/MacroLyncAccountPublisher.mq5" className="rounded-lg border border-cyan-300/40 px-3 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-300/10" download>
              Download MT5 publisher
            </a>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            This publisher sends authenticated broker quotes, closed M5/D1 candles, account snapshots and broker-server-day risk telemetry. It does not place, modify or close trades. Public Swissquote/Yahoo data remains reference-only and cannot clear the execution-data gate.
          </p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-300">
            <li>Copy the downloaded file into MT5 <code>MQL5/Experts</code> and compile it in MetaEditor.</li>
            <li>In MT5, open Tools → Options → Expert Advisors and allow WebRequest for <code>https://fidulync.vercel.app</code>.</li>
            <li>Attach the publisher to one chart. Set <code>InpAccountIngestToken</code> to the exact Vercel <code>MT5_ACCOUNT_INGEST_TOKEN</code> value.</li>
            <li>Set <code>InpMarketWatchSymbols</code> to your broker's exact names. The default is <code>EURUSD,GBPUSD,USDJPY,XAUUSD</code>; add suffixes such as <code>EURUSD.a</code> if your broker uses them.</li>
            <li>Keep MT5 online. Quotes publish every 15 seconds; closed M5/D1 history and account-deal history are refreshed automatically.</li>
            <li>Return to the Desk. The selected account is shared in this browser session; broker data is execution-grade only when a real account, fresh quotes and sufficient fresh candles are verified.</li>
          </ol>
          <p className="mt-4 text-xs leading-5 text-amber-200/90">
            The publisher has not been compiled or connected to your broker from this environment. Do not treat the feed as connected until the account, quote and candle timestamps appear fresh in the Desk.
          </p>
        </section>

        {payload && payload.accounts.length > 1 && (
          <section className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <label htmlFor="account-select" className="text-sm text-slate-300">Linked MT5 account</label>
            <select id="account-select" value={selectedAccountKey} onChange={(event) => setSelectedAccountKey(event.target.value)}
              className="min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100">
              {payload.accounts.map((account) => (
                <option key={account.account_key} value={account.account_key}>
                  {account.broker ?? 'MT5'} · {account.account_login} · {account.server} · {account.account_mode}
                </option>
              ))}
            </select>
          </section>
        )}

        {selected && (
          <>
            <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ['BALANCE', money(selected.balance, selected.currency)],
                ['EQUITY', money(selected.equity, selected.currency)],
                ['FREE MARGIN', money(selected.free_margin, selected.currency)],
                ['MARGIN LEVEL', selected.margin_level === null ? '—' : number(selected.margin_level) + '%'],
              ].map(([label, value]) => (
                <article key={label} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <p className="text-[11px] font-mono tracking-[0.16em] text-slate-500">{label}</p>
                  <p className="mt-2 text-xl font-semibold tabular-nums text-slate-100">{value}</p>
                </article>
              ))}
            </section>

            <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{selected.broker ?? 'MT5'} · {selected.account_login}</h2>
                  <p className="mt-1 text-xs text-slate-400">{selected.server} · {selected.account_mode} · {selected.currency} · 1:{selected.leverage}</p>
                </div>
                <span className={'rounded-full px-3 py-1 text-xs font-mono ' + (accountFresh ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-200')}>
                  {accountFresh ? 'ACCOUNT HEARTBEAT FRESH' : 'ACCOUNT SNAPSHOT STALE'}
                </span>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Broker observation: {utcToWat(selected.observed_at)} WAT · Server received: {utcToWat(selected.received_at)} WAT
              </p>
            </section>

            <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Broker market-data integrity</h2>
                  <p className="mt-1 text-xs text-slate-400">Quotes and candles must both be current and sourced from this real MT5 account.</p>
                </div>
                <span className={'rounded-full px-3 py-1 text-xs font-mono ' + (marketData?.executionGrade ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-200')}>
                  {marketData?.executionGrade ? 'BROKER DATA VERIFIED' : 'NOT EXECUTION-GRADE'}
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
                  <p className="text-[11px] font-mono tracking-widest text-slate-500">LIVE BID / ASK QUOTES</p>
                  <p className="mt-2 text-sm font-semibold">{marketData?.quoteExecutionGrade ? 'FRESH · REAL MT5 ACCOUNT' : marketData?.quoteStatus ?? 'WAITING'}</p>
                  <p className="mt-1 text-xs text-slate-500">Updated: {utcToWat(marketData?.quoteUpdatedAtUtc)} WAT</p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
                  <p className="text-[11px] font-mono tracking-widest text-slate-500">CLOSED M5 / D1 CANDLES</p>
                  <p className="mt-2 text-sm font-semibold">{marketData?.candleExecutionGrade ? 'FRESH · REAL MT5 ACCOUNT' : marketData?.candleStatus ?? 'WAITING'}</p>
                  <p className="mt-1 text-xs text-slate-500">Latest M5 bar: {utcToWat(marketData?.latestCandleUtc)} WAT</p>
                  {marketData?.timestampBasis && <p className="mt-1 text-[10px] text-slate-600">Timestamp basis: {marketData.timestampBasis}; broker UTC offset {marketData.serverUtcOffsetMinutes ?? '—'} min.</p>}
                </div>
              </div>
              {(marketData?.reason || marketDataError) && <p className="mt-3 text-xs text-amber-200">{marketDataError ?? marketData?.reason}</p>}
              {marketData?.timestampCaveat && <p className="mt-3 text-[11px] leading-5 text-slate-500">{marketData.timestampCaveat}</p>}
              {selected.account_mode !== 'REAL' && <p className="mt-3 text-xs text-amber-200">Demo/contest accounts may be inspected, but they cannot produce execution-grade market data or clear the EA governance gate.</p>}
            </section>

            <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Open broker positions</h2>
                  <p className="mt-1 text-xs text-slate-400">Live position snapshot from MT5; no manual entries are mixed into this table.</p>
                </div>
                <span className="text-xs font-mono text-slate-400">{selected.positions.length} OPEN</span>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-wider text-slate-500">
                    <tr><th className="py-2">Symbol</th><th>Side</th><th>Volume</th><th>Open</th><th>Current</th><th>SL</th><th>TP</th><th>Net P/L</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {selected.positions.map((position) => (
                      <tr key={position.ticket}>
                        <td className="py-3 font-semibold">{position.symbol}</td>
                        <td>{position.side}</td>
                        <td className="tabular-nums">{number(position.volume, 3)}</td>
                        <td className="tabular-nums">{number(position.openPrice, 5)}</td>
                        <td className="tabular-nums">{number(position.currentPrice, 5)}</td>
                        <td className="tabular-nums">{position.stopLoss === null ? '—' : number(position.stopLoss, 5)}</td>
                        <td className="tabular-nums">{position.takeProfit === null ? '—' : number(position.takeProfit, 5)}</td>
                        <td className={'tabular-nums font-semibold ' + (position.profit + position.swap >= 0 ? 'text-emerald-300' : 'text-rose-300')}>
                          {money(position.profit + position.swap, selected.currency)}
                        </td>
                      </tr>
                    ))}
                    {selected.positions.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-slate-500">No open positions in the latest broker snapshot.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Closed broker trade history</h2>
                  <p className="mt-1 text-xs text-slate-400">Trades are reconstructed from MT5 deal tickets and position identifiers. Times below remain in broker-server time.</p>
                </div>
                <span className="text-xs font-mono text-slate-400">{analytics.count} CLOSED</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-slate-950/70 p-3"><p className="text-[10px] font-mono text-slate-500">NET REALISED P/L</p><p className="mt-1 font-semibold">{money(analytics.net, selected.currency)}</p></div>
                <div className="rounded-lg bg-slate-950/70 p-3"><p className="text-[10px] font-mono text-slate-500">OBSERVED WIN RATE</p><p className="mt-1 font-semibold">{analytics.winRate === null ? '—' : number(analytics.winRate) + '%'}</p></div>
                <div className="rounded-lg bg-slate-950/70 p-3"><p className="text-[10px] font-mono text-slate-500">OBSERVED PROFIT FACTOR</p><p className="mt-1 font-semibold">{analytics.profitFactor === null ? '—' : number(analytics.profitFactor)}</p></div>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">These are descriptive account statistics, not a validated forward win probability or proof of strategy expectancy.</p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-wider text-slate-500">
                    <tr><th className="py-2">Symbol</th><th>Side</th><th>Volume</th><th>Position ID</th><th>Closed (broker time)</th><th>Net P/L</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {closedTrades.slice(0, 100).map((trade) => (
                      <tr key={trade.positionId}>
                        <td className="py-3 font-semibold">{trade.symbol}</td>
                        <td>{trade.side}</td>
                        <td className="tabular-nums">{number(trade.volume, 3)}</td>
                        <td className="font-mono text-xs text-slate-500">{trade.positionId}</td>
                        <td className="font-mono text-xs">{trade.closedAtServer}</td>
                        <td className={'tabular-nums font-semibold ' + (trade.net >= 0 ? 'text-emerald-300' : 'text-rose-300')}>{money(trade.net, selected.currency)}</td>
                      </tr>
                    ))}
                    {closedTrades.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-slate-500">No complete closed trades have been received from MT5 yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {status === 'CONNECTED' && !selected && (
          <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
            Access is verified. No MT5 account snapshot has arrived. Install the publisher above and keep the terminal connected.
          </section>
        )}
      </div>
    </main>
  );
}
