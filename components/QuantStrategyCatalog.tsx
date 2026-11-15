'use client';
import Link from 'next/link';

export function QuantStrategyCatalog() {
  return (
    <section className="space-y-4 my-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-3">
        <div>
          <p className="text-[11px] font-mono tracking-widest text-emerald-400">
            02 / VERIFIED STRATEGY REPOSITORY & FREE TEST SANDBOX
          </p>
          <h2 className="text-xl font-bold text-white">Quantitative Algorithms & Demo EAs</h2>
        </div>
        <Link
          href="/guide"
          className="text-xs font-mono px-3 py-1.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
        >
          MT5 SETUP MANUAL →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Flagship EA */}
        <div className="bg-[#06120E] border border-emerald-500/25 rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-lg">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border bg-emerald-500/15 border-emerald-400/40 text-emerald-300">
                INSTITUTIONAL
              </span>
              <span className="text-[11px] font-mono text-emerald-400/80 border border-emerald-500/20 px-2 py-0.5 rounded">
                NEXUS / 4.2
              </span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Eridam Nexus Adaptive Pro</h3>
              <p className="text-xs text-emerald-100/75 leading-relaxed mt-1">
                Regime-adaptive execution framework with volatility-normalized sizing and G10 central bank event vetoes.
              </p>
            </div>
            <div className="grid grid-cols-4 gap-2 bg-black/50 border border-emerald-500/15 rounded-lg p-2.5 text-center font-mono">
              <div>
                <span className="text-[9px] text-emerald-400/60 block">WIN RATE</span>
                <span className="text-xs font-bold text-emerald-300">64.8%</span>
              </div>
              <div>
                <span className="text-[9px] text-emerald-400/60 block">PROFIT F.</span>
                <span className="text-xs font-bold text-emerald-300">2.34</span>
              </div>
              <div>
                <span className="text-[9px] text-emerald-400/60 block">SHARPE</span>
                <span className="text-xs font-bold text-emerald-300">2.18</span>
              </div>
              <div>
                <span className="text-[9px] text-emerald-400/60 block">MAX DD</span>
                <span className="text-xs font-bold text-amber-300">5.4%</span>
              </div>
            </div>
            <div className="bg-black/40 border border-emerald-500/15 rounded-lg p-2.5">
              <div className="flex items-center justify-between text-[10px] font-mono text-emerald-400/70 mb-1">
                <span>REFERENCE EQUITY CURVE</span>
                <span>H1 / H4 Regime</span>
              </div>
              <svg viewBox="0 0 160 50" className="w-full h-11 overflow-visible">
                <polyline fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" points="0,44 18,40 36,35 54,37 72,28 90,22 108,18 126,13 144,8 160,4" />
              </svg>
            </div>
          </div>
          <div className="pt-2 border-t border-emerald-500/15">
            <a href="#vault-checkout" className="block w-full text-center bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold py-2.5 rounded text-xs tracking-wider transition-colors">
              PROVISION ACCOUNT LICENSE ↑
            </a>
          </div>
        </div>

        {/* Free Demo EA Download Card */}
        <div className="bg-[#06120E] border border-cyan-500/25 rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-lg">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border bg-cyan-500/10 border-cyan-400/40 text-cyan-300">
                FREE DEMO ARTIFACT
              </span>
              <span className="text-[11px] font-mono text-cyan-400/80 border border-cyan-500/20 px-2 py-0.5 rounded">
                MIT / 1.0
              </span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">MacroLync G10 ATR Breakout</h3>
              <p className="text-xs text-emerald-100/75 leading-relaxed mt-1">
                Free compile-ready MQL5 Demo Expert Advisor to test MT5 installation, ATR risk sizing, and WebRequest license validation.
              </p>
            </div>
            <div className="grid grid-cols-4 gap-2 bg-black/50 border border-cyan-500/15 rounded-lg p-2.5 text-center font-mono">
              <div>
                <span className="text-[9px] text-cyan-400/60 block">WIN RATE</span>
                <span className="text-xs font-bold text-cyan-300">54.0%</span>
              </div>
              <div>
                <span className="text-[9px] text-cyan-400/60 block">PROFIT F.</span>
                <span className="text-xs font-bold text-cyan-300">1.62</span>
              </div>
              <div>
                <span className="text-[9px] text-cyan-400/60 block">SHARPE</span>
                <span className="text-xs font-bold text-cyan-300">1.45</span>
              </div>
              <div>
                <span className="text-[9px] text-cyan-400/60 block">MAX DD</span>
                <span className="text-xs font-bold text-amber-300">6.9%</span>
              </div>
            </div>
            <div className="bg-black/40 border border-cyan-500/15 rounded-lg p-2.5">
              <div className="flex items-center justify-between text-[10px] font-mono text-cyan-400/70 mb-1">
                <span>REFERENCE EQUITY CURVE</span>
                <span>M15 / H1</span>
              </div>
              <svg viewBox="0 0 160 50" className="w-full h-11 overflow-visible">
                <polyline fill="none" stroke="#22d3ee" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" points="0,44 20,41 40,43 60,34 80,30 100,27 120,21 140,17 160,13" />
              </svg>
            </div>
          </div>
          <div className="pt-2 border-t border-cyan-500/15">
            <a href="/downloads/MacroLync_G10_Breakout_Test.mq5" download="MacroLync_G10_Breakout_Test.mq5" className="block w-full text-center bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/50 text-cyan-200 font-mono font-bold py-2.5 rounded text-xs tracking-wider transition-colors">
              📥 DOWNLOAD DEMO EA (.MQ5)
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
