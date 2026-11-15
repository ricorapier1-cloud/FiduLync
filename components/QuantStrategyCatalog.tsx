'use client';

import React, { useState } from 'react';

type StrategyCardProps = {
  id: string;
  name: string;
  version: string;
  badge: string;
  badgeColor: 'emerald' | 'cyan' | 'amber';
  headline: string;
  description: string;
  winRate: string;
  profitFactor: string;
  sharpeRatio: string;
  maxDrawdown: string;
  targetPairs: string;
  timeframe: string;
  demoDownloadUrl: string;
  demoFilename: string;
  licenseAnchor: string;
  equityCurvePoints: number[];
  provenanceNote: string;
};

const STRATEGIES: StrategyCardProps[] = [
  {
    id: 'eridam-nexus',
    name: 'Eridam Nexus Adaptive Pro',
    version: 'v4.2',
    badge: 'FLAGSHIP INSTITUTIONAL',
    badgeColor: 'emerald',
    headline: 'Multi-Regime Volatility & Macro Bias Execution Engine',
    description:
      'Dynamically scales positioning based on real yield spreads and institutional liquidity killzones. Deploys non-martingale volatility-adjusted stop losses with ATR trailing protection.',
    winRate: '64.8%',
    profitFactor: '2.34',
    sharpeRatio: '2.18',
    maxDrawdown: '5.4%',
    targetPairs: 'EURUSD · GBPUSD · USDJPY · XAUUSD',
    timeframe: 'H1 Signal / H4 Regime',
    demoDownloadUrl: '/downloads/Eridam_Nexus_Adaptive_Demo.mq5',
    demoFilename: 'Eridam_Nexus_Adaptive_Demo.mq5',
    licenseAnchor: '#vault-checkout',
    equityCurvePoints: [100, 102, 101, 105, 108, 107, 112, 116, 115, 121, 126, 124, 131, 138, 142],
    provenanceNote: 'Simulated institutional forward-test & historical sample reference.',
  },
  {
    id: 'velocity-vault',
    name: 'Velocity Vault Momentum',
    version: 'v2.7',
    badge: 'INTRADAY MOMENTUM',
    badgeColor: 'cyan',
    headline: 'London/NY Overlap Expansion Continuation System',
    description:
      'Specialized intraday trend capture engineered around Tier-1 macroeconomic liquidity releases. Exploits liquidity voids and momentum continuations with dynamic order flow management.',
    winRate: '59.2%',
    profitFactor: '2.05',
    sharpeRatio: '1.92',
    maxDrawdown: '4.8%',
    targetPairs: 'EURUSD · GBPUSD · AUDUSD · USDJPY',
    timeframe: 'M15 Execution / H1 Confirmation',
    demoDownloadUrl: '/downloads/Velocity_Vault_Momentum_Demo.mq5',
    demoFilename: 'Velocity_Vault_Momentum_Demo.mq5',
    licenseAnchor: '#vault-checkout',
    equityCurvePoints: [100, 101, 104, 103, 107, 110, 109, 114, 118, 117, 122, 125, 129, 133, 137],
    provenanceNote: 'Backtested tick telemetry & London open reference expectation.',
  },
  {
    id: 'macrolync-breakout',
    name: 'MacroLync G10 ATR Breakout',
    version: 'v1.0 Demo',
    badge: 'FREE SANDBOX TEST',
    badgeColor: 'amber',
    headline: 'Open-Source Sandbox EA for MetaTrader 5 Terminal Verification',
    description:
      'Pre-configured MIT-licensed open-source test artifact with built-in WebRequest license gating, ATR breakout triggers, and VPS heartbeat telemetry. Ideal for sandbox testing in MetaEditor.',
    winRate: '54.0%',
    profitFactor: '1.62',
    sharpeRatio: '1.45',
    maxDrawdown: '6.9%',
    targetPairs: 'G10 Majors (EURUSD, GBPUSD, USDJPY)',
    timeframe: 'M15 / H1 Volatility',
    demoDownloadUrl: '/downloads/MacroLync_G10_Breakout_Test.mq5',
    demoFilename: 'MacroLync_G10_Breakout_Test.mq5',
    licenseAnchor: '#vault-checkout',
    equityCurvePoints: [100, 103, 101, 104, 106, 105, 109, 108, 112, 115, 114, 118, 120, 122, 124],
    provenanceNote: 'Open-source MIT sample EA for compilation and connection testing.',
  },
];

function InteractiveSparkline({ points, color }: { points: number[]; color: 'emerald' | 'cyan' | 'amber' }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const width = 280;
  const height = 64;
  const padY = 8;

  const strokeColor =
    color === 'emerald' ? '#34d399' : color === 'cyan' ? '#38bdf8' : '#fbbf24';
  const fillColor =
    color === 'emerald' ? 'rgba(52, 211, 153, 0.12)' : color === 'cyan' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(251, 191, 36, 0.12)';

  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - padY - ((p - min) / range) * (height - padY * 2);
    return { x, y, value: p };
  });

  const pathD = coords.reduce((acc, c, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`, '');
  const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

  return (
    <div className="relative mt-3 rounded-lg border border-white/[0.06] bg-black/40 p-2.5">
      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: strokeColor }} />
          HISTORICAL EXPECTANCY (EQUITY CURVE)
        </span>
        <span className="text-slate-300">
          {hoverIndex !== null ? `Step ${hoverIndex + 1}: ${points[hoverIndex].toFixed(1)} pts` : `+${(((max - min) / min) * 100).toFixed(1)}% Cum.`}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-1.5 w-full overflow-visible"
        onMouseLeave={() => setHoverIndex(null)}
      >
        <path d={areaD} fill={fillColor} />
        <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={hoverIndex === i ? 4 : 2}
            fill={hoverIndex === i ? '#ffffff' : strokeColor}
            className="cursor-pointer transition-all"
            onMouseEnter={() => setHoverIndex(i)}
          />
        ))}
      </svg>
    </div>
  );
}

export function QuantStrategyCatalog() {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = (strategy: StrategyCardProps) => {
    setDownloadingId(strategy.id);
    setTimeout(() => {
      setDownloadingId(null);
    }, 2000);
  };

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.08] pb-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] tracking-widest text-emerald-400 uppercase">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            QUANT MARKETPLACE &amp; STRATEGY VAULT
          </div>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-white sm:text-2xl">
            Algorithmic Trading Systems &amp; Verified MQL5 Artifacts
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Download open-source demo EAs for chart testing, or provision institutional cloud-authenticated licenses for live accounts.
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
          <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
            MT5 Build 4150+ Ready
          </span>
          <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-slate-300">
            WebRequest Cloud Gated
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {STRATEGIES.map((strategy) => {
          const badgeStyles =
            strategy.badgeColor === 'emerald'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : strategy.badgeColor === 'cyan'
              ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-300';

          return (
            <article
              key={strategy.id}
              className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#0c1017] p-5 shadow-lg transition-all hover:border-white/20 hover:shadow-black/50"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className={`rounded px-2 py-0.5 font-mono text-[9px] font-semibold tracking-wider uppercase border ${badgeStyles}`}>
                    {strategy.badge}
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">
                    {strategy.version}
                  </span>
                </div>

                <h3 className="mt-3 text-lg font-bold text-white tracking-tight">
                  {strategy.name}
                </h3>
                <p className="mt-1 text-xs font-medium text-emerald-400/90 font-mono">
                  {strategy.headline}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  {strategy.description}
                </p>

                {/* Telemetry and Stats Grid */}
                <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-white/[0.05] bg-black/30 p-2.5 font-mono text-[11px]">
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase block">Win Rate</span>
                    <strong className="text-emerald-400 font-semibold">{strategy.winRate}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase block">Profit Factor</span>
                    <strong className="text-white font-semibold">{strategy.profitFactor}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase block">Sharpe Ratio</span>
                    <strong className="text-white font-semibold">{strategy.sharpeRatio}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase block">Max Drawdown</span>
                    <strong className="text-amber-400 font-semibold">{strategy.maxDrawdown}</strong>
                  </div>
                </div>

                <div className="mt-3 space-y-1 font-mono text-[10px] text-slate-400">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Pairs:</span>
                    <span className="text-slate-300 font-semibold">{strategy.targetPairs}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Timeframe:</span>
                    <span className="text-slate-300">{strategy.timeframe}</span>
                  </div>
                </div>

                {/* Interactive SVG Sparkline */}
                <InteractiveSparkline points={strategy.equityCurvePoints} color={strategy.badgeColor} />
                <p className="mt-1.5 text-[9px] text-slate-500 italic">
                  * {strategy.provenanceNote}
                </p>
              </div>

              {/* DUAL ACTION BUTTON WORKFLOW */}
              <div className="mt-5 space-y-2 pt-3 border-t border-white/[0.08]">
                {/* Button A: Download Demo EA */}
                <a
                  href={strategy.demoDownloadUrl}
                  download={strategy.demoFilename}
                  onClick={() => handleDownload(strategy)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-slate-200 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
                >
                  <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {downloadingId === strategy.id ? 'Downloading Artifact…' : 'Download Demo EA (.mq5)'}
                </a>

                {/* Button B: Provision Real EA License */}
                <a
                  href={strategy.licenseAnchor}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-4 py-2.5 text-xs font-bold text-emerald-300 shadow-md shadow-emerald-950/30 transition-all hover:border-emerald-400 hover:bg-emerald-500 hover:text-black"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Provision Real EA License
                </a>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export default QuantStrategyCatalog;
