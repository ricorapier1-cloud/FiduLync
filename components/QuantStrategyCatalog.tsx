'use client';
import Link from 'next/link';

interface StrategySpec {
  id: string;
  tag: string;
  version: string;
  name: string;
  tier: 'INSTITUTIONAL' | 'FREE TEST ARTIFACT';
  description: string;
  pairs: string;
  timeframe: string;
  winRate: string;
  profitFactor: string;
  maxDrawdown: string;
  sharpe: string;
  equityPoints: string;
  downloadHref?: string;
  downloadName?: string;
}

const STRATEGIES: StrategySpec[] = [
  {
    id: "eridam-nexus",
    tag: "FLAGSHIP MACRO ENGINE",
    version: "NEXUS / 4.2",
    name: "Eridam Nexus Adaptive Pro",
    tier: "INSTITUTIONAL",
    description: "Regime-adaptive execution framework with volatility-normalized position sizing, G10 central bank event vetoes, and ghost-order virtualization.",
    pairs: "EURUSD • GBPUSD • USDJPY • XAUUSD",
    timeframe: "H1 Signal / H4 Macro Regime",
    winRate: "64.8%",
    profitFactor: "2.34",
    maxDrawdown: "5.4% (8% Cap)",
    sharpe: "2.18",
    equityPoints: "0,44 18,40 36,35 54,37 72,28 90,22 108,18 126,13 144,8 160,4",
  },
  {
    id: "velocity-vault",
    tag: "INTRADAY EXPANSION",
    version: "VELOCITY / 2.7",
    name: "Velocity Vault Momentum",
    tier: "INSTITUTIONAL",
    description: "High-efficiency session continuation algorithm combining directional impulse filters, virtual pending levels, and automated NFP/FOMC lockout.",
    pairs: "EURUSD • GBPUSD • XAUUSD",
    timeframe: "M15 Execution / H1 Bias",
    winRate: "61.2%",
    profitFactor: "2.09",
    maxDrawdown: "4.8% (6% Cap)",
    sharpe: "1.94",
    equityPoints: "0,45 18,42 36,38 54,31 72,33 90,24 108,19 126,15 144,10 160,6",
  },
  {
    id: "g10-breakout-test",
    tag: "OPEN-SOURCE SANDBOX EA",
    version: "MIT / 1.0",
    name: "MacroLync G10 ATR Breakout",
    tier: "FREE TEST ARTIFACT",
    description: "Free compile-ready MQL5 Expert Advisor engineered to test MT5 installation, ATR dynamic risk sizing, and MacroLync WebRequest license validation.",
    pairs: "EURUSD • GBPUSD • USDJPY",
    timeframe: "M15 / H1",
    winRate: "54.0%",
    profitFactor: "1.62",
    maxDrawdown: "6.9%",
    sharpe: "1.45",
    equityPoints: "0,44 20,41 40,43 60,34 80,30 100,27 120,21 140,17 160,13",
    downloadHref: "/downloads/MacroLync_G10_Breakout_Test.mq5",
    downloadName: "MacroLync_G10_Breakout_Test.mq5",
  },
  {
    id: "session-momentum-test",
    tag: "OPEN-SOURCE SANDBOX EA",
    version: "MIT / 1.0",
    name: "MacroLync Session Momentum",
    tier: "FREE TEST ARTIFACT",
    description: "Free London/NY overlap EMA-RSI momentum test robot. Ideal for verifying MetaEditor compilation and VPS heartbeat telemetry before upgrading.",
    pairs: "EURUSD • XAUUSD",
    timeframe: "M15",
    winRate: "56.5%",
    profitFactor: "1.71",
    maxDrawdown: "5.8%",
    sharpe: "1.52",
    equityPoints: "0,46 20,42 40,37 60,39 80,31 100,26 120,22 140,16 160,11",
    downloadHref: "/downloads/MacroLync_Session_Momentum_Test.mq5",
    downloadName: "MacroLync_Session_Momentum_Test.mq5",
  },
];

export function QuantStrategyCatalog() {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-3">
        <div>
          <p className="text-[11px] font-mono tracking-widest text-emerald-400">
            02 / VERIFIED STRATEGY REPOSITORY & FREE TEST SANDBOX
          </p>
          <h2 className="text-xl font-bold text-white">Quantitative Algorithms & Test EAs</h2>
        </div>
        <Link
          href="/guide"
          className="text-xs font-mono px-3 py-1.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
        >
          MT5 SETUP MANUAL →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {STRATEGIES.map((ea) => {
          const isFree = ea.tier === "FREE TEST ARTIFACT";
          return (
            <div
              key={ea.id}
              className="bg-[#06120E] border border-emerald-500/25 rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-lg"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                      isFree
                        ? "bg-cyan-500/10 border-cyan-400/40 text-cyan-300"
                        : "bg-emerald-500/15 border-emerald-400/40 text-emerald-300"
                    }`}
                  >
                    {ea.tier}
                  </span>
                  <span className="text-[11px] font-mono text-emerald-400/80 border border-emerald-500/20 px-2 py-0.5 rounded">
                    {ea.version}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white">{ea.name}</h3>
                  <p className="text-xs text-emerald-100/75 leading-relaxed mt-1">{ea.description}</p>
                </div>

                <div className="grid grid-cols-4 gap-2 bg-black/50 border border-emerald-500/15 rounded-lg p-2.5 text-center font-mono">
                  <div>
                    <span className="text-[9px] text-emerald-400/60 block">WIN RATE</span>
                    <span className="text-xs font-bold text-emerald-300">{ea.winRate}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-emerald-400/60 block">PROFIT F.</span>
                    <span className="text-xs font-bold text-emerald-300">{ea.profitFactor}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-emerald-400/60 block">SHARPE</span>
                    <span className="text-xs font-bold text-emerald-300">{ea.sharpe}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-emerald-400/60 block">MAX DD</span>
                    <span className="text-xs font-bold text-amber-300">{ea.maxDrawdown.split(" ")[0]}</span>
                  </div>
                </div>

                <div className="bg-black/40 border border-emerald-500/15 rounded-lg p-2.5">
                  <div className="flex items-center justify-between text-[10px] font-mono text-emerald-400/70 mb-1">
                    <span>REFERENCE EQUITY CURVE</span>
                    <span>{ea.timeframe}</span>
                  </div>
                  <svg viewBox="0 0 160 50" className="w-full h-11 overflow-visible">
                    <polyline
                      fill="none"
                      stroke={isFree ? "#22d3ee" : "#10b981"}
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={ea.equityPoints}
                    />
                  </svg>
                </div>

                <div className="text-[11px] font-mono text-emerald-200/80">
                  <span className="text-emerald-400/60">SYMBOLS: </span>
                  {ea.pairs}
                </div>
              </div>

              <div className="pt-2 border-t border-emerald-500/15">
                {isFree && ea.downloadHref ? (
                  <a
                    href={ea.downloadHref}
                    download={ea.downloadName}
                    className="block w-full text-center bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/50 text-cyan-200 font-mono font-bold py-2.5 rounded text-xs tracking-wider transition-colors"
                  >
                    DOWNLOAD FREE TEST EA (.MQ5)
                  </a>
                ) : (
                  <a
                    href="#vault-checkout"
                    className="block w-full text-center bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold py-2.5 rounded text-xs tracking-wider transition-colors"
                  >
                    PROVISION ACCOUNT LICENSE ABOVE ↑
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
