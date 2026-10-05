'use client'
import React, { useState } from 'react'
import toast from 'react-hot-toast'

interface AdminGateProps {
  isUnlocked: boolean
  onUnlock: () => void
  children: React.ReactNode
}

export default function AdminGate({ isUnlocked, onUnlock, children }: AdminGateProps) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })

      const data = await res.json()
      if (data.success) {
        toast.success('Admin access granted')
        onUnlock()
      } else {
        toast.error(data.error || 'Access denied')
      }
    } catch {
      toast.error('Failed to verify password')
    } finally {
      setLoading(false)
    }
  }

  if (isUnlocked) return <>{children}</>

  return (
    <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 sm:p-8 max-w-md mx-auto space-y-4 shadow-2xl text-center">
      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xl font-bold mx-auto">
        🔒
      </div>
      <h2 className="text-xl font-black text-white">Admin Restricted Area</h2>
      <p className="text-xs text-gray-400">Enter the system administrator password to continue.</p>

      <form onSubmit={handleAdminLogin} className="space-y-4">
        <input
          type="password"
          required
          placeholder="Enter Admin Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3.5 text-xs text-white outline-none focus:border-emerald-500 font-mono text-center"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-3.5 rounded-xl text-xs transition disabled:opacity-50"
        >
          {loading ? 'Verifying...' : 'Unlock Admin Panel'}
        </button>
      </form>
    </div>
  )
}
