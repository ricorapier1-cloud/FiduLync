'use client';

import { useEffect, useState } from 'react';
import { createClient, type Session } from '@supabase/supabase-js';

const OWNER_EMAIL = 'ricorapier1@gmail.com';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

type OwnerStatus = { authenticated: boolean; email?: string; role?: string };

export default function OwnerAccessPage() {
  const [email, setEmail] = useState(OWNER_EMAIL);
  const [code, setCode] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<OwnerStatus | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function verifyOwner(current: Session) {
    const response = await fetch('/api/owner/verify', {
      headers: { Authorization: `Bearer ${current.access_token}` },
      cache: 'no-store',
    });
    const result = await response.json() as OwnerStatus;
    if (!response.ok || !result.authenticated) {
      await supabase?.auth.signOut();
      setSession(null);
      setStatus(null);
      setMessage('This account is not authorized for FiduLync owner access.');
      return;
    }
    setSession(current);
    setStatus(result);
    setMessage('');
  }

  useEffect(() => {
    let active = true;
    if (!supabase) {
      setMessage('Owner sign-in is not configured. The public Supabase URL and publishable key must be present.');
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) void verifyOwner(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      if (nextSession) void verifyOwner(nextSession);
      else { setSession(null); setStatus(null); }
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || email.trim().toLowerCase() !== OWNER_EMAIL) {
      setMessage('Only the configured owner email can request access.');
      return;
    }
    setBusy(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithOtp({
      email: OWNER_EMAIL,
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    setMessage(error ? `Unable to send sign-in code: ${error.message}` : 'A one-time sign-in code has been requested. Check the owner inbox and enter the code below.');
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || !/^\d{6}$/.test(code.trim())) {
      setMessage('Enter the six-digit code from the owner email.');
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.verifyOtp({ email: OWNER_EMAIL, token: code.trim(), type: 'email' });
    setBusy(false);
    if (error || !data.session) {
      setMessage(error?.message || 'The sign-in code could not be verified.');
      return;
    }
    await verifyOwner(data.session);
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setSession(null);
    setStatus(null);
    setMessage('You have signed out.');
  }

  return (
    <main className="mx-auto min-h-[70vh] w-full max-w-3xl px-5 py-12 text-slate-100 sm:px-8">
      <div className="rounded-2xl border border-white/10 bg-[#0c1118] p-6 shadow-2xl sm:p-8">
        <div className="font-mono text-[10px] tracking-[0.2em] text-emerald-300">FIDULYNC / PRIVATE OWNER ACCESS</div>
        <h1 className="mt-3 text-3xl font-semibold">Owner console access</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">Passwordless one-time email verification. Only ricorapier1@gmail.com is authorized by the server-side owner check. Customer support remains fidulync@gmail.com.</p>

        {status?.authenticated ? (
          <div className="mt-7 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] p-5">
            <div className="text-sm font-semibold text-emerald-200">Owner identity verified</div>
            <div className="mt-2 text-xs text-slate-300">{status.email}</div>
            <div className="mt-1 font-mono text-[10px] text-slate-500">ROLE: {status.role?.toUpperCase()}</div>
            <p className="mt-4 text-xs leading-5 text-slate-400">This establishes private owner identity. It does not yet expose customer financial records or change payment settings.</p>
            <button type="button" onClick={signOut} className="mt-5 rounded-lg border border-white/10 px-4 py-2 text-xs text-slate-200 hover:bg-white/5">Sign out</button>
          </div>
        ) : (
          <div className="mt-7 grid gap-5">
            <form onSubmit={sendCode} className="space-y-3">
              <label className="block text-xs text-slate-400" htmlFor="owner-email">Owner email</label>
              <input id="owner-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-emerald-300/40" />
              <button disabled={busy} className="h-11 w-full rounded-lg bg-emerald-300 px-4 text-sm font-semibold text-[#07120d] disabled:opacity-50">{busy ? 'Please wait…' : 'Send one-time sign-in code'}</button>
            </form>
            <form onSubmit={verifyCode} className="space-y-3 border-t border-white/[0.08] pt-5">
              <label className="block text-xs text-slate-400" htmlFor="owner-code">Six-digit email code</label>
              <input id="owner-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" className="h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 font-mono text-lg tracking-[0.35em] text-white outline-none focus:border-emerald-300/40" />
              <button disabled={busy} className="h-11 w-full rounded-lg border border-emerald-300/30 px-4 text-sm font-semibold text-emerald-200 disabled:opacity-50">Verify and open owner access</button>
            </form>
          </div>
        )}
        {message && <p role="status" className="mt-5 rounded-lg border border-white/10 bg-black/20 p-3 text-xs leading-5 text-slate-300">{message}</p>}
        <div className="mt-7 border-t border-white/[0.08] pt-5 text-[11px] leading-5 text-slate-500">If the code does not arrive, Supabase Auth email delivery / SMTP must be configured for this project. Customer-facing support contact is unchanged.</div>
      </div>
    </main>
  );
}
