'use client'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function CheckoutContent() {
  const searchParams = useSearchParams()
  const item = searchParams.get('item') || 'Secure Escrow Item'
  const price = searchParams.get('price') || '0.00'
  const currency = searchParams.get('cur') || 'NGN'
  
  const SYMBOLS: Record<string, string> = {
    NGN: '₦', USD: '$', GBP: '£', EUR: '€', KES: 'KSh ', GHS: 'GH₵ ', ZAR: 'R '
  }
  const symbol = SYMBOLS[currency] || currency + ' '

  return (
    <div className="bg-[#111827] p-8 rounded-3xl border border-gray-800 shadow-2xl max-w-md w-full text-center">
      <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center text-3xl mx-auto mb-6 border border-emerald-500/20">
        🛡️
      </div>
      <h1 className="text-2xl font-black text-white mb-2">FiduLync Checkout</h1>
      <p className="text-sm text-gray-400 mb-8">You are paying for <strong className="text-white">{item}</strong> safely.</p>
      
      <div className="text-5xl font-black text-emerald-400 mb-8">
        {symbol}{Number(price).toLocaleString()}
      </div>

      <button className="w-full bg-emerald-500 text-black font-extrabold py-4 rounded-xl hover:bg-emerald-400 transition shadow-[0_0_20px_rgba(16,185,129,0.3)]">
        Pay Securely Now
      </button>
      
      <p className="text-xs text-gray-500 mt-6">Secured by Paystack • Escrow Protected</p>
    </div>
  )
}

export default function PayPage() {
  return (
    <div className="min-h-screen bg-[#0B1120] text-gray-300 flex flex-col items-center justify-center p-4">
      <Suspense fallback={<div className="text-emerald-400 font-bold animate-pulse">Loading Vault...</div>}>
        <CheckoutContent />
      </Suspense>
    </div>
  )
}
