'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import BrandGlyph from '@/components/BrandGlyph';
import { PaystackCheckout } from '@/components/PaystackCheckout';
import FreeEaResources from '@/components/FreeEaResources';
import { QuantStrategyCatalog } from '@/components/QuantStrategyCatalog';
import { getCurrencyStrengthIndex, type getLiquiditySession } from '@/lib/currencyStrength';
import type { MacroSnapshot } from '@/types/macro';

type StoreTerminalProps = {
  initialSnapshot: MacroSnapshot;
  session: ReturnType<typeof getLiquiditySession>;
};

export default function StoreTerminal({ initialSnapshot, session }: StoreTerminalProps) {
  const [selectedEaSlug, setSelectedEaSlug] = useState('eridam-nexus-pro');
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [selectedCurrency, setSelectedCurrency] = useState<'NGN' | 'USD'>('NGN');
  const [manualCheckoutOpen, setManualCheckoutOpen] = useState(false);
  const locationSearch = useSyncExternalStore(subscribeToLocation, getLocationSearch, getServerLocationSearch);
  const hasPaymentReference = new URLSearchParams(locationSearch).has('ref');
  const checkoutOpen = manualCheckoutOpen || hasPaymentReference;
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
              ALGOLYNC / PUBLIC STRATEGY MARKETPLACE
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Algorithm command center</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Compare published EA strategies and choose a recurring subscription or eligible demo.
            </p>
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
          <QuantStrategyCatalog onSelectEa={(slug, cycle, currency) => { setSelectedEaSlug(slug); setSelectedBillingCycle(cycle); setSelectedCurrency(currency); setManualCheckoutOpen(true); }} />
          <FreeEaResources />
        </section>

        {checkoutOpen && <div className="fixed inset-0 z-[90] bg-black/75 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="AlgoLync subscription checkout">
          <button type="button" aria-label="Close checkout" onClick={() => { setManualCheckoutOpen(false); if (hasPaymentReference) { window.history.replaceState({}, '', '/store'); window.dispatchEvent(new PopStateEvent('popstate')); } }} className="absolute inset-0 h-full w-full cursor-default" />
          <aside className="absolute inset-y-0 right-0 w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-[#080c12] p-4 shadow-2xl sm:p-7">
            <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
              <div><div className="font-mono text-[9px] tracking-widest text-emerald-300">ALGOLYNC / SECURE CHECKOUT</div><h2 className="mt-1 text-lg font-semibold">Subscription checkout</h2></div>
              <button type="button" onClick={() => { setManualCheckoutOpen(false); if (hasPaymentReference) { window.history.replaceState({}, '', '/store'); window.dispatchEvent(new PopStateEvent('popstate')); } }} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300">Close</button>
            </div>
            <PaystackCheckout selectedEaSlug={selectedEaSlug} selectedBillingCycle={selectedBillingCycle} selectedCurrency={selectedCurrency} />
          </aside>
        </div>}

        <div className="mt-8 flex flex-col gap-3 border-t border-white/[0.07] pt-5 text-[10px] leading-5 text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <BrandGlyph name="shield" size={13} className="shrink-0" />
            <span>Research and software only. Trading is risky; every EA must retain its own account-level equity and drawdown protections.</span>
          </div>
          <nav aria-label="Legal information" className="flex flex-wrap gap-4">
            <a href="/about" className="text-slate-400 underline underline-offset-4 hover:text-emerald-300">About FiduLync</a>
            <a href="/terms" className="text-slate-400 underline underline-offset-4 hover:text-emerald-300">Terms &amp; Risk Disclosure</a>
            <a href="/refund-policy" className="text-slate-400 underline underline-offset-4 hover:text-emerald-300">Refund &amp; Cancellation</a>
            <a href="mailto:fidulync@gmail.com" className="text-slate-400 underline underline-offset-4 hover:text-emerald-300">Customer Support</a>
          </nav>
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
function subscribeToLocation(callback: () => void) {
  window.addEventListener('popstate', callback);
  return () => window.removeEventListener('popstate', callback);
}
function getLocationSearch() { return window.location.search; }
function getServerLocationSearch() { return ''; }


