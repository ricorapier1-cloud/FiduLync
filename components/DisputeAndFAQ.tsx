'use client'
import React, { useState } from 'react'
import toast from 'react-hot-toast'

export default function DisputeAndFAQ({ setActiveView }: { setActiveView: (v: string) => void }) {
  const [activeTab, setActiveTab] = useState<'dispute' | 'terms' | 'faq'>('dispute')
  const [reason, setReason] = useState('')
  const [evidence, setEvidence] = useState('')

  const handleSubmitDispute = (e: React.FormEvent) => {
    e.preventDefault()
    toast.success('Dispute ticket submitted. AI Arbitration & Admin assigned.')
    setReason('')
    setEvidence('')
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between border-b border-gray-800 pb-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setActiveView('home')} className="bg-gray-800 text-gray-300 px-3 py-1 rounded-xl text-xs font-bold hover:bg-gray-700">
            ← Back
          </button>
          <div className="flex gap-2">
            <button onClick={() => setActiveTab('dispute')} className={`px-3 py-1.5 rounded-xl text-xs font-bold ${activeTab === 'dispute' ? 'bg-emerald-500 text-black' : 'bg-gray-800 text-gray-400'}`}>
              ⚖️ Dispute Center
            </button>
            <button onClick={() => setActiveTab('terms')} className={`px-3 py-1.5 rounded-xl text-xs font-bold ${activeTab === 'terms' ? 'bg-emerald-500 text-black' : 'bg-gray-800 text-gray-400'}`}>
              📜 Terms & Rules
            </button>
            <button onClick={() => setActiveTab('faq')} className={`px-3 py-1.5 rounded-xl text-xs font-bold ${activeTab === 'faq' ? 'bg-emerald-500 text-black' : 'bg-gray-800 text-gray-400'}`}>
              ❓ FAQ
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'dispute' && (
        <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 space-y-5 shadow-2xl">
          <div>
            <h2 className="text-xl font-black text-white">Open Escrow Dispute Ticket</h2>
            <p className="text-xs text-gray-400 mt-1">Submit unboxing videos, courier waybills, or license logs for AI arbitration.</p>
          </div>

          <form onSubmit={handleSubmitDispute} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-gray-400">Reason for Dispute *</label>
              <textarea required rows={3} placeholder="Describe the item non-conformity or non-delivery clearly..." value={reason} onChange={(e) => setReason(e.target.value)} className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-sm text-white outline-none focus:border-emerald-500" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-gray-400">Proof Document / Drive Link URL</label>
              <input type="url" placeholder="https://drive.google.com/..." value={evidence} onChange={(e) => setEvidence(e.target.value)} className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-sm text-white outline-none focus:border-emerald-500" />
            </div>

            <button type="submit" className="w-full bg-red-500 hover:bg-red-400 text-white font-bold py-3 rounded-xl text-xs transition shadow-lg shadow-red-500/20">
              Submit Dispute Evidence
            </button>
          </form>
        </div>
      )}

      {activeTab === 'terms' && (
        <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 space-y-4 shadow-2xl">
          <h2 className="text-xl font-black text-white">Comprehensive Escrow Safety & Legal Terms</h2>
          
          <div className="space-y-3 text-xs text-gray-300 leading-relaxed font-sans border-t border-gray-800 pt-3">
            <p><strong className="text-emerald-400">1. Vault Safe-Keeping:</strong> FiduLync operates as a licensed neutral payment custodian. Buyer funds are held in isolated bank vaults and are never commingled with corporate capital.</p>
            <p><strong className="text-emerald-400">2. 48-Hour Auto-Release Clause:</strong> Following proof of courier delivery or software license transmission, buyers have 48 hours to inspect the item. If no dispute is opened within 48 hours, funds are automatically released to the seller.</p>
            <p><strong className="text-emerald-400">3. Anti-Money Laundering (AML):</strong> All users must submit valid account details matching verified BVN/NIN records during bank settlement to prevent illicit transactions.</p>
            <p><strong className="text-emerald-400">4. Binding Dispute Arbitration:</strong> In event of a dispute, both buyer and seller agree to submit evidence to FiduLync's resolution board. FiduLync’s decision is final and legally binding.</p>
          </div>
        </div>
      )}

      {activeTab === 'faq' && (
        <div className="space-y-3">
          <div className="bg-[#111827] border border-gray-800 rounded-2xl p-4 space-y-1">
            <h3 className="font-bold text-emerald-400 text-xs">How does FiduLync protect my money?</h3>
            <p className="text-xs text-gray-300">Funds are locked in vault until the buyer inspects and approves the item.</p>
          </div>
          <div className="bg-[#111827] border border-gray-800 rounded-2xl p-4 space-y-1">
            <h3 className="font-bold text-emerald-400 text-xs">What happens if the seller does not deliver?</h3>
            <p className="text-xs text-gray-300">You open a dispute in the Resolution Center, and 100% of your vault deposit is refunded to your bank account.</p>
          </div>
        </div>
      )}
    </div>
  )
}
