'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import toast, { Toaster } from 'react-hot-toast'

export default function BuyerCheckoutPage({ params }: { params: { id: string } }) {
  const [paymentConfirmed, setPaymentConfirmed] = useState(false)
  const [proofFile, setProofFile] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Simulated Deal Snapshot
  const deal = {
    id: params.id || 'FID-99201',
    itemName: 'Eridam Nexus MQL5 Trading Bot',
    itemDesc: 'Institutional MT5 Expert Advisor with license key delivery',
    sellerName: 'AKINSOOTO ERIC AKINWALE',
    sellerBank: 'Access Bank',
    accountNumber: '0123456789',
    amountNGN: '₦80,850',
    amountUSD: '$49.00 USD',
    lockedRate: '1 USD = ₦1,650.00 (Locked with 0.5% buffer)',
    status: 'Awaiting Payment Deposit'
  }

  const handleConfirmTransfer = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setTimeout(() => {
      setIsSubmitting(false)
      setPaymentConfirmed(true)
      toast.success('Payment receipt submitted! Vault deposit verification in progress.')
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-[#070B14] text-white p-4 sm:p-8 font-sans selection:bg-emerald-500/30">
      <Toaster position="top-center" />
      
      <div className="max-w-xl mx-auto space-y-6">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-4">
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-emerald-400 transition">
            ← Back to FiduLync
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></div>
            <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest">Encrypted Escrow Vault</span>
          </div>
        </div>

        {/* Payment Details Card */}
        <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 space-y-6 shadow-2xl">
          <div className="border-b border-gray-800 pb-4 flex justify-between items-start">
            <div>
              <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-500/20">
                Ref: #{deal.id}
              </span>
              <h1 className="text-xl font-black text-white mt-2">{deal.itemName}</h1>
              <p className="text-xs text-gray-400 mt-0.5">{deal.itemDesc}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-emerald-400">{deal.amountNGN}</div>
              <div className="text-[11px] text-gray-400 font-mono">{deal.amountUSD}</div>
            </div>
          </div>

          {/* Rate Lock Guarantee */}
          <div className="bg-[#0B1120] border border-emerald-500/30 rounded-2xl p-3 flex items-center justify-between text-xs">
            <span className="text-gray-400">Guaranteed FX Lock:</span>
            <span className="font-mono text-emerald-400 font-bold text-[11px]">{deal.lockedRate}</span>
          </div>

          {!paymentConfirmed ? (
            <div className="space-y-5">
              <div className="bg-gradient-to-br from-[#0B171A] to-[#0A111E] border border-emerald-500/40 rounded-2xl p-4 space-y-3">
                <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">🏦 Designated Deposit Bank Account</div>
                <div className="space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between"><span className="text-gray-400">Bank Name:</span><span className="font-bold text-white">{deal.sellerBank}</span></div>
                  <div className="flex justify-between items-center"><span className="text-gray-400">Account Number:</span>
                    <button onClick={() => { navigator.clipboard.writeText(deal.accountNumber); toast.success('Account copied!'); }} className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded hover:bg-emerald-500/20">
                      {deal.accountNumber} 📋
                    </button>
                  </div>
                  <div className="flex justify-between"><span className="text-gray-400">Account Name:</span><span className="font-bold text-white">{deal.sellerName}</span></div>
                </div>
              </div>

              {/* Upload Proof */}
              <form onSubmit={handleConfirmTransfer} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase text-gray-400">Upload Transfer Proof / Receipt (Optional)</label>
                  <input type="file" onChange={(e) => setProofFile(e.target.files?.[0]?.name || null)} className="w-full text-xs text-gray-400 bg-[#0B1120] border border-gray-800 rounded-xl p-3 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-500 file:text-black" />
                </div>

                <button type="submit" disabled={isSubmitting} className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-3.5 rounded-xl text-sm transition shadow-lg shadow-emerald-500/20">
                  {isSubmitting ? 'Verifying Vault Payment...' : 'I Have Made The Transfer'}
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-[#0B1120] border border-emerald-500/40 rounded-2xl p-6 text-center space-y-4">
              <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-xl font-bold">✓</div>
              <h3 className="text-lg font-bold text-white">Funds Deposited in Escrow Vault</h3>
              <p className="text-xs text-gray-300 leading-relaxed">
                Your payment is securely held by FiduLync. The seller has been notified to fulfill your order. Once received, click "Release" in your dashboard to complete the transaction.
              </p>
              <Link href="/" className="inline-block bg-gray-800 text-white font-bold px-6 py-2.5 rounded-xl text-xs hover:bg-gray-700 transition">
                Go to Dashboard
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
