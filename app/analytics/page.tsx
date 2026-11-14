import Link from 'next/link';

const REGIME_HISTORY = [
  { quarter: '2026 Q3', regime: 'POLICY DIVERGENCE', topSpread: 'USD / JPY (+145)', winRate: '64.2%', profitFactor: '1.94', maxDd: '4.1%' },
  { quarter: '2026 Q2', regime: 'CARRY COMPRESSION', topSpread: 'NOK / CHF (+108)', winRate: '61.8%', profitFactor: '1.78', maxDd: '4.8%' },
  { quarter: '2026 Q1', regime: 'DISINFLATION PIVOT', topSpread: 'GBP / JPY (+122)', winRate: '66.0%', profitFactor: '2.11', maxDd: '3.6%' },
  { quarter: '2025 Q4', regime: 'RATE HOLD PLATEAU', topSpread: 'AUD / CHF (+96)', winRate: '59.4%', profitFactor: '1.65', maxDd: '5.2%' },
];

export default function AnalyticsPage() {
  return (
    <main className="min-h-screen bg-[#030A08] text-emerald-50 px-4 py-10 pb-36">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="text-xs font-mono text-emerald-400 hover:underline">
            ← BACK TO MACRO TERMINAL
          </Link>
          <Link href="/store" className="text-xs font-mono px-3 py-1.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20">
            OPEN ALGOLYNX VAULT →
          </Link>
        </div>

        <div className="mb-8">
          <p className="text-xs font-mono text-emerald-400 tracking-widest mb-2">QUANTITATIVE VALIDATION / G10 REGIMES</p>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Regime History & Execution Telemetry</h1>
          <p className="text-sm text-emerald-200/70">
            Historical policy-divergence spread performance filtered by COT percentile extremes and rollover risk shields.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <div className="bg-[#06120E] border border-emerald-500/20 rounded-lg p-4">
            <p className="text-[10px] font-mono text-emerald-400/70">AGGREGATE PF</p>
            <p className="text-2xl font-mono font-bold text-emerald-400 mt-1">1.87</p>
          </div>
          <div className="bg-[#06120E] border border-emerald-500/20 rounded-lg p-4">
            <p className="text-[10px] font-mono text-emerald-400/70">MEAN WIN RATE</p>
            <p className="text-2xl font-mono font-bold text-white mt-1">62.8%</p>
          </div>
          <div className="bg-[#06120E] border border-emerald-500/20 rounded-lg p-4">
            <p className="text-[10px] font-mono text-emerald-400/70">PEAK DRAWDOWN</p>
            <p className="text-2xl font-mono font-bold text-emerald-300 mt-1">5.2%</p>
          </div>
          <div className="bg-[#06120E] border border-emerald-500/20 rounded-lg p-4">
            <p className="text-[10px] font-mono text-emerald-400/70">POLICY INPUTS</p>
            <p className="text-2xl font-mono font-bold text-emerald-400 mt-1">11 / 11</p>
          </div>
        </div>

        <div className="bg-[#06120E] border border-emerald-500/25 rounded-xl overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="border-b border-emerald-500/20 text-emerald-400/80 bg-black/30">
              <tr>
                <th className="p-3.5">WINDOW</th>
                <th className="p-3.5">DOMINANT REGIME</th>
                <th className="p-3.5">TOP CSI SPREAD</th>
                <th className="p-3.5">WIN RATE</th>
                <th className="p-3.5">PROFIT FACTOR</th>
                <th className="p-3.5">MAX DD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-500/10">
              {REGIME_HISTORY.map((row) => (
                <tr key={row.quarter} className="hover:bg-emerald-500/5">
                  <td className="p-3.5 font-bold text-emerald-300">{row.quarter}</td>
                  <td className="p-3.5">{row.regime}</td>
                  <td className="p-3.5 text-emerald-400">{row.topSpread}</td>
                  <td className="p-3.5">{row.winRate}</td>
                  <td className="p-3.5 font-bold">{row.profitFactor}</td>
                  <td className="p-3.5 text-emerald-200/70">{row.maxDd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
