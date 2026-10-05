'use client'
import React, { useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabaseClient'

export default function CustomerDashboard() {
  const [identifier, setIdentifier] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [deals, setDeals] = useState<any[]>([])
  const [hasSearched, setHasSearched] = useState(false)

  const handleFetchDeals = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identifier) return toast.error('Enter phone number or account number')

    setIsSearching(true)
    setHasSearched(true)

    try {
      const { data, error } = await supabase
        .from('escrow_deals')
        .select('*')
        .or(`buyer_phone.eq.${identifier},seller_account.eq.${identifier}`)
        .order('created_at', { ascending: false })

      if (error) throw error
      setDeals(data || [])
      toast.success(`Found ${data?.length || 0} transaction records`)
    } catch {
      toast.error('Unable to fetch trade history')
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <h2 className="text-xl font-black text-white">Customer Trade Lookup</h2>
        <p className="text-xs text-gray-400">Enter your registered Buyer Phone or Seller Bank Account number to view your deal history.</p>

        <form onSubmit={handleFetchDeals} className="flex gap-2">
          <input
            type="text"
            required
            placeholder="e.g. 08031234567 or 0123456789"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="flex-1 bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-xs text-white outline-none font-mono"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold px-5 py-3 rounded-xl text-xs transition"
          >
            {isSearching ? 'Loading...' : 'Find Deals'}
          </button>
        </form>
      </div>

      {hasSearched && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Transaction Records</h3>
          {deals.length === 0 ? (
            <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6 text-center text-xs text-gray-400">
              No trade records found for "{identifier}".
            </div>
          ) : (
            deals.map((deal) => (
              <div key={deal.id} className="bg-[#111827] border border-gray-800 rounded-2xl p-4 flex justify-between items-center text-xs">
                <div>
                  <div className="font-mono font-bold text-emerald-400">{deal.reference}</div>
                  <div className="text-gray-400 text-[10px] mt-0.5">Amount: ₦{Number(deal.amount_ngn).toLocaleString()}</div>
                </div>
                <div className="text-right">
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase">
                    {deal.status}
                  </span>
                  <div className="text-[9px] text-gray-500 mt-1">{new Date(deal.created_at).toLocaleDateString()}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
