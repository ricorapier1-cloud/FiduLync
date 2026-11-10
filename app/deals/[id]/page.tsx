import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Clock, ShieldCheck } from 'lucide-react';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

const knownStatuses = new Set(['pending', 'funded', 'disputed', 'settling', 'released', 'refunded', 'cancelled']);

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: deal, error } = await getSupabaseAdmin()
    .from('escrow_deals')
    .select('reference,item_name,title,description,amount,currency,status,funded_at,inspection_deadline,created_at')
    .eq('reference', id)
    .maybeSingle();

  if (error) {
    console.error('Unable to load escrow deal details:', error);
    throw new Error('Unable to load this escrow deal.');
  }
  if (!deal) notFound();

  const amount = Number(deal.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    console.error('Escrow deal has invalid amount data:', deal.reference);
    throw new Error('Escrow deal details are unavailable.');
  }

  const status = knownStatuses.has(deal.status) ? deal.status : 'unknown';
  const inspectionDeadline = deal.inspection_deadline && Number.isFinite(Date.parse(deal.inspection_deadline))
    ? new Date(deal.inspection_deadline)
    : null;

  return (
    <main className="page-content mx-auto max-w-4xl">
      <Link href="/dashboard" className="secondary-button mb-8 inline-flex"><ArrowLeft size={15} /> Transaction dashboard</Link>
      <header className="page-heading">
        <div>
          <div className="eyebrow flex items-center gap-2"><ShieldCheck size={14} /> ESCROW DEAL</div>
          <h1>{deal.item_name || deal.title || 'Escrow transaction'}</h1>
          <p className="mono mt-2 text-[11px] text-slate-500">Reference: {deal.reference}</p>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] uppercase text-slate-300">{status}</span>
      </header>

      <section className="mt-5 grid gap-4 md:grid-cols-[1.3fr_1fr]">
        <article className="panel p-6">
          <div className="metric-label">ESCROW AMOUNT</div>
          <p className="mono mt-2 text-3xl font-semibold">{deal.currency} {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <h2 className="mt-7 text-sm font-semibold">Agreed delivery terms</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-400">{deal.description || 'No description was recorded for this deal.'}</p>
          {inspectionDeadline && (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-cyan-300/10 bg-cyan-300/[0.035] p-4 text-sm">
              <Clock size={16} className="mt-0.5 shrink-0 text-cyan-300" />
              <div><div className="font-medium">Inspection deadline</div><time className="mt-1 block text-xs text-slate-400" dateTime={inspectionDeadline.toISOString()}>{inspectionDeadline.toLocaleString()}</time></div>
            </div>
          )}
        </article>

        <aside className="panel flex flex-col gap-4 p-6">
          <h2 className="font-semibold">Deal actions</h2>
          {status === 'pending' && (
            <Link href={`/pay/${encodeURIComponent(deal.reference)}`} className="primary-button">Review and fund deal</Link>
          )}
          {status === 'funded' && (
            <Link href={`/disputes?reference=${encodeURIComponent(deal.reference)}`} className="secondary-button">
              <AlertTriangle size={14} /> Report a delivery issue
            </Link>
          )}
          <p className="text-xs leading-5 text-slate-500">
            {deal.funded_at
              ? `Payment was confirmed on ${new Date(deal.funded_at).toLocaleString()}.`
              : 'Payment is not confirmed until the payment provider sends a validated server-side event.'}
          </p>
          <p className="text-[10px] text-slate-600">Created {new Date(deal.created_at).toLocaleString()}</p>
        </aside>
      </section>
    </main>
  );
}
