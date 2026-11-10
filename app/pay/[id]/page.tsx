'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, LockKeyhole, ShieldCheck } from 'lucide-react';
import { formatCurrency } from '@/lib/feeCalculator';

type Deal = {
  reference: string;
  title: string;
  description: string;
  amount: number;
  currency: string;
  fee_payer: 'buyer' | 'seller' | 'split';
  platform_fee: number;
  buyer_fee: number;
  seller_fee: number;
  status: string;
  payment_initiated: boolean;
  funded_at: string | null;
  inspection_deadline: string | null;
};

function countdown(deadline: string | null, fundedAt: string | null, now: number) {
  const parsedDeadline = deadline ? Date.parse(deadline) : Number.NaN;
  const parsedFundedAt = fundedAt ? Date.parse(fundedAt) : Number.NaN;
  const resolvedDeadline = Number.isFinite(parsedDeadline)
    ? parsedDeadline
    : Number.isFinite(parsedFundedAt)
      ? parsedFundedAt + 48 * 60 * 60 * 1000
      : Number.NaN;
  if (!Number.isFinite(resolvedDeadline)) return 'Inspection deadline unavailable';
  const remaining = Math.max(0, resolvedDeadline - now);
  const hours = Math.floor(remaining / 3_600_000).toString().padStart(2, '0');
  const minutes = Math.floor((remaining % 3_600_000) / 60_000).toString().padStart(2, '0');
  const seconds = Math.floor((remaining % 60_000) / 1000).toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

export default function BuyerCheckout() {
  const { id } = useParams<{ id: string }>();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [email, setEmail] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [now, setNow] = useState(0);
  const [retry, setRetry] = useState(0);
  const feeSummary = useMemo(() => {
    if (!deal) return { buyerTotal: 0 };
    return { buyerTotal: deal.amount + deal.buyer_fee };
  }, [deal]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (deal?.status !== 'pending' || !deal.payment_initiated) return;
    const timer = window.setInterval(() => setRetry((current) => current + 1), 5000);
    return () => window.clearInterval(timer);
  }, [deal?.status, deal?.payment_initiated]);

  useEffect(() => {
    let active = true;
    fetch(`/api/escrow/${encodeURIComponent(id)}`, { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to load this escrow deal.');
        return result.deal as Deal;
      })
      .then((result) => { if (active) { setDeal(result); setError(''); } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Unable to load this escrow deal.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, retry]);

  async function fundDeal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!deal) return;
    if (!termsAccepted) {
      setError('Accept the Terms of Service before continuing to payment.');
      return;
    }
    setPaying(true);
    setError('');
    try {
      const response = await fetch(`/api/escrow/${encodeURIComponent(deal.reference)}/fund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, terms_accepted: termsAccepted }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to start checkout.');
      window.location.assign(result.authorization_url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to start checkout.');
      setPaying(false);
    }
  }

  const funded = deal?.status === 'funded';

  return (
    <div className="page-content max-w-3xl">
      <Link href="/" className="back-link mb-6 inline-flex"><ArrowLeft size={15} /> <span>Back to platform</span></Link>
      <section className="panel mx-auto max-w-xl overflow-hidden">
        <div className="border-b border-white/[0.07] p-5 text-center sm:p-7">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.08] text-[#51e4c2]"><ShieldCheck size={23} /></div>
          <div className="eyebrow mt-4">FIDULYNC SECURE CHECKOUT</div>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">{loading ? 'Loading deal…' : deal?.title || 'Escrow deal'}</h1>
          <p className="mono mt-2 text-[10px] text-slate-500">REFERENCE · {id}</p>
        </div>

        {loading ? (
          <div role="status" aria-label="Loading escrow details" className="space-y-4 p-6 sm:p-8">
            <span className="sr-only">Retrieving protected deal terms…</span>
            <div className="h-4 w-2/3 animate-pulse rounded bg-white/[0.07]" />
            <div className="h-20 animate-pulse rounded-xl bg-white/[0.04]" />
            <div className="h-10 animate-pulse rounded-xl bg-white/[0.04]" />
          </div>
        ) : !deal ? (
          <div className="p-6 text-center">
            <AlertCircle className="mx-auto text-rose-300" size={22} />
            <p className="mt-3 text-sm text-rose-200">{error || 'This deal could not be found.'}</p>
            <button type="button" className="secondary-button mx-auto mt-4" onClick={() => setRetry(retry + 1)}>Try again</button>
          </div>
        ) : (
          <div className="space-y-5 p-5 sm:p-7">
            {deal.description && <p className="text-xs leading-6 text-slate-400">{deal.description}</p>}

            <div className="rounded-xl border border-white/[0.07] bg-black/15 p-4">
              <div className="flex justify-between gap-4 py-1.5 text-xs"><span className="text-slate-500">Deal amount</span><span className="mono">{formatCurrency(deal.amount, deal.currency)}</span></div>
              <div className="flex justify-between gap-4 py-1.5 text-xs"><span className="text-slate-500">Platform fee · 1.5%</span><span className="mono text-[#51e4c2]">{formatCurrency(deal.platform_fee, deal.currency)}</span></div>
              <div className="flex justify-between gap-4 py-1.5 text-xs"><span className="text-slate-500">Buyer fee share</span><span className="mono">{formatCurrency(deal.buyer_fee, deal.currency)}</span></div>
              <div className="mt-2 flex justify-between gap-4 border-t border-white/[0.07] pt-3 text-sm"><span className="font-semibold">You pay</span><span className="mono font-semibold text-[#51e4c2]">{formatCurrency(feeSummary.buyerTotal, deal.currency)}</span></div>
            </div>

            {funded ? (
              <div className="rounded-xl border border-emerald-300/15 bg-emerald-300/[0.05] p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-100"><CheckCircle2 size={16} className="text-[#51e4c2]" /> Payment confirmed · inspection window active</div>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                  <span className="flex items-center gap-2 text-slate-400"><Clock3 size={14} /> Inspection window</span>
                  <span className="mono text-[#51e4c2]">{countdown(deal.inspection_deadline, deal.funded_at, now)}</span>
                </div>
                <p className="mt-3 text-[10px] leading-5 text-slate-500">Open a dispute before the inspection deadline if the delivery does not meet the agreed terms. Disputes freeze settlement.</p>
                <Link href="/disputes" className="secondary-button mt-3 w-full">Open the Dispute Vault</Link>
              </div>
            ) : deal.status !== 'pending' ? (
              <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-4 text-xs leading-6 text-amber-100/80">This deal is <span className="font-semibold">{deal.status}</span> and cannot accept a new payment.</div>
            ) : deal.payment_initiated ? (
              <div role="status" className="rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-4 text-xs leading-6 text-amber-100/80">
                Checkout has been initialized. Waiting for the signed payment confirmation; this page checks for updates automatically.
                {error && <p className="mt-2 text-rose-200">{error}</p>}
              </div>
            ) : (
              <form onSubmit={fundDeal} className="space-y-3">
                <label className="field-label" htmlFor="buyer-email">Payment receipt email</label>
                <input id="buyer-email" className="field-control" type="email" autoComplete="email" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
                <p className="text-[10px] leading-5 text-slate-500">Paystack processes the payment securely. FiduLync marks the deal funded only after the signed provider webhook confirms the exact amount.</p>
                <div className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-black/15 p-3">
                  <input id="buyer-terms" className="mt-1 h-4 w-4 accent-emerald-300" type="checkbox" required checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} />
                  <label htmlFor="buyer-terms" className="text-[10px] leading-5 text-slate-400">
                    I have read and agree to the <Link href="/legal/terms" className="text-[#51e4c2] underline underline-offset-2">Terms of Service and Escrow Agreement</Link>, including the inspection and dispute process.
                  </label>
                </div>
                {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
                <button className="primary-button w-full" type="submit" disabled={paying || !termsAccepted}>
                  <LockKeyhole size={15} /> {paying ? 'Connecting to Paystack…' : 'Pay & start 48-hour inspection'}
                </button>
              </form>
            )}

            <div className="flex items-start gap-2 border-t border-white/[0.06] pt-3 text-[10px] leading-5 text-slate-500">
              <Clock3 size={13} className="mt-0.5 shrink-0" />
              A 48-hour inspection window begins after payment confirmation. Scheduled settlement runs hourly after the deadline unless a dispute is open.
            </div>
            <p className="text-[9px] leading-5 text-slate-600">Payments are processed into the merchant’s Paystack balance, not a segregated or insured trust account. Provider, bank and applicable legal terms govern custody, refund and settlement.</p>
          </div>
        )}
      </section>
    </div>
  );
}
