'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function AlgoLynStore() {
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [email, setEmail] = useState('')
  const [mt5Account, setMt5Account] = useState('')
  const [paying, setPaying] = useState(false)

  const handleTryDemo = (productTitle: string) => {
    toast.success(`Downloading ${productTitle} Demo...`)
    window.location.href = `/api/demo/download?product=${encodeURIComponent(productTitle)}`
  }

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !mt5Account) {
      toast.error('Please enter your email and MT5 Account Number.')
      return
    }

    setPaying(true)
    setTimeout(() => {
      setPaying(false)
      toast.success(`Redirecting to Paystack for ${selectedProduct.title}...`)
      window.location.href = `/?title=${encodeURIComponent(selectedProduct.title)}&amount=${selectedProduct.priceNgn}`
    }, 1000)
  }

  return (
    <main className="min-h-screen bg-[#0B1120] text-white selection:bg-emerald-500/30">
      {/* Navbar */}
      <nav className="border-b border-gray-800 bg-[#111827]/80 backdrop-blur sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
        <Link href="/" className="text-xl font-black tracking-tight flex items-center gap-2">
          <span>FiduLync</span> <span className="text-emerald-400 font-mono text-xs px-2 py-0.5 bg-emerald-500/10 rounded-full border border-emerald-500/30">AlgoLyn Store</span>
        </Link>
        <div className="flex gap-4 text-xs font-bold items-center">
          <Link href="/" className="text-gray-300 hover:text-emerald-400 transition">Escrow Home</Link>
          <Link href="/dashboard" className="text-gray-300 hover:text-emerald-400 transition">Dashboard</Link>
          <Link href="/disputes" className="text-gray-300 hover:text-emerald-400 transition">Disputes</Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header Section */}
        <div className="text-center space-y-3 mb-12">
          <div className="inline-block text-emerald-400 font-mono text-xs uppercase tracking-widest bg-emerald-500/10 px-4 py-1.5 rounded-full border border-emerald-500/20">
            ALGOLYNC QUANT SUITE
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">MQL5 Trading Systems</h1>
          <p className="text-xs sm:text-sm text-gray-400 max-w-lg mx-auto">
            Institutional-grade MetaTrader 5 tools with automated instant delivery.
          </p>
          <div className="flex justify-center gap-6 text-[11px] font-mono text-gray-400 pt-2">
            <span>🔒 256-Bit SSL Encrypted</span>
            <span>🛡️ Secured by Paystack</span>
            <span>⚡ Instant File Delivery</span>
          </div>
        </div>

        {/* Product Cards matching Video */}
        <div className="space-y-8">
          {/* Flagship EA */}
          <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 sm:p-8 space-y-6 hover:border-emerald-500/40 transition">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-mono uppercase px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/30 font-bold">
                  Flagship EA
                </span>
                <h3 className="text-2xl font-black text-white mt-3">ERIDAM NEXUS ADAPTIVE PRO</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Quantitative MT5 EA featuring Kaufman Efficiency Ratio filtering, dynamic ATR envelopes, and high-watermark equity shield.
                </p>
              </div>
              <span className="text-xs font-mono text-gray-500">v2.4</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#0B1120] p-4 rounded-2xl border border-gray-800/80 text-xs">
              <div>
                <div className="text-gray-500 text-[10px] uppercase font-mono">Historical Win Rate</div>
                <div className="text-emerald-400 font-bold text-sm mt-0.5">74.2%</div>
              </div>
              <div>
                <div className="text-gray-500 text-[10px] uppercase font-mono">Profit Factor</div>
                <div className="text-white font-bold text-sm mt-0.5">2.14</div>
              </div>
              <div>
                <div className="text-gray-500 text-[10px] uppercase font-mono">Max Drawdown</div>
                <div className="text-amber-400 font-bold text-sm mt-0.5">8.6%</div>
              </div>
              <div>
                <div className="text-gray-500 text-[10px] uppercase font-mono">Avg Monthly ROI</div>
                <div className="text-emerald-400 font-bold text-sm mt-0.5">+12.4%</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center pt-4 border-t border-gray-800 gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500 font-mono">Single Account License</div>
                <div className="text-2xl font-black text-white">$49 <span className="text-xs text-gray-400 font-normal">USD</span></div>
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                <button 
                  onClick={() => handleTryDemo('Eridam Nexus Adaptive Pro')}
                  className="flex-1 sm:flex-none bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs px-5 py-3 rounded-xl transition"
                >
                  Try Demo
                </button>
                <button 
                  onClick={() => setSelectedProduct({ title: 'ERIDAM NEXUS ADAPTIVE PRO', amountUsd: 49, priceNgn: 75000 })}
                  className="flex-1 sm:flex-none bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs px-6 py-3 rounded-xl transition shadow-lg shadow-emerald-500/10"
                >
                  Buy License
                </button>
              </div>
            </div>
          </div>

          {/* Popular Indicator */}
          <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 sm:p-8 space-y-6 hover:border-emerald-500/40 transition">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-mono uppercase px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/30 font-bold">
                  Popular Indicator
                </span>
                <h3 className="text-2xl font-black text-white mt-3">Z-Score Volatility Envelope Indicator</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Custom MT5 indicator mapping real-time standard deviation breakouts with adaptive ALMA moving average filters.
                </p>
              </div>
              <span className="text-xs font-mono text-gray-500">v1.1</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#0B1120] p-4 rounded-2xl border border-gray-800/80 text-xs">
              <div>
                <div className="text-gray-500 text-[10px] uppercase font-mono">Signal Accuracy</div>
                <div className="text-emerald-400 font-bold text-sm mt-0.5">81.0%</div>
              </div>
              <div>
                <div className="text-gray-500 text-[10px] uppercase font-mono">Timeframes</div>
                <div className="text-white font-bold text-sm mt-0.5">M15 - H4</div>
              </div>
              <div>
                <div className="text-gray-500 text-[10px] uppercase font-mono">Alert Types</div>
                <div className="text-gray-300 font-bold text-sm mt-0.5">Push & Sound</div>
              </div>
              <div>
                <div className="text-gray-500 text-[10px] uppercase font-mono">Repaint Status</div>
                <div className="text-emerald-400 font-bold text-sm mt-0.5">Zero Repaint</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center pt-4 border-t border-gray-800 gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500 font-mono">Single Account License</div>
                <div className="text-2xl font-black text-white">$25 <span className="text-xs text-gray-400 font-normal">USD</span></div>
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                <button 
                  onClick={() => handleTryDemo('Z-Score Volatility Envelope Indicator')}
                  className="flex-1 sm:flex-none bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs px-5 py-3 rounded-xl transition"
                >
                  Try Demo
                </button>
                <button 
                  onClick={() => setSelectedProduct({ title: 'Z-Score Volatility Envelope Indicator', amountUsd: 25, priceNgn: 38000 })}
                  className="flex-1 sm:flex-none bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs px-6 py-3 rounded-xl transition shadow-lg shadow-emerald-500/10"
                >
                  Buy License
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Checkout Modal Overlay matching Video */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-gray-800 rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => setSelectedProduct(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white text-lg font-mono"
            >
              ✕
            </button>

            <div>
              <h3 className="text-lg font-black text-white">License: {selectedProduct.title}</h3>
              <p className="text-xs text-emerald-400 font-mono font-bold mt-1">
                Amount: ${selectedProduct.amountUsd} USD
              </p>
            </div>

            <form onSubmit={handleCheckoutSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                  EMAIL ADDRESS (FOR FILE DELIVERY)
                </label>
                <input 
                  type="email" 
                  placeholder="trader@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                  MT5 TRADING ACCOUNT NUMBER
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. 849201"
                  value={mt5Account}
                  onChange={(e) => setMt5Account(e.target.value)}
                  required
                  className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition font-mono"
                />
              </div>

              <div className="bg-[#0B1120] p-4 rounded-xl border border-gray-800/80 text-[11px] text-gray-400 space-y-1">
                <div className="text-emerald-400 font-bold flex items-center gap-1">
                  <span>🛡️</span> Protected Checkout
                </div>
                <p>• Automatic license binding to your MT5 account.</p>
                <p>• Instant email delivery of compiled '.ex5' file.</p>
              </div>

              <button 
                type="submit" 
                disabled={paying}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-3.5 rounded-xl transition shadow-lg shadow-emerald-500/10"
              >
                {paying ? 'Processing...' : `Pay $${selectedProduct.amountUsd} USD via Paystack`}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
