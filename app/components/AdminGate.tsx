'use client';

import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';

interface AdminGateProps {
  isUnlocked: boolean;
  onUnlock: (accessToken: string) => void;
  children: React.ReactNode;
}

export default function AdminGate({ isUnlocked, onUnlock, children }: AdminGateProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const verifySession = useCallback(async (accessToken: string) => {
    const response = await fetch('/api/admin/verify', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    const result = await response.json();
    if (response.status === 403) {
      setAccessDenied(true);
      await supabase.auth.signOut();
      return false;
    }
    if (!response.ok) throw new Error(result.error || 'Administrator access denied.');
    onUnlock(accessToken);
    return true;
  }, [onUnlock]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      if (!data.session?.access_token) throw new Error('Supabase did not return an authenticated session.');
      if (await verifySession(data.session.access_token)) {
        toast.success('Administrator access verified.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to verify administrator access.');
    } finally {
      setLoading(false);
      setPassword('');
    }
  }

  if (isUnlocked) return <>{children}</>;

  if (accessDenied) {
    return (
      <div role="alert" className="panel mx-auto max-w-md p-6 text-center sm:p-8">
        <h2 className="text-lg font-semibold text-rose-200">403 · Forbidden</h2>
        <p className="mt-2 text-xs leading-5 text-slate-400">This account is not authorized for the administrator console. Access requires an approved administrator email and role.</p>
        <button className="secondary-button mx-auto mt-5" type="button" onClick={() => setAccessDenied(false)}>Return to sign in</button>
      </div>
    );
  }

  return (
    <div className="panel mx-auto max-w-md p-6 sm:p-8">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.07] text-[#51e4c2]">⌘</div>
      <h2 className="mt-4 text-center text-lg font-semibold">Administrator sign-in</h2>
      <p className="mt-2 text-center text-xs leading-5 text-slate-500">Access is limited to the designated FiduLync administrator accounts. Sign in through Supabase authentication.</p>
      <form className="mt-6 space-y-4" onSubmit={handleLogin}>
        <div>
          <label className="field-label" htmlFor="admin-email">Administrator email</label>
          <input id="admin-email" className="field-control" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="admin-password">Password</label>
          <input id="admin-password" className="field-control" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>
        <button className="primary-button w-full" type="submit" disabled={loading}>{loading ? 'Verifying access…' : 'Sign in securely'}</button>
      </form>
      <p className="mt-4 text-center text-[10px] leading-5 text-slate-600">Administrator role is confirmed server-side. No shared admin password or client-issued access token is used.</p>
    </div>
  );
}
