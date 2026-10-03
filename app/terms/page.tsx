import Link from 'next/link'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0B1120] text-gray-300 font-sans selection:bg-emerald-500/30 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-emerald-400 text-sm font-bold hover:underline mb-8 inline-block">← Back to FiduLync</Link>
        
        <div className="mb-10">
          <span className="inline-block bg-emerald-500/10 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full border border-emerald-500/20 mb-4">
            Legal Framework v2.0
          </span>
          <h1 className="text-3xl md:text-5xl font-black text-white mb-4">Terms & Conditions</h1>
          <p className="text-gray-400">Effective Date: October 2026</p>
        </div>

        <div className="space-y-8 bg-[#111827] p-6 md:p-10 rounded-3xl border border-gray-800 shadow-xl">
          <section>
            <h2 className="text-xl font-bold text-white mb-3 flex items-center"><span className="text-emerald-500 mr-2">1.</span> The Escrow Agreement</h2>
            <p className="text-sm text-gray-400 leading-relaxed">
              FiduLync acts solely as a trusted third-party escrow agent. We secure funds from the Buyer and release them to the Seller only when both parties are satisfied with the transaction. By generating or paying through a FiduLync Safe Link, you agree to these binding terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 flex items-center"><span className="text-emerald-500 mr-2">2.</span> Multi-Currency & Payouts</h2>
            <p className="text-sm text-gray-400 leading-relaxed">
              FiduLync supports NGN, USD, GBP, EUR, KES, GHS, and ZAR. Payouts are executed automatically to the verified seller destination (Commercial Banks, OPay, PalmPay, Moniepoint, or Kuda) upon buyer confirmation. Exchange rates for cross-currency settlements are determined dynamically at the time of transaction. FiduLync charges a standard 2% platform fee unless otherwise stated.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 flex items-center"><span className="text-emerald-500 mr-2">3.</span> Prohibited Transactions</h2>
            <p className="text-sm text-gray-400 leading-relaxed">
              You may not use FiduLync to facilitate the sale of illegal narcotics, unregulated firearms, stolen goods, fraudulent digital assets, or any items strictly prohibited by global financial regulations. FiduLync reserves the right to freeze accounts and report suspicious activities to regulatory bodies.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
