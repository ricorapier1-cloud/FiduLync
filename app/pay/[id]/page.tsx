'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import toast, { Toaster } from 'react-hot-toast'

export default function BuyerCheckoutPage({ params }: { params: { id: string } }) {
  const [deal, setDeal] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [buyerEmail, setBuyerEmail] = useState('')
  const [isInitializing, setIsInitializing] = useState(false)

  useEffect(() => {
    async function fetchDeal() {
      setLoading(true)
      const { data, error } = await supabase
        .from('escrow_deals')
        .select('*')
        .eq('id', params.id)
        .single()

      if (error || !data) {
        toast.error('Escrow deal not found')
      } else {
        setDeal(data)
      }
      setLoading(false)
    }

    if (params.id) fetchDeal()
  }, [params.id])

  const handlePaystackPay = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsInitializing(true)

    try {
      const res = await fetch('/api/paystack/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealId: deal.id,
          email: buyerEmail,
          amountNGN: deal.price
        })
      })

      const data = await res.json()

      if (data.error) {
        toast.error(data.error)
      } else if (data.authorization_url) {
        window.location.href = data.authorization_url
      }
    } catch (err: any) {
      toast.error('Payment initialization error')
    } finally {
      setIsInitializing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070B14] text-white flex items-center justify-center font-sans">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-gray-400 font-mono">Loading Escrow Vault Details...</p>
        </div>
      </div>
    )
  }

  if (!deal) {
    return (
      <div className="min-h-screen bg-[#070B14] text-white flex items-center justify-center p-4">
        <div className="bg-[#111827] border border-gray-800 p-6 rounded-2xl text-center space-y-4 max-w-sm">
          <h2 className="text-lg font-bold text-red-400">Deal Not Found</h2>
          <p className="text-xs text-gray-400">This escrow link may have expired or does not exist.</p>
          <Link href="/" className="inline-block bg-emerald-500 text-black px-4 py-2 rounded-xl text-xs font-bold">
            Back to Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#070B14] text-white p-4 sm:p-8 font-sans selection:bg-emerald-500/30">
      <Toaster position="top-center" />
      
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-gray-800 pb-4">
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-emerald-400 transition">
            ← Back to FiduLync
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></div>
            <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest">Live Vault Deposit</span>
          </div>
        </div>

        <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 space-y-6 shadow-2xl">
          <div className="border-b border-gray-800 pb-4 flex justify-between items-start">
            <div>
              <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-500/20 font-mono">
                Ref: #{deal.id.substring(0, 8)}
              </span>
              <h1 className="text-xl font-black text-white mt-2">{deal.item_name}</h1>
              <p className="text-xs text-gray-400 mt-0.5">{deal.item_description || 'No description provided'}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-emerald-400">{deal.currency} ₦{Number(deal.price).toLocaleString()}</div>
              <div className="text-[11px] text-gray-400 font-mono">Status: {deal.status}</div>
            </div>
          </div>

          {deal.status === 'pending_payment' ? (
            <form onSubmit={handlePaystackPay} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-gray-400">Buyer Email Address *</label>
                <input
                  required
                  type="email"
                  placeholder="buyer@example.com"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={isInitializing}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-3.5 rounded-xl text-sm transition shadow-lg shadow-emerald-500/20"
              >
                {isInitializing ? 'Opening Paystack Portal...' : '🔒 Pay via Paystack Escrow Vault'}
              </button>
            </form>
          ) : (
            <div className="bg-[#0B1120] border border-emerald-500/40 rounded-2xl p-6 text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-xl font-bold">✓</div>
              <h3 className="text-lg font-bold text-white">Payment Received</h3>
              <p className="text-xs text-gray-300">
                This transaction has been funded and locked in the FiduLync vault.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
