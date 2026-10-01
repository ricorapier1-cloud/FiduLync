'use client'

import { useState } from 'react'
import WhatsAppButton from '@/components/WhatsAppButton'

const NIGERIAN_BANKS = [
  'Access Bank',
  'First Bank of Nigeria',
  'GTBank (Guaranty Trust)',
  'Zenith Bank',
  'UBA (United Bank for Africa)',
  'Kuda Bank',
  'OPay',
  'PalmPay',
  'Moniepoint',
  'Stanbic IBTC',
  'Sterling Bank',
  'Wema Bank / ALAT',
]

export default function HomePage() {
  const [buyerPhone, setBuyerPhone] = useState('')
  const [sellerPhone, setSellerPhone] = useState('')
  const [sellerBankName, setSellerBankName] = useState(NIGERIAN_BANKS[0])
  const [sellerAccountNumber, setSellerAccountNumber] = useState('')
  const [itemName, setItemName] = useState('')
  const [itemDescription, setItemDescription] = useState('')
  const [currency, setCurrency] = useState('NGN')
  const [price, setPrice] = useState('')
  const [loading, setLoading] = useState(false)
  const [generatedLink, setGeneratedLink] = useState('')

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/escrow/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerPhone,
          sellerPhone,
          sellerBankName,
          sellerAccountNumber,
          itemName,
          itemDescription,
          currency,
          price: parseFloat(price),
        }),
      })

      const data = await res.json()
      if (data.slug) {
        setGeneratedLink(`${window.location.origin}/pay/${data.slug}`)
      } else {
        alert(data.error || 'Failed to generate Safe Link.')
      }
    } catch (err) {
      console.error(err)
      alert('An error occurred while creating link.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white font-sans p-4 md:p-8 relative flex flex-col items-center justify-center">
      <WhatsAppButton />

      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl">
        <div className="text-center mb-6">
          <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full border border-emerald-500/20">
            🛡️ SafeLync Protection
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-2">Create Safe Link</h1>
          <p className="text-slate-400 text-xs md:text-sm mt-1">
            Lock buyer funds securely in escrow until delivery is verified.
          </p>
        </div>

        {generatedLink ? (
          <div className="bg-slate-950 border border-emerald-500/30 rounded-2xl p-6 text-center space-y-4">
            <div className="text-emerald-400 font-bold text-lg">🎉 Safe Link Created!</div>
            <p className="text-xs text-slate-400">Send this link to your buyer to receive payment safely into escrow:</p>
            <input
              type="text"
              readOnly
              value={generatedLink}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-emerald-300 font-mono text-center focus:outline-none"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(generatedLink)
                alert('Copied to clipboard!')
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-xs transition-all"
            >
              📋 Copy Link
            </button>
            <button
              onClick={() => setGeneratedLink('')}
              className="text-xs text-slate-400 hover:text-white underline block mx-auto"
            >
              Create Another Link
            </button>
          </div>
        ) : (
          <form onSubmit={handleCreateLink} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-300 mb-1">Buyer's WhatsApp Phone</label>
              <input
                type="tel"
                required
                placeholder="e.g. 09117295774"
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-300 mb-1">Item Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. iPhone 14 Pro Max"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-300 mb-1">Item Description</label>
              <textarea
                rows={2}
                placeholder="e.g. Brand new, 256GB Deep Purple..."
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-300 mb-1">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="NGN">NGN (₦)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-bold uppercase text-slate-300 mb-1">Item Price *</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 650000"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Seller Payout Details */}
            <div className="pt-2 border-t border-slate-800/80">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-2">
                🏦 Seller Payout Bank Details
              </span>

              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-300 mb-1">Bank Name</label>
                    <select
                      value={sellerBankName}
                      onChange={(e) => setSellerBankName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      {NIGERIAN_BANKS.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-300 mb-1">Account Number (10 Digits)</label>
                    <input
                      type="text"
                      required
                      maxLength={10}
                      placeholder="0123456789"
                      value={sellerAccountNumber}
                      onChange={(e) => setSellerAccountNumber(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">Seller WhatsApp Phone</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 08037212445"
                    value={sellerPhone}
                    onChange={(e) => setSellerPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl text-sm transition-all shadow-xl mt-4"
            >
              {loading ? 'Generating Safe Link...' : '🔒 Create Safe Link'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
