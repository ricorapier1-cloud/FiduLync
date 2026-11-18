'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type License = { id:string; license_key:string; email:string; mt5_account:number|null; tier:string; status:string; expires_at:string|null; created_at:string; payment_reference:string|null };
type Provider = { id:string; configured:boolean; approved:boolean; state:string };
type Snapshot = { generated_at:string; metrics:{customers:number;licenses:number;active_licenses:number;paid_entitlements:number;unbound_licenses:number;expired_or_inactive:number}; licenses:License[]; providers:Provider[]; capabilities:Record<string,string> };
type Props = { accessToken:string };
type Diagnostics = { checked_at:string; overall:string; summary:{checks:number;errors:number;blockers:number}; checks:Record<string,{status:string;detail:string}> };
type PricingProduct = { slug:string; name:string; version:string; category:string; monthly_price_ngn:number; monthly_price_usd:number; annual_price_ngn:number; annual_price_usd:number; extra_seat_price_ngn:number; extra_seat_price_usd:number; metrics_json:Record<string,unknown> };
type PricingDraft = Pick<PricingProduct,'monthly_price_ngn'|'monthly_price_usd'|'annual_price_ngn'|'annual_price_usd'|'extra_seat_price_ngn'|'extra_seat_price_usd'>;
const sections = ['Overview','Customers & licenses','Payments','Product pricing','Data providers','Release governance','Security & audit'] as const;
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
 const [pricingProducts,setPricingProducts]=useState<PricingProduct[]>([]);
 const [pricingSlug,setPricingSlug]=useState('');
 const [pricingDraftState,setPricingDraftState]=useState<{slug:string;values:PricingDraft}|null>(null);
 const [pricingSaving,setPricingSaving]=useState(false);
 const [pricingNotice,setPricingNotice]=useState('');
 const refresh=useCallback(async()=>{
  setLoading(true); setError('');
  try {
   const response=await fetch('/api/owner/control-plane',{headers:{Authorization:'Bearer '+accessToken},cache:'no-store'});
   const body=await response.json() as Snapshot & {error?:string};
   if(!response.ok) throw new Error(body.error||'Control-plane request failed.');
   setSnapshot(body);
   const productResponse=await fetch('/api/owner/products',{headers:{Authorization:'Bearer '+accessToken},cache:'no-store'});
   if(productResponse.ok){const productBody=await productResponse.json() as {products:PricingProduct[]};setPricingProducts(productBody.products??[]);if(!pricingSlug&&productBody.products?.[0])setPricingSlug(productBody.products[0].slug);}
   const probe=await fetch('/api/owner/diagnostics',{headers:{Authorization:'Bearer '+accessToken},cache:'no-store'});
   if(probe.ok) setDiagnostics(await probe.json() as Diagnostics);
  } catch(e) { setError(e instanceof Error?e.message:'Unable to load owner data.'); }
  finally { setLoading(false); }
 },[accessToken,pricingSlug]);
 useEffect(()=>{ const task=Promise.resolve().then(()=>refresh()); return ()=>{ void task; }; },[refresh]);
 const pricingProduct=pricingProducts.find(p=>p.slug===pricingSlug)??null;
 const pricingDefaults:PricingDraft=pricingProduct?{
  monthly_price_ngn:Number(pricingProduct.monthly_price_ngn),monthly_price_usd:Number(pricingProduct.monthly_price_usd),
  annual_price_ngn:Number(pricingProduct.annual_price_ngn),annual_price_usd:Number(pricingProduct.annual_price_usd),
  extra_seat_price_ngn:Number(pricingProduct.extra_seat_price_ngn),extra_seat_price_usd:Number(pricingProduct.extra_seat_price_usd)
 }:{monthly_price_ngn:0,monthly_price_usd:0,annual_price_ngn:0,annual_price_usd:0,extra_seat_price_ngn:0,extra_seat_price_usd:0};
 const pricingDraft=pricingDraftState?.slug===pricingSlug?pricingDraftState.values:pricingDefaults;
 const estimate=useMemo(()=>{
  if(!pricingProduct)return null;
  const metrics=pricingProduct.metrics_json??{};
  const sharpe=Number(metrics.sharpe??metrics.sharpe_ratio??1);
  const rawCoverage=metrics.asset_coverage??metrics.asset_classes;
  const coverage=Array.isArray(rawCoverage)?rawCoverage.length:Math.max(1,Number(rawCoverage)||1);
  const tier=pricingProduct.category.toUpperCase();
  const tierMultiplier=tier.includes('FLAGSHIP')?1.5:tier.includes('PREMIUM')?1.3:tier.includes('MOMENTUM')?1.1:tier.includes('SANDBOX')?0:1;
  const sharpeMultiplier=Math.min(2,Math.max(0.75,0.75+Math.max(0,sharpe)*0.35));
  const coverageMultiplier=Math.min(1.5,1+Math.min(20,coverage)*0.025);
  const factor=tierMultiplier*sharpeMultiplier*coverageMultiplier;
  const ngn=Math.round((30000*factor)/1000)*1000;
  const usd=Math.round(25*factor);
  return {monthly_price_ngn:ngn,monthly_price_usd:usd,annual_price_ngn:ngn*10,annual_price_usd:usd*10,extra_seat_price_ngn:Math.round(ngn*0.18/500)*500,extra_seat_price_usd:Math.max(1,Math.round(usd*0.18))};
 },[pricingProduct]);
 async function savePricing(){
  if(!pricingProduct)return;
  setPricingSaving(true);setPricingNotice('');setError('');
  try{
   const response=await fetch('/api/owner/products',{method:'PATCH',headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},body:JSON.stringify({slug:pricingSlug,...pricingDraft})});
   const body=await response.json() as {success?:boolean;error?:string;product?:PricingProduct};
   if(!response.ok||!body.success)throw new Error(body.error||'Pricing update failed.');
   setPricingProducts(current=>current.map(p=>p.slug===pricingSlug?{...p,...pricingDraft}:p));
   setPricingNotice('Pricing saved to the live EA catalogue.');
  }catch(e){setError(e instanceof Error?e.message:'Unable to save pricing.');}
  finally{setPricingSaving(false);}
 }
 const filtered=useMemo(()=>{
  const q=query.trim().toLowerCase();
  return (snapshot?.licenses??[]).filter(x=>!q||[x.email,x.license_key,x.payment_reference??'',String(x.mt5_account??'')].some(v=>v.toLowerCase().includes(q)));
 },[snapshot,query]);
 async function copy(value:string) {
  try { await navigator.clipboard.writeText(value); setCopied(value); }
  catch { setError('Clipboard access was blocked by this browser.'); }
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
   <div className="overflow-x-auto rounded-xl border border-white/[0.08]"><table className="w-full min-w-[820px] text-left text-[11px]"><thead className="bg-white/[0.04] text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="p-3">Customer / key</th><th className="p-3">Plan</th><th className="p-3">MT5 login</th><th className="p-3">Status</th><th className="p-3">Payment reference</th><th className="p-3">Expiry</th></tr></thead><tbody>{filtered.map(x=><tr key={x.id} className="border-t border-white/[0.06]"><td className="p-3"><div className="text-slate-200">{x.email}</div><button onClick={()=>void copy(x.license_key)} className="mt-1 font-mono text-[10px] text-emerald-200 hover:underline">{x.license_key} · {copied===x.license_key?'Copied':'Copy key'}</button></td><td className="p-3 text-slate-300">{x.tier}</td><td className="p-3 text-slate-300">{x.mt5_account??'Unbound'}</td><td className="p-3"><State value={x.status}/></td><td className="p-3 font-mono text-slate-400">{x.payment_reference??'—'}</td><td className="p-3 text-slate-400">{x.expires_at?new Date(x.expires_at).toLocaleDateString():'Lifetime / none'}</td></tr>)}</tbody></table></div>
   <p className="mt-3 text-[10px] leading-5 text-slate-500">Customer/license administration is intentionally read-only here. Revoke, refund, transfer and entitlement edits require a separate audited, confirmation-based workflow; no silent mutations are exposed.</p>
  </div>}
  {snapshot&&section==='Payments'&&<div className="mt-5 space-y-3">
   <Metric label="Provisioned paid licenses" value={snapshot.metrics.paid_entitlements} detail="Each row has a payment reference stored on the license record"/>
   <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.04] p-4 text-xs leading-5 text-amber-100">Paystack verification and webhook provisioning are implemented on the release branch. This panel does not claim to be a full Paystack transaction ledger: refunds, disputes, reversals, chargebacks and reconciliation history still need dedicated records and workflows.</div>
   {snapshot.licenses.filter(x=>x.payment_reference).slice(0,20).map(x=><div key={x.id} className="flex flex-col gap-1 rounded-lg border border-white/[0.07] p-3 sm:flex-row sm:justify-between"><span className="text-slate-300">{x.email} · {x.tier}</span><span className="font-mono text-[10px] text-slate-500">{x.payment_reference}</span></div>)}
  </div>}
  {snapshot&&section==='Product pricing'&&<div className="mt-5 space-y-4">
   <section className="space-y-4 rounded-xl border border-white/[0.08] bg-[#0a1017] p-5"><header><h3 className="text-sm font-semibold text-slate-100">EA subscription pricing</h3><p className="mt-1 text-xs text-slate-500">The estimator uses declared Sharpe, asset coverage and strategy tier as a transparent heuristic, not a performance valuation.</p></header>
    <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
     <label className="text-xs text-slate-400">EA product<select value={pricingSlug} onChange={e=>setPricingSlug(e.target.value)} className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-white">{pricingProducts.map(p=><option key={p.slug} value={p.slug}>{p.name} · {p.category}</option>)}</select></label>
     <div className="flex items-end"><button disabled={!estimate} onClick={()=>estimate&&setPricingDraftState({slug:pricingSlug,values:estimate})} className="h-10 rounded-lg border border-cyan-300/30 px-4 text-xs text-cyan-100 disabled:opacity-40">Apply estimator</button></div>
    </div>
    {estimate&&<div className="grid gap-3 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.04] p-4 sm:grid-cols-2"><div><div className="text-[9px] text-slate-500">SUGGESTED MONTHLY NGN</div><div className="mt-1 text-xl font-semibold text-cyan-100">₦{estimate.monthly_price_ngn.toLocaleString()}</div></div><div><div className="text-[9px] text-slate-500">SUGGESTED MONTHLY USD</div><div className="mt-1 text-xl font-semibold text-cyan-100">$ {estimate.monthly_price_usd}</div></div><p className="text-[10px] leading-5 text-slate-500 sm:col-span-2">Annual suggestion equals ten monthly payments (two months free). Sharpe and coverage inputs are taken from the product metrics JSON; if those inputs are illustrative or unverified, the estimate is illustrative too.</p></div>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
     {(['monthly_price_ngn','monthly_price_usd','annual_price_ngn','annual_price_usd','extra_seat_price_ngn','extra_seat_price_usd'] as const).map(field=><label key={field} className="text-[10px] text-slate-400">{field.replaceAll('_',' ').toUpperCase()}<input type="number" min="0" step={field.endsWith('_ngn')?'1':'0.01'} value={pricingDraft[field]} onChange={e=>setPricingDraftState({slug:pricingSlug,values:{...pricingDraft,[field]:Number(e.target.value)}})} className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white"/></label>)}
    </div>
    <div className="flex flex-wrap items-center gap-3"><button onClick={()=>void savePricing()} disabled={pricingSaving||!pricingProduct} className="rounded-lg bg-emerald-300 px-4 py-2.5 text-xs font-semibold text-slate-950 disabled:opacity-50">{pricingSaving?'Saving…':'Save manual pricing'}</button>{pricingNotice&&<span className="text-xs text-emerald-200">{pricingNotice}</span>}</div>
   </section>
  </div>}
  {snapshot&&section==='Data providers'&&<div className="mt-5 space-y-2">
   <div className="mb-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 text-[11px] text-slate-300">Live diagnostics: {diagnostics?diagnostics.overall+' · '+diagnostics.summary.errors+' errors · '+diagnostics.summary.blockers+' blockers':'Not yet probed'}</div>
   {snapshot.providers.map(p=>{const live=diagnostics?.checks[p.id];return <div key={p.id} className="flex flex-col gap-2 rounded-lg border border-white/[0.07] p-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-xs font-medium text-slate-200">{p.id.replaceAll('_',' ')}</div><div className="mt-1 text-[10px] text-slate-500">Credential presence: {p.configured?'configured':'missing'} · Commercial approval: {p.approved?'approved':'not approved'}</div>{live&&<div className="mt-1 text-[10px] text-slate-400">{live.detail}</div>}</div><State value={live?.status??p.state}/></div>})}
   <p className="pt-2 text-[10px] leading-5 text-slate-500">Configured means only that an environment variable exists. It does not mean the provider was successfully queried, data is fresh, or commercial redistribution rights are verified. Use Provider Diagnostics for authenticated live probes.</p>
  </div>}
  {snapshot&&section==='Release governance'&&<div className="mt-5 space-y-2">
   <div className="rounded-lg border border-white/[0.07] p-3 text-xs text-slate-300">EA package release registry: <State value={snapshot.capabilities.release_registry}/></div>
   <div className="rounded-lg border border-white/[0.07] p-3 text-xs text-slate-300">Payment reference ledger: <State value={snapshot.capabilities.payment_ledger}/></div>
   <p className="text-[10px] leading-5 text-slate-500">Compiled EX5 binaries, signed manifests, SHA-256 release hashes, MetaEditor build metadata and Windows terminal compatibility tests cannot be certified until the EA packages are compiled and tested on MT5/Windows.</p>
  </div>}
  {snapshot&&section==='Security & audit'&&<div className="mt-5 space-y-2">
   <div className="rounded-lg border border-white/[0.07] p-3 text-xs text-slate-300">Privileged mutation audit: <State value={snapshot.capabilities.immutable_audit}/></div>
   <div className="rounded-lg border border-white/[0.07] p-3 text-xs text-slate-300">Emergency execution kill switch: <State value={snapshot.capabilities.emergency_kill_switch}/></div>
   <p className="text-[10px] leading-5 text-slate-500">No dashboard toggle is shown for critical execution policy until it is backed by a server-enforced control, durable audit event and independent verification. Owner login is separately restricted to the configured owner identity.</p>
  </div>}
 </section>;
}
