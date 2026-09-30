import Link from 'next/link'

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 px-6 py-12 max-w-2xl mx-auto font-sans">
      <Link href="/" className="text-emerald-600 font-semibold text-sm hover:underline">← Back to FiduLync</Link>
      <h1 className="text-2xl font-bold mt-6 mb-2">FiduLync Support & Disputes</h1>
      <p className="text-sm text-slate-600 mb-8">Need help with a payment link or want to report a delivery issue?</p>

      <form className="space-y-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Your Email</label>
          <input type="email" placeholder="you@example.com" required className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Escrow Link or Transaction ID</label>
          <input type="text" placeholder="e.g. fidulync.vercel.app/pay/xyz123" required className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Issue Category</label>
          <select className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option>Item Not Received</option>
            <option>Item Not As Described</option>
            <option>Payment Issue / Receipt Missing</option>
            <option>General Inquiry</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Message / Evidence Details</label>
          <textarea rows={4} placeholder="Describe what happened..." required className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"></textarea>
        </div>

        <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg text-sm transition-all">
          Submit Ticket
        </button>
      </form>
    </main>
  )
}
