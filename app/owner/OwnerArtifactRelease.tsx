'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';

type Artifact = {
  ea_slug: string;
  storage_path: string;
  sha256: string;
  size_bytes: number;
  artifact_version: string;
  release_approved: boolean;
  approved_at: string | null;
  updated_at: string;
};

export default function OwnerArtifactRelease({ accessToken }: { accessToken: string }) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [slug, setSlug] = useState('eridam-nexus-pro');
  const [version, setVersion] = useState('1.0.0');
  const [file, setFile] = useState<File | null>(null);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/owner/artifacts', {
        headers: { Authorization: 'Bearer ' + accessToken },
        cache: 'no-store',
      });
      const payload = await response.json() as { artifacts?: Artifact[]; error?: string };
      if (!response.ok || !Array.isArray(payload.artifacts)) throw new Error(payload.error || 'Artifact registry could not be loaded.');
      setArtifacts(payload.artifacts);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Artifact registry could not be loaded.');
    } finally {
      setRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file) { setError('Select a compiled .ex5 file first.'); return; }
    setLoading(true); setError(''); setNotice('');
    try {
      const bytes = await file.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const sha256 = Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, '0')).join('');
      const metadata = { ea_slug: slug, artifact_version: version, sha256, size_bytes: file.size };
      const signedResponse = await fetch('/api/owner/artifacts/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + accessToken },
        body: JSON.stringify(metadata),
        cache: 'no-store',
      });
      const signedPayload = await signedResponse.json() as { upload_url?: string; error?: string };
      if (!signedResponse.ok || !signedPayload.upload_url) throw new Error(signedPayload.error || 'A private upload URL could not be created.');
      const uploaded = await fetch(signedPayload.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: file,
        cache: 'no-store',
      });
      if (!uploaded.ok) throw new Error('Supabase Storage rejected the .ex5 upload.');
      const response = await fetch('/api/owner/artifacts/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + accessToken },
        body: JSON.stringify(metadata),
        cache: 'no-store',
      });
      const payload = await response.json() as { uploaded?: boolean; sha256?: string; error?: string };
      if (!response.ok || payload.uploaded !== true) throw new Error(payload.error || 'Artifact registration failed.');
      setNotice('Private artifact uploaded. SHA-256: ' + sha256 + '. It is NOT approved for sale yet.');
      setFile(null);
      const picker = document.getElementById('owner-ex5-file') as HTMLInputElement | null;
      if (picker) picker.value = '';
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Artifact upload failed.');
    } finally {
      setLoading(false);
    }
  }

  async function setReleaseStatus(artifact: Artifact, action: 'approve' | 'revoke') {
    if (!confirmed || reason.trim().length < 12) {
      setError('Tick the verification statement and enter a reason of at least 12 characters.');
      return;
    }
    const message = action === 'approve'
      ? 'Approve this compiled .ex5 for customer release? Confirm you personally checked the MetaEditor build and demo-account validation.'
      : 'Revoke this EA artifact release? New license validation and checkout will be blocked.';
    if (!window.confirm(message)) return;

    setLoading(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/owner/artifacts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + accessToken },
        body: JSON.stringify({ action, ea_slug: artifact.ea_slug, reason: reason.trim(), confirm: true }),
        cache: 'no-store',
      });
      const payload = await response.json() as { updated?: boolean; error?: string };
      if (!response.ok || payload.updated !== true) throw new Error(payload.error || 'Release status update failed.');
      setNotice(action === 'approve' ? 'Release approval recorded in the owner audit ledger.' : 'Release approval revoked and audited.');
      setReason(''); setConfirmed(false);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Release status update failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 space-y-4 rounded-xl border border-white/[0.08] bg-black/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-slate-200">Private compiled EA releases</div>
          <p className="mt-1 text-[10px] leading-5 text-slate-500">Upload only a MetaEditor-compiled .ex5 file. Your browser calculates SHA-256, then uploads directly to private Supabase Storage using a short-lived signed URL; the server registers the object and leaves release approval off by default.</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={refreshing} className="rounded-lg border border-white/10 px-3 py-2 text-[10px] text-slate-300 disabled:opacity-50">{refreshing ? 'Refreshing…' : 'Refresh artifacts'}</button>
      </div>

      <form onSubmit={upload} className="grid gap-3 sm:grid-cols-2">
        <label className="text-[10px] text-slate-400">EA product
          <select value={slug} onChange={(event) => setSlug(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-[#080e15] px-3 text-xs text-white">
            <option value="eridam-nexus-pro">Eridam Nexus Adaptive Pro</option>
            <option value="velocity-vault">Velocity Vault Momentum</option>
          </select>
        </label>
        <label className="text-[10px] text-slate-400">Artifact version
          <input value={version} onChange={(event) => setVersion(event.target.value)} maxLength={32} required className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-[#080e15] px-3 text-xs text-white" placeholder="1.0.0" />
        </label>
        <label className="text-[10px] text-slate-400 sm:col-span-2">Compiled .ex5 file · maximum 25 MB
          <input id="owner-ex5-file" type="file" accept=".ex5,application/octet-stream" required onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="mt-1.5 block w-full rounded-lg border border-white/10 bg-[#080e15] p-2 text-xs text-slate-300 file:mr-3 file:rounded file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:text-white" />
        </label>
        <button type="submit" disabled={loading || !file} className="h-10 rounded-lg bg-emerald-300 px-4 text-xs font-semibold text-[#07120d] disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2">{loading ? 'Uploading securely…' : 'Upload private .ex5 and calculate SHA-256'}</button>
      </form>

      <div className="space-y-2">
        <div className="text-[9px] font-mono uppercase tracking-wider text-slate-500">Registered release artifacts</div>
        {artifacts.length === 0 ? <p className="rounded-lg border border-white/[0.06] p-3 text-[10px] text-slate-500">No compiled commercial EA artifacts are registered.</p> : artifacts.map((artifact) => (
          <div key={artifact.ea_slug} className="rounded-lg border border-white/[0.07] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-medium text-slate-200">{artifact.ea_slug} · v{artifact.artifact_version}</div>
              <span className={artifact.release_approved ? 'rounded border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[9px] text-emerald-200' : 'rounded border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-[9px] text-amber-200'}>{artifact.release_approved ? 'RELEASE APPROVED' : 'PENDING APPROVAL'}</span>
            </div>
            <div className="mt-2 break-all font-mono text-[9px] leading-4 text-slate-500">SHA-256 {artifact.sha256}<br />{(artifact.size_bytes / 1024 / 1024).toFixed(2)} MB · updated {new Date(artifact.updated_at).toLocaleString()}</div>
            {artifact.release_approved && <div className="mt-1 text-[9px] text-emerald-200">Approved {artifact.approved_at ? new Date(artifact.approved_at).toLocaleString() : ''}</div>}
            <div className="mt-3 flex flex-wrap gap-2">
              {!artifact.release_approved && <button type="button" disabled={loading || !confirmed || reason.trim().length < 12} onClick={() => void setReleaseStatus(artifact, 'approve')} className="rounded-md border border-emerald-300/20 px-3 py-2 text-[10px] text-emerald-200 disabled:opacity-40">Approve release</button>}
              {artifact.release_approved && <button type="button" disabled={loading || !confirmed || reason.trim().length < 12} onClick={() => void setReleaseStatus(artifact, 'revoke')} className="rounded-md border border-rose-300/20 px-3 py-2 text-[10px] text-rose-200 disabled:opacity-40">Revoke release</button>}
            </div>
          </div>
        ))}
      </div>

      <label className="block text-[10px] leading-5 text-slate-300">
        <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mr-2 align-middle" />
        I confirm I reviewed the exact artifact hash, checked the MetaEditor build has zero errors and zero warnings, and completed a demo-account compatibility test. I understand approval enables paid checkout and terminal validation.
      </label>
      <label className="block text-[10px] text-slate-400">Approval / revocation reason
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={12} maxLength={500} rows={2} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#080e15] p-3 text-xs text-white" placeholder="Record the build, test and release decision evidence…" />
      </label>
      {error && <p role="alert" className="rounded-lg border border-rose-300/20 bg-rose-300/5 p-3 text-[10px] text-rose-200">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-300/20 bg-emerald-300/5 p-3 text-[10px] text-emerald-200">{notice}</p>}
      <p className="text-[9px] leading-4 text-slate-500">The app verifies that the private object exists and records its SHA-256 metadata. It cannot independently prove the MetaEditor build or trading performance; those checks require the Windows MT5 terminal and your explicit owner attestation.</p>
    </div>
  );
}
