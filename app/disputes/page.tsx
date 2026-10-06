'use client';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, UploadCloud } from 'lucide-react';

export default function DisputeCenter() {
  return (
    <div className="max-w-3xl mx-auto p-6">
      <Link href="/" className="inline-flex items-center text-red-400 hover:text-red-300 mb-6 font-bold"><ArrowLeft size={18} className="mr-2"/> Back to Home</Link>
      
      <div className="bg-[#111820] border border-red-900/50 rounded-2xl p-8 shadow-2xl">
        <h1 className="text-3xl font-black text-white mb-3 flex items-center gap-3"><AlertTriangle className="text-red-500" /> Legal Dispute Center</h1>
        <p className="text-gray-400 mb-8 leading-relaxed">Filing a dispute will instantly freeze escrow payouts. To initiate arbitration, you MUST provide verifiable Proof of Defect or Non-Delivery.</p>

        <form className="space-y-6">
          <div>
            <label className="block text-sm text-gray-400 mb-2 font-bold">Escrow Transaction ID</label>
            <input type="text" placeholder="Paste ID here" className="w-full bg-[#131b24] p-4 rounded-lg border border-gray-700 text-white outline-none focus:border-red-500" required />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2 font-bold">Detailed Reason for Dispute</label>
            <textarea placeholder="State exactly how the delivery breached the agreed terms..." rows={5} className="w-full bg-[#131b24] p-4 rounded-lg border border-gray-700 text-white outline-none focus:border-red-500" required />
          </div>

          <div className="p-6 bg-red-950/20 border border-red-900/50 rounded-lg border-dashed">
            <label className="block text-sm text-red-400 mb-3 font-bold flex items-center gap-2"><UploadCloud size={20}/> Upload Proof of Defect</label>
            <input type="file" multiple className="text-sm text-gray-400 file:mr-4 file:py-3 file:px-6 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-red-900/50 file:text-red-200 hover:file:bg-red-900/80 cursor-pointer" required />
            <p className="text-xs text-red-400/70 mt-2">Screenshots, log files, or video proof required.</p>
          </div>

          <button type="submit" className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-5 rounded-lg shadow-lg text-lg">Freeze Funds & Submit Dispute</button>
        </form>
      </div>
    </div>
  );
}
