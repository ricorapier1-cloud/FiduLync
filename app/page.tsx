'use client'
import React, { useState } from 'react'
import toast from 'react-hot-toast'
import EscrowCreator from './components/EscrowCreator'
import CommandCenter from './components/CommandCenter'
import AIDisputeCenter from './components/AIDisputeCenter'
import TermsAndConditions from './components/TermsAndConditions'

export default function FidulyncApp() {
  const [activeTab, setActiveTab] = useState('escrow')
  const [walletConnected, setWalletConnected] = useState(false)

  const TABS = [
    { id: 'escrow', label: 'Create Escrow', icon: '🛡️' },
    { id: 'dashboard', label: 'Command Center', icon: '📊' },
    { id: 'store', label: 'AlgoLyn Store', icon: '🤖' },
    { id: 'disputes', label: 'AI Resolution Center', icon: '⚖️️' },
    { id: 'terms', label: 'Legal & Terms', icon: '📜' }
  ]

  return (
    <main className="min-h-screen bg-[#0B1120] text-white selection:bg-emerald-500/30 pb-20 overflow-x-hidden">
      <nav className="border-b border-gray-800 bg-[#111827]/90 backdrop-blur sticky top-0 z-50 px-4 sm:px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-lg shrink-0">🛡</div>
          <div>
            <div className="text-xl font-black tracking-tight leading-none">FiduLync</div>
            <div className="text-[10px] text-emerald-400 font-mono font-bold tracking-widest mt-0.5">INSTITUTIONAL</div>
          </div>
        </div>
        
        <button 
          onClick={() => { setWalletConnected(!walletConnected); toast.success(walletConnected ? 'Wallet Disconnected' : 'Connected') }}
          className={`text-[10px] sm:text-xs font-bold px-3 sm:px-4 py-2 rounded-xl transition ${walletConnected ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-gray-800 hover:bg-gray-700'}`}
        >
          {walletConnected ? '🟢 0x7F9...' : 'Connect Wallet'}
        </button>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-8 flex flex-col md:flex-row gap-8">
        <aside className="w-full md:w-64 shrink-0">
          <div className="sticky top-28 flex md:flex-col overflow-x-auto gap-2 pb-4 md:pb-0 scrollbar-hide">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                  activeTab === tab.id 
                    ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/10' 
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <span>{tab.icon}</span> {tab.label}
              </button>
            ))}
          </div>
        </aside>

        <section className="flex-1 min-w-0">
          {activeTab === 'escrow' && <EscrowCreator/>}
          {activeTab === 'dashboard' && <CommandCenter/>}
          {activeTab === 'disputes' && <AIDisputeCenter/>}
          {activeTab === 'terms' && <TermsAndConditions/>}
          {activeTab === 'store' && (
            <div className="text-center text-gray-400 mt-20 animate-pulse font-mono text-sm">
              [ AlgoLyn MT5 Store Architecture is actively synced... ]
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
