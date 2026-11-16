'use client';

import { useEffect, useState } from 'react';

type Plan = { id: string; label: string; amount_minor: number; currency: 'USD' | 'NGN'; max_mt5_accounts: number };
type Product = {
  id: string; name: string; short_description: string; description: string; version: string;
  tier: string; platform: string; symbols: string[]; timeframes: string[]; evidence_status: string;
  sample_trade_count: number | null; profit_factor: number | null; max_drawdown_pct: number | null;
  win_rate_pct: number | null; sharpe_ratio: number | null; recovery_factor: number | null;
  risk_disclosure: string; ea_marketplace_plans: Plan[];
};
const evidence: Record<string, string> = {
  unverified: 'Unverified', backtest_only: 'Backtest only', demo_forward: 'Demo forward test',
  live_forward: 'Live forward test', independently_verified: 'Independently verified',
};
function money(minor: number, currency: string) {
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(minor / 100); }
  catch { return `${currency} ${(minor / 100).toFixed(2)}`; }
}
export function MarketplaceCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/v1/marketplace', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Unable to load marketplace.');
        setProducts(Array.isArray(payload.products) ? payload.products : []);
      })
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name === 'AbortError') return;
        setError('The marketplace catalogue is temporarily unavailable.');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);
  return (
    <section className="mt-11" aria-labelledby="marketplace-heading">
      <div className="rounded-xl border border-emerald-300/20 bg-[#0c1016] p-5 sm:p-7">
        <div className="font-mono text-[9px] tracking-[0.18em] text-emerald-300">ALGOLYNC / VERIFIED STRATEGY MARKETPLACE</div>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div><h2 id="marketplace-heading" className="text-xl font-semibold text-slate-100 sm:text-2xl">Quantitative EA Store</h2>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-400">Strategy listings disclose evidence levels and risk statistics. Historical results do not guarantee future performance.</p></div>
          <span className="rounded-md border border-white/10 px-2.5 py-1.5 font-mono text-[9px] text-slate-400">LIVE CATALOGUE</span>
        </div>
        {loading ? <p className="mt-6 text-xs text-slate-400">Loading published strategies…</p>
          : error ? <p role="status" className="mt-6 text-xs text-amber-200">{error}</p>
          : products.length === 0 ? <div className="mt-6 rounded-lg border border-dashed border-white/10 p-5">
            <p className="text-sm font-medium text-slate-200">No strategies have been approved for public sale yet.</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">Listings appear only after a seller submits product evidence and pricing and an authorised reviewer approves publication.</p>
          </div> : <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {products.map((p) => <article key={p.id} className="rounded-lg border border-white/[0.09] bg-[#080a0f] p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-base font-semibold text-slate-100">{p.name}</h3>
                <p className="mt-1 text-[10px] text-slate-500">{p.tier.toUpperCase()} · v{p.version} · {p.platform}</p></div>
                <span className="rounded border border-emerald-300/20 px-2 py-1 text-[9px] text-emerald-200">{evidence[p.evidence_status] ?? 'Unverified'}</span></div>
              <p className="mt-3 text-xs leading-5 text-slate-400">{p.short_description || p.description}</p>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {([['Profit factor', p.profit_factor], ['Max drawdown', p.max_drawdown_pct === null ? null : `${p.max_drawdown_pct}%`], ['Win rate', p.win_rate_pct === null ? null : `${p.win_rate_pct}%`], ['Trades', p.sample_trade_count], ['Sharpe', p.sharpe_ratio], ['Recovery', p.recovery_factor]] as [string, string | number | null][]).map(([label, value]) =>
                  <div key={label} className="rounded border border-white/[0.06] p-2"><div className="text-[9px] text-slate-500">{label}</div><div className="mt-1 font-mono text-xs text-slate-200">{value === null ? 'Not supplied' : value}</div></div>)}
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">{(p.symbols ?? []).slice(0, 8).map((x) => <span key={x} className="rounded bg-white/[0.05] px-2 py-1 font-mono text-[9px] text-slate-400">{x}</span>)}
                {(p.timeframes ?? []).slice(0, 5).map((x) => <span key={x} className="rounded bg-white/[0.05] px-2 py-1 font-mono text-[9px] text-slate-400">{x}</span>)}</div>
              <div className="mt-4 border-t border-white/[0.07] pt-3">{p.ea_marketplace_plans.length ? <div className="flex flex-wrap gap-2">
                {p.ea_marketplace_plans.map((plan) => <div key={plan.id} className="rounded border border-white/10 px-3 py-2"><div className="text-[9px] text-slate-500">{plan.label} · {plan.max_mt5_accounts} MT5 account(s)</div>
                  <div className="mt-1 font-mono text-sm text-slate-100">{money(plan.amount_minor, plan.currency)}</div></div>)}</div> : <p className="text-xs text-slate-500">Pricing is being finalised.</p>}</div>
              <p className="mt-3 text-[9px] leading-4 text-slate-500">{p.risk_disclosure}</p>
            </article>)}
          </div>}
      </div>
    </section>
  );
}
