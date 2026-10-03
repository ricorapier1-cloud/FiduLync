'use client'
import React, { useState } from 'react'

export default function KYCGateway({ currentStatus }: { currentStatus: string }) {
  const [bvn, setBvn] = useState('')

  if (currentStatus === 'VERIFIED') {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
        <span className="text-emerald-400 text-xl">✅</span>
        <div>
          <h3 className="text-emerald-400 font-bold text-sm">Identity Verified</h3>
          <p className="text-xs text-emerald-500/70">Your account is fully approved for local payouts.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 space-y-4 max-w-md">
      <div className="flex items-start gap-3">
        <span className="text-red-400 text-xl mt-1">⚠️</span>
        <div>
          <h3 className="text-red-400 font-bold text-sm">Regulatory Action Required</h3>
          <p className="text-xs text-red-400/80 mt-1">
            CBN regulations require identity verification before FiduLync can release funds to your bank account.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <input 
          type="text" 
          placeholder="Enter 11-Digit BVN or NIN" 
          maxLength={11}
          value={bvn}
          onChange={(e) => setBvn(e.target.value.replace(/\D/g, ''))}
          className="w-full bg-[#0B1120] border border-red-500/30 rounded-lg p-3 text-white text-sm font-mono focus:border-red-400 transition outline-none"
        />
        <button className="w-full bg-red-500 hover:bg-red-400 text-black font-bold py-3 rounded-lg text-sm transition">
          Verify Identity via SmileID
        </button>
      </div>
    </div>
  )
}
