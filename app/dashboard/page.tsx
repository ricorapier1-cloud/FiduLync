'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Copy, ExternalLink, RefreshCw, LogOut, Mail, Lock } from 'lucide-react'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

export default function SellerDashboard() {
  const [user, setUser] = useState<any>(null)
  const [email, setEmail] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authSent, setAuthSent] = useState(false)
  const [escrows, setEscrows] = useState<any[]>([])
  const [loadingEscrows, setLoadingEscrows] = useState(false)
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        fetchMerchantEscrows(session.user.email)
      }
    })

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        fetchMerchantEscrows(session.user.email)
      } else {
        setUser(null)
        setEscrows([])
      }
    })

    return () => authListener.subscription.unsubscribe()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setAuthLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    })

    if (error) {
      alert(`Login failed: ${error.message}`)
    } else {
      setAuthSent(true)
    }
    setAuthLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  const fetchMerchantEscrows = async (userEmail: string | undefined) => {
    if (!userEmail) return
    setLoadingEscrows(true)

    const { data, error } = await supabase
      .from('escrows')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setEscrows(data)
    }
    setLoadingEscrows(false)
  }

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/pay/${slug}`
    navigator.clipboard.writeText(url)
    setCopiedSlug(slug)
    setTimeout(() => setCopiedSlug(null), 2000)
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[#F8FAFC] text-[#1A1A1A] p-4 flex items-center justify-center">
        <div className="w-full max-w-md bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="text-center space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
              Merchant Security
            </span>
            <h1 className="text-xl font-bold text-slate-900 mt-2">Seller Dashboard Login</h1>
            <p className="text-xs text-slate-500">Sign in with your email to access your secure escrow links.</p>
          </div>

          {authSent ? (
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-center space-y-2">
              <Mail className="w-8 h-8 text-emerald-600 mx-auto" />
              <h3 className="font-bold text-emerald-900 text-sm">Check your email</h3>
              <p className="text-xs text-emerald-700">We sent a secure magic login link to <strong>{email}</strong>.</p>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Email Address</label>
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="seller@example.com"
                  required
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button 
                type="submit" 
                disabled={authLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition text-sm flex items-center justify-center gap-2"
              >
                {authLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                Send Secure Magic Link
              </button>
            </form>
          )}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#1A1A1A] p-4 flex flex-col items-center">
      <div className="w-full max-w-xl space-y-6">
        
        {/* Header */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
              Verified Session
            </span>
            <h1 className="text-xl font-bold text-slate-900 mt-1">Seller Dashboard</h1>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="text-xs font-semibold text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition flex items-center gap-1 border border-rose-200"
          >
            <LogOut className="w-3.5 h-3.5" /> Log Out
          </button>
        </div>

        {/* Escrow List */}
        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-sm font-bold text-slate-700">Your Escrow Transactions</h2>
            <button 
              onClick={() => fetchMerchantEscrows(user.email)} 
              className="text-xs text-emerald-600 hover:underline flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>

          {loadingEscrows && (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500 text-sm shadow-sm">
              Loading your escrow records...
            </div>
          )}

          {!loadingEscrows && escrows.length === 0 && (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500 text-sm shadow-sm">
              No active escrow links found.
            </div>
          )}

          {escrows.map((item) => {
            const isFunded = item.status === 'funded' || item.status === 'completed'
            return (
              <div key={item.id || item.slug} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">{item.title}</h3>
                    <p className="text-xs text-slate-500 line-clamp-1">{item.description || 'No description provided.'}</p>
                  </div>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                    isFunded ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {item.status || 'pending_payment'}
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center text-sm">
                  <div>
                    <span className="text-xs text-slate-500 block">Amount</span>
                    <span className="font-bold text-slate-900">₦{Number(item.amount).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Buyer Phone</span>
                    <span className="font-medium text-slate-700">{item.buyer_phone || 'N/A'}</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button 
                    onClick={() => copyLink(item.slug)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold py-2 px-3 rounded-xl text-xs transition flex items-center justify-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copiedSlug === item.slug ? 'Copied Link!' : 'Copy Safe Link'}
                  </button>
                  <a 
                    href={`/pay/${item.slug}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold py-2 px-4 rounded-xl text-xs transition flex items-center gap-1"
                  >
                    View <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )
          })}
        </div>

      </div>
    </main>
  )
}
