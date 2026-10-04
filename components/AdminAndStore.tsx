'use client'
import React, { useState } from 'react'
import toast from 'react-hot-toast'

export function AdminPanel() {
  const disputes = [
    { id: 'DSP-882', item: 'iPhone 14 Pro Max', amount: '₦650,000', buyer: '+2348011111111', seller: '+2348022222222', reason: 'Item not delivered' }
  ]

  const handleOverride = (id: string, action: string) => {
    toast.success(`Admin Action Executed: ${action} for ${id}`)
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="border-b border-gray-800 pb-3">
        <h2 className="text-2xl font-black text-white">Admin Control Panel</h2>
        <p className="text-xs text-emerald-400 font-mono">System Status: Active • Direct Override Enabled</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#111827] p-4 rounded-2xl border border-gray-800"><div className="text-[10px] text-gray-400 font-bold uppercase">Volume</div><div className="text-xl font-black text-white">₦14.2M</div></div>
        <div className="bg-[#111827] p-4 rounded-2xl border border-gray-800"><div className="text-[10px] text-gray-400 font-bold uppercase">Commissions (2%)</div><div className="text-xl font-black text-emerald-400">₦284,000</div></div>
        <div className="bg-[#111827] p-4 rounded-2xl border border-gray-800"><div className="text-[10px] text-gray-400 font-bold uppercase">Open Disputes</div><div className="text-xl font-black text-red-400">1</div></div>
      </div>

      <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5 space-y-4">
        <h3 className="font-bold text-sm text-white">Active Dispute Review</h3>
        {disputes.map((d) => (
          <div key={d.id} className="bg-[#0B1120] p-4 rounded-2xl border border-gray-800 space-y-3 text-xs">
            <div className="flex justify-between font-bold text-white">
              <span>{d.id} — {d.item}</span>
              <span className="text-emerald-400 font-mono">{d.amount}</span>
            </div>
            <p className="text-gray-400">Claim: "{d.reason}"</p>
            <div className="flex gap-2 pt-2">
              <button onClick={() => handleOverride(d.id, 'Force Payout to Seller')} className="flex-1 bg-emerald-500/20 text-emerald-400 font-bold py-2 rounded-lg">Force Seller Payout</button>
              <button onClick={() => handleOverride(d.id, 'Force Refund to Buyer')} className="flex-1 bg-red-500/20 text-red-400 font-bold py-2 rounded-lg">Force Buyer Refund</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AlgoStore() {
  const [modal, setModal] = useState<any>(null)
  const [mt5, setMt5] = useState('')

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="text-center space-y-1">
        <div className="text-emerald-400 text-xs font-mono font-bold tracking-widest uppercase">AlgoLync Quant Suite</div>
        <h1 className="text-3xl font-black text-white">Institutional MQL5 Systems</h1>
      </div>

      <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 space-y-4">
        <div className="flex justify-between items-start">
          <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2.5 py-1 rounded-full">Flagship EA</span>
          <span className="text-xs font-mono text-gray-500">v2.4</span>
        </div>
        <h2 className="text-xl font-black text-white">ERIDAM NEXUS ADAPTIVE PRO</h2>
        <p className="text-xs text-gray-400">Kaufman Efficiency Ratio filter, ATR envelopes, and equity shield.</p>
        <div className="text-2xl font-black text-emerald-400">$49 <span className="text-xs text-gray-400">USD</span></div>
        <div className="flex gap-3">
          <button onClick={() => toast.success('Downloading Demo (.ex5)...')} className="flex-1 bg-gray-800 text-white font-bold py-3 rounded-xl text-xs">Download Demo</button>
          <button onClick={() => setModal({ name: 'ERIDAM NEXUS PRO', price: '49' })} className="flex-1 bg-emerald-500 text-black font-bold py-3 rounded-xl text-xs">Buy License</button>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0B1120] border border-gray-800 rounded-2xl p-6 w-full max-w-sm space-y-4 relative">
            <button onClick={() => setModal(null)} className="absolute top-4 right-4 text-gray-400">✕</button>
            <h3 className="font-bold text-white text-lg">License Binding</h3>
            <input type="text" placeholder="MT5 Account Number" value={mt5} onChange={(e) => setMt5(e.target.value)} className="w-full bg-[#050810] border border-gray-800 rounded-xl p-3 text-sm text-white font-mono" />
            <button onClick={() => { toast.success('Redirecting to Paystack Direct Deposit...'); setModal(null); }} className="w-full bg-emerald-500 text-black font-bold py-3 rounded-xl text-xs">
              Pay ${modal.price} USD via Paystack
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function WhatsAppFloat() {
  return (
    <a
      href="https://wa.me/2348037212445?text=Hello%20FiduLync%20Support,%20I%20need%20assistance..."
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 bg-[#25D366] hover:bg-[#1DA851] text-white p-4 rounded-full shadow-[0_0_25px_rgba(37,211,102,0.4)] transition-transform hover:scale-110 flex items-center justify-center"
    >
      <span className="text-2xl">💬</span>
    </a>
  )
}
