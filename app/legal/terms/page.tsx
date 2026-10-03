import React from 'react'
import Link from 'next/link'

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#0B1120] text-white selection:bg-emerald-500/30">
      <nav className="border-b border-gray-800 bg-[#111827]/80 backdrop-blur sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
        <Link href="/" className="text-xl font-black tracking-tight flex items-center gap-2">
          <span>FiduLync</span> <span className="text-emerald-400 font-mono text-xs px-2 py-0.5 bg-emerald-500/10 rounded-full border border-emerald-500/30">Legal & Terms</span>
        </Link>
        <Link href="/" className="text-xs font-bold text-gray-300 hover:text-emerald-400 transition">Back to Home</Link>
      </nav>
      <div className="max-w-4xl mx-auto px-6 py-16 space-y-8">
        <div className="space-y-3">
          <h1 className="text-4xl font-black tracking-tight">Terms of Service & Escrow Agreement</h1>
          <p className="text-xs text-gray-400">Last updated: October 2026</p>
        </div>
        <div className="space-y-6 text-sm text-gray-300 leading-relaxed bg-[#111827] border border-gray-800 rounded-3xl p-8">
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white">1. Introduction to FiduLync Escrow</h2>
            <p>FiduLync provides institutional-grade secure escrow services for social commerce and digital assets, including Forex trading robots (EAs), custom MQL5 indicators, and remote services. By generating or paying into a FiduLync Safe Link, both buyer and seller agree to abide by these terms.</p>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white">2. Funds Locking & Verification</h2>
            <p>When a buyer completes payment through Paystack, funds are securely locked in the FiduLync Escrow Vault. Sellers are required to deliver the agreed digital product, source code, or MT5 license binding within the stipulated timeframe.</p>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white">3. Dispute Resolution & Arbitration</h2>
            <p>If either party encounters an issue regarding code delivery or functionality, a formal dispute can be raised instantly via the FiduLync Disputes portal. Our arbitration team reviews backtest logs, MT5 account binding IDs, and chat agreements to resolve disputes within 24–48 hours.</p>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white">4. Milestone Payouts & Refunds</h2>
            <p>For milestone-based projects, funds are released incrementally as each phase is verified and approved by the buyer. Refunds are processed strictly upon successful arbitration rulings or mutual vendor agreement.</p>
          </section>
        </div>
      </div>
    </main>
  )
}
