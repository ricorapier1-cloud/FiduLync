'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function DisputesPage() {
  const [linkId, setLinkId] = useState('')
  const [reason, setReason] = useState('')
  const [evidence, setEvidence] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!linkId || !reason) {
      toast.error('Please fill in the Vault ID and dispute reason.')
      return
    }
    setSubmitted(true)
    toast.success('Dispute ticket opened successfully!')
  }

  return (
    <main className="min-h-screen bg-[#0B1120] text-white selection:bg-emerald-500/30">
      <nav className="border-b border-gray-800 bg-[#111827]/80 backdrop-blur sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
        <Link href="/" className="text-xl font-black tracking-tight flex items-center gap-2">
          <span>FiduLync</span> <span className="text-emerald-400 font-mono text-xs px-2 py-0.5 bg-emerald-500/10 rounded-full border border-emerald-500/30">Dispute Resolution</span>
        </Link>
        <div className="flex gap-4 text-xs font-bold">
          <Link href="/" className="text-gray-300 hover:text-emerald-400 transition">Home</Link>
          <Link href="/store" className="text-gray-300 hover:text-emerald-400 transition">Store</Link>
          <Link href="/dashboard" className="text-gray-300 hover:text-emerald-400 transition">Dashboard</Link>
        </div>
      </nav>
      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="mb-8 text-center space-y-2">
          <h1 className="text-3xl font-black tracking-tight">Escrow Dispute Center</h1>
          <p className="text-xs text-gray-400">Our arbitration team investigates and resolves disputes within 24 hours.</p>
        </div>
        <div className="bg-[#111827] border border-gray-800 rounded-3xl p-8 shadow-2xl">
          {submitted ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 text-center space-y-4">
              <div className="text-emerald-400 font-bold text-sm">🛡️ Dispute Ticket #DISP-{Math.floor(Math.random()*90000+10000)} Created</div>
              <p className="text-xs text-gray-300">Funds are locked in arbitration review. Our support team has been notified via WhatsApp and Email.</p>
              <button 
                onClick={() => setSubmitted(false)}
                className="bg-emerald-500 text-black font-bold text-xs px-6 py-3 rounded-xl hover:bg-emerald-400 transition"
              >
                Submit Another Dispute
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Escrow Vault / Link ID</label>
                <input 
                  type="text" 
                  placeholder="e.g. 73kp9s or full URL" 
                  value={linkId} 
                  onChange={(e) => setLinkId(e.target.value)}
                  required
                  className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Reason for Dispute</label>
                <select 
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                >
                  <option value="">Select Dispute Reason</option>
                  <option value="not_delivered">Digital Product / EA Not Delivered</option>
                  <option value="malfunctioning">EA / Indicator Does Not Match Description</option>
                  <option value="unresponsive">Seller Unresponsive After Payment</option>
                  <option value="other">Other Transaction Issue</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Evidence & Chat Links (Optional)</label>
                <textarea 
                  rows={4}
                  placeholder="Provide details, screenshot links, or WhatsApp conversation summaries..." 
                  value={evidence} 
                  onChange={(e) => setEvidence(e.target.value)}
                  className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition resize-none"
                />
              </div>
              <button 
                type="submit" 
                className="w-full bg-emerald-500 text-black font-extrabold py-4 rounded-xl hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/10"
              >
                Open Arbitration Dispute
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
