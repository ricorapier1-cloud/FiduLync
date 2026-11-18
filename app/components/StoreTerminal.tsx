'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import BrandGlyph from '@/components/BrandGlyph';
import { getCurrencyStrengthIndex, type getLiquiditySession } from '@/lib/currencyStrength';
import type { MacroSnapshot } from '@/types/macro';

type StoreTerminalProps = {
  bridgeSource: string;
  initialSnapshot: MacroSnapshot;
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

export default function StoreTerminal({ bridgeSource, initialSnapshot, session }: StoreTerminalProps) {
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
      <div className="mx-auto w-full max-w-7xl px-5 py-9 sm:px-8 lg:py-12 pb-36 sm:pb-16">
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
          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href="/mql5/MacroLyncBridge.mqh"
              download
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-emerald-300/30 bg-emerald-300/[0.1] px-3.5 text-xs font-medium text-emerald-100 transition hover:bg-emerald-300/[0.16]"
            >
              <BrandGlyph name="arrow-down" size={15} /> Research Bridge (.mqh)
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

        <section className="mt-11" aria-labelledby="personal-library-heading">
          <div className="mb-4">
            <div className="font-mono text-[9px] tracking-[0.17em] text-emerald-400">02 / PERSONAL EA LIBRARY</div>
            <h2 id="personal-library-heading" className="mt-1 text-lg font-semibold">Research and demo EA files</h2>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-400">Free sample source files for later MetaEditor compilation and Strategy Tester work. They are research fixtures, not verified profitable systems or production-ready live robots.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <a href="/downloads/Eridam_Nexus_Adaptive_Demo.mq5" download className="rounded-xl border border-white/[0.08] bg-[#0c1016] p-4 transition hover:border-emerald-400/30"><strong className="text-sm text-white">Eridam Nexus Adaptive — Demo</strong><span className="mt-2 block text-[11px] leading-5 text-slate-400">Multi-regime volatility sample for EURUSD, GBPUSD and XAUUSD.</span><span className="mt-3 block font-mono text-[10px] text-emerald-300">DOWNLOAD .MQ5</span></a>
            <a href="/downloads/Velocity_Vault_Momentum_Demo.mq5" download className="rounded-xl border border-white/[0.08] bg-[#0c1016] p-4 transition hover:border-emerald-400/30"><strong className="text-sm text-white">Velocity Vault Momentum — Demo</strong><span className="mt-2 block text-[11px] leading-5 text-slate-400">Session-expansion momentum sample for controlled testing.</span><span className="mt-3 block font-mono text-[10px] text-emerald-300">DOWNLOAD .MQ5</span></a>
            <a href="/downloads/MacroLync_G10_Breakout_Test.mq5" download className="rounded-xl border border-white/[0.08] bg-[#0c1016] p-4 transition hover:border-emerald-400/30"><strong className="text-sm text-white">MacroLync G10 ATR Breakout — Test</strong><span className="mt-2 block text-[11px] leading-5 text-slate-400">Source fixture for MetaEditor compilation and Strategy Tester checks.</span><span className="mt-3 block font-mono text-[10px] text-emerald-300">DOWNLOAD .MQ5</span></a>
            <a href="/mql5/MacroLyncBridge.mqh" download className="rounded-xl border border-white/[0.08] bg-[#0c1016] p-4 transition hover:border-emerald-400/30"><strong className="text-sm text-white">MacroLync MT5 Bridge</strong><span className="mt-2 block text-[11px] leading-5 text-slate-400">MQL5 include for the existing FiduLync telemetry and research bridge.</span><span className="mt-3 block font-mono text-[10px] text-emerald-300">DOWNLOAD .MQH</span></a>
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
                  <Metric label="RISK MODE" value={signal.risk_mode} />
                  <Metric label="CANDLE SOURCE" value={signal.market_data_source.toUpperCase()} />
                  <Metric label="CANDLE COVERAGE" value={`H1 ${signal.market_candle_counts.h1} · H4 ${signal.market_candle_counts.h4} · D1 ${signal.market_candle_counts.d1}`} />
                  <Metric label="LATEST CLOSED BAR" value={signal.latest_market_candle_at ? new Date(signal.latest_market_candle_at).toLocaleString() : "Unavailable"} />
                  <Metric label="CORRELATION GROUP" value={signal.correlation_group} />
                  <Metric label="ATR STOP" value={signal.atr_sl_pips === null ? '425 bps (G8)' : `${signal.atr_sl_pips} pips`} />
                  <Metric label="ATR TARGET" value={signal.atr_tp_pips === null ? '425 bps (G8)' : `${signal.atr_tp_pips} pips`} />
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

        <section className="mt-11 rounded-xl border border-white/[0.08] bg-[#0c1016] p-5 sm:p-6" aria-labelledby="mt5-personal-setup-heading">
          <div className="font-mono text-[9px] tracking-[0.17em] text-slate-500">05 / PERSONAL MT5 ONBOARDING</div>
          <h2 id="mt5-personal-setup-heading" className="mt-1 text-lg font-semibold">Connect your own MT5 terminal when ready</h2>
          <ol className="mt-4 grid gap-3 text-xs leading-5 text-slate-300 sm:grid-cols-2">
            <li className="rounded-lg border border-white/[0.06] bg-black/20 p-3"><strong className="text-white">1. Compile on Windows MT5</strong><br />Place EA source in MQL5/Experts and the bridge include in MQL5/Include, then compile in MetaEditor.</li>
            <li className="rounded-lg border border-white/[0.06] bg-black/20 p-3"><strong className="text-white">2. Allow the research endpoint</strong><br />In MT5 WebRequest settings, allow <code className="text-emerald-300">https://fidulync.vercel.app</code>.</li>
            <li className="rounded-lg border border-white/[0.06] bg-black/20 p-3"><strong className="text-white">3. Register the terminal</strong><br />Use the private owner console to register the terminal and its installation credential. Never share broker passwords.</li>
            <li className="rounded-lg border border-white/[0.06] bg-black/20 p-3"><strong className="text-white">4. Start in shadow/demo mode</strong><br />Verify quotes, closed candles, broker symbol specifications and EA telemetry before considering any live use.</li>
          </ol>
          <p className="mt-4 text-[11px] leading-5 text-amber-200/80">No personal EA execution approval is enabled by this page. Keep broker-side stop-loss protection and the EA&apos;s local risk controls active.</p>
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

