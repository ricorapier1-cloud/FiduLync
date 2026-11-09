'use client';

import { useState } from 'react';
import { AlertTriangle, FileUp, ShieldAlert } from 'lucide-react';

export default function DisputeCenter() {
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submitDispute(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!evidence) {
      setError('Attach supporting evidence before submitting.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    try {
      const body = new FormData();
      body.set('reason', reason);
      body.set('evidence', evidence);
      const response = await fetch(`/api/escrow/${encodeURIComponent(reference.trim())}/dispute`, { method: 'POST', body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to open the dispute.');
      setMessage(`Dispute opened · ${result.dispute_id}. Settlement is frozen while your evidence is reviewed.`);
      setReason('');
      setEvidence(null);
      (event.currentTarget as HTMLFormElement).reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to open the dispute.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-content max-w-3xl">
      <header className="page-heading">
        <div>
          <div className="eyebrow">FIDULYNC DISPUTE VAULT</div>
          <h1>Protect the integrity of the deal.</h1>
          <p>Submit a clear account of the issue and relevant evidence. A valid dispute freezes settlement pending administrator arbitration.</p>
        </div>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-amber-300/15 bg-amber-300/[0.05] text-amber-200"><ShieldAlert size={20} /></span>
      </header>

      <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-4 text-[11px] leading-5 text-amber-100/70">
        <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-200" />
        Submitting a dispute pauses settlement. Provide truthful, transaction-specific evidence. The secure link reference is private—share it only with the deal parties.
      </div>

      <form className="panel space-y-5 p-5 sm:p-7" onSubmit={submitDispute}>
        <div>
          <label className="field-label" htmlFor="dispute-reference">Escrow deal reference</label>
          <input id="dispute-reference" className="field-control mono" required maxLength={64} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Paste the private FiduLync deal reference" />
        </div>
        <div>
          <label className="field-label" htmlFor="dispute-reason">What went wrong?</label>
          <textarea id="dispute-reason" className="field-control min-h-32 resize-y" required minLength={10} maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Describe the unmet delivery terms, relevant dates and steps already taken." />
        </div>
        <div>
          <label className="field-label" htmlFor="dispute-evidence">Supporting evidence · required</label>
          <div className="rounded-xl border border-dashed border-white/[0.13] bg-black/10 p-4">
            <label htmlFor="dispute-evidence" className="flex cursor-pointer items-center gap-3 text-xs text-slate-300">
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-[#51e4c2]"><FileUp size={17} /></span>
              <span><span className="block font-semibold">{evidence?.name || 'Choose a file to upload'}</span><span className="mt-1 block text-[10px] text-slate-500">JPEG, PNG, WebP, PDF or MP4 · up to 10 MB</span></span>
            </label>
            <input id="dispute-evidence" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4" required onChange={(event) => setEvidence(event.target.files?.[0] || null)} />
          </div>
        </div>
        {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
        {message && <p role="status" className="rounded-lg border border-emerald-300/15 bg-emerald-300/[0.05] p-3 text-xs leading-5 text-emerald-100">{message}</p>}
        <button className="primary-button w-full" type="submit" disabled={loading}>{loading ? 'Uploading evidence & freezing funds…' : 'Submit evidence & freeze settlement'}</button>
        <p className="text-[10px] leading-5 text-slate-600">Evidence is stored in a private bucket. Access is restricted to authorized review and arbitration workflows.</p>
      </form>
    </div>
  );
}
