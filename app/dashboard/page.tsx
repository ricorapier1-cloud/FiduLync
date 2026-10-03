import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  let deals: any[] = []
  let totalLocked = 0
  let activeDeals = 0

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    const { data, error } = await supabase.from('deals').select('*').order('created_at', { ascending: false })
    if (data && !error) {
      deals = data
      totalLocked = data.filter(d => d.status.toLowerCase() === 'locked').reduce((acc, curr) => acc + Number(curr.amount), 0)
      activeDeals = data.length
    }
  }

  return (
    <div className="min-h-screen bg-[#0B1120] text-gray-300 font-sans p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <Link href="/" className="text-2xl font-black text-white tracking-tighter">
            Fidu<span className="text-emerald-500">Lync</span>
          </Link>
          <Link href="/" className="bg-emerald-500 text-black text-xs font-bold px-4 py-2 rounded-lg hover:bg-emerald-400 transition">
            + New Link
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-[#111827] p-6 rounded-2xl border border-gray-800 shadow-sm">
            <h3 className="text-xs text-gray-500 font-bold uppercase mb-2">Total Locked Value</h3>
            <p className="text-3xl font-black text-white">₦{totalLocked.toLocaleString()}</p>
          </div>
          <div className="bg-[#111827] p-6 rounded-2xl border border-gray-800 shadow-sm">
            <h3 className="text-xs text-gray-500 font-bold uppercase mb-2">Active Deals</h3>
            <p className="text-3xl font-black text-emerald-400">{activeDeals}</p>
          </div>
          <div className="bg-[#111827] p-6 rounded-2xl border border-gray-800 shadow-sm">
            <h3 className="text-xs text-gray-500 font-bold uppercase mb-2">Disputes</h3>
            <p className="text-3xl font-black text-red-500">0</p>
          </div>
        </div>

        <h2 className="text-xl font-bold text-white mb-4">Recent Transactions</h2>
        {deals.length === 0 ? (
          <div className="bg-[#111827] p-10 rounded-3xl border border-gray-800 text-center">
             <p className="text-gray-500 mb-4">No active escrow deals found.</p>
             <Link href="/" className="text-emerald-400 text-sm font-bold hover:underline">Create your first Safe Link</Link>
          </div>
        ) : (
          <div className="bg-[#111827] rounded-3xl border border-gray-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-[#0f1522] border-b border-gray-800">
                  <tr>
                    <th className="p-4 font-bold text-gray-400">Link ID</th>
                    <th className="p-4 font-bold text-gray-400">Item</th>
                    <th className="p-4 font-bold text-gray-400">Amount</th>
                    <th className="p-4 font-bold text-gray-400">Target Bank</th>
                    <th className="p-4 font-bold text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {deals.map((deal) => (
                    <tr key={deal.id} className="hover:bg-white/[0.02] transition">
                      <td className="p-4 font-mono text-xs text-gray-500">{deal.link_id}</td>
                      <td className="p-4 text-white font-bold">{deal.title}</td>
                      <td className="p-4 text-white">{deal.currency} {Number(deal.amount).toLocaleString()}</td>
                      <td className="p-4 text-gray-400 text-xs">{deal.seller_account_name}</td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${
                          deal.status.toLowerCase() === 'locked' 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                        }`}>
                          {deal.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
