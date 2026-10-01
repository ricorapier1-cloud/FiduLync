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
          price: parseFloat(price || '0'),
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

  const formattedPrice = price
    ? new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: currency,
        maximumFractionDigits: 0,
      }).format(parseFloat(price))
    : currency === 'NGN' ? '₦0' : '$0'

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans relative overflow-hidden flex flex-col justify-between selection:bg-emerald-500 selection:text-slate-950">
      <WhatsAppButton />

      {/* Ambient Radial Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-emerald-500/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[300px] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Top Navigation Bar */}
      <header className="w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <svg className="w-5 h-5 text-slate-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <span className="text-lg font-black tracking-tight text-white block leading-none">veriPay</span>
            <span className="text-[10px] font-semibold text-emerald-400 tracking-wider uppercase">Safe Escrow Protection</span>
          </div>
        </div>

        <a
          href="/store"
          className="bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-1.5"
        >
          <span>📈 AlgoLync Store</span>
          <span>→</span>
        </a>
      </header>

      {/* Main Content Area */}
      <div className="w-full max-w-6xl mx-auto px-4 py-4 md:py-8 z-10 flex-1 flex flex-col justify-center">
        
        {/* Trust Metrics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-900/80 border border-slate-800/80 p-4 rounded-2xl backdrop-blur-md mb-8 text-center">
          <div className="p-2 border-r border-slate-800/60 last:border-0">
            <div className="text-lg md:text-xl font-black text-emerald-400 font-mono">100%</div>
            <div className="text-[10px] md:text-xs text-slate-400 uppercase font-medium mt-0.5">Scam Protection</div>
          </div>
          <div className="p-2 border-r border-slate-800/60 last:border-0">
            <div className="text-lg md:text-xl font-black text-white font-mono">&lt; 2 Mins</div>
            <div className="text-[10px] md:text-xs text-slate-400 uppercase font-medium mt-0.5">Average Bank Payout</div>
          </div>
          <div className="p-2 border-r border-slate-800/60 last:border-0">
            <div className="text-lg md:text-xl font-black text-teal-400 font-mono">2%</div>
            <div className="text-[10px] md:text-xs text-slate-400 uppercase font-medium mt-0.5">Platform Fee</div>
          </div>
          <div className="p-2">
            <div className="text-lg md:text-xl font-black text-cyan-400 font-mono">Paystack</div>
            <div className="text-[10px] md:text-xs text-slate-400 uppercase font-medium mt-0.5">Secured Gateway</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Form & Title */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                ✨ Zero Risk Social Commerce
              </div>
              <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
                Create a <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">Safe Payment Link</span>
              </h1>
              <p className="text-slate-400 text-sm md:text-base leading-relaxed">
                Lock buyer funds securely in escrow. Funds are automatically transferred to the seller's bank account once delivery is confirmed.
              </p>
            </div>

            {/* How It Works Micro-Steps */}
            <div className="grid grid-cols-3 gap-2 bg-slate-900/60 border border-slate-800/80 p-3 rounded-2xl backdrop-blur-md">
              <div className="text-center p-2 rounded-xl bg-slate-950/40">
                <div className="text-emerald-400 font-bold text-xs mb-0.5">1. Generate</div>
                <div className="text-[10px] text-slate-400">Create & send link</div>
              </div>
              <div className="text-center p-2 rounded-xl bg-slate-950/40">
                <div className="text-teal-400 font-bold text-xs mb-0.5">2. Buyer Pays</div>
                <div className="text-[10px] text-slate-400">Money locked safely</div>
              </div>
              <div className="text-center p-2 rounded-xl bg-slate-950/40">
                <div className="text-cyan-400 font-bold text-xs mb-0.5">3. Release</div>
                <div className="text-[10px] text-slate-400">Instant bank payout</div>
              </div>
            </div>

            {/* Form Card */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-xl relative">
              {generatedLink ? (
                <div className="bg-slate-950/80 border border-emerald-500/40 rounded-2xl p-6 text-center space-y-4">
                  <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto text-emerald-400 text-xl font-bold">
                    ✓
                  </div>
                  <div>
                    <h3 className="text-emerald-400 font-bold text-lg">Safe Link Ready!</h3>
                    <p className="text-xs text-slate-400 mt-1">Send this link to the buyer to complete payment safely:</p>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      value={generatedLink}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3.5 pr-24 text-xs text-emerald-300 font-mono focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedLink)
                        alert('Link copied to clipboard!')
                      }}
                      className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition-all"
                    >
                      Copy
                    </button>
                  </div>
                  <button
                    onClick={() => setGeneratedLink('')}
                    className="text-xs text-slate-400 hover:text-white underline block mx-auto pt-2"
                  >
                    Create Another Safe Link
                  </button>
                </div>
              ) : (
                <form onSubmit={handleCreateLink} className="space-y-5">
                  {/* Buyer WhatsApp */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Buyer's WhatsApp Phone *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 text-sm">📱</div>
                      <input
                        type="tel"
                        required
                        placeholder="09117295774"
                        value={buyerPhone}
                        onChange={(e) => setBuyerPhone(e.target.value)}
                        className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                      />
                    </div>
                  </div>

                  {/* Item Name */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Item Name *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 text-sm">📦</div>
                      <input
                        type="text"
                        required
                        placeholder="e.g. iPhone 14 Pro Max"
                        value={itemName}
                        onChange={(e) => setItemName(e.target.value)}
                        className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Item Description
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Brand new, 256GB Deep Purple, original box included..."
                      value={itemDescription}
                      onChange={(e) => setItemDescription(e.target.value)}
                      className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all resize-none"
                    />
                  </div>

                  {/* Price & Currency */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">Currency</label>
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                      >
                        <option value="NGN">NGN (₦)</option>
                        <option value="USD">USD ($)</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">Item Price *</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 text-sm font-bold">
                          {currency === 'NGN' ? '₦' : '$'}
                        </div>
                        <input
                          type="number"
                          required
                          placeholder="650000"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-8 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Seller Bank Details */}
                  <div className="pt-4 border-t border-slate-800/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                        🏦 Seller Payout Account
                      </span>
                      <span className="text-[10px] text-slate-400">Where seller gets paid</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">Bank Name</label>
                        <select
                          value={sellerBankName}
                          onChange={(e) => setSellerBankName(e.target.value)}
                          className="w-full bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                        >
                          {NIGERIAN_BANKS.map((b) => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">Account Number (10 Digits)</label>
                        <input
                          type="text"
                          required
                          maxLength={10}
                          placeholder="0123456789"
                          value={sellerAccountNumber}
                          onChange={(e) => setSellerAccountNumber(e.target.value)}
                          className="w-full bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">Seller WhatsApp Phone</label>
                      <input
                        type="tel"
                        required
                        placeholder="08037212445"
                        value={sellerPhone}
                        onChange={(e) => setSellerPhone(e.target.value)}
                        className="w-full bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold py-4 rounded-xl text-sm transition-all shadow-xl shadow-emerald-500/20 active:scale-[0.99] disabled:opacity-50 mt-2"
                  >
                    {loading ? 'Creating Safe Link...' : '🔒 Generate Safe Link'}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Right Column: Dynamic Live Preview Card */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl space-y-6 sticky top-8">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Live Deal Summary</span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-semibold">
                  Escrow Protected
                </span>
              </div>

              {/* Item Card Preview */}
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider">Item</div>
                  <div className="text-lg font-bold text-white mt-0.5">
                    {itemName || 'Item Name Placeholder'}
                  </div>
                  {itemDescription && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{itemDescription}</p>
                  )}
                </div>

                <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-slate-400">Total Amount</div>
                    <div className="text-2xl font-black text-emerald-400 font-mono">{formattedPrice}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-slate-400">Buyer Phone</div>
                    <div className="text-xs font-mono text-slate-200">{buyerPhone || 'Not entered'}</div>
                  </div>
                </div>

                {sellerAccountNumber && (
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-3.5 space-y-1">
                    <div className="text-[10px] font-bold uppercase text-emerald-400">Target Payout Account</div>
                    <div className="text-xs text-slate-200 font-semibold">{sellerBankName}</div>
                    <div className="text-xs font-mono text-slate-400">{sellerAccountNumber}</div>
                  </div>
                )}
              </div>

              {/* Security Metrics */}
              <div className="space-y-2 pt-2 border-t border-slate-800/80 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>Funds held safely until delivery is confirmed</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>Instant automated transfer to seller account</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>24/7 Dispute resolution via WhatsApp</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Modern Footer */}
      <footer className="w-full border-t border-slate-900 py-6 text-center text-xs text-slate-400 z-10">
        © 2026 veriPay SafeLync. Built for secure social commerce.
      </footer>
    </main>
  )
}
