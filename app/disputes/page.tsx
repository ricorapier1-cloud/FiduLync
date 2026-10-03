import Link from 'next/link'

export default function DisputesPage() {
  return (
    <div className="min-h-screen bg-[#0B1120] text-gray-300 font-sans selection:bg-emerald-500/30 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-emerald-400 text-sm font-bold hover:underline mb-8 inline-block">← Back to FiduLync</Link>
        
        <div className="mb-10 text-center md:text-left">
          <span className="inline-block bg-red-500/10 text-red-400 text-xs font-bold px-3 py-1 rounded-full border border-red-500/20 mb-4">
            24/7 Arbitration Team
          </span>
          <h1 className="text-3xl md:text-5xl font-black text-white mb-4">Dispute Center</h1>
          <p className="text-gray-400 max-w-2xl">If something went wrong with your transaction, your funds are safely locked. Follow the procedure below to initiate a resolution.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-10">
          <div className="bg-[#111827] p-6 rounded-2xl border border-gray-800 text-center">
            <div className="text-3xl mb-3">⏸️</div>
            <h3 className="font-bold text-white mb-2">1. Funds Frozen</h3>
            <p className="text-xs text-gray-400">Escrow payouts are instantly paused the moment a dispute is opened.</p>
          </div>
          <div className="bg-[#111827] p-6 rounded-2xl border border-gray-800 text-center">
            <div className="text-3xl mb-3">📸</div>
            <h3 className="font-bold text-white mb-2">2. Upload Evidence</h3>
            <p className="text-xs text-gray-400">Provide screenshots, tracking numbers, or chat logs to our WhatsApp bot.</p>
          </div>
          <div className="bg-[#111827] p-6 rounded-2xl border border-gray-800 text-center">
            <div className="text-3xl mb-3">⚖️</div>
            <h3 className="font-bold text-white mb-2">3. Resolution</h3>
            <p className="text-xs text-gray-400">Our team reviews the data and routes the funds to the rightful owner within 24 hours.</p>
          </div>
        </div>

        <div className="bg-[#111827] p-8 rounded-3xl border border-gray-800 text-center">
          <h2 className="text-2xl font-black text-white mb-4">Open a Ticket Now</h2>
          <p className="text-sm text-gray-400 mb-8 max-w-lg mx-auto">Have your <strong>FiduLync Safe Link ID</strong> ready. Our arbitration team is available via WhatsApp to resolve your case.</p>
          
          <button className="bg-emerald-500 text-black font-extrabold py-3 px-8 rounded-xl hover:bg-emerald-400 transition shadow-[0_0_20px_rgba(16,185,129,0.3)]">
            Chat on WhatsApp
          </button>
        </div>
      </div>
    </div>
  )
}
