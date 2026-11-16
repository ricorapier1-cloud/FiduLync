'use client';
import { useEffect, useState } from 'react';

export function PaystackCheckout() {
  const [tab, setTab] = useState<'BUY' | 'RECOVER'>('BUY');
  const [plan, setPlan] = useState<'MONTHLY' | 'LIFETIME'>('MONTHLY');
  const [currency, setCurrency] = useState<'NGN' | 'USD'>('NGN');
  const [email, setEmail] = useState('');
  const [mt5Account, setMt5Account] = useState('');
  const [recoveryLicenseKey, setRecoveryLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [licenseKey, setLicenseKey] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string>('/downloads/AlgoLync_EA_README.txt');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deliveryNotice, setDeliveryNotice] = useState<string | null>(null);

  useEffect(() => {
    const reference = new URLSearchParams(window.location.search).get('ref');
    if (!reference) return;

    let active = true;
    setLoading(true);
    fetch(`/api/v1/verify-payment?reference=${encodeURIComponent(reference)}`, { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success || typeof data.license_key !== 'string') {
          throw new Error(data.error || 'Payment verification is still pending. Please contact support with your payment reference.');
        }
        if (active) {
          setLicenseKey(data.license_key);
          setDeliveryNotice(data.email_sent ? 'A copy of your license has also been sent to your payment email.' : (data.email_notice || 'Save your license key now. Email delivery is not yet configured.'));
          if (typeof data.download_url === 'string') setDownloadUrl(data.download_url);
          window.history.replaceState({}, '', '/store');
        }
      })
      .catch((error: unknown) => {
        if (active) setErrorMsg(error instanceof Error ? error.message : 'Unable to verify payment.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  const priceDisplay =
    plan === 'MONTHLY'
      ? currency === 'NGN' ? '₦65,000 / mo' : '$49 / mo'
      : currency === 'NGN' ? '₦250,000 One-Time' : '$199 One-Time';

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !mt5Account) return;
    setLoading(true);
    setErrorMsg(null);
    setDeliveryNotice(null);

    try {
      const res = await fetch('/api/v1/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, mt5_account: Number(mt5Account), currency, plan }),
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
      if (data.license_key) {
        setLicenseKey(data.license_key);
        if (data.download_url) setDownloadUrl(data.download_url);
      }
    } catch {
      setErrorMsg('Network error during checkout initialization');
    } finally {
      setLoading(false);
    }
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mt5Account || !recoveryLicenseKey.trim()) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/v1/lookup-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license_key: recoveryLicenseKey.trim(), mt5_account: mt5Account }),
      });
      const data = await res.json();
      if (!data.found) {
        setErrorMsg(data.error || 'License not found.');
        return;
      }
      setLicenseKey(data.license_key);
      if (data.download_url) setDownloadUrl(data.download_url);
    } catch {
      setErrorMsg('Network error while looking up license.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#06120E] border border-emerald-500/30 rounded-xl p-6 max-w-md mx-auto text-emerald-100 shadow-2xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-mono font-bold tracking-wide text-emerald-400">ALGOLYNX VAULT</h3>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
          MT5 CLOUD GATE
        </span>
      </div>

      {/* Mode Switcher: New License vs Download / Recover */}
      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-black/50 border border-emerald-500/20 mb-4">
        <button
          type="button"
          onClick={() => { setTab('BUY'); setLicenseKey(null); setErrorMsg(null); }}
          className={`py-1.5 rounded font-mono text-xs transition-colors ${
            tab === 'BUY' ? 'bg-emerald-500 text-black font-bold' : 'text-emerald-300/70 hover:text-white'
          }`}
        >
          NEW LICENSE
        </button>
        <button
          type="button"
          onClick={() => { setTab('RECOVER'); setLicenseKey(null); setErrorMsg(null); }}
          className={`py-1.5 rounded font-mono text-xs transition-colors ${
            tab === 'RECOVER' ? 'bg-emerald-500 text-black font-bold' : 'text-emerald-300/70 hover:text-white'
          }`}
        >
          DOWNLOAD EA / KEY
        </button>
      </div>

      {tab === 'BUY' && !licenseKey && (
        <>
          <div className="grid grid-cols-2 gap-2 mb-2.5">
            {(['MONTHLY', 'LIFETIME'] as const).map((tier) => (
              <button
                key={tier}
                type="button"
                onClick={() => setPlan(tier)}
                className={`py-2 px-2 rounded font-mono text-xs border transition-colors ${
                  plan === tier
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold'
                    : 'bg-black/40 border-emerald-500/20 text-emerald-400/60'
                }`}
              >
                {tier === 'MONTHLY' ? 'MONTHLY ACCESS' : 'LIFETIME BIND'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            {(['NGN', 'USD'] as const).map((curr) => (
              <button
                key={curr}
                type="button"
                onClick={() => setCurrency(curr)}
                className={`py-2 px-2 rounded font-mono text-xs border transition-colors ${
                  currency === curr
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold'
                    : 'bg-black/40 border-emerald-500/20 text-emerald-400/60'
                }`}
              >
                {curr === 'NGN'
                  ? plan === 'MONTHLY' ? 'NGN (₦65,000)' : 'NGN (₦250,000)'
                  : plan === 'MONTHLY' ? 'USD ($49)' : 'USD ($199)'}
              </button>
            ))}
          </div>
        </>
      )}

      {errorMsg && (
        <div className="mb-4 p-3 rounded bg-red-950/60 border border-red-500/40 text-xs font-mono text-red-300">
          {errorMsg}
        </div>
      )}

      {licenseKey ? (
        <div className="bg-emerald-950/60 border border-emerald-500/50 p-4 rounded-lg text-center space-y-3">
          <div>
            <p className="text-[11px] font-mono text-emerald-300 mb-1">ACTIVE MT5 LICENSE KEY:</p>
            <code className="text-sm font-mono font-bold text-emerald-400 block select-all bg-black/60 p-2.5 rounded">
              {licenseKey}
            </code>
          </div>
          <a
            href={downloadUrl}
            download
            className="block w-full bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold py-2.5 rounded text-xs tracking-wider transition-colors"
          >
            DOWNLOAD MT5 INSTALLATION GUIDE
          </a>
          <p className="text-[11px] text-emerald-400/70">This is the installation guide, not a compiled .EX5 robot. Compiled EA packages will be published after MetaEditor compilation and testing.</p>
          <p className="text-[11px] text-emerald-400/70">
            Whitelist <span className="font-mono text-emerald-300">https://fidulync.vercel.app</span> in MT5 Tools → Options → Expert Advisors.
          </p>
        </div>
      ) : (
        <form onSubmit={tab === 'BUY' ? handleCheckout : handleRecover} className="space-y-4">
          {tab === 'BUY' && <div>
            <label className="block text-xs font-mono mb-1 text-emerald-300">Subscriber Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="trader@institution.com"
              className="w-full bg-black/60 border border-emerald-500/30 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-400 font-mono"
            />
          </div>}
          {tab === 'RECOVER' && <div>
            <label className="block text-xs font-mono mb-1 text-emerald-300">Existing License Key</label>
            <input type="text" required value={recoveryLicenseKey} onChange={(e) => setRecoveryLicenseKey(e.target.value.toUpperCase())} placeholder="ALGOLYNX-..." className="w-full bg-black/60 border border-emerald-500/30 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-400 font-mono" />
          </div>}
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
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-mono font-bold py-2.5 rounded transition-colors text-xs sm:text-sm tracking-wider"
          >
            {loading
              ? 'PROCESSING...'
              : tab === 'BUY'
              ? `PROVISION LICENSE • ${priceDisplay}`
              : 'VERIFY LICENSE & GET INSTALL GUIDE'}
          </button>
        </form>
      )}
    </div>
  );
}
