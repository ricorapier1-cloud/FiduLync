import Link from 'next/link';

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-800">
      <div className="mx-auto max-w-2xl bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <Link href="/" className="text-xs font-semibold text-emerald-700 hover:underline mb-4 inline-block">
          ← Back to veriPay
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Terms of Service & Escrow Rules</h1>
        <p className="text-xs text-slate-500 mb-6">Last updated: September 2026</p>

        <section className="space-y-6 text-sm leading-relaxed">
          <div>
            <h2 className="text-base font-semibold text-slate-900 mb-1">1. How Escrow Works</h2>
            <p className="text-slate-600">
              veriPay holds buyer payments securely in escrow until delivered goods or services are inspected and accepted, or until the inspection window expires.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-slate-900 mb-1">2. 24-Hour Inspection Window</h2>
            <p className="text-slate-600">
              Buyers have 24 hours from confirmed delivery to inspect items. If no dispute is logged within 24 hours, funds automatically release to the seller.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-slate-900 mb-1">3. Dispute Resolution</h2>
            <p className="text-slate-600">
              Disputes require unboxing video proof or courier delivery receipts. Decisions are finalized within 48 hours.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-slate-900 mb-1">4. Escrow Fee Cap</h2>
            <p className="text-slate-600">
              veriPay charges standard escrow processing fees, strictly capped at a maximum of ₦5,000 per transaction regardless of transaction size.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
