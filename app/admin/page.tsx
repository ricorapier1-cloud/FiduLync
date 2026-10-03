'use client'
import { useEffect, useState } from 'react'

export default function AdminDashboard() {
  const [escrows, setEscrows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/escrows')
      .then(res => res.json())
      .then(data => {
        if (data.escrows) setEscrows(data.escrows)
        setLoading(false)
      })
  }, [])

  const handleResolve = async (link_id: string, action: 'refund_buyer' | 'release_seller') => {
    if (!confirm(`Are you sure you want to ${action.replace('_', ' ')}? This cannot be undone.`)) return
    
    try {
      const res = await fetch('/api/admin/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link_id, action })
      })
      const data = await res.json()
      
      if (data.success) {
        setEscrows(prev => prev.map(e => e.link_id === link_id ? { ...e, status: data.newStatus } : e))
      } else {
        alert(data.error)
      }
    } catch (err) {
      alert('Failed to resolve dispute.')
    }
  }

  if (loading) return <div className="min-h-screen bg-[#0B1120] flex items-center justify-center text-emerald-500 font-mono">Loading Admin Data...</div>

  return (
    <div className="min-h-screen bg-[#0B1120] text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-black mb-8 text-emerald-400">FiduLync Command Center</h1>
        
        <div className="bg-[#111827] rounded-2xl border border-gray-800 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#1F2937] text-gray-400 uppercase font-bold text-xs">
              <tr>
                <th className="p-4">ID</th>
                <th className="p-4">Item</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Status</th>
                <th className="p-4">Dispute Reason</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {escrows.map(escrow => (
                <tr key={escrow.id} className="hover:bg-[#1a2333] transition">
                  <td className="p-4 font-mono text-gray-500">{escrow.link_id}</td>
                  <td className="p-4 font-bold">{escrow.title}</td>
                  <td className="p-4 text-emerald-400 font-mono">₦{Number(escrow.amount).toLocaleString()}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                      escrow.status === 'disputed' ? 'bg-red-900/40 text-red-400' :
                      escrow.status === 'funded' ? 'bg-blue-900/40 text-blue-400' :
                      escrow.status === 'completed' ? 'bg-emerald-900/40 text-emerald-400' :
                      'bg-gray-800 text-gray-400'
                    }`}>
                      {escrow.status}
                    </span>
                  </td>
                  <td className="p-4 text-gray-400 text-xs max-w-xs truncate" title={escrow.dispute_reason}>
                    {escrow.dispute_reason || '-'}
                  </td>
                  <td className="p-4 text-right space-x-2">
                    {escrow.status === 'disputed' && (
                      <>
                        <button onClick={() => handleResolve(escrow.link_id, 'refund_buyer')} className="bg-red-900/40 hover:bg-red-600 text-white text-xs px-3 py-2 rounded transition">Refund</button>
                        <button onClick={() => handleResolve(escrow.link_id, 'release_seller')} className="bg-emerald-900/40 hover:bg-emerald-600 text-white text-xs px-3 py-2 rounded transition">Release</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
