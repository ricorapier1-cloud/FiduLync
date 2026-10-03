'use client'
import React from 'react'
import Link from 'next/link'

export default function SellerDashboard() {
  const transactions = [
    { id: 'fid_883921', title: 'AlgoLyn Omni-Phoenix EA', amount: '₦250,000', status: 'Locked in Escrow', date: '2026-10-03', buyer: '08123456789' },
    { id: 'fid_992810', title: 'Custom MT5 Regime Indicator', amount: '₦75,000', status: 'Released & Settled', date: '2026-10-02', buyer: '08098765432' },
  ]

  return (
    <main className="min-h-screen bg-[#0B1120] text-white selection:bg-emerald-500/30">
      <nav className="border-b border-gray-800 bg-[#111827]/80 backdrop-blur sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
        <Link href="/" className="text-xl font-black tracking-tight flex items-center gap-2">
          <span>FiduLync</span> <span className="text-emerald-400 font-mono text-xs px-2 py-0.5 bg-emerald-500/10 rounded-full border border-emerald-500/30">Seller Dashboard</span>
        </Link>
        <div className="flex gap-4 text-xs font-bold">
          <Link href="/" className="text-gray-300 hover:text-emerald-400 transition">Escrow Home</Link>
          <Link href="/store" className="text-gray-300 hover:text-emerald-400 transition">Store</Link>
          <Link href="/disputes" className="text-gray-300 hover:text-emerald-400 transition">Disputes</Link>
        </div>
      </nav>
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Sales & Transaction History</h1>
            <p className="text-xs text-gray-400 mt-1">Monitor your escrow vaults, active payouts, and customer orders in real-time.</p>
          </div>
          <Link href="/" className="bg-emerald-500 text-black font-extrabold text-xs px-6 py-3 rounded-xl hover:bg-emerald-400 transition">
            + Create New Safe Link
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
          <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6">
            <div className="text-xs font-bold uppercase text-gray-400 mb-2">Total Escrow Volume</div>
            <div className="text-3xl font-black text-white">₦325,000</div>
            <div className="text-xs text-emerald-400 mt-1 font-mono">+100% this month</div>
          </div>
          <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6">
            <div className="text-xs font-bold uppercase text-gray-400 mb-2">Active Locked Vaults</div>
            <div className="text-3xl font-black text-emerald-400">1 Vault</div>
            <div className="text-xs text-gray-400 mt-1 font-mono">Pending delivery verification</div>
          </div>
          <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6">
            <div className="text-xs font-bold uppercase text-gray-400 mb-2">Successful Payouts</div>
            <div className="text-3xl font-black text-white">₦75,000</div>
            <div className="text-xs text-gray-400 mt-1 font-mono">Settled to bank account</div>
          </div>
        </div>
        <div className="bg-[#111827] border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="px-6 py-4 border-b border-gray-800 text-xs font-bold uppercase tracking-wider text-gray-400">
            Recent Sales & Escrow Records
          </div>
          <div className="divide-y divide-gray-800">
            {transactions.map((tx) => (
              <div key={tx.id} className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-gray-800/40 transition">
                <div>
                  <div className="font-bold text-white text-sm mb-1">{tx.title}</div>
                  <div className="text-xs text-gray-400 font-mono flex gap-4">
                    <span>ID: {tx.id}</span>
                    <span>Date: {tx.date}</span>
                    <span>Buyer Phone: {tx.buyer}</span>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="font-black text-white text-base">{tx.amount}</div>
                    <span className={`inline-block text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full mt-1 ${tx.status.includes('Locked') ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'}`}>
                      {tx.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
