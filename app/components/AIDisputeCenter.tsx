'use client'
import React from 'react'
import toast from 'react-hot-toast'

export default function AIDisputeCenter() {
  return (
    <div className="max-w-3xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl sm:text-3xl font-black text-white">AI Arbitration Center</h2>
        <p className="text-sm text-gray-400 mt-1">Pre-arbitration AI mediation for stalled transactions.</p>
      </div>

      <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center gap-4 border-b border-gray-800 pb-4">
          <div className="w-12 h-12 bg-indigo-500/10 rounded-full flex items-center justify-center text-indigo-400 text-xl border border-indigo-500/20 shrink-0">🤖</div>
          <div>
            <h3 className="font-bold text-white">FiduLync AI Arbitrator</h3>
            <p className="text-xs text-gray-400">Analyzing Chat Logs & Evidence for Vault: FIDU-DEV-42X</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="bg-[#0B1120] p-4 rounded-xl border border-gray-800 text-sm text-gray-300">
            <strong className="text-indigo-400">AI Analysis Complete:</strong> Based on the uploaded GitHub commits and the buyer's requirement document, the seller has completed 80% of the core functionality. The buyer is unsatisfied with the UI aesthetics, which were not explicitly defined in the initial agreement.
          </div>
          <div className="bg-indigo-500/10 border border-indigo-500/30 p-4 rounded-xl">
            <strong className="text-indigo-400 block mb-2 text-sm">Suggested Resolution:</strong>
            <p className="text-xs text-indigo-200 mb-4">Execute an 80/20 fractional split. Release 80% of funds to the seller for functional completion, refund 20% to the buyer for missing UI elements.</p>
            <div className="flex flex-wrap gap-4">
              <button onClick={() => toast.success('Accepted AI Proposal. Processing payouts...')} className="bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-indigo-400 transition">Accept AI Split</button>
              <button onClick={() => toast.success('Escalated to Human Admin Review.')} className="bg-gray-800 text-xs font-bold px-4 py-2 rounded-lg text-white hover:bg-gray-700 transition">Escalate to Admin</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
