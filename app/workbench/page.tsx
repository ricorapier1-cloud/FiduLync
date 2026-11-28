import Link from 'next/link';
import BrandGlyph from '@/components/BrandGlyph';
import { getRegimeValidationSummary } from '@/lib/macro/validationEngine';

export const metadata = {
  title: 'Macro Regime Validation Workbench | MacroLync',
  description: 'Research validation status and requirements for point-in-time macroeconomic testing.',
};

export default function FundamentalWorkbenchPage() {
  const summary = getRegimeValidationSummary();
  return (
    <div className="macro-page pb-36 sm:pb-12 md:pb-8">
      <div className="macro-statusline mono">
        <span><span className="macro-pulse" /> MACRO REGIME WORKBENCH / VALIDATION GOVERNANCE</span>
        <span className="macro-status-right">
          <Link href="/" className="macro-refresh">← RETURN TO TERMINAL</Link>
          <Link href="/validation" className="macro-refresh">MONTE CARLO SIMULATOR →</Link>
          <Link href="/accounts" className="macro-refresh">PORTFOLIO &amp; ACCOUNTS →</Link>
        </span>
      </div>
      <section className="macro-intro" aria-labelledby="workbench-title">
        <div>
          <span className="eyebrow">RESEARCH VALIDATION STATUS</span>
          <h1 id="workbench-title">Historical Macro Validation.<br /><span>Evidence before performance.</span></h1>
          <p>Historical performance will be published only after point-in-time source vintages, synchronized FX returns, and reproducible out-of-sample calculations are available.</p>
        </div>
        <div className="macro-intro-meta mono">
          <span>VALIDATION STATUS</span>
          <span className="macro-provenance text-amber-300">NOT VALIDATED — NO VERIFIED HISTORICAL PERFORMANCE CLAIMS</span>
        </div>
      </section>
      <section className="macro-section">
        <div className="macro-section-heading">
          <div><span className="eyebrow">QUANTITATIVE GOVERNANCE</span><h2>Validation release gate</h2></div>
          <span className="macro-section-note mono">FAIL-CLOSED REPORTING</span>
        </div>
        <div className="macro-panel p-6 space-y-4">
          <div className="flex items-center gap-3">
            <BrandGlyph name="shield-alert" size={22} />
            <div><strong className="text-amber-300 font-mono text-sm">{summary.status}</strong><p className="text-xs text-slate-400 mt-1">{summary.explanation}</p></div>
          </div>
          <div className="p-4 bg-slate-950 border border-teal-900/50 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-teal-300">OUT-OF-SAMPLE &amp; 1,000-RUN MONTE CARLO STRESS ENGINE</div>
              <p className="text-xs text-slate-400 mt-0.5">Run walk-forward (70% in-sample / 30% out-of-sample) testing and randomized 1,000-run Monte Carlo simulations against imported MT5 backtest CSVs or verified manual ledger trades.</p>
            </div>
            <Link href="/validation" className="px-4 py-2 bg-teal-900 hover:bg-teal-800 text-teal-200 text-xs font-semibold rounded whitespace-nowrap transition text-center">
              Launch Simulator →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded border border-white/[0.08] p-4"><span className="macro-kpi-label">VERIFIED CYCLES</span><strong className="block mono text-2xl text-slate-200">0</strong><small className="text-slate-500">No unsupported sample records.</small></div>
            <div className="rounded border border-white/[0.08] p-4"><span className="macro-kpi-label">PERFORMANCE KPIs</span><strong className="block mono text-2xl text-slate-200">—</strong><small className="text-slate-500">Withheld pending reproducible validation.</small></div>
          </div>
          <h3 className="text-xs font-mono uppercase tracking-wider text-slate-300">Certification requirements</h3>
          <ul className="list-disc list-inside space-y-2 text-xs text-slate-400">
            <li>Point-in-time macro observations with original release timestamps and vintage history.</li>
            <li>Synchronized historical FX returns and instrument calendars.</li>
            <li>Chronological signal construction using only information available at each decision time.</li>
            <li>Out-of-sample and walk-forward evaluation with transaction costs stated separately.</li>
            <li>Reproducible drawdown, uncertainty, sample-size and sensitivity calculations.</li>
          </ul>
        </div>
      </section>
      <section className="mt-8 rounded-xl border border-white/[0.08] bg-[#0c1016] p-6 text-xs text-slate-400 space-y-3">
        <div className="flex items-center gap-2 font-mono uppercase text-amber-300"><BrandGlyph name="shield-alert" size={16} /> POINT-IN-TIME RESEARCH STANDARD</div>
        <p className="leading-relaxed">Economic releases are revised. A valid historical simulation must use the exact vintage and publication timestamp available to market participants at each historical decision point. Using subsequently revised values introduces look-ahead bias.</p>
        <p className="leading-relaxed text-slate-300">This workbench does not claim that a historical validation pipeline is operational. Results will appear only after the underlying observations and calculations can be reproduced.</p>
      </section>
    </div>
  );
}
