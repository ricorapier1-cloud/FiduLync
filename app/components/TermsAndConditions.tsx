'use client'
import React from 'react'

export default function TermsAndConditions() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl text-gray-300">
      <div className="space-y-2 border-b border-gray-800 pb-6">
        <div className="inline-block bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold px-3 py-1 rounded-full">
          ⚖️ Legal Framework & Agreement
        </div>
        <h1 className="text-3xl font-black text-white">Terms of Service & Escrow Agreement</h1>
        <p className="text-xs text-gray-400">FiduLync Technologies Limited • Effective Date: October 2026</p>
      </div>

      <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 sm:p-8 space-y-8 shadow-2xl text-xs sm:text-sm leading-relaxed">
        
        {/* Section 1 */}
        <section className="space-y-2">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span className="text-emerald-400 font-mono">1.</span> Acceptance & Role of Platform
          </h2>
          <p className="text-gray-400">
            By initiating or participating in any escrow transaction on FiduLync, you agree to these binding Terms. FiduLync Technologies Limited operates purely as a <strong className="text-white">neutral software intermediary</strong>. FiduLync is not a party to, nor an agent or guarantor of, any agreement or transaction between Buyer and Seller.
          </p>
        </section>

        {/* Section 2 */}
        <section className="space-y-2">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span className="text-emerald-400 font-mono">2.</span> Regulatory Compliance & KYC/AML
          </h2>
          <p className="text-gray-400">
            In compliance with Central Bank of Nigeria (CBN) regulations and international Anti-Money Laundering (AML) standards, FiduLync reserves the right to request identity verification (BVN, NIN, Government ID, or Bank Verification) prior to releasing funds. Accounts suspected of fraudulent activity or unauthorized payment sources will be frozen pending regulatory review.
          </p>
        </section>

        {/* Section 3 */}
        <section className="space-y-2">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span className="text-emerald-400 font-mono">3.</span> Escrow Lifecycle & Deemed Acceptance
          </h2>
          <ul className="list-disc pl-5 text-gray-400 space-y-2">
            <li><strong className="text-white">Fund Locking:</strong> Funds deposited via Fiat (Paystack/Stripe) or Web3 Smart Contracts are vaulted securely upon transaction initiation.</li>
            <li><strong className="text-white">Inspection Window:</strong> The Buyer is granted a designated Inspection Period (24h to 7 days) starting upon confirmed carrier delivery (DHL/FedEx/GIG) or digital file transfer.</li>
            <li><strong className="text-white">Deemed Acceptance:</strong> If the Buyer takes no action (neither approving nor lodging a dispute) before the Inspection Window expires, the buyer irrevocably consents to the release of funds to the Seller.</li>
          </ul>
        </section>

        {/* Section 4 */}
        <section className="space-y-2">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span className="text-emerald-400 font-mono">4.</span> AI Triage & Interpleader Rights
          </h2>
          <p className="text-gray-400">
            Disputed transactions undergo preliminary AI Analysis to suggest fair fractional releases. If negotiation fails, FiduLync holds the absolute right to deposit disputed funds into a court of competent jurisdiction via an interpleader action, relieving FiduLync of all further liability.
          </p>
        </section>

        {/* Section 5 */}
        <section className="space-y-2">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span className="text-emerald-400 font-mono">5.</span> Limitation of Liability
          </h2>
          <p className="text-gray-400">
            Under no circumstances shall FiduLync Technologies Limited be liable for loss of profits, indirect damages, or software/hardware defects in traded assets (including AlgoLyn MQL5 Expert Advisors or physical merchandise). FiduLync’s maximum aggregate liability shall not exceed the platform fee collected for the specific transaction.
          </p>
        </section>

      </div>
    </div>
  )
}
