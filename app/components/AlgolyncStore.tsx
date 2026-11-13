'use client';

import React, { useState } from 'react';

export default function AlgolyncStore() {
  const [mt5Account, setMt5Account] = useState('');
  const [email, setEmail] = useState('');

  const handleCheckout = (planName: string, amountUsd: number) => {
    if (!email || !mt5Account) {
      alert('Please enter your email and MT5 account number so your license key binds automatically.');
      return;
    }
    alert(`Initializing Paystack checkout for ${planName} ($${amountUsd}) bound to MT5 #${mt5Account}...`);
  };

  return (
    <section id="algolync-store" className="max-w-5xl mx-auto my-10 p-6 bg-[#0b1210] border border-emerald-500/20 rounded-xl text-slate-100">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-emerald-500/15">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-emerald-400">AlgoLync Vault & Store</span>
          <h2 className="text-2xl font-bold mt-1 text-white">Automated EA Licensing & Pro Signals</h2>
          <p className="text-sm text-slate-400 mt-1">Instant cryptographic license provisioning bound to your MT5 broker account.</p>
        </div>
        <a
          href="/docs/Algolync-User-Manual.pdf"
          download="Algolync-MT5-Setup-Guide.pdf"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-950/80 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-mono uppercase tracking-wider transition"
        >
          ↓ Download Setup Guide (PDF)
        </a>
      </div>

      {/* Account Binding Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6 p-4 bg-black/40 rounded-lg border border-slate-800">
        <div>
          <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Delivery Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="trader@domain.com"
            className="w-full px-3 py-2 bg-[#070b0a] border border-slate-700 rounded text-sm text-white focus:border-emerald-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-mono text-slate-400 uppercase mb-1">MT5 Account Number (For Auto-Binding)</label>
          <input
            type="text"
            value={mt5Account}
            onChange={(e) => setMt5Account(e.target.value)}
            placeholder="e.g. 51029483"
            className="w-full px-3 py-2 bg-[#070b0a] border border-slate-700 rounded text-sm text-white focus:border-emerald-500 outline-none"
          />
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-[#0e1714] border border-emerald-500/20 rounded-lg flex flex-col justify-between">
          <div>
            <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 text-[11px] font-mono uppercase rounded">Monthly Subscription</span>
            <h3 className="text-xl font-bold mt-3">MacroLync Terminal Pro</h3>
            <div className="text-3xl font-extrabold text-emerald-400 mt-2">$5.00 <span className="text-xs font-normal text-slate-400">/ month</span></div>
            <ul className="mt-4 space-y-2 text-xs text-slate-300 font-mono">
              <li>✓ Live /api/v1/macro-signal & top-pairs feed</li>
              <li>✓ Tier-1 News Lockout (±30m) & Rollover Guard</li>
              <li>✓ Unlimited MT5 WebRequest telemetry queries</li>
            </ul>
          </div>
          <button
            onClick={() => handleCheckout('MacroLync Terminal Pro', 5)}
            className="mt-6 w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-black font-bold text-xs font-mono uppercase tracking-wider rounded-lg transition"
          >
            Subscribe via Paystack ($5/mo)
          </button>
        </div>

        <div className="p-6 bg-[#0e1714] border border-slate-700/60 rounded-lg flex flex-col justify-between">
          <div>
            <span className="px-2.5 py-1 bg-slate-700/40 text-slate-300 text-[11px] font-mono uppercase rounded">Automated EA License</span>
            <h3 className="text-xl font-bold mt-3">ERIDAM Nexus / Velocity Vault</h3>
            <div className="text-3xl font-extrabold text-white mt-2">$49.00 <span className="text-xs font-normal text-slate-400">/ one-time</span></div>
            <ul className="mt-4 space-y-2 text-xs text-slate-300 font-mono">
              <li>✓ Instant ALGOLYNX- key bound to MT5 login</li>
              <li>✓ Full MacroLyncBridge & License .mqh integration</li>
              <li>✓ Optimized for 1 vCPU / 1 GB RAM VPS</li>
            </ul>
          </div>
          <button
            onClick={() => handleCheckout('AlgoLync EA License', 49)}
            className="mt-6 w-full py-3 bg-slate-100 hover:bg-white text-black font-bold text-xs font-mono uppercase tracking-wider rounded-lg transition"
          >
            Buy EA License via Paystack ($49)
          </button>
        </div>
      </div>
    </section>
  );
}
