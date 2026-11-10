import Link from 'next/link';
import { connection } from 'next/server';
import { ArrowUpRight, BadgeCheck, ShieldCheck } from 'lucide-react';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

type PublicListing = {
  id: string;
  slug: string;
  name: string;
  category?: string | null;
  description: string;
  version: string | null;
  currency: string;
  price: number;
  profit_factor: number | null;
  max_drawdown_pct: number | null;
  win_rate_pct: number | null;
  myfxbook_status: string;
  fxblue_status: string;
  mt5_sync_status: string;
  verification_status: string;
};

function metric(value: number | null, suffix = '') {
  return value !== null && Number.isFinite(value) ? `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}` : 'Not published';
}

function providerStatus(status: string) {
  if (status === 'verified' || status === 'approved') return 'Verified';
  if (status === 'rejected') return 'Rejected';
  if (status === 'pending') return 'Pending review';
  return 'Not verified';
}

export default async function AlgoLyncStorePage() {
  await connection();

  const { data: listings, error } = await getSupabaseAdmin()
    .from('ea_listings')
    .select('id,slug,name,description,version,currency,price,profit_factor,max_drawdown_pct,win_rate_pct,myfxbook_status,fxblue_status,mt5_sync_status,verification_status')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .returns<PublicListing[]>();

  if (error) {
    console.error('Unable to load published AlgoLync listings:', error);
    throw new Error('Unable to load the AlgoLync marketplace.');
  }

  return (
    <div className="page-content">
      <header className="page-heading">
        <div>
          <div className="eyebrow flex items-center gap-2"><span className="status-dot" /> ALGOLYNC MARKETPLACE</div>
          <h1>Strategies, with the evidence attached.</h1>
          <p>Published MetaTrader systems and verification states are loaded from the marketplace database. Metrics are shown only when recorded for a listing.</p>
        </div>
        <Link className="secondary-button" href="/create-link"><ShieldCheck size={15} /> Create an escrow</Link>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-amber-300/10 bg-amber-200/[0.035] p-3 text-[10px] leading-5 text-amber-100/70">
        <BadgeCheck size={14} className="shrink-0 text-amber-200" />
        Verification identifies reviewed evidence sources; it does not guarantee performance or future results.
      </div>

      {listings.length === 0 ? (
        <section className="panel p-8 text-center" aria-live="polite">
          <h2 className="font-semibold">No published products are available</h2>
          <p className="mt-2 text-sm text-slate-400">New products will appear here after they are added and published by their owners.</p>
        </section>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2" aria-label="Published AlgoLync listings">
          {listings.map((listing) => {
            const verified = listing.verification_status === 'verified';
            const metrics = [
              ['Profit factor', metric(listing.profit_factor)],
              ['Max drawdown', metric(listing.max_drawdown_pct, '%')],
              ['Win rate', metric(listing.win_rate_pct, '%')],
            ];
            return (
              <article key={listing.id} className="panel overflow-hidden">
                <div className="border-b border-white/[0.06] p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="eyebrow">{verified ? 'VERIFIED LISTING' : 'UNVERIFIED LISTING'}</div>
                      <h2 className="mt-2 text-xl font-semibold tracking-tight">{listing.name}</h2>
                    </div>
                    {listing.version && <span className="mono rounded-lg border border-white/[0.07] bg-black/15 px-2.5 py-1.5 text-[10px] text-slate-400">v{listing.version}</span>}
                  </div>
                  <p className="mt-3 text-xs leading-6 text-slate-400">{listing.description}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {[
                      ['Myfxbook', listing.myfxbook_status],
                      ['FXBlue', listing.fxblue_status],
                      ['MT5', listing.mt5_sync_status],
                    ].map(([provider, status]) => (
                      <span key={provider} className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.025] px-2.5 py-1 text-[9px] text-slate-400">
                        <span className={`h-1.5 w-1.5 rounded-full ${providerStatus(status) === 'Verified' ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                        {provider} · {providerStatus(status)}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-px border-y border-white/[0.06] bg-white/[0.06]">
                  {metrics.map(([label, value]) => (
                    <div key={label} className="bg-[#0d131a] px-3 py-4 sm:px-5">
                      <div className="metric-label text-[9px]">{label}</div>
                      <div className={`mono mt-2 text-sm ${value === 'Not published' ? 'text-slate-500' : 'text-slate-200'}`}>{value}</div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div>
                    <span className="text-xl font-semibold tracking-tight">
                      {listing.currency} {Number(listing.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="ml-1.5 text-[10px] text-slate-500">listed price</span>
                  </div>
                  <Link className="primary-button flex-1 sm:flex-none" href="/create-link">
                    Start an escrow <ArrowUpRight size={14} />
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <section className="panel mt-5 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-emerald-300/15 bg-emerald-300/[0.07] text-[#51e4c2]"><ShieldCheck size={17} /></span>
          <div><h2 className="text-sm font-semibold">How performance is verified</h2><p className="mt-1 max-w-2xl text-[11px] leading-5 text-slate-500">Myfxbook and FXBlue submissions are reviewed by an administrator. MT5 credentials are encrypted server-side and are never requested through email or chat.</p></div>
        </div>
        <Link href="/support" className="secondary-button shrink-0">Verification details <ArrowUpRight size={13} /></Link>
      </section>

      <p className="mt-5 text-[10px] leading-5 text-slate-600">Trading involves substantial risk. Historical performance does not guarantee future results.</p>
    </div>
  );
}
