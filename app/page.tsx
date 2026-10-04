'use client'
import React, { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import EscrowForm from '@/components/EscrowForm'
import CustomerDashboard from '@/components/CustomerDashboard'
import DisputeAndFAQ from '@/components/DisputeAndFAQ'
import { AdminPanel, AlgoStore, WhatsAppFloat } from '@/components/AdminAndStore'
import { supabase } from '@/lib/supabase'
import toast, { Toaster } from 'react-hot-toast'

export default function FidulyncApp() {
  const [activeView, setActiveView] = useState<'home' | 'dashboard' | 'disputes' | 'faq' | 'terms' | 'store' | 'admin'>('home')
  const [userRole, setUserRole] = useState<'customer' | 'admin'>('customer')
  const [userEmail, setUserEmail] = useState<string | null>(null)
  
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUserEmail(session.user.email || null)
    })
  }, [])

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({ email: authEmail, password: authPassword })
      if (error) toast.error(error.message)
      else { toast.success('Account created!'); setUserEmail(authEmail); setShowAuthModal(false); }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword })
      if (error) toast.error(error.message)
      else { toast.success('Welcome back!'); setUserEmail(authEmail); setShowAuthModal(false); }
    }
  }

  return (
    <main className="min-h-screen bg-[#070B14] text-white pb-24 font-sans selection:bg-emerald-500/30 relative">
      <Toaster position="top-center" />

      <Navbar
        activeView={activeView}
        setActiveView={setActiveView}
        userRole={userRole}
        userEmail={userEmail}
        onOpenAuth={() => setShowAuthModal(true)}
        onLogout={() => { setUserEmail(null); toast.success('Logged out.'); }}
      />

      {/* Role Switch Sandbox */}
      <div className="bg-[#0B1120] border-b border-gray-800 py-1.5 px-4 text-center text-xs text-gray-400 flex items-center justify-center gap-3">
        <span className="font-bold text-emerald-400">Environment Sandbox Mode:</span>
        <button onClick={() => { setUserRole('customer'); toast.success('Switched to Customer View'); }} className={`px-2 py-0.5 rounded font-bold ${userRole === 'customer' ? 'bg-emerald-500 text-black' : 'bg-gray-800'}`}>Customer View</button>
        <button onClick={() => { setUserRole('admin'); toast.success('Switched to Admin View'); }} className={`px-2 py-0.5 rounded font-bold ${userRole === 'admin' ? 'bg-emerald-500 text-black' : 'bg-gray-800'}`}>Admin View</button>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-6">
        {activeView === 'home' && <EscrowForm setActiveView={setActiveView} />}
        {activeView === 'dashboard' && <CustomerDashboard userEmail={userEmail} setActiveView={setActiveView} />}
        {(activeView === 'disputes' || activeView === 'faq' || activeView === 'terms') && <DisputeAndFAQ setActiveView={setActiveView} />}
        {activeView === 'admin' && <AdminPanel setActiveView={setActiveView} />}
        {activeView === 'store' && <AlgoStore setActiveView={setActiveView} />}
      </div>

      <WhatsAppFloat />

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0B1120] border border-gray-800 rounded-2xl p-6 w-full max-w-sm space-y-4 relative">
            <button onClick={() => setShowAuthModal(false)} className="absolute top-4 right-4 text-gray-400">✕</button>
            <h3 className="font-bold text-white text-lg">{isSignUp ? 'Create Account' : 'Sign In'}</h3>
            <form onSubmit={handleAuthSubmit} className="space-y-3">
              <input required type="email" placeholder="Email Address" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="w-full bg-[#050810] border border-gray-800 rounded-xl p-3 text-sm text-white outline-none" />
              <input required type="password" placeholder="Password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="w-full bg-[#050810] border border-gray-800 rounded-xl p-3 text-sm text-white outline-none" />
              <button type="submit" className="w-full bg-emerald-500 text-black font-bold py-3 rounded-xl text-xs">{isSignUp ? 'Sign Up' : 'Sign In'}</button>
            </form>
            <button onClick={() => setIsSignUp(!isSignUp)} className="text-xs text-emerald-400 w-full text-center hover:underline">
              {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
