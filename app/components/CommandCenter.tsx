'use client'
import React from 'react'
import toast from 'react-hot-toast'
import KYCGateway from './KYCGateway'

export default function CommandCenter() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-white">Command Center & Vaults</h2>
          <p className="text-sm text-gray-400 mt-1">Manage tracking, fractional releases, and regulatory compliance.</p>
        </div>
      </div>

      {/* Automatically Linked KYC Regulatory Compliance Section */}
      <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 space-y-4 shadow-2xl">
        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
          🛡️ Regulatory Status & Payout Readiness
        </h3>
        <KYCGateway currentStatus="UNVERIFIED" />
      </div>

      {/* Active Vaults Table */}
      <div className="bg-[#111827] border border-gray-800 rounded-3xl overflow-hidden shadow-2xl overflow-x-auto">
        <div className="p-6 border-b border-gray-800 font-bold text-sm uppercase tracking-wider text-gray-300">
          Active Escrow Contracts
        </div>
        <table className="w-full text-left text-sm text-gray-300 min-w-[700px]">
          <thead className="bg-[#0B1120] text-xs uppercase font-mono text-gray-500 border-b border-gray-800">
            <tr>
              <th className="px-6 py-4">Vault ID</th>
              <th className="px-6 py-4">Asset</th>
              <th className="px-6 py-4">Status & Logistics</th>
              <th className="px-6 py-4">Value</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            <tr className="hover:bg-gray-800/20 transition">
              <td className="px-6 py-4 font-mono text-emerald-400">FIDU-DHL-89X</td>
              <td className="px-6 py-4 font-bold text-white">Sony A7IV Camera</td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <span className="bg-blue-500/10 text-blue-400 px-2 py-1 rounded-md text-xs font-bold border border-blue-500/20">In Transit</span>
                  <span className="text-xs text-gray-400">DHL: 893921004</span>
                </div>
              </td>
              <td className="px-6 py-4 font-mono">₦2,100,000</td>
              <td className="px-6 py-4 text-right">
                <button className="bg-gray-800 text-xs font-bold px-3 py-1.5 rounded-lg text-gray-400 cursor-not-allowed">Auto-Updates</button>
              </td>
            </tr>
            <tr className="hover:bg-gray-800/20 transition">
              <td className="px-6 py-4 font-mono text-emerald-400">FIDU-WEB3-9M</td>
              <td className="px-6 py-4 font-bold text-white">UI/UX App Design</td>
              <td className="px-6 py-4">
                <span className="bg-amber-500/10 text-amber-400 px-2 py-1 rounded-md text-xs font-bold border border-amber-500/20">Milestone 1 Complete</span>
              </td>
              <td className="px-6 py-4 font-mono font-bold text-emerald-400">1,500 USDC</td>
              <td className="px-6 py-4 text-right">
                <button onClick={() => toast.success('50% Partial Release Authorized.')} className="bg-emerald-500 text-black font-extrabold text-xs px-3 py-1.5 rounded-lg shadow-lg shadow-emerald-500/20">
                  Release Partial (50%)
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
