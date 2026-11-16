'use client';

import { useMemo, useState } from 'react';

type StoreProduct = {
  id: string;
  name: string;
  kind: 'Sandbox EA' | 'Research EA' | 'Commercial strategy';
  status: 'Free download' | 'Research preview' | 'In development';
  platform: string;
  markets: string;
  timeframe: string;
  execution: string;
  risk: string;
  summary: string;
  includes: string[];
  download?: string;
  external?: string;
  note: string;
};

const PRODUCTS: StoreProduct[] = [
  {
    id: 'ma-crossover-lab',
    name: 'AlgoLync Moving Average Lab',
    kind: 'Sandbox EA',
    status: 'Free download',
    platform: 'MetaTrader 5 · MQL5 source',
    markets: 'Any symbol with broker data',
    timeframe: 'Any chart timeframe',
    execution: 'Analysis only — places no orders',
    risk: 'No trade execution',
    summary: 'A small original learning EA that reads two moving averages, detects a crossover on a closed candle and displays the result on the chart. Designed to test downloading, importing, compiling and attaching an EA.',
    includes: ['Readable .mq5 source', 'Closed-candle signal detection', 'Chart status and diagnostic messages', 'No external libraries or API keys'],
    download: '/downloads/AlgoLync_Moving_Average_Lab.mq5',
    note: 'Original FiduLync sandbox code. Not a trading strategy and has no performance record.',
  },
  {
    id: 'atr-regime-lab',
    name: 'AlgoLync ATR Regime Lab',
    kind: 'Sandbox EA',
    status: 'Free download',
    platform: 'MetaTrader 5 · MQL5 source',
    markets: 'Any symbol with broker data',
    timeframe: 'Any chart timeframe',
    execution: 'Analysis only — places no orders',
    risk: 'No trade execution',
    summary: 'An original volatility-observation EA that measures ATR and compares it with a rolling baseline. It labels the current environment as quieter, typical or expanded and writes the reading to the chart.',
    includes: ['Readable .mq5 source', 'ATR volatility baseline', 'Closed-bar calculations', 'No external libraries or API keys'],
    download: '/downloads/AlgoLync_ATR_Regime_Lab.mq5',
    note: 'Original FiduLync sandbox code. Not a trading strategy and has no performance record.',
  },
  {
    id: 'external-mt5-labs',
    name: 'Community Open-Source MT5 EAs',
    kind: 'Research EA',
    status: 'Research preview',
    platform: 'MetaTrader 5 · GitHub source',
    markets: 'Varies by project',
    timeframe: 'Varies by project',
    execution: 'Varies — inspect each source first',
    risk: 'Unreviewed third-party code',
    summary: 'A link to an external collection of open-source MT5 strategy examples. FiduLync does not mirror, modify, certify or redistribute these files. Review the repository and licence for each project before using it.',
    includes: ['External source repository', 'Strategy examples for study', 'Repository-level licence information', 'Independent user review required'],
    external: 'https://github.com/geraked/metatrader5',
    note: 'Third-party repository. Not owned, audited or supported by FiduLync.',
  },
  {
    id: 'eridam-nexus',
    name: 'Eridam Nexus Adaptive',
    kind: 'Commercial strategy',
    status: 'In development',
    platform: 'MetaTrader 5 · planned',
    markets: 'To be published after validation',
    timeframe: 'To be published after validation',
    execution: 'Not available for purchase',
    risk: 'No verified risk statistics published',
    summary: 'Planned multi-regime quantitative strategy. The production build, compatibility matrix and independent test evidence are not yet published.',
    includes: ['Product specification in progress', 'Broker and account-mode validation pending', 'Backtest and forward-test evidence pending', 'Customer documentation pending'],
    note: 'Preview listing only. No live performance claim or downloadable production binary.',
  },
  {
    id: 'velocity-vault',
    name: 'Velocity Vault Momentum',
    kind: 'Commercial strategy',
    status: 'In development',
    platform: 'MetaTrader 5 · planned',
    markets: 'To be published after validation',
    timeframe: 'To be published after validation',
    execution: 'Not available for purchase',
    risk: 'No verified risk statistics published',
    summary: 'Planned intraday momentum strategy. It will be listed for sale only after compilation, realistic tick backtesting, forward testing and risk documentation are complete.',
    includes: ['Product specification in progress', 'Broker and account-mode validation pending', 'Backtest and forward-test evidence pending', 'Customer documentation pending'],
    note: 'Preview listing only. No live performance claim or downloadable production binary.',
  },
];

const FILTERS = ['All products', 'Free download', 'Research preview', 'In development'] as const;

export function QuantStrategyCatalog() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All products');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const visible = useMemo(() => PRODUCTS.filter((item) => {
    const matchesFilter = filter === 'All products' || item.status === filter;
    const haystack = [item.name, item.kind, item.summary, item.markets, item.platform].join(' ').toLowerCase();
    return matchesFilter && haystack.includes(query.trim().toLowerCase());
  }), [filter, query]);

  return (
    <section className="w-full" aria-labelledby="algolync-catalog-heading">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <div className="font-mono text-[10px] tracking-[0.18em] text-emerald-300">ALGOLYNC / EA MARKETPLACE</div>
          <h2 id="algolync-catalog-heading" className="mt-2 text-2xl font-semibold tracking-tight text-white">Explore quantitative tools</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Clear product status, honest evidence labels and direct access to source files. No simulated returns or unverified performance figures.</p>
        </div>
        <div className="rounded-lg border border-white/[0.09] bg-white/[0.03] px-3 py-2 text-right">
          <div className="font-mono text-[9px] tracking-wider text-slate-500">CATALOGUE</div>
          <div className="mt-1 text-lg font-semibold text-white">{PRODUCTS.length} <span className="text-xs font-normal text-slate-500">listings</span></div>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="block">
          <span className="sr-only">Search products</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search EAs, markets or platform…" className="h-11 w-full rounded-lg border border-white/[0.1] bg-[#0b1017] px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-300/50" />
        </label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter products">
          {FILTERS.map((item) => (
            <button key={item} type="button" onClick={() => setFilter(item)} aria-pressed={filter === item} className={`rounded-lg border px-3 py-2 text-[11px] transition ${filter === item ? 'border-emerald-300/50 bg-emerald-300/10 text-emerald-200' : 'border-white/[0.1] bg-white/[0.03] text-slate-400 hover:text-white'}`}>
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {visible.map((item) => {
          const isFree = item.status === 'Free download';
          const isExternal = Boolean(item.external);
          const isExpanded = expanded === item.id;
          return (
            <article key={item.id} className="flex flex-col rounded-xl border border-white/[0.09] bg-[#0c1118] p-5 transition hover:border-emerald-300/25">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-md border border-white/[0.1] bg-white/[0.04] px-2.5 py-1 font-mono text-[9px] tracking-wider text-slate-300">{item.kind.toUpperCase()}</span>
                <span className={`rounded-md border px-2.5 py-1 font-mono text-[9px] tracking-wider ${isFree ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200' : item.status === 'In development' ? 'border-amber-300/25 bg-amber-300/[0.07] text-amber-200' : 'border-sky-300/25 bg-sky-300/[0.07] text-sky-200'}`}>{item.status.toUpperCase()}</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">{item.name}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{item.summary}</p>

              <dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-white/[0.07] bg-black/20 p-3 text-xs">
                <div><dt className="text-[9px] tracking-wider text-slate-500">PLATFORM</dt><dd className="mt-1 text-slate-200">{item.platform}</dd></div>
                <div><dt className="text-[9px] tracking-wider text-slate-500">MARKETS</dt><dd className="mt-1 text-slate-200">{item.markets}</dd></div>
                <div><dt className="text-[9px] tracking-wider text-slate-500">TIMEFRAME</dt><dd className="mt-1 text-slate-200">{item.timeframe}</dd></div>
                <div><dt className="text-[9px] tracking-wider text-slate-500">EXECUTION</dt><dd className="mt-1 text-slate-200">{item.execution}</dd></div>
              </dl>

              <div className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs">
                <span className="text-slate-500">Risk / evidence: </span><span className="text-slate-200">{item.risk}</span>
              </div>

              {isExpanded && (
                <div className="mt-4 rounded-lg border border-white/[0.07] bg-black/20 p-3">
                  <h4 className="font-mono text-[9px] tracking-wider text-slate-400">WHAT'S INCLUDED</h4>
                  <ul className="mt-2 space-y-2 text-xs text-slate-300">
                    {item.includes.map((feature) => <li key={feature} className="flex gap-2"><span className="text-emerald-300">•</span>{feature}</li>)}
                  </ul>
                  <p className="mt-3 border-t border-white/[0.07] pt-3 text-[11px] leading-5 text-slate-500">{item.note}</p>
                </div>
              )}

              <div className="mt-auto flex flex-wrap gap-2 pt-5">
                <button type="button" onClick={() => setExpanded(isExpanded ? null : item.id)} className="min-h-10 flex-1 rounded-lg border border-white/[0.12] px-3 text-xs text-slate-200 transition hover:bg-white/[0.06]">
                  {isExpanded ? 'Hide details' : 'Product details'}
                </button>
                {item.download && (
                  <a href={item.download} download className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg bg-emerald-300 px-3 text-xs font-semibold text-[#07120d] transition hover:bg-emerald-200">Download free .mq5</a>
                )}
                {item.external && (
                  <a href={item.external} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg border border-sky-300/30 bg-sky-300/[0.08] px-3 text-xs font-semibold text-sky-200 transition hover:bg-sky-300/[0.14]">Open source repository ↗</a>
                )}
                {item.status === 'In development' && <span className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg border border-amber-300/20 px-3 text-xs text-amber-200">Not yet for sale</span>}
              </div>
            </article>
          );
        })}
      </div>

      {visible.length === 0 && <p className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-6 text-center text-sm text-slate-500">No products match that search. Try another term or filter.</p>}

      <div className="mt-5 rounded-xl border border-white/[0.08] bg-[#0a0f15] p-4 text-xs leading-5 text-slate-400">
        <strong className="text-slate-200">Performance disclosure.</strong> FiduLync does not publish win rates, profit factors, Sharpe ratios or drawdowns until the figures are supported by reproducible test reports. Past performance does not guarantee future results. Test source EAs on a demo account; they are educational diagnostics and do not place trades.
      </div>
    </section>
  );
}

export default QuantStrategyCatalog;
