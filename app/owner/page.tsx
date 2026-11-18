'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient, type Session } from '@supabase/supabase-js';
import OwnerOperations from './OwnerOperations';

const OWNER_EMAIL = 'ricorapier1@gmail.com';
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseKey = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || ''
).trim();
const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'implicit',
      },
    })
  : null;

type OwnerStatus = { authenticated: boolean; email?: string; role?: string };

function friendlyAuthError(message: string) {
  const value = message.toLowerCase();
  if (value.includes('rate limit') || value.includes('too many')) return 'Too many code requests. Wait a few minutes before requesting another code.';
  if (value.includes('smtp') || value.includes('email') || value.includes('sending')) return 'Supabase could not deliver the email. The Auth SMTP provider and email template need to be checked.';
  if (value.includes('expired') || value.includes('invalid')) return 'That code is invalid or expired. Request a fresh code and use the newest email.';
  if (value.includes('network') || value.includes('fetch')) return 'The authentication service could not be reached. Check your connection and try again.';
  return message;
}

export default function OwnerAccessPage() {
  const [code, setCode] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<OwnerStatus | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [codeRequested, setCodeRequested] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);

  const verifyOwner = useCallback(async (current: Session) => {
    try {
      const response = await fetch('/api/owner/verify', {
        headers: { Authorization: 'Bearer ' + current.access_token },
        cache: 'no-store',
      });
      const result = await response.json() as OwnerStatus & { error?: string };
      if (!response.ok || !result.authenticated) {
        await supabase?.auth.signOut();
        setSession(null);
        setStatus(null);
        setMessage(result.error || 'The signed-in identity is not authorized for FiduLync owner access.');
        return false;
      }
      setSession(current);
      setStatus(result);
      setMessage('');
      return true;
    } catch {
      setSession(null);
      setStatus(null);
      setMessage('Owner verification is temporarily unavailable. Your code may have been accepted, but access was not granted. Try again.');
      return false;
    }
  }, []);

  useEffect(() => {
    let active = true;
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setMessage('Could not restore your owner session. Please request a new code.');
      if (data.session) void verifyOwner(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      if (event === 'SIGNED_OUT' || !nextSession) {
        setSession(null);
        setStatus(null);
        return;
      }
      if (event === 'TOKEN_REFRESHED') setSession(nextSession);
      // Supabase auth callbacks must not await Supabase operations. Defer link-based
      // sign-in verification until after the callback has returned.
      if (event === 'SIGNED_IN') {
        queueMicrotask(() => {
          if (active) void verifyOwner(nextSession);
        });
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [verifyOwner]);

  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) {
      setMessage('Owner sign-in is not configured for this deployment. The public Supabase URL and publishable key are missing.');
      return;
    }
    setBusy(true);
    setMessage('');
    setCode('');
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: OWNER_EMAIL,
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
      setCodeRequested(true);
      setLastSentAt(new Date().toISOString());
      setMessage('Code request accepted by Supabase. Check the owner inbox and spam folder. Use the newest code; older codes may be invalidated.');
    } catch (error) {
      setCodeRequested(false);
      setMessage(friendlyAuthError(error instanceof Error ? error.message : 'Unable to request an owner sign-in code.'));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || !/^\\d{6}$/.test(code.trim())) {
      setMessage('Enter the six-digit code from the latest owner sign-in email.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: OWNER_EMAIL,
        token: code.trim(),
        type: 'email',
      });
      if (error) throw error;
      if (!data.session) throw new Error('Supabase accepted the code but did not return a session. Check the Auth email template and URL configuration.');
      const authorized = await verifyOwner(data.session);
      if (authorized) setCode('');
    } catch (error) {
      setMessage(friendlyAuthError(error instanceof Error ? error.message : 'The sign-in code could not be verified.'));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setSession(null);
    setStatus(null);
    setCode('');
    setCodeRequested(false);
    setMessage('You have signed out.');
  }

  if (status?.authenticated && session) {
    return <OwnerOperations accessToken={session.access_token} email={status.email || OWNER_EMAIL} role={status.role || 'owner'} onSignOut={signOut} />;
  }

  return (
    <main className="mx-auto flex min-h-[75vh] w-full max-w-lg items-center px-5 py-12 text-slate-100">
      <div className="w-full rounded-2xl border border-white/10 bg-[#0c1118] p-6 shadow-2xl sm:p-8">
        <div className="font-mono text-[10px] tracking-[0.2em] text-emerald-300">FIDULYNC / PRIVATE QUANT CONTROL PLANE</div>
        <h1 className="mt-3 text-2xl font-semibold">Owner sign-in</h1>
        <p className="mt-3 text-xs leading-6 text-slate-400">Restricted to the pre-registered owner identity. Email verification is followed by a separate server-side owner authorization check.</p>
        <div className="mt-6 rounded-xl border border-white/[0.08] bg-black/20 p-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Authorized owner email</div>
          <div className="mt-2 text-sm font-medium text-slate-100">{OWNER_EMAIL}</div>
          <div className="mt-1 text-[10px] text-slate-500">Customer support identity remains separate.</div>
        </div>
        <form onSubmit={sendCode} className="mt-6 space-y-3">
          <button type="submit" disabled={busy || !supabase} className="h-11 w-full rounded-lg bg-emerald-300 px-4 text-sm font-semibold text-[#07120d] disabled:opacity-50">
            {busy ? 'Please wait…' : codeRequested ? 'Send a fresh sign-in code' : 'Email me a sign-in code'}
          </button>
        </form>
        {codeRequested && <form onSubmit={verifyCode} className="mt-5 space-y-3 border-t border-white/[0.08] pt-5">
          <div className="flex items-center justify-between gap-3">
            <label className="block text-xs text-slate-400" htmlFor="owner-code">Six-digit email code</label>
            <span className="text-[10px] text-slate-500">Latest request: {lastSentAt ? new Date(lastSentAt).toLocaleTimeString() : 'just now'}</span>
          </div>
          <input id="owner-code" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\\D/g, '').slice(0, 6))} placeholder="000000" aria-label="Six-digit owner sign-in code" className="h-12 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-center font-mono text-xl tracking-[0.45em] text-white outline-none focus:border-emerald-300/40" />
          <button type="submit" disabled={busy || code.length !== 6} className="h-11 w-full rounded-lg border border-emerald-300/30 px-4 text-sm font-semibold text-emerald-200 disabled:opacity-50">
            {busy ? 'Verifying…' : 'Verify code and open console'}
          </button>
        </form>}
        {message && <p role="status" aria-live="polite" className="mt-5 rounded-lg border border-white/10 bg-black/20 p-3 text-xs leading-5 text-slate-300">{message}</p>}
        {!supabase && <p className="mt-4 text-xs text-rose-200">This deployment is missing its public Supabase authentication configuration.</p>}
        <div className="mt-6 border-t border-white/[0.08] pt-4 text-[10px] leading-5 text-slate-500">If the email contains a link instead of a six-digit code, the Supabase email template must use the Token variable. Never share one-time codes or MT5 connector tokens.</div>
      </div>
    </main>
  );
}
