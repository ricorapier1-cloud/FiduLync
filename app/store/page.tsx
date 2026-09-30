'use client'

import { useState } from 'react'

interface Product {
  id: string
  name: string
  version: string
  description: string
  price: number
  fileSlug: string
  badge: string
}

const PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'ERIDAM NEXUS ADAPTIVE PRO',
    version: 'v2.4',
    description: 'Quantitative MT5 EA with Kaufman Efficiency Ratio filtering, dynamic ATR envelopes, and high-watermark equity shield.',
    price: 35000,
    fileSlug: 'eridam-nexus-pro',
    badge: 'Best Seller',
  },
  {
    id: '2',
    name: 'Z-Score Volatility Envelope Indicator',
    version: 'v1.1',
    description: 'Custom MT5 indicator mapping real-time standard deviation breakouts with adaptive ALMA moving average filters.',
    price: 15000,
    fileSlug: 'zscore-envelope-indicator',
    badge: 'Popular',
  },
]

export default function StorePage() {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [email, setEmail] = useState('')
  const [mt5Account, setMt5Account] = useState('')
  const [loading, setLoading] = useState(false)

  const handleBuy = (product: Product) => {
    setSelectedProduct(product)
  }

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProduct) return
    setLoading(true)

    // Trigger Paystack Live Checkout API
    alert(`Initiating checkout for ${selectedProduct.name} (₦${selectedProduct.price.toLocaleString()})`)
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white font-sans p-6">
      <div className="max-w-4xl mx-auto">
        <header className="py-8 border-b border-slate-800 text-center">
          <span className="text-xs uppercase tracking-widest text-emerald-400 font-bold">AlgoLync Quant Trading</span>
          <h1 className="text-3xl font-extrabold text-white mt-1">MQL5 EAs & Quantitative Tools</h1>
          <p className="text-slate-400 text-sm mt-2">Tested algorithmic trading tools with automated instant download.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          {PRODUCTS.map((prod) => (
            <div key={prod.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <span className="bg-emerald-500/10 text-emerald-400 text-xs font-semibold px-2.5 py-1 rounded-full">{prod.badge}</span>
                  <span className="text-xs font-mono text-slate-400">{prod.version}</span>
                </div>
                <h3 className="text-xl font-bold text-white">{prod.name}</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">{prod.description}</p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block">One-time License</span>
                  <span className="text-xl font-extrabold text-emerald-400">₦{prod.price.toLocaleString()}</span>
                </div>
                <button
                  onClick={() => handleBuy(prod)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all"
                >
                  Buy & Download
                </button>
              </div>
            </div>
          ))}
        </div>

        {selectedProduct && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md relative">
              <button onClick={() => setSelectedProduct(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white text-sm">✕</button>
              <h3 className="text-lg font-bold text-white">Checkout: {selectedProduct.name}</h3>
              <p className="text-xs text-emerald-400 font-semibold mb-4">Total: ₦{selectedProduct.price.toLocaleString()}</p>

              <form onSubmit={handleCheckout} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">Your Email (For Receipt & Delivery)</label>
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">MT5 Account Number (For License Locking)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 50921843"
                    value={mt5Account}
                    onChange={(e) => setMt5Account(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-sm transition-all"
                >
                  {loading ? 'Processing...' : 'Pay with Paystack'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
