'use client'
import { useEffect, useState } from 'react'
import Script from 'next/script'
import toast from 'react-hot-toast'

export default function PaymentPage({ params }: { params: { slug: string } }) {
  const [escrow, setEscrow] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updating, setUpdating] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showDisputeModal, setShowDisputeModal] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')

  useEffect(() => {
    async function fetchEscrow() {
      try {
        const res = await fetch(`/api/escrow/${params.slug}`)
        const data = await res.json()
        if (!res.ok || !data.escrow) throw new Error(data.error || 'Link not found')
        setEscrow(data.escrow)
      } catch (err: any) {
        setError(err.message || 'Failed to load escrow')
      } finally {
        setLoading(false)
      }
    }
    fetchEscrow()
  }, [params.slug])

  const handlePayment = () => {
    // @ts-ignore
    const paystack = new window.PaystackPop()
    paystack.newTransaction({
      key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
      email: 'buyer@example.com',
      amount: Number(escrow.amount) * 100,
      currency: 'NGN',
      metadata: { custom_fields: [{ display_name: 'FiduLync ID', variable_name: 'link_id', value: escrow.link_id }] },
      onSuccess: (transaction: any) => {
        toast.success(`Payment secured! Ref: ${transaction.reference}`)
        setEscrow((prev: any) => ({ ...prev, status: 'funded' }))
      },
      onCancel: () => toast.error('Payment cancelled.')
    })
  }

  const executeConfirmDelivery = async () => {
    setShowConfirmModal(false)
    setUpdating(true)
    const toastId = toast.loading('Releasing funds to seller...')
    try {
      const res = await fetch(`/api/escrow/${params.slug}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' })
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Funds released successfully!', { id: toastId })
        setEscrow((prev: any) => ({ ...prev, status: 'completed' }))
      } else {
        toast.error(data.error || 'Failed to release funds', { id: toastId })
      }
    } catch (err) {
      toast.error('Network error.', { id: toastId })
    } finally {
      setUpdating(false)
    }
  }

  const executeDispute = async () => {
    if (!disputeReason.trim()) return toast.error('Please provide a reason')
    setShowDisputeModal(false)
    setUpdating(true)
    const toastId = toast.loading('Freezing transaction...')
    try {
      const res = await fetch(`/api/escrow/${params.slug}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: disputeReason })
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Transaction frozen. Admin reviewing.', { id: toastId })
        setEscrow((prev: any) => ({ ...prev, status: 'disputed' }))
      } else {
        toast.error(data.error || 'Failed to raise dispute', { id: toastId })
      }
    } catch (err) {
      toast.error('Network error.', { id: toastId })
    } finally {
      setUpdating(false)
      setDisputeReason('')
    }
  }

  if (loading) return <div className="min-h-screen bg-[#0B1120] flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-emerald-500"></div></div>
  if (error || !escrow) return <div className="min-h-screen bg-[#0B1120] text-white flex items-center justify-center"><div className="text-center text-red-400 font-bold">{error}</div></div>

  return (
    <>
      <Script src="https://js.paystack.co/v2/inline.js" strategy="lazyOnload" />
      <div className="min-h-screen bg-[#0B1120] text-white p-4 sm:p-8 flex flex-col items-center justify-center relative">
        
        {/* Modals */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-[#111827] border border-gray-800 p-6 rounded-2xl max-w-sm w-full">
              <h3 className="text-xl font-bold mb-2">Release Funds?</h3>
              <p className="text-sm text-gray-400 mb-6">Confirm you have received and inspected the item. This will instantly send the money to the seller.</p>
              <div className="flex space-x-3">
                <button onClick={() => setShowConfirmModal(false)} className="flex-1 py-3 bg-gray-800 rounded-xl font-bold">Cancel</button>
                <button onClick={executeConfirmDelivery} className="flex-1 py-3 bg-emerald-500 text-black rounded-xl font-bold">Release</button>
              </div>
            </div>
          </div>
        )}

        {showDisputeModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-[#111827] border border-gray-800 p-6 rounded-2xl max-w-sm w-full">
              <h3 className="text-xl font-bold text-red-400 mb-2">Raise Dispute</h3>
              <p className="text-sm text-gray-400 mb-4">Explain what went wrong. Funds will be frozen.</p>
              <textarea value={disputeReason} onChange={e => setDisputeReason(e.target.value)} className="w-full bg-[#0B1120] border border-gray-700 rounded-xl p-3 text-sm mb-4 h-24" placeholder="e.g. Item was damaged..."></textarea>
              <div className="flex space-x-3">
                <button onClick={() => setShowDisputeModal(false)} className="flex-1 py-3 bg-gray-800 rounded-xl font-bold">Cancel</button>
                <button onClick={executeDispute} className="flex-1 py-3 bg-red-500/20 text-red-400 border border-red-500/50 rounded-xl font-bold">Freeze Funds</button>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-xl w-full bg-[#111827] border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
          <div className="flex justify-between border-b border-gray-800 pb-4 mb-6">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400">🛡️ FIDULYNC PROTECTED</span>
            <span className="text-xs font-mono text-gray-400">ID: {escrow.link_id}</span>
          </div>
          <div className="space-y-4 mb-6">
            <h1 className="text-2xl font-bold">{escrow.title}</h1>
            <div className="p-4 bg-[#0B1120] rounded-2xl border border-gray-800 flex justify-between items-center">
              <span className="text-gray-400 text-sm">Escrow Amount:</span>
              <span className="text-2xl font-black text-emerald-400 font-mono">₦{Number(escrow.amount || 0).toLocaleString()}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs bg-[#0B1120]/50 p-3 rounded-xl border border-gray-800/80">
              <div><span className="text-gray-500">Seller Phone:</span> <span className="text-gray-200 font-mono">{escrow.seller_phone || 'N/A'}</span></div>
              <div><span className="text-gray-500">Status:</span> <span className="text-emerald-400 font-bold uppercase ml-1">{escrow.status}</span></div>
            </div>
          </div>
          
          {escrow.status === 'pending' ? (
            <button onClick={handlePayment} className="w-full bg-emerald-500 text-black font-extrabold py-4 px-6 rounded-xl">Pay ₦{Number(escrow.amount).toLocaleString()} Safely</button>
          ) : escrow.status === 'funded' ? (
            <div className="space-y-3">
              <button onClick={() => setShowConfirmModal(true)} disabled={updating} className="w-full bg-blue-600 text-white font-bold py-4 px-6 rounded-xl">Confirm Delivery Received</button>
              <button onClick={() => setShowDisputeModal(true)} disabled={updating} className="w-full bg-red-900/40 text-red-400 font-bold py-3 px-6 rounded-xl">Raise Dispute</button>
            </div>
          ) : (
             <div className="p-4 bg-gray-900 border border-gray-700 text-gray-400 rounded-xl text-center font-semibold text-sm">Transaction {escrow.status}</div>
          )}
        </div>
      </div>
    </>
  )
}
