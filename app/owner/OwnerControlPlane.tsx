'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import OwnerArtifactRelease from './OwnerArtifactRelease';

type License = { id:string; license_key:string; email:string; mt5_account:number|null; tier:string; status:string; expires_at:string|null; created_at:string; payment_reference:string|null };
type Provider = { id:string; configured:boolean; approved:boolean; state:string };
type Snapshot = { generated_at:string; metrics:{customers:number;licenses:number;active_licenses:number;paid_entitlements:number;unbound_licenses:number;expired_or_inactive:number}; licenses:License[]; providers:Provider[]; capabilities:Record<string,string> };
type Props = { accessToken:string };
type Diagnostics = { checked_at:string; overall:string; summary:{checks:number;errors:number;blockers:number}; checks:Record<string,{status:string;detail:string}> };
const sections = ['Overview','Customers & licenses','Payments','Data providers','Release governance','Security & audit'] as const;
type Section = typeof sections[number];

function State({value}:{value:string}) {
 const tone = value==='configured_unverified' ? 'text-amber-200 border-amber-300/20 bg-amber-300/10' : value==='license_blocked' ? 'text-rose-200 border-rose-300/20 bg-rose-300/10' : 'text-slate-300 border-white/10 bg-white/[0.04]';
 const label = value.replaceAll('_',' ');
 return <span className={'inline-flex rounded-full border px-2 py-1 text-[10px] uppercase tracking-wide '+tone}>{label}</span>;
}
function Metric({label,value,detail}:{label:string;value:number;detail:string}) {
 return <div className="rounded-xl border border-white/[0.08] bg-[#0a1017] p-4"><div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div><div className="mt-2 text-2xl font-semibold text-slate-100">{value.toLocaleString()}</div><div className="mt-1 text-[10px] text-slate-500">{detail}</div></div>;
}

export default function OwnerControlPlane({accessToken}:Props) {
 const [section,setSection]=useState<Section>('Overview');
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
 const [diagnostics,setDiagnostics]=useState<Diagnostics|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [query,setQuery]=useState('');
 const [copied,setCopied]=useState('');
 const [revokingId,setRevokingId]=useState<string|null>(null);
 const refresh=useCallback(async()=>{
  setLoading(true); setError('');
  try {
   const response=await fetch('/api/owner/control-plane',{headers:{Authorization:'Bearer '+accessToken},cache:'no-store'});
   const body=await response.json() as Snapshot & {error?:string};
   if(!response.ok) throw new Error(body.error||'Control-plane request failed.');
   setSnapshot(body);
   const probe=await fetch('/api/owner/diagnostics',{headers:{Authorization:'Bearer '+accessToken},cache:'no-store'});
   if(probe.ok) setDiagnostics(await probe.json() as Diagnostics);
  } catch(e) { setError(e instanceof Error?e.message:'Unable to load owner data.'); }
  finally { setLoading(false); }
 },[accessToken]);
 useEffect(()=>{ const task=Promise.resolve().then(()=>refresh()); return ()=>{ void task; }; },[refresh]);
 const filtered=useMemo(()=>{
  const q=query.trim().toLowerCase();
  return (snapshot?.licenses??[]).filter(x=>!q||[x.email,x.license_key,x.payment_reference??'',String(x.mt5_account??'')].some(v=>v.toLowerCase().includes(q)));
 },[snapshot,query]);
 async function copy(value:string) {
  try { await navigator.clipboard.writeText(value); setCopied(value); }
  catch { setError('Clipboard access was blocked by this browser.'); }
 }
 async function revokeLicense(license: License) {
  const reason = window.prompt('Enter the reason for revoking this licence (5–500 characters):');
  if (!reason || reason.trim().length < 5) return;
  if (!window.confirm('Permanently revoke this licence now? This action is audited and the customer terminal will fail validation.')) return;
  setRevokingId(license.id); setError('');
  try {
   const response = await fetch('/api/owner/licenses', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + accessToken },
    body: JSON.stringify({ license_id: license.id, reason: reason.trim(), confirm: true }),
   });
   const result = await response.json() as { error?: string; message?: string };
   if (!response.ok) throw new Error(result.error || 'Licence revocation failed.');
   setCopied('');
   await refresh();
  } catch (err) {
   setError(err instanceof Error ? err.message : 'Licence revocation failed.');
  } finally { setRevokingId(null); }
 }
 return <section className="mb-6 rounded-2xl border border-emerald-300/20 bg-[#080e15] p-4 sm:p-6">
  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
   <div><div className="font-mono text-[9px] tracking-[0.2em] text-emerald-300">OWNER CONTROL PLANE / LIVE SERVER READ</div><h2 className="mt-2 text-xl font-semibold text-white">Platform administration</h2><p className="mt-1 text-xs leading-5 text-slate-400">Licensing, payment references, customers, data-source governance and release readiness. Secrets are never returned to this interface.</p></div>
   <button onClick={()=>void refresh()} disabled={loading} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200 disabled:opacity-50">{loading?'Refreshing…':'Refresh control data'}</button>
  </div>
  <nav className="mt-5 flex gap-2 overflow-x-auto border-b border-white/[0.08] pb-3" aria-label="Owner control sections">
   {sections.map(s=><button key={s} onClick={()=>setSection(s)} aria-pressed={section===s} className={'whitespace-nowrap rounded-lg px-3 py-2 text-[11px] '+(section===s?'bg-emerald-300/10 text-emerald-200':'text-slate-400 hover:bg-white/5')}>{s}</button>)}
  </nav>
  {error&&<p role="alert" className="mt-4 rounded-lg border border-rose-300/20 bg-rose-300/5 p-3 text-xs text-rose-200">{error}</p>}
  {loading&&!snapshot&&<p className="py-8 text-center text-xs text-slate-400">Loading protected platform records…</p>}
  {snapshot&&section==='Overview'&&<div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
   <Metric label="Customers" value={snapshot.metrics.customers} detail="Distinct email identities in license ledger"/>
   <Metric label="Total licenses" value={snapshot.metrics.licenses} detail="Latest 100 ledger records"/>
   <Metric label="Active licenses" value={snapshot.metrics.active_licenses} detail="Status active and not expired"/>
   <Metric label="Paid entitlements" value={snapshot.metrics.paid_entitlements} detail="Records with verified Paystack reference"/>
   <Metric label="Awaiting MT5 binding" value={snapshot.metrics.unbound_licenses} detail="Active licenses with no account bound"/>
   <Metric label="Expired / inactive" value={snapshot.metrics.expired_or_inactive} detail="Inactive or expired license records"/>
   <div className="sm:col-span-2 xl:col-span-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-[11px] leading-5 text-slate-400">Snapshot: {new Date(snapshot.generated_at).toLocaleString()}. This view is live-read from the server-side Supabase license ledger; it is not a complete historical payment ledger.</div>
  </div>}
  {snapshot&&section==='Customers & licenses'&&<div className="mt-5">
   <div className="mb-3 flex flex-col gap-2 sm:flex-row"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search email, license, MT5 login or payment reference" className="min-h-10 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 text-xs text-white outline-none focus:border-emerald-300/40"/><span className="self-center text-[10px] text-slate-500">{filtered.length} records shown · maximum 100</span></div>
   <div className="overflow-x-auto rounded-xl border border-white/[0.08]"><table className="w-full min-w-[820px] text-left text-[11px]"><thead className="bg-white/[0.04] text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="p-3">Customer / key</th><th className="p-3">Plan</th><th className="p-3">MT5 login</th><th className="p-3">Status</th><th className="p-3">Payment reference</th><th className="p-3">Expiry</th><th className="p-3">Admin action</th></tr></thead><tbody>{filtered.map(x=><tr key={x.id} className="border-t border-white/[0.06]"><td className="p-3"><div className="text-slate-200">{x.email}</div><button onClick={()=>void copy(x.license_key)} className="mt-1 font-mono text-[10px] text-emerald-200 hover:underline">{x.license_key} · {copied===x.license_key?'Copied':'Copy key'}</button></td><td className="p-3 text-slate-300">{x.tier}</td><td className="p-3 text-slate-300">{x.mt5_account??'Unbound'}</td><td className="p-3"><State value={x.status}/></td><td className="p-3 font-mono text-slate-400">{x.payment_reference??'—'}</td><td className="p-3 text-slate-400">{x.expires_at?new Date(x.expires_at).toLocaleDateString():'Lifetime / none'}</td><td className="p-3">{x.status.toLowerCase()==='active'?<button type="button" onClick={()=>void revokeLicense(x)} disabled={revokingId===x.id} className="rounded-md border border-rose-300/20 px-2.5 py-1.5 text-[10px] text-rose-200 hover:bg-rose-300/10 disabled:opacity-50">{revokingId===x.id?'Revoking…':'Revoke licence'}</button>:<span className="text-[10px] text-slate-500">No action</span>}</td></tr>)}</tbody></table></div>
   <p className="mt-3 text-[10px] leading-5 text-slate-500">Licence revocation is available only to the verified owner, requires a reason and explicit confirmation, and is committed with an owner-audit event in one database transaction. Refunds, disputes, transfers and entitlement edits remain separate workflows.</p>
  </div>}
  {snapshot&&section==='Payments'&&<div className="mt-5 space-y-3">
   <Metric label="Provisioned paid licenses" value={snapshot.metrics.paid_entitlements} detail="Each row has a payment reference stored on the license record"/>
   <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.04] p-4 text-xs leading-5 text-amber-100">Paystack verification and webhook provisioning are implemented on the release branch. This panel does not claim to be a full Paystack transaction ledger: refunds, disputes, reversals, chargebacks and reconciliation history still need dedicated records and workflows.</div>
   {snapshot.licenses.filter(x=>x.payment_reference).slice(0,20).map(x=><div key={x.id} className="flex flex-col gap-1 rounded-lg border border-white/[0.07] p-3 sm:flex-row sm:justify-between"><span className="text-slate-300">{x.email} · {x.tier}</span><span className="font-mono text-[10px] text-slate-500">{x.payment_reference}</span></div>)}
  </div>}
  {snapshot&&section==='Data providers'&&<div className="mt-5 space-y-2">
   <div className="mb-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 text-[11px] text-slate-300">Live diagnostics: {diagnostics?diagnostics.overall+' · '+diagnostics.summary.errors+' errors · '+diagnostics.summary.blockers+' blockers':'Not yet probed'}</div>
   {snapshot.providers.map(p=>{const live=diagnostics?.checks[p.id];return <div key={p.id} className="flex flex-col gap-2 rounded-lg border border-white/[0.07] p-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-xs font-medium text-slate-200">{p.id.replaceAll('_',' ')}</div><div className="mt-1 text-[10px] text-slate-500">Credential presence: {p.configured?'configured':'missing'} · Commercial approval: {p.approved?'approved':'not approved'}</div>{live&&<div className="mt-1 text-[10px] text-slate-400">{live.detail}</div>}</div><State value={live?.status??p.state}/></div>})}
   <p className="pt-2 text-[10px] leading-5 text-slate-500">Configured means only that an environment variable exists. It does not mean the provider was successfully queried, data is fresh, or commercial redistribution rights are verified. Use Provider Diagnostics for authenticated live probes.</p>
  </div>}
  {snapshot&&section==='Release governance'&&<div className="mt-5 space-y-2">
   <div className="rounded-lg border border-white/[0.07] p-3 text-xs text-slate-300">EA package release registry: <State value={snapshot.capabilities.release_registry}/></div>
   <div className="rounded-lg border border-white/[0.07] p-3 text-xs text-slate-300">Payment reference ledger: <State value={snapshot.capabilities.payment_ledger}/></div>
   <p className="text-[10px] leading-5 text-slate-500">Upload compiled .ex5 files from the Windows workstation when available. Upload resets approval; the private object, SHA-256 metadata and owner attestation are checked before checkout and terminal validation can unlock. The application cannot certify MetaEditor build quality or trading performance without your actual terminal tests.</p>
   <OwnerArtifactRelease accessToken={accessToken}/>
  </div>}
  {snapshot&&section==='Security & audit'&&<div className="mt-5 space-y-2">
   <div className="rounded-lg border border-white/[0.07] p-3 text-xs text-slate-300">Privileged mutation audit: <State value={snapshot.capabilities.immutable_audit}/></div>
   <div className="rounded-lg border border-white/[0.07] p-3 text-xs text-slate-300">Emergency execution kill switch: <State value={snapshot.capabilities.emergency_kill_switch}/></div>
   <p className="text-[10px] leading-5 text-slate-500">No dashboard toggle is shown for critical execution policy until it is backed by a server-enforced control, durable audit event and independent verification. Owner login is separately restricted to the configured owner identity.</p>
  </div>}
 </section>;
}
