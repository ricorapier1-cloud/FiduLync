import Link from 'next/link';
import BrandGlyph from '@/components/BrandGlyph';
import { getRegimeValidationSummary } from '@/lib/macro/validationEngine';

export const metadata = {
  title: 'Macro Regime Validation & Backtest Workbench | MacroLync',
  description: 'Out-of-sample macroeconomic regime backtesting, vintage integrity validation, and rate-differential return attribution.',
};

export default function FundamentalWorkbenchPage() {
  const summary = getRegimeValidationSummary();

  return (
    <div className="macro-page pb-36 sm:pb-12 md:pb-8">
      <div className="macro-statusline mono">
        <span><span className="macro-pulse macro-pulse-live" /> MACRO REGIME WORKBENCH / OUT-OF-SAMPLE VALIDATION</span>
        <span className="macro-status-right">
          <Link href="/" className="macro-refresh">← RETURN TO TERMINAL</Link>
          <Link href="/notebook" className="macro-refresh">OPEN RESEARCH NOTEBOOK →</Link>
        </span>
      </div>

      <section className="macro-intro" aria-labelledby="workbench-title">
        <div>
          <span className="eyebrow">FUNDAMENTAL VALIDATION & VINTAGE INTEGRITY</span>
          <h1 id="workbench-title">Macro Regime Backtest.<br /><span>Out-of-sample validation.</span></h1>
          <p>
            Evaluates the empirical efficacy of monetary-policy divergence, real-rate yield spreads, and inflation shocks across historical macro regimes. Strictly focused on macroeconomic return attribution without technical indicator curve-fitting.
          </p>
        </div>
        <div className="macro-intro-meta mono">
          <span>VINTAGE AUDIT / POINT-IN-TIME</span>
          <span className="macro-provenance text-emerald-400">
            INTEGRITY NOTICE: Macro statistical releases are evaluated strictly using point-in-time release vintages to prevent look-ahead bias and revision contamination.
          </span>
        </div>
      </section>

      {/* Summary KPIs */}
      <section className="macro-kpis" aria-label="Validation summary">
        <article className="macro-kpi">
          <span className="macro-kpi-label">TOTAL CYCLES <span>EVALUATED</span></span>
          <strong className="mono">{summary.totalCycles}</strong>
          <small>{summary.adequateSampleCycles} cycles meet minimum N≥30 sample size</small>
        </article>
        <article className="macro-kpi">
          <span className="macro-kpi-label">REGIME WIN RATE <span>DIRECTIONAL</span></span>
          <strong className="mono text-emerald-400">{summary.winRatePct}%</strong>
          <small>Fundamental carry &amp; divergence alignment</small>
        </article>
        <article className="macro-kpi">
          <span className="macro-kpi-label">AVG QUARTER RETURN <span>UNLEVERAGED</span></span>
          <strong className="mono text-emerald-400">+{summary.avgReturnPct}%</strong>
          <small>Spot return without broker leverage</small>
        </article>
        <article className="macro-kpi">
          <span className="macro-kpi-label">AVG CYCLE DRAWDOWN <span>MAX PEAK-TO-TROUGH</span></span>
          <strong className="mono text-amber-400">-{summary.avgDrawdownPct}%</strong>
          <small>Unleveraged macro drawdown threshold</small>
        </article>
      </section>

      {/* Historical Cycles Table */}
      <section className="macro-section">
        <div className="macro-section-heading">
          <div>
            <span className="eyebrow">EMPIRICAL ATTRIBUTION</span>
            <h2>Historical Macro Regime Cycles</h2>
          </div>
          <span className="macro-section-note mono">G8 CURRENCY RETURNS</span>
        </div>

        <div className="macro-panel macro-matrix-panel">
          <table className="macro-table">
            <thead>
              <tr>
                <th>CYCLE / PERIOD</th>
                <th>MACRO REGIME</th>
                <th>PRIMARY PAIR</th>
                <th>POLICY SPREAD</th>
                <th>CYCLE RETURN</th>
                <th>MAX DRAWDOWN</th>
                <th>OBSERVATIONS (N)</th>
                <th>VINTAGE INTEGRITY</th>
              </tr>
            </thead>
            <tbody>
              {summary.cycles.map((c) => (
                <tr key={c.cycleId}>
                  <td>
                    <strong className="text-slate-200 text-xs">{c.period}</strong>
                    <small className="mono block text-slate-500">{c.cycleId}</small>
                  </td>
                  <td>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/[0.06] text-slate-300">
                      {c.regime.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>
                    <span className="macro-currency-code mono">{c.primaryPair}</span>
                  </td>
                  <td className="mono">+{c.policySpreadBps} bps</td>
                  <td className={`mono font-bold ${c.benchmarkReturnPct >= 0 ? 'macro-positive' : 'macro-negative'}`}>
                    {c.benchmarkReturnPct > 0 ? '+' : ''}{c.benchmarkReturnPct.toFixed(2)}%
                  </td>
                  <td className="mono text-amber-400">
                    -{c.maxDrawdownPct.toFixed(2)}%
                  </td>
                  <td className="mono">
                    {c.sampleObservations}
                    {!c.sampleSizeAdequate && (
                      <span className="ml-1 text-[10px] text-rose-400 font-bold" title="Low sample size">⚠️ LOW N</span>
                    )}
                  </td>
                  <td>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                      c.vintageIntegrity === 'POINT_IN_TIME_VERIFIED'
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                        : 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
                    }`}>
                      {c.vintageIntegrity}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="macro-panel-foot">
            <span>Methodology: Macro fundamental regime returns track unleveraged G8 spot performance. No technical indicators, Martingale sizing, or broker simulation.</span>
            <span className="mono">POINT-IN-TIME VINTAGE AUDITED</span>
          </div>
        </div>
      </section>

      {/* Rigorous Research Disclosures */}
      <section className="mt-8 rounded-xl border border-white/[0.08] bg-[#0c1016] p-6 text-xs text-slate-400 space-y-3">
        <div className="flex items-center gap-2 font-mono uppercase text-amber-300">
          <BrandGlyph name="shield-alert" size={16} />
          QUANTITATIVE RESEARCH GOVERNANCE &amp; REVISION BIAS WARNING
        </div>
        <p className="leading-relaxed">
          Economic indicators (such as GDP, Non-Farm Payrolls, and preliminary CPI prints) are frequently revised by official statistical bureaus months after initial publication. Evaluating currency performance against final revised figures introduces fatal look-ahead bias into backtest models.
        </p>
        <p className="leading-relaxed text-slate-300">
          MacroLync enforces strict point-in-time data vintage controls: historical signals are evaluated exclusively using the exact observation values available to market participants at the scheduled release timestamp.
        </p>
      </section>
    </div>
  );
}
