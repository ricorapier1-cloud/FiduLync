import Link from 'next/link';

const sections = [
  {
    title: '1. Deal terms and payment',
    text: 'A FiduLync deal link records the item or service, amount, fee allocation, seller payout details and inspection period. The platform fee is 1.5% of the deal amount; the creator selects buyer-paid, seller-paid or an approximately equal split. The fee allocation is shown before checkout. Paystack processes the buyer payment, and a deal is marked funded only after a signed provider notification confirms the expected amount and currency.',
  },
  {
    title: '2. Custody and settlement limits',
    text: 'Payments are processed into the configured merchant Paystack balance. Unless FiduLync separately establishes and discloses a legally compliant custodial arrangement, funds are not held in a segregated or insured trust account. Provider availability, bank rules, account checks and applicable law affect refunds and payouts. Automated bank transfers are currently limited to NGN; other settlement currencies may require a separately agreed manual workflow.',
  },
  {
    title: '3. Inspection and disputes',
    text: 'A 48-hour inspection window begins after payment confirmation. A party with the private deal link may submit a dispute statement and evidence while the deal is funded. The platform pauses its scheduled settlement workflow when a dispute is accepted. An administrator records a release, refund or split decision with reviewer notes; a provider payout is not complete until the provider confirms it.',
  },
  {
    title: '4. AlgoLync verification and trading risk',
    text: 'A verification badge identifies a provider source reviewed by an administrator; it does not guarantee accuracy, safety, profitability or future results. Marketplace metrics are displayed only when recorded for a published listing. Trading foreign exchange, CFDs and leveraged products carries substantial risk. Historical results do not guarantee future performance.',
  },
  {
    title: '5. Evidence and sensitive information',
    text: 'Dispute uploads are limited to supported file types and stored in a private evidence bucket. MT5 integration accepts investor credentials only through its authenticated, encrypted server-side flow. Never send passwords, one-time codes, payment-card details or master trading credentials through a deal link, support channel or dispute attachment.',
  },
];

export default function TermsPage() {
  return (
    <div className="page-content max-w-4xl">
      <header className="page-heading">
        <div>
          <div className="eyebrow">PLATFORM INFORMATION</div>
          <h1>FiduLync & AlgoLync terms</h1>
          <p>Product and payment-service disclosures for use of this platform.</p>
        </div>
        <span className="mono text-[10px] text-slate-500">Updated November 2026</span>
      </header>
      <div className="panel space-y-6 p-5 text-xs leading-6 text-slate-400 sm:p-8">
        <p className="rounded-xl border border-amber-300/15 bg-amber-200/[0.04] p-4 text-[11px] leading-5 text-amber-100/80">
          This page is a product disclosure, not legal advice. Platform availability and financial workflows are subject to applicable law and provider terms. Obtain qualified legal and regulatory review before relying on this service for regulated custody or financial activity.
        </p>
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="mb-2 text-sm font-semibold text-slate-100">{section.title}</h2>
            <p>{section.text}</p>
          </section>
        ))}
        <p className="border-t border-white/[0.06] pt-5 text-[10px] text-slate-600">Questions about a funded transaction? Use the private deal reference and contact <Link href="/support" className="text-[#51e4c2] underline">support</Link>. To submit transaction evidence, open the <Link href="/disputes" className="text-[#51e4c2] underline">Dispute Vault</Link>.</p>
      </div>
    </div>
  );
}
