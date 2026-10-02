import Link from 'next/link'

export default function StorefrontPage() {
  return (
    <div className="min-h-screen bg-[#0B1120] text-white p-8">
      <header className="flex justify-between items-center mb-12 border-b border-gray-800 pb-6">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-500">
          AlgoLync Storefront
        </h1>
        <Link className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition" href="/">
          Back to FiduLync
        </Link>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Placeholder Product Card */}
        <div className="bg-[#111827] border border-gray-800 rounded-xl p-5 hover:border-emerald-500/50 transition">
          <div className="h-40 bg-gray-900 rounded-lg mb-4 flex items-center justify-center border border-gray-800">
            <span className="text-4xl">📈</span>
          </div>
          <h2 className="text-xl font-semibold mb-2">Nexus Adaptive Pro</h2>
          <p className="text-gray-400 text-sm mb-4">Advanced MQL5 Quantitative Trading Software with Z-Score volatility envelopes.</p>
          <div className="flex justify-between items-center">
            <span className="text-lg font-bold text-emerald-400">₦250,000</span>
            <button className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-black border border-emerald-500/30 font-medium py-2 px-4 rounded-lg transition">
              Buy via Escrow
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
