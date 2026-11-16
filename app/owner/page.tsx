'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient, type Session } from '@supabase/supabase-js';
import OwnerOperations from './OwnerOperations';

const OWNER_EMAIL = 'ricorapier1@gmail.com';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

type OwnerStatus = { authenticated: boolean; email?: string; role?: string };

export default function OwnerAccessPage() {
  const [code, setCode] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<OwnerStatus | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [codeRequested, setCodeRequested] = useState(false);

  const verifyOwner = useCallback(async (current: Session) => {
    try {
      const response = await fetch('/api/owner/verify', {
        headers: { Authorization: 'Bearer ' + current.access_token },
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
    } catch {
      setSession(null);
      setStatus(null);
      setMessage('Owner verification is temporarily unavailable. Please try again.');
    }
  }, []);

  useEffect(() => {
    let active = true;
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) void verifyOwner(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      if (nextSession) void verifyOwner(nextSession);
      else { setSession(null); setStatus(null); }
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [verifyOwner]);

  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) { setMessage('Owner sign-in is not configured. Supabase public URL and publishable key are required.'); return; }
    setBusy(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithOtp({
      email: OWNER_EMAIL,
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    setCodeRequested(!error);
    setMessage(error ? 'Unable to send sign-in code. Check Supabase Auth email delivery settings.' : 'A one-time sign-in code has been requested. Check the private owner inbox.');
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

  if (status?.authenticated && session) {
    return <OwnerOperations accessToken={session.access_token} email={status.email || OWNER_EMAIL} role={status.role || 'owner'} onSignOut={signOut} />;
  }

  return (
    <main className="mx-auto flex min-h-[75vh] w-full max-w-lg items-center px-5 py-12 text-slate-100">
      <div className="w-full rounded-2xl border border-white/10 bg-[#0c1118] p-6 shadow-2xl sm:p-8">
        <div className="font-mono text-[10px] tracking-[0.2em] text-emerald-300">FIDULYNC / RESTRICTED CONTROL PLANE</div>
        <h1 className="mt-3 text-2xl font-semibold">Owner authentication</h1>
        <p className="mt-3 text-xs leading-6 text-slate-400">This private operations centre is restricted to the configured owner identity. Access is independently verified by the server for every privileged API request.</p>
        <div className="mt-6 rounded-xl border border-white/[0.08] bg-black/20 p-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Authorized owner</div>
          <div className="mt-2 text-sm font-medium text-slate-100">{OWNER_EMAIL}</div>
          <div className="mt-1 text-[10px] text-slate-500">Customer support remains fidulync@gmail.com</div>
        </div>
        <form onSubmit={sendCode} className="mt-6 space-y-3">
          <button disabled={busy || !supabase} className="h-11 w-full rounded-lg bg-emerald-300 px-4 text-sm font-semibold text-[#07120d] disabled:opacity-50">{busy ? 'Please wait…' : codeRequested ? 'Resend one-time sign-in code' : 'Send one-time sign-in code'}</button>
        </form>
        {codeRequested && <form onSubmit={verifyCode} className="mt-5 space-y-3 border-t border-white/[0.08] pt-5">
          <label className="block text-xs text-slate-400" htmlFor="owner-code">Six-digit email code</label>
          <input id="owner-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" className="h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 font-mono text-lg tracking-[0.35em] text-white outline-none focus:border-emerald-300/40" />
          <button disabled={busy} className="h-11 w-full rounded-lg border border-emerald-300/30 px-4 text-sm font-semibold text-emerald-200 disabled:opacity-50">{busy ? 'Verifying…' : 'Verify and enter operations centre'}</button>
        </form>}
        {message && <p role="status" className="mt-5 rounded-lg border border-white/10 bg-black/20 p-3 text-xs leading-5 text-slate-300">{message}</p>}
        <div className="mt-6 border-t border-white/[0.08] pt-4 text-[10px] leading-5 text-slate-500">Email OTP delivery must be configured in Supabase Auth. Do not share one-time codes or MT5 connector tokens.</div>
      </div>
    </main>
  );
}
