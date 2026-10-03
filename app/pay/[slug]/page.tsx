'use client'
import { useEffect, useState } from 'react'
import Script from 'next/script'

export default function PaymentPage({ params }: { params: { slug: string } }) {
  const [escrow, setEscrow] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    async function fetchEscrow() {
      try {
        const res = await fetch(`/api/escrow/${params.slug}`)
        const data = await res.json()
        if (!res.ok || !data.escrow) throw new Error(data.error || 'Link not found')
        setEscrow(data.escrow)
      } catch (err: any) {
        setError(err.message || 'Failed to load escrow transaction')
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
      metadata: {
        custom_fields: [{ display_name: 'FiduLync Escrow ID', variable_name: 'link_id', value: escrow.link_id }]
      },
      onSuccess: (transaction: any) => {
        alert(`Payment successful! Ref: ${transaction.reference}`)
        setEscrow((prev: any) => ({ ...prev, status: 'funded' }))
      },
      onCancel: () => alert('Payment cancelled.')
    })
  }

  const handleConfirmDelivery = async () => {
    if (!confirm('Confirm you have received and inspected this item? Funds will be disbursed to the seller instantly.')) return
    setUpdating(true)
    try {
      const res = await fetch(`/api/escrow/${params.slug}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' })
      })
      const data = await res.json()
      if (data.success) setEscrow((prev: any) => ({ ...prev, status: 'completed' }))
    } catch (err) {
      alert('Failed to update status.')
    } finally {
      setUpdating(false)
    }
  }

  const handleDispute = async () => {
    const reason = prompt('Please briefly explain the issue (e.g., damaged item, wrong product):')
    if (!reason) return // User cancelled prompt
    
    setUpdating(true)
    try {
      const res = await fetch(`/api/escrow/${params.slug}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      })
      const data = await res.json()
      if (data.success) {
        alert('Dispute raised successfully. Funds are frozen until an admin reviews the case.')
        setEscrow((prev: any) => ({ ...prev, status: 'disputed' }))
      } else {
        alert(data.error || 'Failed to raise dispute.')
      }
    } catch (err) {
      alert('Failed to process dispute request.')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-[#0B1120] flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div></div>
  if (error || !escrow) return <div className="min-h-screen bg-[#0B1120] text-white p-6 flex items-center justify-center"><div className="max-w-md w-full bg-[#111827] border border-red-500/40 p-8 rounded-2xl text-center"><div className="text-4xl mb-4">⚠️️</div><h2 className="text-xl font-bold mb-2">Link Unavailable</h2><p className="text-gray-400 text-sm">{error || 'This link has expired.'}</p></div></div>

  return (
    <>
      <Script src="https://js.paystack.co/v2/inline.js" strategy="lazyOnload" />
      <div className="min-h-screen bg-[#0B1120] text-white p-4 sm:p-8 flex flex-col items-center justify-center">
        <div className="max-w-xl w-full bg-[#111827] border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-6">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">🛡️ FIDULYNC PROTECTED</span>
            <span className="text-xs font-mono text-gray-400">ID: {escrow.link_id}</span>
          </div>
          <div className="space-y-4 mb-6">
            <h1 className="text-2xl font-bold text-white">{escrow.title}</h1>
            {escrow.description && <p className="text-gray-400 text-sm">{escrow.description}</p>}
            <div className="p-4 bg-[#0B1120] rounded-2xl border border-gray-800 flex justify-between items-center">
              <span className="text-gray-400 text-sm">Escrow Amount:</span>
              <span className="text-2xl font-black text-emerald-400 font-mono">₦{Number(escrow.amount || 0).toLocaleString()}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs bg-[#0B1120]/50 p-3 rounded-xl border border-gray-800/80">
              <div><span className="text-gray-500">Seller Phone:</span> <span className="text-gray-200 font-mono">{escrow.seller_phone || 'N/A'}</span></div>
              <div>
                <span className="text-gray-500">Status:</span> 
                <span className={`font-bold uppercase ml-1 ${escrow.status === 'disputed' ? 'text-red-500' : 'text-emerald-400'}`}>
                  {escrow.status}
                </span>
              </div>
            </div>
          </div>
          
          {escrow.status === 'pending' ? (
            <button onClick={handlePayment} className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-4 px-6 rounded-xl transition shadow-lg shadow-emerald-500/20 text-center">
              Pay ₦{Number(escrow.amount).toLocaleString()} Safely into Escrow
            </button>
          ) : escrow.status === 'funded' ? (
            <div className="space-y-3">
              <button onClick={handleConfirmDelivery} disabled={updating} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-6 rounded-xl transition shadow-lg shadow-blue-500/20">
                {updating ? 'Updating Status...' : 'Confirm Delivery Received'}
              </button>
              <button onClick={handleDispute} disabled={updating} className="w-full bg-red-900/40 hover:bg-red-900/60 text-red-400 border border-red-900 font-bold py-3 px-6 rounded-xl transition">
                {updating ? 'Processing...' : 'Raise Dispute (Item Damaged / Not Received)'}
              </button>
            </div>
          ) : escrow.status === 'disputed' ? (
             <div className="p-4 bg-red-950/40 border border-red-500/40 text-red-300 rounded-xl text-center font-semibold text-sm">⚠️ Funds Locked: Dispute Under Admin Review</div>
          ) : (
            <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 rounded-xl text-center font-semibold text-sm">✓ Transaction Completed</div>
          )}
        </div>
      </div>
    </>
  )
}
