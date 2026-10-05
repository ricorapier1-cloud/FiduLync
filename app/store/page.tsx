'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function AlgoLyncStorePage() {
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [email, setEmail] = useState('')
  const [mt5Account, setMt5Account] = useState('')
  const [agreedDigital, setAgreedDigital] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleDownloadDemo = (fileName: string) => {
    toast.success(`Downloading demo file: ${fileName}`)
    window.location.href = `/api/download/demo?file=${encodeURIComponent(fileName)}`
  }

  const handlePaystackCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!agreedDigital) {
      toast.error('You must acknowledge the digital goods and risk policy.')
      return
    }
    if (!email || !mt5Account) {
      toast.error('Email and MT5 Account number are required.')
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
      if (data.data?.authorization_url) window.location.href = data.data.authorization_url
      else toast.error(data.error || 'Payment initialization failed.')
    } catch (err) {
      toast.error('Checkout error. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#070B14] text-white p-4 sm:p-8 font-sans flex flex-col">
      <div className="max-w-4xl mx-auto space-y-6 flex-grow w-full">
        
        <div className="flex items-center justify-between border-b border-gray-800 pb-4">
          <Link href="/" className="inline-flex items-center gap-2 bg-gray-800 text-emerald-400 font-bold px-4 py-2 rounded-xl text-xs transition border border-gray-700">
            ← Back to Escrow
          </Link>
          <div className="text-right">
            <div className="text-sm font-black text-white">AlgoLync Store</div>
            <div className="text-[9px] text-emerald-400 font-mono">NON-REFUNDABLE DIGITAL GOODS</div>
          </div>
        </div>

        <div className="text-center space-y-3 py-4">
          <div className="inline-block bg-emerald-500/10 text-emerald-400 text-xs font-mono font-bold px-3 py-1 rounded-full border border-emerald-500/30">
            QUANTITATIVE TRADING SYSTEMS
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">MQL5 Expert Advisors</h1>
          <p className="text-xs text-gray-400 max-w-md mx-auto">Institutional-grade tools. Past performance does not guarantee future results.</p>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
          
          {/* ERIDAM NEXUS */}
          <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 space-y-6 shadow-xl relative overflow-hidden">
            <div className="flex justify-between items-center">
              <span className="bg-emerald-500/10 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full border border-emerald-500/20">Flagship EA</span>
              <span className="text-xs font-mono text-gray-500">v2.4</span>
            </div>
            <div>
              <h2 className="text-xl font-black text-white">ERIDAM NEXUS ADAPTIVE PRO</h2>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">Quantitative MT5 EA featuring Kaufman Efficiency Ratio filtering and dynamic ATR envelopes.</p>
            </div>
            <div className="pt-2">
              <div className="text-xs text-gray-400 font-medium">Single Account License</div>
              <div className="text-2xl font-black text-white mt-0.5">$49 <span className="text-xs font-normal text-gray-400">USD</span></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => handleDownloadDemo('Eridam_Nexus_Pro_Demo.ex5')} className="flex-1 bg-gray-800 text-white font-bold py-3.5 rounded-xl text-xs border border-gray-700">📥 Try Demo</button>
              <button onClick={() => setSelectedProduct({ name: 'ERIDAM NEXUS ADAPTIVE PRO', priceUSD: 49 })} className="flex-1 bg-emerald-500 text-black font-extrabold py-3.5 rounded-xl text-xs">Buy License</button>
            </div>
          </div>

          {/* Z-SCORE ENVELOPE */}
          <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 space-y-6 shadow-xl relative overflow-hidden">
            <div className="flex justify-between items-center">
              <span className="bg-emerald-500/10 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full border border-emerald-500/20">Indicator</span>
              <span className="text-xs font-mono text-gray-500">v1.1</span>
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Z-Score Volatility Envelope</h2>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">Custom MT5 indicator mapping standard deviation breakouts with ALMA moving average filters.</p>
            </div>
            <div className="pt-2">
              <div className="text-xs text-gray-400 font-medium">Single Account License</div>
              <div className="text-2xl font-black text-white mt-0.5">$25 <span className="text-xs font-normal text-gray-400">USD</span></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => handleDownloadDemo('ZScore_Envelope_Demo.ex5')} className="flex-1 bg-gray-800 text-white font-bold py-3.5 rounded-xl text-xs border border-gray-700">📥 Try Demo</button>
              <button onClick={() => setSelectedProduct({ name: 'Z-Score Volatility Envelope', priceUSD: 25 })} className="flex-1 bg-emerald-500 text-black font-extrabold py-3.5 rounded-xl text-xs">Buy License</button>
            </div>
          </div>

        </div>
      </div>

      {/* STRICT CFTC/NFA RISK DISCLAIMER FOOTER */}
      <footer className="w-full bg-[#0B1120] border-t border-gray-800 mt-8 py-8 px-4">
        <div className="max-w-4xl mx-auto text-[9px] text-gray-500 leading-relaxed space-y-3 text-justify">
          <p><strong className="text-gray-400">CFTC RULE 4.41 - HYPOTHETICAL OR SIMULATED PERFORMANCE RESULTS HAVE CERTAIN LIMITATIONS.</strong> UNLIKE AN ACTUAL PERFORMANCE RECORD, SIMULATED RESULTS DO NOT REPRESENT ACTUAL TRADING. ALSO, SINCE THE TRADES HAVE NOT BEEN EXECUTED, THE RESULTS MAY HAVE UNDER-OR-OVER COMPENSATED FOR THE IMPACT, IF ANY, OF CERTAIN MARKET FACTORS, SUCH AS LACK OF LIQUIDITY.</p>
          <p>Trading foreign exchange on margin carries a high level of risk and may not be suitable for all investors. FiduLync, AlgoLync, and its administrators are software developers, not registered financial advisors. All tools provided are for educational and analytical purposes only. You assume full responsibility for your trading activities and hold the platform harmless against any financial losses.</p>
        </div>
      </footer>

      {/* Paystack Checkout Modal with Waiver */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0B1120] border border-gray-800 rounded-3xl p-6 sm:p-8 max-w-sm w-full space-y-5 relative shadow-2xl">
            <button onClick={() => setSelectedProduct(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-lg">✕</button>
            
            <div>
              <h3 className="text-lg font-black text-white">License: {selectedProduct.name}</h3>
              <div className="text-emerald-400 font-mono font-bold text-sm mt-1">Amount: ${selectedProduct.priceUSD} USD</div>
            </div>

            <form onSubmit={handlePaystackCheckout} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400">Email Address (For File Delivery)</label>
                <input required type="email" placeholder="trader@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-[#070B14] border border-gray-800 rounded-xl p-3 text-xs text-white focus:border-emerald-500 outline-none font-mono" />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400">MT5 Trading Account Number</label>
                <input required type="text" placeholder="e.g. 849201" value={mt5Account} onChange={(e) => setMt5Account(e.target.value)} className="w-full bg-[#070B14] border border-gray-800 rounded-xl p-3 text-xs text-white focus:border-emerald-500 outline-none font-mono" />
              </div>

              {/* Digital Goods Liability Waiver */}
              <label className="flex items-start gap-2 cursor-pointer bg-red-500/10 border border-red-500/20 p-3 rounded-xl mt-2">
                <input type="checkbox" checked={agreedDigital} onChange={(e) => setAgreedDigital(e.target.checked)} className="mt-0.5 rounded text-emerald-500 accent-emerald-500" />
                <span className="text-[9px] text-gray-300 leading-tight"><strong>Digital Goods Waiver:</strong> I understand that EAs are digital compiled files (`.ex5`). Because source access and account bindings cannot be revoked once issued, <strong>I agree this purchase is 100% NON-REFUNDABLE</strong>. I waive my right to file bank chargebacks for this software.</span>
              </label>

              <button type="submit" disabled={isProcessing} className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-3.5 rounded-xl text-xs disabled:opacity-50 mt-2">
                {isProcessing ? 'Connecting to Paystack...' : `Pay $${selectedProduct.priceUSD} USD via Paystack`}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
