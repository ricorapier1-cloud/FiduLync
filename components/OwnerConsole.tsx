'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type Session = { access_token: string; user: { email?: string } };
type DiagnosticSummary = { checked_at: string; overall: string; summary: { checks: number; errors: number; blockers: number }; checks: Record<string, { status: string; detail: string }> };
type Installation = { id: string; label: string; status: string; broker: string | null; server: string | null; last_seen_at: string | null; created_at: string };

export default function OwnerConsole() {
  const [email, setEmail] = useState('ricorapier1@gmail.com');
  const [session, setSession] = useState<Session | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mt5Account, setMt5Account] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [label, setLabel] = useState('Primary MT5 market-data terminal');
  const [broker, setBroker] = useState('IC Markets');
  const [server, setServer] = useState('');
  const [publisherToken, setPublisherToken] = useState('');
  const [diagnostics, setDiagnostics] = useState<DiagnosticSummary | null>(null);
  const [diagnosticsBusy, setDiagnosticsBusy] = useState(false);
  const [diagnosticsError, setDiagnosticsError] = useState('');

  const supabase = useMemo<SupabaseClient | null>(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    return url && key ? createClient(url, key) : null;
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session as Session | null);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession as Session | null);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [supabase]);

  useEffect(() => {
    if (session?.access_token && session.user.email?.toLowerCase() === 'ricorapier1@gmail.com') {
      void loadInstallations(session.access_token);
      void loadDiagnostics(session.access_token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token, session?.user.email]);

  async function loadInstallations(token: string) {
    try {
      const response = await fetch('/api/owner/mt5-installations', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load MT5 publishers.');
      setInstallations(data.installations ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : 'MT5 publisher list unavailable.'); }
  }

  async function loadDiagnostics(token: string) {
    setDiagnosticsBusy(true);
    setDiagnosticsError('');
    try {
      const response = await fetch('/api/owner/diagnostics', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Provider diagnostics are unavailable.');
      setDiagnostics(data as DiagnosticSummary);
    } catch (e) {
      setDiagnosticsError(e instanceof Error ? e.message : 'Provider diagnostics are unavailable.');
    } finally {
      setDiagnosticsBusy(false);
    }
  }

  async function sendLoginLink() {
    if (!supabase) { setError('Supabase public authentication settings are not configured.'); return; }
    if (email.trim().toLowerCase() !== 'ricorapier1@gmail.com') { setError('Only the registered owner email can access this console.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: `${window.location.origin}/owner` },
      });
      if (authError) throw authError;
      setNotice('A secure sign-in link has been sent to the owner inbox. Open it on this device to continue.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not send owner sign-in link.'); }
    finally { setBusy(false); }
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setSession(null); setInstallations([]); setLicenseKey(''); setPublisherToken('');
  }

  async function issueLicense() {
    if (!session) return;
    setBusy(true); setError(''); setNotice(''); setLicenseKey('');
    try {
      const response = await fetch('/api/owner/licenses', {
        method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mt5_account: mt5Account }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Owner license issuance failed.');
      setLicenseKey(data.license.license_key);
      setNotice('Lifetime owner license created. Save the key securely; it is bound to the MT5 account shown.');
    } catch (e) { setError(e instanceof Error ? e.message : 'License issuance unavailable.'); }
    finally { setBusy(false); }
  }

  async function revokePublisher(id: string) {
    if (!session || !window.confirm('Revoke this MT5 publisher token? The terminal will stop ingesting data immediately.')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/owner/mt5-installations', {
        method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Publisher revocation failed.');
      setNotice('MT5 publisher token revoked. Its future ingestion requests will be rejected.');
      await loadInstallations(session.access_token);
    } catch (e) { setError(e instanceof Error ? e.message : 'Publisher revocation unavailable.'); }
    finally { setBusy(false); }
  }

  async function createPublisher() {
    if (!session) return;
    setBusy(true); setError(''); setNotice(''); setPublisherToken('');
    try {
      const response = await fetch('/api/owner/mt5-installations', {
        method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, broker, server }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Publisher registration failed.');
      setPublisherToken(data.token);
      setNotice(data.warning);
      await loadInstallations(session.access_token);
    } catch (e) { setError(e instanceof Error ? e.message : 'Publisher registration unavailable.'); }
    finally { setBusy(false); }
  }

  const ownerSession = session?.user.email?.toLowerCase() === 'ricorapier1@gmail.com';

  return <main className="mx-auto max-w-4xl px-4 py-10 text-slate-100 sm:px-6">
    <div className="mb-8">
      <p className="font-mono text-[10px] tracking-[.2em] text-emerald-300">FIDULYNC / PRIVATE OWNER ACCESS</p>
      <h1 className="mt-2 text-3xl font-semibold">Owner Control Console</h1>
      <p className="mt-2 text-sm text-slate-400">Lifetime owner licensing and authenticated MT5 market-data publishing. No Paystack payment is required for the owner entitlement.</p>
    </div>
    {error && <p role="alert" className="mb-4 rounded border border-rose-400/30 bg-rose-400/5 p-3 text-sm text-rose-300">{error}</p>}
    {notice && <p role="status" className="mb-4 rounded border border-emerald-400/20 bg-emerald-400/5 p-3 text-sm text-emerald-200">{notice}</p>}
    {!ownerSession ? <section className="rounded-xl border border-white/10 bg-[#0a111b] p-6">
      <h2 className="text-lg font-semibold">Verify owner identity</h2>
      <p className="mt-2 text-sm text-slate-400">A one-time secure sign-in link will be sent to the owner email. Customer support addresses cannot access this console.</p>
      <label className="mt-5 block text-xs text-slate-400">Owner email
        <input value={email} onChange={e=>setEmail(e.target.value)} type="email" autoComplete="email" className="mt-2 h-11 w-full rounded border border-white/10 bg-black/30 px-3 text-sm text-white" />
      </label>
      <button disabled={busy} onClick={()=>void sendLoginLink()} className="mt-4 h-11 rounded bg-emerald-300 px-5 text-sm font-semibold text-slate-950 disabled:opacity-50">{busy?'SENDING…':'SEND SECURE SIGN-IN LINK'}</button>
    </section> : <>
      <div className="mb-5 flex items-center justify-between rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-4">
        <div><p className="font-mono text-[10px] text-emerald-300">OWNER VERIFIED</p><p className="mt-1 text-sm">{session?.user.email}</p></div>
        <button onClick={()=>void signOut()} className="rounded border border-white/15 px-3 py-2 text-xs text-slate-300">Sign out</button>
      </div>
      <section className="mb-5 rounded-xl border border-white/10 bg-[#0a111b] p-6">
        <p className="font-mono text-[10px] text-emerald-300">01 / COMPLIMENTARY LIFETIME ENTITLEMENT</p>
        <h2 className="mt-2 text-lg font-semibold">Issue owner MT5 license</h2>
        <p className="mt-2 text-sm text-slate-400">The key is generated server-side, bound to one MT5 login, marked OWNER_LIFETIME, and stored without an expiry. It does not create a customer checkout or payment record.</p>
        <label className="mt-4 block text-xs text-slate-400">MT5 account login
          <input value={mt5Account} onChange={e=>setMt5Account(e.target.value)} inputMode="numeric" className="mt-2 h-11 w-full rounded border border-white/10 bg-black/30 px-3 font-mono text-sm text-white" placeholder="Enter your MT5 account number"/>
        </label>
        <button disabled={busy || !/^\d{1,20}$/.test(mt5Account.trim())} onClick={()=>void issueLicense()} className="mt-4 h-11 rounded bg-emerald-300 px-5 text-sm font-semibold text-slate-950 disabled:opacity-40">{busy?'PROCESSING…':'ISSUE MY LIFETIME LICENSE'}</button>
        {licenseKey && <div className="mt-4 rounded border border-emerald-300/20 bg-black/30 p-4"><p className="font-mono text-[10px] text-emerald-300">OWNER LICENSE KEY — SAVE SECURELY</p><p className="mt-2 break-all font-mono text-sm">{licenseKey}</p><button onClick={()=>void navigator.clipboard.writeText(licenseKey)} className="mt-3 rounded border border-white/15 px-3 py-2 text-xs">Copy license key</button></div>}
      </section>
      <section className="mb-5 rounded-xl border border-white/10 bg-[#0a111b] p-6">
        <p className="font-mono text-[10px] text-cyan-300">02 / HYBRID MARKET DATA</p>
        <h2 className="mt-2 text-lg font-semibold">Register an MT5 data publisher</h2>
        <p className="mt-2 text-sm text-slate-400">Run the publisher terminal on a Windows PC or VPS logged in to your broker. FiduLync stores only market quotes and candles, never broker passwords.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-slate-400">Publisher label<input value={label} onChange={e=>setLabel(e.target.value)} className="mt-2 h-10 w-full rounded border border-white/10 bg-black/30 px-3 text-sm text-white"/></label>
          <label className="text-xs text-slate-400">Broker<input value={broker} onChange={e=>setBroker(e.target.value)} className="mt-2 h-10 w-full rounded border border-white/10 bg-black/30 px-3 text-sm text-white"/></label>
          <label className="text-xs text-slate-400 sm:col-span-2">Broker server<input value={server} onChange={e=>setServer(e.target.value)} className="mt-2 h-10 w-full rounded border border-white/10 bg-black/30 px-3 text-sm text-white" placeholder="e.g. IC Markets server name"/></label>
        </div>
        <button disabled={busy} onClick={()=>void createPublisher()} className="mt-4 h-11 rounded bg-cyan-300 px-5 text-sm font-semibold text-slate-950 disabled:opacity-50">{busy?'REGISTERING…':'CREATE MT5 PUBLISHER TOKEN'}</button>
        {publisherToken && <div className="mt-4 rounded border border-amber-300/20 bg-black/30 p-4"><p className="font-mono text-[10px] text-amber-200">PRIVATE PUBLISHER TOKEN — SHOWN ONCE</p><p className="mt-2 break-all font-mono text-xs">{publisherToken}</p><button onClick={()=>void navigator.clipboard.writeText(publisherToken)} className="mt-3 rounded border border-white/15 px-3 py-2 text-xs">Copy token</button></div>}
        <div className="mt-5 border-t border-white/10 pt-4">
          <h3 className="font-mono text-[10px] text-slate-400">REGISTERED TERMINALS</h3>
          {installations.length===0 ? <p className="mt-3 text-xs text-slate-500">No publisher terminals registered.</p> : <div className="mt-3 space-y-2">{installations.map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-white/10 p-3"><div><p className="text-sm">{item.label}</p><p className="mt-1 text-[10px] text-slate-500">{item.broker||'Broker pending'} · {item.server||'Server pending'} · Last seen: {item.last_seen_at?new Date(item.last_seen_at).toLocaleString():'Never'}</p></div><div className="flex items-center gap-3"><span className={item.status==='active'?'text-emerald-300':'text-rose-300'}>{item.status.toUpperCase()}</span>{item.status==='active'&&<button disabled={busy} onClick={()=>void revokePublisher(item.id)} className="rounded border border-rose-300/20 px-2 py-1 text-[10px] text-rose-200 disabled:opacity-40">Revoke</button>}</div></div>)}</div>}
        </div>
      </section>
      <section className="mb-5 rounded-xl border border-white/10 bg-[#0a111b] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] text-violet-300">03 / PROVIDER HEALTH & READINESS</p>
            <h2 className="mt-2 text-lg font-semibold">Secure integration diagnostics</h2>
            <p className="mt-1 text-xs text-slate-400">Server-side credential checks. Secret values are never displayed.</p>
          </div>
          <button disabled={diagnosticsBusy} onClick={()=>session?.access_token && void loadDiagnostics(session.access_token)} className="rounded border border-white/15 px-3 py-2 text-xs text-slate-200 disabled:opacity-40">{diagnosticsBusy?'CHECKING…':'REFRESH CHECKS'}</button>
        </div>
        {diagnosticsError && <p role="alert" className="mt-3 text-xs text-rose-300">{diagnosticsError}</p>}
        {diagnostics && <>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded border border-white/10 p-3"><p className="text-[10px] text-slate-500">CHECKS</p><p className="mt-1 text-xl font-semibold">{diagnostics.summary.checks}</p></div>
            <div className="rounded border border-white/10 p-3"><p className="text-[10px] text-slate-500">ERRORS</p><p className="mt-1 text-xl font-semibold text-rose-300">{diagnostics.summary.errors}</p></div>
            <div className="rounded border border-white/10 p-3"><p className="text-[10px] text-slate-500">BLOCKERS</p><p className="mt-1 text-xl font-semibold text-amber-200">{diagnostics.summary.blockers}</p></div>
          </div>
          <p className="mt-3 text-[10px] font-mono text-slate-500">OVERALL: {diagnostics.overall.toUpperCase()} · {new Date(diagnostics.checked_at).toLocaleString()}</p>
          <div className="mt-3 space-y-2">
            {Object.entries(diagnostics.checks).map(([name, check])=><div key={name} className="flex flex-wrap items-start justify-between gap-2 rounded border border-white/10 p-3">
              <div className="min-w-0 flex-1"><p className="text-xs font-medium uppercase tracking-wide">{name.replaceAll('_',' ')}</p><p className="mt-1 break-words text-[11px] leading-4 text-slate-400">{check.detail}</p></div>
              <span className={`rounded px-2 py-1 text-[9px] font-semibold uppercase ${check.status==='ok'?'bg-emerald-300/10 text-emerald-200':check.status==='error'?'bg-rose-300/10 text-rose-200':check.status==='unknown'?'bg-sky-300/10 text-sky-200':'bg-amber-300/10 text-amber-200'}`}>{check.status.replaceAll('_',' ')}</span>
            </div>)}
          </div>
        </>}
        {!diagnostics && !diagnosticsError && <p className="mt-4 text-xs text-slate-500">Loading secure provider checks…</p>}
      </section>
    </>}
    <p className="text-xs leading-5 text-slate-600">Trading signals remain disabled when MT5 candles are missing, stale, incomplete, or fail technical and macro validation. API access alone does not mean a live market feed is connected.</p>
  </main>;
}
