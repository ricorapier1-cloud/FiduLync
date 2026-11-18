'use client';

import React, { useEffect, useState } from 'react';
import { EA_CATALOG, EaProduct, getEaBySlug } from '@/lib/eaCatalog';

export function PaystackCheckout({ selectedEaSlug = 'eridam-nexus-pro', selectedBillingCycle = 'MONTHLY', selectedCurrency = 'NGN' }: { selectedEaSlug?: string; selectedBillingCycle?: 'MONTHLY' | 'ANNUAL'; selectedCurrency?: 'NGN' | 'USD' }) {
  const [tab, setTab] = useState<'BUY' | 'BIND' | 'DOWNLOADS'>('BUY');
  const [selectedSlug, setSelectedSlug] = useState<string>(selectedEaSlug);
  const [plan, setPlan] = useState<'MONTHLY' | 'ANNUAL'>(selectedBillingCycle);
  const [currency, setCurrency] = useState<'NGN' | 'USD'>(selectedCurrency);
  const [extraLiveSeats, setExtraLiveSeats] = useState<0 | 1 | 3 | 5>(0);
  const [dbProducts, setDbProducts] = useState<Array<{ slug: string; monthly_price_ngn: number; monthly_price_usd: number; annual_price_ngn: number; annual_price_usd: number; extra_seat_price_ngn: number; extra_seat_price_usd: number }>>([]);
  const [email, setEmail] = useState('');
  const [mt5Account, setMt5Account] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Account Binding Tab state
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [accountToBind, setAccountToBind] = useState('');
  const [accountTypeToBind, setAccountTypeToBind] = useState<'LIVE' | 'DEMO'>('LIVE');
  const [brokerServerInput, setBrokerServerInput] = useState('');
  const [boundAccountsList, setBoundAccountsList] = useState<any[]>([]);
  const [availableSlots, setAvailableSlots] = useState<{ live: number; demo: number }>({ live: 1, demo: 2 });
  const [loadingBinding, setLoadingBinding] = useState(false);

  useEffect(() => {
    if (selectedEaSlug) setSelectedSlug(selectedEaSlug);
    setPlan(selectedBillingCycle);
    setCurrency(selectedCurrency);
  }, [selectedEaSlug, selectedBillingCycle, selectedCurrency]);

  useEffect(() => {
    let active = true;
    fetch('/api/v1/products', { cache: 'no-store' }).then((response) => response.json()).then((data) => {
      if (active && Array.isArray(data.products)) setDbProducts(data.products);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const currentEa: EaProduct = getEaBySlug(selectedSlug) || EA_CATALOG[0];

  const dbProduct = dbProducts.find((item) => item.slug === selectedSlug);
  const monthlyNgn = dbProduct?.monthly_price_ngn ?? currentEa.monthlyPriceNgn;
  const monthlyUsd = dbProduct?.monthly_price_usd ?? currentEa.monthlyPriceUsd;
  const annualNgn = dbProduct?.annual_price_ngn ?? monthlyNgn * 10;
  const annualUsd = dbProduct?.annual_price_usd ?? monthlyUsd * 10;
  const extraNgn = dbProduct?.extra_seat_price_ngn ?? 0;
  const extraUsd = dbProduct?.extra_seat_price_usd ?? 0;
  const priceNgn = (plan === 'MONTHLY' ? monthlyNgn : annualNgn) + extraNgn * extraLiveSeats * (plan === 'ANNUAL' ? 10 : 1);
  const priceUsd = (plan === 'MONTHLY' ? monthlyUsd : annualUsd) + extraUsd * extraLiveSeats * (plan === 'ANNUAL' ? 10 : 1);

  const priceDisplay =
    currency === 'NGN'
      ? `₦${priceNgn.toLocaleString()} ${plan === 'MONTHLY' ? '/ month' : '/ year'}`
      : `$${priceUsd} ${plan === 'MONTHLY' ? '/ month' : 'One-Time'}`;

  // Check URL callback ref
  useEffect(() => {
    const reference = new URLSearchParams(window.location.search).get('ref');
    if (!reference) return;

    setLoading(true);
    fetch(`/api/v1/verify-payment?reference=${encodeURIComponent(reference)}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.license_key) {
          setSuccessMsg(`Payment verified! Your License Key: ${data.license_key}. Check below to bind your MT5 accounts.`);
          setLicenseKeyInput(data.license_key);
          setTab('BIND');
          window.history.replaceState({}, '', '/store#vault-checkout');
        } else {
          setErrorMsg(data.error || 'Payment verification pending.');
        }
      })
      .catch(() => setErrorMsg('Failed to verify payment reference.'))
      .finally(() => setLoading(false));
  }, []);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/v1/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          ea_slug: selectedSlug,
          currency,
          billing_cycle: plan,
          extra_live_seats: extraLiveSeats,
          mt5_account: mt5Account ? Number(mt5Account) : undefined,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setErrorMsg(data.error || 'Checkout initialization failed');
        return;
      }

      if (data.mode === 'paystack_redirect' && data.authorization_url) {
        window.location.href = data.authorization_url;
      }
    } catch {
      setErrorMsg('Network error connecting to Paystack.');
    } finally {
      setLoading(false);
    }
  };

  const handleQueryBoundAccounts = async (key: string) => {
    if (!key.trim()) return;
    setLoadingBinding(true);
    try {
      const res = await fetch(`/api/v1/bind-account?license_key=${encodeURIComponent(key.trim().toUpperCase())}`);
      const data = await res.json();
      if (data.success) {
        setBoundAccountsList(data.bound_accounts || []);
        setAvailableSlots({
          live: data.available_live_slots ?? 1,
          demo: data.available_demo_slots ?? 2,
        });
      } else {
        setErrorMsg(data.error || 'Could not find license records.');
      }
    } catch {
      setErrorMsg('Failed to query bound accounts.');
    } finally {
      setLoadingBinding(false);
    }
  };

  const handleBindSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKeyInput.trim() || !accountToBind.trim()) return;
    setLoadingBinding(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/v1/bind-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          license_key: licenseKeyInput.trim().toUpperCase(),
          account_number: Number(accountToBind),
          account_type: accountTypeToBind,
          broker_server: brokerServerInput.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(data.message);
        setAccountToBind('');
        await handleQueryBoundAccounts(licenseKeyInput);
      } else {
        setErrorMsg(data.error || 'Binding error');
      }
    } catch {
      setErrorMsg('Network error during account binding.');
    } finally {
      setLoadingBinding(false);
    }
  };

  return (
    <div id="vault-checkout" className="w-full max-w-2xl mx-auto rounded-2xl border border-white/[0.08] bg-[#090d14]/90 p-6 md:p-8 shadow-2xl backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] tracking-wider text-emerald-400 uppercase">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            INSTITUTIONAL LICENSE &amp; ACCOUNT GATE
          </div>
          <h3 className="mt-1 text-xl font-bold tracking-tight text-white">
            AlgoLync Subscription Portal
          </h3>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 p-1 font-mono text-xs">
          <button
            type="button"
            onClick={() => { setTab('BUY'); setErrorMsg(null); }}
            className={`rounded px-3 py-1.5 transition-all ${
              tab === 'BUY' ? 'bg-emerald-500 font-bold text-black shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            SUBSCRIBE / BUY
          </button>
          <button
            type="button"
            onClick={() => { setTab('BIND'); setErrorMsg(null); }}
            className={`rounded px-3 py-1.5 transition-all ${
              tab === 'BIND' ? 'bg-emerald-500 font-bold text-black shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            BIND ACCOUNTS (1 Live + 2 Demo)
          </button>
          <button
            type="button"
            onClick={() => { setTab('DOWNLOADS'); setErrorMsg(null); }}
            className={`rounded px-3 py-1.5 transition-all ${
              tab === 'DOWNLOADS' ? 'bg-emerald-500 font-bold text-black shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            ARTIFACTS
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-950/40 p-3 font-mono text-xs text-red-300">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-950/40 p-3 font-mono text-xs text-emerald-300">
          {successMsg}
        </div>
      )}

      {/* TAB 1: SUBSCRIBE / BUY */}
      {tab === 'BUY' && (
        <form onSubmit={handleCheckout} className="mt-6 space-y-5">
          {/* EA Selector */}
          <div>
            <label className="block font-mono text-xs text-slate-400 uppercase tracking-wider mb-2">
              Select Algorithmic System
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EA_CATALOG.filter((e) => e.tierCategory !== 'SANDBOX').map((ea) => (
                <button
                  key={ea.slug}
                  type="button"
                  onClick={() => setSelectedSlug(ea.slug)}
                  className={`flex flex-col text-left p-3 rounded-xl border transition-all ${
                    selectedSlug === ea.slug
                      ? 'border-emerald-500/60 bg-emerald-500/10 text-white'
                      : 'border-white/[0.06] bg-black/30 text-slate-400 hover:border-white/20'
                  }`}
                >
                  <span className="font-mono text-[10px] text-emerald-400 uppercase font-semibold">{ea.badge}</span>
                  <strong className="text-sm font-bold text-white mt-0.5">{ea.name}</strong>
                  <span className="text-[11px] font-mono text-slate-400 mt-1">
                    Monthly: ₦{ea.monthlyPriceNgn.toLocaleString()} / ${ea.monthlyPriceUsd}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Plan & Currency Switcher */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-xs text-slate-400 uppercase tracking-wider mb-1.5">
                License Term
              </label>
              <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-white/10 bg-black/40 p-1 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setPlan('MONTHLY')}
                  className={`rounded py-1.5 text-center transition-all ${
                    plan === 'MONTHLY' ? 'bg-emerald-500 font-bold text-black' : 'text-slate-400'
                  }`}
                >
                  MONTHLY
                </button>
                <button
                  type="button"
                  onClick={() => setPlan('ANNUAL')}
                  className={`rounded py-1.5 text-center transition-all ${
                    plan === 'ANNUAL' ? 'bg-emerald-500 font-bold text-black' : 'text-slate-400'
                  }`}
                >
                  ANNUAL · 2 MONTHS FREE
                </button>
              </div>
            </div>

            <div>
              <label className="block font-mono text-xs text-slate-400 uppercase tracking-wider mb-1.5">
                Billing Currency
              </label>
              <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-white/10 bg-black/40 p-1 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setCurrency('NGN')}
                  className={`rounded py-1.5 text-center transition-all ${
                    currency === 'NGN' ? 'bg-emerald-500 font-bold text-black' : 'text-slate-400'
                  }`}
                >
                  NGN (₦)
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`rounded py-1.5 text-center transition-all ${
                    currency === 'USD' ? 'bg-emerald-500 font-bold text-black' : 'text-slate-400'
                  }`}
                >
                  USD ($)
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block font-mono text-xs text-slate-400 uppercase tracking-wider mb-2">Extra live account seats</label>
            <div className="grid grid-cols-4 gap-2">{([0, 1, 3, 5] as const).map((count) => <button key={count} type="button" onClick={() => setExtraLiveSeats(count)} className={extraLiveSeats === count ? 'rounded-lg border border-emerald-400/50 bg-emerald-400/10 px-2 py-2 text-xs text-emerald-200' : 'rounded-lg border border-white/10 px-2 py-2 text-xs text-slate-400'}>{count === 0 ? 'Included' : '+' + count}</button>)}</div>
          </div>

          {/* Input Fields */}
          <div>
            <label className="block font-mono text-xs text-slate-300 mb-1">
              Subscriber Email (For License Key &amp; Receipt)
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="trader@institution.com"
              className="w-full rounded-lg border border-white/10 bg-black/50 px-4 py-2.5 font-mono text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-slate-300 mb-1">
              Primary MT5 Account Login (Optional at checkout · Can bind later)
            </label>
            <input
              type="number"
              min="1"
              value={mt5Account}
              onChange={(e) => setMt5Account(e.target.value)}
              placeholder="e.g. 50192841"
              className="w-full rounded-lg border border-white/10 bg-black/50 px-4 py-2.5 font-mono text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Entitlement Guarantee Box */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 font-mono text-xs text-emerald-200/90 space-y-1">
            <div className="flex items-center gap-2 font-bold text-emerald-300">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              INCLUDED SEAT ENTITLEMENTS:
            </div>
            <p className="text-[11px] text-slate-300">
              • <strong>1 Live MT5 Account</strong> + <strong>2 Demo MT5 Accounts</strong> included free with every subscription.
            </p>
            <p className="text-[11px] text-slate-300">
              • Self-service re-binding with a 72-hour cooldown timer when switching brokers or passing prop challenges.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-emerald-500 py-3.5 font-mono text-sm font-bold text-black shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 disabled:opacity-50"
          >
            {loading ? 'INITIALIZING PAYSTACK CHECKOUT…' : `PROVISION ${currentEa.name.toUpperCase()} • ${priceDisplay}`}
          </button>
        </form>
      )}

      {/* TAB 2: BIND ACCOUNTS */}
      {tab === 'BIND' && (
        <div className="mt-6 space-y-6">
          <div className="rounded-xl border border-white/10 bg-black/40 p-4 font-mono">
            <label className="block text-xs text-slate-400 uppercase tracking-wider mb-2">
              Enter Your License Key
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={licenseKeyInput}
                onChange={(e) => setLicenseKeyInput(e.target.value.toUpperCase())}
                placeholder="ALGO-LIVE-... or ALGO-DEMO-..."
                className="flex-1 rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-xs font-bold text-emerald-400 placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleQueryBoundAccounts(licenseKeyInput)}
                disabled={loadingBinding}
                className="rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-4 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500 hover:text-black transition-colors"
              >
                {loadingBinding ? 'CHECKING…' : 'LOOKUP'}
              </button>
            </div>
          </div>

          {/* Slot Capacity Status */}
          <div className="grid grid-cols-2 gap-3 font-mono text-xs">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
              <span className="text-[10px] text-slate-400 uppercase block">Live Account Slot</span>
              <strong className="text-sm text-emerald-400">
                {1 - availableSlots.live} of 1 Bound
              </strong>
              <span className="text-[10px] text-slate-500 block mt-1">
                {availableSlots.live > 0 ? '1 Live slot available' : 'Slot occupied'}
              </span>
            </div>
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3">
              <span className="text-[10px] text-slate-400 uppercase block">Demo Account Slots</span>
              <strong className="text-sm text-cyan-400">
                {2 - availableSlots.demo} of 2 Bound
              </strong>
              <span className="text-[10px] text-slate-500 block mt-1">
                {availableSlots.demo} Demo slots available
              </span>
            </div>
          </div>

          {/* Bound Accounts List */}
          {boundAccountsList.length > 0 && (
            <div className="rounded-xl border border-white/[0.08] bg-black/30 p-4 font-mono text-xs">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Currently Bound MT5 Accounts
              </h4>
              <div className="space-y-2">
                {boundAccountsList.map((acc, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-white/5 bg-black/60 p-2.5"
                  >
                    <div>
                      <span className="font-bold text-white">#{acc.account_number}</span>
                      <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        acc.account_type === 'LIVE' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      }`}>
                        {acc.account_type}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500">
                      Cooldown: 72h protection active
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bind New Account Form */}
          <form onSubmit={handleBindSubmit} className="space-y-3 font-mono">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Bind An Additional MT5 Account
            </h4>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-1">Account Type</label>
                <select
                  value={accountTypeToBind}
                  onChange={(e) => setAccountTypeToBind(e.target.value as 'LIVE' | 'DEMO')}
                  className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="LIVE">LIVE Account (1 Slot)</option>
                  <option value="DEMO">DEMO Account (2 Slots)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-1">MT5 Login Number</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={accountToBind}
                  onChange={(e) => setAccountToBind(e.target.value)}
                  placeholder="e.g. 8819203"
                  className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 uppercase mb-1">Broker Server (Optional)</label>
              <input
                type="text"
                value={brokerServerInput}
                onChange={(e) => setBrokerServerInput(e.target.value)}
                placeholder="e.g. MetaQuotes-Demo or FTMO-Server"
                className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loadingBinding}
              className="w-full rounded-xl bg-emerald-500 py-3 font-mono text-xs font-bold text-black hover:bg-emerald-400 transition-colors disabled:opacity-50"
            >
              {loadingBinding ? 'BINDING ACCOUNT…' : 'AUTHORIZE & BIND MT5 ACCOUNT'}
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: DOWNLOADS & MQL5 ARTIFACTS */}
      {tab === 'DOWNLOADS' && (
        <div className="mt-6 space-y-4 font-mono text-xs">
          <p className="text-slate-400 text-xs leading-relaxed">
            Download your verified MQL5 artifacts and cloud gate include files. Place these inside your MetaTrader 5 directory.
          </p>

          <div className="space-y-2">
            <a
              href="/downloads/MacroLyncLicense.mqh"
              download="MacroLyncLicense.mqh"
              className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 p-3 hover:border-emerald-500/40 transition-colors"
            >
              <div>
                <strong className="text-white block">MacroLyncLicense.mqh</strong>
                <span className="text-[10px] text-slate-500">Universal MQL5 WebRequest cloud licensing header</span>
              </div>
              <span className="rounded bg-emerald-500/20 text-emerald-300 px-2 py-1 text-[10px] font-bold">
                DOWNLOAD .MQH
              </span>
            </a>

            <a
              href="/downloads/Eridam_Nexus_Adaptive_Demo.mq5"
              download="Eridam_Nexus_Adaptive_Demo.mq5"
              className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 p-3 hover:border-emerald-500/40 transition-colors"
            >
              <div>
                <strong className="text-white block">Eridam Nexus Adaptive Pro (Demo)</strong>
                <span className="text-[10px] text-slate-500">Multi-Regime Volatility EA for EURUSD, GBPUSD, XAUUSD</span>
              </div>
              <span className="rounded bg-white/10 text-slate-300 px-2 py-1 text-[10px] font-bold">
                DOWNLOAD .MQ5
              </span>
            </a>

            <a
              href="/downloads/Velocity_Vault_Momentum_Demo.mq5"
              download="Velocity_Vault_Momentum_Demo.mq5"
              className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 p-3 hover:border-emerald-500/40 transition-colors"
            >
              <div>
                <strong className="text-white block">Velocity Vault Momentum (Demo)</strong>
                <span className="text-[10px] text-slate-500">London/NY expansion intraday momentum system</span>
              </div>
              <span className="rounded bg-white/10 text-slate-300 px-2 py-1 text-[10px] font-bold">
                DOWNLOAD .MQ5
              </span>
            </a>

            <a
              href="/downloads/MacroLync_G10_Breakout_Test.mq5"
              download="MacroLync_G10_Breakout_Test.mq5"
              className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 p-3 hover:border-emerald-500/40 transition-colors"
            >
              <div>
                <strong className="text-white block">MacroLync G10 ATR Breakout (Sandbox)</strong>
                <span className="text-[10px] text-slate-500">Open-source testing EA for MetaEditor compilation</span>
              </div>
              <span className="rounded bg-white/10 text-slate-300 px-2 py-1 text-[10px] font-bold">
                DOWNLOAD .MQ5
              </span>
            </a>
          </div>

          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3 text-[11px] text-slate-400">
            <strong>Deployment Note:</strong> Remember to whitelist <code className="text-emerald-300">https://fidulync.vercel.app</code> in MT5 Tools → Options → Expert Advisors → Allow WebRequest.
          </div>
        </div>
      )}
    </div>
  );
}

export default PaystackCheckout;
