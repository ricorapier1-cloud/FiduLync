'use client';

import { useEffect, useMemo, useState } from 'react';

type Cycle = 'MONTHLY' | 'ANNUAL';
type Currency = 'NGN' | 'USD';
type Product = {
  slug: string; name: string; monthly_price_ngn: number; monthly_price_usd: number;
  annual_price_ngn: number; annual_price_usd: number;
  extra_seat_price_ngn: number; extra_seat_price_usd: number; is_active: boolean;
};

export function PaystackCheckout({
  selectedEaSlug = 'eridam-nexus-pro',
  selectedBillingCycle = 'MONTHLY',
  selectedCurrency = 'NGN',
}: {
  selectedEaSlug?: string; selectedBillingCycle?: Cycle; selectedCurrency?: Currency;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [slug, setSlug] = useState(selectedEaSlug);
  const [cycle, setCycle] = useState<Cycle>(selectedBillingCycle);
  const [currency, setCurrency] = useState<Currency>(selectedCurrency);
  const [extraSeats, setExtraSeats] = useState<0 | 1 | 3 | 5>(0);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [licenseKey, setLicenseKey] = useState('');

  useEffect(() => {
    setSlug(selectedEaSlug);
    setCycle(selectedBillingCycle);
    setCurrency(selectedCurrency);
  }, [selectedEaSlug, selectedBillingCycle, selectedCurrency]);

  useEffect(() => {
    let active = true;
    fetch('/api/v1/products', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Catalogue unavailable.');
        if (active) setProducts(data.products || []);
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Catalogue unavailable.'); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const reference = new URLSearchParams(window.location.search).get('ref');
    if (!reference) return;
    let active = true;
    setBusy(true); setError('');
    fetch('/api/v1/verify-payment?reference=' + encodeURIComponent(reference), { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Payment verification is pending.');
        if (!active) return;
        setLicenseKey(data.license_key);
        setNotice('Payment verified. Your EA subscription has been provisioned.');
        window.history.replaceState({}, '', '/store#vault-checkout');
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Payment verification failed.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  const product = products.find((item) => item.slug === slug);
  const amount = useMemo(() => {
    if (!product) return 0;
    const base = currency === 'NGN'
      ? (cycle === 'MONTHLY' ? product.monthly_price_ngn : product.annual_price_ngn)
      : (cycle === 'MONTHLY' ? product.monthly_price_usd : product.annual_price_usd);
    const seat = currency === 'NGN' ? product.extra_seat_price_ngn : product.extra_seat_price_usd;
    return base + seat * extraSeats * (cycle === 'ANNUAL' ? 10 : 1);
  }, [product, currency, cycle, extraSeats]);
  const money = currency === 'NGN' ? '₦' + amount.toLocaleString('en-NG') : '$' + amount.toLocaleString('en-US');

  async function checkout(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/v1/create-checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), ea_slug: slug, billing_cycle: cycle, currency, extra_live_seats: extraSeats }),
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.authorization_url) throw new Error(data.error || 'Checkout could not be initialized.');
      window.location.assign(data.authorization_url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Checkout failed.');
      setBusy(false);
    }
  }

  return <div id="vault-checkout" className="mx-auto w-full max-w-3xl rounded-2xl border border-white/[0.08] bg-[#090d14]/95 p-5 shadow-2xl sm:p-7">
    <div className="font-mono text-[10px] tracking-[0.18em] text-emerald-300">SECURE PAYSTACK SUBSCRIPTION</div>
    <h3 className="mt-2 text-xl font-semibold text-white">Complete your AlgoLync subscription</h3>
    <p className="mt-1 text-xs text-slate-400">Recurring billing is linked to the selected EA. Your MT5 account can be bound later in My License.</p>
    {error && <p role="alert" className="mt-4 rounded-lg border border-rose-400/20 bg-rose-400/5 p-3 text-xs text-rose-300">{error}</p>}
    {notice && <div className="mt-4 rounded-lg border border-emerald-300/20 bg-emerald-300/[0.05] p-3 text-xs text-emerald-200">{notice}{licenseKey && <><div className="mt-2 break-all font-mono">{licenseKey}</div><a href="/portal" className="mt-3 inline-block underline">Open My License workspace</a></>}</div>}
    {!licenseKey && <form onSubmit={checkout} className="mt-6 grid gap-4 sm:grid-cols-2">
      <label className="text-xs text-slate-400 sm:col-span-2">EA strategy
        <select value={slug} onChange={(event) => setSlug(event.target.value)} required className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white">
          {products.filter((item) => item.is_active && item.monthly_price_ngn + item.monthly_price_usd > 0).map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
        </select>
      </label>
      <label className="text-xs text-slate-400">Billing cycle
        <select value={cycle} onChange={(event) => setCycle(event.target.value as Cycle)} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"><option value="MONTHLY">Monthly</option><option value="ANNUAL">Annual · 2 months free</option></select>
      </label>
      <label className="text-xs text-slate-400">Currency
        <select value={currency} onChange={(event) => setCurrency(event.target.value as Currency)} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"><option value="NGN">NGN · ₦</option><option value="USD">USD · $</option></select>
      </label>
      <label className="text-xs text-slate-400 sm:col-span-2">Extra live account seats
        <select value={extraSeats} onChange={(event) => setExtraSeats(Number(event.target.value) as 0 | 1 | 3 | 5)} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"><option value={0}>Included live seat only</option><option value={1}>+1 extra live seat</option><option value={3}>+3 extra live seats</option><option value={5}>+5 extra live seats</option></select>
      </label>
      <label className="text-xs text-slate-400 sm:col-span-2">Subscriber email
        <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white" />
      </label>
      <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 p-4 sm:col-span-2"><div><div className="text-[10px] text-slate-500">TOTAL RECURRING AMOUNT</div><div className="mt-1 text-xl font-semibold text-white">{money}</div></div><div className="text-right text-[10px] text-slate-500">{cycle === 'MONTHLY' ? 'Billed monthly' : 'Billed annually'}<br />{extraSeats} additional live seats</div></div>
      <button disabled={busy || !product || amount <= 0} className="rounded-lg bg-emerald-300 px-4 py-3 text-xs font-bold text-slate-950 disabled:opacity-50 sm:col-span-2">{busy ? 'Connecting to Paystack…' : 'Continue to secure checkout'}</button>
    </form>}
    <p className="mt-4 text-[10px] leading-5 text-slate-500">Checkout is processed by Paystack. Annual pricing is set at ten monthly payments (two months free). One live and two demo MT5 seats are included with eligible paid EA subscriptions.</p>
  </div>;
}

export default PaystackCheckout;
