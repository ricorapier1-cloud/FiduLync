'use client'
import { useState } from 'react'
import EscrowGenerator from './components/EscrowGenerator'
import AlgoLyncStore from './components/AlgoLyncStore'

export default function UnifiedApp() {
  const [activeTab, setActiveTab] = useState<'escrow' | 'algolync'>('escrow')

  return (
    <div className="min-h-screen bg-[#0B1120] text-gray-300 font-sans selection:bg-emerald-500/30">
      <div className="sticky top-0 z-50 bg-[#0B1120]/90 backdrop-blur-md border-b border-gray-800 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div 
            onClick={() => setActiveTab('escrow')}
            className={`cursor-pointer flex items-center space-x-2 transition ${activeTab === 'escrow' ? 'opacity-100' : 'opacity-50 hover:opacity-100'}`}
          >
            <div className="bg-emerald-500/20 p-2 rounded-lg border border-emerald-500/30">
              <span className="text-xl">🛡️</span>
            </div>
            <div>
              <h2 className="text-white font-black leading-tight text-lg">FiduLync</h2>
              <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Safe Escrow Protection</p>
            </div>
          </div>

          <button 
            onClick={() => setActiveTab('algolync')}
            className={`px-4 py-2 rounded-xl text-sm font-bold border transition ${
              activeTab === 'algolync' 
                ? 'bg-[#111827] border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]' 
                : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500'
            }`}
          >
            <span className="mr-2">🏪</span> AlgoLync Store
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 sm:p-8 pt-8">
        {activeTab === 'escrow' ? <EscrowGenerator /> : <AlgoLyncStore />}
      </div>
    </div>
  )
}
