'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import AuthModal from '@/components/AuthModal';
import { supabase } from '@/lib/supabaseClient';
import { ShieldCheck, TrendingUp, Download, Lock } from 'lucide-react';

export default function Home() {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user));
  }, []);

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-12">
      {/* HEADER */}
      <header className="flex justify-between items-center py-6 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <ShieldCheck size={36} className="text-emerald-500" />
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white">FiduLync</h1>
            <p className="text-xs text-emerald-400 font-medium">SAFE ESCROW PROTECTION</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <Link href="/dashboard"><button className="px-5 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-semibold transition">Dashboard</button></Link>
          ) : (
            <button onClick={() => setIsAuthOpen(true)} className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-black rounded-lg text-sm font-semibold shadow-[0_0_15px_rgba(16,185,129,0.3)] transition">Login / Register</button>
          )}
        </div>
      </header>

      {/* ALGOLYNC STOREFRONT */}
      <section className="bg-gradient-to-br from-[#0c141c] to-[#05080c] rounded-3xl border border-gray-800 p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10"><TrendingUp size={200} /></div>
        <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">📈 AlgoLync Quant Store</h2>
        <p className="text-gray-400 mb-8 max-w-2xl">Institutional-grade MQL5 Expert Advisors. Backtested with 99.9% tick data. Protected by FiduLync Escrow.</p>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* EA Product Card */}
          <div className="bg-[#111820] border border-gray-700 hover:border-emerald-500/50 transition-all rounded-xl p-6">
            <h3 className="text-xl font-bold text-white mb-4">Omni-Nexus V4.2</h3>
            <div className="grid grid-cols-3 gap-2 mb-6">
              <div className="bg-black/50 p-3 rounded-lg text-center"><p className="text-xs text-gray-400">Profit Factor</p><p className="font-bold text-emerald-400">2.41</p></div>
              <div className="bg-black/50 p-3 rounded-lg text-center"><p className="text-xs text-gray-400">Max DD</p><p className="font-bold text-red-400">11.2%</p></div>
              <div className="bg-black/50 p-3 rounded-lg text-center"><p className="text-xs text-gray-400">Win Rate</p><p className="font-bold text-blue-400">76%</p></div>
            </div>
            <div className="flex gap-3">
              <button className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"><Download size={16}/> Try Demo</button>
              <Link href="/create-link" className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-lg"><Lock size={16}/> Buy License</Link>
            </div>
          </div>
        </div>
      </section>

      {/* QUICK LINKS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/create-link" className="bg-[#111820] border border-gray-800 p-6 rounded-xl hover:bg-gray-800 transition-all text-center group">
          <ShieldCheck className="mx-auto mb-3 text-emerald-500 group-hover:scale-110 transition-transform" size={32}/>
          <h3 className="font-semibold text-sm">Create Escrow</h3>
        </Link>
        <Link href="/disputes" className="bg-[#111820] border border-gray-800 p-6 rounded-xl hover:bg-gray-800 transition-all text-center group">
          <TrendingUp className="mx-auto mb-3 text-red-400 group-hover:scale-110 transition-transform" size={32}/>
          <h3 className="font-semibold text-sm">Dispute Center</h3>
        </Link>
      </div>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </main>
  );
}
