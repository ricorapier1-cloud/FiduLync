'use client';

import { useCallback, useEffect, useState } from 'react';

type Product = {
  slug:string; name:string; tagline:string; version:string; category:string;
  monthly_price_ngn:number; monthly_price_usd:number; annual_price_ngn:number; annual_price_usd:number;
  extra_seat_price_ngn:number; extra_seat_price_usd:number; demo_days:number;
  included_live_seats:number; included_demo_seats:number; metrics_json:Record<string,unknown>;
  artifact_path:string; artifact_sha256:string; artifact_size_bytes:number; artifact_version:string; release_approved:boolean; is_active:boolean;
};
const numericFields: Array<keyof Product> = ['monthly_price_ngn','monthly_price_usd','annual_price_ngn','annual_price_usd','extra_seat_price_ngn','extra_seat_price_usd','demo_days','included_live_seats','included_demo_seats'];
const money=(value:number,currency:string)=>currency==='NGN'?'₦'+Math.round(value).toLocaleString('en-NG'):'$'+Number(value).toFixed(2);

export default function OwnerProductPricing({accessToken}:{accessToken:string}) {
  const [products,setProducts]=useState<Product[]>([]);
  const [fx,setFx]=useState('');
  const [assetCoverage,setAssetCoverage]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState('');
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [artifactFiles,setArtifactFiles]=useState<Record<string,File|null>>({});

  const load=useCallback(async()=>{
    setBusy('loading');setError('');
    try{
      const response=await fetch('/api/owner/products',{headers:{Authorization:'Bearer '+accessToken},cache:'no-store'});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'Catalog load failed.');
      setProducts(result.products||[]);
    }catch(e){setError(e instanceof Error?e.message:'Catalog unavailable.');}
    finally{setBusy('');}
  },[accessToken]);
  useEffect(()=>{void load();},[load]);

  function patch(slug:string,field:keyof Product,value:unknown){
    setProducts(current=>current.map(product=>product.slug===slug?{...product,[field]:value}:product));
  }
  function estimate(product:Product){
    const fxRate=Number(fx);
    const sharpe=Number(product.metrics_json.sharpe);
    const coverage=Number(assetCoverage[product.slug]||4);
    if(!Number.isFinite(fxRate)||fxRate<=0||!Number.isFinite(sharpe)||sharpe<0||!Number.isFinite(coverage)||coverage<1){
      setError('Enter a valid NGN/USD reference rate, non-negative Sharpe ratio and asset coverage count before estimating.');
      return;
    }
    const tierBase=product.category==='FLAGSHIP'?55:product.category==='MOMENTUM'?35:0;
    if(tierBase===0){setError('The open-source sandbox remains free and is not priced by the estimator.');return;}
    const sharpeMultiplier=Math.min(1.35,Math.max(0.75,0.75+sharpe/4));
    const coverageMultiplier=1+Math.min(0.25,Math.max(0,coverage-4)*0.025);
    const usd=Math.round(tierBase*sharpeMultiplier*coverageMultiplier);
    const ngn=Math.round((usd*fxRate)/1000)*1000;
    const next={...product,monthly_price_usd:usd,monthly_price_ngn:ngn,annual_price_usd:usd*10,annual_price_ngn:ngn*10,extra_seat_price_usd:Math.max(1,Math.round(usd*.18)),extra_seat_price_ngn:Math.max(500,Math.round(ngn*.18/500)*500)};
    setProducts(current=>current.map(item=>item.slug===product.slug?next:item));
    setError('');
    setMessage(`Pricing estimate generated for ${product.name}. Review and save to publish the price.`);
  }
  async function uploadArtifact(product:Product){
    const file=artifactFiles[product.slug];
    if(!file){setError('Select a compiled .ex5 file first.');return;}
    setBusy('upload:'+product.slug);setError('');setMessage('');
    try{
      const form=new FormData();form.append('slug',product.slug);form.append('version',product.artifact_version||product.version);form.append('file',file);
      const response=await fetch('/api/owner/products/artifact',{method:'POST',headers:{Authorization:'Bearer '+accessToken},body:form});
      const result=await response.json();
      if(!response.ok||!result.success)throw new Error(result.error||'Artifact upload failed.');
      setProducts(current=>current.map(item=>item.slug===product.slug?{...item,artifact_path:result.artifact.storage_path,artifact_sha256:result.artifact.sha256,artifact_size_bytes:result.artifact.size_bytes,artifact_version:result.artifact.artifact_version,release_approved:false}:item));
      setArtifactFiles(current=>({...current,[product.slug]:null}));
      setMessage(`Uploaded ${file.name}; SHA-256 recorded. Review and approve the artifact before enabling sales.`);
    }catch(e){setError(e instanceof Error?e.message:'Artifact upload failed.');}
    finally{setBusy('');}
  }
  async function save(product:Product){
    setBusy(product.slug);setError('');setMessage('');
    try{
      const payload={...product};
      const response=await fetch('/api/owner/products',{method:'PATCH',headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'Product update failed.');
      setProducts(current=>current.map(item=>item.slug===product.slug?result.product:item));
      setMessage(`${product.name} pricing and catalog settings saved.`);
    }catch(e){setError(e instanceof Error?e.message:'Product update failed.');}
    finally{setBusy('');}
  }

  return <section className="space-y-5">
    <div className="rounded-xl border border-white/10 bg-[#0c131c] p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-base font-semibold text-white">EA monetization & pricing</h2><p className="mt-1 text-xs leading-5 text-slate-500">Edit monthly/annual prices, included seats, demo duration and artifact release state. The estimator is a pricing aid, not a performance guarantee.</p></div>
        <button type="button" onClick={()=>void load()} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300">Refresh catalog</button>
      </div>
      <label className="mt-4 block max-w-sm text-xs text-slate-400">NGN per USD reference rate<input value={fx} onChange={event=>setFx(event.target.value)} inputMode="decimal" placeholder="Enter your current reference rate" className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 font-mono text-sm text-white"/></label>
    </div>
    {error&&<p role="alert" className="rounded-lg border border-rose-300/20 bg-rose-300/5 p-3 text-xs text-rose-200">{error}</p>}
    {message&&<p role="status" className="rounded-lg border border-emerald-300/20 bg-emerald-300/5 p-3 text-xs text-emerald-200">{message}</p>}
    {busy==='loading'&&<p className="text-xs text-slate-400">Loading EA catalog…</p>}
    {products.map(product=><article key={product.slug} className="rounded-xl border border-white/10 bg-[#0c131c] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-[9px] tracking-widest text-emerald-300">{product.category} / {product.slug}</p><h3 className="mt-1 text-lg font-semibold text-white">{product.name}</h3><p className="mt-1 text-xs text-slate-500">{product.tagline}</p></div><span className="rounded border border-white/10 px-2 py-1 text-[10px] text-slate-300">{product.version}</span></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {numericFields.map(field=><label key={field} className="text-[10px] text-slate-500">{String(field).replaceAll('_',' ').toUpperCase()}<input type="number" min="0" step={field.includes('usd')?'0.01':'1'} value={Number(product[field]||0)} onChange={event=>patch(product.slug,field,Number(event.target.value))} className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 font-mono text-xs text-white"/></label>)}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-[10px] text-slate-500">PRIVATE STORAGE PATH<input value={product.artifact_path||''} onChange={event=>patch(product.slug,'artifact_path',event.target.value)} placeholder="eridam-nexus-pro/v4.2.0.ex5" className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-xs text-white"/></label>
        <label className="text-[10px] text-slate-500">ARTIFACT SHA-256<input value={product.artifact_sha256||''} onChange={event=>patch(product.slug,'artifact_sha256',event.target.value)} placeholder="64-character SHA-256 digest" className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-xs text-white"/></label>
        <label className="text-[10px] text-slate-500">ARTIFACT VERSION<input value={product.artifact_version||product.version} onChange={event=>patch(product.slug,'artifact_version',event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-xs text-white"/></label>
        <label className="text-[10px] text-slate-500">FILE SIZE (BYTES)<input type="number" min="1" value={product.artifact_size_bytes||0} readOnly className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-xs text-white"/></label>
        <label className="text-[10px] text-slate-500 sm:col-span-2">UPLOAD COMPILED EA (.EX5)<input type="file" accept=".ex5,application/octet-stream" onChange={event=>setArtifactFiles(current=>({...current,[product.slug]:event.target.files?.[0]||null}))} className="mt-1.5 block w-full text-xs text-slate-300 file:mr-3 file:rounded file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:text-white"/></label>
        <button type="button" disabled={busy==='upload:'+product.slug||!artifactFiles[product.slug]} onClick={()=>void uploadArtifact(product)} className="rounded-lg border border-cyan-300/30 px-3 py-2 text-xs text-cyan-200 disabled:opacity-40 sm:col-span-2">{busy==='upload:'+product.slug?'Uploading privately…':'Upload .ex5 and calculate SHA-256'}</button>
        <label className="text-[10px] text-slate-500">ASSET COVERAGE COUNT<input type="number" min="1" value={assetCoverage[product.slug]||'4'} onChange={event=>setAssetCoverage(current=>({...current,[product.slug]:event.target.value}))} className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-xs text-white"/></label>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4"><label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={product.release_approved} onChange={event=>patch(product.slug,'release_approved',event.target.checked)} /> Approve compiled artifact</label><label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={product.is_active} onChange={event=>patch(product.slug,'is_active',event.target.checked)} /> Publish in public catalog</label></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={()=>estimate(product)} className="rounded-lg border border-cyan-300/30 px-3 py-2 text-xs text-cyan-200">Estimate pricing</button>
          <button type="button" disabled={busy===product.slug} onClick={()=>void save(product)} className="rounded-lg bg-emerald-300 px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50">{busy===product.slug?'Saving…':'Save product'}</button>
        </div>
      </div>
      <p className="mt-3 text-[10px] leading-5 text-slate-600">Suggested monthly: {money(product.monthly_price_ngn,'NGN')} / {money(product.monthly_price_usd,'USD')} · Annual: {money(product.annual_price_ngn,'NGN')} / {money(product.annual_price_usd,'USD')}. Checkout and demo downloads remain blocked until the private artifact is uploaded, SHA-256 recorded and release approved.</p>
    </article>)}
  </section>;
}
