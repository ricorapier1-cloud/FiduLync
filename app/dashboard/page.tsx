import Link from 'next/link'

export default function DashboardPage() {
  // Mock data representing Supabase DB pull for UI visualization
  const mockDeals = [
    { id: 'fdl_a1b2c3d4', item: 'Freelance Web Dev', amount: '150000', currency: 'NGN', status: 'Locked' },
    { id: 'fdl_x9y8z7w6', item: 'Nike Air Jordans', amount: '85000', currency: 'NGN', status: 'Pending' }
  ]

  return (
    <div className="min-h-screen bg-[#0B1120] text-gray-300 font-sans p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <Link href="/" className="text-2xl font-black text-white tracking-tighter">
            Fidu<span className="text-emerald-500">Lync</span>
          </Link>
          <Link href="/" className="bg-gray-800 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-gray-700 transition">
            + New Link
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-[#111827] p-6 rounded-2xl border border-gray-800 shadow-sm">
            <h3 className="text-xs text-gray-500 font-bold uppercase mb-2">Total Locked Value</h3>
            <p className="text-3xl font-black text-white">₦150,000</p>
          </div>
          <div className="bg-[#111827] p-6 rounded-2xl border border-gray-800 shadow-sm">
            <h3 className="text-xs text-gray-500 font-bold uppercase mb-2">Active Deals</h3>
            <p className="text-3xl font-black text-emerald-400">2</p>
          </div>
          <div className="bg-[#111827] p-6 rounded-2xl border border-gray-800 shadow-sm">
            <h3 className="text-xs text-gray-500 font-bold uppercase mb-2">Disputes</h3>
            <p className="text-3xl font-black text-red-500">0</p>
          </div>
        </div>

        <h2 className="text-xl font-bold text-white mb-4">Recent Transactions</h2>
        <div className="bg-[#111827] rounded-3xl border border-gray-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[#0f1522] border-b border-gray-800">
                <tr>
                  <th className="p-4 font-bold text-gray-400">Link ID</th>
                  <th className="p-4 font-bold text-gray-400">Item</th>
                  <th className="p-4 font-bold text-gray-400">Amount</th>
                  <th className="p-4 font-bold text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {mockDeals.map((deal) => (
                  <tr key={deal.id} className="hover:bg-white/[0.02] transition">
                    <td className="p-4 font-mono text-xs text-gray-500">{deal.id}</td>
                    <td className="p-4 text-white font-bold">{deal.item}</td>
                    <td className="p-4 text-white">{deal.currency} {Number(deal.amount).toLocaleString()}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${
                        deal.status === 'Locked' 
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
      </div>
    </div>
  )
}
