'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient, type Session } from '@supabase/supabase-js';
import Link from 'next/link';
import OwnerOperations from './OwnerOperations';

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
        flowType: 'pkce',
      },
    })
  : null;

type OwnerStatus = { authenticated: boolean; email?: string; role?: string };

function friendlyAuthError(message: string) {
  const value = message.toLowerCase();
  if (value.includes('invalid login credentials')) return 'The email or password is incorrect.';
  if (value.includes('email not confirmed')) return 'Confirm the owner email address before signing in.';
  if (value.includes('rate limit') || value.includes('too many')) return 'Too many attempts. Wait a few minutes before trying again.';
  if (value.includes('password should be') || value.includes('weak password')) return 'Choose a stronger password that meets the password policy.';
  if (value.includes('network') || value.includes('fetch')) return 'The authentication service could not be reached. Check your connection and try again.';
  return message;
}

export default function OwnerAccessPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [recoverySession, setRecoverySession] = useState<Session | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [status, setStatus] = useState<OwnerStatus | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

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
        setMessage(result.error || 'This account is not authorized for FiduLync owner access.');
        return false;
      }
      setSession(current);
      setStatus(result);
      setMessage('');
      return true;
    } catch {
      setSession(null);
      setStatus(null);
      setMessage('Owner verification is temporarily unavailable. Access was not granted. Please try again.');
      return false;
    }
  }, []);

  useEffect(() => {
    let active = true;
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setMessage('Could not restore your owner session. Sign in again.');
      if (data.session) void verifyOwner(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      if (event === 'SIGNED_OUT' || !nextSession) {
        setSession(null);
        setStatus(null);
        setRecoverySession(null);
        setRecoveryMode(false);
        return;
      }
      if (event === 'TOKEN_REFRESHED') {
        setSession(nextSession);
        queueMicrotask(() => {
          if (active) void verifyOwner(nextSession);
        });
      }
      if (event === 'PASSWORD_RECOVERY') {
        setRecoverySession(nextSession);
        setRecoveryMode(true);
        setSession(null);
        setStatus(null);
        setMessage('Choose a new owner-console password to finish account recovery.');
      }
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

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) {
      setMessage('Owner sign-in is not configured. The public Supabase URL and publishable key are missing.');
      return;
    }
    if (!password) {
      setMessage('Enter your owner password.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw error;
      if (!data.session) throw new Error('Authentication did not return a valid session.');
      const authorized = await verifyOwner(data.session);
      if (authorized) setPassword('');
    } catch (error) {
      setMessage(friendlyAuthError(error instanceof Error ? error.message : 'Unable to sign in.'));
    } finally {
      setBusy(false);
    }
  }

  async function requestPasswordReset() {
    if (!email.trim()) {
      setMessage('Enter the registered owner email address to request password recovery.');
      return;
    }
    if (!supabase) {
      setMessage('Password recovery is not configured for this deployment.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: new URL('/owner', window.location.origin).toString(),
      });
      if (error) throw error;
      setMessage('If password recovery is enabled, a secure password-reset link will be sent to the registered owner inbox. Use that link only to set a new password; normal sign-in always uses your password.');
    } catch (error) {
      setMessage(friendlyAuthError(error instanceof Error ? error.message : 'Unable to request password recovery.'));
    } finally {
      setBusy(false);
    }
  }

  async function updateRecoveredPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || !recoverySession) {
      setMessage('The password-reset session is missing or expired. Request a new password-reset link.');
      return;
    }
    if (newPassword.length < 12) {
      setMessage('Use a password with at least 12 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage('The new password and confirmation do not match.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setRecoveryMode(false);
      setRecoverySession(null);
      setMessage('Password updated. Your owner session is being verified.');
      const { data: refreshed } = await supabase.auth.getSession();
      if (!refreshed.session) throw new Error('Password updated, but the owner session could not be restored. Sign in with the new password.');
      await verifyOwner(refreshed.session);
    } catch (error) {
      setMessage(friendlyAuthError(error instanceof Error ? error.message : 'Unable to update the password.'));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    let cookieCleared = false;
    try {
      const response = await fetch('/api/owner/logout', { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
      cookieCleared = response.ok;
    } catch {
      cookieCleared = false;
    } finally {
      await supabase?.auth.signOut();
      setSession(null);
      setStatus(null);
      setPassword('');
      setMessage(cookieCleared ? 'You have signed out.' : 'Your local sign-in has ended, but the secure browser session could not be cleared. Reload and retry sign-out.');
    }
  }

  if (status?.authenticated && session) {
    return <><div className="px-5 pt-4"><Link href="/" className="font-mono text-xs text-emerald-300 hover:underline">← BACK TO TERMINAL</Link></div><OwnerOperations accessToken={session.access_token} email={status.email || email} role={status.role || 'owner'} onSignOut={signOut} /></>;
  }

  return (
    <main className="mx-auto flex min-h-[75vh] w-full max-w-lg items-center px-5 py-12 text-slate-100">
      <div className="w-full rounded-2xl border border-white/10 bg-[#0c1118] p-6 shadow-2xl sm:p-8">
        <Link href="/" className="mb-5 inline-block font-mono text-[10px] tracking-wider text-emerald-300 hover:underline">← BACK TO TERMINAL</Link>
        <div className="font-mono text-[10px] tracking-[0.2em] text-emerald-300">FIDULYNC / PRIVATE QUANT CONTROL PLANE</div>
        <h1 className="mt-3 text-2xl font-semibold">{recoveryMode ? 'Set a new password' : 'Owner sign-in'}</h1>
        <p className="mt-3 text-xs leading-6 text-slate-400">
          {recoveryMode
            ? 'Create a new password for the registered owner account. Password recovery is separate from normal sign-in.'
            : 'Sign in with the registered owner email address and password. Access is checked again by the server against the authorized owner identity.'}
        </p>
        {recoveryMode ? (
          <form onSubmit={updateRecoveredPassword} className="mt-6 space-y-3">
            <label className="block text-xs text-slate-400" htmlFor="owner-new-password">New password</label>
            <input id="owner-new-password" type="password" autoComplete="new-password" minLength={12} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="At least 12 characters" className="h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-emerald-300/40" />
            <label className="block pt-2 text-xs text-slate-400" htmlFor="owner-confirm-password">Confirm new password</label>
            <input id="owner-confirm-password" type="password" autoComplete="new-password" minLength={12} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter the new password again" className="h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-emerald-300/40" />
            <button type="submit" disabled={busy || !recoverySession} className="h-11 w-full rounded-lg bg-emerald-300 px-4 text-sm font-semibold text-[#07120d] disabled:opacity-50">{busy ? 'Updating…' : 'Save new password'}</button>
          </form>
        ) : (
          <>
            <div className="mt-6 rounded-xl border border-white/[0.08] bg-black/20 p-4">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Private owner authentication</div>
              <div className="mt-2 text-sm font-medium text-slate-100">Identity verified server-side</div>
              <div className="mt-1 text-[10px] text-slate-500">Only the email configured in the server environment is authorized. The registered address is not disclosed on this page.</div>
            </div>
            <form onSubmit={signIn} className="mt-6 space-y-3">
              <label className="block text-xs text-slate-400" htmlFor="owner-email">Email address</label>
              <input id="owner-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-emerald-300/40" />
              <label className="block pt-2 text-xs text-slate-400" htmlFor="owner-password">Password</label>
              <input id="owner-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-emerald-300/40" />
              <button type="submit" disabled={busy || !supabase} className="h-11 w-full rounded-lg bg-emerald-300 px-4 text-sm font-semibold text-[#07120d] disabled:opacity-50">{busy ? 'Signing in…' : 'Sign in to owner console'}</button>
            </form>
            <button type="button" onClick={() => void requestPasswordReset()} disabled={busy || !supabase} className="mt-4 w-full text-center text-xs text-emerald-200 hover:underline disabled:opacity-50">Forgot password?</button>
          </>
        )}
        {message && <p role="status" aria-live="polite" className="mt-5 rounded-lg border border-white/10 bg-black/20 p-3 text-xs leading-5 text-slate-300">{message}</p>}
        {!supabase && <p className="mt-4 text-xs text-rose-200">This deployment is missing its public Supabase authentication configuration.</p>}
        <div className="mt-6 border-t border-white/[0.08] pt-4 text-[10px] leading-5 text-slate-500">
          Normal owner access uses email and password only. There is no one-time login code or magic-link login. Never share your owner password or MT5 connector tokens.
        </div>
      </div>
    </main>
  );
}
