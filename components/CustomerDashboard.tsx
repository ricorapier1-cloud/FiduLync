'use client'
import React, { useState } from 'react'
import toast from 'react-hot-toast'

export default function CustomerDashboard({ userEmail, setActiveView }: { userEmail: string | null, setActiveView: (v: string) => void }) {
  const [tab, setTab] = useState<'all' | 'sales' | 'purchases'>('all')

  const deals = [
    { id: 'FID-101', item: 'Eridam Nexus EA Pro', amount: '$49.00 USD', role: 'Purchase', status: 'Funded in Vault', partner: '+2348030000000', date: 'Oct 4, 2026' },
    { id: 'FID-102', item: 'MacBook Pro M2 256GB', amount: '₦1,250,000 NGN', role: 'Sale', status: 'Delivered - Pending Release', partner: '+2348051112222', date: 'Oct 3, 2026' },
    { id: 'FID-103', item: 'Z-Score MT5 Indicator', amount: '$25.00 USD', role: 'Purchase', status: 'Released', partner: '+2348098887777', date: 'Sep 28, 2026' }
  ]

  const handleRelease = (id: string) => {
    toast.success(`Vault funds for Deal #${id} released to seller!`)
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-800 pb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setActiveView('home')} className="bg-gray-800 text-gray-300 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-gray-700">
            ← Back
          </button>
          <div>
            <h2 className="text-2xl font-black text-white">Customer Dashboard</h2>
            <p className="text-xs text-gray-400">Account: <span className="text-emerald-400 font-mono">{userEmail || 'Demonstration Mode'}</span></p>
          </div>
        </div>

        <div className="flex gap-2">
          {['all', 'sales', 'purchases'].map((t) => (
            <button key={t} onClick={() => setTab(t as any)} className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize ${tab === t ? 'bg-emerald-500 text-black' : 'bg-gray-800 text-gray-400'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#111827] p-4 rounded-2xl border border-gray-800"><div className="text-[10px] text-gray-400 font-bold uppercase">Vault Funds</div><div className="text-xl font-black text-emerald-400">₦1,250,000</div></div>
        <div className="bg-[#111827] p-4 rounded-2xl border border-gray-800"><div className="text-[10px] text-gray-400 font-bold uppercase">Active Escrows</div><div className="text-xl font-black text-white">2</div></div>
        <div className="bg-[#111827] p-4 rounded-2xl border border-gray-800"><div className="text-[10px] text-gray-400 font-bold uppercase">Completed</div><div className="text-xl font-black text-white">14</div></div>
        <div className="bg-[#111827] p-4 rounded-2xl border border-gray-800"><div className="text-[10px] text-gray-400 font-bold uppercase">Disputes</div><div className="text-xl font-black text-red-400">0</div></div>
      </div>

      <div className="bg-[#111827] border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-gray-800 font-bold text-sm text-white">Active Escrow Deals</div>
        <div className="divide-y divide-gray-800/60">
          {deals.map((deal) => (
            <div key={deal.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:bg-gray-800/20 transition">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">{deal.item}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${deal.role === 'Sale' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'}`}>{deal.role}</span>
                </div>
                <div className="text-xs text-gray-400 font-mono">{deal.amount} • Counterparty: {deal.partner}</div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">{deal.status}</span>
                {deal.role === 'Purchase' && deal.status !== 'Released' && (
                  <button onClick={() => handleRelease(deal.id)} className="bg-emerald-500 hover:bg-emerald-400 text-black px-3.5 py-1.5 rounded-lg text-xs font-bold transition">
                    Release Funds
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
