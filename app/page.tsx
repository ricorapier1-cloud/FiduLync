'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { calculateEscrowFee } from '@/lib/feeCalculator'
import { Shield, Lock, CheckCircle2, ArrowRight } from 'lucide-react'

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

  const feeInfo = calculateEscrowFee(Number(amount))

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !amount) {
      alert('Please fill in the item name and price.')
      return
    }

    setLoading(true)
    const slug = Math.random().toString(36).substring(2, 9)

    const { data, error } = await supabase
      .from('escrows')
      .insert([
        {
          title,
          description,
          amount: Number(amount),
          buyer_phone: buyerPhone,
          slug,
          status: 'pending' // Explicitly set lowercase status to pass constraint
        }
      ])
      .select()

    setLoading(false)

    if (error) {
      alert(`Error creating Safe Link: ${error.message}`)
      console.error(error)
      return
    }

    setCreatedSlug(slug)
  }

  const generatedUrl = createdSlug 
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/pay/${createdSlug}`
    : ''

  return (
    <main className="min-h-screen bg-slate-50 p-4 flex flex-col items-center justify-center">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-semibold">
            <Shield className="w-3.5 h-3.5" /> SafeLync Protection
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Create Safe Link</h1>
          <p className="text-xs text-slate-500">Lock buyer funds securely until delivery is confirmed.</p>
        </div>

        {!createdSlug ? (
          <form onSubmit={handleCreateLink} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Buyer's WhatsApp Phone</label>
              <input
                type="text"
                placeholder="09117295774"
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                className="w-full p-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Item Name *</label>
              <input
                type="text"
                placeholder="iPhone 14 Pro Max"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Item Description</label>
              <textarea
                placeholder="Brand new, 256GB Deep Purple..."
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Item Price (₦) *</label>
              <input
                type="number"
                placeholder="650000"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full p-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {/* Price Preview Card */}
            {Number(amount) > 0 && (
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>Item Price:</span>
                  <span>₦{Number(amount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Escrow Fee (2% max ₦5k):</span>
                  <span className="text-emerald-700 font-medium">₦{feeInfo.actualFee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200">
                  <span>Total Buyer Pays:</span>
                  <span>₦{feeInfo.total.toLocaleString()}</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl text-sm transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Creating Link...</span>
              ) : (
                <>
                  <Lock className="w-4 h-4" /> Create Safe Link
                </>
              )}
            </button>
          </form>
        ) : (
          /* Link Generated Success View */
          <div className="space-y-4 text-center">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Safe Link Ready!</h3>
              <p className="text-xs text-slate-500">Send this link to your buyer on WhatsApp or Instagram.</p>
            </div>

            <div className="p-3 bg-slate-100 rounded-xl text-xs font-mono break-all text-slate-800 border border-slate-200">
              {generatedUrl}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(generatedUrl)}
                className="flex-1 bg-emerald-600 text-white font-semibold py-2.5 rounded-xl text-xs hover:bg-emerald-700 transition"
              >
                Copy Link
              </button>
              <button
                onClick={() => setCreatedSlug(null)}
                className="bg-slate-200 text-slate-700 font-semibold px-4 py-2.5 rounded-xl text-xs hover:bg-slate-300 transition"
              >
                Create Another
              </button>
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
