import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

export const dynamic='force-dynamic';
const OWNER_EMAIL='ricorapier1@gmail.com';
const FIELDS='slug,name,tagline,version,category,monthly_price_ngn,monthly_price_usd,annual_price_ngn,annual_price_usd,extra_seat_price_ngn,extra_seat_price_usd,demo_days,included_live_seats,included_demo_seats,metrics_json,is_active';

async function ownerAuthorized(request:Request) {
  const header=request.headers.get('authorization') || '';
  const token=header.startsWith('Bearer ')?header.slice(7).trim():'';
  if(!token) return false;
  const {data,error}=await getSupabaseAdmin().auth.getUser(token);
  return !error && data.user?.email?.toLowerCase()===OWNER_EMAIL;
}
function attachArtifact(product:Record<string,unknown>,artifact:Record<string,unknown>|null) {
  return {...product,artifact_path:artifact?.storage_path??'',artifact_sha256:artifact?.sha256??'',artifact_size_bytes:artifact?.size_bytes??0,artifact_version:artifact?.artifact_version??product.version,release_approved:artifact?.release_approved===true};
}

export async function GET(request:Request) {
  if(!await ownerAuthorized(request)) return NextResponse.json({error:'Owner authorization required.'},{status:403});
  const admin=getSupabaseAdmin();
  const [products,artifacts]=await Promise.all([
    admin.from('ea_products').select(FIELDS).order('category').order('name'),
    admin.from('ea_product_artifacts').select('ea_slug,storage_path,sha256,size_bytes,artifact_version,release_approved,approved_at'),
  ]);
  if(products.error || artifacts.error) return NextResponse.json({error:'Catalog could not be loaded.'},{status:503});
  const map=new Map((artifacts.data||[]).map((item:Record<string,unknown>)=>[String(item.ea_slug),item]));
  return NextResponse.json({products:(products.data||[]).map((item:Record<string,unknown>)=>attachArtifact(item,map.get(String(item.slug))||null))},{headers:{'Cache-Control':'no-store'}});
}

export async function PATCH(request:Request) {
  if(!await ownerAuthorized(request)) return NextResponse.json({error:'Owner authorization required.'},{status:403});
  try {
    const body=await request.json();
    const slug=String(body?.slug||'').trim().toLowerCase();
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return NextResponse.json({error:'Valid product slug required.'},{status:400});
    const admin=getSupabaseAdmin();
    const numeric=['monthly_price_ngn','monthly_price_usd','annual_price_ngn','annual_price_usd','extra_seat_price_ngn','extra_seat_price_usd','demo_days','included_live_seats','included_demo_seats'];
    const patch:Record<string,unknown>={updated_at:new Date().toISOString()};
    for(const field of numeric) {
      if(body[field]===undefined) continue;
      const value=Number(body[field]);
      if(!Number.isFinite(value)||value<0||(field==='demo_days'&&(!Number.isInteger(value)||value<1||value>30))||(field.includes('seats')&&!Number.isInteger(value))) return NextResponse.json({error:`Invalid value for ${field}.`},{status:400});
      patch[field]=value;
    }
    if(body.tagline!==undefined) patch.tagline=String(body.tagline).slice(0,240);
    if(body.category!==undefined) patch.category=String(body.category).toUpperCase().slice(0,40);
    if(body.metrics_json!==undefined&&body.metrics_json&&typeof body.metrics_json==='object'&&!Array.isArray(body.metrics_json)) patch.metrics_json=body.metrics_json;

    const hasArtifact=['artifact_path','artifact_sha256','artifact_size_bytes','artifact_version','release_approved'].some(key=>body[key]!==undefined);
    if(hasArtifact) {
      const path=String(body.artifact_path||'').trim();
      const sha=String(body.artifact_sha256||'').trim().toLowerCase();
      const size=Number(body.artifact_size_bytes||0);
      const version=String(body.artifact_version||'').trim();
      const approved=body.release_approved===true;
      if(path && (path.startsWith('/')||path.includes('..')||path.includes('\\')||!path.toLowerCase().endsWith('.ex5'))) return NextResponse.json({error:'Artifact path must be a safe relative .ex5 storage path.'},{status:400});
      if(approved&&(!path||! /^[a-f0-9]{64}$/.test(sha)||!Number.isSafeInteger(size)||size<=0||!version)) return NextResponse.json({error:'Release approval requires a storage path, SHA-256, file size and artifact version.'},{status:400});
      const artifact={ea_slug:slug,storage_path:path,sha256:sha,size_bytes:size,artifact_version:version,release_approved:approved,approved_at:approved?new Date().toISOString():null,updated_at:new Date().toISOString()};
      const saved=await admin.from('ea_product_artifacts').upsert(artifact,{onConflict:'ea_slug'}).select().single();
      if(saved.error) return NextResponse.json({error:'Private artifact registry update failed.'},{status:503});
    }
    if(body.is_active!==undefined) {
      if(typeof body.is_active!=='boolean') return NextResponse.json({error:'is_active must be boolean.'},{status:400});
      if(body.is_active===true) {
        const artifact=await admin.from('ea_product_artifacts').select('storage_path,sha256,size_bytes,release_approved').eq('ea_slug',slug).maybeSingle();
        if(artifact.error||!artifact.data?.release_approved||!artifact.data.storage_path||!artifact.data.sha256||!artifact.data.size_bytes) {
          return NextResponse.json({error:'Register and approve a verified compiled .ex5 artifact before publishing a commercial EA.'},{status:409});
        }
      }
      patch.is_active=body.is_active;
    }
    const updated=await admin.from('ea_products').update(patch).eq('slug',slug).select(FIELDS).maybeSingle();
    if(updated.error||!updated.data) return NextResponse.json({error:'Product update failed.'},{status:503});
    const artifact=await admin.from('ea_product_artifacts').select('storage_path,sha256,size_bytes,artifact_version,release_approved').eq('ea_slug',slug).maybeSingle();
    return NextResponse.json({success:true,product:attachArtifact(updated.data,artifact.data)},{headers:{'Cache-Control':'no-store'}});
  } catch(error) {
    console.error('Owner EA product update failed:',error);
    return NextResponse.json({error:'Invalid product update.'},{status:400});
  }
}
