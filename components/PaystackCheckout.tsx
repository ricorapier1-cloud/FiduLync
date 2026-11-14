'use client';
import { useState } from 'react';

export function PaystackCheckout() {
  const [email, setEmail] = useState('');
  const [mt5Account, setMt5Account] = useState('');
  const [currency, setCurrency] = useState<'NGN' | 'USD'>('NGN');
  const [loading, setLoading] = useState(false);
  const [licenseKey, setLicenseKey] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !mt5Account) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/v1/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, mt5_account: Number(mt5Account), currency }),
      });
      const data = await res.json();

      if (!data.success) {
        setErrorMsg(data.error || 'Checkout initialization failed');
        return;
      }
      if (data.mode === 'paystack_redirect' && data.authorization_url) {
        window.location.href = data.authorization_url;
        return;
      }
      if (data.license_key) setLicenseKey(data.license_key);
    } catch {
      setErrorMsg('Network error during checkout initialization');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#06120E] border border-emerald-500/30 rounded-xl p-6 max-w-md mx-auto text-emerald-100 shadow-2xl">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-mono font-bold tracking-wide text-emerald-400">ALGOLYNX VAULT ACCESS</h3>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
          MT5 CLOUD GATE
        </span>
      </div>
      <p className="text-xs text-emerald-300/70 mb-4">
        Bind an institutional license directly to your MetaTrader 5 account number.
      </p>

      <div className="grid grid-cols-2 gap-2 mb-4">
        {(['NGN', 'USD'] as const).map((curr) => (
          <button
            key={curr}
            type="button"
            onClick={() => setCurrency(curr)}
            className={`py-2 px-3 rounded font-mono text-xs border transition-colors ${
              currency === curr
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold'
                : 'bg-black/40 border-emerald-500/20 text-emerald-400/60 hover:border-emerald-500/40'
            }`}
          >
            {curr === 'NGN' ? 'NGN (₦150,000)' : 'USD ($100)'}
          </button>
        ))}
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 rounded bg-red-950/60 border border-red-500/40 text-xs font-mono text-red-300">
          {errorMsg}
        </div>
      )}

      {licenseKey ? (
        <div className="bg-emerald-950/60 border border-emerald-500/50 p-4 rounded-lg text-center">
          <p className="text-xs text-emerald-300 mb-1">LICENSE PROVISIONED:</p>
          <code className="text-sm font-mono font-bold text-emerald-400 block select-all bg-black/50 p-2.5 rounded">
            {licenseKey}
          </code>
          <p className="text-[11px] text-emerald-400/70 mt-2">
            Paste this key into your MT5 EA <span className="font-mono">InpLicenseKey</span> parameter.
          </p>
        </div>
      ) : (
        <form onSubmit={handleCheckout} className="space-y-4">
          <div>
            <label className="block text-xs font-mono mb-1 text-emerald-300">Subscriber Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="trader@institution.com"
              className="w-full bg-black/60 border border-emerald-500/30 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-400 font-mono"
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
              className="w-full bg-black/60 border border-emerald-500/30 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-400 font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-mono font-bold py-2.5 rounded transition-colors text-sm tracking-wider"
          >
            {loading ? 'INITIALIZING SECURE GATE...' : `PROVISION LICENSE (${currency})`}
          </button>
        </form>
      )}
    </div>
  );
}
