import Link from 'next/link'

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 px-6 py-12 max-w-4xl mx-auto font-sans">
      <Link href="/" className="text-emerald-600 font-semibold text-sm hover:underline">← Back to FiduLync</Link>
      <h1 className="text-3xl font-bold mt-6 mb-2">Terms of Service</h1>
      <p className="text-sm text-slate-500 mb-8">Last updated: September 30, 2026</p>

      <div className="space-y-6 text-slate-700 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-2">1. Escrow Mechanics</h2>
          <p>FiduLync acts as a neutral third party holding buyer funds until delivery is verified by the buyer or agreed terms are fulfilled. Once released, funds are non-refundable through the platform.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-2">2. Dispute Resolution</h2>
          <p>Either party may flag a transaction before release. In the event of a dispute, FiduLync holds funds in escrow until both parties reach an agreement or proof of delivery/non-delivery is provided to support.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-2">3. Prohibited Transactions</h2>
          <p>Users agree not to use FiduLync for illegal goods, weapons, fraud, or prohibited financial instruments under applicable federal laws.</p>
        </section>
      </div>
    </main>
  )
}
