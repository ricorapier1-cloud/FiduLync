import Link from 'next/link';

export default function AlgolyncStore() {
  return (
    <section className="mx-auto my-10 max-w-4xl rounded-xl border border-white/10 bg-[#0c1016] p-6 text-slate-100">
      <div className="font-mono text-[10px] tracking-widest text-emerald-300">ALGOLYNC / STRATEGY MARKETPLACE</div>
      <h2 className="mt-2 text-xl font-semibold">Explore EA subscriptions</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">The current catalogue, recurring checkout, demo eligibility and account-seat management are available in the unified AlgoLync marketplace.</p>
      <Link href="/store" className="mt-5 inline-flex rounded-lg bg-emerald-300 px-4 py-3 text-xs font-bold text-slate-950">Open AlgoLync Store</Link>
    </section>
  );
}
