'use client';
import { useState } from 'react';

export function PaystackCheckout() {
  const [email, setEmail] = useState('');
  const [mt5Account, setMt5Account] = useState('');
  const [loading, setLoading] = useState(false);
  const [licenseKey, setLicenseKey] = useState<string | null>(null);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !mt5Account) return;
    setLoading(true);

    try {
      const res = await fetch('/api/v1/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, mt5_account: Number(mt5Account) }),
      });
      const data = await res.json();
      if (data.success && data.license_key) {
        setLicenseKey(data.license_key);
      } else {
        alert(data.error || 'Checkout initialization failed');
      }
    } catch {
      alert('Network error during checkout initialization');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#06120E] border border-emerald-500/30 rounded-xl p-6 max-w-md mx-auto text-emerald-100 shadow-2xl">
      <h3 className="text-lg font-mono font-bold mb-2 tracking-wide text-emerald-400">ALGOLYNX VAULT ACCESS</h3>
      <p className="text-xs text-emerald-300/70 mb-4">Secure institutional license binding for MetaTrader 5 Expert Advisors.</p>
      
      {licenseKey ? (
        <div className="bg-emerald-950/60 border border-emerald-500/50 p-4 rounded-lg text-center">
          <p className="text-xs text-emerald-300 mb-1">LICENSE PROVISIONED SUCCESSFULLY:</p>
          <code className="text-sm font-mono font-bold text-emerald-400 block select-all bg-black/40 p-2 rounded">{licenseKey}</code>
          <p className="text-[10px] text-emerald-400/60 mt-2">Paste this key into your MT5 EA input parameters.</p>
        </div>
      ) : (
        <form onSubmit={handleCheckout} className="space-y-4">
          <div>
            <label className="block text-xs font-mono mb-1 text-emerald-300">Subscriber Email</label>
            <input 
              type="email5" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="trader@institution.com"
              className="w-full bg-black/50 border border-emerald-500/30 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-400 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-mono mb-1 text-emerald-300">MT5 Account Number</label>
            <input 
              type="number" 
              required
              value={mt5Account}
              onChange={(e) => setMt5Account(e.target.value)}
              placeholder="12345678"
              className="w-full bg-black/50 border border-emerald-500/30 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-400 font-mono"
            />
          </div>
          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-black font-mono font-bold py-2.5 rounded transition-colors text-sm tracking-wider"
          >
            {loading ? 'INITIALIZING PAYSTACK...' : 'PROVISION LICENSE ($150/mo)'}
          </button>
        </form>
      )}
    </div>
  );
}
