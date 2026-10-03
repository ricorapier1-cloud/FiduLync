'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function HomePage() {
  const [formData, setFormData] = useState({
    title: '', description: '', amount: '', sellerPhone: '', buyerPhone: '',
    payoutBank: 'Access Bank', payoutAccount: ''
  })
  const [loading, setLoading] = useState(false)
  const [createdLink, setCreatedLink] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const handleAmountChange = (val: string) => {
    const raw = val.replace(/[^0-9]/g, '')
    setFormData(prev => ({ ...prev, amount: raw }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')
    setCreatedLink(null)
    try {
      const res = await fetch('/api/escrow/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to generate link')
      setCreatedLink(`${window.location.origin}/pay/${data.linkId}`)
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const formattedDisplayAmount = formData.amount ? Number(formData.amount).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' }) : '₦0.00'

  return (
    <div className="min-h-screen bg-[#0B1120] text-gray-100 selection:bg-emerald-500 selection:text-black">
      <header className="border-b border-gray-800/80 bg-[#0B1120]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 p-0.5 shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-[#0B1120] rounded-[10px] flex items-center justify-center font-black text-emerald-400">F</div>
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-emerald-400">FiduLync</span>
              <span className="hidden sm:inline-block ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">SAFE ESCROW</span>
            </div>
          </div>
          <nav className="flex items-center space-x-2 sm:space-x-4 text-xs sm:text-sm font-medium">
            <Link href="/verify" className="px-3 py-1.5 rounded-lg bg-gray-800/60 hover:bg-gray-800 text-gray-300 hover:text-white transition border border-gray-700/50">🛡️ Verify Link</Link>
            <Link href="/store" className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition border border-emerald-500/30">⚡ AlgoLync Store</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        <div className="text-center mb-10 space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
            <span>🔒 100% Scam Protection</span><span>•</span><span>2% Platform Fee</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">Create a <span className="text-emerald-400">Safe Payment</span> Link</h1>
          <p className="text-gray-400 text-sm sm:text-base max-w-xl mx-auto">Lock buyer funds securely in escrow. Funds are automatically disbursed to the seller upon verified delivery.</p>
        </div>

        <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-emerald-500" />
          {createdLink ? (
            <div className="text-center py-6 space-y-6">
              <div className="w-16 h-16 bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 rounded-full flex items-center justify-center text-3xl mx-auto animate-bounce">✓</div>
              <div>
                <h3 className="text-2xl font-bold text-white mb-2">Safe Link Generated!</h3>
                <p className="text-gray-400 text-sm">Send this link to your buyer to receive escrow-protected payment.</p>
              </div>
              <div className="p-4 bg-[#0B1120] border border-gray-800 rounded-2xl flex items-center justify-between gap-2">
                <input type="text" readOnly value={createdLink} className="bg-transparent text-emerald-400 text-sm font-mono w-full focus:outline-none" />
                <button onClick={() => navigator.clipboard.writeText(createdLink)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-semibold whitespace-nowrap transition">Copy</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <a href={`https://wa.me/?text=${encodeURIComponent(`Hello! Please use this safe FiduLync escrow link to complete payment securely: ${createdLink}`)}`} target="_blank" rel="noopener noreferrer" className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold py-3.5 px-6 rounded-xl transition flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/20">
                  <span>💬 Share on WhatsApp</span>
                </a>
                <button onClick={() => setCreatedLink(null)} className="w-full bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3.5 px-6 rounded-xl transition">Create Another Link</button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {errorMsg && <div className="p-4 rounded-xl bg-red-950/50 border border-red-500/50 text-red-300 text-sm">⚠️ {errorMsg}</div>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">Item Name *</label>
                  <input type="text" required placeholder="e.g. iPhone 14 Pro Max" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full bg-[#1F2937] border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">Item Price (NGN) *</label>
                  <div className="relative">
                    <input type="text" required placeholder="e.g. 250000" value={formData.amount} onChange={e => handleAmountChange(e.target.value)} className="w-full bg-[#1F2937] border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition font-mono" />
                    <div className="absolute right-3 top-3 text-xs font-bold text-emerald-400">{formattedDisplayAmount}</div>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">Item Description (Optional)</label>
                <textarea rows={2} placeholder="Brand new condition..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full bg-[#1F2937] border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition" />
              </div>
              <div className="border-t border-gray-800 pt-6">
                <h4 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-4 flex items-center gap-2"><span>🏦 Seller Payout Account</span></h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Bank Name</label>
                    <select value={formData.payoutBank} onChange={e => setFormData({ ...formData, payoutBank: e.target.value })} className="w-full bg-[#1F2937] border border-gray-700 rounded-xl px-3 py-3 text-white focus:outline-none focus:border-emerald-500">
                      <option value="Access Bank">Access Bank</option><option value="GTBank">Guaranty Trust Bank</option><option value="First Bank">First Bank</option><option value="UBA">United Bank for Africa</option><option value="Zenith Bank">Zenith Bank</option><option value="OPay">OPay Digital</option><option value="Moniepoint">Moniepoint Microfinance</option><option value="Kuda Bank">Kuda Bank</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Account Number</label>
                    <input type="text" maxLength={10} placeholder="0123456789" value={formData.payoutAccount} onChange={e => setFormData({ ...formData, payoutAccount: e.target.value })} className="w-full bg-[#1F2937] border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 font-mono" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">WhatsApp Phone</label>
                    <input type="text" placeholder="08012345678" value={formData.sellerPhone} onChange={e => setFormData({ ...formData, sellerPhone: e.target.value })} className="w-full bg-[#1F2937] border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 font-mono" />
                  </div>
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-base py-4 px-6 rounded-2xl transition shadow-xl shadow-emerald-500/20 disabled:opacity-50">
                {loading ? 'Generating Safe Link...' : 'Create Safe Link'}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
