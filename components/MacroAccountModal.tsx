'use client';

import { useEffect, useState } from 'react';
import { Copy, KeyRound, LogOut, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

type AccountData = {
  email: string | null;
  tierStatus: 'free' | 'vip_active';
  watchlist: string[];
  vipExpiresAt: string | null;
  apiKey: { key_prefix: string; created_at: string } | null;
};

type Props = {
  isOpen: boolean;
  accessToken: string;
  onClose: () => void;
  onSignOut: () => void;
};

const instruments = ['EURUSD', 'USDJPY', 'GBPUSD', 'AUDUSD', 'USDCAD', 'USDCHF', 'EURGBP', 'EURJPY', 'GBPJPY', 'AUDJPY', 'XAUUSD'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export default function MacroAccountModal({ isOpen, accessToken, onClose, onSignOut }: Props) {
  const [account, setAccount] = useState<AccountData | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [generatedKey, setGeneratedKey] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen || !accessToken) return;
    const controller = new AbortController();
    void fetch('/api/v1/account', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
      signal: controller.signal,
    }).then(async (response) => {
      const payload: unknown = await response.json();
      if (!response.ok || !isRecord(payload) || !Array.isArray(payload.watchlist)) {
        throw new Error(isRecord(payload) && typeof payload.error === 'string' ? payload.error : 'Account details could not be loaded.');
      }
      const loaded = payload as unknown as AccountData;
      setAccount(loaded);
      setWatchlist(loaded.watchlist);
      setMessage('');
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'Account details could not be loaded.');
    });
    return () => controller.abort();
  }, [accessToken, isOpen]);

  async function saveWatchlist() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/account', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ watchlist }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(isRecord(payload) && typeof payload.error === 'string' ? payload.error : 'Watchlist could not be saved.');
      setMessage('Watchlist saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Watchlist could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  async function createApiKey() {
    setBusy(true);
    setMessage('');
    setGeneratedKey('');
    try {
      const response = await fetch('/api/v1/account', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload: unknown = await response.json();
      if (!response.ok || !isRecord(payload) || typeof payload.apiKey !== 'string' || !isRecord(payload.key)) {
        throw new Error(isRecord(payload) && typeof payload.error === 'string' ? payload.error : 'API key could not be generated.');
      }
      const keyRecord = payload.key;
      setGeneratedKey(payload.apiKey);
      setAccount((previous) => previous ? {
        ...previous,
        apiKey: {
          key_prefix: typeof keyRecord.key_prefix === 'string' ? keyRecord.key_prefix : '',
          created_at: typeof keyRecord.created_at === 'string' ? keyRecord.created_at : new Date().toISOString(),
        },
      } : previous);
      setMessage('Copy this key now. It will not be shown again.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'API key could not be generated.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setMessage('Sign-out could not be completed. Please try again.');
      return;
    }
    onSignOut();
    onClose();
  }

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" role="presentation">
      <section className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-emerald-500/30 bg-[#0b1016] p-6 text-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="macro-account-title">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-emerald-300">MacroLync account</p>
            <h2 id="macro-account-title" className="mt-1 text-2xl font-bold">Account dashboard</h2>
            <p className="mt-1 text-sm text-gray-400">{account?.email ?? 'Loading account...'}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close account dashboard" className="rounded-md p-2 text-gray-300 hover:bg-white/10"><X size={18} /></button>
        </header>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-white/10 p-4"><span className="text-xs text-gray-400">MACRO TIER</span><strong className="mt-1 block">{account?.tierStatus === 'vip_active' ? 'VIP active' : 'Free'}</strong></div>
          <div className="rounded-lg border border-white/10 p-4"><span className="text-xs text-gray-400">VIP VALID THROUGH</span><strong className="mt-1 block text-sm">{account?.vipExpiresAt ? new Date(account.vipExpiresAt).toLocaleDateString() : 'No active renewal date'}</strong></div>
        </div>

        <section className="mt-6">
          <h3 className="font-semibold">FX watchlist</h3>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {instruments.map((instrument) => (
              <label key={instrument} className="flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm">
                <input type="checkbox" checked={watchlist.includes(instrument)} disabled={!watchlist.includes(instrument) && watchlist.length >= 10} onChange={(event) => setWatchlist((current) => event.target.checked ? [...current, instrument] : current.filter((item) => item !== instrument))} />
                {instrument}
              </label>
            ))}
          </div>
          <button type="button" onClick={() => void saveWatchlist()} disabled={busy || watchlist.length === 0} className="mt-3 rounded-md bg-emerald-400 px-4 py-2 text-sm font-bold text-black disabled:opacity-50">Save watchlist</button>
        </section>

        <section className="mt-6 border-t border-white/10 pt-5">
          <div className="flex items-center gap-2"><KeyRound size={16} className="text-emerald-300" /><h3 className="font-semibold">MT5 WebRequest API key</h3></div>
          <p className="mt-1 text-sm text-gray-400">{account?.apiKey ? `Active key ${account.apiKey.key_prefix}...` : 'No active API key.'} Generating a new key revokes the previous one.</p>
          {generatedKey && <div className="mt-3 flex gap-2"><input readOnly value={generatedKey} aria-label="New API key" className="min-w-0 flex-1 rounded-md border border-white/15 bg-black/30 px-3 py-2 font-mono text-xs" /><button type="button" onClick={() => void navigator.clipboard.writeText(generatedKey)} aria-label="Copy API key" className="rounded-md border border-white/15 p-2"><Copy size={16} /></button></div>}
          <button type="button" onClick={() => void createApiKey()} disabled={busy} className="mt-3 rounded-md border border-emerald-300/50 px-4 py-2 text-sm text-emerald-200 disabled:opacity-50">{account?.apiKey ? 'Rotate API key' : 'Generate API key'}</button>
        </section>

        {message && <p className="mt-4 text-sm text-emerald-200" role="status">{message}</p>}
        <button type="button" onClick={() => void signOut()} className="mt-6 flex items-center gap-2 text-sm text-gray-400 hover:text-white"><LogOut size={15} /> Sign out</button>
      </section>
    </div>
  );
}