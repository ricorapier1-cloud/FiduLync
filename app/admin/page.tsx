'use client';

import { useCallback, useState } from 'react';
import AdminGate from '@/app/components/AdminGate';
import { supabase } from '@/lib/supabaseClient';

type Deal = { id: string; reference: string; item_name: string | null; title: string | null; amount: number; currency: string; status: string };
type Dispute = {
  id: string;
  deal_id: string;
  reason: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  escrow_deals: { reference: string; item_name: string | null; title: string | null; amount: number; currency: string } | null;
  dispute_evidence: { id: string; proof_url: string; notes: string | null; created_at: string }[];
};
type Verification = {
  id: string;
  provider: string;
  profile_url: string | null;
  created_at: string;
  ea_listings: { name: string; slug: string } | null;
};
type Audit = { id: string; action: string; notes: string; amounts: Record<string, unknown>; created_at: string };
type AdminData = { escrows: Deal[]; disputes: Dispute[]; verifications: Verification[]; payoutAudit: Audit[] };

export default function AdminDashboard() {
  const [accessToken, setAccessToken] = useState('');
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [splitAmounts, setSplitAmounts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState('');

  const refresh = useCallback(async (token: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/escrows', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load administrator data.');
      setData(result as AdminData);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load administrator data.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUnlock = useCallback((token: string) => {
    setAccessToken(token);
    void refresh(token);
  }, [refresh]);

  async function resolveDispute(disputeId: string, action: 'release_to_seller' | 'refund_to_buyer' | 'split') {
    setBusyId(disputeId);
    setError('');
    try {
      const response = await fetch('/api/admin/resolve', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dispute_id: disputeId,
          action,
          seller_amount: Number(splitAmounts[disputeId] || 0),
          notes: notes[disputeId] || '',
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to record the arbitration decision.');
      setNotes((current) => ({ ...current, [disputeId]: '' }));
      await refresh(accessToken);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to record the arbitration decision.');
    } finally {
      setBusyId('');
    }
  }

  async function reviewVerification(submissionId: string, decision: 'approved' | 'rejected') {
    setBusyId(submissionId);
    setError('');
    try {
      const response = await fetch('/api/admin/verify-ea', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_id: submissionId, decision, reviewer_notes: notes[submissionId] || '' }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save the verification decision.');
      await refresh(accessToken);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save the verification decision.');
    } finally {
      setBusyId('');
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setAccessToken('');
    setData(null);
  }

  return (
    <div className="page-content">
      <header className="page-heading">
        <div>
          <div className="eyebrow">FIDULYNC OPERATIONS</div>
          <h1>Administrator console</h1>
          <p>Review submitted performance evidence, arbitrate frozen disputes and inspect the payout audit trail.</p>
        </div>
        {accessToken && <button className="secondary-button" onClick={signOut}>Sign out</button>}
      </header>

      <AdminGate isUnlocked={Boolean(accessToken)} onUnlock={handleUnlock}>
        {error && <div role="alert" className="mb-4 rounded-xl border border-rose-300/15 bg-rose-300/[0.05] p-3 text-xs text-rose-200">{error}</div>}
        {loading && <div className="panel mb-4 p-5 text-xs text-slate-400">Loading protected administrator data…</div>}
        {data && (
          <div className="space-y-5">
            <section className="grid gap-3 sm:grid-cols-3">
              {[
                ['Registered deals', data.escrows.length],
                ['Disputes awaiting review', data.disputes.length],
                ['EA verification queue', data.verifications.length],
              ].map(([label, count]) => (
                <div key={label} className="panel p-4"><div className="metric-label">{label}</div><div className="metric-value">{count}</div></div>
              ))}
            </section>

            <section className="panel overflow-hidden">
              <div className="border-b border-white/[0.06] p-5">
                <div className="eyebrow">DISPUTE VAULT</div>
                <h2 className="mt-1 text-base font-semibold">Arbitration queue</h2>
              </div>
              <div className="divide-y divide-white/[0.06]">
                {data.disputes.length === 0 && <p className="p-5 text-xs text-slate-500">No open disputes require review.</p>}
                {data.disputes.map((dispute) => {
                  const deal = dispute.escrow_deals;
                  return (
                    <article key={dispute.id} className="space-y-4 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold">{deal?.item_name || deal?.title || 'Escrow dispute'}</h3>
                          <p className="mono mt-1 text-[10px] text-slate-500">{deal?.reference || dispute.deal_id} · {deal ? `${deal.currency} ${Number(deal.amount).toLocaleString()}` : 'Amount unavailable'}</p>
                        </div>
                        <span className="rounded-full border border-amber-300/15 bg-amber-300/[0.05] px-2.5 py-1 text-[9px] text-amber-100">FUNDS FROZEN</span>
                      </div>
                      <p className="rounded-lg border border-white/[0.05] bg-black/10 p-3 text-xs leading-5 text-slate-400">{dispute.reason}</p>
                      {!!dispute.dispute_evidence?.length && (
                        <div className="space-y-1">
                          <div className="metric-label">SUBMITTED EVIDENCE</div>
                          {dispute.dispute_evidence.map((item) => <a key={item.id} className="block break-all text-[10px] text-[#51e4c2] underline" href={item.proof_url} target="_blank" rel="noreferrer">Review evidence · {item.notes || 'Open file'}</a>)}
                        </div>
                      )}
                      <label className="block">
                        <span className="field-label">Reviewer notes · required for the audit log</span>
                        <textarea className="field-control min-h-20 resize-y" maxLength={2000} value={notes[dispute.id] || ''} onChange={(event) => setNotes((current) => ({ ...current, [dispute.id]: event.target.value }))} placeholder="Summarize the evidence and arbitration basis." />
                      </label>
                      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                        <div>
                          <label className="field-label" htmlFor={`split-${dispute.id}`}>Seller share for split ({deal?.currency || 'NGN'})</label>
                          <input id={`split-${dispute.id}`} className="field-control mono" type="number" min="0" step="0.01" value={splitAmounts[dispute.id] || ''} onChange={(event) => setSplitAmounts((current) => ({ ...current, [dispute.id]: event.target.value }))} />
                        </div>
                        <button className="secondary-button self-end" disabled={busyId === dispute.id} onClick={() => void resolveDispute(dispute.id, 'refund_to_buyer')}>Refund buyer</button>
                        <button className="primary-button self-end" disabled={busyId === dispute.id} onClick={() => void resolveDispute(dispute.id, 'release_to_seller')}>Release to seller</button>
                      </div>
                      <button className="secondary-button w-full" disabled={busyId === dispute.id} onClick={() => void resolveDispute(dispute.id, 'split')}>Record split arbitration</button>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="panel overflow-hidden">
              <div className="border-b border-white/[0.06] p-5"><div className="eyebrow">PROVIDER EVIDENCE</div><h2 className="mt-1 text-base font-semibold">Performance verification queue</h2></div>
              <div className="divide-y divide-white/[0.06]">
                {data.verifications.length === 0 && <p className="p-5 text-xs text-slate-500">No verification submissions are waiting for review.</p>}
                {data.verifications.map((submission) => (
                  <article key={submission.id} className="space-y-3 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div><h3 className="text-sm font-semibold">{submission.ea_listings?.name || 'EA listing'} · {submission.provider}</h3><p className="mono mt-1 text-[10px] text-slate-500">{new Date(submission.created_at).toLocaleString()}</p></div>
                      {submission.profile_url && <a className="text-xs text-[#51e4c2] underline" href={submission.profile_url} target="_blank" rel="noreferrer">Review source ↗</a>}
                    </div>
                    <textarea aria-label={`Reviewer notes for ${submission.provider}`} className="field-control min-h-16 resize-y" maxLength={2000} value={notes[submission.id] || ''} onChange={(event) => setNotes((current) => ({ ...current, [submission.id]: event.target.value }))} placeholder="Required reviewer notes." />
                    <div className="flex gap-2">
                      <button className="secondary-button flex-1" disabled={busyId === submission.id} onClick={() => void reviewVerification(submission.id, 'rejected')}>Reject</button>
                      <button className="primary-button flex-1" disabled={busyId === submission.id} onClick={() => void reviewVerification(submission.id, 'approved')}>Approve evidence</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel overflow-hidden">
              <div className="border-b border-white/[0.06] p-5"><div className="eyebrow">PAYOUT AUDIT LOG</div><h2 className="mt-1 text-base font-semibold">Recent arbitration decisions</h2></div>
              <div className="divide-y divide-white/[0.05]">
                {data.payoutAudit.length === 0 && <p className="p-5 text-xs text-slate-500">No arbitration payouts have been recorded.</p>}
                {data.payoutAudit.map((entry) => (
                  <div key={entry.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                    <div><div className="text-xs font-semibold">{entry.action.replaceAll('_', ' ')}</div><p className="mt-1 text-[10px] text-slate-500">{entry.notes}</p></div>
                    <time className="mono text-[9px] text-slate-600">{new Date(entry.created_at).toLocaleString()}</time>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </AdminGate>
    </div>
  );
}
