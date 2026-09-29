'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { calculateEscrowFee } from '@/lib/feeCalculator'
import { Shield, Lock, CheckCircle2, Copy, Check, Share2 } from 'lucide-react'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

export default function CreateEscrowPage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [buyerPhone, setBuyerPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [createdSlug, setCreatedSlug] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const feeInfo = calculateEscrowFee(Number(amount))

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !amount) {
      alert('Please fill in the item name and price.')
      return
    }

    setLoading(true)
    const slug = Math.random().toString(36).substring(2, 9)

    const { error } = await supabase
      .from('escrows')
      .insert([
        {
          title,
          description,
          amount: Number(amount),
          buyer_phone: buyerPhone,
          slug,
          status: 'pending'
        }
      ])

    setLoading(false)

    if (error) {
      alert(`Error creating Safe Link: ${error.message}`)
      return
    }

    setCreatedSlug(slug)
  }

  const generatedUrl = createdSlug 
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/pay/${createdSlug}`
    : ''

  const whatsappShareUrl = createdSlug 
    ? `https://api.whatsapp.com/send?text=${encodeURIComponent(
        `Hi! Here is your SafeLync escrow payment link for ${title} (₦${Number(amount).toLocaleString()}):\n\n${generatedUrl}\n\nFunds remain safely locked until item delivery!`
      )}`
    : ''

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 flex flex-col items-center justify-center">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-6 shadow-md space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200">
            <Shield className="w-3.5 h-3.5 text-emerald-600" /> SafeLync Protection
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">Create Safe Link</h1>
          <p className="text-xs text-slate-600 font-medium">Lock buyer funds securely until delivery is confirmed.</p>
        </div>

        {!createdSlug ? (
          <form onSubmit={handleCreateLink} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Buyer's WhatsApp Phone</label>
              <input
                type="text"
                placeholder="e.g. 09117295774"
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                className="w-full p-3.5 text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-xl placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Item Name *</label>
              <input
                type="text"
                placeholder="e.g. iPhone 14 Pro Max"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-3.5 text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-xl placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Item Description</label>
              <textarea
                placeholder="e.g. Brand new, 256GB Deep Purple..."
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-3.5 text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-xl placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Item Price (₦) *</label>
              <input
                type="number"
                placeholder="e.g. 650000"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full p-3.5 text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-xl placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            {/* Price Preview Card */}
            {Number(amount) > 0 && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between text-slate-700 font-medium">
                  <span>Item Price:</span>
                  <span className="font-bold text-slate-900">₦{Number(amount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-700 font-medium">
                  <span>Escrow Fee (2% max ₦5k):</span>
                  <span className="text-emerald-700 font-bold">₦{feeInfo.actualFee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-extrabold text-sm text-slate-900 pt-2 border-t border-slate-200">
                  <span>Total Buyer Pays:</span>
                  <span className="text-emerald-700">₦{feeInfo.total.toLocaleString()}</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl text-sm transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Generating Link...</span>
              ) : (
                <>
                  <Lock className="w-4 h-4" /> Create Safe Link
                </>
              )}
            </button>
          </form>
        ) : (
          /* Success Screen with WhatsApp & Copy Options */
          <div className="space-y-5 text-center">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-xl">Safe Link Created!</h3>
              <p className="text-xs text-slate-600 font-medium mt-1">Send this link to your buyer on WhatsApp or Instagram.</p>
            </div>

            <div className="p-3.5 bg-slate-100 rounded-xl text-xs font-mono font-semibold break-all text-slate-900 border border-slate-300">
              {generatedUrl}
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <a
                href={whatsappShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-sm"
              >
                <Share2 className="w-4 h-4" /> Share on WhatsApp
              </a>
              <button
                onClick={copyToClipboard}
                className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-sm"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>

            <button
              onClick={() => setCreatedSlug(null)}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 underline transition block mx-auto pt-2"
            >
              + Create Another Link
            </button>
          </div>
        )}

      </div>
    </main>
  )
}
