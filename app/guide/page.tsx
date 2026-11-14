'use client';
import Link from 'next/link';
export default function CustomerGuidePage() {
  return (
    <main className="min-h-screen bg-[#030A08] text-emerald-50 px-4 py-10 pb-36">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-500/20 pb-4">
          <Link href="/store" className="text-xs font-mono text-emerald-400 hover:underline">← BACK TO ALGOLYNX VAULT</Link>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => window.print()} className="text-xs font-mono px-3 py-1.5 rounded bg-emerald-500 text-black font-bold hover:bg-emerald-400">PRINT / SAVE PDF</button>
            <Link href="/" className="text-xs font-mono px-3 py-1.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">MACRO TERMINAL</Link>
          </div>
        </div>
        <div>
          <p className="text-xs font-mono text-emerald-400 tracking-widest mb-2">SUBSCRIBER ONBOARDING & MT5 SETUP MANUAL</p>
          <h1 className="text-3xl font-bold tracking-tight mb-2">AlgoLync Expert Advisor Setup Guide</h1>
          <p className="text-sm text-emerald-200/75">Follow these four steps to bind your MetaTrader 5 account and activate automated execution.</p>
        </div>
        <section className="bg-[#06120E] border border-emerald-500/25 rounded-xl p-6 space-y-3">
          <h2 className="text-lg font-bold text-white">Step 1: Provision Your Account-Bound License</h2>
          <p className="text-sm text-emerald-100/80">Visit the <Link href="/store" className="text-emerald-400 underline">AlgoLync Vault (/store)</Link>, select your plan, and enter your exact MT5 account number.</p>
        </section>
        <section className="bg-[#06120E] border border-emerald-500/25 rounded-xl p-6 space-y-3">
          <h2 className="text-lg font-bold text-white">Step 2: Install the .EX5 Binary</h2>
          <p className="text-sm text-emerald-100/80">Place <code className="text-emerald-300 font-mono">AlgoLync_EA.ex5</code> into your MT5 Data Folder under <code className="text-emerald-300 font-mono">MQL5/Experts/</code>.</p>
        </section>
        <section className="bg-[#06120E] border border-emerald-500/25 rounded-xl p-6 space-y-3">
          <h2 className="text-lg font-bold text-white">Step 3: Whitelist WebRequest URL</h2>
          <p className="text-sm text-emerald-100/80">In MT5 Tools → Options → Expert Advisors, check <strong>Allow WebRequest</strong> and add:</p>
          <div className="bg-black/70 border border-emerald-500/40 rounded p-3 font-mono text-sm text-emerald-400 select-all">https://fidulync.vercel.app</div>
        </section>
      </div>
    </main>
  );
}
