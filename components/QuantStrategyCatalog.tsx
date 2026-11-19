'use client';

import React, { useState } from 'react';
import { EA_CATALOG, EaProduct } from '@/lib/eaCatalog';

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
          SIMULATED ILLUSTRATION (NOT VERIFIED)
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

export function QuantStrategyCatalog({ onSelectEa }: { onSelectEa?: (slug: string) => void }) {
  const [demoModalEa, setDemoModalEa] = useState<EaProduct | null>(null);
  const [generatedDemoKey, setGeneratedDemoKey] = useState<string | null>(null);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [demoEmail, setDemoEmail] = useState('');
  const [demoError, setDemoError] = useState('');

  const openDemoRequest = (ea: EaProduct) => {
    setDemoModalEa(ea);
    setGeneratedDemoKey(null);
    setDemoEmail('');
    setDemoError('');
  };

  const handleGenerateDemo = async (ea: EaProduct) => {
    if (!demoEmail.trim()) {
      setDemoError('Enter an email address to issue your demo entitlement.');
      return;
    }
    setLoadingDemo(true);
    setGeneratedDemoKey(null);
    setDemoError('');

    try {
      const res = await fetch('/api/v1/provision-demo-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ea_slug: ea.slug, email: demoEmail.trim() }),
      });
      const data = await res.json();
      if (data.success && data.license_key) {
        setGeneratedDemoKey(data.license_key);
      } else {
        setDemoError(typeof data.error === 'string' ? data.error : 'Demo provisioning was not completed. No license key was issued.');
      }
    } catch { 
      setDemoError('Demo provisioning service could not be reached. No license key was issued.');
    } finally {
      setLoadingDemo(false);
    }
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
            AlgoLync products, licensing and research artifacts. Performance figures shown below are illustrative simulations, not verified live customer results.
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
        {EA_CATALOG.map((strategy) => {
          const badgeStyles =
            strategy.badgeColor === 'emerald'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : strategy.badgeColor === 'cyan'
              ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-300';

          const pricingLabel =
            strategy.tierCategory === 'SANDBOX'
              ? '100% Free Open-Source Demo'
              : `₦${strategy.monthlyPriceNgn.toLocaleString()} / mo ($${strategy.monthlyPriceUsd}) · 1 Live + 2 Demo Included`;

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

                {/* Pricing Banner */}
                <div className="mt-3 rounded border border-white/[0.08] bg-black/40 px-3 py-1.5 font-mono text-[11px] text-emerald-300 flex items-center justify-between">
                  <span>SUBSCRIPTION:</span>
                  <span className="font-bold text-white">{pricingLabel}</span>
                </div>

                {/* Clearly separated simulated reference metrics; never present as live verified telemetry. */}
                <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/[0.04] px-3 py-2 text-[9px] font-mono uppercase tracking-wide text-amber-200">SIMULATED / ILLUSTRATIVE METRICS · NOT LIVE VERIFIED TELEMETRY · NO INDEPENDENT PERFORMANCE AUDIT</div>
                <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border border-white/[0.05] bg-black/30 p-2.5 font-mono text-[11px]">
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase block">Simulated Win Rate</span>
                    <strong className="text-emerald-400 font-semibold">{strategy.winRate}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase block">Simulated Profit Factor</span>
                    <strong className="text-white font-semibold">{strategy.profitFactor}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase block">Simulated Sharpe</span>
                    <strong className="text-white font-semibold">{strategy.sharpeRatio}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase block">Simulated Drawdown</span>
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
                  * Illustrative sample only. {strategy.provenanceNote} No verified live-account telemetry is currently displayed for this strategy.
                </p>
              </div>

              {/* DUAL ACTION BUTTON WORKFLOW */}
              <div className="mt-5 space-y-2 pt-3 border-t border-white/[0.08]">
                {/* Paid EAs can request a persisted demo entitlement; free sandbox artifacts do not mint licences. */}
                {strategy.tierCategory !== 'SANDBOX' && <button
                  type="button"
                  onClick={() => openDemoRequest(strategy)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-slate-200 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
                >
                  <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  Request 14-Day Demo License &amp; Download (.mq5)
                </button>}

                {/* Button B: Provision Real EA License (Anchored to checkout) */}
                <a
                  href="#vault-checkout"
                  onClick={() => onSelectEa && onSelectEa(strategy.slug)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-4 py-2.5 text-xs font-bold text-emerald-300 shadow-md shadow-emerald-950/30 transition-all hover:border-emerald-400 hover:bg-emerald-500 hover:text-black"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {strategy.tierCategory === 'SANDBOX' ? 'Download Free Sandbox Artifact' : `Subscribe Live License (${strategy.name.split(' ')[0]})`}
                </a>
              </div>
            </article>
          );
        })}
      </div>

      {/* 1-CLICK DEMO PROVISIONING MODAL */}
      {demoModalEa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-emerald-500/40 bg-[#07130e] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h3 className="font-mono text-sm font-bold text-emerald-400 uppercase tracking-wider">
                  Request a 14-Day Demo License
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDemoModalEa(null)}
                className="text-slate-400 hover:text-white font-mono text-sm"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 font-mono">
              <div>
                <span className="text-[10px] text-slate-400 uppercase block">Selected Algorithm</span>
                <p className="text-sm font-bold text-white">{demoModalEa.name} ({demoModalEa.version})</p>
              </div>

              <div className="rounded-lg border border-emerald-500/30 bg-black/70 p-3">
                <span className="text-[10px] text-emerald-400/80 uppercase block mb-1">
                  14-Day Sandbox Demo License Key
                </span>
                <label htmlFor="demo-license-email" className="mb-1 block text-[10px] text-slate-400">EMAIL FOR DEMO LICENSE</label>
                <input id="demo-license-email" type="email" value={demoEmail} onChange={(event) => setDemoEmail(event.target.value)} placeholder="you@example.com" className="mb-3 w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-xs text-white" />
                {loadingDemo ? (
                  <div className="py-2 text-xs text-emerald-300/60 animate-pulse">Persisting demo entitlement…</div>
                ) : generatedDemoKey ? (
                  <code className="block select-all text-sm font-bold text-emerald-400">{generatedDemoKey}</code>
                ) : (
                  <button type="button" onClick={() => void handleGenerateDemo(demoModalEa)} className="w-full rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-black disabled:opacity-50" disabled={!demoEmail.trim()}>Generate demo license</button>
                )}
                {demoError && <p role="alert" className="mt-2 text-[10px] leading-4 text-rose-300">{demoError}</p>}
                <span className="mt-1 block text-[9px] text-slate-500">
                  * 14-day demo entitlement only. Server validation blocks live accounts.
                </span>
              </div>

              <div className="space-y-2">
                <a
                  href={demoModalEa.demoDownloadUrl}
                  download={demoModalEa.demoFilename}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-xs font-bold text-black hover:bg-emerald-400 transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download {demoModalEa.demoFilename}
                </a>

                <a
                  href="/downloads/MacroLyncLicense.mqh"
                  download="MacroLyncLicense.mqh"
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 transition-colors"
                >
                  Download Cloud Gate Helper (MacroLyncLicense.mqh)
                </a>
              </div>

              <div className="rounded border border-white/5 bg-white/[0.02] p-2.5 text-[10px] text-slate-400 leading-relaxed">
                <strong>Quick MT5 Setup:</strong> Copy your EA into MT5 <code className="text-slate-300">MQL5/Experts</code>, copy the <code className="text-slate-300">.mqh</code> file into <code className="text-slate-300">MQL5/Include</code>, and whitelist <code className="text-emerald-400">https://fidulync.vercel.app</code> in MT5 Tools → Options → Expert Advisors → Allow WebRequest.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default QuantStrategyCatalog;
