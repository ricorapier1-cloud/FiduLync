'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BrandGlyph from '@/components/BrandGlyph';
import { PaystackCheckout } from '@/components/PaystackCheckout';
import { QuantStrategyCatalog } from '@/components/QuantStrategyCatalog';
import { getCurrencyStrengthIndex, type getLiquiditySession } from '@/lib/currencyStrength';
import type { TradeExpectancy } from '@/lib/tradeLedger';
import type { MacroSnapshot } from '@/types/macro';

type StoreTerminalProps = {
  initialSnapshot: MacroSnapshot;
  initialTradeExpectancy: TradeExpectancy;
  session: ReturnType<typeof getLiquiditySession>;
};

export default function StoreTerminal({ initialSnapshot, initialTradeExpectancy, session }: StoreTerminalProps) {
  const [selectedEaSlug, setSelectedEaSlug] = useState('eridam-nexus-pro');
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [selectedCurrency, setSelectedCurrency] = useState<'NGN' | 'USD'>('NGN');
  const router = useRouter();


  const currencyStrength = getCurrencyStrengthIndex(initialSnapshot);

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [router]);



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

        <section className="mt-11" aria-labelledby="strategies-heading">
          <QuantStrategyCatalog onSelectEa={(slug, cycle, currency) => { setSelectedEaSlug(slug); setSelectedBillingCycle(cycle); setSelectedCurrency(currency); }} />
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

                <section id="vault-checkout" className="mt-11 scroll-mt-24" aria-labelledby="provisioning-heading">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="font-mono text-[9px] tracking-[0.17em] text-emerald-400">SUBSCRIPTION CHECKOUT</div>
              <h2 id="provisioning-heading" className="mt-1 text-lg font-semibold">Acquire Institutional EA License</h2>
            </div>
            <div className="flex items-center gap-2 font-mono text-[9px] text-emerald-300">
              <BrandGlyph name="shield" size={13} className="text-emerald-400" />
              RECURRING SUBSCRIPTION · SEAT ENTITLEMENTS
            </div>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-[#06120E]/80 p-5 sm:p-6 shadow-2xl backdrop-blur-sm">
            <PaystackCheckout selectedEaSlug={selectedEaSlug} selectedBillingCycle={selectedBillingCycle} selectedCurrency={selectedCurrency} />
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

function ExpectancyMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-white/[0.06] bg-black/20 px-3 py-3">
    <div className="font-mono text-[8px] tracking-wide text-slate-600">{label}</div>
    <div className="mt-2 font-mono text-sm text-slate-100">{value}</div>
  </div>;
}
