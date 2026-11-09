import Link from 'next/link';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  ChartNoAxesCombined,
  CircleHelp,
  Clock3,
  LockKeyhole,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';

const recentActivity = [
  { title: 'Protected settlement', detail: 'Your transactions are held securely until delivery is confirmed.', icon: ShieldCheck },
  { title: 'Transparent pricing', detail: 'A fixed 1.5% platform fee, shown before you fund a deal.', icon: WalletCards },
  { title: 'Independent EA verification', detail: 'Performance verification is clearly attributed to its source.', icon: BadgeCheck },
];

export default function Home() {
  return (
    <div className="page-content space-y-6">
      <section className="panel grid-background relative overflow-hidden p-6 sm:p-9">
        <div className="pointer-events-none absolute -right-20 -top-32 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="max-w-2xl">
            <div className="eyebrow flex items-center gap-2"><span className="status-dot" /> FIDULYNC SETTLEMENT NETWORK</div>
            <h1 className="mt-5 max-w-xl text-4xl font-semibold leading-[1.12] tracking-[-0.06em] text-white sm:text-5xl">
              Move value with <span className="text-[#51e4c2]">confidence.</span>
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-7 text-slate-400">
              Secure your next transaction in escrow, or explore independently verifiable MetaTrader tools built for transparent performance.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/create-link" className="primary-button">Create protected deal <ArrowRight size={16} /></Link>
              <Link href="/store" className="secondary-button"><ChartNoAxesCombined size={15} /> Explore AlgoLync</Link>
            </div>
          </div>

          <div className="panel glass relative p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="metric-label">TRANSACTION PROTECTION</div>
                <div className="mt-2 text-lg font-semibold tracking-tight">Every detail, accounted for.</div>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-emerald-300/15 bg-emerald-300/[0.08] text-[#51e4c2]">
                <LockKeyhole size={19} />
              </span>
            </div>
            <div className="mt-6 space-y-4">
              {recentActivity.map(({ title, detail, icon: Icon }) => (
                <div className="flex gap-3" key={title}>
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/[0.06] bg-white/[0.035] text-[#51e4c2]"><Icon size={15} /></span>
                  <div>
                    <div className="text-xs font-semibold text-slate-200">{title}</div>
                    <p className="mt-1 text-[11px] leading-5 text-slate-500">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Link href="/create-link" className="panel group flex min-h-36 flex-col justify-between p-5 transition hover:border-emerald-300/25">
          <span className="flex items-center justify-between text-[#51e4c2]"><ShieldCheck size={19} /><ArrowUpRight size={16} className="text-slate-600 transition group-hover:text-[#51e4c2]" /></span>
          <span><span className="block text-sm font-semibold">Create an escrow</span><span className="mt-1 block text-xs text-slate-500">Set terms. Share a secure payment link.</span></span>
        </Link>
        <Link href="/store" className="panel group flex min-h-36 flex-col justify-between p-5 transition hover:border-emerald-300/25">
          <span className="flex items-center justify-between text-[#51e4c2]"><ChartNoAxesCombined size={19} /><ArrowUpRight size={16} className="text-slate-600 transition group-hover:text-[#51e4c2]" /></span>
          <span><span className="block text-sm font-semibold">Explore AlgoLync</span><span className="mt-1 block text-xs text-slate-500">Discover verified MT5 strategies.</span></span>
        </Link>
        <Link href="/verify" className="panel group flex min-h-36 flex-col justify-between p-5 transition hover:border-emerald-300/25">
          <span className="flex items-center justify-between text-[#51e4c2]"><CircleHelp size={19} /><ArrowUpRight size={16} className="text-slate-600 transition group-hover:text-[#51e4c2]" /></span>
          <span><span className="block text-sm font-semibold">Verify a payment link</span><span className="mt-1 block text-xs text-slate-500">Check that a transaction is registered.</span></span>
        </Link>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="panel p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="eyebrow">HOW FIDULYNC WORKS</div>
              <h2 className="mt-2 text-lg font-semibold tracking-tight">A clear path from agreement to settlement</h2>
            </div>
            <Clock3 size={18} className="text-slate-500" />
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              ['01', 'Agree on terms', 'Set the item, price, fee payer and delivery conditions.'],
              ['02', 'Fund the escrow', 'The buyer pays through Paystack; funds remain in the settlement flow.'],
              ['03', 'Review & release', 'A 48-hour inspection window follows delivery. Disputes pause settlement.'],
            ].map(([step, title, detail]) => (
              <div key={step} className="rounded-xl border border-white/[0.06] bg-black/10 p-4">
                <span className="mono text-[10px] text-[#51e4c2]">{step} / 03</span>
                <h3 className="mt-3 text-xs font-semibold">{title}</h3>
                <p className="mt-2 text-[11px] leading-5 text-slate-500">{detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="panel flex flex-col justify-between p-5 sm:p-6">
          <div>
            <div className="eyebrow">FEE TRANSPARENCY</div>
            <h2 className="mt-2 text-lg font-semibold tracking-tight">No surprises at checkout.</h2>
            <p className="mt-2 text-xs leading-6 text-slate-500">The platform fee is 1.5% of the deal amount, with your choice of who pays.</p>
          </div>
          <div className="mt-6 flex items-end justify-between border-t border-white/[0.07] pt-4">
            <div>
              <div className="metric-label">PLATFORM FEE</div>
              <div className="mono mt-2 text-xl font-medium text-[#51e4c2]">1.50%</div>
            </div>
            <Link href="/create-link" className="secondary-button">View breakdown <ArrowDownLeft size={14} /></Link>
          </div>
        </div>
      </section>

      <footer className="flex flex-col gap-2 border-t border-white/[0.06] py-5 text-[10px] text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <span>© {new Date().getFullYear()} FiduLync · Transaction infrastructure for digital commerce</span>
        <span className="mono">Payments are subject to provider and bank processing timelines.</span>
      </footer>
    </div>
  );
}
