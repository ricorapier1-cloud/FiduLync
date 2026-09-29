'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { calculateEscrowFee } from '@/lib/feeCalculator'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

export default function BuyerPayPage({ params }: { params: Promise<{ slug: string }> }) {
  const [resolvedParams, setResolvedParams] = useState<{ slug: string } | null>(null)
  const [escrow, setEscrow] = useState<any>(null)
  const [loading, setLoading] = useState(true)

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
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Loading escrow details...</div>
  }

  if (!escrow) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 max-w-sm text-center shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-1">Safe Link Not Found</h2>
          <p className="text-xs text-slate-500 mb-3">This link does not exist or has expired.</p>
        </div>
      </main>
    )
  }

  const feeDetails = calculateEscrowFee(Number(escrow.amount))
  const totalKobo = Math.round(feeDetails.total * 100)

  const handlePayment = () => {
    const paystackPublicKey = "pk_test_a537e794fe3c198af4d21738b4aa88b1cc452520" 
    
    if (!(window as any).PaystackPop) {
      alert('Paystack SDK is still loading. Please try again in a second.')
      return
    }

    const handler = (window as any).PaystackPop.setup({
      key: paystackPublicKey,
      email: 'customer@veripay.app',
      amount: totalKobo,
      currency: 'NGN',
      channels: ['bank_transfer', 'card', 'bank', 'ussd'],
      ref: `${escrow.slug}_${Math.floor((Math.random() * 1000000) + 1)}`,
      callback: function(response: any) {
        alert('Payment successful! Reference: ' + response.reference)
      },
      onClose: function() {
        alert('Payment window closed.')
      }
    });
    handler.openIframe();
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 flex items-center justify-center">
      <script src="https://js.paystack.co/v1/inline.js" async></script>
      <div className="bg-white p-6 rounded-2xl border border-slate-200 w-full max-w-md shadow-sm space-y-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
            veriPay Safe Escrow
          </span>
          <h1 className="text-xl font-bold text-slate-900 mt-2">{escrow.title}</h1>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Item Price</span>
            <span className="font-semibold text-slate-900">₦{Number(escrow.amount).toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-600">Escrow Fee</span>
            <span className="font-semibold text-emerald-700">₦{feeDetails.actualFee.toLocaleString()}</span>
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

        <button 
          onClick={handlePayment}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition shadow-sm"
        >
          Pay ₦{feeDetails.total.toLocaleString()} Now
        </button>
      </div>
    </main>
  )
}
