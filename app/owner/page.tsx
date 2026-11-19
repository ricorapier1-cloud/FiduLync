'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient, type Session } from '@supabase/supabase-js';
import OwnerOperations from './OwnerOperations';

const DEFAULT_OWNER_EMAIL = 'ricorapier1@gmail.com';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

type OwnerStatus = { authenticated: boolean; email?: string; role?: string };

export default function OwnerAccessPage() {
  const [authMode, setAuthMode] = useState<'PASSWORD' | 'OTP'>('PASSWORD');
  const [emailInput, setEmailInput] = useState(DEFAULT_OWNER_EMAIL);
  const [passwordInput, setPasswordInput] = useState('');
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

  async function handlePasswordLogin(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) {
      setMessage('Owner sign-in is not configured. Supabase credentials are required.');
      return;
    }
    if (!emailInput.trim() || !passwordInput) {
      setMessage('Please enter both your authorized owner email and password.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailInput.trim().toLowerCase(),
        password: passwordInput,
      });
      setBusy(false);
      if (error || !data.session) {
        setMessage(error?.message || 'Authentication failed. Please verify your credentials or switch to one-time email code.');
        return;
      }
      await verifyOwner(data.session);
    } catch {
      setBusy(false);
      setMessage('Connection error while logging in. Please try again.');
    }
  }

  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) { setMessage('Owner sign-in is not configured. Supabase public URL and publishable key are required.'); return; }
    setBusy(true);
    setMessage('');
    const targetEmail = emailInput.trim().toLowerCase() || DEFAULT_OWNER_EMAIL;
    const { error } = await supabase.auth.signInWithOtp({
      email: targetEmail,
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    setCodeRequested(!error);
    setMessage(error ? (error.message || 'Unable to send sign-in code. Check Supabase Auth email settings.') : `A one-time sign-in code has been sent to ${targetEmail}. Check your inbox.`);
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || !/^\d{6}$/.test(code.trim())) {
      setMessage('Enter the six-digit code from the owner email.');
      return;
    }
    setBusy(true);
    const targetEmail = emailInput.trim().toLowerCase() || DEFAULT_OWNER_EMAIL;
    const { data, error } = await supabase.auth.verifyOtp({ email: targetEmail, token: code.trim(), type: 'email' });
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
    return <OwnerOperations accessToken={session.access_token} email={status.email || DEFAULT_OWNER_EMAIL} role={status.role || 'owner'} onSignOut={signOut} />;
  }

  return (
    <main className="mx-auto flex min-h-[85vh] w-full max-w-lg flex-col justify-center px-5 py-12 text-slate-100">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.1] bg-white/[0.04] px-3.5 py-1.5 text-xs text-slate-300 transition hover:border-emerald-400/40 hover:text-emerald-300"
        >
          <span>←</span> Back to Terminal
        </Link>
        <span className="font-mono text-[9px] tracking-widest text-slate-500">RESTRICTED 0x01</span>
      </div>

      <div className="w-full rounded-2xl border border-white/10 bg-[#0c1118] p-6 shadow-2xl sm:p-8">
        <div className="font-mono text-[10px] tracking-[0.2em] text-emerald-300">FIDULYNC / RESTRICTED CONTROL PLANE</div>
        <h1 className="mt-3 text-2xl font-semibold">Owner Authentication</h1>
        <p className="mt-2 text-xs leading-6 text-slate-400">
          This private operations centre is restricted to authorized FiduLync administrators. Access is independently verified by the server for every privileged API request.
        </p>

        {/* Auth Mode Switcher */}
        <div className="mt-6 flex rounded-lg border border-white/[0.08] bg-black/30 p-1">
          <button
            type="button"
            onClick={() => { setAuthMode('PASSWORD'); setMessage(''); }}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${authMode === 'PASSWORD' ? 'bg-emerald-400/15 text-emerald-300 shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Password Sign-In
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode('OTP'); setMessage(''); }}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${authMode === 'OTP' ? 'bg-emerald-400/15 text-emerald-300 shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Email OTP Code
          </button>
        </div>

        {authMode === 'PASSWORD' ? (
          <form onSubmit={handlePasswordLogin} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300" htmlFor="owner-email-pwd">Owner Email Address</label>
              <input
                id="owner-email-pwd"
                type="email"
                autoComplete="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="owner@fidulync.com"
                className="mt-1.5 h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3.5 text-sm text-white placeholder-slate-600 outline-none focus:border-emerald-300/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300" htmlFor="owner-password">Password</label>
              <input
                id="owner-password"
                type="password"
                autoComplete="current-password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••••••"
                className="mt-1.5 h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3.5 text-sm text-white placeholder-slate-600 outline-none focus:border-emerald-300/40"
              />
            </div>
            <button
              type="submit"
              disabled={busy || !supabase}
              className="h-11 w-full rounded-lg bg-emerald-300 px-4 text-sm font-semibold text-[#07120d] transition hover:bg-emerald-200 disabled:opacity-50"
            >
              {busy ? 'Authenticating…' : 'Sign in to Control Plane'}
            </button>
          </form>
        ) : (
          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300" htmlFor="owner-email-otp">Owner Email Address</label>
              <input
                id="owner-email-otp"
                type="email"
                autoComplete="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="owner@fidulync.com"
                className="mt-1.5 h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3.5 text-sm text-white placeholder-slate-600 outline-none focus:border-emerald-300/40"
              />
            </div>
            <form onSubmit={sendCode}>
              <button
                type="submit"
                disabled={busy || !supabase}
                className="h-11 w-full rounded-lg bg-emerald-300 px-4 text-sm font-semibold text-[#07120d] transition hover:bg-emerald-200 disabled:opacity-50"
              >
                {busy ? 'Please wait…' : codeRequested ? 'Resend One-Time Code' : 'Send One-Time Code'}
              </button>
            </form>
            {codeRequested && (
              <form onSubmit={verifyCode} className="mt-4 space-y-3 border-t border-white/[0.08] pt-4">
                <label className="block text-xs text-slate-400" htmlFor="owner-code">Six-digit email code</label>
                <input
                  id="owner-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 font-mono text-lg tracking-[0.35em] text-white outline-none focus:border-emerald-300/40"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="h-11 w-full rounded-lg border border-emerald-300/30 bg-emerald-400/[0.08] px-4 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-400/[0.15] disabled:opacity-50"
                >
                  {busy ? 'Verifying…' : 'Verify and enter operations centre'}
                </button>
              </form>
            )}
          </div>
        )}

        {message && (
          <p role="status" className="mt-5 rounded-lg border border-white/10 bg-black/20 p-3 text-xs leading-5 text-slate-300">
            {message}
          </p>
        )}

        <div className="mt-6 border-t border-white/[0.08] pt-4 text-[10px] leading-5 text-slate-500">
          Authorized owner accounts: <span className="text-slate-400">{DEFAULT_OWNER_EMAIL}</span>, <span className="text-slate-400">fidulync@gmail.com</span>. Never disclose administrator credentials.
        </div>
      </div>
    </main>
  );
}
