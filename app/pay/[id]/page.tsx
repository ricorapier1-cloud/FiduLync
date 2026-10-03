'use client'
import { Suspense, useState } from 'react'
import { useSearchParams, useParams } from 'next/navigation'
import toast from 'react-hot-toast'

function CheckoutContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  
  const linkId = params.id as string
  const item = searchParams.get('item') || 'Secure Escrow Item'
  const price = searchParams.get('price') || '0.00'
  const currency = searchParams.get('cur') || 'NGN'
  const isSuccess = searchParams.get('success') === 'true'
  
  const [loading, setLoading] = useState(false)

  const handlePayment = async () => {
    setLoading(true)
    const toastId = toast.loading('Initializing secure gateway...')
    try {
      const res = await fetch('/api/paystack/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: price, currency, link_id: linkId, email: 'secure-buyer@fidulync.com' })
      })
      const data = await res.json()
      if (data.authorization_url) {
        toast.success('Gateway secured. Redirecting...', { id: toastId })
        window.location.href = data.authorization_url
      } else {
        throw new Error('No URL')
      }
    } catch (error) {
      toast.error('Failed to initialize payment gateway.', { id: toastId })
      setLoading(false)
    }
  }

  const SYMBOLS: Record<string, string> = {
    NGN: '₦', USD: '$', GBP: '£', EUR: '€', KES: 'KSh ', GHS: 'GH₵ ', ZAR: 'R '
  }

  if (isSuccess) {
    return (
      <div className="bg-[#111827] p-10 rounded-3xl border border-emerald-500/50 shadow-[0_0_40px_rgba(16,185,129,0.2)] max-w-md w-full text-center">
        <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center text-4xl mx-auto mb-6 shadow-lg">✓</div>
        <h1 className="text-3xl font-black text-white mb-2">Funds Locked!</h1>
        <p className="text-sm text-gray-400 mb-6">Your payment is secured in Escrow. The seller has been notified to deliver your item.</p>
      </div>
    )
  }

  return (
    <div className="bg-[#111827] p-8 rounded-3xl border border-gray-800 shadow-2xl max-w-md w-full text-center">
      <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center text-3xl mx-auto mb-6 border border-emerald-500/20">🛡️</div>
      <h1 className="text-2xl font-black text-white mb-2">FiduLync Checkout</h1>
      <p className="text-sm text-gray-400 mb-8">You are paying for <strong className="text-white">{item}</strong> safely.</p>
      
      <div className="text-5xl font-black text-emerald-400 mb-8">
        {SYMBOLS[currency] || currency + ' '}{Number(price).toLocaleString()}
      </div>

      <button onClick={handlePayment} disabled={loading} className="w-full bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-600 text-black font-extrabold py-4 rounded-xl hover:bg-emerald-400 transition shadow-[0_0_20px_rgba(16,185,129,0.3)]">
        {loading ? 'Connecting Vault...' : 'Pay Securely Now'}
      </button>
      
      <div className="text-xs text-gray-500 mt-6 flex flex-col space-y-1">
        <span>Secured by <strong>Paystack</strong></span>
        <span>Funds are held in Escrow until delivery</span>
      </div>
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
