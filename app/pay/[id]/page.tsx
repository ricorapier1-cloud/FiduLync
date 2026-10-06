'use client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Lock, ShieldCheck } from 'lucide-react';

export default function BuyerCheckout() {
  const { id } = useParams();

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="bg-[#0b1016] border border-emerald-500/30 p-8 rounded-2xl w-full max-w-md shadow-[0_0_40px_rgba(16,185,129,0.1)]">
        <Link href="/" className="inline-flex items-center text-gray-400 hover:text-white mb-6 text-sm"><ArrowLeft size={16} className="mr-2"/> Cancel</Link>
        <div className="text-center mb-6">
          <ShieldCheck size={48} className="mx-auto text-emerald-500 mb-3" />
          <h1 className="text-2xl font-bold text-white">Secure Checkout</h1>
          <p className="text-gray-400 text-sm mt-1">Transaction ID: {id}</p>
        </div>
        
        <div className="bg-[#131b24] p-4 rounded-lg border border-gray-800 mb-6">
           <div className="flex justify-between text-sm mb-2"><span className="text-gray-400">Item</span><span className="font-semibold text-white">AlgoLync EA License</span></div>
           <div className="flex justify-between text-sm mb-2"><span className="text-gray-400">Escrow Fee</span><span className="font-semibold text-white">1.5%</span></div>
           <hr className="border-gray-800 my-3" />
           <div className="flex justify-between text-lg"><span className="text-gray-400">Total</span><span className="font-bold text-emerald-400">₦250,000.00</span></div>
        </div>

        <button className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold py-4 rounded-lg shadow-lg flex justify-center items-center gap-2">
          <Lock size={18} /> Pay & Lock Funds in Escrow
        </button>
      </div>
    </div>
  );
}
