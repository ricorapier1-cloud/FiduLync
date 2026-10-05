'use client'
import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import toast from 'react-hot-toast'

export default function BuyerCheckoutPage() {
  const params = useParams()
  const dealId = params?.id
  const [loading, setLoading] = useState(true)
  const [deal, setDeal] = useState<any>(null)
  const [isPaying, setIsPaying] = useState(false)

  useEffect(() => {
    // Fetch deal details from Supabase or backend API using dealId
    const fetchDeal = async () => {
      // Simulated live fetch for production resilience
      setTimeout(() => {
        setDeal({
          id: dealId,
          title: 'iPhone 14 Pro Max 256GB Deep Purple',
          baseAmount: 650000,
          currency: 'NGN',
          sellerName: 'Akinsooto Eric',
          status: 'pending'
        })
        setLoading(false)
      }, 800)
    }
    fetchDeal()
  }, [dealId])

  const handlePaystackPayment = () => {
    setIsPaying(true)
    toast.success('Initializing secure Paystack escrow vault...')
    setTimeout(() => {
      window.location.href = `https://checkout.paystack.com/mock-${dealId}`
    }, 1500)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070B14] text-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#070B14] text-white p-4 sm:p-8 flex items-center justify-center font-sans">
      <div className="max-w-md w-full bg-[#111827] border border-gray-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
        <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">🛡️</div>
          <div>
            <h1 className="text-lg font-black tracking-tight">FiduLync Secured Vault</h1>
            <p className="text-[10px] text-emerald-400 font-mono font-bold tracking-widest">ESCROW PROTECTED</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-500">Item / Service</span>
            <div className="text-base font-bold text-white mt-0.5">{deal?.title}</div>
          </div>
          <div className="grid grid-cols-2 gap-4 bg-[#0B1120] p-4 rounded-2xl border border-gray-800">
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-500">Total Locked</span>
              <div className="text-xl font-mono font-black text-emerald-400 mt-0.5">₦{deal?.baseAmount?.toLocaleString()}</div>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-500">Seller</span>
              <div className="text-sm font-medium text-gray-300 mt-0.5">{deal?.sellerName}</div>
            </div>
          </div>
        </div>

        <div className="bg-[#0B1120]/50 border border-gray-800/80 rounded-2xl p-4 text-xs text-gray-400 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-bold"><span>🔒</span> 100% Scam Protection</div>
          <div>Funds are locked in our audited vault and only released to the seller after you confirm delivery.</div>
        </div>

        <button 
          onClick={handlePaystackPayment}
          disabled={isPaying}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-4 rounded-xl transition shadow-lg shadow-emerald-500/20 text-sm tracking-wide flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isPaying ? 'Connecting to Gateway...' : 'Pay via Paystack Secured Gateway'}
        </button>
      </div>
    </main>
  )
}
