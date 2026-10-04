'use client'
import React, { useState } from 'react'
import toast from 'react-hot-toast'

export default function DisputeAndFAQ() {
  const [activeTab, setActiveTab] = useState<'dispute' | 'faq'>('dispute')
  const [reason, setReason] = useState('')
  const [evidence, setEvidence] = useState('')

  const faqs = [
    { q: 'How does FiduLync protect buyers and sellers?', a: 'FiduLync holds buyer funds in a secure, non-interest vault until the buyer inspects and confirms the delivery. Once confirmed, funds are automatically transferred to the seller’s bank account within minutes.' },
    { q: 'When are funds paid out to the seller?', a: 'Payouts occur instantly after the buyer taps "Release Funds". If the buyer remains silent after delivery proof is submitted, the system auto-releases funds after 48 hours.' },
    { q: 'How does the AI Dispute Resolution system work?', a: 'If a buyer rejects delivery, the transaction is locked. Both parties submit receipts/videos. The AI analyzes shipping logs and proof of delivery to make a recommendation, backed by manual Admin oversight.' },
    { q: 'Are foreign currency exchange rates fixed?', a: 'Yes. At checkout, exchange rates are frozen and locked in Supabase with a 0.5% slippage buffer. Fluctuations during the hold period will never affect the agreed payout.' }
  ]

  const handleSubmitDispute = (e: React.FormEvent) => {
    e.preventDefault()
    toast.success('Dispute case opened. AI Arbitration & Admin assigned.')
    setReason('')
    setEvidence('')
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex gap-3 border-b border-gray-800 pb-3">
        <button onClick={() => setActiveTab('dispute')} className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTab === 'dispute' ? 'bg-emerald-500 text-black' : 'bg-gray-800 text-gray-400'}`}>
          ⚖️ Resolution Center
        </button>
        <button onClick={() => setActiveTab('faq')} className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTab === 'faq' ? 'bg-emerald-500 text-black' : 'bg-gray-800 text-gray-400'}`}>
          ❓ Frequently Asked Questions
        </button>
      </div>

      {activeTab === 'dispute' ? (
        <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 space-y-5">
          <div>
            <h2 className="text-xl font-black text-white">Open a Dispute / File Claim</h2>
            <p className="text-xs text-gray-400 mt-1">Upload evidence such as courier waybills, unboxing videos, or tracking IDs.</p>
          </div>

          <form onSubmit={handleSubmitDispute} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-gray-400">Reason for Dispute</label>
              <textarea required rows={3} placeholder="Describe the issue clearly..." value={reason} onChange={(e) => setReason(e.target.value)} className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-sm text-white outline-none focus:border-emerald-500" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-gray-400">Proof / Tracking Link URL</label>
              <input type="url" placeholder="https://drive.google.com/..." value={evidence} onChange={(e) => setEvidence(e.target.value)} className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-sm text-white outline-none focus:border-emerald-500" />
            </div>

            <button type="submit" className="w-full bg-red-500 hover:bg-red-400 text-white font-bold py-3 rounded-xl text-xs transition">
              Submit Dispute Evidence
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div key={idx} className="bg-[#111827] border border-gray-800 rounded-2xl p-5 space-y-2">
              <h3 className="font-bold text-emerald-400 text-sm">{faq.q}</h3>
              <p className="text-xs text-gray-300 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
