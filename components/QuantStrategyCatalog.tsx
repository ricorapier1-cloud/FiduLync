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

export function QuantStrategyCatalog({ products }: { products?: EaProduct[] }) {
  const catalog = products?.length ? products : EA_CATALOG;
  const [categoryFilter, setCategoryFilter] = useState<'ALL'|'FLAGSHIP'|'MOMENTUM'|'SANDBOX'>('ALL');
  const visibleCatalog = categoryFilter === 'ALL' ? catalog : catalog.filter(product => product.tierCategory === categoryFilter);
  const [demoModalEa, setDemoModalEa] = useState<EaProduct | null>(null);
  const [generatedDemoKey, setGeneratedDemoKey] = useState<string | null>(null);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [demoEmail, setDemoEmail] = useState('');
  const [demoLogin, setDemoLogin] = useState('');
  const [demoError, setDemoError] = useState('');
  const [demoDownloadUrl, setDemoDownloadUrl] = useState('');
  const [checkoutEa, setCheckoutEa] = useState<EaProduct | null>(null);
  const [checkoutEmail, setCheckoutEmail] = useState('');
  const [billingCycle, setBillingCycle] = useState<'MONTHLY'|'ANNUAL'>('MONTHLY');
  const [checkoutCurrency, setCheckoutCurrency] = useState<'NGN'|'USD'>('NGN');
  const [extraSeats, setExtraSeats] = useState(0);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  const submitSubscription = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!checkoutEa) return;
    setCheckoutBusy(true);
    setCheckoutError('');
    try {
      const response = await fetch('/api/v1/subscriptions/checkout', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({email:checkoutEmail,ea_slug:checkoutEa.slug,billing_cycle:billingCycle,currency:checkoutCurrency,extra_live_seats:extraSeats}),
      });
      const result = await response.json();
      if (!response.ok || !result.success || !result.authorization_url) throw new Error(result.error || 'Checkout could not be initialized.');
      window.location.assign(result.authorization_url);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Subscription checkout unavailable.');
    } finally { setCheckoutBusy(false); }
  };

  const handleGenerateDemo = (ea: EaProduct) => {
    setDemoModalEa(ea);
    setGeneratedDemoKey(null);
    setDemoDownloadUrl('');
    setDemoError('');
  };

  const submitDemoRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!demoModalEa) return;
    setLoadingDemo(true);
    setDemoError('');
    try {
      const res = await fetch('/api/v1/demo-license', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ea_slug: demoModalEa.slug, email: demoEmail, mt5_login: demoLogin }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.license_key || !data.download_url) {
        throw new Error(data.error || 'Demo could not be provisioned.');
      }
      setGeneratedDemoKey(data.license_key);
      setDemoDownloadUrl(data.download_url);
    } catch (error) {
      setDemoError(error instanceof Error ? error.message : 'Demo service unavailable.');
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

      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.08] bg-[#0c1017] p-3">
        {([['ALL','All strategies'],['FLAGSHIP','Flagship'],['MOMENTUM','Momentum'],['SANDBOX','Sandbox']] as const).map(([value,label]) =>
          <button key={value} type="button" onClick={()=>setCategoryFilter(value)} className={`rounded-lg border px-3 py-2 text-[10px] font-semibold ${categoryFilter===value?'border-emerald-300/40 bg-emerald-300/10 text-emerald-200':'border-white/10 text-slate-400 hover:text-white'}`}>{label}</button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {visibleCatalog.map((strategy) => {
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

                {/* Telemetry and Stats Grid */}
                <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-white/[0.05] bg-black/30 p-2.5 font-mono text-[11px]">
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
                {/* Button A: Instant 1-Click Demo Key & Download */}
                {strategy.tierCategory !== 'SANDBOX' && (strategy.artifactReady ? (
                  <button
                    type="button"
                    onClick={() => handleGenerateDemo(strategy)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-slate-200 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
                  >
                    <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    Get Free Demo (.ex5)
                  </button>
                ) : <button type="button" disabled className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2.5 text-xs text-slate-500">Demo release pending</button>)}

                {/* Button B: Provision Real EA License (Anchored to checkout) */}
                {strategy.tierCategory === 'SANDBOX' ? (
                  <a href={strategy.demoDownloadUrl} download={strategy.demoFilename} className="flex w-full items-center justify-center rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-xs font-semibold text-amber-200">Download Open-Source Sandbox (.mq5)</a>
                ) : strategy.artifactReady ? (
                  <button type="button" onClick={() => { setCheckoutEa(strategy); setCheckoutError(''); }} className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-4 py-2.5 text-xs font-bold text-emerald-300 transition-all hover:bg-emerald-500 hover:text-black">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    Subscribe Live
                  </button>
                ) : <button type="button" disabled className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2.5 text-xs text-slate-500">Commercial release pending</button>}
              </div>
            </article>
          );
        })}
      </div>

      {/* 1-CLICK DEMO PROVISIONING MODAL */}
      {demoModalEa && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setDemoModalEa(null)}>
          <section role="dialog" aria-modal="true" aria-labelledby="demo-title" className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b1119] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div><p className="font-mono text-[10px] tracking-widest text-emerald-300">ALGOLYNC / DEMO ACCESS</p><h3 id="demo-title" className="mt-1 text-lg font-semibold text-white">Get a free 14-day demo</h3></div>
              <button type="button" onClick={() => setDemoModalEa(null)} className="text-slate-400 hover:text-white" aria-label="Close">✕</button>
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-400">{demoModalEa.name} is locked to the MT5 demo account login you provide. One demo per email/EA and one per MT5 login.</p>
            {!generatedDemoKey ? (
              <form onSubmit={submitDemoRequest} className="mt-5 space-y-3">
                <label className="block text-xs text-slate-400">Email address<input required type="email" autoComplete="email" value={demoEmail} onChange={event=>setDemoEmail(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white" placeholder="you@example.com"/></label>
                <label className="block text-xs text-slate-400">MT5 demo account login<input required inputMode="numeric" pattern="[0-9]+" value={demoLogin} onChange={event=>setDemoLogin(event.target.value.replace(/\D/g,''))} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 font-mono text-sm text-white" placeholder="Demo account number"/></label>
                {demoError && <p role="alert" className="rounded-lg border border-rose-400/20 bg-rose-400/5 p-3 text-xs text-rose-300">{demoError}</p>}
                <button disabled={loadingDemo} className="h-11 w-full rounded-lg bg-emerald-300 px-4 text-sm font-semibold text-[#07120d] disabled:opacity-50">{loadingDemo?'Checking eligibility…':'Create demo license'}</button>
              </form>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-4"><p className="font-mono text-[10px] text-emerald-300">DEMO KEY · 14 DAYS</p><code className="mt-2 block select-all break-all text-sm font-bold text-white">{generatedDemoKey}</code><p className="mt-2 text-[10px] text-slate-400">Authorized for the registered demo login only. Real-account mode is rejected server-side.</p></div>
                <a href={demoDownloadUrl} className="flex h-11 items-center justify-center rounded-lg bg-emerald-300 px-4 text-sm font-semibold text-[#07120d]">Download verified demo (.ex5)</a>
              </div>
            )}
            <p className="mt-4 text-[10px] leading-5 text-slate-500">A compiled demo artifact must be published and approved before the server issues a key. No placeholder keys or source-code binaries are generated.</p>
          </section>
        </div>
      )}
      {checkoutEa && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-black/75 backdrop-blur-sm" onClick={()=>setCheckoutEa(null)}>
          <section role="dialog" aria-modal="true" aria-labelledby="checkout-title" className="h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-[#0b1119] p-6 shadow-2xl" onClick={event=>event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div><p className="font-mono text-[10px] tracking-widest text-emerald-300">ALGOLYNC / SECURE CHECKOUT</p><h3 id="checkout-title" className="mt-1 text-xl font-semibold text-white">Subscribe to {checkoutEa.name}</h3></div>
              <button type="button" onClick={()=>setCheckoutEa(null)} aria-label="Close checkout" className="text-slate-400">✕</button>
            </div>
            <form onSubmit={submitSubscription} className="mt-6 space-y-5">
              <label className="block text-xs text-slate-400">Billing email<input required type="email" value={checkoutEmail} onChange={event=>setCheckoutEmail(event.target.value)} placeholder="you@example.com" className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"/></label>
              <div><p className="mb-2 text-xs text-slate-400">Billing cycle</p><div className="grid grid-cols-2 gap-2"><button type="button" onClick={()=>setBillingCycle('MONTHLY')} className={`h-10 rounded-lg border text-xs ${billingCycle==='MONTHLY'?'border-emerald-300 bg-emerald-300/10 text-emerald-200':'border-white/10 text-slate-400'}`}>Monthly</button><button type="button" onClick={()=>setBillingCycle('ANNUAL')} className={`h-10 rounded-lg border text-xs ${billingCycle==='ANNUAL'?'border-emerald-300 bg-emerald-300/10 text-emerald-200':'border-white/10 text-slate-400'}`}>Annual · 2 months free</button></div></div>
              <div><p className="mb-2 text-xs text-slate-400">Currency</p><div className="grid grid-cols-2 gap-2"><button type="button" onClick={()=>setCheckoutCurrency('NGN')} className={`h-10 rounded-lg border text-xs ${checkoutCurrency==='NGN'?'border-emerald-300 bg-emerald-300/10 text-emerald-200':'border-white/10 text-slate-400'}`}>NGN ₦</button><button type="button" onClick={()=>setCheckoutCurrency('USD')} className={`h-10 rounded-lg border text-xs ${checkoutCurrency==='USD'?'border-emerald-300 bg-emerald-300/10 text-emerald-200':'border-white/10 text-slate-400'}`}>USD $</button></div></div>
              <label className="block text-xs text-slate-400">Extra live account seats<select value={extraSeats} onChange={event=>setExtraSeats(Number(event.target.value))} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"><option value={0}>No extra seats</option><option value={1}>+1 seat</option><option value={3}>+3 seats</option><option value={5}>+5 seats</option></select><span className="mt-1 block text-[10px] text-slate-500">Includes 1 live and 2 demo seats where the product entitlement supports them.</span></label>
              {checkoutError && <p role="alert" className="rounded-lg border border-rose-400/20 bg-rose-400/5 p-3 text-xs text-rose-300">{checkoutError}</p>}
              <button disabled={checkoutBusy} className="h-12 w-full rounded-lg bg-emerald-300 px-4 text-sm font-semibold text-[#07120d] disabled:opacity-50">{checkoutBusy?'Connecting to Paystack…':'Continue to Paystack'}</button>
              <p className="text-[10px] leading-5 text-slate-500">MT5 login is optional at checkout. Bind accounts later in your private portal. Recurring billing is managed by Paystack.</p>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default QuantStrategyCatalog;
