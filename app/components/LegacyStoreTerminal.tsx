'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BrandGlyph from '@/components/BrandGlyph';
import Link from 'next/link';
import { PaystackCheckout } from '@/components/PaystackCheckout';
import { QuantStrategyCatalog } from '@/components/QuantStrategyCatalog';
import LiveAccountMonitor from '@/components/LiveAccountMonitor';
import type { HeartbeatRecord } from '@/lib/eaHeartbeat';
import { getCurrencyStrengthIndex, type getLiquiditySession } from '@/lib/currencyStrength';
import type { TradeExpectancy } from '@/lib/tradeLedger';
import type { MacroSnapshot } from '@/types/macro';

type StoreTerminalProps = {
  initialFleet: { configured: boolean; heartbeats: HeartbeatRecord[] };
  telemetryError: string;
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
  execution_blockers: string[];
  risk_mode: 'DISABLED' | 'PILOT_TREND' | 'PILOT_MEAN_REVERSION';
  market_data_source: 'mt5' | 'configured_provider' | 'twelve_data' | 'unavailable' | 'unknown';
  latest_market_candle_at: string | null;
  market_candle_counts: { h1: number; h4: number; d1: number };
  timestamp_utc: string;
};

const symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'USDCAD', 'AUDUSD', 'NZDUSD', 'EURJPY', 'XAUUSD'];

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
    && Array.isArray(result.execution_blockers)
    && result.execution_blockers.every((item) => typeof item === 'string')
    && typeof result.risk_mode === 'string'
    && typeof result.market_data_source === 'string'
    && (result.latest_market_candle_at === null || typeof result.latest_market_candle_at === 'string')
    && typeof result.market_candle_counts === 'object'
    && result.market_candle_counts !== null
    && typeof result.timestamp_utc === 'string';
}

export default function StoreTerminal({ initialFleet, telemetryError, initialSnapshot, initialTradeExpectancy, session }: StoreTerminalProps) {
  const [selectedEaSlug, setSelectedEaSlug] = useState('eridam-nexus-pro');
  const router = useRouter();
  const [symbol, setSymbol] = useState('EURUSD');
  const [signal, setSignal] = useState<SignalResult | null>(null);
  const [signalError, setSignalError] = useState('');
  const [testing, setTesting] = useState(false);
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [mt5AccountInput, setMt5AccountInput] = useState('');
  const [mt5AccountType, setMt5AccountType] = useState<'LIVE' | 'DEMO'>('LIVE');
  const [verifyingLicense, setVerifyingLicense] = useState(false);
  const [licenseResponse, setLicenseResponse] = useState<{
    valid: boolean;
    message?: string;
    account?: string;
    mt5_account?: string | number;
    license_type?: string;
    tier?: string;
    expires_at?: string | null;
    error?: string;
    reason?: string;
  } | null>(null);

  async function testLicenseVerification() {
    if (!licenseKeyInput.trim() || !mt5AccountInput.trim()) {
      setLicenseResponse({
        valid: false,
        error: 'Please enter both your License Key and MT5 Account login number.',
      });
      return;
    }
    setVerifyingLicense(true);
    setLicenseResponse(null);
    try {
      const res = await fetch('/api/v1/validate-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          license_key: licenseKeyInput.trim(),
          account_number: mt5AccountInput.trim(),
          account_type: mt5AccountType,
        }),
      });
      const data = await res.json();
      setLicenseResponse(data);
    } catch {
      setLicenseResponse({
        valid: false,
        error: 'Unable to connect to license verification endpoint.',
      });
    } finally {
      setVerifyingLicense(false);
    }
  }

  const currencyStrength = getCurrencyStrengthIndex(initialSnapshot);

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [router]);

  async function copyText(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch (error) {
      console.error(`Unable to copy ${label.toLowerCase()}:`, error);
    }
  }

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

  return (
    <div className="min-h-screen bg-[#080a0f] text-slate-100">
      <div className="mx-auto w-full max-w-7xl px-5 py-9 sm:px-8 lg:py-12 pb-44 sm:pb-16">
        <div className="flex flex-wrap items-start justify-between gap-5 border-b border-white/[0.08] pb-7">
          <div>
            <Link href="/" className="mb-4 inline-block font-mono text-[10px] tracking-wider text-emerald-300 hover:underline">← BACK TO TERMINAL</Link>
            <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
              ALGOLYNC / PRIVATE STRATEGY VAULT
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Algorithm command center</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Proprietary strategy architecture, VPS fleet telemetry, and the MacroLync execution bridge.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href="/mql5/MacroLyncLicense.mqh"
              download
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-emerald-300/30 bg-emerald-300/[0.1] px-3.5 text-xs font-medium text-emerald-100 transition hover:bg-emerald-300/[0.16]"
            >
              <BrandGlyph name="arrow-down" size={15} /> License Helper (.mqh)
            </a>
            <a
              href="/mql5/MacroLyncBridge.mqh"
              download
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/[0.12] bg-white/[0.05] px-3.5 text-xs font-medium text-slate-200 transition hover:bg-white/[0.08]"
            >
              <BrandGlyph name="arrow-down" size={15} /> Signal Bridge (.mqh)
            </a>
          </div>
        </div>

        <section className="mt-7 rounded-xl border border-white/[0.08] bg-[#0c1016] p-4 sm:p-5" aria-label="Market state">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="font-mono text-[9px] tracking-[0.17em] text-slate-500">PROVIDER-VERIFIED MACRO STRENGTH</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {currencyStrength.length === 0 ? (
                  <span className="font-mono text-[10px] text-amber-200">NO VERIFIED MACRO INPUTS AVAILABLE</span>
                ) : currencyStrength.map(({ currency, score: strength }) => (
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

        <section className="mt-8 rounded-xl border border-white/[0.08] bg-[#0c1016] p-4 sm:p-5" aria-label="Fleet telemetry privacy">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-mono text-[9px] tracking-[0.17em] text-slate-500">01 / VPS TELEMETRY</div>
              <h2 className="mt-1 text-lg font-semibold">Customer account privacy</h2>
              <p className="mt-1 text-xs text-slate-400">Fleet-wide account balances and trade details are not displayed in the public Store. Bind your own licensed MT5 account below to view its private telemetry.</p>
            </div>
            <div className="shrink-0 text-right font-mono text-[9px] text-slate-500">
              <div>{initialFleet.heartbeats.length} RECENT NODES</div>
              <div>{telemetryError || (initialFleet.configured ? 'SHARED STORE' : 'NOT CONFIGURED')}</div>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/[0.04] p-4 sm:p-5" aria-label="Verified telemetry status">
          <div className="font-mono text-[9px] tracking-[0.17em] text-amber-200">LIVE VERIFIED TELEMETRY / PROVENANCE STATUS</div>
          <p className="mt-2 text-xs leading-5 text-slate-300">No independently verified live-performance dataset is currently published for these catalog strategies. Broker-verified results will only be shown after authenticated MT5 installation data, account isolation, complete trade history and execution-cost evidence have been reconciled. A heartbeat or user-reported trade record alone is not proof of performance.</p>
        </section>

        <LiveAccountMonitor />

        <section className="mt-11" aria-labelledby="strategies-heading">
          <QuantStrategyCatalog onSelectEa={(slug) => setSelectedEaSlug(slug)} />
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
                  <span className={`rounded border px-2 py-1 font-mono text-[9px] ${signal.safe_to_trade ? 'border-emerald-300/20 text-emerald-300' : 'border-amber-300/20 text-amber-300'}`}>{signal.safe_to_trade ? 'RISK CHECK PASSED · READ ONLY' : 'DEFENSIVE HOLD'}</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-[10px]">
                  <Metric label="BIAS" value={`${signal.bias} · ${signal.confluence_score}`} />
                  <Metric label="NEWS LOCKOUT" value={signal.news_lockout ? 'ACTIVE' : 'CLEAR'} />
                  <Metric label="SESSION" value={signal.session} />
                  <Metric label="KILLZONE" value={signal.killzone_active} />
                  <Metric label="CSI SPREAD" value={String(signal.csi_spread)} />
                  <Metric label="RISK MULTIPLIER" value={`${signal.risk_multiplier.toFixed(2)}×`} />
                  <Metric label="RISK MODE" value={signal.risk_mode} />
                  <Metric label="CANDLE SOURCE" value={signal.market_data_source.toUpperCase()} />
                  <Metric label="CANDLE COVERAGE" value={`H1 ${signal.market_candle_counts.h1} · H4 ${signal.market_candle_counts.h4} · D1 ${signal.market_candle_counts.d1}`} />
                  <Metric label="LATEST CLOSED BAR" value={signal.latest_market_candle_at ? new Date(signal.latest_market_candle_at).toLocaleString() : "Unavailable"} />
                  <Metric label="CORRELATION GROUP" value={signal.correlation_group} />
                  <Metric label="ATR STOP" value={signal.atr_sl_pips === null ? '—' : `${signal.atr_sl_pips} pips`} />
                  <Metric label="ATR TARGET" value={signal.atr_tp_pips === null ? '—' : `${signal.atr_tp_pips} pips`} />
                </div>
                {!signal.safe_to_trade && <div className="mt-3 rounded border border-amber-300/15 bg-amber-300/5 p-3">
                  <p className="font-mono text-[9px] tracking-wide text-amber-200">EXECUTION BLOCKERS</p>
                  <p className="mt-1 text-[10px] leading-5 text-slate-300">{signal.execution_blockers.join(' · ') || 'Execution permission is not enabled.'}</p>
                </div>}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-[#0c1016] p-5 sm:p-6">
            <div className="font-mono text-[9px] tracking-[0.17em] text-slate-500">04 / MT5 CONNECTION</div>
            <h2 className="mt-1 text-lg font-semibold">MT5 integration resources</h2>
            <p className="mt-3 max-w-2xl text-xs leading-5 text-slate-400">
              Download the public integration helpers and follow the terminal setup guide. Private authentication details, internal service routes and publisher headers are not displayed in the public storefront.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href="/mql5/MacroLyncBridge.mqh" download className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.1] px-3 text-[10px] text-slate-300 hover:border-emerald-300/30">
                <BrandGlyph name="arrow-down" size={13} /> MacroLyncBridge.mqh
              </a>
              <a href="/mql5/MacroLyncLicense.mqh" download className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.1] px-3 text-[10px] text-slate-300 hover:border-emerald-300/30">
                <BrandGlyph name="arrow-down" size={13} /> MacroLyncLicense.mqh
              </a>
            </div>
            <div className="mt-5 flex items-start gap-2 border-t border-white/[0.07] pt-4 text-[10px] leading-5 text-slate-500">
              <BrandGlyph name="shield-alert" size={14} className="mt-0.5 shrink-0 text-amber-300" />
              <p>Keep all private API credentials in the secure terminal configuration. Never publish service keys or copy private headers into public code.</p>
            </div>
          </div>
        </section>

        <section className="mt-11" aria-labelledby="expectancy-heading">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="font-mono text-[9px] tracking-[0.17em] text-slate-500">05 / CLOSED-TRADE LEDGER</div>
              <h2 id="expectancy-heading" className="mt-1 text-lg font-semibold">Reported Closed-Trade Ledger (Not Independently Verified)</h2>
            </div>
            <div className="font-mono text-[9px] text-slate-500">
              {initialTradeExpectancy.configured ? 'REPORTED LEDGER / UPSTASH' : 'NO SHARED LEDGER'} · {initialTradeExpectancy.total_trades} CLOSED
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
            <p className="mt-3 text-[9px] leading-4 text-slate-500">These records are submitted telemetry and are not labelled broker-verified. Drawdown is measured against closed-trade cumulative P&amp;L peak; account-equity drawdown requires an independently reconciled balance baseline.</p>
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

                <section id="vault-checkout" className="mt-11 scroll-mt-24" aria-labelledby="provisioning-heading">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="font-mono text-[9px] tracking-[0.17em] text-emerald-400">05 / RELEASE-GATED CHECKOUT & LICENSE PROVISIONING</div>
              <h2 id="provisioning-heading" className="mt-1 text-lg font-semibold">EA Release & License Availability</h2>
            </div>
            <div className="flex items-center gap-2 font-mono text-[9px] text-emerald-300">
              <BrandGlyph name="shield" size={13} className="text-emerald-400" />
              MT5 ACCOUNT BINDING AFTER RELEASE APPROVAL
            </div>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-[#06120E]/80 p-5 sm:p-6 shadow-2xl backdrop-blur-sm">
            <PaystackCheckout selectedEaSlug={selectedEaSlug} />
          </div>
        </section>

        <section className="mt-11" aria-labelledby="licensing-heading">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="font-mono text-[9px] tracking-[0.17em] text-slate-500">06 / CLIENT LICENSING & ONE-TIME ACTIVATION</div>
              <h2 id="licensing-heading" className="mt-1 text-lg font-semibold">Terminal Authorization & Key Manager</h2>
            </div>
            <div className="flex items-center gap-2 font-mono text-[9px] text-slate-400">
              <BrandGlyph name="shield" size={13} className="text-emerald-400" />
              ONE-TIME LIFETIME PURCHASE VALIDATION
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="rounded-xl border border-white/[0.08] bg-[#0c1016] p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-300">License Verification Console</span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label htmlFor="license-key-input" className="block font-mono text-[9px] tracking-wide text-slate-500">
                    ONE-TIME LICENSE KEY
                  </label>
                  <input
                    id="license-key-input"
                    type="text"
                    value={licenseKeyInput}
                    onChange={(e) => setLicenseKeyInput(e.target.value)}
                    placeholder="ALGOLYNX-PRO-XXXXX"
                    className="mt-1.5 h-10 w-full rounded-md border border-white/[0.1] bg-[#080a0f] px-3 font-mono text-xs text-slate-100 outline-none focus:border-emerald-300/40"
                  />
                </div>
                <div>
                  <label htmlFor="mt5-account-input" className="block font-mono text-[9px] tracking-wide text-slate-500">
                    MT5 ACCOUNT LOGIN NUMBER
                  </label>
                  <input
                    id="mt5-account-input"
                    type="text"
                    value={mt5AccountInput}
                    onChange={(e) => setMt5AccountInput(e.target.value)}
                    placeholder="e.g. 5839201"
                    className="mt-1.5 h-10 w-full rounded-md border border-white/[0.1] bg-[#080a0f] px-3 font-mono text-xs text-slate-100 outline-none focus:border-emerald-300/40"
                  />
                </div>
                <div>
                  <label htmlFor="mt5-account-type" className="block font-mono text-[9px] tracking-wide text-slate-500">ACCOUNT MODE</label>
                  <select id="mt5-account-type" value={mt5AccountType} onChange={(event) => setMt5AccountType(event.target.value as 'LIVE' | 'DEMO')} className="mt-1.5 h-10 w-full rounded-md border border-white/[0.1] bg-[#080a0f] px-3 font-mono text-xs text-slate-100 outline-none focus:border-emerald-300/40">
                    <option value="LIVE">LIVE</option>
                    <option value="DEMO">DEMO</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={testLicenseVerification}
                disabled={verifyingLicense}
                className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-emerald-400 px-4 text-xs font-semibold text-[#07120d] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <BrandGlyph name="shield" size={14} />
                {verifyingLicense ? 'Verifying Terminal...' : 'Verify & Authorize MT5 Account'}
              </button>

              {licenseResponse && (
                <div
                  className={`mt-4 rounded-lg border p-4 ${
                    licenseResponse.valid
                      ? 'border-emerald-400/25 bg-emerald-400/[0.04]'
                      : 'border-rose-400/25 bg-rose-400/[0.04]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-mono text-xs font-semibold ${
                        licenseResponse.valid ? 'text-emerald-300' : 'text-rose-300'
                      }`}
                    >
                      {licenseResponse.valid ? 'TERMINAL AUTHORIZED' : 'VERIFICATION REJECTED'}
                    </span>
                    <span className="font-mono text-[9px] text-slate-400">
                      {licenseResponse.tier || 'Standard'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-300">
                    {licenseResponse.message || licenseResponse.error || licenseResponse.reason || 'No additional verification details were returned.'}
                  </p>
                  {licenseResponse.valid && (
                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-3 font-mono text-[10px]">
                      <div>
                        <span className="text-slate-500">BOUND ACCOUNT:</span>
                        <div className="text-slate-200">{licenseResponse.account ?? licenseResponse.mt5_account ?? '—'}</div>
                      </div>
                      <div>
                        <span className="text-slate-500">LICENSE DURATION:</span>
                        <div className="text-emerald-300">One-Time Lifetime</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-[#0c1016] p-5 sm:p-6">
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">MetaTrader 5 Setup Checklist</span>
              <ol className="mt-3 space-y-3 text-xs leading-5 text-slate-300">
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 font-mono text-[10px] text-emerald-300">1</span>
                  <span>
                    Download <strong className="text-slate-100">MacroLyncLicense.mqh</strong> and place it into your MT5 terminal folder: <code className="rounded bg-black/40 px-1 py-0.5 font-mono text-[10px] text-emerald-200">MQL5/Include/</code>.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 font-mono text-[10px] text-emerald-300">2</span>
                  <span>
                    In MT5, open <strong className="text-slate-100">Tools → Options → Expert Advisors</strong>. Check <strong className="text-slate-100">Allow WebRequest for listed URL</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 font-mono text-[10px] text-emerald-300">3</span>
                  <div className="w-full">
                    <span>Add this exact server URL to the allowlist:</span>
                    <div className="mt-1.5 flex items-center justify-between rounded border border-white/[0.08] bg-black/30 px-2.5 py-1.5 font-mono text-[10px] text-emerald-300">
                      <span>https://fidulync.vercel.app</span>
                      <button
                        type="button"
                        onClick={() => void copyText('Server origin', 'https://fidulync.vercel.app')}
                        className="text-slate-400 hover:text-white"
                        title="Copy URL"
                      >
                        <BrandGlyph name="copy" size={12} />
                      </button>
                    </div>
                  </div>
                </li>
              </ol>
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

function Metric({ label, value }: { label: string; value: string }) {
  return <div><div className="font-mono text-[8px] text-slate-600">{label}</div><div className="mt-1 text-slate-200">{value}</div></div>;
}

function ExpectancyMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-white/[0.06] bg-black/20 px-3 py-3">
    <div className="font-mono text-[8px] tracking-wide text-slate-600">{label}</div>
    <div className="mt-2 font-mono text-sm text-slate-100">{value}</div>
  </div>;
}
