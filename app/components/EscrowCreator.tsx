'use client'
import React, { useState } from 'react'
import toast from 'react-hot-toast'

export default function EscrowCreator() {
  const [currency, setCurrency] = useState('NGN')
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!agreedToTerms) {
      toast.error('You must agree to the Terms of Service.')
      return
    }
    toast.success('Safe Escrow Vault Created Successfully.')
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
      <div className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-black text-white">Create Protected Deal</h1>
        <p className="text-sm text-gray-400">Deploy a fiat or smart-contract escrow vault.</p>
      </div>

      <form className="bg-[#111827] border border-gray-800 rounded-3xl p-6 sm:p-8 space-y-8 shadow-2xl" onSubmit={handleCreate}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-gray-400 tracking-wider">Item/Service Title</label>
            <input required type="text" placeholder="e.g. AlgoLyn EA License" className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3.5 text-white focus:border-emerald-500 transition" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-gray-400 tracking-wider">Payment Method</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3.5 text-white focus:border-emerald-500 transition font-bold">
              <option value="NGN">Paystack (Fiat NGN)</option>
              <option value="USDT">Web3 Smart Contract (USDT)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-gray-400 tracking-wider">Agreed Amount</label>
            <input required type="number" placeholder="50000" className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3.5 text-white focus:border-emerald-500 transition font-mono font-bold text-lg" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-gray-400 tracking-wider">Logistics Hook</label>
            <select className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3.5 text-white focus:border-emerald-500 transition">
              <option value="manual">Manual Delivery</option>
              <option value="dhl">Auto-Release via DHL API</option>
            </select>
          </div>
        </div>

        {/* CLICKWRAP MANDATORY CHECKBOX */}
        <div className="bg-[#0B1120] p-4 sm:p-5 rounded-xl border border-gray-800 flex items-start gap-4">
          <input 
            type="checkbox" 
            id="terms" 
            checked={agreedToTerms} 
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            className="mt-1 w-5 h-5 rounded border-gray-700 text-emerald-500 focus:ring-emerald-500 bg-[#111827] cursor-pointer"
          />
          <label htmlFor="terms" className="text-xs sm:text-sm text-gray-400 leading-relaxed cursor-pointer select-none">
            I acknowledge and irrevocably agree to FiduLync Technologies Limited's <strong className="text-white">Terms of Service and Escrow Agreement</strong>. I understand FiduLync is a neutral technology provider, not a party to this transaction.
          </label>
        </div>

        <button 
          type="submit" 
          disabled={!agreedToTerms}
          className={`w-full font-extrabold py-4 rounded-xl transition shadow-lg ${
            agreedToTerms 
              ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20' 
              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
          }`}
        >
          {agreedToTerms ? 'Generate Protected Escrow Vault' : 'Accept Terms to Continue'}
        </button>
      </form>
    </div>
  )
}
