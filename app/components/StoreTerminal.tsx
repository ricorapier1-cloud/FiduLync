'use client';

import { QuantStrategyCatalog } from '@/components/QuantStrategyCatalog';

export default function StoreTerminal() {
  return (
    <main className="min-h-screen bg-[#080a0f] px-5 py-10 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 border-b border-white/[0.08] pb-7">
          <p className="font-mono text-[10px] tracking-[0.2em] text-emerald-300">ALGOLYNC / STRATEGY MARKETPLACE</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Quantitative strategy subscriptions</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Explore EA specifications, request eligible demo access, or configure a recurring subscription. Account telemetry and MT5 setup instructions are kept inside your private workspace.</p>
        </header>
        <QuantStrategyCatalog />
        <p className="mt-8 border-t border-white/[0.08] pt-5 text-[10px] leading-5 text-slate-500">Performance figures are illustrative unless accompanied by a dated, independently verifiable report. Past performance does not guarantee future results. Trading involves substantial risk.</p>
      </div>
    </main>
  );
}
