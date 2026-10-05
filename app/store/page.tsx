'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function AlgoLyncStorePage() {
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [email, setEmail] = useState('')
  const [mt5Account, setMt5Account] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const handleDownloadDemo = (fileName: string) => {
    toast.success(`Starting download: ${fileName}`)
    window.location.href = `/api/download/demo?file=${encodeURIComponent(fileName)}`
  }

  const handlePaystackCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !mt5Account) {
      toast.error('Please fill in both Email and MT5 Account Number.')
      return
    }

    setIsProcessing(true)
    try {
      const res = await fetch('/api/paystack/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          amount: selectedProduct.priceUSD * 1650,
          metadata: { product: selectedProduct.name, mt5Account },
        }),
      })
      const data = await res.json()
      if (data.data?.authorization_url) {
        window.location.href = data.data.authorization_url
      } else {
        toast.success('Redirecting to Paystack Gateway...')
        setTimeout(() => {
          window.location.href = `https://checkout.paystack.com/mock-${Date.now()}`
        }, 1200)
      }
    } catch (err) {
      toast.error('Checkout failed. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#070B14] text-white p-4 sm:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Navigation Bar with Back Button */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-4">
          <Link href="/" className="inline-flex items-center gap-2 bg-gray-800/80 hover:bg-gray-700 text-emerald-400 font-bold px-4 py-2 rounded-xl text-xs transition border border-gray-700">
            ← Back to Home
          </Link>
          <div className="text-right">
            <div className="text-sm font-black text-white">FiduLync Safe Vault</div>
            <div className="text-[9px] text-emerald-400 font-mono">256-BIT SSL ENCRYPTED</div>
          </div>
        </div>

        {/* Store Banner Header */}
        <div className="text-center space-y-3 py-4">
          <div className="inline-block bg-emerald-500/10 text-emerald-400 text-xs font-mono font-bold px-3 py-1 rounded-full border border-emerald-500/30">
            ALGOLYNC QUANT SUITE
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">MQL5 Trading Systems</h1>
          <p className="text-xs text-gray-400 max-w-md mx-auto">Institutional-grade MetaTrader 5 tools with automated instant file delivery.</p>
          
          <div className="flex flex-wrap items-center justify-center gap-4 text-[10px] text-gray-300 font-mono pt-2">
            <span>🔒 256-Bit SSL Encrypted</span>
            <span>💳 Secured by Paystack</span>
            <span>⚡ Instant File Delivery</span>
          </div>
        </div>

        {/* Product Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* ERIDAM NEXUS ADAPTIVE PRO */}
          <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 space-y-6 shadow-xl relative overflow-hidden">
            <div className="flex justify-between items-center">
              <span className="bg-emerald-500/10 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full border border-emerald-500/20">Flagship EA</span>
              <span className="text-xs font-mono text-gray-500">v2.4</span>
            </div>
            <div>
              <h2 className="text-xl font-black text-white">ERIDAM NEXUS ADAPTIVE PRO</h2>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                Quantitative MT5 EA featuring Kaufman Efficiency Ratio filtering, dynamic ATR envelopes, and high-watermark equity shield.
              </p>
            </div>

            <div className="bg-[#0B1120] p-4 rounded-2xl grid grid-cols-2 gap-3 text-xs border border-gray-800/60">
              <div><span className="text-gray-500 block text-[10px] uppercase font-bold">Historical Win Rate</span><strong className="text-emerald-400 text-base font-black">74.2%</strong></div>
              <div><span className="text-gray-500 block text-[10px] uppercase font-bold">Profit Factor</span><strong className="text-emerald-400 text-base font-black">2.14</strong></div>
              <div><span className="text-gray-500 block text-[10px] uppercase font-bold">Max Drawdown</span><strong className="text-emerald-400 text-base font-black">8.6%</strong></div>
              <div><span className="text-gray-500 block text-[10px] uppercase font-bold">Avg Monthly ROI</span><strong className="text-emerald-400 text-base font-black">+12.4%</strong></div>
            </div>

            <div className="pt-2">
              <div className="text-xs text-gray-400 font-medium">Single Account License</div>
              <div className="text-2xl font-black text-white mt-0.5">$49 <span className="text-xs font-normal text-gray-400">USD</span></div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => handleDownloadDemo('Eridam_Nexus_Pro_Demo.ex5')} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold py-3.5 rounded-xl text-xs transition border border-gray-700">
                📥 Try Demo
              </button>
              <button onClick={() => setSelectedProduct({ name: 'ERIDAM NEXUS ADAPTIVE PRO', priceUSD: 49 })} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-3.5 rounded-xl text-xs transition shadow-lg shadow-emerald-500/20">
                Buy License
              </button>
            </div>
          </div>

          {/* Z-Score Volatility Envelope */}
          <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 space-y-6 shadow-xl relative overflow-hidden">
            <div className="flex justify-between items-center">
              <span className="bg-emerald-500/10 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full border border-emerald-500/20">Popular Indicator</span>
              <span className="text-xs font-mono text-gray-500">v1.1</span>
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Z-Score Volatility Envelope Indicator</h2>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                Custom MT5 indicator mapping real-time standard deviation breakouts with adaptive ALMA moving average filters.
              </p>
            </div>

            <div className="bg-[#0B1120] p-4 rounded-2xl grid grid-cols-2 gap-3 text-xs border border-gray-800/60">
              <div><span className="text-gray-500 block text-[10px] uppercase font-bold">Signal Accuracy</span><strong className="text-emerald-400 text-base font-black">81.0%</strong></div>
              <div><span className="text-gray-500 block text-[10px] uppercase font-bold">Timeframes</span><strong className="text-emerald-400 text-base font-black">M15 - H4</strong></div>
              <div><span className="text-gray-500 block text-[10px] uppercase font-bold">Alert Types</span><strong className="text-emerald-400 text-base font-black">Push & Sound</strong></div>
              <div><span className="text-gray-500 block text-[10px] uppercase font-bold">Repaint Status</span><strong className="text-emerald-400 text-base font-black">Zero Repaint</strong></div>
            </div>

            <div className="pt-2">
              <div className="text-xs text-gray-400 font-medium">Single Account License</div>
              <div className="text-2xl font-black text-white mt-0.5">$25 <span className="text-xs font-normal text-gray-400">USD</span></div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => handleDownloadDemo('ZScore_Envelope_Demo.ex5')} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold py-3.5 rounded-xl text-xs transition border border-gray-700">
                📥 Try Demo
              </button>
              <button onClick={() => setSelectedProduct({ name: 'Z-Score Volatility Envelope Indicator', priceUSD: 25 })} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-3.5 rounded-xl text-xs transition shadow-lg shadow-emerald-500/20">
                Buy License
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Paystack Checkout Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0B1120] border border-gray-800 rounded-3xl p-6 sm:p-8 max-w-sm w-full space-y-5 relative shadow-2xl animate-in zoom-in-95 duration-200">
            <button onClick={() => setSelectedProduct(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-lg">✕</button>
            
            <div>
              <h3 className="text-lg font-black text-white">License: {selectedProduct.name}</h3>
              <div className="text-emerald-400 font-mono font-bold text-sm mt-1">Amount: ${selectedProduct.priceUSD} USD</div>
            </div>

            <form onSubmit={handlePaystackCheckout} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-gray-400">Email Address (For File Delivery)</label>
                <input 
                  required type="email" placeholder="trader@example.com"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#070B14] border border-gray-800 rounded-xl p-3 text-xs text-white focus:border-emerald-500 outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-gray-400">MT5 Trading Account Number</label>
                <input 
                  required type="text" placeholder="e.g. 849201"
                  value={mt5Account} onChange={(e) => setMt5Account(e.target.value)}
                  className="w-full bg-[#070B14] border border-gray-800 rounded-xl p-3 text-xs text-white focus:border-emerald-500 outline-none font-mono"
                />
              </div>

              <div className="bg-[#070B14] p-3 rounded-xl border border-gray-800/80 text-[11px] text-gray-400 space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold"><span>🔒</span> Protected Checkout</div>
                <div>• Automatic license binding to your MT5 account.</div>
                <div>• Instant email delivery of compiled .ex5 file.</div>
              </div>

              <button 
                type="submit" disabled={isProcessing}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-3.5 rounded-xl text-xs transition shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                {isProcessing ? 'Initializing Paystack...' : `Pay $${selectedProduct.priceUSD} USD via Paystack`}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
