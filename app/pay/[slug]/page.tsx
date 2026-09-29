'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { calculateEscrowFee, formatCurrency } from '@/lib/feeCalculator'
import { ShieldCheck, AlertTriangle, CheckCircle, Tag, Lock, Share2, Copy, Check } from 'lucide-react'
import PaystackPop from '@paystack/inline-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

export default function BuyerPayPage({ params }: { params: Promise<{ slug: string }> }) {
  const [resolvedParams, setResolvedParams] = useState<{ slug: string } | null>(null)
  const [escrow, setEscrow] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [promoCode, setPromoCode] = useState('')
  const [appliedPromo, setAppliedPromo] = useState('')
  const [disputeReason, setDisputeReason] = useState('')
  const [showDisputeForm, setShowDisputeForm] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    params.then((p) => setResolvedParams(p))
  }, [params])

  useEffect(() => {
    if (!resolvedParams?.slug) return

    async function fetchEscrow() {
      const { data } = await supabase
        .from('escrows')
        .select('*')
        .eq('slug', resolvedParams?.slug)
        .maybeSingle()

      if (data) setEscrow(data)
      setLoading(false)
    }

    fetchEscrow()
  }, [resolvedParams])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-sm">
        Loading deal details...
      </div>
    )
  }

  if (!escrow) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 max-w-sm text-center shadow-md">
          <h2 className="text-lg font-bold text-slate-900 mb-1">Safe Link Not Found</h2>
          <p className="text-xs text-slate-600">This transaction link does not exist or has expired.</p>
        </div>
      </main>
    )
  }

  const activeCurrency = escrow.currency || 'NGN'
  const feeDetails = calculateEscrowFee(Number(escrow.amount), activeCurrency, appliedPromo)
  const totalSubunits = Math.round(feeDetails.total * 100)

  const applyPromo = () => {
    if (promoCode.trim().toUpperCase() === 'PROMO3FREE') {
      setAppliedPromo('PROMO3FREE')
    } else {
      alert('Invalid Promo Code')
    }
  }

  const handlePayment = () => {
    try {
      const paystack = new PaystackPop()
      const paystackPublicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "pk_test_a537e794fe3c198af4d21738b4aa88b1cc452520"

      paystack.newTransaction({
        key: paystackPublicKey,
        email: escrow.buyer_email || 'buyer@veriPay.app',
        amount: totalSubunits,
        currency: activeCurrency,
        reference: `${escrow.slug}_${Date.now()}`,
        onSuccess: async (transaction: any) => {
          await supabase
            .from('escrows')
            .update({ status: 'funded', promo_code: appliedPromo })
            .eq('slug', escrow.slug)

          setEscrow({ ...escrow, status: 'funded' })
          alert('Payment successful! Escrow funds are locked safely in trust.')
        },
        onCancel: () => {
          console.log('Payment checkout cancelled.')
        },
      })
    } catch (err: any) {
      alert(`Payment popup initialization error: ${err.message}`)
    }
  }

  const handleDispute = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!disputeReason) return

    const { error } = await supabase
      .from('escrows')
      .update({
        status: 'disputed',
        dispute_reason: disputeReason,
        dispute_created_at: new Date().toISOString(),
      })
      .eq('slug', escrow.slug)

    if (!error) {
      setEscrow({ ...escrow, status: 'disputed' })
      setShowDisputeForm(false)
      alert('Dispute submitted! Funds are frozen in place for review.')
    }
  }

  const pageUrl = typeof window !== 'undefined' ? window.location.href : ''
  const whatsappShareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
    `Hi! Here is the veriPay payment link for ${escrow.title}:${pageUrl}`
  )}`

  return (
    <main className="min-h-screen bg-slate-100 p-4 flex items-center justify-center">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 w-full max-w-md shadow-md space-y-5">
        
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <span className="text-[11px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full flex items-center gap-1 border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Escrow Protection Active
          </span>
          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            Status: <strong className="text-slate-900 font-extrabold">{escrow.status || 'pending'}</strong>
          </span>
        </div>

        <div>
          <h1 className="text-2xl font-black text-slate-900">{escrow.title}</h1>
          <p className="text-xs text-slate-600 font-medium mt-1">{escrow.description || 'Secured P2P Escrow Transaction'}</p>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
          <div className="flex justify-between font-medium text-slate-700">
            <span>Item Price</span>
            <span className="font-bold text-slate-900">{formatCurrency(Number(escrow.amount), activeCurrency)}</span>
          </div>
          <div className="flex justify-between items-center font-medium text-slate-700">
            <span>Escrow Fee</span>
            <span className="font-bold text-emerald-700">
              {feeDetails.isPromoActive ? '₦0 (Promo Free)' : formatCurrency(feeDetails.actualFee, activeCurrency)}
            </span>
          </div>

          <div className="pt-2 border-t border-slate-200 flex justify-between font-black text-base text-slate-900">
            <span>Total Payable</span>
            <span className="text-emerald-700">{formatCurrency(feeDetails.total, activeCurrency)}</span>
          </div>
        </div>

        {escrow.status === 'pending' && (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Promo Code (e.g. PROMO3FREE)"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              className="flex-1 p-3 text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-xl uppercase placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            />
            <button
              onClick={applyPromo}
              className="bg-slate-900 hover:bg-black text-white text-xs font-bold px-4 py-3 rounded-xl transition flex items-center gap-1 shadow-sm"
            >
              <Tag className="w-3.5 h-3.5" /> Apply
            </button>
          </div>
        )}

        {escrow.status === 'pending' && (
          <button
            onClick={handlePayment}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-xl transition shadow-md flex items-center justify-center gap-2 text-sm"
          >
            <Lock className="w-4 h-4" /> Pay {formatCurrency(feeDetails.total, activeCurrency)} Into Secure Vault
          </button>
        )}

        {escrow.status === 'funded' && (
          <div className="space-y-3 pt-1">
            <div className="bg-emerald-50 border border-emerald-300 p-3.5 rounded-xl text-center text-xs text-emerald-900 font-bold flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" /> Funds Locked Safely in Escrow
            </div>

            {!showDisputeForm ? (
              <button
                onClick={() => setShowDisputeForm(true)}
                className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold py-3 rounded-xl border border-rose-200 text-xs transition flex items-center justify-center gap-1.5"
              >
                <AlertTriangle className="w-4 h-4" /> Dispute Deal / Report Problem
              </button>
            ) : (
              <form onSubmit={handleDispute} className="space-y-3 bg-rose-50 p-4 rounded-xl border border-rose-200">
                <label className="text-xs font-extrabold text-rose-900 block">Reason for Dispute</label>
                <textarea
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="Describe the issue with the item or seller..."
                  required
                  className="w-full p-3 text-xs font-semibold text-slate-900 bg-white border border-rose-300 rounded-lg focus:outline-none placeholder:text-slate-400"
                  rows={3}
                />
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-lg text-xs transition">
                    Submit & Freeze Funds
                  </button>
                  <button type="button" onClick={() => setShowDisputeForm(false)} className="bg-slate-200 text-slate-800 font-bold px-3 rounded-lg text-xs">
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {escrow.status === 'disputed' && (
          <div className="bg-amber-50 border border-amber-300 p-4 rounded-xl text-center space-y-1">
            <AlertTriangle className="w-6 h-6 text-amber-600 mx-auto" />
            <h4 className="font-extrabold text-amber-900 text-sm">Deal Under Review</h4>
            <p className="text-xs text-amber-800 font-medium">Funds are frozen safely. An admin will contact both parties to resolve this issue.</p>
          </div>
        )}

        <div className="pt-3 border-t border-slate-100 flex gap-2">
          <a
            href={whatsappShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-1.5"
          >
            <Share2 className="w-3.5 h-3.5" /> Share
          </a>
          <button
            onClick={() => {
              navigator.clipboard.writeText(pageUrl)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}
            className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy Link'}
          </button>
        </div>

      </div>
    </main>
  )
}
