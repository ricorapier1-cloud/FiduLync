import Link from 'next/link';
import { ArrowDownToLine, ArrowUpRight, BadgeCheck, ExternalLink, ShieldCheck } from 'lucide-react';

const listings = [
  {
    name: 'Nexus Adaptive EA',
    category: 'Expert Advisor · MT5',
    description: 'Trend-adaptive execution with volatility-aware exposure controls and configurable risk limits.',
    version: '2.4',
    price: '$49',
    metrics: [['Profit factor', '2.14'], ['Max drawdown', '8.6%'], ['Win rate', '74.2%']],
    curve: '0,93 17,88 33,92 50,73 68,78 84,62 102,68 119,47 136,53 153,31 169,37 187,16 205,24 223,7',
  },
  {
    name: 'Z-Score Envelope',
    category: 'Indicator · MT5',
    description: 'Volatility envelope indicator designed to highlight statistical price deviations across timeframes.',
    version: '1.1',
    price: '$25',
    metrics: [['Profit factor', '—'], ['Max drawdown', '—'], ['Win rate', '—']],
    curve: '0,83 17,69 33,78 50,55 68,62 84,37 102,47 119,27 136,43 153,20 169,30 187,12 205,22 223,8',
  },
];

const providers = ['Myfxbook', 'FXBlue', 'MT5 direct'];

function EquityCurve({ points, name }: { points: string; name: string }) {
  const pointList = points.split(' ').map((point) => point.split(',').map(Number));
  const polygon = `0,100 ${points} 223,100`;
  const path = pointList.map(([x, y], index) => `${index ? 'L' : 'M'} ${x} ${y}`).join(' ');

  return (
    <svg className="h-[110px] w-full overflow-visible" viewBox="0 0 223 104" role="img" aria-label={`${name} illustrative equity curve`}>
      <defs>
        <linearGradient id={`fill-${name.replace(/\W/g, '')}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#51e4c2" stopOpacity=".22" />
          <stop offset="100%" stopColor="#51e4c2" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[25, 50, 75].map((y) => <line key={y} x1="0" x2="223" y1={y} y2={y} stroke="rgba(170,190,195,.10)" strokeDasharray="3 5" />)}
      <polygon points={polygon} fill={`url(#fill-${name.replace(/\W/g, '')})`} />
      <path d={path} fill="none" stroke="#51e4c2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function AlgoLyncStorePage() {
  return (
    <div className="page-content">
      <header className="page-heading">
        <div>
          <div className="eyebrow flex items-center gap-2"><span className="status-dot" /> ALGOLYNC VERIFIED MARKETPLACE</div>
          <h1>Strategies, with the evidence attached.</h1>
          <p>Explore MetaTrader systems with transparent risk metrics and clearly attributed verification. Performance figures below are illustrative listing previews, not live account statements.</p>
        </div>
        <Link className="secondary-button" href="/create-link"><ShieldCheck size={15} /> Buy with escrow</Link>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-amber-300/10 bg-amber-200/[0.035] p-3 text-[10px] leading-5 text-amber-100/70">
        <BadgeCheck size={14} className="shrink-0 text-amber-200" />
        Listings require independent verification before provider badges can be marked verified. Sample metrics are illustrative and do not represent audited results.
      </div>

      <section className="grid gap-4 lg:grid-cols-2" aria-label="Expert advisor listings">
        {listings.map((listing) => (
          <article key={listing.name} className="panel overflow-hidden">
            <div className="border-b border-white/[0.06] p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="eyebrow">{listing.category}</div>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight">{listing.name}</h2>
                </div>
                <span className="mono rounded-lg border border-white/[0.07] bg-black/15 px-2.5 py-1.5 text-[10px] text-slate-400">v{listing.version}</span>
              </div>
              <p className="mt-3 min-h-10 text-xs leading-6 text-slate-400">{listing.description}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {providers.map((provider) => (
                  <span key={provider} className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.025] px-2.5 py-1 text-[9px] text-slate-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-500" /> {provider} · pending
                  </span>
                ))}
              </div>
            </div>

            <div className="px-5 pt-4 sm:px-6">
              <div className="flex items-center justify-between">
                <span className="metric-label">EQUITY CURVE · ILLUSTRATIVE</span>
                <span className="mono text-[9px] text-slate-600">SAMPLE</span>
              </div>
              <div className="mt-2"><EquityCurve points={listing.curve} name={listing.name} /></div>
            </div>

            <div className="grid grid-cols-3 gap-px border-y border-white/[0.06] bg-white/[0.06]">
              {listing.metrics.map(([label, value]) => (
                <div key={label} className="bg-[#0d131a] px-3 py-4 sm:px-5">
                  <div className="metric-label text-[9px]">{label}</div>
                  <div className={`mono mt-2 text-sm ${value === '—' ? 'text-slate-500' : 'text-slate-200'}`}>{value}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div><span className="text-xl font-semibold tracking-tight">{listing.price}</span><span className="ml-1.5 text-[10px] text-slate-500">single-account license</span></div>
              <div className="flex gap-2">
                <a className="secondary-button flex-1 sm:flex-none" href={`/api/download/demo?file=${encodeURIComponent(listing.name)}`}>
                  <ArrowDownToLine size={14} /> Demo docs
                </a>
                <Link className="primary-button flex-1 sm:flex-none" href="/create-link">Buy <ArrowUpRight size={14} /></Link>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="panel mt-5 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-emerald-300/15 bg-emerald-300/[0.07] text-[#51e4c2]"><ShieldCheck size={17} /></span>
          <div><h2 className="text-sm font-semibold">How performance is verified</h2><p className="mt-1 max-w-2xl text-[11px] leading-5 text-slate-500">Myfxbook and FXBlue submissions are reviewed by an administrator. MT5 investor credentials, when enabled, must be encrypted server-side and never requested through email or chat.</p></div>
        </div>
        <Link href="/support" className="secondary-button shrink-0">Verification details <ExternalLink size={13} /></Link>
      </section>

      <p className="mt-5 text-[10px] leading-5 text-slate-600">Trading involves substantial risk. Simulated or historical performance does not guarantee future results. This marketplace preview does not constitute investment advice.</p>
    </div>
  );
}
