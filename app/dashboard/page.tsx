'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { ShieldCheck, Copy, ExternalLink, Search, RefreshCw, Lock } from 'lucide-react'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

export default function SellerDashboard() {
  const [searchPhone, setSearchPhone] = useState('')
  const [escrows, setEscrows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchPhone) return

    setLoading(true)
    setSearched(true)

    // Clean phone number input for matching
    const cleanPhone = searchPhone.trim()

    const { data, error } = await supabase
      .from('escrows')
      .select('*')
      .or(`buyer_phone.ilike.%${cleanPhone}%,description.ilike.%${cleanPhone}%`)
      .order('created_at', { ascending: false })

    if (error) {
      alert(`Error fetching links: ${error.message}`)
      setEscrows([])
    } else {
      setEscrows(data || [])
    }
    setLoading(false)
  }

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/pay/${slug}`
    navigator.clipboard.writeText(url)
    setCopiedSlug(slug)
    setTimeout(() => setCopiedSlug(null), 2000)
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#1A1A1A] p-4 flex flex-col items-center">
      <div className="w-full max-w-xl space-y-6">
        
        {/* Header */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
              veriPay Merchant Hub
            </span>
            <h1 className="text-xl font-bold text-slate-900 mt-1">Seller Dashboard</h1>
          </div>
          <a href="/" className="text-xs font-semibold text-emerald-600 hover:underline">
            + Create New Link
          </a>
        </div>

        {/* Search Box */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">Find Your Escrow Links</h2>
          <form onSubmit={handleSearch} className="flex gap-2">
            <input 
              type="text" 
              value={searchPhone} 
              onChange={(e) => setSearchPhone(e.target.value)} 
              placeholder="Enter phone number or keyword..."
              required
              className="flex-1 p-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button 
              type="submit" 
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 rounded-xl transition flex items-center gap-2 text-sm"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </button>
          </form>
        </div>

        {/* Results Section */}
        <div className="space-y-3">
          {searched && escrows.length === 0 && !loading && (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500 text-sm shadow-sm">
              No escrow links found matching that search.
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
