'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, UploadCloud } from 'lucide-react';

const NIGERIAN_BANKS = ["Access Bank", "GTBank", "Zenith Bank", "First Bank", "UBA", "Kuda Bank", "OPay", "Moniepoint", "PalmPay", "Fidelity Bank", "FCMB", "Stanbic IBTC", "Sterling Bank", "Wema Bank", "Union Bank", "Polaris Bank", "Keystone Bank", "VFD Microfinance", "Rubies", "Sparkle", "Standard Chartered"];

export default function CreateLink() {
  return (
    <div className="max-w-2xl mx-auto p-6">
      <Link href="/" className="inline-flex items-center text-emerald-400 hover:text-emerald-300 mb-6 text-sm font-semibold"><ArrowLeft size={16} className="mr-2"/> Back to Home</Link>
      
      <div className="bg-[#0b1016] border border-gray-800 rounded-2xl p-6 shadow-2xl">
        <h1 className="text-2xl font-bold mb-6">Create Secure Escrow Link</h1>
        <form className="space-y-5">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Item / Service Title</label>
            <input type="text" placeholder="e.g. AlgoLync EA License" className="w-full bg-[#131b24] p-3 rounded-lg border border-gray-700 text-white outline-none focus:border-emerald-500" required />
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">Detailed Description (Crucial for Arbitration)</label>
            <textarea placeholder="Describe the item, conditions, and expected delivery..." rows={4} className="w-full bg-[#131b24] p-3 rounded-lg border border-gray-700 text-white outline-none focus:border-emerald-500" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Amount</label>
              <input type="number" className="w-full bg-[#131b24] p-3 rounded-lg border border-gray-700 text-white outline-none focus:border-emerald-500" required />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Currency</label>
              <select className="w-full bg-[#131b24] p-3 rounded-lg border border-gray-700 text-white outline-none focus:border-emerald-500">
                <option value="NGN">NGN (Naira)</option>
                <option value="USD">USD (Dollar)</option>
                <option value="EUR">EUR (Euro)</option>
              </select>
            </div>
          </div>

          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg border-dashed">
            <label className="block text-sm text-gray-400 mb-2 font-semibold flex items-center gap-2"><UploadCloud size={18}/> Upload Proof of Dispatch / Ownership</label>
            <input type="file" className="text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-800 file:text-white hover:file:bg-gray-700" />
            <p className="text-xs text-gray-500 mt-2">Uploading initial proof protects sellers against false claims.</p>
          </div>

          <div className="border-t border-gray-800 pt-5">
            <h3 className="text-sm font-semibold text-emerald-400 mb-3">Payout Bank Information</h3>
            <select className="w-full bg-[#131b24] p-3 rounded-lg border border-gray-700 text-white outline-none focus:border-emerald-500 mb-3" required>
              <option value="">Select Bank...</option>
              {NIGERIAN_BANKS.map(bank => <option key={bank} value={bank}>{bank}</option>)}
            </select>
            <input type="text" placeholder="Account Number" className="w-full bg-[#131b24] p-3 rounded-lg border border-gray-700 text-white outline-none focus:border-emerald-500" required />
          </div>

          <div className="bg-black/30 p-4 rounded-lg border border-gray-800 text-xs text-gray-400">
            <span className="font-bold text-gray-300">Legal Disclaimer:</span> By generating this link, you agree to FiduLync's Terms. FiduLync operates strictly as an escrow agent and assumes no financial liability for digital asset performance, drawdown, or external platform disputes. Funds are auto-released 48 hours after delivery unless a formal dispute is filed with Proof of Defect.
          </div>

          <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold py-4 rounded-lg shadow-lg">Generate Escrow Link</button>
        </form>
      </div>
    </div>
  );
}
