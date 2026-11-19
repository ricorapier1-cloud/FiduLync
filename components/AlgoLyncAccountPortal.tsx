'use client';

import Link from 'next/link';
import { useState } from 'react';

type BoundAccount = {
  account_number: number | string;
  account_type: 'LIVE' | 'DEMO';
  broker_server: string | null;
  bound_at: string | null;
  rebind_available_at: string | null;
};
type SeatSnapshot = {
  success: boolean;
  ea_slug: string;
  available_live_slots: number;
  available_demo_slots: number;
  bound_accounts: BoundAccount[];
};
type ApiResult = { success?: boolean; error?: string; message?: string; rebind_available_at?: string | null };

export default function AlgoLyncAccountPortal() {
  const [licenseKey, setLicenseKey] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountType, setAccountType] = useState<'LIVE' | 'DEMO'>('LIVE');
  const [brokerServer, setBrokerServer] = useState('');
  const [previousAccount, setPreviousAccount] = useState('');
  const [snapshot, setSnapshot] = useState<SeatSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadSeats(event?: React.FormEvent) {
    event?.preventDefault();
    const key = licenseKey.trim().toUpperCase();
    if (!key) { setError('Enter your AlgoLync licence key.'); return; }
    setBusy(true); setError(''); setNotice(''); setSnapshot(null);
    try {
      const response = await fetch('/api/v1/bind-account', {
        headers: { Authorization: 'Bearer ' + key },
        cache: 'no-store',
      });
      const result = await response.json() as SeatSnapshot & { error?: string };
      if (!response.ok || !result.success) throw new Error(result.error || 'Unable to load licence seats.');
      setSnapshot(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Licence seat lookup failed.');
    } finally { setBusy(false); }
  }

  async function assignSeat(event: React.FormEvent) {
    event.preventDefault();
    const key = licenseKey.trim().toUpperCase();
    if (!snapshot || !key) { setError('Verify your licence before assigning an account.'); return; }
    if (!/^\d{1,16}$/.test(accountNumber.trim())) { setError('Enter a valid MT5 login number.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/v1/bind-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          license_key: key,
          account_number: Number(accountNumber),
          account_type: accountType,
          broker_server: brokerServer.trim() || undefined,
          previous_account_number: previousAccount ? Number(previousAccount) : undefined,
        }),
      });
      const result = await response.json() as ApiResult;
      if (!response.ok || !result.success) throw new Error(result.error || 'Account seat assignment was rejected.');
      setNotice(result.message || 'MT5 account seat updated.');
      setAccountNumber(''); setBrokerServer(''); setPreviousAccount('');
      await loadSeats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Account seat assignment failed.');
    } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto min-h-[75vh] w-full max-w-5xl px-5 py-10 pb-44 text-slate-100">
      <Link href="/" className="font-mono text-xs text-emerald-300 hover:underline">← BACK TO TERMINAL</Link>
      <header className="mb-8 mt-8">
        <p className="font-mono text-[10px] tracking-[0.2em] text-emerald-300">ALGOLYNC / CUSTOMER SEAT CONTROL</p>
        <h1 className="mt-3 text-3xl font-semibold">Manage your MT5 accounts</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Verify your licence to view included LIVE and DEMO seats, assign a terminal or request a rebind. Your licence key is used as a bearer credential; keep it private.</p>
      </header>

      <form onSubmit={loadSeats} className="rounded-xl border border-white/10 bg-[#0c1118] p-5">
        <label htmlFor="account-license-key" className="block text-xs text-slate-400">AlgoLync licence key</label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input id="account-license-key" type="password" autoComplete="off" required value={licenseKey} onChange={(event) => setLicenseKey(event.target.value)} placeholder="Enter your licence key" className="h-11 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 font-mono text-sm text-white outline-none focus:border-emerald-300/40" />
          <button type="submit" disabled={busy || !licenseKey.trim()} className="h-11 rounded-lg bg-emerald-300 px-5 text-sm font-semibold text-[#07120d] disabled:opacity-50">{busy ? 'VERIFYING…' : 'VERIFY LICENCE'}</button>
        </div>
      </form>

      {error && <p role="alert" className="mt-4 rounded-lg border border-rose-300/20 bg-rose-300/[0.05] p-3 text-xs text-rose-200">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-lg border border-emerald-300/20 bg-emerald-300/[0.05] p-3 text-xs text-emerald-200">{notice}</p>}

      {snapshot && (
        <>
          <section className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-[#0c1118] p-4">
              <p className="font-mono text-[10px] text-slate-500">AVAILABLE LIVE SEATS</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{snapshot.available_live_slots}</p>
              <p className="mt-1 text-[10px] text-slate-500">Included entitlement: 1 LIVE seat for standard paid plans</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#0c1118] p-4">
              <p className="font-mono text-[10px] text-slate-500">AVAILABLE DEMO SEATS</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{snapshot.available_demo_slots}</p>
              <p className="mt-1 text-[10px] text-slate-500">Included entitlement: 2 DEMO seats for standard paid plans</p>
            </div>
          </section>

          <section className="mt-5 rounded-xl border border-white/10 bg-[#0c1118] p-5">
            <h2 className="text-sm font-semibold">Bound MT5 accounts</h2>
            {snapshot.bound_accounts.length === 0 ? (
              <p className="mt-3 text-xs text-slate-500">No MT5 accounts are currently assigned.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {snapshot.bound_accounts.map((account) => (
                  <div key={String(account.account_number) + account.account_type} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[0.07] bg-black/20 p-3">
                    <div>
                      <p className="font-mono text-sm">{account.account_number} <span className={account.account_type === 'LIVE' ? 'text-amber-200' : 'text-cyan-200'}>· {account.account_type}</span></p>
                      <p className="mt-1 text-[10px] text-slate-500">{account.broker_server || 'Broker/server not supplied'} · Bound {account.bound_at ? new Date(account.bound_at).toLocaleString() : 'date unavailable'}</p>
                    </div>
                    <p className="text-[10px] text-slate-400">Rebind eligible: {account.rebind_available_at ? new Date(account.rebind_available_at).toLocaleString() : 'Not available'}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <form onSubmit={assignSeat} className="mt-5 rounded-xl border border-white/10 bg-[#0c1118] p-5">
            <h2 className="text-sm font-semibold">Assign or rebind an account</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">Leave the replacement field empty to use a free seat. To replace an existing account, select it below. The server enforces the 72-hour cooldown and seat limits; browser time is informational only.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-slate-400">New MT5 login
                <input required inputMode="numeric" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} placeholder="MT5 account number" className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 font-mono text-sm text-white" />
              </label>
              <label className="text-xs text-slate-400">Account mode
                <select value={accountType} onChange={(event) => setAccountType(event.target.value as 'LIVE' | 'DEMO')} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white">
                  <option value="LIVE">LIVE</option><option value="DEMO">DEMO</option>
                </select>
              </label>
              <label className="text-xs text-slate-400">Broker / server (optional)
                <input value={brokerServer} onChange={(event) => setBrokerServer(event.target.value)} maxLength={128} placeholder="Broker server" className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white" />
              </label>
              <label className="text-xs text-slate-400">Existing account to replace (optional)
                <select value={previousAccount} onChange={(event) => {
                  setPreviousAccount(event.target.value);
                  const selected = snapshot.bound_accounts.find((item) => String(item.account_number) === event.target.value);
                  if (selected) setAccountType(selected.account_type);
                }} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white">
                  <option value="">Use a free seat</option>
                  {snapshot.bound_accounts.map((item) => <option key={String(item.account_number)+item.account_type} value={String(item.account_number)}>{item.account_number} · {item.account_type}</option>)}
                </select>
              </label>
            </div>
            <button type="submit" disabled={busy || !accountNumber.trim()} className="mt-4 h-11 rounded-lg bg-emerald-300 px-5 text-sm font-semibold text-[#07120d] disabled:opacity-50">{busy ? 'PROCESSING…' : 'ASSIGN MT5 ACCOUNT'}</button>
          </form>
        </>
      )}
      <p className="mt-8 text-xs text-slate-600">Protect your licence key. Never provide your MT5 master password, investor password or VPS credentials to FiduLync.</p>
    </main>
  );
}
