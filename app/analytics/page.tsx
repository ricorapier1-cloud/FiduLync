import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Performance Lab',
  description: 'Performance measurement framework for verified personal MT5 trade history.',
};

const metrics = [
  ['Net expectancy', 'Average net result per trade after commission, swap and execution costs.'],
  ['Profit factor', 'Gross profit divided by gross loss, with the sample size shown.'],
  ['Drawdown', 'Peak-to-trough equity decline using a consistent equity series.'],
  ['Sharpe / Sortino', 'Return quality adjusted for total and downside volatility.'],
  ['MAE / MFE', 'Maximum adverse and favourable excursion for each closed trade.'],
  ['Regime attribution', 'Performance split by symbol, timeframe, strategy and market regime.'],
];

export default function PerformanceLabPage() {
  return (
    <main className="min-h-screen bg-[#030A08] px-4 py-10 pb-36 text-emerald-50">
      <div className="mx-auto max-w-4xl">
        <a href="/" className="font-mono text-xs text-emerald-400 hover:underline">← BACK TO MACRO TERMINAL</a>
        <header className="mb-8 mt-8">
          <p className="mb-2 font-mono text-xs tracking-widest text-emerald-400">PERFORMANCE LAB / EVIDENCE FIRST</p>
          <h1 className="mb-3 text-3xl font-bold tracking-tight">Measure what your account actually did.</h1>
          <p className="max-w-3xl text-sm leading-6 text-emerald-100/70">
            Verified performance reporting is not populated yet. The old illustrative win-rate and profit-factor figures have been removed;
            no historical result will be displayed until it is derived from authenticated, account-isolated MT5 trade records with costs.
          </p>
        </header>

        <section className="rounded-xl border border-amber-300/20 bg-amber-300/[0.04] p-5">
          <div className="font-mono text-[10px] tracking-widest text-amber-200">DATA STATUS / NOT YET VALIDATED</div>
          <h2 className="mt-2 text-lg font-semibold text-white">Awaiting verified owner trade history</h2>
          <p className="mt-2 text-xs leading-5 text-emerald-100/70">
            MT5 trade history has not been connected yet. When the desktop terminal and publisher are available, verified and account-isolated closed-trade records can populate these metrics. Until then, blank is more accurate than a fabricated score.
          </p>
        </section>

        <section className="mt-8 grid gap-3 sm:grid-cols-2">
          {metrics.map(([name, description]) => (
            <article key={name} className="rounded-lg border border-emerald-500/15 bg-[#06120E] p-4">
              <h3 className="font-mono text-xs font-semibold text-emerald-300">{name}</h3>
              <p className="mt-2 text-xs leading-5 text-emerald-100/65">{description}</p>
            </article>
          ))}
        </section>
        <p className="mt-6 text-[10px] leading-5 text-emerald-100/45">
          All future reports must show trade count, date range, broker/account scope, data completeness, and whether results are gross or net of costs.
          Historical backtests and live account results must remain separate.
        </p>
      </div>
    </main>
  );
}
