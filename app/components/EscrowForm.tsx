'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, Check, Copy, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { calculateEscrowFee, formatCurrency } from '@/lib/feeCalculator';

const banks = [
  ['044', 'Access Bank'],
  ['058', 'Guaranty Trust Bank'],
  ['011', 'First Bank'],
  ['033', 'United Bank for Africa'],
  ['057', 'Zenith Bank'],
  ['999992', 'OPay'],
  ['999991', 'PalmPay'],
  ['090267', 'Kuda Bank'],
];

export default function EscrowForm() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [feePayer, setFeePayer] = useState<'buyer' | 'seller' | 'split'>('buyer');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [sellerPhone, setSellerPhone] = useState('');
  const [sellerAccountName, setSellerAccountName] = useState('');
  const [sellerAccountNumber, setSellerAccountNumber] = useState('');
  const [sellerBankCode, setSellerBankCode] = useState('044');
  const [loading, setLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [dealReference, setDealReference] = useState('');

  const price = Number(amount) || 0;
  const fee = useMemo(() => calculateEscrowFee(price, currency, feePayer), [price, currency, feePayer]);

  async function handleGenerate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('/api/escrow/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          amount: price,
          currency,
          fee_payer: feePayer,
          buyer_phone: buyerPhone.trim(),
          seller_phone: sellerPhone.trim(),
          seller_account_name: sellerAccountName.trim(),
          seller_account_number: sellerAccountNumber.trim(),
          seller_bank_code: sellerBankCode,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to create the escrow deal.');

      const link = `${window.location.origin}/pay/${result.link_id}`;
      setGeneratedLink(link);
      setDealReference(result.link_id);
      toast.success('Your protected deal link is ready.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create the escrow deal.');
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(generatedLink);
      toast.success('Secure link copied.');
    } catch {
      toast.error('Clipboard access is unavailable. Select and copy the link instead.');
    }
  }

  if (generatedLink) {
    return (
      <section className="panel mx-auto max-w-2xl p-6 sm:p-8">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-emerald-300/20 bg-emerald-300/10 text-[#51e4c2]">
          <Check size={22} />
        </div>
        <h2 className="mt-4 text-center text-xl font-semibold">Protected deal created</h2>
        <p className="mt-2 text-center text-xs text-slate-400">Share this private link with the buyer to review the terms and fund the deal.</p>
        <div className="mt-6 rounded-xl border border-white/[0.07] bg-black/20 p-3">
          <div className="mono mb-2 text-[10px] text-slate-500">DEAL REFERENCE · {dealReference}</div>
          <input className="field-control mono text-[11px]" aria-label="Secure deal link" readOnly value={generatedLink} onFocus={(event) => event.currentTarget.select()} />
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button type="button" className="primary-button flex-1" onClick={copyLink}><Copy size={15} /> Copy secure link</button>
          <button type="button" className="secondary-button flex-1" onClick={() => setGeneratedLink('')}>Create another deal</button>
        </div>
        <p className="mt-5 text-center text-[10px] leading-5 text-slate-500">Funds are only considered funded after Paystack confirms payment server-side. Never share banking passwords or one-time passcodes.</p>
      </section>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <form onSubmit={handleGenerate} className="panel space-y-6 p-5 sm:p-7">
        <div>
          <div className="eyebrow">DEAL TERMS</div>
          <h2 className="mt-2 text-lg font-semibold">Describe what is being protected</h2>
        </div>
        <div>
          <label className="field-label" htmlFor="deal-title">Item or service</label>
          <input id="deal-title" className="field-control" maxLength={120} required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. MetaTrader 5 expert advisor license" />
        </div>
        <div>
          <label className="field-label" htmlFor="deal-description">Delivery terms</label>
          <textarea id="deal-description" className="field-control min-h-24 resize-y" maxLength={2000} required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the agreed deliverable, timeline and acceptance criteria." />
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
          <div>
            <label className="field-label" htmlFor="deal-currency">Currency</label>
            <select id="deal-currency" className="field-control" value={currency} onChange={(event) => setCurrency(event.target.value)}>
              <option value="NGN">NGN · ₦</option>
              <option value="USD">USD · $</option>
              <option value="GBP">GBP · £</option>
              <option value="EUR">EUR · €</option>
              <option value="GHS">GHS · ₵</option>
              <option value="KES">KES · KSh</option>
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="deal-amount">Deal amount</label>
            <input id="deal-amount" className="field-control mono" type="number" min="1" step="0.01" max="1000000000" required value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="250000.00" />
          </div>
        </div>

        <fieldset>
          <legend className="field-label">Who pays the 1.5% platform fee?</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {([
              ['buyer', 'Buyer pays'],
              ['seller', 'Seller pays'],
              ['split', 'Split 50 / 50'],
            ] as const).map(([value, label]) => (
              <label key={value} className={`cursor-pointer rounded-xl border p-3 text-xs transition ${feePayer === value ? 'border-emerald-300/40 bg-emerald-300/[0.07] text-emerald-100' : 'border-white/[0.08] bg-black/10 text-slate-400 hover:border-white/15'}`}>
                <input className="sr-only" type="radio" name="fee-payer" value={value} checked={feePayer === value} onChange={() => setFeePayer(value)} />
                <span className="flex items-center justify-between gap-2 font-semibold">{label}<span className={`h-3 w-3 rounded-full border ${feePayer === value ? 'border-[#51e4c2] bg-[#51e4c2] shadow-[inset_0_0_0_3px_#10201d]' : 'border-slate-600'}`} /></span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <div className="eyebrow mb-3">SELLER SETTLEMENT DETAILS</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="seller-account-name">Account holder name</label>
              <input id="seller-account-name" className="field-control" autoComplete="name" required maxLength={100} value={sellerAccountName} onChange={(event) => setSellerAccountName(event.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="seller-bank">Bank</label>
              <select id="seller-bank" className="field-control" value={sellerBankCode} onChange={(event) => setSellerBankCode(event.target.value)}>
                {banks.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="seller-account-number">Account number</label>
              <input id="seller-account-number" className="field-control mono" inputMode="numeric" pattern="[0-9]{10}" minLength={10} maxLength={10} required value={sellerAccountNumber} onChange={(event) => setSellerAccountNumber(event.target.value.replace(/\D/g, ''))} placeholder="10 digits" />
            </div>
            <div>
              <label className="field-label" htmlFor="buyer-phone">Buyer phone <span className="font-normal text-slate-600">(optional)</span></label>
              <input id="buyer-phone" className="field-control" autoComplete="tel" value={buyerPhone} onChange={(event) => setBuyerPhone(event.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="seller-phone">Seller phone <span className="font-normal text-slate-600">(optional)</span></label>
              <input id="seller-phone" className="field-control" autoComplete="tel" value={sellerPhone} onChange={(event) => setSellerPhone(event.target.value)} />
            </div>
          </div>
        </div>

        <button className="primary-button w-full" type="submit" disabled={loading}>
          <ShieldCheck size={16} /> {loading ? 'Creating protected deal…' : 'Create secure payment link'} <ArrowRight size={15} />
        </button>
        <p className="text-[10px] leading-5 text-slate-500">Creating a deal does not move funds. Paystack confirms payment before a deal is marked funded. Disputed funds remain frozen for review.</p>
      </form>

      <aside className="panel h-fit p-5 sm:p-6">
        <div className="eyebrow">LIVE FEE DISCLOSURE</div>
        <h2 className="mt-2 text-base font-semibold">Know the exact numbers.</h2>
        <p className="mt-1 text-[11px] leading-5 text-slate-500">Fixed 1.5% of the deal value. No promotional overrides or fee caps.</p>
        <div className="mt-5 space-y-3 border-y border-white/[0.07] py-4 text-xs">
          <div className="flex justify-between gap-4"><span className="text-slate-500">Deal amount</span><span className="mono">{formatCurrency(price, currency)}</span></div>
          <div className="flex justify-between gap-4"><span className="text-slate-500">Platform fee · 1.5%</span><span className="mono text-[#51e4c2]">{formatCurrency(fee.actualFee, currency)}</span></div>
          <div className="flex justify-between gap-4"><span className="text-slate-500">Buyer share</span><span className="mono">{formatCurrency(fee.buyerFee, currency)}</span></div>
          <div className="flex justify-between gap-4"><span className="text-slate-500">Seller share</span><span className="mono">{formatCurrency(fee.sellerFee, currency)}</span></div>
        </div>
        <div className="mt-4 flex justify-between gap-4 text-xs">
          <span className="font-semibold">Buyer pays today</span>
          <span className="mono font-semibold text-[#51e4c2]">{formatCurrency(fee.total, currency)}</span>
        </div>
        <div className="mt-5 rounded-xl border border-white/[0.06] bg-black/15 p-3 text-[10px] leading-5 text-slate-500">
          Fee allocation is displayed to both parties before funding. Local payment-provider fees, where applicable, are separate.
        </div>
      </aside>
    </div>
  );
}
