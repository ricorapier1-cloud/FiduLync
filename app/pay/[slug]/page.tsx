'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { calculateEscrowFee } from '@/lib/feeCalculator'
import { ShieldCheck, AlertTriangle, CheckCircle, Tag, Lock } from 'lucide-react'

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
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 text-sm">Loading deal details...</div>
  }

  if (!escrow) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 max-w-sm text-center shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-1">Safe Link Not Found</h2>
          <p className="text-xs text-slate-500">This transaction link does not exist or has expired.</p>
        </div>
      </main>
    )
  }

  const feeDetails = calculateEscrowFee(Number(escrow.amount), appliedPromo)
  const totalKobo = Math.round(feeDetails.total * 100)

  const applyPromo = () => {
    if (promoCode.toUpperCase() === 'PROMO3FREE') {
      setAppliedPromo('PROMO3FREE')
    } else {
      alert('Invalid Promo Code')
    }
  }

  const handlePayment = () => {
    const paystackPublicKey = "pk_test_a537e794fe3c198af4d21738b4aa88b1cc452520" 
    
    if (!(window as any).PaystackPop) {
      alert('Paystack SDK is loading. Please try again in a moment.')
      return
    }

    const handler = (window as any).PaystackPop.setup({
      key: paystackPublicKey,
      email: escrow.buyer_email || 'buyer@veripay.app',
      amount: totalKobo,
      currency: 'NGN',
      channels: ['bank_transfer', 'card', 'bank', 'ussd'],
      ref: `${escrow.slug}_${Math.floor((Math.random() * 1000000) + 1)}`,
      callback: async function(response: any) {
        await supabase
          .from('escrows')
          .update({ status: 'funded', promo_code: appliedPromo })
          .eq('slug', escrow.slug)
        
        setEscrow({ ...escrow, status: 'funded' })
        alert('Payment successful! Escrow funds locked in trust.')
      }
    });
    handler.openIframe();
  }

  const handleDispute = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!disputeReason) return

    const { error } = await supabase
      .from('escrows')
      .update({ 
        status: 'disputed', 
        dispute_reason: disputeReason,
        dispute_created_at: new Date().toISOString()
      })
      .eq('slug', escrow.slug)

    if (!error) {
      setEscrow({ ...escrow, status: 'disputed' })
      setShowDisputeForm(false)
      alert('Dispute logged! Funds are frozen in place for administrative review.')
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 flex items-center justify-center">
      <script src="https://js.paystack.co/v1/inline.js" async></script>
      <div className="bg-white p-6 rounded-2xl border border-slate-200 w-full max-w-md shadow-sm space-y-5">
        
        {/* Header Badges */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Escrow Protection Active
          </span>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Status: <strong className="text-slate-900">{escrow.status || 'pending'}</strong>
          </span>
        </div>

        <div>
          <h1 className="text-xl font-bold text-slate-900">{escrow.title}</h1>
          <p className="text-xs text-slate-500 mt-1">{escrow.description || 'Secured P2P Escrow Transaction'}</p>
        </div>

        {/* Pricing Breakdown */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Item Price</span>
            <span className="font-semibold text-slate-900">₦{Number(escrow.amount).toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-600">Escrow Fee</span>
            <span className="font-semibold text-emerald-700">
              {feeDetails.isPromoActive ? '₦0 (Promo Free)' : `₦${feeDetails.actualFee.toLocaleString()}`}
            </span>
          </div>
          
          {feeDetails.isCapped && (
            <div className="text-[11px] text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-200">
              🎉 ₦5,000 Fee Cap Applied! You saved ₦{feeDetails.savings.toLocaleString()}.
            </div>
          )}

          <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-base text-slate-900">
            <span>Total Payable</span>
            <span>₦{feeDetails.total.toLocaleString()}</span>
          </div>
        </div>

        {/* Promo Code Entry (if pending) */}
        {escrow.status === 'pending' && (
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Promo Code (e.g. PROMO3FREE)" 
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              className="flex-1 p-2.5 border border-slate-200 rounded-xl text-xs uppercase"
            />
            <button 
              onClick={applyPromo}
              className="bg-slate-800 text-white text-xs font-semibold px-3 py-2.5 rounded-xl hover:bg-slate-900 transition flex items-center gap-1"
            >
              <Tag className="w-3.5 h-3.5" /> Apply
            </button>
          </div>
        )}

        {/* Dynamic Action Buttons based on Ledger State */}
        {escrow.status === 'pending' && (
          <button 
            onClick={handlePayment}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition shadow-sm flex items-center justify-center gap-2 text-sm"
          >
            <Lock className="w-4 h-4" /> Pay ₦{feeDetails.total.toLocaleString()} Into Secure Vault
          </button>
        )}

        {escrow.status === 'funded' && (
          <div className="space-y-3 pt-2">
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-center text-xs text-emerald-800 font-medium flex items-center justify-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-600" /> Funds Secured in Escrow Vault
            </div>

            {!showDisputeForm ? (
              <button 
                onClick={() => setShowDisputeForm(true)}
                className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold py-2.5 rounded-xl border border-rose-200 text-xs transition flex items-center justify-center gap-1.5"
              >
                <AlertTriangle className="w-4 h-4" /> Dispute Deal / Issue Problem
              </button>
            ) : (
              <form onSubmit={handleDispute} className="space-y-2 bg-rose-50 p-3 rounded-xl border border-rose-200">
                <label className="text-xs font-bold text-rose-900 block">Reason for Dispute</label>
                <textarea 
                  value={disputeReason} 
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="Describe the issue with the item or seller..."
                  required
                  className="w-full p-2 text-xs border border-rose-200 rounded-lg focus:outline-none"
                  rows={3}
                />
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-rose-600 text-white font-bold py-2 rounded-lg text-xs">
                    Submit Dispute & Freeze Funds
                  </button>
                  <button type="button" onClick={() => setShowDisputeForm(false)} className="bg-slate-200 text-slate-700 font-semibold px-3 rounded-lg text-xs">
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {escrow.status === 'disputed' && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-center space-y-1">
            <AlertTriangle className="w-6 h-6 text-amber-600 mx-auto" />
            <h4 className="font-bold text-amber-900 text-sm">Deal Under Dispute Review</h4>
            <p className="text-xs text-amber-700">Funds are frozen safely in escrow. An administrator will review proof from both parties.</p>
          </div>
        )}

      </div>
    </main>
  )
}
