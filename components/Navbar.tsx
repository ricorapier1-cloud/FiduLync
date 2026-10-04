'use client'
import React from 'react'

interface NavbarProps {
  activeView: string
  setActiveView: (view: any) => void
  userRole: 'customer' | 'admin'
  userEmail: string | null
  onOpenAuth: () => void
  onLogout: () => void
}

export default function Navbar({
  activeView,
  setActiveView,
  userRole,
  userEmail,
  onOpenAuth,
  onLogout
}: NavbarProps) {
  const menus = [
    { id: 'home', label: 'Create Link', icon: '⚡' },
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'disputes', label: 'Disputes', icon: '⚖️' },
    { id: 'faq', label: 'FAQ & Help', icon: '❓' },
    { id: 'terms', label: 'Legal & Terms', icon: '📜' },
    ...(userRole === 'admin' ? [{ id: 'admin', label: 'Admin Control', icon: '🛡️' }] : [])
  ]

  return (
    <nav className="border-b border-gray-800/80 bg-[#070B14]/95 backdrop-blur sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
        
        {/* Left: Exact Logo matching Screenshot */}
        <div className="flex items-center gap-3 cursor-pointer shrink-0" onClick={() => setActiveView('home')}>
          <div className="w-10 h-10 rounded-2xl bg-[#00c896]/15 border border-[#00c896]/40 flex items-center justify-center text-[#00c896] text-xl shrink-0 shadow-[0_0_15px_rgba(0,200,150,0.15)]">
            🛡️
          </div>
          <div className="flex flex-col justify-center">
            <span className="text-xl sm:text-2xl font-black tracking-tight text-white leading-none">
              FiduLync
            </span>
            <span className="text-[9px] sm:text-[10px] text-[#00c896] font-mono font-bold tracking-widest mt-1 uppercase leading-tight">
              SAFE ESCROW <br /> PROTECTION
            </span>
          </div>
        </div>

        {/* Right: Exact AlgoLync Store Button matching Screenshot */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveView('store')}
            className="group relative border border-[#00c896]/50 bg-[#0B171A] hover:bg-[#00c896]/10 px-3.5 py-1.5 rounded-2xl flex items-center gap-2.5 transition-all duration-200 shadow-[0_0_20px_rgba(0,200,150,0.08)] active:scale-95"
          >
            <div className="w-7 h-7 bg-[#162928] rounded-lg border border-[#00c896]/30 flex items-center justify-center text-sm shrink-0">
              📈
            </div>
            <div className="text-left flex flex-col justify-center">
              <span className="text-[11px] sm:text-xs font-bold text-white group-hover:text-[#00c896] transition-colors leading-tight">
                AlgoLync
              </span>
              <span className="text-[11px] sm:text-xs font-bold text-[#00c896] leading-tight">
                Store
              </span>
            </div>
            <span className="text-[#00c896] text-xs font-bold ml-1 group-hover:translate-x-0.5 transition-transform">
              →
            </span>
          </button>

          {/* User Account / Auth Trigger */}
          {userEmail ? (
            <div className="hidden sm:flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl px-3 py-1 text-xs">
              <span className="text-gray-300 font-mono text-[11px] truncate max-w-[120px]">{userEmail}</span>
              <button onClick={onLogout} className="text-red-400 hover:text-red-300 font-bold ml-1">Exit</button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="hidden sm:block bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold px-3 py-1.5 rounded-xl text-xs hover:bg-emerald-500/20 transition"
            >
              Login / Register
            </button>
          )}
        </div>
      </div>

      {/* Professional Sub-Menu Bar */}
      <div className="max-w-5xl mx-auto px-4 pb-2.5 flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
        {menus.map((menu) => (
          <button
            key={menu.id}
            onClick={() => setActiveView(menu.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 ${
              activeView === menu.id
                ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 shadow-sm'
                : 'bg-[#111827] border border-gray-800/80 text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <span>{menu.icon}</span>
            {menu.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
