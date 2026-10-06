'use client';
import Link from 'next/link';
import { ArrowLeft, Wallet, Shield } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="max-w-5xl mx-auto p-6">
      <Link href="/" className="inline-flex items-center text-emerald-400 hover:text-emerald-300 mb-8 font-bold"><ArrowLeft size={18} className="mr-2"/> Back to Home</Link>
      
      <h1 className="text-4xl font-black mb-8">Customer Terminal</h1>
      
      <div className="grid md:grid-cols-2 gap-6 mb-10">
        <div className="bg-[#111820] border border-gray-800 p-8 rounded-2xl flex items-center gap-5 shadow-lg">
          <div className="p-4 bg-emerald-500/10 rounded-xl"><Wallet size={32} className="text-emerald-500" /></div>
          <div><p className="text-gray-400 text-sm font-bold uppercase">Locked in Escrow</p><p className="text-3xl font-black">₦0.00</p></div>
        </div>
        <div className="bg-[#111820] border border-gray-800 p-8 rounded-2xl flex items-center gap-5 shadow-lg">
          <div className="p-4 bg-blue-500/10 rounded-xl"><Shield size={32} className="text-blue-500" /></div>
          <div><p className="text-gray-400 text-sm font-bold uppercase">Protected Deals</p><p className="text-3xl font-black">0</p></div>
        </div>
      </div>

      <div className="bg-[#111820] border border-gray-800 rounded-2xl p-8 shadow-lg">
        <h2 className="text-2xl font-bold mb-6 border-b border-gray-800 pb-4">Transaction History</h2>
        <div className="text-center text-gray-500 py-16 font-mono text-sm">No active transactions found in registry.</div>
      </div>
    </div>
  );
}
