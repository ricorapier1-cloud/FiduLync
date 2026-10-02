'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function VerifyPage() {
  const [inputLink, setInputLink] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputLink) return
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link: inputLink })
      })
      const data = await res.json()
      setResult(data)
    } catch (err) {
      setResult({ verified: false, message: 'Verification lookup failed. Check your network connection.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0B1120] text-white p-6 flex flex-col items-center justify-center">
      <div className="max-w-xl w-full bg-[#111827] border border-gray-800 rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xl">
            ✓
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">FiduLync Link Verifier</h1>
            <p className="text-gray-400 text-sm">Protect yourself against phishing and fake escrow links</p>
          </div>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
              Paste FiduLync Link or ID
            </label>
            <input
              type="text"
              value={inputLink}
              onChange={(e) => setInputLink(e.target.value)}
              placeholder="e.g. [https://fidulync.vercel.app/pay/abc12345](https://fidulync.vercel.app/pay/abc12345) or abc12345"
              className="w-full bg-[#1F2937] border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-semibold py-3 px-6 rounded-xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            {loading ? 'Verifying Link...' : 'Verify Authenticity'}
          </button>
        </form>

        {result && (
          <div className={`mt-6 p-5 rounded-xl border ${result.verified ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200' : 'bg-red-950/40 border-red-500/40 text-red-200'}`}>
            <div className="flex items-center space-x-2 font-bold text-lg mb-2">
              <span>{result.verified ? '🛡️ Official FiduLync Escrow' : '⚠️ Unverified Link Alert'}</span>
            </div>
            <p className="text-sm mb-4">{result.message}</p>

            {result.verified && result.escrow && (
              <div className="bg-[#0B1120] p-4 rounded-lg text-sm space-y-3 border border-emerald-500/20 mb-4">
                <div className="flex justify-between border-b border-gray-800 pb-2"><span className="text-gray-400">Item:</span><span className="font-semibold text-white">{result.escrow.title}</span></div>
                <div className="flex justify-between border-b border-gray-800 pb-2"><span className="text-gray-400">Amount:</span><span className="font-semibold text-white">₦{result.escrow.amount.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Seller Phone:</span><span className="font-semibold text-white">{result.escrow.sellerPhone}</span></div>
              </div>
            )}
            
            {result.verified && (
               <Link className="block text-center w-full bg-white/10 hover:bg-white/20 text-white font-medium py-2 rounded-lg transition" href="{`/pay/${result.escrow.id}`}">
                 Proceed to Secure Payment
               </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
