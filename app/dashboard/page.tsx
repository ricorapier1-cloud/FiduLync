'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ArrowLeft, LogOut, RefreshCw, Shield } from 'lucide-react';
import AuthModal from '@/components/AuthModal';
import { supabase } from '@/lib/supabaseClient';

type EscrowSummary = {
  reference: string;
  item_name: string | null;
  title: string | null;
  description: string | null;
  amount: number | string;
  currency: string;
  status: string;
  created_at: string;
  funded_at: string | null;
  inspection_deadline: string | null;
};

function isEscrowSummary(value: unknown): value is EscrowSummary {
  if (!value || typeof value !== 'object') return false;
  const deal = value as Record<string, unknown>;
  return typeof deal.reference === 'string'
    && (typeof deal.item_name === 'string' || deal.item_name === null)
    && (typeof deal.title === 'string' || deal.title === null)
    && (typeof deal.description === 'string' || deal.description === null)
    && (typeof deal.amount === 'string' || typeof deal.amount === 'number')
    && typeof deal.currency === 'string'
    && typeof deal.status === 'string'
    && typeof deal.created_at === 'string'
    && (typeof deal.funded_at === 'string' || deal.funded_at === null)
    && (typeof deal.inspection_deadline === 'string' || deal.inspection_deadline === null);
}

function formatAmount(amount: number | string, currency: string) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return `${currency} —`;
  return `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function Dashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const sessionUserId = session?.user.id;
  const [checkingSession, setCheckingSession] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [deals, setDeals] = useState<EscrowSummary[]>([]);
  const [dealsOwnerId, setDealsOwnerId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [reloadCounter, setReloadCounter] = useState(0);
  const [completedRequestKey, setCompletedRequestKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      setCheckingSession(false);
      if (!currentSession) {
        setDeals([]);
        setDealsOwnerId(null);
      }
    });

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setErrorMessage('Unable to verify your account session. Please try again.');
        setSession(data.session);
        setCheckingSession(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error('Unable to read the Supabase session:', error);
        setErrorMessage('Unable to verify your account session. Please try again.');
        setCheckingSession(false);
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.access_token || !sessionUserId) return;
    const controller = new AbortController();
    const requestKey = `${session.access_token}:${reloadCounter}`;
    void (async () => {
      try {
        const response = await fetch('/api/escrow/mine', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload: unknown = await response.json();
        const result = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
        if (!response.ok) {
          throw new Error(typeof result.error === 'string' ? result.error : 'Unable to load transaction history.');
        }
        if (!Array.isArray(result.deals) || !result.deals.every(isEscrowSummary)) {
          throw new Error('The transaction service returned an invalid response.');
        }
        setDeals(result.deals);
        setDealsOwnerId(sessionUserId);
        setErrorMessage('');
      } catch (error) {
        if (controller.signal.aborted) return;
        setErrorMessage(error instanceof Error ? error.message : 'Unable to load transaction history.');
      } finally {
        if (!controller.signal.aborted) setCompletedRequestKey(requestKey);
      }
    })();
    return () => controller.abort();
  }, [session?.access_token, sessionUserId, reloadCounter]);

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) setErrorMessage('Unable to sign out. Please try again.');
    else setErrorMessage('');
  }

  const sessionDeals = session && dealsOwnerId === session.user.id ? deals : [];
  const activeDeals = sessionDeals.filter((deal) => ['pending', 'funded', 'disputed', 'settling'].includes(deal.status));
  const resolvedDeals = sessionDeals.filter((deal) => ['released', 'refunded', 'cancelled'].includes(deal.status));
  const requestKey = session?.access_token ? `${session.access_token}:${reloadCounter}` : null;
  const loadingDeals = Boolean(requestKey && requestKey !== completedRequestKey);

  return (
    <main className="page-content mx-auto max-w-5xl">
      <Link href="/" className="secondary-button mb-8 inline-flex"><ArrowLeft size={15} /> Back to home</Link>
      <header className="page-heading">
        <div>
          <div className="eyebrow">CUSTOMER ACCOUNT</div>
          <h1>Transaction dashboard</h1>
          <p>Escrows associated with your authenticated account are loaded from the transaction database.</p>
        </div>
        {session && (
          <button type="button" className="secondary-button" onClick={signOut}>
            <LogOut size={15} /> Sign out
          </button>
        )}
      </header>

      {checkingSession ? (
        <p className="panel mt-5 p-5 text-sm text-slate-400" role="status">Checking your account session…</p>
      ) : session ? (
        <>
          <section className="mt-5 grid gap-3 sm:grid-cols-3" aria-label="Transaction summary">
            <div className="panel p-5">
              <div className="metric-label">TOTAL TRANSACTIONS</div>
              <div className="mono mt-2 text-2xl">{sessionDeals.length}</div>
            </div>
            <div className="panel p-5">
              <div className="metric-label">ACTIVE ESCROWS</div>
              <div className="mono mt-2 text-2xl">{activeDeals.length}</div>
            </div>
            <div className="panel p-5">
              <div className="metric-label">RESOLVED TRANSACTIONS</div>
              <div className="mono mt-2 text-2xl">{resolvedDeals.length}</div>
            </div>
          </section>

          <section className="panel mt-5 overflow-hidden" aria-labelledby="transaction-history-title">
            <div className="flex items-center justify-between border-b border-white/[0.06] p-5">
              <h2 id="transaction-history-title" className="font-semibold">Transaction history</h2>
              <button
                type="button"
                className="secondary-button"
                disabled={loadingDeals}
                onClick={() => setReloadCounter((counter) => counter + 1)}
              >
                <RefreshCw size={14} className={loadingDeals ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
            {errorMessage && <p className="border-b border-rose-300/10 bg-rose-300/[0.04] p-4 text-sm text-rose-200" role="alert">{errorMessage}</p>}
            {loadingDeals ? (
              <p className="p-6 text-sm text-slate-400" role="status">Loading transactions…</p>
            ) : sessionDeals.length === 0 ? (
              <p className="p-6 text-sm text-slate-400">No transactions are associated with this account yet.</p>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {sessionDeals.map((deal) => (
                  <li key={deal.reference} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <Link className="font-medium hover:text-[#51e4c2]" href={`/deals/${encodeURIComponent(deal.reference)}`}>
                        {deal.item_name || deal.title || 'Escrow transaction'}
                      </Link>
                      <p className="mono mt-1 text-[10px] text-slate-500">{deal.reference}</p>
                      <p className="mt-1 text-xs text-slate-400">{new Date(deal.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <span className="mono text-sm">{formatAmount(deal.amount, deal.currency)}</span>
                      <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] uppercase text-slate-300">{deal.status}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <section className="panel mt-5 max-w-2xl p-6">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 text-[#51e4c2]" size={18} />
            <div>
              <h2 className="font-semibold">Sign in to view your transactions</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">Only transactions linked to your verified Supabase account are shown here.</p>
              <button type="button" className="primary-button mt-5" onClick={() => setAuthOpen(true)}>Sign in or create an account</button>
            </div>
          </div>
          {errorMessage && <p className="mt-4 text-sm text-rose-200" role="alert">{errorMessage}</p>}
        </section>
      )}

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </main>
  );
}
