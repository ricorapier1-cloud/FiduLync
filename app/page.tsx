'use client'
import React, { useState } from 'react'

// --- Product Data ---
const PRODUCTS = [
  {
    id: 'eridam-nexus',
    tag: 'Flagship EA',
    version: 'v2.4',
    title: 'ERIDAM NEXUS ADAPTIVE PRO',
    description: 'Quantitative MT5 EA featuring Kaufman Efficiency Ratio filtering, dynamic ATR envelopes, and high-watermark equity shield.',
    stats: [
      { label: 'HISTORICAL WIN RATE', value: '74.2%', color: 'text-emerald-400' },
      { label: 'PROFIT FACTOR', value: '2.14', color: 'text-emerald-400' },
      { label: 'MAX DRAWDOWN', value: '8.6%', color: 'text-emerald-400' },
      { label: 'AVG MONTHLY ROI', value: '+12.4%', color: 'text-emerald-400' },
    ],
    price: 49,
    demoFile: 'Eridam_Nexus_Demo.ex5'
  },
  {
    id: 'z-score-indicator',
    tag: 'Popular Indicator',
    version: 'v1.1',
    title: 'Z-Score Volatility Envelope Indicator',
    description: 'Custom MT5 indicator mapping real-time standard deviation breakouts with adaptive ALMA moving average filters.',
    stats: [
      { label: 'SIGNAL ACCURACY', value: '81.0%', color: 'text-emerald-400' },
      { label: 'TIMEFRAMES', value: 'M15 - H4', color: 'text-white' },
      { label: 'ALERT TYPES', value: 'Push & Sound', color: 'text-white' },
      { label: 'REPAINT STATUS', value: 'Zero Repaint', color: 'text-white' },
    ],
    price: 25,
    demoFile: 'Z_Score_Demo.ex5'
  }
]

export default function AlgolyncStore() {
  const [selectedProduct, setSelectedProduct] = useState<typeof PRODUCTS[0] | null>(null)
  const [email, setEmail] = useState('')
  const [mt5Account, setMt5Account] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // Trigger Demo Download
  const handleDemoDownload = (fileName: string) => {
    // In production, replace this with your actual .ex5 file URL
    const blob = new Blob(['Demo EA Content'], { type: 'application/octet-stream' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  // Handle Paystack Checkout Form Submit
  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsProcessing(true)
    
    // TODO: Connect to your Paystack /api/paystack/initialize route here
    // Example: await fetch('/api/paystack/initialize', { body: JSON.stringify({ email, amount: selectedProduct?.price })})
    
    setTimeout(() => {
      alert(`Connecting to Paystack for ${email} on MT5 Account: ${mt5Account}`)
      setIsProcessing(false)
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-[#070B14] text-white font-sans selection:bg-emerald-500/30 pb-20 relative">
      
      {/* --- HEADER --- */}
      <header className="max-w-3xl mx-auto px-4 pt-12 pb-10 text-center space-y-4">
        <h3 className="text-emerald-400 text-xs font-black tracking-[0.2em] uppercase">Algolync Quant Suite</h3>
        <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">MQL5 Trading <br/> Systems</h1>
        <p className="text-gray-400 text-sm max-w-md mx-auto">
          Institutional-grade MetaTrader 5 tools with automated instant delivery.
        </p>

        {/* Trust Badges */}
        <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-6 mt-6 pt-4 border-t border-gray-800/50">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-300">
            <span className="text-emerald-400">🔒</span> 256-Bit SSL Encrypted
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-300">
            <span className="text-emerald-400">🛡️</span> Secured by Paystack
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-300">
            <span className="text-emerald-400">⚡</span> Instant File Delivery
          </div>
        </div>
      </header>

      {/* --- PRODUCT GRID --- */}
      <main className="max-w-2xl mx-auto px-4 space-y-6">
        {PRODUCTS.map((product) => (
          <div key={product.id} className="bg-[#111827] border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            
            {/* Top Tags */}
            <div className="flex justify-between items-center mb-4">
              <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase px-2.5 py-1 rounded-full border border-emerald-500/20 tracking-wider">
                {product.tag}
              </span>
              <span className="text-gray-500 text-xs font-mono font-bold">{product.version}</span>
            </div>

            {/* Title & Description */}
            <h2 className="text-2xl font-black text-white mb-2">{product.title}</h2>
            <p className="text-sm text-gray-400 leading-relaxed mb-6">
              {product.description}
            </p>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 bg-[#0B1120] p-4 rounded-2xl border border-gray-800 mb-6">
              {product.stats.map((stat, idx) => (
                <div key={idx}>
                  <div className="text-[10px] font-bold text-gray-500 mb-1">{stat.label}</div>
                  <div className={`text-lg font-black ${stat.color}`}>{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Price & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6">
              <div>
                <div className="text-[11px] text-gray-400 font-bold mb-1">Single Account License</div>
                <div className="text-3xl font-black text-emerald-400 flex items-baseline gap-1">
                  ${product.price} <span className="text-sm text-gray-500">USD</span>
                </div>
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                <button 
                  onClick={() => handleDemoDownload(product.demoFile)}
                  className="flex-1 sm:flex-none bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 px-5 rounded-xl text-sm transition flex items-center justify-center gap-2"
                >
                  <span>⬇️</span> Try Demo
                </button>
                <button 
                  onClick={() => setSelectedProduct(product)}
                  className="flex-1 sm:flex-none bg-emerald-500 hover:bg-emerald-400 text-black font-black py-3 px-6 rounded-xl text-sm transition shadow-lg shadow-emerald-500/20"
                >
                  Buy License
                </button>
              </div>
            </div>
          </div>
        ))}
      </main>

      {/* --- FLOATING CHAT BUTTON --- */}
      <button className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-500/40 hover:scale-105 transition-transform z-40">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>

      {/* --- CHECKOUT MODAL --- */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#111827] w-full max-w-md rounded-3xl border border-gray-800 shadow-2xl overflow-hidden relative">
            
            {/* Modal Header */}
            <div className="bg-[#0B1120] p-5 border-b border-gray-800 flex justify-between items-start">
              <div>
                <h3 className="text-white font-bold text-lg leading-tight">License: {selectedProduct.title}</h3>
                <p className="text-emerald-400 text-sm font-bold mt-1">Amount: ${selectedProduct.price} USD</p>
              </div>
              <button 
                onClick={() => setSelectedProduct(null)}
                className="text-gray-500 hover:text-white p-1 rounded-full bg-gray-800/50 hover:bg-gray-800 transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Body & Form */}
            <form onSubmit={handleCheckout} className="p-5 space-y-5">
              
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase text-gray-400 tracking-wider">Email Address (For File Delivery)</label>
                <input 
                  required
                  type="email" 
                  placeholder="trader@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-sm text-white outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase text-gray-400 tracking-wider">MT5 Trading Account Number</label>
                <input 
                  required
                  type="number" 
                  placeholder="e.g. 849201"
                  value={mt5Account}
                  onChange={(e) => setMt5Account(e.target.value)}
                  className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-emerald-500 transition"
                />
              </div>

              {/* Security Notice */}
              <div className="bg-[#0B1120] border border-amber-500/20 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-500 text-xs font-bold uppercase">
                  <span>🔒</span> Protected Checkout
                </div>
                <ul className="text-[11px] text-gray-400 space-y-1.5 pl-1">
                  <li className="flex items-start gap-2">
                    <span className="text-gray-600">•</span> Automatic license binding to your MT5 account.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-600">•</span> Instant email delivery of compiled `.ex5` file.
                  </li>
                </ul>
              </div>

              <button 
                type="submit" 
                disabled={isProcessing}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black py-4 rounded-xl text-sm transition shadow-lg shadow-emerald-500/20 flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  `Pay $${selectedProduct.price} USD via Paystack`
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
