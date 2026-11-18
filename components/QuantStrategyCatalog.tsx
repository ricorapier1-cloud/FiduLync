'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';

type Metrics = {
  win_rate?: string; profit_factor?: string; sharpe?: string; max_drawdown?: string;
  equity_curve?: number[]; provenance?: string;
};
type Product = {
  slug: string; name: string; tagline: string; version: string; category: string;
  monthly_price_ngn: number; monthly_price_usd: number; annual_price_ngn: number; annual_price_usd: number;
  extra_seat_price_ngn: number; extra_seat_price_usd: number; demo_days: number;
  included_live_seats: number; included_demo_seats: number; metrics_json: Metrics;
  ex5_artifact_url: string | null;
};
type Cycle = 'MONTHLY' | 'ANNUAL';
type Currency = 'NGN' | 'USD';

function Sparkline({ values }: { values: number[] }) {
  if (!values || values.length < 2) return <div className="mt-4 flex h-14 items-center rounded-lg border border-white/[0.06] px-3 text-[10px] text-slate-500">Equity curve not published</div>;
  const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 300},${52 - ((value - min) / range) * 44}`).join(' ');
  return <div className="mt-4 rounded-lg border border-white/[0.06] bg-black/30 p-2"><div className="mb-1 font-mono text-[9px] tracking-wider text-slate-500">REFERENCE EQUITY CURVE</div><svg viewBox="0 0 300 56" className="h-14 w-full" role="img" aria-label="Reference equity curve"><polyline points={points} fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></div>;
}

export function QuantStrategyCatalog({ onSelectEa }: { onSelectEa?: (slug: string, cycle: Cycle, currency: Currency) => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('ALL');
  const [cycle, setCycle] = useState<Cycle>('MONTHLY');
  const [currency, setCurrency] = useState<Currency>('NGN');
  const [demoProduct, setDemoProduct] = useState<Product | null>(null);
  const [email, setEmail] = useState('');
  const [mt5Login, setMt5Login] = useState('');
  const [demoKey, setDemoKey] = useState('');
  const [demoDownload, setDemoDownload] = useState('');
  const [demoError, setDemoError] = useState('');
  const [demoBusy, setDemoBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/v1/products', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Catalogue unavailable.');
        if (active) setProducts(data.products || []);
      })
      .catch((error) => { if (active) setDemoError(error instanceof Error ? error.message : 'Catalogue unavailable.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const categories = useMemo(() => ['ALL', ...Array.from(new Set(products.map((item) => item.category)))], [products]);
  const visible = products.filter((item) => category === 'ALL' || item.category === category);
  const price = (item: Product) => currency === 'NGN'
    ? (cycle === 'MONTHLY' ? item.monthly_price_ngn : item.annual_price_ngn)
    : (cycle === 'MONTHLY' ? item.monthly_price_usd : item.annual_price_usd);
  const money = (amount: number) => currency === 'NGN' ? `₦${amount.toLocaleString('en-NG')}` : `$${amount.toLocaleString('en-US')}`;

  async function requestDemo(event: FormEvent) {
    event.preventDefault();
    if (!demoProduct) return;
    setDemoBusy(true); setDemoError(''); setDemoKey(''); setDemoDownload('');
    try {
      const response = await fetch('/api/v1/provision-demo-license', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, mt5_login: mt5Login, ea_slug: demoProduct.slug }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Demo request was not completed.');
      setDemoKey(result.license_key);
      setDemoDownload(result.download_url);
    } catch (error) {
      setDemoError(error instanceof Error ? error.message : 'Demo request failed.');
    } finally { setDemoBusy(false); }
  }

  return <div className="w-full">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] pb-5">
      <div><div className="font-mono text-[10px] tracking-[0.18em] text-emerald-300">ALGOLYNC / STRATEGY MARKETPLACE</div><h2 className="mt-2 text-2xl font-semibold">Quantitative EA catalogue</h2><p className="mt-1 text-xs text-slate-400">Product pricing and availability are read from the live catalogue in Supabase.</p></div>
      <div className="flex flex-wrap gap-2">
        <div className="flex rounded-lg border border-white/10 bg-black/30 p-1">{(['MONTHLY', 'ANNUAL'] as const).map((value) => <button key={value} type="button" onClick={() => setCycle(value)} className={`rounded px-3 py-2 text-[10px] font-semibold ${cycle === value ? 'bg-emerald-300 text-slate-950' : 'text-slate-400'}`}>{value === 'ANNUAL' ? 'Annual · 2 months free' : 'Monthly'}</button>)}</div>
        <div className="flex rounded-lg border border-white/10 bg-black/30 p-1">{(['NGN', 'USD'] as const).map((value) => <button key={value} type="button" onClick={() => setCurrency(value)} className={`rounded px-3 py-2 text-[10px] font-semibold ${currency === value ? 'bg-cyan-300 text-slate-950' : 'text-slate-400'}`}>{value === 'NGN' ? '₦ NGN' : '$ USD'}</button>)}</div>
      </div>
    </div>
    <div className="mb-5 flex flex-wrap gap-2">{categories.map((value) => <button key={value} type="button" onClick={() => setCategory(value)} className={`rounded-full border px-3 py-1.5 text-[10px] font-mono ${category === value ? 'border-emerald-300/50 bg-emerald-300/10 text-emerald-200' : 'border-white/10 text-slate-400'}`}>{value === 'ALL' ? 'All strategies' : value.replaceAll('_', ' ')}</button>)}</div>
    {loading && <p className="py-12 text-center text-xs text-slate-500">Loading live EA catalogue…</p>}
    {!loading && visible.length === 0 && <p className="py-12 text-center text-xs text-slate-500">No active strategies are currently published.</p>}
    <div className="grid gap-4 md:grid-cols-2">
      {visible.map((item) => {
        const metrics = item.metrics_json || {};
        const isSandbox = item.category.toUpperCase() === 'SANDBOX' || price(item) === 0;
        return <article key={item.slug} className="flex flex-col rounded-xl border border-white/[0.09] bg-[#0c1017] p-5">
          <div className="flex items-center justify-between gap-2"><span className="rounded border border-emerald-300/20 bg-emerald-300/[0.07] px-2 py-1 font-mono text-[9px] text-emerald-200">{item.category}</span><span className="font-mono text-[10px] text-slate-500">v{item.version}</span></div>
          <h3 className="mt-3 text-lg font-semibold text-white">{item.name}</h3><p className="mt-1 text-xs text-slate-400">{item.tagline}</p>
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-black/30 p-3 font-mono">
            {[['Win rate', metrics.win_rate || '—'], ['Profit factor', metrics.profit_factor || '—'], ['Sharpe', metrics.sharpe || '—'], ['Max drawdown', metrics.max_drawdown || '—']].map(([label, value]) => <div key={label}><div className="text-[9px] text-slate-500">{label}</div><div className="mt-1 text-sm text-slate-200">{value}</div></div>)}
          </div>
          <Sparkline values={metrics.equity_curve || []} />
          <p className="mt-2 text-[9px] leading-4 text-slate-500">{metrics.provenance || 'Performance metrics are not yet verified.'}</p>
          <div className="mt-4 flex items-end justify-between gap-3 border-t border-white/[0.07] pt-4"><div><div className="font-mono text-[9px] text-slate-500">{isSandbox ? 'SANDBOX' : cycle + ' SUBSCRIPTION'}</div><div className="mt-1 text-xl font-semibold text-white">{money(price(item))}<span className="ml-1 text-[10px] font-normal text-slate-500">{isSandbox ? 'free' : cycle === 'MONTHLY' ? '/ month' : '/ year'}</span></div><div className="mt-1 text-[9px] text-slate-500">{item.included_live_seats} live · {item.included_demo_seats} demo seats included</div></div><div className="flex flex-col gap-2">
            {item.ex5_artifact_url ? <button type="button" onClick={() => { setDemoProduct(item); setDemoKey(''); setDemoError(''); }} className="rounded-lg border border-white/15 px-3 py-2 text-[10px] font-semibold text-slate-200 hover:border-emerald-300/40">Get Free Demo (.ex5)</button> : <span className="rounded-lg border border-white/10 px-3 py-2 text-center text-[10px] text-slate-500">EX5 not published</span>}
            {!isSandbox && <button type="button" onClick={() => onSelectEa?.(item.slug, cycle, currency)} className="rounded-lg bg-emerald-300 px-3 py-2 text-[10px] font-bold text-slate-950">Subscribe Live</button>}
          </div></div>
        </article>;
      })}
    </div>

    {demoProduct && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Request free EA demo">
      <form onSubmit={requestDemo} className="w-full max-w-md rounded-2xl border border-emerald-300/30 bg-[#09120f] p-6 shadow-2xl">
        <div className="flex items-center justify-between"><div><div className="font-mono text-[9px] tracking-wider text-emerald-300">14-DAY DEMO REQUEST</div><h3 className="mt-2 text-lg font-semibold">{demoProduct.name}</h3></div><button type="button" onClick={() => setDemoProduct(null)} className="text-slate-400">✕</button></div>
        {!demoKey ? <>
          <label className="mt-5 block text-xs text-slate-400">Email address<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 h-11 w-full rounded border border-white/10 bg-black/30 px-3 text-sm text-white" placeholder="you@example.com" /></label>
          <label className="mt-3 block text-xs text-slate-400">MT5 Demo login<input required inputMode="numeric" value={mt5Login} onChange={(e) => setMt5Login(e.target.value)} className="mt-2 h-11 w-full rounded border border-white/10 bg-black/30 px-3 font-mono text-sm text-white" placeholder="Actual demo account login" /></label>
          <p className="mt-3 text-[10px] leading-5 text-slate-500">One demo per email per EA and one demo per MT5 login. Demo keys are restricted to demo accounts.</p>
          {demoError && <p role="alert" className="mt-3 text-xs text-rose-300">{demoError}</p>}
          <button disabled={demoBusy} className="mt-5 w-full rounded-lg bg-emerald-300 px-4 py-3 text-xs font-bold text-slate-950 disabled:opacity-50">{demoBusy ? 'Checking eligibility…' : 'Request demo license'}</button>
        </> : <div className="mt-5"><p className="text-xs text-emerald-200">Demo license issued.</p><code className="mt-3 block break-all rounded bg-black/40 p-3 text-sm text-emerald-300">{demoKey}</code><a href={demoDownload} className="mt-4 block rounded-lg bg-emerald-300 px-4 py-3 text-center text-xs font-bold text-slate-950">Download demo EA (.ex5)</a></div>}
      </form>
    </div>}
  </div>;
}
