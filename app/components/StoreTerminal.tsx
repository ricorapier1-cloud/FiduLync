'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import BrandGlyph from '@/components/BrandGlyph';
import type { HeartbeatRecord } from '@/lib/eaHeartbeat';
import { getCurrencyStrengthIndex, type getLiquiditySession } from '@/lib/currencyStrength';
import type { TradeExpectancy } from '@/lib/tradeLedger';
import type { MacroSnapshot } from '@/types/macro';

type StoreTerminalProps = {
  initialFleet: { configured: boolean; heartbeats: HeartbeatRecord[] };
  telemetryError: string;
  bridgeSource: string;
  initialSnapshot: MacroSnapshot;
  initialTradeExpectancy: TradeExpectancy;
  session: ReturnType<typeof getLiquiditySession>;
};

type SignalResult = {
  symbol: string;
  bias: 'LONG' | 'SHORT' | 'NEUTRAL';
  confluence_score: number;
  regime: string;
  atr_sl_pips: number | null;
  atr_tp_pips: number | null;
  session: string;
  killzone_active: string;
  csi_spread: number;
  max_risk_pct: number;
  risk_multiplier: number;
  correlation_group: string;
  news_lockout: boolean;
  safe_to_trade: boolean;
  timestamp_utc: string;
};

const symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'USDCAD', 'AUDUSD', 'NZDUSD', 'EURJPY', 'XAUUSD'];

function subscribeToOrigin(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  return () => window.removeEventListener('popstate', onChange);
}

function getBrowserOrigin() {
  return window.location.origin;
}

function getServerOrigin() {
  return '';
}

function formatCurrency(value: number | null) {
  return value === null ? '—' : value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function isSignalResult(value: unknown): value is SignalResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  return typeof result.symbol === 'string'
    && (result.bias === 'LONG' || result.bias === 'SHORT' || result.bias === 'NEUTRAL')
    && typeof result.confluence_score === 'number'
    && typeof result.regime === 'string'
    && (result.atr_sl_pips === null || typeof result.atr_sl_pips === 'number')
    && (result.atr_tp_pips === null || typeof result.atr_tp_pips === 'number')
    && typeof result.session === 'string'
    && typeof result.killzone_active === 'string'
    && typeof result.csi_spread === 'number'
    && typeof result.max_risk_pct === 'number'
    && typeof result.risk_multiplier === 'number'
    && typeof result.correlation_group === 'string'
    && typeof result.news_lockout === 'boolean'
    && typeof result.safe_to_trade === 'boolean'
    && typeof result.timestamp_utc === 'string';
}

export default function StoreTerminal({ initialFleet, telemetryError, bridgeSource, initialSnapshot, initialTradeExpectancy, session }: StoreTerminalProps) {
  const router = useRouter();
  const [symbol, setSymbol] = useState('EURUSD');
  const endpoint = useSyncExternalStore(subscribeToOrigin, getBrowserOrigin, getServerOrigin);
  const [signal, setSignal] = useState<SignalResult | null>(null);
  const [signalError, setSignalError] = useState('');
  const [testing, setTesting] = useState(false);
  const [copyState, setCopyState] = useState('');
  const currencyStrength = getCurrencyStrengthIndex(initialSnapshot);

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [router]);

  async function testSignal() {
    setTesting(true);
    setSignal(null);
    setSignalError('');
    try {
      const response = await fetch(`/api/v1/macro-signal?symbol=${encodeURIComponent(symbol)}`, {
        cache: 'no-store',
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = typeof payload === 'object' && payload !== null && 'error' in payload
          && typeof payload.error === 'string'
          ? payload.error
          : `Signal request failed (${response.status}).`;
        setSignalError(message);
        return;
      }
      if (!isSignalResult(payload)) {
        setSignalError('The signal endpoint returned an invalid response.');
        return;
      }
      setSignal(payload);
    } catch (error) {
      console.error('Live signal tester request failed:', error);
      setSignalError('The signal endpoint could not be reached.');
    } finally {
      setTesting(false);
    }
  }

  async function copyText(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyState(`${label} copied`);
    } catch (error) {
      console.error(`Unable to copy ${label.toLowerCase()}:`, error);
      setCopyState('Clipboard access is unavailable');
    }
  }

  return (
    <div className="min-h-screen bg-[#080a0f] text-slate-100">
      <div className="mx-auto w-full max-w-7xl px-5 py-9 sm:px-8 lg:py-12">
        <div className="flex flex-wrap items-start justify-between gap-5 border-b border-white/[0.08] pb-7">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
              ALGOLYNC / PRIVATE STRATEGY VAULT
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Algorithm command center</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Proprietary strategy architecture, VPS fleet telemetry, and the MacroLync execution bridge.
            </p>
          </div>
          <a
            href="/mql5/MacroLyncBridge.mqh"
            download
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-emerald-300/25 bg-emerald-300/[0.07] px-4 text-xs font-medium text-emerald-100 transition hover:bg-emerald-300/[0.12]"
          >
            <BrandGlyph name="arrow-down" size={15} /> Download MT5 include
          </a>
        </div>

        <section className="mt-7 rounded-xl border border-white/[0.08] bg-[#0c1016] p-4 sm:p-5" aria-label="Market state">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="font-mono text-[9px] tracking-[0.17em] text-slate-500">LIVE MACRO STRENGTH INDEX</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {currencyStrength.map(({ currency, score: strength }) => (
                  <span key={currency} className="inline-flex items-center gap-2 rounded-md border border-white/[0.08] px-2.5 py-2 font-mono text-[10px]">
                    <strong className="text-slate-200">{currency}</strong>
                    <span className={strength >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{strength > 0 ? '+' : ''}{strength}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="min-w-36">
              <div className="font-mono text-[9px] tracking-[0.17em] text-slate-500">LIQUIDITY SESSION</div>
              <div className="mt-3 font-mono text-xs text-emerald-200">{session}</div>
            </div>
          </div>
          <p className="mt-3 text-[9px] leading-4 text-slate-500">CSI is a relative policy/real-rate model adjusted for available COT data, not a price-return index.</p>
        </section>

        <section className="mt-8" aria-labelledby="fleet-heading">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="font-mono text-[9px] tracking-[0.17em] text-slate-500">01 / VPS TELEMETRY</div>
              <h2 id="fleet-heading" className="mt-1 text-lg font-semibold">Live EA fleet</h2>
            </div>
            <div className="flex items-center gap-2 font-mono text-[9px] text-slate-500">
              <BrandGlyph name="radio" size={13} className={initialFleet.configured ? 'text-emerald-400' : 'text-amber-400'} />
              {telemetryError || (initialFleet.configured ? 'UPSTASH REDIS' : 'IN-PROCESS TTL FALLBACK')}
            </div>
          </div>
          {initialFleet.heartbeats.length === 0 ? (
            <div className="rounded-xl border border-white/[0.08] bg-[#0c1016] px-5 py-8 text-center">
              <BrandGlyph name="activity" className="mx-auto text-slate-600" size={22} />
              <p className="mt-3 text-sm text-slate-300">No EA heartbeats have been recorded.</p>
              <p className="mt-1 text-xs text-slate-500">Configure Redis for cross-instance persistence; process-local TTL storage is used as a fallback.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {initialFleet.heartbeats.map((ea) => (
                <article key={`${ea.ea_name}-${ea.account_number}`} className="rounded-xl border border-white/[0.08] bg-[#0c1016] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-slate-100">{ea.ea_name}</h3>
                      <p className="mt-1 font-mono text-[10px] text-slate-500">ACCOUNT {ea.account_number}</p>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 font-mono text-[9px] ${ea.heartbeat_status === 'ONLINE' ? 'border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-300' : 'border-rose-300/20 bg-rose-300/[0.05] text-rose-300'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${ea.heartbeat_status === 'ONLINE' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                      {ea.heartbeat_status}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-3">
                    <div><div className="text-[9px] text-slate-500">EQUITY</div><div className="mt-1 font-mono text-xs">{formatCurrency(ea.equity)}</div></div>
                    <div><div className="text-[9px] text-slate-500">FLOATING P&amp;L</div><div className={`mt-1 font-mono text-xs ${ea.floating_pnl === null ? 'text-slate-500' : ea.floating_pnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{formatCurrency(ea.floating_pnl)}</div></div>
                    <div><div className="text-[9px] text-slate-500">DRAWDOWN</div><div className="mt-1 font-mono text-xs">{ea.drawdown_pct === null ? '—' : `${ea.drawdown_pct.toFixed(2)}%`}</div></div>
                  </div>
                  <div className="mt-3 flex justify-between text-[9px] text-slate-500">
                    <span>BALANCE {formatCurrency(ea.balance)} · {ea.open_positions ?? '—'} OPEN</span>
                    <span>{ea.last_seen_utc ? new Date(ea.last_seen_utc).toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' }) + ' UTC' : 'STALE'}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-11" aria-labelledby="strategies-heading">
          <div className="mb-4">
            <div className="font-mono text-[9px] tracking-[0.17em] text-slate-500">02 / PROPRIETARY SYSTEMS</div>
            <h2 id="strategies-heading" className="mt-1 text-lg font-semibold">Strategy architecture</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <StrategyCard
              name="ERIDAM NEXUS ADAPTIVE PRO"
              version="NEXUS / 4.2"
              description="Regime-adaptive execution framework with volatility-normalized risk, macro event vetoes, and portfolio-level exposure controls."
              pairs="EURUSD · GBPUSD · USDJPY · XAUUSD"
              timeframe="H1 signal / H4 regime"
              shield="Equity high-water mark with daily loss circuit-breaker"
              virtualization="Ghost orders; broker-side placement only after server validation"
              drawdown="Hard 8% account drawdown cap"
            />
            <StrategyCard
              name="VELOCITY VAULT"
              version="VELOCITY / 2.7"
              description="Momentum continuation system combining directional efficiency, expansion filters, and event-aware position management."
              pairs="EURUSD · GBPUSD · AUDUSD · USDJPY"
              timeframe="M15 execution / H1 confirmation"
              shield="Equity floor and per-session loss lock"
              virtualization="Virtual pending levels; cancel on volatility or news lockout"
              drawdown="Hard 6% account drawdown cap"
            />
          </div>
        </section>

        <section className="mt-11 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" aria-label="Signal tester and MT5 connection">
          <div className="rounded-xl border border-white/[0.08] bg-[#0c1016] p-5 sm:p-6">
            <div className="font-mono text-[9px] tracking-[0.17em] text-slate-500">03 / MACROLYNC API</div>
            <h2 className="mt-1 text-lg font-semibold">Live signal tester</h2>
            <p className="mt-1 text-xs leading-5 text-slate-400">Previews a same-origin live signal without placing the private EA key in the browser.</p>
            <label className="mt-5 block text-[9px] tracking-wide text-slate-500" htmlFor="signal-symbol">SYMBOL</label>
            <select id="signal-symbol" value={symbol} onChange={(event) => setSymbol(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-white/[0.1] bg-[#080a0f] px-3 font-mono text-xs text-slate-200 outline-none focus:border-emerald-300/40">
              {symbols.map((item) => <option key={item}>{item}</option>)}
            </select>
            <button type="button" onClick={testSignal} disabled={testing} className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-emerald-400 px-4 text-xs font-semibold text-[#07120d] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40">
              <BrandGlyph name="signal" size={15} /> {testing ? 'Testing endpoint...' : 'Test live signal'}
            </button>
            {signalError && <p className="mt-3 text-xs text-rose-300" role="alert">{signalError}</p>}
            {signal && (
              <div className="mt-4 rounded-lg border border-white/[0.08] bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-mono text-xs text-slate-300">{signal.symbol} · {signal.regime}</div>
                  <span className={`rounded border px-2 py-1 font-mono text-[9px] ${signal.safe_to_trade ? 'border-emerald-300/20 text-emerald-300' : 'border-amber-300/20 text-amber-300'}`}>{signal.safe_to_trade ? 'TRADE PERMITTED' : 'DEFENSIVE HOLD'}</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-[10px]">
                  <Metric label="BIAS" value={`${signal.bias} · ${signal.confluence_score}`} />
                  <Metric label="NEWS LOCKOUT" value={signal.news_lockout ? 'ACTIVE' : 'CLEAR'} />
                  <Metric label="SESSION" value={signal.session} />
                  <Metric label="KILLZONE" value={signal.killzone_active} />
                  <Metric label="CSI SPREAD" value={String(signal.csi_spread)} />
                  <Metric label="RISK MULTIPLIER" value={`${signal.risk_multiplier.toFixed(2)}×`} />
                  <Metric label="CORRELATION GROUP" value={signal.correlation_group} />
                  <Metric label="ATR STOP" value={signal.atr_sl_pips === null ? 'Unavailable' : `${signal.atr_sl_pips} pips`} />
                  <Metric label="ATR TARGET" value={signal.atr_tp_pips === null ? 'Unavailable' : `${signal.atr_tp_pips} pips`} />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-[#0c1016] p-5 sm:p-6">
            <div className="font-mono text-[9px] tracking-[0.17em] text-slate-500">04 / MT5 CONNECTION</div>
            <h2 className="mt-1 text-lg font-semibold">Signal &amp; telemetry bridge</h2>
            <div className="mt-5 space-y-3 rounded-lg border border-white/[0.07] bg-black/20 p-4 font-mono text-[10px]">
              <div><span className="text-slate-500">SIGNAL</span><p className="mt-1 break-all text-emerald-200">{endpoint}/api/v1/macro-signal?symbol=EURUSD</p></div>
              <div><span className="text-slate-500">HEARTBEAT</span><p className="mt-1 break-all text-emerald-200">{endpoint}/api/v1/ea-heartbeat</p></div>
              <div><span className="text-slate-500">CLOSED-TRADE LEDGER</span><p className="mt-1 break-all text-emerald-200">{endpoint}/api/v1/trade-log</p></div>
              <div><span className="text-slate-500">REQUIRED HEADER</span><p className="mt-1 text-slate-300">x-algo-key: &lt;ALGO_PRIVATE_API_KEY&gt;</p></div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href="/mql5/MacroLyncBridge.mqh" download className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.1] px-3 text-[10px] text-slate-300 hover:border-emerald-300/30">
                <BrandGlyph name="arrow-down" size={13} /> MacroLyncBridge.mqh
              </a>
              <button type="button" onClick={() => void copyText('MQL5 bridge source', bridgeSource)} className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.1] px-3 text-[10px] text-slate-300 hover:border-emerald-300/30">
                <BrandGlyph name={copyState === 'MQL5 bridge source copied' ? 'check' : 'copy'} size={13} /> Copy bridge source
              </button>
            </div>
            {copyState && <p className="mt-2 text-[10px] text-emerald-300" role="status">{copyState}</p>}
            <details className="mt-4 rounded-lg border border-white/[0.07] bg-black/20">
              <summary className="cursor-pointer px-4 py-3 text-[10px] text-slate-300">View exact downloadable bridge source</summary>
              <pre className="max-h-96 overflow-auto border-t border-white/[0.07] p-4 text-[10px] leading-5 text-slate-400"><code>{bridgeSource}</code></pre>
            </details>
            <div className="mt-5 flex items-start gap-2 border-t border-white/[0.07] pt-4 text-[10px] leading-5 text-slate-500">
              <BrandGlyph name="shield-alert" size={14} className="mt-0.5 shrink-0 text-amber-300" />
              <p>Network, timeout, non-200, malformed JSON, or active news lockout returns defensive hold. Keep WebRequest access restricted to this deployed application origin in MT5.</p>
            </div>
          </div>
        </section>

        <section className="mt-11" aria-labelledby="expectancy-heading">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="font-mono text-[9px] tracking-[0.17em] text-slate-500">05 / CLOSED-TRADE LEDGER</div>
              <h2 id="expectancy-heading" className="mt-1 text-lg font-semibold">Live Strategy Expectancy &amp; Risk Metrics</h2>
            </div>
            <div className="font-mono text-[9px] text-slate-500">
              {initialTradeExpectancy.configured ? 'UPSTASH REDIS' : 'IN-PROCESS FALLBACK'} · {initialTradeExpectancy.total_trades} CLOSED
            </div>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-[#0c1016] p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <ExpectancyMetric label="WIN RATE" value={initialTradeExpectancy.win_rate_pct === null ? '—' : `${initialTradeExpectancy.win_rate_pct.toFixed(1)}%`} />
              <ExpectancyMetric label="PROFIT FACTOR" value={initialTradeExpectancy.profit_factor === null
                ? initialTradeExpectancy.total_trades > 0 && (initialTradeExpectancy.win_rate_pct ?? 0) > 0 ? '∞' : '—'
                : initialTradeExpectancy.profit_factor.toFixed(2)} />
              <ExpectancyMetric label="AVERAGE R" value={initialTradeExpectancy.average_r_multiple === null ? '—' : `${initialTradeExpectancy.average_r_multiple.toFixed(2)}R`} />
              <ExpectancyMetric label="MAX DRAWDOWN" value={initialTradeExpectancy.max_drawdown_pct === null ? '—' : `${initialTradeExpectancy.max_drawdown_pct.toFixed(2)}%`} />
              <ExpectancyMetric label="SAMPLE SIZE" value={String(initialTradeExpectancy.total_trades)} />
            </div>
            <p className="mt-3 text-[9px] leading-4 text-slate-500">Drawdown is measured against the closed-trade cumulative P&amp;L peak; account-equity drawdown requires an account balance baseline.</p>
            <div className="mt-5 border-t border-white/[0.07] pt-4">
              <h3 className="font-mono text-[9px] tracking-[0.15em] text-slate-500">RECENT CLOSED TRADES</h3>
              {initialTradeExpectancy.recent_closed_trades.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">No closed trades have been reported.</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left font-mono text-[9px]">
                    <thead className="text-slate-600"><tr>
                      <th className="pb-2 pr-3 font-normal">CLOSED UTC</th>
                      <th className="pb-2 pr-3 font-normal">SYMBOL</th>
                      <th className="pb-2 pr-3 font-normal">DIRECTION</th>
                      <th className="pb-2 pr-3 font-normal">P&amp;L USD</th>
                      <th className="pb-2 pr-3 font-normal">R</th>
                      <th className="pb-2 font-normal">REGIME</th>
                    </tr></thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {initialTradeExpectancy.recent_closed_trades.map((trade) => (
                        <tr key={`${trade.symbol}-${trade.ticket}`} className="text-slate-300">
                          <td className="py-2 pr-3 text-slate-500">{new Date(trade.closed_at_utc).toLocaleString('en-GB', { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'short' })}</td>
                          <td className="py-2 pr-3">{trade.symbol}</td>
                          <td className="py-2 pr-3">{trade.direction}</td>
                          <td className={`py-2 pr-3 ${trade.profit_usd >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{trade.profit_usd.toFixed(2)}</td>
                          <td className="py-2 pr-3">{trade.r_multiple.toFixed(2)}R</td>
                          <td className="py-2">{trade.regime}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="mt-8 flex items-center gap-2 border-t border-white/[0.07] pt-5 text-[10px] leading-5 text-slate-600">
          <BrandGlyph name="shield" size={13} className="shrink-0" />
          <span>Internal research tooling. Trading is risky; every EA must retain its own account-level equity and drawdown protections.</span>
        </div>
      </div>
    </div>
  );
}

function StrategyCard({
  name,
  version,
  description,
  pairs: targetPairs,
  timeframe,
  shield,
  virtualization,
  drawdown,
}: {
  name: string;
  version: string;
  description: string;
  pairs: string;
  timeframe: string;
  shield: string;
  virtualization: string;
  drawdown: string;
}) {
  return (
    <article className="rounded-xl border border-white/[0.08] bg-[#0c1016] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[9px] tracking-[0.14em] text-emerald-300">PROPRIETARY ALGORITHM</div>
          <h3 className="mt-2 text-base font-semibold">{name}</h3>
        </div>
        <span className="rounded border border-white/[0.08] px-2 py-1 font-mono text-[9px] text-slate-500">{version}</span>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-400">{description}</p>
      <dl className="mt-5 grid gap-3 border-t border-white/[0.07] pt-4 sm:grid-cols-2">
        <Spec label="TARGET PAIRS" value={targetPairs} />
        <Spec label="TIMEFRAME" value={timeframe} />
        <Spec label="EQUITY SHIELD" value={shield} />
        <Spec label="GHOST VIRTUALIZATION" value={virtualization} />
        <Spec label="DRAWDOWN CAP" value={drawdown} />
      </dl>
    </article>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return <div><dt className="font-mono text-[8px] tracking-wide text-slate-600">{label}</dt><dd className="mt-1 text-[10px] leading-4 text-slate-300">{value}</dd></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><div className="font-mono text-[8px] text-slate-600">{label}</div><div className="mt-1 text-slate-200">{value}</div></div>;
}

function ExpectancyMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-white/[0.06] bg-black/20 px-3 py-3">
    <div className="font-mono text-[8px] tracking-wide text-slate-600">{label}</div>
    <div className="mt-2 font-mono text-sm text-slate-100">{value}</div>
  </div>;
}
