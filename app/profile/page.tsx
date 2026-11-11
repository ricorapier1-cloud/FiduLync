'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Copy, KeyRound, LogOut, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

type Account = {
  email: string | null;
  tierStatus: 'free' | 'vip_active';
  vipExpiresAt: string | null;
  isOwner: boolean;
  apiKey: { key_prefix: string; created_at: string; licenseKey: string | null } | null;
};

function normalizeAccountRecord(payload: Record<string, unknown>): Account | null {
  if (!isRecord(payload)) return null;
  const email = typeof payload.email === 'string' || payload.email === null ? payload.email : null;
  const tierStatus = payload.tierStatus === 'vip_active' || payload.tierStatus === 'free' ? payload.tierStatus : 'free';
  const vipExpiresAt = typeof payload.vipExpiresAt === 'string' || payload.vipExpiresAt === null ? payload.vipExpiresAt : null;
  const isOwner = typeof payload.isOwner === 'boolean' ? payload.isOwner : false;

  const apiKeyValue = payload.apiKey;
  const apiKey = isRecord(apiKeyValue)
    ? {
        key_prefix: typeof apiKeyValue.key_prefix === 'string' ? apiKeyValue.key_prefix : '',
        created_at: typeof apiKeyValue.created_at === 'string' ? apiKeyValue.created_at : new Date().toISOString(),
        licenseKey: typeof apiKeyValue.licenseKey === 'string' || apiKeyValue.licenseKey === null ? apiKeyValue.licenseKey : null,
      }
    : null;

  return {
    email,
    tierStatus,
    vipExpiresAt,
    isOwner,
    apiKey,
  };
}

type OwnerData = {
  metrics: { activeSubscribers: number; monthlyRecurringRevenueNgn: number; totalSubscriptions: number };
  subscribers: Array<{ reference: string; email: string; status: string; amountNgn: number; createdAt: string; renewsAt: string | null }>;
  apiKeys: Array<{ email: string; prefix: string; createdAt: string; active: boolean }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function dateLabel(value: string | null) {
  if (!value) return 'No renewal scheduled';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not available';
}

export default function ProfilePage() {
  const [accessToken, setAccessToken] = useState('');
  const [account, setAccount] = useState<Account | null>(null);
  const [ownerData, setOwnerData] = useState<OwnerData | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'owner'>('profile');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const loadAccount = useCallback(async (token: string) => {
    const response = await fetch('/api/v1/account', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const payload: unknown = await response.json();
    if (!response.ok || !isRecord(payload)) {
      throw new Error(isRecord(payload) && typeof payload.error === 'string' ? payload.error : 'Your profile could not be loaded.');
    }
    const nextAccount = normalizeAccountRecord(payload);
    if (!nextAccount) {
      throw new Error('Your profile data is not in the expected format.');
    }
    setAccount(nextAccount);
  }, []);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) throw error;
      if (!active) return;
      if (!session?.access_token) {
        setMessage('Sign in from the MacroLync terminal to view your account.');
        return;
      }
      setAccessToken(session.access_token);
      try {
        await loadAccount(session.access_token);
      } catch (loadError) {
        if (active) setMessage(loadError instanceof Error ? loadError.message : 'Your profile could not be loaded.');
      }
    }).catch((error: unknown) => {
      if (active) setMessage(error instanceof Error ? error.message : 'Your session could not be checked.');
    });
    return () => { active = false; };
  }, [loadAccount]);

  async function loadOwnerDashboard() {
    if (!accessToken) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/owner', {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      const payload: unknown = await response.json();
      if (!response.ok || !isRecord(payload)) {
        throw new Error(isRecord(payload) && typeof payload.error === 'string' ? payload.error : 'Owner metrics could not be loaded.');
      }
      setOwnerData(payload as OwnerData);
      setActiveTab('owner');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Owner metrics could not be loaded.');
    } finally {
      setBusy(false);
    }
  }

  async function issueLicenseKey() {
    if (!accessToken) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/account', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload: unknown = await response.json();
      const issuedApiKey = isRecord(payload) && typeof payload.apiKey === 'string' ? payload.apiKey : null;
      if (!response.ok || issuedApiKey === null) {
        throw new Error(isRecord(payload) && typeof payload.error === 'string' ? payload.error : 'MT5 license key could not be issued.');
      }
      setAccount((previous) => previous ? {
        ...previous,
        apiKey: {
          key_prefix: issuedApiKey.slice(0, 10),
          created_at: new Date().toISOString(),
          licenseKey: issuedApiKey,
        },
      } : previous);
      setMessage('Your new MT5 WebRequest key is ready. Copy it now; rotating the key revokes the previous one.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'MT5 license key could not be issued.');
    } finally {
      setBusy(false);
    }
  }

  async function copyLicenseKey() {
    const licenseKey = account?.apiKey?.licenseKey;
    if (!licenseKey) return;
    try {
      await navigator.clipboard.writeText(licenseKey);
      setMessage('MT5 license key copied.');
    } catch {
      setMessage('Clipboard access is unavailable. Select and copy the key manually.');
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setMessage('Sign-out could not be completed. Please try again.');
      return;
    }
    setAccessToken('');
    setAccount(null);
    setOwnerData(null);
    setMessage('You have signed out.');
  }

  return (
    <main className="min-h-screen bg-[#070b10] px-4 py-6 text-slate-100 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 px-3 text-sm text-slate-300 transition hover:border-emerald-400/40 hover:text-white">
          <ArrowLeft size={16} /> Back to terminal
        </Link>
        <header className="mt-8 border-b border-white/10 pb-6">
          <p className="font-mono text-[10px] tracking-[.24em] text-emerald-300">MACROLYNC / ACCOUNT SERVICES</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Profile & access</h1>
          <p className="mt-2 text-sm text-slate-400">Subscription status, secure MT5 credentials, and account controls.</p>
        </header>

        {!account && (
          <section className="mt-8 rounded-xl border border-white/10 bg-[#0c1219] p-5 sm:p-8">
            <p className="text-sm text-slate-300">{message || 'Checking your account…'}</p>
            {!accessToken && <Link href="/#vip" className="mt-4 inline-flex rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950">Go to sign in</Link>}
          </section>
        )}

        {account && (
          <>
            <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
              <div><p className="text-sm text-slate-400">SIGNED IN AS</p><p className="mt-1 text-sm font-medium">{account.email}</p></div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setActiveTab('profile')} className={`rounded-md px-3 py-2 text-sm ${activeTab === 'profile' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}>My profile</button>
                {account.isOwner && <button type="button" onClick={() => void loadOwnerDashboard()} className={`rounded-md px-3 py-2 text-sm ${activeTab === 'owner' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}><span className="inline-flex items-center gap-2"><ShieldCheck size={15} /> Owner dashboard</span></button>}
                <button type="button" onClick={() => void signOut()} className="rounded-md border border-white/10 p-2 text-slate-400 hover:text-white" aria-label="Sign out"><LogOut size={16} /></button>
              </div>
            </div>

            {activeTab === 'profile' && (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <section className="rounded-xl border border-white/10 bg-[#0c1219] p-5 sm:p-7">
                  <div className="flex items-center gap-3"><ShieldCheck className="text-emerald-300" size={20} /><h2 className="text-lg font-semibold">VIP Macro Pass</h2></div>
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-white/10 bg-black/20 p-4"><span className="text-[10px] tracking-wider text-slate-500">STATUS</span><strong className="mt-2 block text-sm text-emerald-300">{account.isOwner ? 'MASTER OWNER · PERMANENT' : account.tierStatus === 'vip_active' ? 'ACTIVE' : 'FREE'}</strong></div>
                    <div className="rounded-lg border border-white/10 bg-black/20 p-4"><span className="text-[10px] tracking-wider text-slate-500">RENEWAL DATE</span><strong className="mt-2 block text-sm">{account.isOwner ? 'No expiry' : dateLabel(account.vipExpiresAt)}</strong></div>
                  </div>
                  {!account.isOwner && account.tierStatus !== 'vip_active' && <Link href="/#vip" className="mt-5 inline-flex rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950">Get VIP Macro Pass · ₦5,000/month</Link>}
                </section>

                <section className="rounded-xl border border-white/10 bg-[#0c1219] p-5 sm:p-7">
                  <div className="flex items-center gap-3"><KeyRound className="text-emerald-300" size={20} /><h2 className="text-lg font-semibold">MT5 WebRequest license</h2></div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">Use this key with your MT5 Expert Advisor. Keep it private; rotating it immediately revokes the old key.</p>
                  {account.apiKey?.licenseKey ? (
                    <div className="mt-5">
                      <label htmlFor="license-key" className="text-[10px] tracking-wider text-slate-500">PERSONAL LICENSE KEY</label>
                      <div className="mt-2 flex gap-2">
                        <input id="license-key" readOnly value={account.apiKey.licenseKey} className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-emerald-200" />
                        <button type="button" onClick={() => void copyLicenseKey()} className="rounded-md border border-white/10 px-3 text-slate-300 hover:text-white" aria-label="Copy license key"><Copy size={16} /></button>
                      </div>
                    </div>
                  ) : <p className="mt-5 rounded-md border border-white/10 bg-black/20 px-3 py-3 text-sm text-slate-400">{account.apiKey ? `Active key ${account.apiKey.key_prefix}…` : 'No MT5 license key has been issued yet.'}</p>}
                  {(account.isOwner || account.tierStatus === 'vip_active') && <button type="button" onClick={() => void issueLicenseKey()} disabled={busy} className="mt-4 inline-flex items-center gap-2 rounded-md border border-emerald-300/30 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-300/10 disabled:opacity-50"><RefreshCw size={14} className={busy ? 'animate-spin' : ''} />{account.apiKey ? 'Rotate license key' : 'Generate license key'}</button>}
                </section>
              </div>
            )}

            {activeTab === 'owner' && account.isOwner && (
              <section className="mt-5 space-y-4">
                {!ownerData ? <div className="rounded-xl border border-white/10 bg-[#0c1219] p-6 text-sm text-slate-400">Loading owner dashboard…</div> : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <article className="rounded-xl border border-white/10 bg-[#0c1219] p-5"><Users className="text-emerald-300" size={18} /><p className="mt-4 text-xs text-slate-500">ACTIVE SUBSCRIBERS</p><strong className="mt-1 block font-mono text-2xl">{ownerData.metrics.activeSubscribers}</strong></article>
                      <article className="rounded-xl border border-white/10 bg-[#0c1219] p-5"><span className="font-mono text-emerald-300">₦</span><p className="mt-4 text-xs text-slate-500">ESTIMATED MONTHLY REVENUE</p><strong className="mt-1 block font-mono text-2xl">₦{new Intl.NumberFormat('en-NG').format(ownerData.metrics.monthlyRecurringRevenueNgn)}</strong></article>
                      <article className="rounded-xl border border-white/10 bg-[#0c1219] p-5"><Check className="text-emerald-300" size={18} /><p className="mt-4 text-xs text-slate-500">ALL SUBSCRIPTION RECORDS</p><strong className="mt-1 block font-mono text-2xl">{ownerData.metrics.totalSubscriptions}</strong></article>
                    </div>
                    <div className="grid gap-4 xl:grid-cols-2">
                      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0c1219]">
                        <h2 className="border-b border-white/10 px-5 py-4 font-semibold">Subscribers</h2>
                        <div className="max-h-[420px] overflow-auto">
                          <table className="w-full text-left text-xs"><thead className="sticky top-0 bg-[#111922] text-slate-500"><tr><th className="px-4 py-3">EMAIL</th><th className="px-3 py-3">STATUS</th><th className="px-3 py-3">MONTHLY</th></tr></thead><tbody>{ownerData.subscribers.map((subscriber) => <tr key={subscriber.reference} className="border-t border-white/5"><td className="px-4 py-3">{subscriber.email}</td><td className="px-3 py-3 capitalize">{subscriber.status.replace('_', ' ')}</td><td className="px-3 py-3 font-mono">₦{new Intl.NumberFormat('en-NG').format(subscriber.amountNgn)}</td></tr>)}</tbody></table>
                          {!ownerData.subscribers.length && <p className="p-5 text-sm text-slate-500">No subscription records yet.</p>}
                        </div>
                      </div>
                      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0c1219]">
                        <h2 className="border-b border-white/10 px-5 py-4 font-semibold">Generated MT5 API keys</h2>
                        <div className="max-h-[420px] overflow-auto">
                          <table className="w-full text-left text-xs"><thead className="sticky top-0 bg-[#111922] text-slate-500"><tr><th className="px-4 py-3">ACCOUNT</th><th className="px-3 py-3">KEY PREFIX</th><th className="px-3 py-3">STATE</th></tr></thead><tbody>{ownerData.apiKeys.map((key, index) => <tr key={`${key.prefix}-${index}`} className="border-t border-white/5"><td className="px-4 py-3">{key.email}</td><td className="px-3 py-3 font-mono">{key.prefix}…</td><td className="px-3 py-3">{key.active ? 'Active' : 'Revoked'}</td></tr>)}</tbody></table>
                          {!ownerData.apiKeys.length && <p className="p-5 text-sm text-slate-500">No API keys have been generated.</p>}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </section>
            )}
          </>
        )}

        {message && <p className="mt-5 rounded-lg border border-white/10 bg-white/[.03] px-4 py-3 text-sm text-emerald-200" role="status">{message}</p>}
        <footer className="mt-10 border-t border-white/10 pt-4 text-xs text-slate-600">MacroLync account services · Secure subscription and key controls</footer>
      </div>
    </main>
  );
}
